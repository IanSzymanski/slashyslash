# Combat, movement, enemies, difficulty and skill incentives audit

Audited 14 November 2026. This is a source-level design audit of the current JavaScript implementation, plus isolated executable logic probes. It is not a controlled human playtest. Numbers proposed below are starting hypotheses, not measured balance targets. No gameplay code was changed.

## Main conclusion

Keep the movement vocabulary, mixed attack strings, enemy roles, environmental attacks, and the idea of fighting a rival with related capabilities. Rebuild the balance rules and encounter structure around expeditions. The existing game is a useful combat reference; its current sustain, immunity, encounter spawning and reward economy would undermine extraction tension if transplanted unchanged.

The strongest design opportunity is a fast melee extraction action RPG where expert execution preserves scarce expedition resources. A player should want to push deeper because they can play better, and want to extract because their loadout, injuries, bag and route have become consequential. Flashy combat and survival must feed that same decision.

## Verified strengths worth carrying forward

| Existing element | Evidence | Why it matters |
|---|---|---|
| Broad, expressive locomotion | `js/player.js:4`: double jump, coyote time, jump buffer, wall jump, slide, bullet jump, directional dash and tether constants | Strong raw material for routes, vertical districts, shortcuts and mastery. Preserve responsiveness before adding progression. |
| Real attack grammar | `js/player.js:419`: light/heavy strings resolve to rising, crescent and slam attacks; `js/player.js:412`: dash attacks open strings | Builds can alter a coherent vocabulary instead of adding unrelated cooldown buttons. |
| Some commitment and input buffering | `js/player.js:323`: committed attacks delay dash cancellation; `js/player.js:14`: 120 ms buffer | Supports intentional risk and forgiving input recognition. The parry exception below needs a rule decision. |
| Enemies have distinct jobs | `js/specialists.js:2`, `js/enemies.js:149` | Shielders, crawlers, grenadiers, snipers, brutes and drones demand different positioning and responses. This is more valuable than a large roster of health variants. |
| Group-fight fairness exists | `js/enemies.js:15`: melee attack token budget; `js/enemies.js:62`: visual and audio glint | A useful base for an encounter director, though ranged pressure and hazards need a shared budget. |
| Environmental combat is meaningful | `js/player.js:952` and `js/enemies.js:716` | Barrel throws, traversal tether and grenade rebound can turn exploration geometry into combat opportunities. |
| Style discourages immediate repetition | `js/main.js:157`: last eight causes reduce repeated gain; `js/main.js:199`: style increases score and ultimate charge | There is already an incentive hook. It needs to recognize skilled defense and connect safely to extraction rewards. |
| Dedicated practice spaces | `js/training.js`; Training and Duel modes | Keep a risk-free combat lab and boss practice. High stakes require inexpensive opportunities to learn. |

## Priority findings

### P0: Difficulty cannot be calibrated while the damage control is disconnected

Verified implementation defect: difficulty presets and the settings panel expose enemy damage multipliers (`js/settings.js:37`, `js/settings.js:96`), but there are no runtime reads of `S.enemies.damage` in the JavaScript source. `Enemy.dmg()` multiplies the definition only by the wave damage multiplier (`js/enemies.js:80`). `Player.takeHit()` applies Glass Edge and practice rules but no enemy damage setting (`js/player.js:1296`). The rival also uses its wave multiplier directly.

An isolated probe of the actual methods gave identical results for damage settings 0, 1 and 3: scrapper damage 12, player shield 88, health 100. Fix this before using preset comparisons as tuning evidence. Centralize outgoing damage provenance so friendly reflected attacks, environmental damage and enemy attacks do not get accidentally scaled twice.

### P1: The parry can erase attack commitment

Dash respects `committed()` (`js/player.js:324`), but `updateSheathe()` does not test it (`js/player.js:734`), and `tryStance()` immediately deletes any attack (`js/player.js:759`). The actual input-handling method successfully cancelled a heavy at time 0 while its active-window end was 0.21 s.

This is a verified rule inconsistency, although the desired rule is a design decision. An intentionally powerful parry cancel could be valid, but then it should be priced, taught and reflected in weapon balance. Recommended default: all defensive cancels obey explicit action data; light attacks have an early defensive cancel, heavies permit it during an initial feint window or after contact, and long finishers commit. Buffers expire predictably instead of remaining queued through arbitrarily long commitments. Show these windows in training.

