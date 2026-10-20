# SlashySlash 3D: migration plan

Plan for turning the 2D side-scroller into a first-person, Doom-style 3D game. Written against commit `cf7047a` (8,054 lines of JS).

## Recommendation

1. **Use real 3D (Three.js, WebGL) and give it a Doom look.** Don't build a raycaster or a Doom-style sector engine. The game depends on height: stacked rooftops, an overpass you can stand on and walk under, plunges, drones overhead, snipers on ledges, tethering to things above you. A raycaster can't do height at all. A sector engine can't put one floor above another and fakes looking up and down by shearing the image, which distorts at the steep angles that tether and plunge aiming need.
2. **Build the 3D game next to the 2D one in the same repo**, as `index3d.html`. Both share the data and system modules. Swap the entry point and delete the 2D code once the 3D game matches it feature for feature (Phase 6). Freeze 2D features until then, so the port isn't chasing a moving target.
3. **Stop after Phase 1 and test whether first-person katana combat feels good** before investing further. This is the biggest risk in the plan. If it fails, the fallback is an over-the-shoulder third-person camera, which keeps about 90% of the 3D work.
4. **Keep the project's constraints**: no asset files, everything generated in code, runs from `file://`, and `tools/build.js` still produces one self-contained HTML file.

How much code carries over:

| | Lines | Share | Files |
| --- | --- | --- | --- |
| Kept as is or lightly extended | ~1,950 | 24% | util, settings, input, audio, upgrades, waves, ui, the non-camera half of main |
| Behaviour carries over, code rewritten | ~4,200 | 52% | player, enemies, specialists, rival, ultimates, training |
| Replaced | ~1,900 | 24% | level, render (scene half), fx, sprites, main loop and camera |

Most of the tuning survives: timings, damage, wind-ups, parry windows, style values, wave tables, upgrade rules. Movement, collision, hit tests and all drawing get rewritten.

## What "Doom-style" means here

- 480×270 internal resolution (the same `VIEW_W`/`VIEW_H`), upscaled with nearest-neighbour filtering. A 320×180 option is cheap to add.
- Procedural pixel textures (64×64, nearest filtering, no mipmaps) generated in code from the existing building `style` keys.
- Enemies are camera-facing sprites (billboards) drawn by the existing procedural rig, so the pixel-line look and 1 px outline stay.
- Darkness from distance fog and per-area light levels, plus neon, lamps and fires as light sources.
- Chunky square particles, a katana and hands drawn at the bottom of the screen with bob and sway, and the HUD in the existing 3×5 bitmap font.
- Fast movement. No aiming down sights, no reloads.

Out of scope: multiplayer, gamepad, touch, a level editor, a physics engine.

## Technical foundation

**Three.js as a vendored global.** Three no longer ships a classic-script build (checked on 0.186.1: only `three.module.js` and `three.cjs`), and ES modules don't load from `file://`. So `tools/vendor-three.js` bundles a pinned version once, with esbuild, into `vendor/three.js` as a global `THREE`, importing only the classes the game uses. The file is committed. Classic scripts and `file://` keep working, and `build.js` only needs `vendor/` added to its script regex. Measured cost: 545 KB minified (136 KB gzipped) for a typical subset; the whole game is 405 KB today.

