# SlashySlash 3D: migration plan

Plan for turning the 2D side-scroller into a third-person 3D action game. It uses a Risk of Rain 2 style camera that orbits the player, and a Half-Life 1 style low-poly look. Written against commit `cf7047a` (8,054 lines of JS).

This revision replaces the earlier first-person, Doom-sprite plan.

## Recommendation

1. **Build it in Three.js (WebGL)**, with a camera that orbits behind and above the player, as in Risk of Rain 2. Give it the Half-Life 1 look: characters built in code from a few hundred polygons, small textures, and lighting baked into the level when it loads.
2. **Build the 3D game next to the 2D one in the same repo**, as `index3d.html`. Both share the data and system modules. Swap the entry point and delete the 2D code once the 3D game matches it feature for feature (Phase 6). Freeze 2D features until then, so the port isn't chasing a moving target.
3. **Stop after Phase 1 and test the camera and the melee** before investing further. A third-person camera removes the biggest first-person risk, because you see your own swings and the glints around you. It adds a different one: the camera colliding with a dense, vertical city full of walls, girders and an overpass.
4. **Keep the project's constraints**: no asset files, everything generated in code, runs from `file://`, and `tools/build.js` still produces one self-contained HTML file. Models are assembled from simple shapes in code, and animation stays procedural, as it is now.

The closest existing reference for the combat in this camera is Risk of Rain 2's Mercenary. Its three-hit sword combo and chaining dash attack map closely onto SlashySlash's combo and dash slash.

How much code carries over:

| | Lines | Share | Files |
| --- | --- | --- | --- |
| Kept as is or lightly extended | ~1,950 | 24% | util, settings, input, audio, upgrades, waves, ui, the non-camera half of main |
| Behaviour carries over, code rewritten | ~4,200 | 52% | player, enemies, specialists, rival, ultimates, training |
| Replaced | ~1,900 | 24% | level, render (scene half), fx, sprites, main loop and camera |

Most of the tuning survives: timings, damage, wind-ups, parry windows, style values, wave tables, upgrade rules. Movement, collision, hit tests and all drawing get rewritten. The player's and rival's poses partly survive (see Characters and animation); the enemies' drawing code doesn't.

## The camera (Risk of Rain 2 style)

- **Framing.** The camera sits behind the player and looks over their head. The player stays in the lower middle of the screen with the crosshair above them. Pivot about 0.5 m above the head, default distance 5 m (adjustable from 3 to 7 m).
- **Control.** The mouse turns the camera directly, with no smoothing on rotation. Pitch is limited to ±80°. The camera follows the player's position with light smoothing on the vertical axis only, so jumps don't jerk the view.
- **Collision.** A sphere (radius 0.25 m) is swept from the pivot to the camera's target position. If it hits the world, the camera moves in to the hit point at once, then eases back out over about 0.3 s once the space clears. Below 1 m from the pivot the player model fades out, so the camera never sits inside them.
- **Aim.** A ray goes from the camera through the crosshair; hits closer than the player are ignored. The aim point is the first thing the ray hits, or a point 60 m out. Slashes, the tether and returned bolts all travel from the character toward the aim point.
- **Which way the character faces.** While attacking, parrying or tethering, and for 0.6 s after, the whole body faces where you aim. Otherwise it faces the direction it's moving.
- **Melee aim assist.** When a swing starts, the character turns toward the nearest enemy within 30° of the aim and within 1.5 times reach, and lunges onto it. There's no hard lock-on; that becomes an option only if the feel test asks for it.
- **Speed and height.** The FOV widens slightly during dashes, zips and bullet jumps (with a toggle). The camera's position lags a little behind zips so the speed reads. During a plunge, a ring marks where you'll land, so you don't have to look straight down.
- **Special cases.** The Sawblade ultimate pulls the camera back to 7 m. Cutscenes take over with their own camera positions.

## The look (Half-Life 1 style)