### P1: Counter and immunity systems may compress the skill ceiling

The light attack deals 14; a normal heavy opener 30; a parry counter 135 with a 165 px draw and 115 px arc (`js/player.js:27`, `js/player.js:34`, `js/player.js:41`). Its chain hits up to five additional enemies for 55 each (`js/player.js:934`). Most normal enemies have 22–70 HP; a brute has 250 (`js/enemies.js:4`, `js/specialists.js:8`). A successful parry refunds its cost, extends the parry window, grants i-frames and can heal through kills (`js/player.js:790`, `js/player.js:927`). `takeHit()` also ignores ordinary damage for the whole iaido state, including dash slash (`js/player.js:1294`).

The current counter therefore packages defense, burst, crowd clear, sustain, style and ultimate charge into one response. That is a strong hypothesis for a dominant strategy, not proof without comparative playtests. Sawblade adds seven seconds of full immunity, while ordinary kills and style recharge it (`js/ultimates.js:13`, `js/player.js:1291`, `js/main.js:205`). A fully charged ultimate is likely to become a reliable escape ticket unless extraction rules explicitly account for it.

Recommendation: separate the reward roles. Parry creates a precise punish opportunity and limited energy recovery; perfect dodge creates repositioning plus a short offensive opening; varied offense converts those openings into better resources. Give counter branching choices rather than automatic maximum-value crowd damage. Use short, deliberate immunity windows and strong mitigation instead of long unconditional immunity. If an invulnerable transformation remains, it should have a scarce expedition cost, cannot operate extract interactions, and must still expose a meaningful aftermath.

### P1: Resource failures remove the skills needed to recover

Health and shield start at 100, shield regenerates at 38 per second after three seconds without damage (`js/player.js:12`, `js/player.js:111`). Both parry and ordinary tether shots cost 15 shield, and parry is unavailable below that threshold (`js/player.js:751`, `js/player.js:968`). Damage can therefore remove both a defensive response and a signature traversal tool. The rival's shield-disable makes that lockout last six seconds; grenade tether is a sensible explicit exception (`js/player.js:965`).

This can produce a failure spiral for learners, followed by an opposite incentive for skilled players: disengage and wait for free shield recovery. Endless wave clear healing, health drops and counter healing also work against long-term attrition (`js/waves.js:123`, `js/main.js:207`). These behaviors are verified; their severity is a playtest question.

Recommended extraction model: keep health as persistent expedition attrition, shield as a small renewable mistake buffer, and reactor energy as the budget for empowered attacks and utilities. Ordinary dodge, parry and basic route traversal remain usable at low energy. Their advanced versions and aggressive cancels consume energy. Skill earns energy back, not unlimited health. Supply finite, interruptible field healing and a costly safe repair option; avoid adding stamina that simply makes the player stop doing the exciting part of the game.

### P1: Difficulty stacks several independent multipliers and exceptions

Presets simultaneously change health, speed, count, aggression and wind-up (`js/settings.js:37`). Aggression also changes attack-token count with discrete thresholds (`js/enemies.js:17`) and spawn frequency (`js/waves.js:112`). Endless adds growing budget, health and damage, forced brute waves, a periodic boss, and random modifiers (`js/waves.js:50`, `js/waves.js:83`). An elite gets 1.8× health and 1.3× damage (`js/upgrades.js:32`). Ranged attacks and ground shockwaves are not part of the melee-token admission rule; for example, `slamWind` is absent from `MELEE_STATES`.

This is many interacting causes of perceived spikes. Night should not be this same stack multiplied again. Define a district threat budget, cap simultaneous threatening attack lanes per player, and reserve space for elite/specialist/hazard combinations. Budget combinations, visibility and escape routes, not just enemy counts. Use stable recognizable animation timing; raise pressure through behavior, composition, pursuit and consequences. Variant tells must be visibly distinct if timing differs.

### P1: The boss asks for exceptions that are poorly supported as a general combat language

