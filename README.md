# SlashySlash

A 2D side-scrolling action demo: a small cyborg with a red katana, fast Warframe-style movement, and an electric tether, fighting scrap gangs and a rival cyborg in a ruined city. Pixel art, sound effects and music are all generated in code, so there are no asset files.

## Running it

Open `index.html` in a desktop browser. No build step or server is needed.

If your browser blocks local files, serve the folder instead:

```sh
npx serve .
```

To produce one self-contained HTML file (everything inlined) at `dist/slashyslash.html`:

```sh
node tools/build.js
```

Keyboard and mouse are required. Settings and best scores are saved in the browser's local storage.

A headless smoke test plays all three modes with random input and fails on any page error (needs Playwright with Chromium):

```sh
npm i -D playwright && npx playwright install chromium
node tools/smoke-test.js 90
```

## Controls

Every binding can be changed in **Settings → Controls** (two slots per action).

| Action | Default |
| --- | --- |
| Move | `A` / `D` |
| Vault low cover | Run into it (hold `S` to stay behind it) |
| Jump, double jump, wall jump | `W` or `Space` |
| Crouch; slide when running | `S` |
| Bullet jump toward the cursor | `S` + `W` (while crouching or sliding) |
| Drop through a platform | Hold `S` on it |
| Dash (2 charges, brief invulnerability) | `Shift` + direction |
| Dash slash | Left mouse during or right after a dash |
| Slash combo toward the cursor | Left mouse |
| Ground cut with rubble spray | Left mouse while sliding |
| Plunge with ground shockwave | Hold `S` + left mouse in the air |
| Parry stance (costs 15 shield) | `E` just before a hit lands |
| Counter after a parry | Release `E` |
| Tether: tap to fling yourself, hold to zip | Right mouse at a target |
| Grab, swing and throw a barrel | Hold right mouse on it, release to throw |
| Rebound a pulse grenade (slows time) | Right mouse on it in flight, aim with the mouse |
| Sawblade ultimate | Hold `R` for 1 second when charged |
| Pause | `Esc` or `P` |

## How the systems work

**Combo.** Two quick slashes, then a wide third swing that lunges forward. Swings follow the cursor, keep you aloft when they connect in the air, and deflect enemy bolts.

**Dash slash.** Clicking during a dash, or within a moment after it, draws the blade along the cursor line, cutting everything on the path and ending in an arc.

**Ground cut.** Clicking while sliding drags the blade through the street: it hits anything low in front of you and sprays rubble that damages enemies ahead.

**Parry stance.** Pressing `E` costs 15 shield and opens a parry window for the first 0.2 s (adjustable in settings). It blocks melee hits, drone dives, brute shockwaves, the rival's blade, beam and pulse grenades, and bolts. A star-shaped glint flashes on the weapon about 0.28 s before any melee hit lands, so pressing `E` as a reaction to it lands inside the window. A successful parry refunds the 15 shield, slows time and empowers the blade; releasing `E` then fires a counter that chains lightning to up to five nearby enemies. Parried bolts fly back toward the cursor; a parried grenade is only smothered. A stance without a parry does nothing and goes on a 0.8 s cooldown (0.25 s after a counter). The stance can also hover you briefly once per jump.

**Tether.** Fires an electric line at the cursor. Each shot costs 15 shield, so the shield is both armour and fuel. It never pulls enemies.

- Tap on an enemy or terrain: fling yourself toward it.
- Hold: zip to the target. Arriving at an enemy lands a tether strike and bounces you up. Releasing early slingshots you with your momentum.
- Barrels are grabbed instead: hold to swing them on the line, release to throw them at the cursor. Thrown barrels explode on enemies.
- A pulse grenade in flight is the exception. Hitting it with the tether (the line homes onto a grenade near the cursor) drops into bullet time: the world loses its colour, time runs at a quarter speed, and you reel yourself in and slash it toward the cursor. The rebounded grenade curves slightly toward the rival and bursts on contact.
- Tethered enemies take 25% more damage, and a dash slash or counter released while tethered aims straight at the target.

**Health and shield.** The shield (max 100) absorbs damage first and starts refilling after 3 seconds without being hit. If a hit breaks the shield, the overflow is ignored and you get a short invulnerability window. Health only comes back from wave clears and the green pickups enemies drop.

**Plunge.** Damage and radius of the shockwave scale with the fall height. It lands on the first surface below you, platforms included.

**Sawblade ultimate.** Kills fill the meter (brutes count triple; the kill count is adjustable). Hold `R` for a second to become a spinning electric saw for 7 seconds: invulnerable, contact damage, unlimited jumps, free tether with no range limit, and left mouse lunges toward the cursor. Holding the tether on an enemy latches the saw onto it until it dies or you let go, with damage that grows every tick.

**The arena.** Buildings are scenery you run straight through; their roofs and balconies, plus fire escapes, girders, scaffolds and an overpass, are one-way platforms stacked about a double jump apart. Only the two boundary walls are solid, and they can be wall-jumped.

**Cover.** Six striped concrete barriers with amber beacons stand along the street. They are tall enough to stop bolts aimed at your chest, the rival's beam and ground shockwaves, but shots from above still reach you. Running into one vaults it; holding crouch keeps you behind it. Flash-step movement (dashes, drawn slashes, zips and the rival's lunges) passes over them.

## Modes

- **Wave Demo:** six scripted waves that introduce each enemy, then the rival. The results screen offers a jump straight into endless.
- **Endless Survival:** waves grow in size and toughness without limit. Every fifth wave is a heavy wave with extra brutes, and every eighth brings the rival back, tougher each time (toggle in settings). Your best wave and score are saved.
- **Rival Fight:** straight into the AEGIS-07 fight.