- **Characters.** Each body part is a simple shape (box, six-sided tapered prism, wedge), built in code and coloured from the existing palettes (`PCOL`, the enemy `debris` colours). A character is 200 to 600 triangles. Shading is smooth within a part, with hard edges between parts.
- **Rigid skinning.** Each part moves with exactly one bone, which is also how Half-Life 1's models worked, so no skin weights are needed. A character is built as one `SkinnedMesh` whose vertices are each fully assigned to one bone, so it costs one draw call.
- **Textures.** Small procedural textures (64 to 128 px) for walls and floors, generated from the existing building `style` keys, with a limited palette per texture. Nearest filtering, so texels stay crisp and match the pixel HUD. Half-Life 1's OpenGL renderer used bilinear filtering; that's a one-line switch if softer looks better.
- **World lighting.** Light from the static lamps, neons and fires is baked into the level's vertex colours on a 1 m grid when the level loads. Shadows come from ray tests against the boxes. This stands in for Half-Life 1's lightmaps. If the 1 m grid shows banding, move to a small lightmap texture.
- **Character lighting.** Characters take their light from the baked light under their feet, as Half-Life 1 does, plus a fixed pool of about 8 dynamic lights for explosions, the tether, muzzle flashes and fire flicker. Each character gets a round blob shadow.
- **Resolution.** Native, with a resolution scale setting (100%, 75%, 50%). A "Retro" preset renders at 480×270 with nearest-neighbour upscaling, which keeps a link to the 2D game's pixel look at no extra cost.
- **Effects.** Additive sprites for sparks, glows, glints and muzzle flashes, as Half-Life 1 used. Ribbon meshes for sword trails and the red scarf (its existing physics chain extended to 3D). Jagged line strips for lightning. Ground marks for gouges and scorches.
- **HUD.** The existing 3×5 bitmap-font HUD as a 2D overlay. Half-Life 1's flat HUD digits are the same spirit.
- **Outlines.** None; Half-Life 1 had none. Elite enemies get a gold outline, drawn as a slightly enlarged copy of the model with its faces flipped.

## Technical foundation

**Three.js as a vendored global.** Three no longer ships a classic-script build (checked on 0.186.1: only `three.module.js` and `three.cjs`), and ES modules don't load from `file://`. So `tools/vendor-three.js` bundles a pinned version once, with esbuild, into `vendor/three.js` as a global `THREE`, importing only the classes the game uses. The file is committed. Classic scripts and `file://` keep working, and `build.js` only needs `vendor/` added to its script regex. Measured cost: 545 KB minified (136 KB gzipped) for a typical subset; the whole game is 405 KB today.

