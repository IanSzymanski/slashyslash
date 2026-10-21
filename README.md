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

A headless smoke test plays every mode with random input and fails on any page error (needs Playwright with Chromium):

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
| Crouch (anywhere, platforms included); slide when running | `S` |
| Bullet jump toward the cursor | `S` + `W` (while crouching or sliding) |
| Drop through a platform | Double-tap `S` on it (or hold, in settings) |
| Dash (2 charges, brief invulnerability) | `Shift` + direction |
| Dash slash (hold for a heavy one) | Left mouse during or right after a dash |
| Slash string toward the cursor | Tap left mouse |
| Heavy attack (mixes into strings) | Hold left mouse |
| Ground cut with rubble spray (hold: rock eruption launcher) | Left mouse while sliding |
| Plunge with ground shockwave | Hold `S` + left mouse in the air |
| Parry stance (costs 15 shield) | `E` just before a hit lands |
| Counter after a parry | Release `E` |
| Utility: Overload shock ring (10 s cooldown) | `F` |
| Tether: tap to fling yourself, hold to zip | Right mouse at a target |
| Grab, swing and throw a barrel | Hold right mouse on it, release to throw |
| Rebound a pulse grenade (slows time, kick it back) | Right mouse on it in flight, aim with the mouse |
| Sawblade ultimate | Hold `R` for 1 second when charged |
| Pause (the spawn panel in Training) | `Esc` or `P` |
| Skip a cutscene you've seen | Hold `E`, left mouse or jump |
| Pick an endless upgrade | Click it or press `1`-`3` |

## How the systems work

**Strings.** Tapping attack throws a light, holding it for 0.15 s throws a heavy: the blade draws back over your shoulder while you hold, flashes red when it commits, then lands slower and harder. A string runs up to four hits and you can mix the two freely (L H L, H L L H, L L H...). Three lights in a row, or a light fourth hit, end in the wide lunging finisher. A heavy that opens a string is a rising slash that launches; a heavy second hit is a wide crescent with big knockback; a heavy third or fourth hit is a slam that sends a ground wave each way and ends the string. Heavies stagger brutes and knock a shield scrapper's shield aside. Swings follow the cursor, keep you aloft when they connect in the air, and deflect enemy bolts. Lights fire when you release the button, so a quick tap is the snappiest.

**Commitment and buffering.** A dash pressed during an attack waits 0.1 s before cancelling it, and finishers, heavies and slide attacks can't be cancelled while the blade is out; the dash fires as soon as they allow. Heavies also root you in place while they swing. Dash and parry presses made while another action is busy are remembered for 0.12 s, so early presses aren't lost. A dash gives 0.2 s of invulnerability.

**Dash slash.** Clicking during a dash, or within a moment after it, draws the blade along the cursor line, cutting everything on the path and ending in an arc. Holding instead makes it a heavy dash slash: longer, wider, and the cuts land a beat later. Either one opens a string, so dash slash into two taps ends in the lunging finisher.

**Ground cut.** Clicking while sliding buries the blade in the street and drags it: it hits anything low in front of you and the rubble it rips up damages enemies ahead. Holding digs the blade in deep, brakes the slide and rips it upward through an eruption of rock that launches everything in front and throws you into the air for an air string. Both crack crawler armour and open a string.

**Overload (`F`).** The red character's utility: a shock ring around you that interrupts and throws back every enemy close by (shields and armour stop its damage, not the interrupt) and burns hostile bolts out of the air. Ten-second cooldown, shown next to the parry gauge. Bosses resist it and it leaves pulse grenades alone, so it buys space rather than replacing an answer.

**Parry stance.** Pressing `E` costs 15 shield and opens a parry window for the first 0.2 s (adjustable in settings). It blocks melee hits, drone dives, brute shockwaves, the rival's blade, beam and pulse grenades, and bolts. A star-shaped glint flashes on the weapon about 0.28 s before any melee hit lands, so pressing `E` as a reaction to it lands inside the window. A successful parry refunds the 15 shield, slows time and empowers the blade; releasing `E` then fires a counter that chains lightning to up to five nearby enemies, and each kill it makes heals 4 (up to 12). Parried bolts fly back toward the cursor; a parried grenade is only smothered. A stance without a parry does nothing and goes on a 0.4 s cooldown (0.25 s after a parry). Mashing doesn't help: re-pressing within about 0.6 s of the last stance shrinks the window by a quarter, down to half. The stance can also hover you briefly once per jump.

**Tether.** Fires an electric line at the cursor. Each shot costs 15 shield, so the shield is both armour and fuel; a tether strike that connects refunds it, and a shot at a pulse grenade is free. It never pulls enemies.

