# SlashySlash

A 2D side-scrolling action demo: a small cyborg with a red katana, fast Warframe-style movement, and an electric tether, fighting scrap gangs in a ruined city. Pixel art, sound effects and music are all generated in code, so there are no asset files.

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

A headless smoke test plays both modes with random input and fails on any page error (needs Playwright with Chromium):

```sh
npm i -D playwright && npx playwright install chromium
node tools/smoke-test.js 90
```

## Controls

Every binding can be changed in **Settings → Controls** (two slots per action).

| Action | Default |
| --- | --- |
| Move | `A` / `D` |
| Jump, double jump, wall jump | `W` or `Space` |
| Crouch; slide when running | `S` |
| Bullet jump toward the cursor | `S` + `W` (while crouching or sliding) |
| Drop through a platform | double-tap `S` |
| Dash (2 charges, brief invulnerability) | `Shift` + direction |
| Slash combo toward the cursor | Left mouse |
| Slide attack (360° spin) | Left mouse while sliding |
| Plunge with ground shockwave | Hold `S` + left mouse in the air |
| Sheathe, charge, release to draw | Hold `E` |
| Parry, then release for a counter | Tap `E` as a hit lands |
| Tether: tap to yank, hold to zip | Right mouse |
| Tether yank (direct) | `Q` |
| Sawblade ultimate | Hold `R` for 1 second when charged |
| Pause | `Esc` or `P` |

## How the systems work

**Combo.** Two quick slashes, then a wide third swing that lunges forward. Swings follow the cursor, keep you aloft when they connect in the air, and deflect enemy bolts.

**Sheathe and iaido.** Holding `E` sheathes the blade and charges for about a second (you can hover briefly mid-air). Releasing dashes through enemies along the cursor line and ends in a large arc. At more than half charge, everything you cut freezes for a beat, then splits. A very short tap does a quick draw instead.

**Parry.** The first 0.2 s of a sheathe is a parry window (adjustable in settings). It blocks melee hits, drone dives, brute shockwaves and bolts, slows time, and empowers the blade. Releasing `E` then fires a counter iaido that chains lightning to up to five nearby enemies. Parried bolts fly back toward the cursor. Missing a tap-parry locks the window for 0.35 s so it can't be spammed.

**Tether.** Fires an electric line at the cursor that sticks to enemies, barrels, walls and platforms. Each shot costs 15 shield, so the shield is both armour and fuel.

- Tap: yank the target to you (it is stunned on arrival). Barrels thrown this way explode on enemies.
- Hold: zip toward the target. Arriving at an enemy lands a tether strike and bounces you up. Releasing early slingshots you with your momentum.
- Tapping on terrain flings you toward it.
- Brutes are too heavy to yank, so the tether pulls you to them instead.
- Tethered enemies take 25% more damage.
- Releasing an iaido while tethered to an enemy aims the draw straight at it.

**Health and shield.** The shield absorbs damage first and starts refilling after 3 seconds without being hit. If a hit breaks the shield, the overflow is ignored and you get a short invulnerability window. Health only comes back from wave clears and the green pickups enemies drop.

**Plunge.** Damage and radius of the shockwave scale with the fall height. It lands on the first surface below you, platforms included.

**Sawblade ultimate.** Kills fill the meter (brutes count triple; the kill count is adjustable). Hold `R` for a second to become a spinning electric saw for 7 seconds: invulnerable, contact damage, unlimited jumps, free tether with no range limit, and left mouse lunges toward the cursor.

## Modes

- **Wave Demo:** six scripted waves that introduce each enemy, ending in a two-brute fight. The results screen offers a jump straight into endless.
- **Endless Survival:** waves grow in size and toughness without limit. Every fifth wave is a heavy wave with extra brutes. Your best wave and score are saved.

Enemies:

| Enemy | Behaviour |
| --- | --- |
| Scrapper | Melee rusher with a telegraphed cleaver swing |
| Gunner | Keeps its distance and fires bolts after a visible laser lock |
| Drone | Circles overhead, blinks red, then dives |
| Brute | Heavy, resists knockback, punches and sends ground shockwaves along the floor |

A yellow `!` above an enemy means an attack is winding up.

## Settings

- **Enemies:** difficulty presets plus individual sliders for health, damage, speed, count, attack frequency and wind-up time; max enemies on screen; break length between waves; per-type toggles; parry window; kills needed for the ultimate; a practice mode where you can't take damage.
- **Controls:** rebind every action, choose whether a tether tap yanks, toggle double-tap drop-through.
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
| `js/enemies.js` | Enemy AI, projectiles, shockwaves, barrels, pickups |
| `js/waves.js` | Demo waves and endless wave generation |
| `js/render.js` | Frame composition, lighting, weather, HUD |
| `js/ui.js` | Menus, results screen and settings panel |
| `js/main.js` | Game state, fixed 120 Hz simulation, camera, main loop |

The game renders at 480×270 and CSS scales it up with nearest-neighbour filtering. Characters are drawn each frame as skeletons of pixel lines into a scratch canvas, then composited with a 1 px outline.

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