**Units and axes.** 1 unit = 1 m, y up, x along the old street, z for depth. The scale is `PX = 1/11` (the player's 20 px becomes 1.8 m). A helper `to3(x, y)` returns `(x * PX, (Level.GROUND - y) * PX)` and is used to port level data and as a starting point for constants. The 2D y axis points down, so every `vy` sign flips. Expect that to be the most common porting bug; port one function at a time and check each `vy`.

The converted constants are only a starting point, because 2D platformer physics is exaggerated:

| Constant | 2D | Converted | Note |
| --- | --- | --- | --- |
| `RUN` | 152 px/s | 13.8 m/s | Fast; Risk of Rain 2 survivors sprint at roughly 10 m/s |
| `GRAV` | 960 px/s² | 87 m/s² | About 9 times real gravity |
| Jump apex | 47 px | 4.3 m | Plus 3.8 m from the double jump |
| Dash | 67 px | 6.1 m | |
| `TETHER_RANGE` | 230 px | 21 m | |
| Swing reach (stages 1 and 3) | 36 / 54 px | 3.3 / 4.9 m | Generous, which helps melee in 3D |

`tools/feel-check.js` runs the controller headless and prints jump apex, double-jump reach, and dash and slide distance in metres. It fails if a roof tier can't be reached with the intended move. This makes retuning measurable instead of guesswork.

**Simulation loop.** Keep the fixed 120 Hz tick, slow motion, hitstop, bullet time and the cutscene state as they are. Three changes:

- Mouse look is applied every rendered frame in real time. It is never scaled by slow motion or paused by hitstop.
- The camera and every character's drawn position are interpolated between ticks, so nothing stutters on 144 Hz screens.
- Poses are evaluated at render time from the same timers they use now.

**Collision.** The world stays a list of axis-aligned boxes. `Level.moveBody` becomes a three-axis version with the same sub-stepping, plus step-up and ledge mantle. Raycasts and the camera's sphere sweep test against each box; with about 200 boxes, brute force is fine to start, and a uniform grid can come later.

**Input.** Pointer Lock with `movementX`/`movementY`, sensitivity, invert Y. New default bindings: WASD to move (relative to the camera), `Space` jump, `C`/`Ctrl` crouch and slide, `Shift` dash, `E` parry, left mouse slash, right mouse tether, `R` ultimate. Bump `SETTINGS_KEY` to `v2` so old saves (where `W` is jump and `S` is crouch) don't carry over. Two browser behaviours to handle:

- Browsers use `Esc` to exit pointer lock and don't pass the key to the page. Pause on `pointerlockchange` instead of on the key.
- Re-locking needs a click or key press, and Chrome refuses a re-lock for about a second after `Esc`. The Resume button has to cope with that.

**Rendering.** `WebGLRenderer` at native resolution times the resolution scale, with a 2D canvas on top for the HUD. Two Three.js traps:

- Changing the number of lights recompiles shaders and stutters. Use the fixed light pool and set unused lights to zero intensity. Baked world lighting keeps the pool small.
- One mesh per body part would cost about 15 draw calls per character. The single rigidly skinned mesh per character keeps it to one.

**Audio.** `Sound.play(name, at)` takes an optional world position and routes the sound through a `PannerNode` (or a stereo pan plus distance gain). The music sequencer doesn't change. Positional glint and wind-up sounds matter for fairness (see below).

**Smoke test.** Keep `tools/smoke-test.js`, feeding random mouse movement instead of cursor positions. Check that the player stays inside the arena bounds and outside solid boxes, and that the camera never ends up inside a box. Headless Chromium here (build 1194) gets WebGL2 through SwiftShader with no flags. Pass `--use-angle=swiftshader --enable-unsafe-swiftshader` anyway, since newer Chromium builds require them.

## Mechanics in third person

| 2D today | Third-person version | Notes |
| --- | --- | --- |
| A/D to move | WASD relative to the camera; the character turns toward where it's moving | |
| Jump, double jump, jump cut | Same | |
| Crouch, slide when running | Same, on `C`/`Ctrl` | Sliding is the main way under bolts |
| Bullet jump toward the cursor | Crouch or slide plus jump launches you toward the aim point | |
| Wall jump on the two boundary walls | Kick off any wall you touch, away from it | Defer wall running |
| One-way platforms, drop-through | Solid platforms plus ledge mantle | One rule for collision, the camera's sweep and enemy navigation; mantling covers getting up |
| Vault cover by running into it | Mantle low cover when moving into it; crouch to stay behind it | Shots from above reach you naturally |
| Dash: 2 charges, 0.2 s invulnerability | Shift plus a WASD direction relative to the camera; forward if none held | |
| Slash combo toward the cursor | Toward the aim point, with the melee aim assist: swing 1 right to left, swing 2 left to right, swing 3 wide diagonal with lunge | Hit area: a sector in front of the character within reach, with a vertical band of ±1.2 m (more on swing 3). Swings show as trail ribbons |
| Swings deflect bolts | Same; returned bolts fly to the aim point | |
| Dash slash | Same: cuts everything along the dash path | Capsule sweep along the path |
| Ground cut while sliding | Same; rubble sprays in a forward cone | |
| Plunge | Same, with a landing ring; the ground shockwave is a ring scaled by fall height | A vertical ray finds the landing surface |
| Parry: `E`, glint 0.28 s before the hit | Same timings; the parry works against hits from any direction | See the fairness rules below |
| Counter: release `E`, chain lightning | Same; the drawn slash goes toward the aim point | |
| Tether: tap to fling, hold to zip | Ray from the camera through the crosshair, with about 4° of aim assist toward enemies, grenades and barrels; the line is drawn from the character's hand | |
| Barrel grab, swing and throw | The barrel swings on the line around the character and is thrown at the aim point | Reads better from behind than in first person |
| Grenade rebound in bullet time | Same; slash it toward the aim point and it curves toward the rival | |
| Sawblade ultimate | The character becomes the saw; the camera pulls back; lunges and latching unchanged | |
| Style meter, hitstop, slow motion | Unchanged | |
| Off-screen enemy arrows (a setting) | A threat ring around the crosshair, on by default | Threats behind the camera still need it |
| Camera look-ahead | Replaced by the camera distance setting | |

`facing` (±1) appears 136 times across the code. It becomes a yaw angle plus a `forward()` vector, and "is it in front of me" checks become dot products.

## Fairness

The 2D fairness rules assume every threat is on screen. With the camera behind you, you see your surroundings better than in first person, but threats behind the camera are still hidden. Rules to add:

- **Attack slots consider the camera.** An enemy more than about 75° from where the camera faces can still take an attack slot, but its wind-up is 1.3 times longer. Its glint plays as a positional sound and shows as a marker on the threat ring.
- **Glints and wind-up markers draw on top of walls**, so an enemy hidden from the camera behind a building, but able to reach you, still shows its attack.
- **Ranged threats.** A gunner's laser lock is a line in the world; if the gunner is off-screen, a red wedge on the threat ring points to it. Sniper lasers read on their own.
- **Hits show their direction**, with a marker on the threat ring.
- **The parry works in every direction**, so reacting to a glint you only heard is valid.

## Comfort

A third-person camera causes much less motion sickness than first person. Keep these defaults anyway:

- Screen shake moves the camera by small rotations, never by jolting its position.
- No camera roll.
- FOV widening on dashes and zips can be turned off.
- Camera distance is a setting.
- Cutscene camera moves are slow.

## Arena

**Phase 1** extrudes the existing 2D street into 3D using `to3`, so spawns, barrel spots and perches keep working for testing. The street gets 14 m of depth so the camera has room. As an arena it's poor: about 218 m long, with long sniper sightlines and enemies arriving from only two directions.

**Phase 4** replaces it with a purpose-built crossroads of about 70×70 m:

- Four short streets and a central plaza.
- Solid buildings with walkable roofs, linked by girders.
- An overpass across one street that you can stand on and walk under.
- Fire escapes on building fronts as climbing routes.
- The existing jersey barriers, barrel spots and sniper perches.

It stays a box list in data, as `level.js` is today.

A 5 m orbit camera needs room, so the arena follows clearance rules:

- Streets at least 12 m wide.
- At least 5 m of headroom under the overpass and girders that you can walk under.
- No alleys narrower than 6 m.
- Building interiors can't be entered.

`feel-check.js` can test these from the box list.

## Characters and animation

**Rig.** Hips, spine, head, two arms (upper, forearm, hand), two legs (thigh, shin, foot), a weapon bone, and the scarf chain. Limbs are solved with three-dimensional two-bone IK, with knees bending forward and elbows back and out. The 2D `ik2` in `sprites.js` becomes this.

**What the 2D poses give you.** `Player.pose()` and the rival's `customPose()` already output hand and foot targets, lean and body rotation, all in the character's side plane (forward and up). That plane is the 3D rig's side plane, so most poses port by spreading the left and right limbs sideways: run, jump, crouch, slide, the dash lean, plunge, hurt, death, parry stance and the knockout. Swings don't port. In 2D they arc in the side plane; in 3D they sweep around the character. The three combo swings, dash slash, counter, ground cut, and the rival's five combo moves need new 3D poses.

**Enemies.** They are drawn directly by code like `renderScrapper()`, with no pose data, so their models and animation are new. Share the work:

- Scrapper, gunner, shield scrapper, grenadier, sniper and the training dummy are variants of one humanoid rig with different parts.
- The brute is a scaled-up humanoid.
- The crawler and drone need their own rigs.

**Effects of the change.**

- Gibs come for free, because every body part is already a separate rigid shape: on death, each part flies off on its own.
- Hit flash becomes a white emissive tint.
- Ragdoll is out of scope; deaths stay hand-animated, as now.

## Enemies and AI

**Navigation.** Each walkable layer (street, each roof) gets a grid of 0.5 m cells. A flow field is computed from the player's cell (breadth-first search) and recomputed only when the player changes cell, which stays cheap with many enemies. Jump links between layers (curbs, cover, roof edges) are computed when the level loads. Ground enemies follow the flow field and keep apart from each other (the existing anti-stacking push). Drones steer freely in 3D. Snipers use the perch list and zip. The rival drives the player's controller (see below).

**Behaviour** ports type by type with its timings unchanged. Three things change: box melee checks become cylinder or sector tests, `facing` becomes yaw, and `findFiringSpot` adds a line-of-sight check.

| Enemy | What changes in 3D |
| --- | --- |
| Scrapper | Chases along the flow field; the glint sits on the cleaver |
| Gunner | Finds firing spots with line of sight; the laser lock is a 3D line; it flanks around cover using the navigation grid |
| Drone | Circles above head height and dives in a straight line; it makes you look up |
| Brute | Its shockwave becomes an expanding ring on the ground; jump over it or stand behind cover |
| Shield scrapper | "Front" is a ±60° cone from its yaw; its turn rate controls difficulty; parry the bash or dash past to its back. Circling it is easier in third person, so the turn rate will need to go up |
| Armoured crawler | Low to the ground, so ground cut and plunge hit areas reach lower |
| Grenadier | Arc preview and landing ring drawn on the ground |
| Sniper | Perches come from arena data; laser line; zips between perches |

## Rival (AEGIS-07)

The README promises the rival is built on "the same skeleton, physics and power level as the player". In 3D that holds literally: both use one character controller (`js/3d/controller.js`) and one rig, with the rival's own parts and palette. The rival already steers through an intent object (`{ mx, jump, drop }` from `navigate()`). That becomes `{ move, jump, dash, zipTarget }`.

All its attacks port:

- Gun bursts, the greatblade and the pulse grenade.
- The visor beam. Its "angular momentum" becomes limits on how fast its yaw and pitch can turn.
- Phase 2: combos, clash, guard and riposte.

Cutscenes are straightforward now that everything is modelled: the camera leaves the player for an orbit around the rival during the enrage, a close shot with a narrower FOV for the roar, and a slow orbit for the knockout. The letterbox bars and skip-by-holding stay. Limiter plates popping off become real parts flying away.

## Phases

Each phase ends with both pages playable and the smoke test passing. Sizes are rough line counts of new code.

### Phase 0: groundwork (~400 changed)

- Freeze 2D features; bug fixes only.
- Move the Game core from `main.js` into `js/core.js`: style, scoring, slow motion, hitstop, bullet time, cutscene state, `announce`, `onKill`, upgrades. The 2D `main.js` keeps its loop and camera.
- Give `Director` an `Arena` interface (`spawnPoints('ground' | 'high')`, `perches`, `barrelSpots`) that both worlds implement, instead of reading `Level.spawnGround` directly.
- Add the optional position to `Sound.play(name, at)`; it does nothing in 2D.
- Add `tools/vendor-three.js` and commit `vendor/three.js`. `build.js` learns `vendor/` and builds both pages.
- Add `index3d.html` (shared scripts plus `js/3d/*`) and run the smoke test on both pages.

Done when: the 2D game is unchanged and passes, and `index3d.html` shows a lit test room.

### Phase 1: playable slice and camera test (~3,000)

- The extruded street, with procedural textures for three building styles and simple baked light.
- The orbit camera: collision, aim ray, settings for distance and sensitivity.
- Controller: run, jump, double jump, crouch, slide, dash, mantle, step-up.
- The player's model and rig with run, jump, slide and dash poses, plus the scarf.
- The three-hit combo with trails and melee aim assist.
- Scrappers on the street-level flow field, as low-poly models, with glint, parry and counter.
- HUD: health, shield, dash charges, crosshair, threat ring.
- `tools/feel-check.js`.

**Feel test (decide before Phase 2).** Play 15 minutes against waves of scrappers and check:

1. The combo lands on a moving scrapper without frequent whiffs.
2. You can parry from the glint alone at the default 0.2 s window, including glints from enemies beside or behind you.
3. Dash into dash slash feels like one move.
4. The camera keeps the player readable through double jumps, slides, dashes and fights against a building wall, without clipping or losing the player.

If 1 or 3 fail, strengthen the aim assist or add a lock-on toggle. If 4 fails, change the arena clearances and the camera's pivot and distance before changing anything else. Don't start Phase 2 until all four pass.

### Phase 2: full move set (~2,000)

- Tether in every mode, with aim assist; barrels.
- Gunner bolts and returning them.
- Plunge with its landing ring, ground cut and rubble, bullet jump, wall kick.
- New 3D poses for the dash slash, counter, ground cut and plunge.
- Shield, health and the overflow rule.
- Style meter.
- Slow motion, hitstop, and the bullet-time grey-out as a post-processing pass.
- Positional audio.
- 3D effects in `js/3d/fx3d.js`: additive sprites, rings, lightning, ground marks, trails, gibs.

### Phase 3: enemies, AI and waves (~3,000)

- Navigation layers and jump links.
- The humanoid enemy rig and its variants, then the brute, crawler and drone.
- The other seven enemy types' behaviour.
- Attack slots with the camera rule; threat ring markers; glints drawn on top of walls.
- Director modes: demo, endless, upgrades, wave modifiers.
- Pickups, damage numbers (projected into the HUD canvas), first-time hints.

### Phase 4: arena and look (~1,200)

- The crossroads arena, following the clearance rules.
- Full lighting bake; the dynamic light pool; neon, lamps and fires; weather; fog.
- The Blackout modifier, a rebake with the street lights off.
- The Retro preset.
- A slow orbit behind the title screen.

### Phase 5: rival, ultimate and training (~2,000)

- AEGIS-07 on the shared controller and rig, both phases, with its five combo moves posed in 3D.
- Cutscenes.
- Sawblade.
- Training (dummy and spawn panel) and Melee Duel.

### Phase 6: parity and cutover

- Work through the README feature by feature until the 3D game matches it.
- Migrate saved settings to v2 and rewrite the README.
- Tag the last 2D commit `v2d-final`, rename `index3d.html` to `index.html`, delete the 2D-only files, and point the smoke test at the single page.

End state: about 12,000 to 13,000 lines. Building the character models in code makes this larger than the first-person plan.

## What happens to each file

| File | Lines | Fate |
| --- | --- | --- |
| `util.js` | 278 | Keep; add vec3 helpers, ray-vs-box, sphere sweep and cone tests |
| `settings.js` | 145 | Keep; new bindings, camera distance, sensitivity, invert Y, resolution scale, comfort toggles; storage key to v2 |
| `input.js` | 109 | Extend: pointer lock, mouse deltas, `Esc` handling |
| `audio.js` | 687 | Keep; add positional `play` |
| `upgrades.js` | 64 | Keep; the Aftershock ground wave becomes a ring |
| `waves.js` | 166 | Keep the logic; spawns go through `Arena` |
| `ui.js` | 252 | Keep; new settings rows; re-lock the pointer on resume |
| `training.js` | 142 | Port ("in front of you" means along the aim) |
| `main.js` | 392 | Split: about 250 lines of core shared, loop and camera rewritten |
| `player.js` | 1,498 | Port: state machine and timings carry over; movement and hit tests are rewritten; `pose()` feeds the 3D rig; drawing is replaced by the model |
| `enemies.js` | 818 | Port behaviour; physics, navigation, hit tests rewritten; drawing replaced by models |
| `specialists.js` | 374 | Port |
| `rival.js` | 1,150 | Port; `customPose()` feeds the 3D rig; cutscenes rewritten for 3D cameras |
| `ultimates.js` | 226 | Port; the `registerUltimate` API stays |
| `level.js` | 773 | Replaced by `js/3d/world.js` and arena data |
| `render.js` | 460 | Scene drawing replaced; the HUD half reused |
| `fx.js` | 431 | Replaced by 3D effects; screen flashes reused |
| `sprites.js` | 89 | Replaced by `js/3d/rig.js` |

New files under `js/3d/`:

| File | Contents |
| --- | --- |
| `world.js` | Arena boxes, collision, raycasts, sphere sweep, navigation grid, flow field |
| `gfx.js` | Renderer, procedural textures, lighting bake, light pool, fog |
| `camera.js` | Orbit camera, collision, aim ray, cutscene cameras |
| `rig.js` | Skeleton, 3D IK, pose application, rigid skinning |
| `models.js` | Part library and the player, rival and enemy models |
| `fx3d.js` | 3D effects |
| `controller.js` | Shared player and rival movement |
| `player3d.js` | Player actions |
| `enemies3d.js`, `specialists3d.js`, `rival3d.js`, `ultimates3d.js` | Ported behaviour |
| `main3d.js` | Loop, pointer lock |

## Risks, highest first

1. **The camera in a dense, vertical city**: clipping into walls, losing the player under the overpass or against a building, and zips across the map that are hard to follow. Handled by the sphere sweep, the arena clearance rules and the Phase 1 feel test.
2. **Melee aimed by the camera.** The enemy you want is often beside the character rather than under the crosshair. Handled by the melee aim assist, with a lock-on toggle as the escalation.
3. **Building 11 character models and their animation in code** takes longer than the 2D sprites did. Handled by the shared humanoid rig, the part library, and reusing the 2D poses where they apply.
4. **Unfair hits from outside the view.** Handled by the camera-aware attack slots, positional glints, glints drawn over walls, the threat ring and the all-direction parry.
5. **The 2D game keeps changing during the port.** Freeze its features.
6. **Navigation across levels and roofs.** Most enemies stay on the street; drones, snipers and the rival handle height through their own movement.
7. **Retuning platformer constants for 3D** eats time. `feel-check.js` keeps it measurable; tune in metres, never by converting pixel values again.
8. **Three.js performance traps** (shader recompiles when lights change, draw calls per body part). Use the fixed light pool, baked world light and one skinned mesh per character from the start.

## Open decisions

Recommendations first.

- **Keep the 2D game as a mode after cutover?** No. Two renderers and two controllers double the work for every change. The `v2d-final` tag preserves it.
- **Lock-on:** soft aim assist only, unless the feel test asks for more.
- **Retro preset:** keep it. It's cheap and ties back to the 2D pixel look.
- **Long-term arena:** the crossroads. The extruded street is for testing only.
- **Wall running:** defer; a later endless upgrade is a natural home for it.
- **Gamepad:** still out of scope, but it suits a third-person action game well. It's a reasonable first addition after cutover.
