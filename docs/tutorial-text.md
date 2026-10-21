# Tutorial text (parked)

Instructional and feedback text pulled out of the game so mechanics read through visuals and sound. Kept here for the tutorial. Keys in `{braces}` are the player's current bindings (`hudKey(...)` in code).

## Combat feedback popups

Floating text or announcements that fired on the event itself.

| Event | Text | Where it was |
|---|---|---|
| Player parries | `PARRY` | `Player.doParry` |
| Player parries an Aegis swing (blades lock) | `CLASH` | `Player.doParry` |
| Parry refunds shield | `+15 SHIELD` | `Player.doParry` |
| Empowered counter draw after a parry | `COUNTER` | `Player.startIaido` |
| Player parries a pulse grenade (smothers it) | `BLOCKED` | `PulseGrenade.explode` |
| Grenade kicked back | `REBOUND` | `Player.reboundKick` |
| Aegis parries the player and starts its riposte | `PARRIED`, then `COUNTERED` / `PARRY AS THE RING CLOSES` | `Rival.parryPlayer` |
| Player parries the riposte | `STAGGERED` / `PUNISH IT` | `Rival.stagger` |

## Prompts during play

| Trigger | Title | Line |
|---|---|---|
| Rival grenade bullet time | | `AIM THE KICK` (under the grenade) |
| Aegis stance guard (it waits for you to commit) | | `GUARD - BAIT IT` (over its head) |
| Aegis arrives after its cutscene | `TETHER ITS GRENADE` | `THEN KICK IT BACK INTO AEGIS` |
| Aegis arrives without a cutscene (training, retries) | `AEGIS-07` | `TETHER ITS GRENADE, KICK IT BACK` |
| Player slashes a pulse grenade | `TETHER IT FIRST` | `TETHER THE GRENADE, THEN KICK IT BACK` |
| Aegis shield breaks | `SHIELD DOWN` | `STRIKE NOW` |
| Aegis shield returns | `SHIELD RESTORED` | `TETHER ITS GRENADE, KICK IT BACK` |
| Aegis phase 2 / melee duel starts | `PHASE 2` or `MELEE DUEL` | `PARRY A SWING, THEN PARRY ITS RIPOSTE` |
| Ultimate charged | `ULTIMATE READY` | `HOLD {ultimate}` |
| Glints Only wave modifier | `GLINTS ONLY` | `NO ! MARKERS. WATCH FOR THE GLINT` (now `NO ! MARKERS`) |

## First-encounter enemy cards

Shown the first time each type appeared in a run (`ENEMY_HINTS`), and on every spawn in training.

| Enemy | Title | Line |
|---|---|---|
| shielder | `SHIELD SCRAPPER` | `PARRY ITS BASH, HEAVY-ATTACK THE SHIELD, OR GET BEHIND IT` |
| crawler | `ARMOURED CRAWLER` | `SLASHES BOUNCE OFF. PLUNGE ONTO IT OR GROUND-CUT IT` |
| grenadier | `GRENADIER` | `TETHER ITS GRENADE IN FLIGHT, THEN KICK IT BACK` |
| sniper | `ROOFTOP SNIPER` | `HOLD THE TETHER ON IT TO ZIP UP TO ITS PERCH` |

Settings enemy toggles also carried the answer: `Shield scrappers (parry the bash)`, `Armoured crawlers (plunge or ground cut)`, `Grenadiers (rebound the grenade)`, `Rooftop snipers (tether up)`.

## HUD

Demo controls overlay, first 16 seconds of the wave demo, fading out from 13 s:

```
{left}/{right} MOVE   {jump} JUMP x2   {crouch} SLIDE, x2 DROP   {dash} DASH
{attack} SLASH, HOLD HEAVY   {dash}+{attack} DASH SLASH   {crouch}+{attack} PLUNGE
{sheathe} PARRY   {utility} OVERLOAD   {tether} FLING / ZIP / GRAB   HOLD {ultimate} ULT
```

Ultimate gauge when charged: `HOLD {ultimate} - SAWBLADE` (now `SAWBLADE`).

Boss bar under Aegis's health:

- Phase 1, shielded: `SHIELDED - REBOUND ITS GRENADE OR RETURN 3 BOLTS` (now `SHIELDED`)
- Phase 1, cracked: `SHIELD CRACKED n/3 - RETURN BOLTS OR REBOUND THE GRENADE` (now `SHIELD CRACKED n/3`)
- Phase 2, guarding: `GUARDING - BAIT THE RIPOSTE AND PARRY IT`
- Phase 2, otherwise: `LIMITERS OFF - PARRY, THEN PARRY ITS RIPOSTE`