- Tap on an enemy or terrain: fling yourself toward it.
- Hold: zip to the target. Arriving at an enemy lands a tether strike and bounces you up. Releasing early slingshots you with your momentum.
- Barrels are grabbed instead: hold to swing them on the line, release to throw them at the cursor. Thrown barrels explode on enemies.
- A pulse grenade in flight is the exception. Hitting it with the tether (the line homes onto a grenade near the cursor) drops into bullet time: the world loses its colour, time runs at a quarter speed, and you reel yourself in feet first and kick it toward the cursor, then backflip off it. The sword stays sheathed, since a blade sets the grenade off. The rebounded grenade curves slightly toward the rival and bursts on contact.
- Tethered enemies take 25% more damage, and a dash slash or counter released while tethered aims straight at the target.

**Health and shield.** The shield (max 100) absorbs damage first and starts refilling after 3 seconds without being hit, with a rising hum when it starts and a chime when it's full. If a hit breaks a shield that had at least 25 left, the overflow is ignored and you get a short invulnerability window; break a sliver and the leftover damage carries into your health. Health comes back from wave clears, the green pickups enemies drop, and counter kills.

**Style.** Hits build a style meter ranked C to SSS. Each move scores differently and repeating the same move earns less, so mixing plunges, ground cuts, tether strikes, counters and returned bolts climbs fastest. The rank multiplies score and ultimate charge (up to 2.5x at SSS), decays when you stop hitting, and loses most of its value when you get hit.

**Plunge.** Damage and radius of the shockwave scale with the fall height. It lands on the first surface below you, platforms included.

**Sawblade ultimate.** Kills fill the meter (brutes count triple, your style rank multiplies it, and the kill count is adjustable). Hold `R` for a second to become a spinning electric saw for 7 seconds: invulnerable, contact damage, unlimited jumps, free tether with no range limit, and left mouse lunges toward the cursor. Holding the tether on an enemy latches the saw onto it until it dies or you let go, with damage that grows every tick. Bosses cap that growth and throw you off after about a second.

**The arena.** Buildings are scenery you run straight through; their roofs and balconies, plus fire escapes, girders, scaffolds and an overpass, are one-way platforms stacked about a double jump apart. Only the two boundary walls are solid, and they can be wall-jumped. Wrecked cars are low enough to step over. Gunners that can't see you for a moment and a half walk to a spot with a clear shot.

**Fair fights.** At most two enemies can wind up a melee attack at once (more at higher attack-frequency settings); the rest hang back until a slot frees up. A star-shaped glint on the weapon marks every melee hit 0.28 s before it lands. Slow motion that triggers within two seconds of the last one is halved, so busy fights don't stutter. While enemies are active, announcements shrink and move to the top of the screen.

## Modes

- **Wave Demo:** six scripted waves, each introducing an enemy that one move answers (shields for parry, armour for plunges, grenades for the tether rebound, snipers for the tether zip), then the rival. Each new enemy type shows a one-line hint the first time it appears. The results screen offers a jump straight into endless.
- **Endless Survival:** waves grow in size and toughness without limit. Every fifth wave is a heavy wave with extra brutes, and every eighth brings the rival back, tougher each time (toggle in settings). Your best wave and score are saved.
  - **Upgrades:** after waves 2, 5, 8 and so on, pick one of three. Each changes how a move works and costs something elsewhere: Arc Conductor (longer, weaker counter lightning), Volt Hook (exploding tether strikes, no refund), Ember Wake (dashes cut, slower recharge), Open Guard (wider parry, no refund), Breaker (heavier finisher, lighter openers), Aftershock (plunge ground waves, weaker impact), Glass Edge (deal and take more), Bloodline (kills heal, slower shield).
  - **Wave modifiers:** from wave 4, about half the regular waves carry one: Elites (gold-outlined, tougher, worth double), Glints Only (no `!` markers), Low Gravity, or Blackout (street lights off).
- **Rival Fight:** straight into the AEGIS-07 fight.
- **Melee Duel:** a test mode for practising the parry, clash and riposte exchange. AEGIS-07 lands, plays the enrage cutscene, and fights its blade-only second phase at full health. Retries skip the cutscene. Winning plays the knockout but doesn't unlock the character.
- **Training:** an anchored dummy with a damage-per-second readout that can swing at you on a timer for parry practice. Pause opens a panel to spawn any enemy or the rival (either phase) in front of you, toggle upgrades and wave modifiers, refill, and charge the ultimate. You can't die.

Enemies:

| Enemy | Behaviour |
| --- | --- |
| Scrapper | Melee rusher with a telegraphed cleaver swing |
| Gunner | Keeps its distance and fires bolts after a visible laser lock |
| Drone | Circles overhead, blinks red, then dives |
| Brute | Heavy, resists knockback, punches and sends ground shockwaves along the floor |
| Shield scrapper | A riot shield blocks hits from the front and turns slowly. Parry its bash or land a heavy on the shield to knock it aside, or dash-slash through to its back |
| Armoured crawler | Low and plated: slashes bounce off. A plunge, ground cut, rubble or explosion cracks it open for a few seconds |
| Grenadier | Lobs a small pulse grenade (no shield lockout). Tether it in flight and kick it back to kill the thrower |
| Rooftop sniper | Perches on high ledges, aims a long red laser, and zips to a new perch when you get close or it loses sight. Hold the tether on it to zip up |