The red peril attack is a 300 px forward zone, bypasses parry, shield and ordinary i-frames, and uses a special body-block rule while winding up (`js/rival.js:333`, `js/rival.js:340`). It deals 45 health damage before wave scaling (`js/rival.js:52`). The player must get behind it, or beyond the zone; routine dodging is not sufficient. Guard follow-ups branch probabilistically (`js/rival.js:185`), and the boss can react directly to an incoming attack state while idle (`js/rival.js:821`).

These can be excellent advanced mechanics if players can read and predict their rules. In an extraction game, a poorly taught exception can destroy a valuable loadout on first contact. Define a small shared vocabulary: ordinary attacks, guard-breaking attacks, and positional danger zones, with distinct silhouette, sound and ground/weapon cues. Every build must retain a valid response. Give read-react AI a visible reaction delay; never cancel a committed punish window. A boss should test the established vocabulary before it adds one new rule.

### P2: Attack input and overloaded controls add an unintended skill tax

Lights trigger on release; a 150 ms hold becomes a heavy (`js/player.js:381`). Crouch also handles slide, drop-through and air plunge (`js/settings.js:12`, `js/player.js:176`, `js/player.js:385`). That supports a compact keyboard layout but introduces ambiguous action intent and release-dependent latency. Default bindings lack gamepad input (`js/input.js`).


Prototype distinct light/heavy actions and a controller-first action map alongside the current scheme. Keep aim direction explicit. Measure mistaken actions, perceived latency and attack queue behavior; do not equate control confusion with a high skill floor. Allow rebinding without breaking tutorial prompts.

### P2: Style recognizes hit categories more than skillful play

`registerHit(d, cause)` ignores damage `d` and grants style per hit cause (`js/main.js:157`). Heavy variants all report `heavy`; perfect ordinary dodges are not scored as separate skill events. Style drops by 60% on damage and starts decaying after only 1.2 s without a hit (`js/main.js:198`, `js/main.js:309`). Weak repeated hits can maintain rank while navigation and good disengagement naturally lose it. Raw item power can also shorten a combo before its variety is expressed.

Use encounter-local style based on meaningful events: perfect dodge, parry, armor break, air-to-ground conversion, environmental kill, rescue, and varied weapon finishers. Give a limited novelty budget per enemy/encounter to prevent farming harmless targets. Suspend the combo between known encounter segments or bank a grade on disengagement; do not require attacking continuously while reading a city or making an extraction decision. Reward reliable control and execution, not merely maximum button variety.

For extraction, style can grant a capped amount of temporary combat energy and improve one recoverable material outcome. Do not multiply every loot roll or permanent XP indefinitely: that produces a runaway advantage and makes cautious play economically wrong. Any rare loot bonus remains carried and losable until extraction. A skilled survival route should still be viable without earning SSS.

### P2: The documented counter-heal cap is not a cap per counter

`counterHeal(kills)` caps each invocation at 12 (`js/player.js:928`). Direct counter kills call it once; each chain kill calls it again separately (`js/player.js:945`). Three direct kills plus five chain kills can restore 32 HP, not a total of 12; Arc Conductor permits more chain targets. The logic probe confirmed 10→42 HP. Decide the actual budget and attach it to the counter activation so presentation and tuning agree.

### P2: Presentation settings currently alter combat timing

`S.visuals.slowmo` controls whether simulation time slows at all (`js/main.js:102`, `js/main.js:115`). Hit-stop similarly freezes simulation (`js/main.js:97`, `js/main.js:260`). Turning an ostensibly visual option off changes real-time response windows. This matters both for fair difficulty comparisons and co-op. Separate essential combat timing from cosmetic animation emphasis. In co-op, ordinary hit-stop and camera effects should be local presentation; any shared time dilation must be an explicit synchronized mechanic rather than triggered by every player's feedback event.

## Recommended combat contract