**Units and axes.** 1 unit = 1 m, y up, x along the old street, z for depth. The scale is `PX = 1/11` (the player's 20 px becomes 1.8 m). A helper `to3(x, y)` returns `(x * PX, (Level.GROUND - y) * PX)` and is used to port level data and as a starting point for constants. The 2D y axis points down, so every `vy` sign flips. Expect that to be the most common porting bug; port one function at a time and check each `vy`.

The converted constants are only a starting point, because 2D platformer physics is exaggerated:

| Constant | 2D | Converted | Note |
| --- | --- | --- | --- |
| `RUN` | 152 px/s | 13.8 m/s | Fast but within boomer-shooter range |
| `GRAV` | 960 px/s² | 87 m/s² | About 9 times real gravity |
| Jump apex | 47 px | 4.3 m | Plus 3.8 m from the double jump |
| Dash | 67 px | 6.1 m | |
| `TETHER_RANGE` | 230 px | 21 m | |
| Swing reach (stages 1 and 3) | 36 / 54 px | 3.3 / 4.9 m | Generous, which helps first-person melee |

`tools/feel-check.js` runs the controller headless and prints jump apex, double-jump reach, dash and slide distance in metres. It fails if a roof tier can't be reached with the intended move. This makes retuning measurable instead of guesswork.

**Simulation loop.** Keep the fixed 120 Hz tick, slow motion, hitstop, bullet time and the cutscene state as they are. Two changes:

- Mouse look is applied every rendered frame in real time. It is never scaled by slow motion or paused by hitstop. Looking around at full speed during slow motion is part of why Ghostrunner's slow motion feels good.
- The camera position is interpolated between ticks, so it doesn't stutter on 144 Hz screens.

**Collision.** The world stays a list of axis-aligned boxes. `Level.moveBody` becomes a three-axis version with the same sub-stepping, plus step-up and ledge mantle. Raycasts test the ray against each box; with about 200 boxes, brute force is fine to start, and a uniform grid can come later.

**Input.** Pointer Lock with `movementX`/`movementY`, sensitivity, invert Y. New default bindings: WASD to move, `Space` jump, `C`/`Ctrl` crouch and slide, `Shift` dash, `E` parry, left mouse slash, right mouse tether, `R` ultimate. Bump `SETTINGS_KEY` to `v2` so old saves (where `W` is jump and `S` is crouch) don't carry over. Two browser behaviours to handle:

- Browsers use `Esc` to exit pointer lock and don't pass the key to the page. Pause on `pointerlockchange` instead of on the key.
- Re-locking needs a click or key press, and Chrome refuses a re-lock for about a second after `Esc`. The Resume button has to cope with that.

**Rendering.** `WebGLRenderer` draws into a 480×270 render target, which is then copied to the screen canvas at nearest-neighbour scale. A 2D canvas on top, at the same resolution, carries the HUD, reusing `render.js`'s HUD code and the bitmap font. Two Three.js traps:

- Changing the number of lights recompiles shaders and stutters. Use a fixed pool of about 8 point lights and set unused ones to zero intensity.
- Uploading one texture per enemy every frame adds up. Draw all character sprites into one shared atlas canvas and upload it once per frame.

**Audio.** `Sound.play(name, at)` takes an optional world position and routes the sound through a `PannerNode` (or a stereo pan plus distance gain). The music sequencer doesn't change. Positional glint and wind-up sounds matter for fairness (see below).

**Smoke test.** Keep `tools/smoke-test.js`, feeding random mouse movement instead of cursor positions, and check that the player stays inside the arena bounds and outside solid boxes. Headless Chromium here (build 1194) gets WebGL2 through SwiftShader with no flags. Pass `--use-angle=swiftshader --enable-unsafe-swiftshader` anyway, since newer Chromium builds require them.

## Mechanics in first person

| 2D today | First-person version | Notes |
| --- | --- | --- |
| A/D to move, camera follows | WASD relative to where you look, mouse look | |
| Jump, double jump, jump cut | Same | |
| Crouch, slide when running | Same, on `C`/`Ctrl`; the camera drops | Sliding is the main way under bolts |
| Bullet jump toward the cursor | Crouch or slide plus jump launches you where you look | Warframe's original is 3D |
| Wall jump on the two boundary walls | Kick off any wall you touch, away from it | Defer wall running |
| One-way platforms, drop-through | Solid platforms plus ledge mantle | In first person, jump-through floors catch your head and are hard to read; mantling covers getting up |
| Vault cover by running into it | Mantle low cover when moving into it; crouch to stay behind it | Shots from above reach you naturally |
| Dash: 2 charges, 0.2 s invulnerability | Shift plus a WASD direction relative to view; forward if none held | Optional FOV kick |
| Slash combo toward the cursor | Toward the crosshair: swing 1 right to left, swing 2 left to right, swing 3 wide diagonal with lunge | Hit test: angle from the view direction within the swing span sideways and ±35° vertically, within reach. If a target is within 1.5 times reach, lunge onto it |
| Swings deflect bolts | Same; returned bolts fly at the crosshair | |
| Dash slash | Same: cuts everything along the dash path | Capsule sweep along the path |
| Ground cut while sliding | Same; rubble sprays in a forward cone | |
| Plunge | Same; ground ring shockwave scaled by fall height | Vertical ray finds the landing surface |
| Parry: `E`, glint 0.28 s before the hit | Same timings; the parry works against hits from any direction | See the fairness rules below |
| Counter: release `E`, chain lightning | Same; the drawn slash goes along the view | |
| Tether: tap to fling, hold to zip | Ray from the crosshair, with about 4° of aim assist toward enemies, grenades and barrels | Doom Eternal's Meathook is the reference for zipping to an enemy |
| Barrel grab, swing and throw | The barrel hangs on the line in front of you, swings as you look around, and is thrown at the crosshair | |
| Grenade rebound in bullet time | Same; slash it toward the crosshair and it curves toward the rival | Reads better in 3D than in 2D |
| Sawblade ultimate | First person with a saw ring around the screen edges; lunges and latching unchanged | |
| Style meter, hitstop, slow motion | Unchanged | |
| Off-screen enemy arrows (a setting) | A threat ring around the crosshair, on by default | Essential in first person, not decoration |
| Camera look-ahead | Removed | |

`facing` (±1) appears 136 times across the code. It becomes a yaw angle plus a `forward()` vector, and "is it in front of me" checks become dot products.

## Fairness in first person

The 2D fairness rules assume every threat is on screen. In first person most of the arena is behind you. Rules to add:

- **Melee tokens consider the view.** An enemy outside about 60° of the view direction can still take an attack slot, but its wind-up is 1.5 times longer. Its glint plays as a positional sound and shows as a marker at the edge of the screen.
- **Ranged threats.** A gunner's laser lock is drawn as a line in the world; if the gunner is off-screen, a red wedge on the threat ring points to it. Sniper lasers are lines in the world and read on their own.
- **Hits show their direction**, with a marker on the threat ring.
- **The parry works in every direction**, so reacting to a glint you only heard is valid.

## Comfort

Dashes, zips, slow motion and screen shake are what cause motion sickness in first-person games. Defaults:

- FOV slider.
- Screen shake becomes a small rotation kick of the view; the camera position never shakes.
- No camera roll.
- FOV kick on dash and zip, and head bob, each with a toggle.
- Slow cutscene camera moves.

## Arena

**Phase 1** extrudes the existing 2D street into 3D using `to3`, so spawns, barrel spots and perches keep working for testing. As an FPS arena it's poor: about 218 m long and one street wide, with long sniper sightlines and enemies arriving from only two directions.

**Phase 4** replaces it with a purpose-built crossroads of about 70×70 m:

- Four short streets and a central plaza.
- Solid buildings with walkable roofs, linked by girders.
- An overpass across one street that you can stand on and walk under.
- Fire escapes on building fronts as climbing routes.
- The existing jersey barriers, barrel spots and sniper perches.

It stays a box list in data, as `level.js` is today, textured from the existing `style` keys.

## Enemies and AI

**Navigation.** Each walkable layer (street, each roof) gets a grid of 0.5 m cells. A flow field is computed from the player's cell (breadth-first search) and recomputed only when the player changes cell, which stays cheap with many enemies. Jump links between layers (curbs, cover, roof edges) are computed when the level loads. Ground enemies follow the flow field and keep apart from each other (the existing anti-stacking push). Drones steer freely in 3D. Snipers use the perch list and zip. The rival drives the player's controller (see below).

**Behaviour** ports type by type with its timings unchanged. Three things change: AABB melee checks become cylinder or sector tests, `facing` becomes yaw, and `findFiringSpot` adds a line-of-sight check.

| Enemy | What changes in 3D |
| --- | --- |
| Scrapper | Chases along the flow field; the glint sits on the cleaver |
| Gunner | Finds firing spots with line of sight; the laser lock is a 3D line; it flanks around cover using the navigation grid |
| Drone | Circles above head height and dives in a straight line; the first enemy that makes you look up |
| Brute | Its shockwave becomes an expanding ring on the ground; jump over it or stand behind cover |
| Shield scrapper | "Front" is a ±60° cone from its yaw; its turn rate controls difficulty; parry the bash or dash past to its back |
| Armoured crawler | Low to the ground, so ground cut and plunge hit areas reach lower; a ground marker keeps it visible below the view |
| Grenadier | Arc preview and landing ring drawn on the ground |
| Sniper | Perches come from arena data; laser line; zips between perches |

**Sprites.** Phase 1 draws the existing side-view rig into the sprite atlas and mirrors it based on the camera angle. That's enough to test feel, but an enemy facing you is still drawn in profile. Phase 3 gives the rig's joints a depth coordinate and projects them for each viewing angle. That gives smooth rotation without Doom's 8-angle sprite sheets and keeps the pixel-line look. Hit flash, outlines and the gold elite outline keep using `Sprite.end`'s silhouette compositing.

## Player presentation

The katana and hands are drawn at the bottom of the screen in screen space, using the existing pixel-line tools. There are poses for idle, the three swings, parry stance, dash slash, plunge, tether hand, ground cut and hurt. Swings show as screen-space dithered arcs (FX already has these), plus a short trail in the world so cutscene cameras can see them.

The player's full body is only needed in third-person cutscenes. It reuses the Phase 3 rig.

## Rival (AEGIS-07)

The README promises the rival is built on "the same skeleton, physics and power level as the player". Keep that by having both use one 3D character controller (`js/3d/controller.js`). The rival already steers through an intent object (`{ mx, jump, drop }` from `navigate()`). That becomes `{ move, jump, dash, zipTarget }`.

All its attacks port:

- Gun bursts, the greatblade and the pulse grenade.
- The visor beam. Its "angular momentum" becomes limits on how fast its yaw and pitch can turn.
- Phase 2: combos, clash, guard and riposte.

Cutscenes move the camera out of the player's head: an orbit around the rival for the enrage, and a narrower FOV instead of the 2D game's 2x zoom. The knockout gets a slow orbit. The letterbox bars and skip-by-holding stay.

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

### Phase 1: playable slice and feel test (~2,500)

- The extruded street, with procedural textures for three building styles.
- Pointer-lock camera, interpolation, FOV, sensitivity.
- Controller: run, jump, double jump, crouch, slide, dash, mantle, step-up.
- The katana view model and three-hit combo, with the cone hit test and lunge assist.
- Scrappers on the street-level flow field, drawn as side-view billboards, with glint, parry and counter.
- HUD: health, shield, dash charges, crosshair, threat ring.
- `tools/feel-check.js`.

**Feel test (decide before Phase 2).** Play 15 minutes against waves of scrappers and check:

1. The combo lands on a moving scrapper without frequent whiffs.
2. You can parry from the glint alone at the default 0.2 s window.
3. Dash into dash slash feels like one move.
4. No motion discomfort at default settings.

If 1 to 3 still fail after tuning the hit cones and lunge assist, switch to an over-the-shoulder third-person camera. The world, controller, AI and effects all carry over, and you get your body back for readability. Don't start Phase 2 on a failed test.

### Phase 2: full move set (~2,000)

- Tether in every mode, with aim assist; barrels.
- Gunner bolts and returning them.
- Plunge, ground cut and rubble, bullet jump, wall kick.
- Shield, health and the overflow rule.
- Style meter.
- Slow motion, hitstop, and the bullet-time grey-out as a post-processing pass.
- Positional audio.
- 3D effects in `js/3d/fx3d.js`: particles, rings, lightning, ground marks, slash trails.

### Phase 3: enemies, AI and waves (~2,500)

- Navigation layers and jump links.
- The other seven enemy types.
- Attack slots with the view-cone rule; threat ring markers.
- Director modes: demo, endless, upgrades, wave modifiers.
- Pickups, damage numbers (projected into the HUD canvas), first-time hints.
- The 3D rig projected per viewing angle, replacing the side-view billboards; the shared sprite atlas.

### Phase 4: arena and look (~1,000)

- The crossroads arena.
- The light pool; neon, lamps and fires; weather; fog.
- The Blackout modifier.
- A drifting camera behind the title screen.

### Phase 5: rival, ultimate and training (~2,000)

- AEGIS-07 on the shared controller, both phases.
- Cutscenes with third-person cameras.
- The player body sprite for cutscenes.
- Sawblade.
- Training (dummy and spawn panel) and Melee Duel.

### Phase 6: parity and cutover

- Work through the README feature by feature until the 3D game matches it.
- Migrate saved settings to v2 and rewrite the README.
- Tag the last 2D commit `v2d-final`, rename `index3d.html` to `index.html`, delete the 2D-only files, and point the smoke test at the single page.

End state: about 11,000 to 12,000 lines.

## What happens to each file

| File | Lines | Fate |
| --- | --- | --- |
| `util.js` | 278 | Keep; add vec3 helpers, ray-vs-box and cone tests |
| `settings.js` | 145 | Keep; new bindings, FOV, sensitivity, invert Y, comfort toggles; storage key to v2 |
| `input.js` | 109 | Extend: pointer lock, mouse deltas, `Esc` handling |
| `audio.js` | 687 | Keep; add positional `play` |
| `upgrades.js` | 64 | Keep; the Aftershock ground wave becomes a ring |
| `waves.js` | 166 | Keep the logic; spawns go through `Arena` |
| `ui.js` | 252 | Keep; new settings rows; re-lock the pointer on resume |
| `training.js` | 142 | Port ("in front of you" means along the view) |
| `main.js` | 392 | Split: about 250 lines of core shared, loop and camera rewritten |
| `player.js` | 1,498 | Port: state machine and timings carry over; movement, hit tests, poses and drawing are rewritten, and drawing splits into the view model and a cutscene body |
| `enemies.js` | 818 | Port behaviour; physics, navigation, hit tests and drawing rewritten |
| `specialists.js` | 374 | Port |
| `rival.js` | 1,150 | Port; cutscenes rewritten for 3D cameras |
| `ultimates.js` | 226 | Port; the `registerUltimate` API stays |
| `level.js` | 773 | Replaced by `js/3d/world.js` and arena data |
| `render.js` | 460 | Scene drawing replaced; the HUD half reused |
| `fx.js` | 431 | Replaced by world-space effects; screen flashes and dithered arcs reused for the view model |
| `sprites.js` | 89 | Extended: 3D joints projected per viewing angle |

New files under `js/3d/`:

| File | Contents |
| --- | --- |
| `world.js` | Arena boxes, collision, raycasts, navigation grid, flow field |
| `gfx.js` | Renderer, render target, procedural textures, light pool, fog |
| `billboard.js` | Sprite atlas, rig projection |
| `fx3d.js` | 3D effects |
| `controller.js` | Shared player and rival movement |
| `player3d.js` | Player actions |
| `viewmodel.js` | On-screen katana and hands |
| `enemies3d.js`, `specialists3d.js`, `rival3d.js`, `ultimates3d.js` | Ported behaviour |
| `main3d.js` | Loop, camera, pointer lock |

## Risks, highest first

1. **First-person melee feels vague** (whiffs, no sense of impact). Caught by the Phase 1 feel test; the fallback is third person.
2. **Unfair hits from behind.** Handled by the view-cone attack slots, positional glints, the threat ring and the all-direction parry.
3. **Motion sickness.** Handled by the comfort defaults.
4. **The 2D game keeps changing during the port.** Freeze its features.
5. **Navigation across levels and roofs.** Most enemies stay on the street; drones, snipers and the rival handle height through their own movement.
6. **Retuning platformer constants for first person** eats time. `feel-check.js` keeps it measurable; tune in metres, never by converting pixel values again.
7. **Three.js performance traps** (shader recompiles when lights change, per-frame texture uploads). Use the fixed light pool and the shared sprite atlas from the start.

## Open decisions

Recommendations first.

- **Keep the 2D game as a mode after cutover?** No. Two renderers and two controllers double the work for every change. The `v2d-final` tag preserves it.
- **If the feel test fails:** third person, not a return to 2D.
- **Long-term arena:** the crossroads. The extruded street is for testing only.
- **Wall running:** defer; a later endless upgrade is a natural home for it.
- **Gamepad:** out of scope, as it is today.