A yellow `!` above an enemy means an attack is winding up; a star glint means the hit is about to land.

### AEGIS-07

A rival cyborg built on the same skeleton, physics and power level as the player. It runs, double jumps, wall jumps, drops through platforms, dashes with invulnerability, and zips to your platform on its own tether.

**Entry.** It arrives in a short cutscene: the street rumbles and cracks, a beacon of energy erupts from the ground to the sky, a dark figure kneels inside it, the beam collapses into AEGIS-07, it stands, and its title card hits over a 2x close-up. Like every cutscene, it can be skipped by holding parry, attack or jump once you've seen it this session. Melee Duel retries and Training spawns skip it.

The fight has two phases and no reinforcements.

**Phase 1 (above half health)**

- **Shield:** while it is up, every attack is deflected. Its own pulse grenade breaks it, and so do three bolts returned into it (parried or slashed back); cracks show on the bubble. Its health can't drop below half until phase 2 starts.
- **Pulse grenade:** it charges an orb in its off hand and previews the arc, then lobs it. The grenade explodes the moment it touches anything: terrain, a platform, a barrel or you. A dashed ring on the ground shows where it will land and how far the blast reaches. If the blast catches you, your shield drops to zero and stays offline for six seconds, which also locks out the parry stance and tether. The only way to send it back is the tether rebound and its kick; slashing it sets it off in your face, and a parry only smothers it.
- **Shield down:** the rival is stunned for about three seconds and takes 30% extra damage. After the stun it fights on unshielded and takes 40% less until the shield returns ten seconds later, so the stun is the payoff. It may dodge a swing while idle or approaching (at most once every 2.5 s) but never out of its own recovery, which is your punish window.
- **Other attacks:** a forearm gun that fires bursts while it moves, a greatblade swing up close, and a visor beam fired while hovering. The beam has angular momentum, so it is slow to change direction once firing.

**Half health.** A shockwave throws you clear and a short cutscene plays (input is locked): letterbox bars, the camera on the rival, its limiter plates popping off, then a 2x close-up as it roars and its visor turns white.

**Phase 2**

- The shield and every ranged attack go offline for good. It moves faster and fights in greatblade combos built from five moves: slash, overhead cleave (with ground shockwaves), rising slash, lunging thrust, and spin.
- Parry one of its swings and the blades clash: a short burst of bullet time drains the colour from the world while it glows cyan, then it holds a guard behind a cyan deflector arc. It also raises guards of its own: sometimes it opens with one and creeps toward you (wait it out and it attacks straight away), it reads heavies as they wind up and blocks about half of them, and after a light lands it sometimes blocks the follow-up. All three are the same guard.
- Any attack you throw into a guard is parried, and it answers with a gold, gap-closing riposte. The riposte's wind-up plays in bullet time at 0.7x: the world goes grey, AEGIS-07 glows gold, a rising tone plays, and a gold ring closes on you. Parry as the ring meets the small inner circle.
- Parry the riposte and it is staggered for about three seconds, taking extra damage.
- The gaps between its combos start long after the enrage and tighten as its health drops.

**Knockout.** The last hit freezes into heavy slow motion in a 2x close-up. Then it staggers, drops to one knee on its blade and collapses face down, with a KNOCKOUT title. Its body stays in the street until the next wave. Any cutscene you've already seen this session can be skipped by holding parry, attack or jump.

Defeating it sets `SaveData.unlocks.aegis`. Its palette, weapon, name and utility slot live in `CHARACTERS` in `js/rival.js`, ready for a character select.

## Settings

- **Enemies:** difficulty presets plus individual sliders for health, damage, speed, count, attack frequency (which also sets how many enemies may attack at once) and wind-up time; max enemies on screen; break length between waves; per-type toggles for all eight enemy types; the endless rival; parry window; kills needed for the ultimate; a practice mode where you can't take damage.
- **Controls:** rebind every action (utility included), choose double-tap or hold to drop through platforms.
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
| `js/utilities.js` | Utility (`F`) registry and Overload |
| `js/enemies.js` | Enemy AI, projectiles, rubble, shockwaves, barrels, pickups |
| `js/rival.js` | AEGIS-07 boss, its cutscenes, pulse grenade, knocked-out husk, and the `CHARACTERS` registry |
| `js/specialists.js` | Shield scrapper, armoured crawler, grenadier and rooftop sniper |
| `js/upgrades.js` | Endless upgrade registry, wave modifiers, Aftershock ground wave |
| `js/training.js` | Training dummy, spawn panel |
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

### Adding a utility

Utilities (the `F` key) are registered the same way in `js/utilities.js`, and each entry in `CHARACTERS` names its own with `utility`:

```js
registerUtility({
  id: 'myutil', name: 'My Utility', hud: 'MYUTIL', desc: '…', cooldown: 8,
  canUse(p) { return true; },  // optional; a refusal plays the denied sound
  use(p) {},                   // fires once per press; set p.utilT for the cast pose
});
```