1. A starter character is weak in capacity, equipment and opportunities, but can dodge, defend, traverse and execute a satisfying basic string immediately. Never sell responsive controls back through a skill tree.
2. Weapon families change reach, tempo, launchers and finishers. A small number of equipped modules changes those moves. Keep the action count legible; build depth comes from interactions, not ten more active keys.
3. Every action has authored startup, active, recovery, cancel, armor, hit and movement data. Animations and effects display that state; they do not secretly define it. Every strong action has a punishable commitment or resource tradeoff.
4. Each enemy has a combat role, a readable vulnerability and at least two viable counters. Resistances and armor create preferred responses without invalidating a solo loadout.
5. Avoid permanent stagger loops, repeated cancel exploits and invulnerable extraction loops. Use per-target crowd-control resistance, bounded procs and clear category rules rather than arbitrary immunity to every interesting ability.
6. Preserve rapid movement in combat. Make expedition routing matter through obstacles, alarms, access choices, extraction exposure and bag capacity rather than simply making the player slow when carrying loot.
7. Test novice and expert cohorts using identical starter gear. Experts should win because they avoid damage, use terrain and create openings; late gear should expand builds and enable deeper areas without deleting threat from all previous content.

An example desired sequence is: read a rooftop marksman, tether to its ledge, perfect-dodge the shot, launch a nearby attacker, redirect into an air string, slam through a crawler's weak point, then choose whether the noise and spent energy justify looting the cache below. Every segment has an execution test and a spatial consequence; the payoff is not just a larger combo number.

## Day, dusk and night as combat rules

Day establishes enemy identities, access routes and telegraphs. Dusk changes patrol density and introduces pursuit or territorial transitions. Night activates new predator behaviors, stronger faction responses, dangerous anomalies and exclusive objectives. Preserve readable silhouettes and cues at all times. Darkness should change what the player knows and risks, not conceal a melee wind-up under black pixels.

Depth, clock and local alert should be visible separate contributors to danger. Give notice before a transition, credible escape routes and predictable extraction alternatives. A failed fight can force an early retreat without every single failure being immediate death. Do not increase enemy level to match the player everywhere; returning to a once-dangerous day district should demonstrate growth, while optional night threats preserve the ceiling.

## Validation required before expanding the game

| Test | What it resolves | Candidate pass condition |
|---|---|---|
| Damage and cancel probes | Whether implemented rules match the tuning model | Settings affect the intended paths exactly once; every weapon action follows the approved cancel table. |
| Starter-kit learning session | Whether high floor means skill rather than hidden rules | After an optional short practice sequence, testers can explain ordinary defense and identify why they took their last hit. Measure failures by input error, unread cue and wrong decision separately. |
| Expert vs novice fixed-gear arena | Whether mastery is rewarded independently of loot | Experts show materially lower damage and supply consumption; no single repeated action dominates across compositions. |
| Counter vs varied-offense trials | Whether parry crowds out other play | Counter is best against its intended threats; aggressive strings, dodge punish and environmental attacks have competitive practical use in other cases. |
| Fixed-seed encounter replay | Whether difficulty spikes are systematic | Record damage source, simultaneous threats, enemy phase, current visibility and available escape directions. Remove combinations with no valid response. |
| Input timing capture | Whether combat feels responsive | Measure press/release to visible feedback on target hardware; investigate long or variable latency and unintended queued actions rather than assuming simulation tick rate guarantees responsiveness. |
| Full day→night expedition | Whether combat supports extraction | Players voluntarily extract at different moments because resources and information differ; neither infinite sustain nor unavoidable attrition decides every run. |
| Two-client stress encounter | Whether co-op retains skill | Test latency/jitter, simultaneous parries, shared bosses, revive pressure and loot ownership; presentation does not pause or obscure the other player's required responses. |

Do not tune percentages using only random-input smoke tests. Such tests are valuable for runtime faults, but do not measure fairness, learning, optimal play, economy or satisfaction.

## Reproduction record

Run `node docs/audit-combat-probes.cjs` from the repository (or invoke the script by absolute path). It loads the unchanged math, settings, enemy and player source into a Node VM with no-op presentation hooks. It invokes actual damage and input-handling methods; it does not simulate rendering, complete encounters or human reaction time.

Observed output:

```text
enemy damage setting 0: computed damage 12, shield 88, HP 100
enemy damage setting 1: computed damage 12, shield 88, HP 100
enemy damage setting 3: computed damage 12, shield 88, HP 100
heavy commitment before parry: true
attack after parry input: null
parry stance active: true; shield remaining: 85
counter healing, 3 direct + 5 chain kills: 32 HP restored (10 -> 42)
```

The first is a disconnected setting. The second and third are verified behavior that needs an explicit design decision and corrected documentation/budget. None has been fixed as part of this audit.
