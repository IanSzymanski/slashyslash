# SlashySlash

A 2D side-scrolling action demo: a small cyborg with a red katana, fast Warframe-style movement, and an electric tether, fighting scrap gangs, a rival cyborg and a molten brawler in a ruined city and a forge hall. Pixel art, sound effects and music are all generated in code, so there are no asset files.

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

**Strings.** Tapping attack throws a light, holding it for 0.15 s throws a heavy: the blade draws back over your shoulder while you hold, flashes red when it commits, then lands slower and harder. A string runs up to four hits and you can mix the two freely (L H L, H L L H, L L H...). Three lights in a row, or a light fourth hit, end in the wide lunging finisher. A heavy that opens a string is a rising slash that launches; a heavy second hit is a wide crescent with big knockback; a heavy third or fourth hit is a slam that sends a ground wave each way and ends the string. Heavies knock a shield scrapper's shield aside, but they don't stagger scrappers or brutes: those keep swinging through them. Swings follow the cursor, keep you aloft when they connect in the air, and deflect enemy bolts. Lights fire when you release the button, so a quick tap is the snappiest.

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

- **Wave Demo:** six scripted waves, each introducing an enemy that one move answers (shields for parry, armour for plunges, grenades for the tether rebound, snipers for the tether zip), then the rival. The results screen offers a jump straight into endless.
- **Endless Survival:** waves grow in size and toughness without limit. Every fifth wave is a heavy wave with extra brutes. It travels between two regions: wave 8 in the city is the rival; when it falls a portal opens (an arrow at the screen's edge points to it), and stepping through takes the run to the Foundry, with score, wave count, upgrades, health, shield and the ultimate's charge carried over. Three waves there, then KRAG; when KRAG falls a portal opens back to the city, where after three waves the rival comes again, and so on round, the bosses tougher each time (a toggle in settings turns the bosses off; the portal still opens after each region's last wave). Your best wave and score are saved.
  - **Upgrades:** after waves 2, 5, 8 and so on, pick one of three. Each changes how a move works and costs something elsewhere: Arc Conductor (longer, weaker counter lightning), Volt Hook (exploding tether strikes, no refund), Ember Wake (dashes cut, slower recharge), Open Guard (wider parry, no refund), Breaker (heavier finisher, lighter openers), Aftershock (plunge ground waves, weaker impact), Glass Edge (deal and take more), Bloodline (kills heal, slower shield).
  - **Wave modifiers:** from wave 4, about half the regular waves carry one: Elites (gold-outlined, tougher, worth double), Glints Only (no `!` markers), Low Gravity, or Blackout (street lights off).
- **Rival Fight:** straight into the AEGIS-07 fight.
- **KRAG Fight:** straight into the KRAG fight, in the Foundry.
- **Melee Duel:** a test mode for practising the parry, clash and riposte exchange. AEGIS-07 lands, plays the enrage cutscene, and fights its blade-only second phase at full health. Retries skip the cutscene. Winning plays the knockout but doesn't unlock the character.
- **Training:** an anchored dummy with a damage-per-second readout that can swing at you on a timer for parry practice. Pause opens a panel to spawn any enemy, the rival (either phase) or KRAG (cold, or a moment from full heat) in front of you, toggle upgrades and wave modifiers, refill, and charge the ultimate. You can't die.

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

- **Shield:** while it is up, every attack is deflected. Its own pulse grenade breaks it, and so do eight bolts returned into it (parried or slashed back); cracks show on the bubble. Its health can't drop below half until phase 2 starts.
- **Pulse grenade:** it charges an orb in its off hand and previews the arc, then lobs it. The grenade explodes the moment it touches anything: terrain, a platform, a barrel or you. A dashed ring on the ground shows where it will land and how far the blast reaches. If the blast catches you, your shield drops to zero and stays offline for six seconds, which also locks out the parry stance and tether. The only way to send it back is the tether rebound and its kick; slashing it sets it off in your face, and a parry only smothers it.
- **Shield down:** the rival is stunned for about three seconds and takes 30% extra damage. After the stun it fights on unshielded and takes 40% less until the shield returns ten seconds later, so the stun is the payoff. It may dodge a swing while idle or approaching (at most once every 2.5 s) but never out of its own recovery, which is your punish window.
- **Other attacks:** a forearm gun that fires bursts while it moves, a greatblade swing up close, and a visor beam fired while hovering. The beam has angular momentum, so it is slow to change direction once firing.

**Half health.** A shockwave throws you clear and a short cutscene plays (input is locked): letterbox bars, the camera on the rival, its limiter plates popping off, then a 2x close-up as it roars and its visor turns white.

**Phase 2**

- The shield and every ranged attack go offline for good. It moves faster and fights in greatblade combos built from five moves: slash, overhead cleave (with ground shockwaves), rising slash, lunging thrust, and spin.
- **Closing the gap.** Out of reach it walks or dashes in, or picks one of two gap closers. The blade wave is a wide crescent of energy thrown off a full swing that runs along the street: jump it, dash through it, or parry it back (a slash passes straight through it, and dashing away doesn't outrun it). Sometimes it follows with a second wave thrown from a jump, which flies at head height: jump the low one and stay on the ground for the high one, since jumping both runs you into the second. The dive bomb starts with a crouch and an eye glint, leaps high over you and hangs with the blade raised while a bracket mark on the street tracks you, then locks (it turns white and a dotted line runs to it) and the rival dives onto it, cracking the street with a shockwave each way. Its landing is a punish window.
- **Tells come from its eye.** Nothing draws a ring around either fighter: every guard, riposte and red flash is announced by a quick star glint from its visor, cyan, gold or red. When it's stunned, gold sparks circle its head.
- Parry one of its swings and the blades clash: a short burst of bullet time drains the colour from the world, its eye glints cyan, and it holds a guard (its visor stays lit while it does). It also raises guards of its own: sometimes it opens with one and creeps toward you (wait it out and it attacks straight away), it reads heavies as they wind up and blocks about half of them, and after a light lands it sometimes blocks the follow-up. All three are the same guard.
- **Eruptions.** The melee phase opens with the street erupting for 12 seconds: a pair to open, then one every 2 to 3 s, always at least 60 px from you and never more than three standing. Each spot glows and throws a dashed line up to the sky for 0.8 s, then bursts into a column of energy (the entry beacon's beam) that holds for 2.6 s. The column runs from the street to the sky and can't be parried; step or dash clear.
- Any attack you throw into a guard is parried, and it usually answers with a gold, gap-closing riposte (sometimes, 25% rising to 40%, it goes straight to the red flash below). The riposte's wind-up plays in bullet time at 0.7x (that speed overrides any slow motion already running, so the timing never changes): the world goes grey, AEGIS-07 glows gold, its eye gleams brighter as a rising tone climbs, and then its eye flashes gold. Parry when it flashes: the blow lands 0.39 s later, at the end of its lunge, and a parry pressed 0.13 to 0.33 s after the flash catches it.
- Parry the riposte and it is usually staggered for about three seconds, taking extra damage. Sometimes (30% rising to 55% as its health drops, 15% right after it last did it) it recovers into the cyan guard instead and parries your counter-slash back at contact.
- **Red flash.** A red answer to your attack, or that parry-back, is its most devastating blow: its body flashes red, the wind-up plays in the same 0.7x bullet time with it glowing red, and its eye flashes red as it lands. It doesn't lunge: it locks onto the side it faced when it flashed and cuts everything on that side out to 300 px, high and low, for 45 damage straight through your shield and a launching knockback. Parrying, jumping, dashing away and dash i-frames all fail. The only escape is to dash through it to its back; while it winds up its body blocks you, so walking or a dash that ends inside it leaves you in front. Get behind it and the swing whiffs, leaving it stunned for about two and a half seconds. In `Player.takeHit`, `unparryable` skips the parry, `through` ignores i-frames and `pierce` skips the shield.
- The gaps between its combos start long after the enrage and tighten as its health drops.

**Knockout.** The last hit freezes into heavy slow motion in a 2x close-up. Then it staggers, drops to one knee on its blade and collapses face down, with a KNOCKOUT title. Its body stays in the street until the next wave. Any cutscene you've already seen this session can be skipped by holding parry, attack or jump.

Defeating it sets `SaveData.unlocks.aegis`. Its palette, weapon, name and utility slot live in `CHARACTERS` in `js/rival.js`, ready for a character select.

### KRAG, the Molten Fist

The second boss, ported from the 3D version (`slashyslash2`) with the same rules and timings. A hulking cyborg about one and a half times your height, built of rust-brown stone blocks with molten seams glowing between them, a small dark helmet sunk between its shoulders with three glowing slits, a core burning in its chest, and an onyx left arm: a great spiked pauldron, spikes down the forearm, and a fist as wide as its chest with its plates glowing between the knuckles. A mohawk of flame rises off its crest. It has 1,500 health (the rival has 900), never dodges, never backs off, and nothing you hit it with interrupts what it's doing. Everywhere it walks it leaves smouldering footprints, and every footfall shakes the street.

**Heat.** It runs hot, shown only on its body: the seams go from dull red through orange to white, steam pours off it, embers drift off it and the mohawk grows. Heat builds from fighting (about 2 a second), a little with every blow it throws, and most from blows it lands on you (10) or that you parry (6) and from its stomps. At full heat the mohawk tears up off its head with an orange pulse and a roar. Only then can it throw the Molten Fist; throwing it, or having its arm go off, takes it back to cold.

**The arm.** The onyx arm's durability is separate, also shown only on its body. Blows on its guard wear it: the plates go ashen, fractures split open glowing dull red, then orange to white, it smokes and sheds chips, and a blocked blow goes from a solid clang to cracking and splintering. Then it breaks: the guard shatters (4% of its health), it reels, and it can't guard for 8 s before the arm re-forms half worn. Left alone for 4 s, a worn arm mends.

**Strings.** Up close it fights in fast strings of jabs, crosses, hooks, elbows, knees and kicks, stepping in after you if you get out of reach. A parry doesn't stop a string blow: you take no damage, but you're shoved back, lose 6 shield and get no counter. Dodge them. Their only tell is a flick of embers and a grunt. Each string ends on a stopper (a haymaker, an uppercut, a hammer fist with a shockwave, a spinning backfist, a flying knee), which is gold from the start of its longer wind-up: a gold outline, gold fire round the limb, gold rings closing on its feet, a deep gong, then a big gold glint and a bell. Parry that and it's knocked off balance and your counter charges.

**The guard.** It only blocks when you're a threat at range (holding a counter ready, a crucible or barrel thrown at it, your tether on it, ranged hits landing) or right after you've staggered it. A blue flash off the arm comes first; blows still land in full until the arm is up. Then blows from the front do 15% and wear the arm; it turns slowly, so you can get round it, and if you crowd it in front it shoves you off. At full heat the arm is a liability, so it only guards on instinct after a stagger, or against something big (and not always): the arm glows white and crackles. Hit it then and all its heat goes off in its face: 12% of its health, a blast that throws it on its back, and a 3.4 s stun, its only one. The classic bait: parry a stopper at full heat and hold the counter, so it lands on the guard it raises.

**The Molten Fist** is its red flash: no parry. It draws the arm far back in bullet time inside a red shell while the street splits red under it, and the street it will split is marked in red from its feet a long way ahead (at least 290 px, and 150 px past where you stood), running down off any ledge onto the ground below. It tracks you for the first half of the wind-up; then its visor flashes red and the line holds, and just before the blow it flashes white. Dash protection doesn't save you, it's too long to outrun, and dropping a level doesn't help. Get behind it (its body is a wall while it winds up: dash through it, or jump over its head) or get well above it. It hits for 55 straight to health, throws you and leaves you dazed for 1.5 s (sparks circle your head and nothing you press does anything). The chasm then glows for about four seconds, erupting in vents (never right under you while you're dazed), and seals all at once in a hiss of steam. A miss leaves it hunched over the smoking arm for 1.9 s.

**Getting to you.** Shoulder charges (the pauldron dropped, a gold glint, then a drive at you that tears a furrow and explodes on contact or against a wall; parry it), stomps (a foot hauled up and driven down, glowing cracks splitting out at you, a shockwave each way and molten vents raised along the street, three in a row more often as it rages), and from far off a leap onto where you're heading (a ring and cross on the street blinking faster as it falls) or its chain: it bites into something high (a girder, a gantry, a lamp's head), swings out under it like a pendulum, feet dragging sparks, and lets go on the upswing to fling itself at you, gold-glinting before it lands with a blast, shockwaves and vents. A molten vent is a glowing crack that bubbles and pulses faster, then bursts into a column of fire that throws you into the air.

**Cutscenes.** It arrives out of the ground: the street quakes and splits in glowing cracks, fire spits out of them, then the street bursts and it's thrown up out of it, lands in a crouch with a blast, stands steaming as its mohawk catches, roars, and its title hits (FOUNDRY FRAME, THE MOLTEN FIST) as it beats its fist into its palm. The last hit freezes into slow motion: it staggers, vents, drops to one knee with the fist planted and falls on its face as its fire goes out. Its husk smokes in the street until the next wave.

### The Foundry

The second region, KRAG's: a forge hall under an open roof of trusses, with embers rising instead of rain and sodium work lamps instead of street lamps (a Blackout puts the lamps out; the molten metal still glows).

- **The molten river.** The blast furnace at the west end pours molten iron from its tap into a trench that runs along the floor to a drain, crossed by three grated bridges. Anything that falls in is burned and thrown back out onto the nearer bank: you take a little (14), an enemy you knock in takes a lot (42, worth style), a crucible bursts, KRAG just climbs out. Enemies leap the molten gaps rather than walk in. The furnace has catwalks up its face, and a walkway crosses over the river.
- **Ladles.** Two gantry cranes each hang a ladle of molten metal. Hit one (a jumping slash reaches it, as does a blast under it) or yank it on the tether, and it tips toward the side the blow came from and pours: the stream burns whatever is under it (48 to an enemy, 18 to you) and spreads into a pool of slag that burns whatever stands in it. It hangs empty until the next wave fills it.
- **Crucibles** of slag stand where the city has red barrels: they light, throw and burst the same way, but leave a pool of slag.
- **Conveyors** under the second gantry run opposite ways and carry whatever stands on them. Around them: an ore hopper, ingots, a scrap heap, casting molds with metal cooling in them, a hydraulic press whose crosshead you can stand on, and a storage rack stepping up to a catwalk. A rolling mill's flywheel and gears turn on the back wall.

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
| `js/level.js` | Region loading, city geometry, body physics, prerendered parallax layers |
| `js/foundry.js` | The Foundry region (layout, painting, molten river, conveyors), crucibles, ladles, slag pours and pools, and the portals between regions |
| `js/sprites.js` | Skeleton IK helpers and outlined sprite compositing |
| `js/player.js` | Movement, combat, parry, tether, shield and the player rig |
| `js/ultimates.js` | Ultimate ability registry and the Sawblade |
| `js/utilities.js` | Utility (`F`) registry and Overload |
| `js/enemies.js` | Enemy AI, projectiles, rubble, shockwaves, barrels, pickups |
| `js/rival.js` | AEGIS-07 boss, its cutscenes, pulse grenade, knocked-out husk, and the `CHARACTERS` registry |
| `js/krag.js` | KRAG boss: heat, the onyx arm, strings and stoppers, the guard and its detonation, the Molten Fist and its chasm, vents, charge, leap, chain swing, its sprite, cutscenes and husk, and its glowing marks on the street |
| `js/specialists.js` | Shield scrapper, armoured crawler, grenadier and rooftop sniper |
| `js/upgrades.js` | Endless upgrade registry, wave modifiers, Aftershock ground wave |
| `js/training.js` | Training dummy, spawn panel |
| `js/waves.js` | Demo waves, endless wave generation and region travel, boss waves |
| `js/render.js` | Frame composition, lighting, weather, HUD |
| `js/ui.js` | Menus, results screen and settings panel |
| `js/main.js` | Game state, fixed 120 Hz simulation, camera, cutscene and bullet-time state, main loop |
| `docs/tutorial-text.md` | Hint and prompt text taken out of the game, kept for the tutorial |

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
