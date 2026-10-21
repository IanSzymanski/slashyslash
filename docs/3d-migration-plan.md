# SlashySlash 3D: migration plan

Plan for turning the 2D side-scroller into a third-person 3D action game. It uses a Risk of Rain 2 style camera that orbits the player, and a Half-Life 1 style low-poly look. Written against `main` at `d06f9a5` (after PR #4; 9,044 lines of JS in `js/`).

## What changed on main since the last revision

The previous revision was written against `cf7047a`. Since then, PRs #3 and #4 added:

- **Light and heavy attacks.** Tap for a light, hold 0.15 s for a heavy, in strings of up to four hits mixing both. There are heavy versions of the dash slash and the slide attack, and the heavy slide attack is a rock eruption that launches.
- **An `F` utility slot per character** (`js/utilities.js`), with Overload, a shock ring, for the player's character.
- **A kick for the grenade rebound.** You reel in feet first, kick the grenade back, and backflip off it; the sword stays sheathed.
- **No more street cover.** The jersey barriers are gone; only wrecked cars you can step over remain.
- **No instructional text during play.** Enemy hint cards, prompts and parry popups were moved to `docs/tutorial-text.md`, so mechanics have to read through visuals and sound.
- **A much larger AEGIS-07.** An entry cutscene and colour-coded outlines and eye glints as tells. In phase 2: guards, ripostes in bullet time, a parry-back, an unparryable red flash, blade waves, a dive bomb and ground eruptions. Its phase 1 shield now needs 8 returned bolts instead of 3.

What that does to the plan:

- `rival.js` grew by half (1,150 to 1,726 lines) and is now the largest and riskiest port. Several of its new phase 2 moves depend on the street being a line, so they need redesigning (see Rival).
- Coloured outlines are now a gameplay signal, not decoration, so the 3D renderer needs them early.
- Bullet time now has four kinds, each of which greys the world while its tell stays in colour. The 3D renderer needs a separate layer for that.
- Heavies, the utility and the kick add poses and Phase 2 work.
- Cover is out of the arena plan.
- With all tutorial text gone, every 3D tell has to read from the camera's distance on its own.

## Recommendation

1. **Build it in Three.js (WebGL)**, with a camera that orbits behind and above the player, as in Risk of Rain 2. Give it the Half-Life 1 look: characters built in code from a few hundred polygons, small textures, and lighting baked into the level when it loads.
2. **Build the 3D game next to the 2D one in the same repo**, as `index3d.html`. Both share the data and system modules. Swap the entry point and delete the 2D code once the 3D game matches it feature for feature (Phase 6).
3. **Freeze 2D features before the port starts.** Main is still moving fast (seven commits in PR #4, mostly to the rival), and every 2D feature added later has to be ported twice.
4. **Stop after Phase 1 and test the camera and the melee** before investing further. A third-person camera shows you your own swings and the glints around you, but it has to work in a dense, vertical city full of walls, girders and an overpass.
5. **Redesign the rival's phase 2 moves that depend on the street being a line** before porting them. In 2D you can't walk around the rival; in 3D you can.
6. **Keep the project's constraints**: no asset files, everything generated in code, runs from `file://`, and `tools/build.js` still produces one self-contained HTML file. Models are assembled from simple shapes in code, and animation stays procedural, as it is now.

The closest existing reference for the combat in this camera is Risk of Rain 2's Mercenary. Its sword combo and chaining dash attack map closely onto SlashySlash's strings and dash slash.

How much code carries over:

| | Lines | Share | Files |
| --- | --- | --- | --- |
| Kept as is or lightly extended | ~2,050 | 23% | util, settings, input, audio, upgrades, waves, ui, the non-camera half of main |
| Behaviour carries over, code rewritten | ~5,100 | 56% | player, enemies, specialists, rival, ultimates, utilities, training |
| Replaced | ~1,900 | 21% | level, render (scene half), fx, sprites, main loop and camera |

Most of the tuning survives: timings, damage, wind-ups, parry windows, string rules, style values, wave tables, upgrade rules. Movement, collision, hit tests and all drawing get rewritten. The player's and rival's poses partly survive (see Characters and animation); the enemies' drawing code doesn't.

## The camera (Risk of Rain 2 style)

- **Framing.** The camera sits behind the player and looks over their head. The player stays in the lower middle of the screen with the crosshair above them. Pivot about 0.5 m above the head, default distance 5 m (adjustable from 3 to 7 m).
- **Control.** The mouse turns the camera directly, with no smoothing on rotation. Pitch is limited to ±80°. The camera follows the player's position with light smoothing on the vertical axis only, so jumps don't jerk the view.
- **Collision.** A sphere (radius 0.25 m) is swept from the pivot to the camera's target position. If it hits the world, the camera moves in to the hit point at once, then eases back out over about 0.3 s once the space clears. Below 1 m from the pivot the player model fades out, so the camera never sits inside them.
- **Characters in the way.** Characters between the camera and the player fade out, so the rival doesn't hide you right after you dash through it.
- **Aim.** A ray goes from the camera through the crosshair; hits closer than the player are ignored. The aim point is the first thing the ray hits, or a point 60 m out. Slashes, the tether, the grenade kick and returned bolts all travel from the character toward the aim point.
- **Which way the character faces.** While attacking, parrying, tethering or using the utility, and for 0.6 s after, the whole body faces where you aim. Otherwise it faces the direction it's moving.
- **Melee aim assist.** When a swing starts, the character turns toward the nearest enemy within 30° of the aim and within 1.5 times reach. Lights and heavies with a lunge lunge onto it. There's no hard lock-on; that becomes an option only if the feel test asks for it.
- **Speed and height.** The FOV widens slightly during dashes, zips and bullet jumps (with a toggle). The camera's position lags a little behind zips so the speed reads. During a plunge, a ring marks where you'll land, so you don't have to look straight down.
- **Special cases.** The Sawblade ultimate pulls the camera back to 7 m. Cutscenes take over with their own camera positions.

## The look (Half-Life 1 style)

- **Characters.** Each body part is a simple shape (box, six-sided tapered prism, wedge), built in code and coloured from the existing palettes (`PCOL`, the rival's `pal`, the enemy `debris` colours). A character is 200 to 600 triangles. Shading is smooth within a part, with hard edges between parts.
- **Rigid skinning.** Each part moves with exactly one bone, which is also how Half-Life 1's models worked, so no skin weights are needed. A character is built as one `SkinnedMesh` whose vertices are each fully assigned to one bone, so it costs one draw call.
- **Textures.** Small procedural textures (64 to 128 px) for walls and floors, generated from the existing building `style` keys, with a limited palette per texture. Nearest filtering, so texels stay crisp and match the pixel HUD. Half-Life 1's OpenGL renderer used bilinear filtering; that's a one-line switch if softer looks better.
- **World lighting.** Light from the static lamps, neons and fires is baked into the level's vertex colours on a 1 m grid when the level loads. Shadows come from ray tests against the boxes. This stands in for Half-Life 1's lightmaps. If the 1 m grid shows banding, move to a small lightmap texture.
- **Character lighting.** Characters take their light from the baked light under their feet, as Half-Life 1 does, plus a fixed pool of about 8 dynamic lights for explosions, the tether, Overload, muzzle flashes and fire flicker. Each character gets a round blob shadow.
- **Resolution.** Native, with a resolution scale setting (100%, 75%, 50%). A "Retro" preset renders at 480×270 with nearest-neighbour upscaling, which keeps a link to the 2D game's pixel look at no extra cost.
- **Effects.** Additive sprites for sparks, glows, glints and muzzle flashes, as Half-Life 1 used. Ribbon meshes for sword trails and the red scarf (its existing physics chain extended to 3D). Jagged line strips for lightning and Overload's arcs. Ground marks for gouges, scorches and the dive bomb's target.
- **HUD.** The existing 3×5 bitmap-font HUD as a 2D overlay, including the utility cooldown diamond. The boss title card stays a 2D overlay too.
- **Outlines.** Ordinary characters have none; Half-Life 1 had none. On main, though, coloured outlines are a tell: the rival glows gold during a riposte and red during the red flash, and enters as a black silhouette with a white rim (`Sprite.outlined`). Elites get a gold outline. In 3D, outlines are a slightly enlarged copy of the model with its faces flipped, in a flat colour with an optional glow. A flat-fill mode covers the silhouette.

## Technical foundation

**Three.js as a vendored global.** Three no longer ships a classic-script build (checked on 0.186.1: only `three.module.js` and `three.cjs`), and ES modules don't load from `file://`. So `tools/vendor-three.js` bundles a pinned version once, with esbuild, into `vendor/three.js` as a global `THREE`, importing only the classes the game uses. The file is committed. Classic scripts and `file://` keep working, and `build.js` only needs `vendor/` added to its script regex. Measured cost: 545 KB minified (136 KB gzipped) for a typical subset. The whole 2D game is 453 KB on main.

**Units and axes.** 1 unit = 1 m, y up, x along the old street, z for depth. The scale is `PX = 1/11` (the player's 20 px becomes 1.8 m). A helper `to3(x, y)` returns `(x * PX, (Level.GROUND - y) * PX)` and is used to port level data and as a starting point for constants. The 2D y axis points down, so every `vy` sign flips. Expect that to be the most common porting bug; port one function at a time and check each `vy`.

The converted constants are only a starting point, because 2D platformer physics is exaggerated:

| Constant | 2D | Converted | Note |
| --- | --- | --- | --- |
| `RUN` | 152 px/s | 13.8 m/s | Fast; Risk of Rain 2 survivors sprint at roughly 10 m/s |
| `GRAV` | 960 px/s² | 87 m/s² | About 9 times real gravity |
| Jump apex | 47 px | 4.3 m | Plus 3.8 m from the double jump |
| Dash | 67 px | 6.1 m | |
| `TETHER_RANGE` | 230 px | 21 m | |
| Light reach (opener / finisher) | 36 / 54 px | 3.3 / 4.9 m | Generous, which helps melee in 3D |
| Heavy reach (rise / crescent / slam) | 46 / 54 / 52 px | 4.2 / 4.9 / 4.7 m | |
| Overload radius | 80 px | 7.3 m | |
| Red flash zone | 300 px | 27 m | |

`tools/feel-check.js` runs the controller headless and prints jump apex, double-jump reach, and dash and slide distance in metres. It fails if a roof tier can't be reached with the intended move. This makes retuning measurable instead of guesswork.

**Simulation loop.** Keep the fixed 120 Hz tick, slow motion, hitstop, the cutscene state and bullet time with its four kinds (`rebound`, `clash`, `riposte`, `peril`) as they are. Three changes:

- Mouse look is applied every rendered frame in real time. It is never scaled by slow motion or paused by hitstop.
- The camera and every character's drawn position are interpolated between ticks, so nothing stutters on 144 Hz screens.
- Poses are evaluated at render time from the same timers they use now.

**Collision.** The world stays a list of axis-aligned boxes. `Level.moveBody` becomes a three-axis version with the same sub-stepping, plus step-up (cars) and ledge mantle. Raycasts and the camera's sphere sweep test against each box; with about 200 boxes, brute force is fine to start, and a uniform grid can come later.

**Input.** Pointer Lock with `movementX`/`movementY`, sensitivity, invert Y. New default bindings: WASD to move (relative to the camera), `Space` jump, `C`/`Ctrl` crouch and slide, `Shift` dash, `E` parry, `F` utility, left mouse slash (tap light, hold heavy), right mouse tether, `R` ultimate. Lights fire on release and heavies after a 0.15 s hold, as now. Bump `SETTINGS_KEY` to `v2` so old saves (where `W` is jump and `S` is crouch) don't carry over. Two browser behaviours to handle:

- Browsers use `Esc` to exit pointer lock and don't pass the key to the page. Pause on `pointerlockchange` instead of on the key.
- Re-locking needs a click or key press, and Chrome refuses a re-lock for about a second after `Esc`. The Resume button has to cope with that.

**Rendering.** `WebGLRenderer` at native resolution times the resolution scale, with a 2D canvas on top for the HUD. Bullet time needs three passes, so its tells stay in colour while the world greys out:

1. Draw the scene.
2. Grey it out.
3. Draw a tell layer on top: outlined characters, glints, the grenade, the riposte's dotted path, speed lines.

Two Three.js traps:

- Changing the number of lights recompiles shaders and stutters. Use the fixed light pool and set unused lights to zero intensity. Baked world lighting keeps the pool small.
- One mesh per body part would cost about 15 draw calls per character. The single rigidly skinned mesh per character keeps it to one.

**Audio.** `Sound.play(name, at)` takes an optional world position and routes the sound through a `PannerNode` (or a stereo pan plus distance gain). The music sequencer doesn't change. With text gone from play, positional sound carries more of the tells: glints, wind-ups, the riposte's rising tone, the eruption warnings.

**Smoke test.** Keep `tools/smoke-test.js` (now including `F`), feeding random mouse movement instead of cursor positions. Check that the player stays inside the arena bounds and outside solid boxes, and that the camera never ends up inside a box. Headless Chromium here (build 1194) gets WebGL2 through SwiftShader with no flags. Pass `--use-angle=swiftshader --enable-unsafe-swiftshader` anyway, since newer Chromium builds require them.

## Mechanics in third person

| 2D today | Third-person version | Notes |
| --- | --- | --- |
| A/D to move | WASD relative to the camera; the character turns toward where it's moving | |
| Jump, double jump, jump cut | Same | |
| Crouch, slide when running | Same, on `C`/`Ctrl` | Sliding is the main way under bolts |
| Bullet jump toward the cursor | Crouch or slide plus jump launches you toward the aim point | |
| Wall jump on the two boundary walls | Kick off any wall you touch, away from it | Defer wall running |
| One-way platforms, drop-through | Solid platforms plus ledge mantle | One rule for collision, the camera's sweep and enemy navigation; mantling covers getting up |
| Wrecked cars you step over | Same, through step-up | |
| Dash: 2 charges, 0.2 s invulnerability | Shift plus a WASD direction relative to the camera; forward if none held | Its i-frames still pass through unparryable hits except the red flash, as now |
| Light and heavy strings (up to 4 hits) | Same string rules, toward the aim point with the melee aim assist. Lights alternate right to left and left to right; the finisher is a wide diagonal with a lunge | Hit area: a sector in front of the character within reach, with a vertical band of ±1.2 m (more on finishers and heavies). Swings show as trail ribbons |
| Heavy wind-up: blade drawn back over the shoulder, flashes red when committed, roots you | Same; the red flash on the blade is a camera-facing glint | Reads well from behind |
| Heavy opener launches; heavy second is a wide crescent; heavy third or fourth is a slam with a ground wave each way | Same; the slam's two waves become one expanding ring | |
| Swings deflect bolts | Same; returned bolts fly to the aim point | |
| Dash slash, light and heavy | Same: cuts everything along the dash path | Capsule sweep along the path |
| Slide attack: blade buried below the street line | Blade buried in the ground surface | |
| Heavy slide attack: rock eruption that launches you and enemies | Same; rocks erupt in a forward cone | |
| Plunge | Same, with a landing ring; the ground shockwave is a ring scaled by fall height | A vertical ray finds the landing surface |
| Parry: `E`, glint 0.28 s before the hit | Same timings; the parry works against hits from any direction | `unparryable`, `through` and `pierce` hit flags carry over |
| Counter: release `E`, chain lightning | Same; the drawn slash goes toward the aim point | |
| Overload (`F`) | A shock sphere of 7.3 m around you, with the same rules: interrupts, knocks back, burns bolts; bosses resist | |
| Tether: tap to fling, hold to zip | Ray from the camera through the crosshair, with about 4° of aim assist toward enemies, grenades and barrels; the line is drawn from the character's hand | |
| Barrel grab, swing and throw | The barrel swings on the line around the character and is thrown at the aim point | |
| Grenade rebound: reel in feet first, kick, backflip | Same; kick it toward the aim point and it curves toward the rival | Third person shows the kick and backflip in full |
| Sawblade ultimate | The character becomes the saw; the camera pulls back; lunges and latching unchanged | |
| Style meter, hitstop, slow motion | Unchanged | |
| Off-screen enemy arrows (a setting) | A threat ring around the crosshair, on by default | Threats behind the camera still need it |
| Camera look-ahead | Replaced by the camera distance setting | |
| No instructional text during play | Same; everything reads through models, glints, outlines and sound | `docs/tutorial-text.md` stays the source for a future tutorial |

`facing` (±1) appears 164 times across the code. It becomes a yaw angle plus a `forward()` vector, and "is it in front of me" checks become dot products.

## Fairness

The 2D fairness rules assume every threat is on screen. With the camera behind you, you see your surroundings better than in first person, but threats behind the camera are still hidden. Text can't fill the gap, since main has moved all of it out of play. Rules to add:

- **Attack slots consider the camera.** An enemy more than about 75° from where the camera faces can still take an attack slot, but its wind-up is 1.3 times longer. Its glint plays as a positional sound and shows as a marker on the threat ring.
- **Glints and wind-up markers draw on top of walls**, so an enemy hidden from the camera behind a building, but able to reach you, still shows its attack.
- **Glints keep a minimum size on screen**, so the rival's eye glint (cyan, gold or red) still reads from 15 m away.
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
- Wrecked cars, barrel spots and sniper perches.

It stays a box list in data, as `level.js` is today.

Main removed the street cover, and the 3D arena doesn't bring it back. Solid buildings already block sightlines in 3D, which the 2D scenery buildings never did, so gunners and snipers get line-of-sight play without cover.

A 5 m orbit camera needs room, so the arena follows clearance rules:

- Streets at least 12 m wide.
- At least 5 m of headroom under the overpass and girders that you can walk under.
- No alleys narrower than 6 m.
- Building interiors can't be entered.

`feel-check.js` can test these from the box list.

## Characters and animation

**Rig.** Hips, spine, head, two arms (upper, forearm, hand), two legs (thigh, shin, foot), a weapon bone, and the scarf chain. Limbs are solved with three-dimensional two-bone IK, with knees bending forward and elbows back and out. The 2D `ik2` in `sprites.js` becomes this.

**What the 2D poses give you.** `Player.pose()` and the rival's `customPose()` output hand and foot targets, lean and body rotation, all in the character's side plane (forward and up). That plane is the 3D rig's side plane, so most poses port by spreading the left and right limbs sideways.

| Ports from 2D | Needs a new 3D pose |
| --- | --- |
| Run, jump, crouch, slide, dash lean, plunge, hurt, death, parry stance, knockout | Light swings and the finisher, which sweep around the character instead of arcing in the side plane |
| Heavy wind-up (blade over the shoulder), slam, the kick and backflip, the Overload cast | Heavy rise and crescent, dash slash, counter, slide attacks |
| Rival: guard, kneel, dive bomb, stun, the entry kneel | Rival: its greatblade moves, riposte, red flash, blade wave throws |

**Enemies.** They are drawn directly by code like `renderScrapper()`, with no pose data, so their models and animation are new. Share the work:

- Scrapper, gunner, shield scrapper, grenadier, sniper and the training dummy are variants of one humanoid rig with different parts.
- The brute is a scaled-up humanoid.
- The crawler and drone need their own rigs.

**Effects of the change.**

- Gibs come for free, because every body part is already a separate rigid shape: on death, each part flies off on its own.
- Hit flash becomes a white emissive tint.
- The rival's limiter plates popping off in the enrage become real parts flying away.
- Ragdoll is out of scope; deaths stay hand-animated, as now.

## Enemies and AI

**Navigation.** Each walkable layer (street, each roof) gets a grid of 0.5 m cells. A flow field is computed from the player's cell (breadth-first search) and recomputed only when the player changes cell, which stays cheap with many enemies. Jump links between layers (curbs, cars, roof edges) are computed when the level loads. Ground enemies follow the flow field and keep apart from each other (the existing anti-stacking push). Drones steer freely in 3D. Snipers use the perch list and zip. The rival drives the player's controller (see below).

**Behaviour** ports type by type with its timings unchanged, including the rule that heavies don't stagger scrappers or brutes. Three things change: box melee checks become cylinder or sector tests, `facing` becomes yaw, and `findFiringSpot` adds a line-of-sight check.

| Enemy | What changes in 3D |
| --- | --- |
| Scrapper | Chases along the flow field; the glint sits on the cleaver |
| Gunner | Walks to a spot with a clear shot, now that buildings block sight; the laser lock is a 3D line |
| Drone | Circles above head height and dives in a straight line; it makes you look up |
| Brute | Its shockwave becomes an expanding ring on the ground; jump over it |
| Shield scrapper | "Front" is a ±60° cone from its yaw; its turn rate controls difficulty. Parry the bash, land a heavy on the shield, or dash past to its back. Circling it is easier in third person, so the turn rate will need to go up |
| Armoured crawler | Low to the ground, so slide attacks and plunge hit areas reach lower |
| Grenadier | Arc preview and landing ring drawn on the ground |
| Sniper | Perches come from arena data; laser line; zips between perches |

## Rival (AEGIS-07)

The README promises the rival is built on "the same skeleton, physics and power level as the player". In 3D that holds literally: both use one character controller (`js/3d/controller.js`) and one rig, with the rival's own parts and palette. Its `CHARACTERS` entry (palette, weapon, name, utility slot) becomes the hook for its model too, so a future character select picks a model as well as a moveset. The rival already steers through an intent object (`{ mx, jump, drop }` from `navigate()`). That becomes `{ move, jump, dash, zipTarget }`.

**Ports with little design change:**

- Phase 1: gun bursts, the greatblade, the shield (8 returned bolts or its own grenade), the pulse grenade and its ground ring, and the visor beam. The beam's "angular momentum" becomes limits on how fast its yaw and pitch can turn.
- Phase 2 combos and timing.
  - Guards from all three sources: a clash, opening with one, and reading heavies or blocking after a light.
  - The gold riposte in 0.7x bullet time, with the parry window 0.13 to 0.33 s after its eye flashes.
  - The parry-back into the cyan guard.
  - The dive bomb. Its tracking mark becomes a ground decal and its landing a ring.
- Tells: the eye glints from the visor and the gold or red glowing outline. Both need the minimum on-screen size and the bullet-time tell layer described above.

**Moves that rely on the street being a line.** These work in 2D because nothing can get around anything else. Each needs a 3D rule, and a feel check in Phase 5:

| Move | Why it breaks in 3D | 3D version |
| --- | --- | --- |
| Red flash | Its body blocks the street, so only a dash through gets you to its back. In 3D you can walk around it | It turns to track you until the flash, then locks its direction. The cut covers everything except a 90° wedge behind it, out to 27 m. The stun payoff needs a dash whose path crosses its body, as now. Tune the 0.39 s from flash to hit so walking can't reach the wedge in time |
| Blade wave | Runs along the street; in 3D you could step to the side | Make it wide (about 10 m) so jumping, dashing through or parrying stay the answers. The second wave, at head height, keeps its rule: stay on the ground for it |
| Ground eruptions | Each column blocks the street; in 3D you walk around it | They become area denial. Raise the limit from three standing columns, or their radius, and keep the rule that none erupts within 5.5 m of you |
| Ground waves (cleave, dive landing) | Travel each way along the street | Expanding rings, like the player's slam |

**Cutscenes.** The camera leaves the player and the letterbox bars and skip-by-holding stay:

- **Entry:** the camera cranes up the erupting beacon, then cuts to a close shot as AEGIS-07 stands. The title card stays a 2D overlay.
- **Enrage:** an orbit around the rival, with a narrower FOV for the roar.
- **Knockout:** a slow orbit.

## Phases

Each phase ends with both pages playable and the smoke test passing. Sizes are rough line counts of new code.

### Phase 0: groundwork (~400 changed)

- Freeze 2D features; bug fixes only.
- Move the Game core from `main.js` into `js/core.js`: style, scoring, slow motion, hitstop, bullet time and its kinds, cutscene state, `announce`, `onKill`, upgrades. The 2D `main.js` keeps its loop and camera.
- Give `Director` an `Arena` interface (`spawnPoints('ground' | 'high')`, `perches`, `barrelSpots`, `freeGroundAt`) that both worlds implement, instead of reading `Level` directly.
- Add the optional position to `Sound.play(name, at)`; it does nothing in 2D.
- Add `tools/vendor-three.js` and commit `vendor/three.js`. `build.js` learns `vendor/` and builds both pages.
- Add `index3d.html` (shared scripts plus `js/3d/*`) and run the smoke test on both pages.

Done when: the 2D game is unchanged and passes, and `index3d.html` shows a lit test room.

### Phase 1: playable slice and camera test (~3,200)

- The extruded street, with procedural textures for three building styles and simple baked light.
- The orbit camera: collision, character fading, aim ray, settings for distance and sensitivity.
- Controller: run, jump, double jump, crouch, slide, dash, mantle, step-up.
- The player's model and rig with run, jump, slide and dash poses, plus the scarf.
- Light and heavy strings with trails and melee aim assist.
- Scrappers on the street-level flow field, as low-poly models, with glint, parry and counter.
- Coloured outlines (needed for elites and the rival later; cheap to prove here).
- HUD: health, shield, dash charges, parry gauge, crosshair, threat ring.
- `tools/feel-check.js`.

**Feel test (decide before Phase 2).** Play 15 minutes against waves of scrappers, with no text on screen, and check:

1. Light strings land on a moving scrapper without frequent whiffs, and heavies read as committed from behind.
2. You can parry from the glint alone at the default 0.2 s window, including glints from enemies beside or behind you.
3. Dash into dash slash into a string feels like one move.
4. The camera keeps the player readable through double jumps, slides, dashes and fights against a building wall, without clipping or losing the player.

If 1 or 3 fail, strengthen the aim assist or add a lock-on toggle. If 4 fails, change the arena clearances and the camera's pivot and distance before changing anything else. Don't start Phase 2 until all four pass.

### Phase 2: full move set (~2,300)

- Tether in every mode, with aim assist; barrels; the grenade kick and backflip.
- Gunner bolts and returning them.
- Plunge with its landing ring, light and heavy slide attacks with rubble and rock eruptions, bullet jump, wall kick.
- Heavy dash slash, heavy slam ring.
- Overload and the utility registry.
- New 3D poses for the swings, dash slash, counter, slide attacks, kick and cast.
- Shield, health, the overflow rule and the hit flags.
- Style meter.
- Slow motion, hitstop, and the bullet-time passes with the tell layer.
- Positional audio.
- 3D effects in `js/3d/fx3d.js`: additive sprites, rings, lightning, ground marks, trails, gibs.

### Phase 3: enemies, AI and waves (~3,000)

- Navigation layers and jump links.
- The humanoid enemy rig and its variants, then the brute, crawler and drone.
- The other seven enemy types' behaviour.
- Attack slots with the camera rule; threat ring markers; glints drawn on top of walls with a minimum size.
- Director modes: demo, endless, upgrades, wave modifiers.
- Pickups and damage numbers (projected into the HUD canvas).

### Phase 4: arena and look (~1,200)

- The crossroads arena, following the clearance rules.
- Full lighting bake; the dynamic light pool; neon, lamps and fires; weather; fog.
- The Blackout modifier, a rebake with the street lights off.
- The Retro preset.
- A slow orbit behind the title screen.

### Phase 5: rival (~2,500)

- AEGIS-07 on the shared controller and rig, its model and parts.
- Phase 1: gun, beam, greatblade, shield, pulse grenade.
- Phase 2: combos, guards, riposte, parry-back, dive bomb.
- The redesigned red flash, blade waves, eruptions and ground rings, each checked by playing them: can you read and answer every one with no text on screen?
- Entry, enrage and knockout cutscenes.
- Melee Duel.

### Phase 6: parity and cutover (~600, plus deletions)

- Sawblade; Training (dummy and spawn panel).
- Work through the README feature by feature until the 3D game matches it.
- Migrate saved settings to v2 and rewrite the README.
- Tag the last 2D commit `v2d-final`, rename `index3d.html` to `index.html`, delete the 2D-only files, and point the smoke test at the single page.

End state: about 13,000 to 14,000 lines. Building the character models in code and the larger rival make this bigger than the earlier estimate.

## What happens to each file

| File | Lines | Fate |
| --- | --- | --- |
| `util.js` | 278 | Keep; add vec3 helpers, ray-vs-box, sphere sweep and cone tests |
| `settings.js` | 147 | Keep; new bindings, camera distance, sensitivity, invert Y, resolution scale, comfort toggles; storage key to v2 |
| `input.js` | 109 | Extend: pointer lock, mouse deltas, `Esc` handling |
| `audio.js` | 771 | Keep; add positional `play` |
| `upgrades.js` | 64 | Keep; the Aftershock ground wave becomes a ring |
| `waves.js` | 166 | Keep the logic; spawns go through `Arena` |
| `ui.js` | 254 | Keep; new settings rows; re-lock the pointer on resume |
| `training.js` | 140 | Port ("in front of you" means along the aim) |
| `main.js` | 399 | Split: about 255 lines of core shared, loop and camera rewritten |
| `player.js` | 1,750 | Port: state machine, strings and timings carry over; movement and hit tests are rewritten; `pose()` feeds the 3D rig; drawing is replaced by the model |
| `utilities.js` | 63 | Port; the `registerUtility` API stays |
| `enemies.js` | 820 | Port behaviour; physics, navigation, hit tests rewritten; drawing replaced by models |
| `specialists.js` | 374 | Port |
| `rival.js` | 1,726 | Port; four moves redesigned; `customPose()` feeds the 3D rig; cutscenes rewritten for 3D cameras; `BladeWave`, `GroundEruption` and `drawEnergyBeam` become 3D |
| `ultimates.js` | 226 | Port; the `registerUltimate` API stays |
| `level.js` | 704 | Replaced by `js/3d/world.js` and arena data |
| `render.js` | 508 | Scene drawing replaced; the HUD half and title card reused; the bullet-time cues move to the tell layer |
| `fx.js` | 431 | Replaced by 3D effects; screen flashes reused |
| `sprites.js` | 114 | Replaced by `js/3d/rig.js`; `Sprite.outlined` becomes the outline pass |

New files under `js/3d/`:

| File | Contents |
| --- | --- |
| `world.js` | Arena boxes, collision, raycasts, sphere sweep, navigation grid, flow field |
| `gfx.js` | Renderer, procedural textures, lighting bake, light pool, fog, outline pass, bullet-time passes |
| `camera.js` | Orbit camera, collision, aim ray, character fading, cutscene cameras |
| `rig.js` | Skeleton, 3D IK, pose application, rigid skinning |
| `models.js` | Part library and the player, rival and enemy models |
| `fx3d.js` | 3D effects |
| `controller.js` | Shared player and rival movement |
| `player3d.js` | Player actions |
| `enemies3d.js`, `specialists3d.js`, `rival3d.js`, `ultimates3d.js`, `utilities3d.js` | Ported behaviour |
| `main3d.js` | Loop, pointer lock |

## Risks, highest first

1. **The camera in a dense, vertical city**: clipping into walls, losing the player under the overpass or against a building, and zips across the map that are hard to follow. Handled by the sphere sweep, character fading, the arena clearance rules and the Phase 1 feel test.
2. **The rival's phase 2 in 3D.** It's the largest single port, and four of its moves rely on the 2D street. Handled by the redesign table and the Phase 5 checks. If the red flash can't be made fair with the back wedge, simplify it to "dash through its body or get hit".
3. **Main keeps changing during the port.** PR #4 alone grew `rival.js` by half. Freeze 2D features before Phase 0.
4. **Melee aimed by the camera.** The enemy you want is often beside the character rather than under the crosshair. Handled by the melee aim assist, with a lock-on toggle as the escalation.
5. **Tells without text.** Every tell has to read at camera distance through visuals and sound alone. Handled by glints with a minimum size drawn over walls, outlines, the tell layer, positional audio, and playing each phase without text.
6. **Building 11 character models and their animation in code** takes longer than the 2D sprites did. Handled by the shared humanoid rig, the part library, and reusing the 2D poses where they apply.
7. **Unfair hits from outside the view.** Handled by the camera-aware attack slots, positional glints, the threat ring and the all-direction parry.
8. **Navigation across levels and roofs.** Most enemies stay on the street; drones, snipers and the rival handle height through their own movement.
9. **Retuning platformer constants for 3D** eats time. `feel-check.js` keeps it measurable; tune in metres, never by converting pixel values again.
10. **Three.js performance traps** (shader recompiles when lights change, draw calls per body part). Use the fixed light pool, baked world light and one skinned mesh per character from the start.

## Open decisions

Recommendations first.

- **When to freeze 2D:** now, or after the current rival work lands. Every 2D feature after the freeze is ported twice.
- **Red flash in 3D:** a tracked lock with a safe wedge behind it. The fallback is a full circle that only a dash through its body escapes.
- **Keep the 2D game as a mode after cutover?** No. Two renderers and two controllers double the work for every change. The `v2d-final` tag preserves it.
- **Lock-on:** soft aim assist only, unless the feel test asks for more.
- **Retro preset:** keep it. It's cheap and ties back to the 2D pixel look.
- **Long-term arena:** the crossroads. The extruded street is for testing only.
- **Wall running:** defer; a later endless upgrade is a natural home for it.
- **Gamepad:** still out of scope, but it suits a third-person action game well. It's a reasonable first addition after cutover.