## Taught by visuals only (no text yet)

- Red flash (AEGIS-07, phase 2): it flashes red and cuts everything on the side it faced. Parrying, jumping and dashing away all fail; dash through it to its back. Escaping leaves Aegis stunned. Gold means parry on the eye flash, red means get behind it.
- Eye glints (AEGIS-07): cyan when it raises a guard, gold before a riposte (parry on the flash), red before the red flash lands.
- Dive bomb: a bracket mark on the street shows where it will land; it turns white when locked.
- Cyan guard right after you parry its riposte: it will parry your counter-slash and go into the red flash.
- Its first parry can answer gold or red: read the colour and ring as it happens.
- Phase-2 eruptions: a glowing spot with a dashed line to the sky means a beam is about to burst there.
- Aegis's shield now needs 8 returned bolts to break, not the 3 the old text below says.

## How to Play tips

The list under the controls table on the How to Play screen.

- Your shield (100) soaks damage first and refills after 3 seconds without being hit; listen for the hum when it starts and the chime when it's full. The parry stance and each tether shot cost 15 shield, so it is armour and fuel at once. A tether strike that lands refunds its cost, and tethering a grenade is free.
- When a healthy shield breaks, the overflow is ignored and you get a moment of invulnerability. Break it with only a sliver left (under 25) and the rest of the hit gets through.
- A yellow ! means an attack is winding up. A star-shaped glint flashes on the weapon just before a melee hit lands: press parry when you see it. A successful parry refunds the shield, and releasing the key fires a counter that chains lightning to nearby enemies. Parried bolts fly back where you aim. A missed parry does nothing and the stance goes on a short cooldown; mashing it shrinks the window. Kills from a counter heal you a little.
- Tap attack for lights, hold it for heavies, and mix them into strings of up to four hits: L H L, H L L H, L L H. Three lights in a row end in a lunge; a heavy third or fourth hit ends in a ground-shaking slam. Heavies stagger brutes and knock riot shields aside, but they're slower and you can't cancel them.
- A dash pressed mid-attack waits a beat, and finishers, heavies and slide attacks can't be cancelled while the blade is out. Presses made a moment early are remembered.
- Only two enemies can wind up a melee attack at once; the rest hang back. New enemy types show a hint the first time they appear: shield scrappers (parry the bash or get behind), armoured crawlers (plunge or ground cut), grenadiers (rebound the grenade) and rooftop snipers (tether up).
- Style: mixing different moves raises your rank (C to SSS), which multiplies score and ultimate charge. Repeating one move earns less, and getting hit costs most of it.
- Click during a dash, or right after one, for a dash slash along the cursor line; hold for a heavier one. Either can lead into a string.
- Click while sliding to bury the blade in the street and spray rubble ahead of you. Hold to dig in and rip it up through an eruption of rock that launches enemies and throws you into the air.
- F fires Overload: a shock ring that interrupts and throws back everything close and burns bolts out of the air. It has a 10 second cooldown, shown next to the parry gauge.
- Plunge from higher up for a wider, harder shockwave. Slashing in the air keeps you aloft.
- Buildings are scenery: run through them and climb their roofs and balconies. Double-tap crouch on a platform to drop through it (holding crouch just crouches).
- The tether never pulls enemies. Tap it to fling yourself at the target, hold it to zip in for a tether strike. It grabs barrels instead: hold to swing them on the line, release to throw at the cursor. Tethered enemies take 25% more damage.
- AEGIS-07 is shielded. It charges a pulse grenade, previews the arc, and lobs it. The grenade explodes the moment it touches anything; the ring on the ground shows the blast. Getting caught knocks your shield out for six seconds. Tether it in flight: time slows, you reel in and kick it toward the cursor. A grenade kicked back into the rival breaks its shield and stuns it, and so do three bolts sent back into it. Parrying a grenade only smothers it, and slashing one sets it off in your face.
- At half health AEGIS-07 blasts you away and enrages. It drops its shield and guns for good and fights in blade combos. When it glows cyan it is guarding: it raises a guard when you parry one of its swings, and sometimes on its own, especially against heavies. Attack into the guard and it counters: the world turns grey, it glows gold and a ring closes on you. Parry as the ring closes to stagger it. Hold parry, attack or jump to skip a cutscene you've seen.
- Endless: every few waves, pick one of three upgrades that change how a move works. From wave 4, some waves add a twist: elites, glints only, low gravity or blackout. Training lets you spawn anything and practise on a dummy; pause opens its panel.
- Kills charge the Sawblade: invulnerable, free tether with no range limit, and slash lunges toward the cursor. Hold the tether on an enemy to grind it with damage that keeps climbing.
