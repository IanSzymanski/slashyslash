# SlashySlash 3D: build plan

Plan for a separate 3D version of SlashySlash: a third-person action game with a Risk of Rain 2 style camera that orbits the player, and a Half-Life 1 style low-poly look. It lives in its own lane next to the 2D game, which stays exactly as it is. Based on `main` at `d06f9a5` (9,044 lines of JS in `js/`).

## Two lanes

- **2D:** this repo, `IanSzymanski/slashyslash`: `index.html`, `js/`, `css/`, `tools/`, `README.md`. The 3D work never edits these files, and the 2D game keeps growing on its own schedule.
- **3D:** its own repo, [`IanSzymanski/slashyslash2`](https://github.com/IanSzymanski/slashyslash2), with its own `index.html`, scripts, CSS, vendored Three.js, build script, smoke test, README and saved settings. Paths written `slashyslash2/...` below are in that repo; bare paths are in this one.

Rules that keep them apart:

1. **The 3D lane never changes this repo**, except this plan.
2. **Fork, don't share.** 3D starts from copies of the 2D files it can reuse. If the 3D page loaded the 2D files directly, any change made for 3D would edit the 2D game, and a 2D change could break 3D without warning.
3. **Separate saved data.** 3D uses `slashyslash3d.settings.v1` and `slashyslash3d.save.v1`. Both games can run from the same origin (`file://`, or one local server) and share browser storage there, so with the same keys, rebinding WASD in 3D would rebind the 2D game too.
4. **Separate build output.** `slashyslash2/tools/build.js` writes `slashyslash2/dist/slashyslash-3d.html`. The 2D build keeps writing `dist/slashyslash.html`.
5. **Pull 2D changes into 3D by hand, only when you want them.** `slashyslash2/SYNCED_FROM` records the 2D commit the 3D copies last caught up with. `node tools/sync-2d.js` in slashyslash2 fetches this repo as the `2d` remote and lists the 2D commits and files changed since then; `--diff` prints the diff, and `--mark` records the new commit once you've ported what you want.
6. **Mirror 2D file names where a 3D file plays the same role.** For example, `slashyslash2/js/rival.js` ports `js/rival.js`, so each 2D change in that diff points straight at the 3D file to update. The 2D `main.js` is the exception: its game core lives in `slashyslash2/js/core.js`.

This plan first put the 3D lane in a `3d/` directory on `main`, to keep the 2D diff one command away. It moved to its own repo instead. The sync script keeps the diff to one command: once both repos are fetched, git diffs commits across their unrelated histories.

## Recommendation

1. **Build it in Three.js (WebGL)**, with a camera that orbits behind and above the player, as in Risk of Rain 2. Give it the Half-Life 1 look: characters built in code from a few hundred polygons, small textures, and lighting baked into the level when it loads.
2. **Stop after Phase 1 and test the camera and the melee** before investing further. A third-person camera shows you your own swings and the glints around you, but it has to work in a dense, vertical city full of walls, girders and an overpass.
3. **Redesign the rival's phase 2 moves that depend on the street being a line** before porting them. In 2D you can't walk around the rival; in 3D you can.
4. **Keep the project's constraints in the 3D lane too**: no asset files, everything generated in code, runs from `file://`, and one self-contained HTML file from the build. Models are assembled from simple shapes in code, and animation stays procedural, as it is in 2D.

The closest existing reference for the combat in this camera is Risk of Rain 2's Mercenary. Its sword combo and chaining dash attack map closely onto SlashySlash's strings and dash slash.

How the 3D lane uses the 2D code (the 2D files themselves don't change):

| | Lines | Share | Files |
| --- | --- | --- | --- |
| Copied into slashyslash2 with small edits | ~2,050 | 23% | util, settings, input, audio, upgrades, waves, ui, the non-camera half of main |
| Rules and tuning reimplemented in 3D | ~5,100 | 56% | player, enemies, specialists, rival, ultimates, utilities, training |
| Not used | ~1,900 | 21% | level, render (scene half), fx, sprites, main loop and camera |

Most of the tuning carries over: timings, damage, wind-ups, parry windows, string rules, style values, wave tables, upgrade rules. Movement, collision, hit tests and all drawing are new. The player's and rival's poses partly carry over (see Characters and animation); the enemies' drawing code doesn't.

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

- **Characters.** Each body part is a simple shape (box, six-sided tapered prism, wedge), built in code and coloured from the 2D palettes (`PCOL`, the rival's `pal`, the enemy `debris` colours). A character is 200 to 600 triangles. Shading is smooth within a part, with hard edges between parts.
- **Rigid skinning.** Each part moves with exactly one bone, which is also how Half-Life 1's models worked, so no skin weights are needed. A character is built as one `SkinnedMesh` whose vertices are each fully assigned to one bone, so it costs one draw call.
- **Textures.** Small procedural textures (64 to 128 px) for walls and floors, generated from the 2D building `style` keys, with a limited palette per texture. Nearest filtering, so texels stay crisp and match the pixel HUD. Half-Life 1's OpenGL renderer used bilinear filtering; that's a one-line switch if softer looks better.
- **World lighting.** Light from the static lamps, neons and fires is baked into the level's vertex colours on a 1 m grid when the level loads. Shadows come from ray tests against the boxes. This stands in for Half-Life 1's lightmaps. If the 1 m grid shows banding, move to a small lightmap texture.
- **Character lighting.** Characters take their light from the baked light under their feet, as Half-Life 1 does, plus a fixed pool of about 8 dynamic lights for explosions, the tether, Overload, muzzle flashes and fire flicker. Each character gets a round blob shadow.
- **Resolution.** Native, with a resolution scale setting (100%, 75%, 50%). A "Retro" preset renders at 480×270 with nearest-neighbour upscaling, which keeps a link to the 2D game's pixel look at no extra cost.
- **Effects.** Additive sprites for sparks, glows, glints and muzzle flashes, as Half-Life 1 used. Ribbon meshes for sword trails and the red scarf (the 2D scarf's physics chain extended to 3D). Jagged line strips for lightning and Overload's arcs. Ground marks for gouges, scorches and the dive bomb's target.
- **HUD.** The 2D game's 3×5 bitmap-font HUD as a 2D overlay, including the utility cooldown diamond. The boss title card stays a 2D overlay too.
- **Outlines.** Ordinary characters have none; Half-Life 1 had none. In the 2D game, though, coloured outlines are a tell: the rival glows gold during a riposte and red during the red flash, and enters as a black silhouette with a white rim (`Sprite.outlined`). Elites get a gold outline. In 3D, outlines are a slightly enlarged copy of the model with its faces flipped, in a flat colour with an optional glow. A flat-fill mode covers the silhouette.

## Technical foundation

**Three.js as a vendored global.** Three no longer ships a classic-script build (checked on 0.186.1: only `three.module.js` and `three.cjs`), and ES modules don't load from `file://`. So `slashyslash2/tools/vendor-three.js` bundles a pinned version once, with esbuild, into `slashyslash2/vendor/three.js` as a global `THREE`, importing only the classes the game uses. The file is committed, so the 3D page keeps working from `file://` with classic scripts. Measured cost: 545 KB minified (136 KB gzipped) for a typical subset. For scale, the 2D game's single-file build is 453 KB.

**Units and axes.** 1 unit = 1 m, y up, x along the old street, z for depth. The scale is `PX = 1/11` (the player's 20 px becomes 1.8 m). A helper `to3(x, y)` returns `(x * PX, (GROUND - y) * PX)`, where `GROUND` is the 2D street's ground line. It's used to convert a copy of the 2D street layout and as a starting point for constants. The 2D y axis points down, so every `vy` sign flips. Expect that to be the most common porting bug; port one function at a time and check each `vy`.

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

`slashyslash2/tools/feel-check.js` runs the controller headless and prints jump apex, double-jump reach, and dash and slide distance in metres. It fails if a roof tier can't be reached with the intended move. This makes retuning measurable instead of guesswork.

**Simulation loop.** Keep the 2D game's fixed 120 Hz tick, slow motion, hitstop, cutscene state and bullet time with its four kinds (`rebound`, `clash`, `riposte`, `peril`). Three changes:

- Mouse look is applied every rendered frame in real time. It is never scaled by slow motion or paused by hitstop.
- The camera and every character's drawn position are interpolated between ticks, so nothing stutters on 144 Hz screens.
- Poses are evaluated at render time from the same timers they use now.

**Collision.** The world is a list of axis-aligned boxes, like the 2D level. The 3D version of `moveBody` works on three axes with the same sub-stepping, plus step-up (cars) and ledge mantle. Raycasts and the camera's sphere sweep test against each box; with about 200 boxes, brute force is fine to start, and a uniform grid can come later.

**Input.** Pointer Lock with `movementX`/`movementY`, sensitivity, invert Y. Default bindings: WASD to move (relative to the camera), `Space` jump, `C` crouch and slide (not `Ctrl`: Ctrl+W, crouching while moving forward, closes the browser tab and pages can't block it), `Shift` dash, `E` parry, `F` utility, left mouse slash (tap light, hold heavy), right mouse tether, `R` ultimate. Lights fire on release and heavies after a 0.15 s hold, as in 2D. These live under the 3D storage key, so they never change the 2D game's bindings. Two browser behaviours to handle:

- Browsers use `Esc` to exit pointer lock and don't pass the key to the page. Pause on `pointerlockchange` instead of on the key. `Esc` can't resume either: it doesn't count as a user gesture, so the re-lock is refused.
- Re-locking needs a click or key press, and Chrome refuses a re-lock for about a second after `Esc`. The Resume button has to cope with that.

**Rendering.** `WebGLRenderer` at native resolution times the resolution scale, with a 2D canvas on top for the HUD. Bullet time needs three passes, so its tells stay in colour while the world greys out:

1. Draw the scene.
2. Grey it out.
3. Draw a tell layer on top: outlined characters, glints, the grenade, the riposte's dotted path, speed lines.

Two Three.js traps:

- Changing the number of lights recompiles shaders and stutters. Use the fixed light pool and set unused lights to zero intensity. Baked world lighting keeps the pool small.
- One mesh per body part would cost about 15 draw calls per character. The single rigidly skinned mesh per character keeps it to one.

**Audio.** The 3D copy of `audio.js` gets `Sound.play(name, at)` with an optional world position, routed through a `PannerNode` (or a stereo pan plus distance gain). The music sequencer doesn't change. With text gone from play, positional sound carries more of the tells: glints, wind-ups, the riposte's rising tone, the eruption warnings.

**Smoke test.** `slashyslash2/tools/smoke-test.js`, based on the 2D one, feeds random keys (including `F`) and random mouse movement. It checks that the player stays inside the arena bounds and outside solid boxes, and that the camera never ends up inside a box. Headless Chromium here (build 1194) gets WebGL2 through SwiftShader with no flags. Pass `--use-angle=swiftshader --enable-unsafe-swiftshader` anyway, since newer Chromium builds require them. The 2D smoke test stays as it is.

## Mechanics in third person

| 2D | Third-person version | Notes |
| --- | --- | --- |
| A/D to move | WASD relative to the camera; the character turns toward where it's moving | |
| Jump, double jump, jump cut | Same | |
| Crouch, slide when running | Same, on `C` | Sliding is the main way under bolts |
| Bullet jump toward the cursor | Crouch or slide plus jump launches you toward the aim point | |
| Wall jump on the two boundary walls | Kick off any wall you touch, away from it | Defer wall running |
| One-way platforms, drop-through | Solid platforms plus ledge mantle | One rule for collision, the camera's sweep and enemy navigation; mantling covers getting up |
| Wrecked cars you step over | Same, through step-up | |
| Dash: 2 charges, 0.2 s invulnerability | Shift plus a WASD direction relative to the camera; forward if none held | Its i-frames still pass through unparryable hits except the red flash, as in 2D |
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
| No instructional text during play | Same; everything reads through models, glints, outlines and sound | `docs/tutorial-text.md` is a source for a future tutorial in either lane |

`facing` (±1) appears 164 times across the 2D code. In 3D it becomes a yaw angle plus a `forward()` vector, and "is it in front of me" checks become dot products.

## Fairness

The 2D fairness rules assume every threat is on screen. With the camera behind you, you see your surroundings better than in first person, but threats behind the camera are still hidden. The 2D game has moved all instructional text out of play, so text can't fill the gap. Rules to add:

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

**Phase 1** converts a copy of the 2D street's layout into 3D with `to3`, so spawns, barrel spots and perches work for testing. The street gets 14 m of depth so the camera has room. As an arena it's poor: about 218 m long, with long sniper sightlines and enemies arriving from only two directions.

**Phase 4** replaces it with a purpose-built crossroads of about 70×70 m:

- Four short streets and a central plaza.
- Solid buildings with walkable roofs, linked by girders.
- An overpass across one street that you can stand on and walk under.
- Fire escapes on building fronts as climbing routes.
- Wrecked cars, barrel spots and sniper perches.

It's a box list in data, like the 2D `level.js`.

The 2D game removed its street cover, and the 3D arena doesn't add any. Solid buildings already block sightlines in 3D, which the 2D game's see-through buildings never did, so gunners and snipers get line-of-sight play without cover.

A 5 m orbit camera needs room, so the arena follows clearance rules:

- Streets at least 12 m wide.
- At least 5 m of headroom under the overpass and girders that you can walk under.
- No alleys narrower than 6 m.
- Building interiors can't be entered.

`feel-check.js` can test these from the box list.

## Characters and animation

**Rig.** Hips, spine, head, two arms (upper, forearm, hand), two legs (thigh, shin, foot), a weapon bone, and the scarf chain. Limbs are solved with three-dimensional two-bone IK, with knees bending forward and elbows back and out, generalising the 2D `ik2` in `sprites.js`.

**What the 2D poses give you.** The 2D `Player.pose()` and the rival's `customPose()` output hand and foot targets, lean and body rotation, all in the character's side plane (forward and up). That plane is the 3D rig's side plane, so most poses port by spreading the left and right limbs sideways.

| Ports from 2D | Needs a new 3D pose |
| --- | --- |
| Run, jump, crouch, slide, dash lean, plunge, hurt, death, parry stance, knockout | Light swings and the finisher, which sweep around the character instead of arcing in the side plane |
| Heavy wind-up (blade over the shoulder), slam, the kick and backflip, the Overload cast | Heavy rise and crescent, dash slash, counter, slide attacks |
| Rival: guard, kneel, dive bomb, stun, the entry kneel | Rival: its greatblade moves, riposte, red flash, blade wave throws |

**Enemies.** The 2D enemies are drawn directly by code like `renderScrapper()`, with no pose data, so their 3D models and animation are new. Share the work:

- Scrapper, gunner, shield scrapper, grenadier, sniper and the training dummy are variants of one humanoid rig with different parts.
- The brute is a scaled-up humanoid.
- The crawler and drone need their own rigs.

**Effects of building characters from parts.**

- Gibs come for free, because every body part is already a separate rigid shape: on death, each part flies off on its own.
- Hit flash becomes a white emissive tint.
- The rival's limiter plates popping off in the enrage become real parts flying away.
- Ragdoll is out of scope; deaths stay hand-animated, as in 2D.

## Enemies and AI

**Navigation.** Each walkable layer (street, each roof) gets a grid of 0.5 m cells. A flow field is computed from the player's cell (breadth-first search) and recomputed only when the player changes cell, which stays cheap with many enemies. Jump links between layers (curbs, cars, roof edges) are computed when the level loads. Ground enemies follow the flow field and keep apart from each other (the 2D anti-stacking push). Drones steer freely in 3D. Snipers use the perch list and zip. The rival drives the player's controller (see below).

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

The 2D README promises the rival is built on "the same skeleton, physics and power level as the player". In 3D that holds literally: both use one character controller (`slashyslash2/js/controller.js`) and one rig, with the rival's own parts and palette. Its `CHARACTERS` entry (palette, weapon, name, utility slot) becomes the hook for its model too, so a future character select picks a model as well as a moveset. The 2D rival steers through an intent object (`{ mx, jump, drop }` from `navigate()`); the 3D one uses `{ move, jump, dash, zipTarget }`.

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
| Red flash | Its body blocks the street, so only a dash through gets you to its back. In 3D you can walk around it | It turns to track you until the flash, then locks its direction. The cut covers everything except a 90° wedge behind it, out to 27 m. The stun payoff needs a dash whose path crosses its body, as in 2D. Tune the 0.39 s from flash to hit so walking can't reach the wedge in time |
| Blade wave | Runs along the street; in 3D you could step to the side | Make it wide (about 10 m) so jumping, dashing through or parrying stay the answers. The second wave, at head height, keeps its rule: stay on the ground for it |
| Ground eruptions | Each column blocks the street; in 3D you walk around it | They become area denial. Raise the limit from three standing columns, or their radius, and keep the rule that none erupts within 5.5 m of you |
| Ground waves (cleave, dive landing) | Travel each way along the street | Expanding rings, like the player's slam |

**Cutscenes.** The camera leaves the player; the letterbox bars and skip-by-holding stay:

- **Entry:** the camera cranes up the erupting beacon, then cuts to a close shot as AEGIS-07 stands. The title card stays a 2D overlay.
- **Enrage:** an orbit around the rival, with a narrower FOV for the roar.
- **Knockout:** a slow orbit.

## Phases

Each phase ends with the 3D page playable and its smoke test passing. The 2D game is untouched throughout, so its smoke test keeps passing without any work. Sizes are rough line counts of new code.

### Phase 0: set up the lane (~300)

- Create slashyslash2 with `index.html`, a README on how to run it, and copies of `util.js`, `settings.js`, `input.js`, `audio.js`, `upgrades.js`, `waves.js`, `ui.js` and the CSS. Take every copy at one commit and record that commit in `slashyslash2/SYNCED_FROM`.
- In the copies: the 3D storage keys; the Game core from a copy of `main.js` moved into `slashyslash2/js/core.js` (style, scoring, slow motion, hitstop, bullet time and its kinds, cutscene state, `announce`, `onKill`, upgrades); an `Arena` interface for `Director` (`spawnPoints('ground' | 'high')`, `perches`, `barrelSpots`, `freeGroundAt`); and the optional position for `Sound.play`.
- `slashyslash2/tools/vendor-three.js` and the committed `slashyslash2/vendor/three.js`; `slashyslash2/tools/build.js`; `slashyslash2/tools/smoke-test.js`.

Done when: `slashyslash2/index.html` shows a lit test room, the 3D smoke test passes, and this repo is unchanged apart from this plan.

**Status: done** in slashyslash2. The test room has the orbit camera with a ray pull-in (the sphere sweep comes in Phase 1), pointer-locked mouse look, a stand-in figure, the fixed light pool and merged level meshes (about 20 draw calls). `render.js` holds frame composition and the HUD canvas, mirroring the 2D file's role.

### Phase 1: playable slice and camera test (~3,200)

- The street, with procedural textures for three building styles and simple baked light.
- The orbit camera: collision, character fading, aim ray, settings for distance and sensitivity.
- Controller: run, jump, double jump, crouch, slide, dash, mantle, step-up.
- The player's model and rig with run, jump, slide and dash poses, plus the scarf.
- Light and heavy strings with trails and melee aim assist.
- Scrappers on the street-level flow field, as low-poly models, with glint, parry and counter.
- Coloured outlines (needed for elites and the rival later; cheap to prove here).
- HUD: health, shield, dash charges, parry gauge, crosshair, threat ring.
- `slashyslash2/tools/feel-check.js`.

**Feel test (decide before Phase 2).** Play 15 minutes against waves of scrappers, with no text on screen, and check:

1. Light strings land on a moving scrapper without frequent whiffs, and heavies read as committed from behind.
2. You can parry from the glint alone at the default 0.2 s window, including glints from enemies beside or behind you.
3. Dash into dash slash into a string feels like one move.
4. The camera keeps the player readable through double jumps, slides, dashes and fights against a building wall, without clipping or losing the player.

If 1 or 3 fail, strengthen the aim assist or add a lock-on toggle. If 4 fails, change the arena clearances and the camera's pivot and distance before changing anything else. Don't start Phase 2 until all four pass.

**Status: built.** The feel test is next. Notes from the build:

- Pulled forward from Phase 3 because feel-test item 2 needs them: the camera rule for attack slots, glints drawn over walls at a minimum size, threat ring markers (wind-ups, glints, hit direction), pickups and damage numbers.
- The street's 2D buildings became solid blocks behind the street with walkable roofs; a row of facades too tall to climb closes the front, so the street is a 14 m canyon. Platforms are solid slabs you mantle onto. `feel-check.js` confirms every tier is reachable (highest climb 9.1 m against a 9.7 m reach) and the clearance rules hold (street 14 m, headroom 5.55 m, narrowest alley 6.36 m).
- Converted movement: run 13.8 m/s, jump 4.4 m, double jump 8.2 m, dash 6.2 m, slide 10.9 m.
- The camera's vertical smoothing can lag the pivot into a platform right after a climb, so the pivot is swept up from the top of the head before the camera is swept back from the pivot.
- Lights are baked per vertex on a grid of at most 1 m with shadow rays (about 50 ms at load); characters take the baked light under their feet through a uniform, so the scene has no ambient light.
- The player model follows the concept sheets loosely: charcoal voxel-noise armour, a red right arm, a glowing visor, helmet fins, gold fittings, red running lights, a glowing curved katana and a scarf fraying to black. It is rigid parts on bones like the scrapper (one draw call, gibs on death).
- Poses reuse the 2D pose function's logic: its feet and hand targets on the side plane are mapped into 3D and reached with two-bone IK, and swings point the blade along the 3D arc the trail uses. This covers more than Phase 2's "new 3D poses" list asks for; those poses may only need tuning.
- The scarf is a verlet chain (7 points) pinned at the neck, pushed back by speed and drifting left, kept out of the torso and above the ground.
- Characters get a cool rim light. Without it the dark armour disappeared against the night street.

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
- 3D effects in `slashyslash2/js/fx.js`: additive sprites, rings, lightning, ground marks, trails, gibs.

**Status: built.** Street Waves (scrappers, then gunners and grenadiers) is the feel test for it. Notes from the build:

- The gunner and the grenadier were pulled forward from Phase 3, since bolt returns and grenade kicks need something to answer. Their tells carry over: the gunner's laser (dashed while tracking, white once locked) and the grenadier's arc with its blast zone on the ground.
- The tether fires down the crosshair's line and snaps to an enemy, barrel or grenade within 4 degrees; the line is drawn from the model's hand. Barrels sit on the 2D barrel spots.
- The slam's two ground waves are one ring running out over the ground, stopped by walls. Aftershock uses the same ring for the plunge.
- Bullet time desaturates lit surfaces in their shader rather than with a screen pass, so glowing parts and all effects stay bright, as the 2D emissive layer did.
- Ground marks glow hot and cool to pale scars, since dark marks vanished on the dark street. Dashes, bullet jumps, plunges, zips and grenade reels leave afterimages of the model.
- Movement numbers: bullet jump 10.5 m when aimed 30 degrees up, wall slide 6.4 m/s, wall kick +3.9 m.
- Shield, health, the overflow rule, hit flags, the style meter, slow motion, hitstop and positional audio were already in from Phase 1.

### Phase 3: enemies, AI and waves (~3,000)

- Navigation layers and jump links.
- The humanoid enemy rig and its variants, then the brute, crawler and drone.
- The other five enemy types' behaviour (the gunner and grenadier came in Phase 2).
- Attack slots with the camera rule; threat ring markers; glints drawn on top of walls with a minimum size.
- Director modes: demo, endless, upgrades, wave modifiers.
- Pickups and damage numbers (projected into the HUD canvas).

**Status: built.** The Wave Demo and Endless Survival are its feel test. Notes from the build:

- Navigation is one graph over every walkable surface rather than a grid per layer: a node every 0.5 m wherever a body fits, walk links within a 1 m step, jump links up to 6.4 m from surface edges (stepping out from under an overhang first, so stacked fire-escape platforms climb tier by tier) and drop links off ledges. The flow field is a Dijkstra search back from the player, re-solved at most ten times a second within about 60 m of travel; lower nodes near the player are seeded at a cost, so enemies that can't climb to you wait below. About 100 ms to build at load, 2 ms per re-solve. `feel-check.js` checks the street is one piece, every surface has a way down and every fire-escape tier can be climbed (21 of 31 raised surfaces are climbable).
- Enemy jumps reach 6.4 m, more than the 2D jump, which tops out just under the first tier. In 3D a low roof isn't a refuge from melee; brutes are the exception and stay on the ground.
- Humanoids share one rig: the shield scrapper's shield rides the chest with the left arm on it by IK, the sniper has a hood and a long rifle, the brute is the rig at 1.45x with its shoulders set wide, a furnace in its chest and its head sunk. The crawler (six legs, tripod gait, seams that glow when cracked) and the drone (rotors, a lens that blinks red) have their own rigs. Each is still one draw call.
- With no text in play, states show on the models: a broken guard leaves the shield hanging low, cracked armour glows through its seams, the brute's furnace flares through its wind-ups.
- The brute's ground wave is a band of light running out from the slam; it hits once if your feet are within 0.64 m of the ground as it passes, walls stop it, and it can be parried.
- The drone's glint is timed to its impact rather than its launch; the 2D timing put the hit outside a parry made on the glint.
- Sniper perches are the middles of each side of a qualifying ledge, since a sniper in the middle of a balcony can't see past its own floor. A sniper rises off its ledge, zips along a straight line its whole body clears, and drops onto the new perch.
- The boundary walls continue upward as invisible collision: random play found a zip from the 20.5 m roof onto the back wall's top, outside the arena.
- Rival waves are held back until Phase 5 (the demo ends after six waves, endless has no eighth-wave rival) and the Blackout modifier until Phase 4. Glints Only hides the threat ring's position markers, the 3D stand-in for the 2D `!` markers.
- Endless upgrades work as in 2D, with Ember Wake ported (it was missing). Spawn beams mark arriving enemies.
- The Phase 2 Street Waves mode is gone; Endless covers it.

**Movement retune (after Phase 3).** Playing it, the converted 2D movement felt stiff in third person, closer to Roblox than to Warframe. Retuned in metres, as the plan intended:

- Ground speed builds from a 9.5 m/s run to a 13.8 m/s sprint over half a second. Turns carve the velocity round at a rate that falls with speed instead of snapping to the new direction, a hard reversal skids, and stops take 0.2 s.
- The step-up dropped from 1 m to 0.45 m. Anything up to 1.95 m is vaulted at speed (cars, low walls, chest-high ledges), going over the highest top within reach and keeping about 95% of your speed. Mantles leave you moving.
- Gravity went from 87 to 70 m/s², easing near the top of a held jump. Jump speeds were rescaled so every height (and every climb `feel-check.js` checks) is unchanged. Air control carves too. The slide starts at 1.2x your speed and lasts longer. Combat launches were left as they were.
- The sprint pose pitches the torso up to about 45 degrees with the blade trailing and the free arm pumping. The body banks into turns from its sideways acceleration, and leans with acceleration. There are skid, vault and landing-roll poses, and movement poses crossfade over 0.12 s.
- The camera widens up to 5 degrees at a sprint (behind the existing comfort toggle) and trails about half a metre behind at speed.

### Phase 4: arena and look (~1,200)

- The crossroads arena, following the clearance rules.
- Full lighting bake; the dynamic light pool; neon, lamps and fires; weather; fog.
- The Blackout modifier, a rebake with the street lights off.
- The Retro preset.
- A slow orbit behind the title screen.

**Status: built.** Endless in the crossroads is its feel test. Notes from the build:

- The crossroads: four 18 m streets meet at a 20 m plaza raised 15 cm; four buildings fill each corner block, split by 6 m alleys, with roofs from 6 to 18 m and clutter on top. An overpass at 7 m crosses the east street, girders cross the other three and one alley, and fire escapes (tiers 5.4 m apart from 5.5 m, leaving 5 m of headroom) climb every building taller than an enemy's 6.4 m jump. Container barricades close the street ends against a ring of 26 m facades with invisible collision above. Six wrecked cars and the containers are the only ground cover. `feel-check.js` checks the clearance rules from each arena's data and finds all 78 raised surfaces climbable by enemies.
- Every mode plays there; the converted street stays as a free roam and as the fixture for the movement checks. Loading an arena takes about 300 ms.
- The bake culls per cell instead of per face (the plaza would otherwise hide the whole street surface) and bakes three channels: steady lamps, fires and buzz (neon and failing lamps). The shader scales the last two each frame, so flicker shows on the world and on characters without a rebake.
- Blackout rebakes the steady channel without the street lamps (about 40 ms), darkens the lamp heads, closes the fog and gives the player a faint light, as the 2D game did; clearing the wave restores it.
- Rain streaks and ash fall in a box around the camera; a drop stops at the first surface below where it started, so none fall under the overpass.
- Retro is a toggle that renders at 480 x 270, scaled up without smoothing.
- The plaza deck is a thin slab on the street box, which exposed a landing bug: a fast fall could reach both in one physics step and settle on the street, inside the deck. Landing now takes the highest top it passed, and `feel-check.js` drops bodies onto every thin slab to keep it that way.
- No glow pass: glowing parts are fullbright and effects additive, which covers the 2D glow; a bloom pass would mean vendoring post-processing.

**Additions after Phase 4 (asked for in play).**

- Skid turns: a hard reversal at speed (W to S, W+D to A+S) drops the body low onto the free hand dug into the street, with sparks off the hand and glowing scrape marks from the hand and the trailing boot that cool and fade; when the slide is spent, a push off the hand at 80% of a run.
- Side vaults: the vault hops 0.45 m clear of the top with the free hand planted on it, the body rolled onto its side and the knees swung over.
- Wall cling: wall kicks now start from a cling. Jumping into a tall wall (at or past the top of the jump) digs the left hand in, holds for 1 s, then slides, building from 0 to 6.4 m/s at 5 m/s², the hand scoring a groove down the wall. A jump beside a wall without a cling is a double jump.
- Aimed swings: slashes tip up or down with the aim (or straight at an assisted target above or below), with a small dead zone; the hit test, the trail and the knockback follow the pitch, and the body tilts with the same animations (whole body in the air, bending at the waist on the ground).
- Plunge on a held attack in the air instead of crouch plus attack (0.2 s), so the air heavy is gone.
- Prop collision: lamps, fire barrels, bins, hydrants, cones, poles and red barrels are round colliders bodies slide round; running into a red barrel shoves it. Lamps can be cut by any slash or knocked down by a blast: the light goes out (a local rebake), the pole stops colliding, and the top topples, smashes and hits whatever it falls on. Lamps stand again on a new run.
- The south-east corner block became a construction site: hoarding with gates, a three-storey steel frame (floors at 5.4, 10.8 and 16.2 m, 5.1 m clear under each), scaffolding continuing the overpass, an excavator, a dirt pile, materials, offices and floodlights, and a tower crane whose jib (25 m) crosses the east street. The jib and the load on its hook are tether points reachable from 42 m: a tap flings you onto the jib, a hold hauls you round the beam onto it.

### Phase 5: rival (~2,500)

- AEGIS-07 on the shared controller and rig, its model and parts.
- Phase 1: gun, beam, greatblade, shield, pulse grenade.
- Phase 2: combos, guards, riposte, parry-back, dive bomb.
- The redesigned red flash, blade waves, eruptions and ground rings, each checked by playing them: can you read and answer every one with no text on screen?
- Entry, enrage and knockout cutscenes.
- Melee Duel.

**Status: built (first pass), with changes asked for at the start of the phase.** The Rival Fight and Melee Duel are its feel test; it's the part expected to take the most tuning. Notes from the build:

- AEGIS-07 follows its reference sheets rather than the player's rig: a 2.5 m mech in white and grey pixel camo with blue patches, a T-shaped visor, a square chest core, big pauldrons, a beam cannon on the left shoulder, a thruster pack with two round jets, and a forearm housing on the right arm that is both gun barrel and blade emitter. It has its own model, camo texture and poses (`slashyslash2/js/aegis.js`), and it moves by running, thruster dashes, hovering and leaps instead of the player's controller. The visor beam became the shoulder cannon's beam.
- Asked for with the rival: it is always zoning or charging. Zoning holds a band of range and strafes round you, boosting back out if you crowd it; charging closes in. It picks by phase and by what you do (keep away and it charges; crowd it or hurt it badly and it zones), with a tell in its eye and jets when it switches, and the stance shows on its health bar.
- Also asked for: dashes come as chains of legs taken relative to the player when each starts, so they don't all come straight in. Charging, it zigzags (side, other side, cut), swings round the flank, feints back out, or rushes; zoning, it crosses your front throwing a blade wave from each new angle, or backs off and throws one at head height. The cut glints first and passes through where you stood.
- The redesign table's rules are in: the red flash tracks you until its eye flashes, then hits everything but a 90 degree wedge behind it out to 20 m, and its body blocks walking through; blade waves are 9 m wide; eruptions never open within 5.5 m of you, four can stand, and they reach the sky; the cleave and the dive landing throw rings.
- Phase 1's beam sweeps with limits on how fast its yaw and pitch turn, cuts down street lamps in its path, and is fired hovering. The gun shows an aim line through its wind-up. The pulse grenade shows its arc and blast zone while it charges in the left hand.
- Cutscenes take the camera to set shots per stage (the entry cranes up the beacon, closes in as it stands and frames it for the title; the enrage pushes in for the roar; the knockout orbits) with letterbox bars and hold-to-skip, and hand the camera back facing it. The health bar sits at the bottom of the screen.
- Asked for alongside: the scroll wheel zooms the camera down to first person, wall clings last only while a movement key is held, and sword trails carry forked lightning.
- Asked for after the first pass, for the rival: phase 1 never charges; it keeps its distance by strafing, boosting away and tether-zipping to vantages at range with a clear shot (as the 2D rival zips up to you), and when you crowd it, it cuts and boosts off. Its plating is toned down from white to light and mid grey. Only dashes that attack glint. The dive bomb charges for about a second, leaps 16 m, flashes as the mark locks and dives at 90 m/s 0.3 s later. Blade waves can be parried but never sent back.
- Asked for after the first pass: in first person, whatever of the body is right at the lens dithers away (instead of clipping through the view in jumps and crouches), and the screen reacts to swings, dashes and hits with FOV punches, roll, edge flares, a hit vignette darkest on the side the hit came from, a low-health pulse and speed lines. Ledges climb from the ground up to 2.65 m and from the air up to 2.4 m above the feet (the mantle above reached 1.45 m, from the air only), and a tether at a ledge's edge puts you on top. Slash trails last half as long again and fade, feather and taper instead of popping on and off.

### Phase 6: the rest (~600)

- Sawblade; Training (dummy and spawn panel).
- The settings panel rows for camera, comfort and resolution.
- A 3D README in the same shape as the 2D one.
- A pass over the 2D README and the `SYNCED_FROM` diff for anything you want that the 3D lane still lacks.

### Effects and sound over the phases

Each phase ports the effects and sounds of what it builds, so a mechanic arrives with its 2D feedback rather than as a placeholder. The procedural sounds and music are already all in (`audio.js` is a copy of the 2D one, placed in 3D with HRTF panning); what's left is effects for things not built yet:

- Phase 2 (done): every player move's effects, ground marks, afterimages, bullet time.
- Phase 3 (done): the brute, crawler, drone, shielder and sniper's tells and death effects, elite outlines, spawn beams.
- Phase 4 (done): the world's atmosphere: weather, neon and fire flicker in the full light bake, fog, the Blackout rebake and the Retro preset. The glow pass wasn't needed.
- Phase 5: the rival's effects: the red flash, blade waves, eruptions, ground rings, the pulse grenade's full blast, and the cutscenes.
- Phase 6: the Sawblade.

Keeping them in step with 2D: `tools/sync-2d.js` lists every 2D change to `fx.js`, `audio.js` and the files that call them since `SYNCED_FROM`; sound changes copy straight across, effect changes are ported by hand into `fx.js` or `views.js`. The 3D smoke test fails if a new effect's material compiles mid-fight, so each one gets added to the load-time prewarm.

There's no cutover. The 2D game stays in this repo as the main game, and the 3D lane keeps growing in its own for as long as it's fun to tinker on. End state: about 15,000 lines in slashyslash2 (about 2,000 copied, about 13,000 new).

## Where each 2D file ends up in the 3D lane

The 2D files themselves never change.

| 2D file | Lines | In the 3D lane |
| --- | --- | --- |
| `util.js` | 278 | Copied; adds vec3 helpers, ray-vs-box, sphere sweep and cone tests |
| `settings.js` | 147 | Copied; 3D storage keys, 3D bindings, camera distance, sensitivity, invert Y, resolution scale, comfort toggles |
| `input.js` | 109 | Copied; adds pointer lock, mouse deltas, `Esc` handling |
| `audio.js` | 771 | Copied; adds positional `play` |
| `upgrades.js` | 64 | Copied; the Aftershock ground wave becomes a ring |
| `waves.js` | 166 | Copied; spawns go through `Arena` |
| `ui.js` | 254 | Copied; new settings rows; re-locks the pointer on resume |
| `main.js` | 399 | About 255 lines of core copied into `core.js`; loop and camera written new in `main.js` |
| `training.js` | 140 | Reimplemented ("in front of you" means along the aim) |
| `player.js` | 1,750 | Reimplemented: state machine, strings and timings carry over; movement and hit tests are new; poses feed the 3D rig; drawing is replaced by the model |
| `utilities.js` | 63 | Reimplemented; the `registerUtility` API stays |
| `enemies.js` | 820 | Reimplemented: behaviour carries over; physics, navigation, hit tests and models are new |
| `specialists.js` | 374 | Reimplemented |
| `rival.js` | 1,726 | Reimplemented, with four moves redesigned; poses feed the 3D rig; cutscenes use 3D cameras; `BladeWave`, `GroundEruption` and `drawEnergyBeam` become 3D |
| `ultimates.js` | 226 | Reimplemented; the `registerUltimate` API stays |
| `level.js` | 704 | Not used; its street layout is copied as data for Phase 1 |
| `render.js` | 508 | HUD half and title card copied into `render.js`, which composes the 3D frame; scene drawing not used; the bullet-time cues move to the tell layer |
| `fx.js` | 431 | Screen flashes copied; the rest replaced by 3D effects |
| `sprites.js` | 114 | Not used; `ik2` and `Sprite.outlined` are the references for the 3D rig and the outline pass |

The 3D lane's layout:

| Path | Contents |
| --- | --- |
| `slashyslash2/index.html`, `slashyslash2/README.md`, `slashyslash2/SYNCED_FROM` | Entry page, how to run it, the last 2D commit synced from |
| `slashyslash2/css/` | Copied from 2D |
| `slashyslash2/vendor/three.js` | Vendored Three.js |
| `slashyslash2/tools/` | `vendor-three.js`, `build.js`, `smoke-test.js`, `feel-check.js` |
| `slashyslash2/js/` (same names as 2D) | `util`, `settings`, `input`, `audio`, `upgrades`, `waves`, `ui`, `main`, `render`, `training`, `player`, `utilities`, `enemies`, `specialists`, `rival`, `ultimates`, `fx` |
| `slashyslash2/js/` (new) | `core.js`, `world.js` (arena boxes, collision, raycasts, sphere sweep, navigation), `gfx.js` (renderer, textures, lighting bake, light pool, fog, outline and bullet-time passes), `camera.js`, `rig.js`, `models.js`, `controller.js` |

## Risks, highest first

1. **The camera in a dense, vertical city**: clipping into walls, losing the player under the overpass or against a building, and zips across the map that are hard to follow. Handled by the sphere sweep, character fading, the arena clearance rules and the Phase 1 feel test.
2. **The rival's phase 2 in 3D.** It's the largest single port, and four of its moves rely on the 2D street. Handled by the redesign table and the Phase 5 checks. If the red flash can't be made fair with the back wedge, simplify it to "dash through its body or get hit".
3. **Melee aimed by the camera.** The enemy you want is often beside the character rather than under the crosshair. Handled by the melee aim assist, with a lock-on toggle as the escalation.
4. **Tells without text.** Every tell has to read at camera distance through visuals and sound alone. Handled by glints with a minimum size drawn over walls, outlines, the tell layer, positional audio, and playing each phase without text.
5. **The lanes drift apart.** The 2D game keeps changing (PR #4 grew `rival.js` by half in seven commits), so the 3D version will lag behind it. That's by design: `SYNCED_FROM` and the diff keep the gap visible, and you port only what you want. The cost is that fixes in copied files (a sound, a settings bug) don't reach 3D on their own.
6. **Building 11 character models and their animation in code** takes longer than the 2D sprites did. Handled by the shared humanoid rig, the part library, and reusing the 2D poses where they apply.
7. **Unfair hits from outside the view.** Handled by the camera-aware attack slots, positional glints, the threat ring and the all-direction parry.
8. **Navigation across levels and roofs.** Most enemies stay on the street; drones, snipers and the rival handle height through their own movement.
9. **Retuning platformer constants for 3D** eats time. `feel-check.js` keeps it measurable; tune in metres, never by converting pixel values again.
10. **Three.js performance traps** (shader recompiles when lights change, draw calls per body part). Use the fixed light pool, baked world light and one skinned mesh per character from the start.

## Open decisions

Recommendations first.

- **A link from the 2D menu to the 3D page?** No, for now. It would mean editing the 2D game's `index.html` and `ui.js`. Open slashyslash2's `index.html` directly, or bookmark it.
- **Shared unlocks:** keep saves separate. If beating AEGIS-07 in 2D should count in 3D, the 3D lane can later read the 2D save without ever writing to it.
- **Red flash in 3D:** a tracked lock with a safe wedge behind it. The fallback is a full circle that only a dash through its body escapes.
- **Lock-on:** soft aim assist only, unless the feel test asks for more.
- **Retro preset:** keep it. It's cheap and ties back to the 2D pixel look.
- **Long-term arena:** the crossroads. The converted street is for testing only.
- **Wall running:** defer; a later endless upgrade is a natural home for it.
- **Gamepad:** it suits a third-person action game well, and it can be added to the 3D lane alone.