Enemies:

| Enemy | Behaviour |
| --- | --- |
| Scrapper | Melee rusher with a telegraphed cleaver swing |
| Gunner | Keeps its distance and fires bolts after a visible laser lock |
| Drone | Circles overhead, blinks red, then dives |
| Brute | Heavy, resists knockback, punches and sends ground shockwaves along the floor |

A yellow `!` above an enemy means an attack is winding up.

### AEGIS-07

A rival cyborg built on the same skeleton, physics and power level as the player. It runs, double jumps, wall jumps, drops through platforms, dashes with invulnerability, and zips to your platform on its own tether.

The fight has two phases and no reinforcements.

**Phase 1 (above half health)**

- **Shield:** while it is up, every attack is deflected. Its own pulse grenade is the only thing that breaks it, and its health can't drop below half until phase 2 starts.
- **Pulse grenade:** it charges an orb in its off hand and previews the arc, then lobs it. The grenade explodes the moment it touches anything: terrain, a platform, a barrel or you. A dashed ring on the ground shows where it will land and how far the blast reaches. If the blast catches you, your shield drops to zero and stays offline for six seconds, which also locks out the parry stance and tether. The only way to send it back is the tether rebound; slashing it without the tether sets it off in your face, and a parry only smothers it.
- **Shield down:** the rival is stunned for about three seconds and takes extra damage, then fights on unshielded and dodges some of your swings. The shield returns after ten seconds.
- **Other attacks:** a forearm gun that fires bursts while it moves, a greatblade swing up close, and a visor beam fired while hovering. The beam has angular momentum, so it is slow to change direction once firing.

**Half health.** A shockwave throws you clear and a short cutscene plays (input is locked): letterbox bars, the camera on the rival, its limiter plates popping off, then a 2x close-up as it roars and its visor turns white.

**Phase 2**

- The shield and every ranged attack go offline for good. It moves faster and fights in greatblade combos built from five moves: slash, overhead cleave (with ground shockwaves), rising slash, lunging thrust, and spin.
- Parry one of its swings and it raises a guard. Your counter (or any attack) is parried, and it answers with a gold, gap-closing riposte.
- Parry the riposte and it is staggered for about three seconds, taking extra damage.

**Knockout.** The last hit freezes into heavy slow motion in a 2x close-up. Then it staggers, drops to one knee on its blade and collapses face down, with a KNOCKOUT title. Its body stays in the street until the next wave.

Defeating it sets `SaveData.unlocks.aegis`. Its palette, weapon and name live in `CHARACTERS` in `js/rival.js`, ready for a character select.

## Settings

- **Enemies:** difficulty presets plus individual sliders for health, damage, speed, count, attack frequency and wind-up time; max enemies on screen; break length between waves; per-type toggles; the endless rival; parry window; kills needed for the ultimate; a practice mode where you can't take damage.
- **Controls:** rebind every action, toggle hold-to-drop on platforms.
- **Sound:** master, effects and music volume, mute when the window loses focus, preview sounds.
- **Visuals:** screen shake, hit-stop, particle density, camera look-ahead, dynamic lighting, glow, screen flashes, slow-motion, damage numbers, off-screen enemy arrows, weather, CRT scanlines, integer pixel scaling, FPS counter.

## Code layout

Plain JavaScript, loaded as classic scripts so the game runs from `file://`.

| File | Contents |
| --- | --- |
| `js/util.js` | Math, geometry, pixel line and disc rasterisers, 3x5 bitmap font |
| `js/settings.js` | Defaults, presets, persistence, settings panel schema |
| `js/input.js` | Keyboard and mouse state, rebindable actions |
| `js/audio.js` | WebAudio sound effects and the step-sequenced music |
| `js/fx.js` | Particles, dithered slash arcs, lightning, rings, gibs, afterimages |
| `js/level.js` | City geometry, body physics, prerendered parallax layers |
| `js/sprites.js` | Skeleton IK helpers and outlined sprite compositing |
| `js/player.js` | Movement, combat, parry, tether, shield and the player rig |
| `js/ultimates.js` | Ultimate ability registry and the Sawblade |
| `js/enemies.js` | Enemy AI, projectiles, rubble, shockwaves, barrels, pickups |
| `js/rival.js` | AEGIS-07 boss, its cutscenes, pulse grenade, knocked-out husk, and the `CHARACTERS` registry |
| `js/waves.js` | Demo waves, endless wave generation, rival waves |
| `js/render.js` | Frame composition, lighting, weather, HUD |
| `js/ui.js` | Menus, results screen and settings panel |
| `js/main.js` | Game state, fixed 120 Hz simulation, camera, cutscene and bullet-time state, main loop |

The game renders at 480×270 and CSS scales it up with nearest-neighbour filtering. Characters are drawn each frame as skeletons of pixel lines into a scratch canvas, then composited with a 1 px outline. The rival reuses the player's pose and drawing code with its own palette (`pal`), weapon (`drawKatana` override), extra parts (`drawExtras`) and action poses (`customPose`); a future playable character can plug in the same way.

### Adding an ultimate

Ultimates are self-contained objects in `js/ultimates.js`:

```js
registerUltimate({
  id: 'myult', name: 'My Ultimate', desc: '…', duration: 6,
  start(p) {},               // p is the Player; p.ult holds per-activation state
  update(p, dt) {},          // runs instead of normal player movement while active
  end(p) {},                 // must clear p.ult
  draw(p, ctx, camX, camY) {},
  drawEmissive(p, ctx, camX, camY) {},
});
```

The active one is chosen by `S.gameplay.ultimate`. An unlock system only needs to change that value and show the options somewhere.
