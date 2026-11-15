# SlashySlash: full game design and production audit

**Date:** November 14, 2026. **Inspected build:** `d45fd63227317bbd4edfa8499d119d98b7ba3b07`.

**Creator constraints:** solo developer; PC first; likely LAN co-op; no fixed deadline; existing AI subscription budget, with additional asset tools possible. Retain side-view, retro 2D presentation. All current assets are replaceable.

## 1. Recommendation

**Build the proposed game on a fresh Godot 2D foundation. Preserve SlashySlash as a playable combat reference and testing laboratory. Prove a small, polished extraction loop and two-player LAN before expanding the city.**

The current game contains valuable combat ideas. It does not contain the persistent world, inventory, economy, authoring pipeline or multiplayer architecture that the proposed game needs. Adding those systems to this implementation would mean developing much of a game engine and content editor while also redesigning the game. A controlled restart is justified by those structural differences, not by dissatisfaction with the existing art.

Unity 2D is a credible alternative if existing Unity/C# experience or a specific tool demonstrably improves your workflow. Unreal is difficult to justify for this particular solo, predominantly 2D brief unless you already know it well or intentionally move toward 3D environments. An engine does not solve design or content production automatically; the recommendation is conditional on a small playable proof.

The intended game should have a concise identity:

> A solo and cooperative melee extraction action RPG in a ruined vertical city, where expressive combat preserves scarce supplies, deeper expeditions risk valuable equipment, and recovered technology transforms both your character and your base.

The best part of the present game is the relationship between movement and combat. Make that the defining advantage of the extraction game. Collecting and crafting should give players reasons to use that combat, and consequences for how well they perform it.

## 2. What this audit established

Reviewed the source, README, existing planning documents, rendering/audio implementation, persistence and smoke test. Inspected the running title screen, training, movement, attack feedback and a spawned enemy encounter in Chromium. Ran the existing five-mode smoke test through the environment's Chromium adapter and isolated probes against actual combat methods.

This is a design and implementation audit with limited direct interaction. It is **not** a controlled human playtest, a listening review, a production performance benchmark, or a successful engine/network prototype. Balance conclusions are labeled as hypotheses where appropriate. All future numerical targets below are proposals to test.

| Area | Current implementation | Required direction |
|---|---|---|
| Combat | Mixed light/heavy strings, launches, plunges, dash attacks, parry/counter, tether and environmental attacks | Preserve expressive vocabulary; define consistent commitments, resource roles and defense rewards |
| Challenge | Enemy roles and tells, melee attack slots, wave growth, overlapping difficulty multipliers | Authored encounter pressure, readable attack rules, deliberate progression and night threats |
| Progression | Eight temporary endless sidegrades, score records, completion flags and an AEGIS unlock | Persistent character, researched recipes, replaceable equipment, constrained builds and temporary expedition bonuses |
| Characters | Ronin/AEGIS metadata exists, but the player constructor selects Ronin | Build identity through loadouts; avoid making several fully animated characters an initial prerequisite |
| Loot | Health pickups, score and ultimate charge | Equipment instances, materials, cargo capacity, meaningful sources and extraction ownership |
| World | One fixed 2400×440 arena; building facades are scenery | Connected districts, interiors, routes, landmarks, objectives and extraction points |
| Day/night | A blackout wave modifier | Forecast expedition clock, changing ecology, routes, objectives and rewards |
| Base | No infrastructure/economy system | Storage, processing, crafting, power capacity, research and controlled reforging |
| Story | Setting premise and rival staging | Narrative bible, discovery graph, environmental clues, item histories and faction motives |
| Co-op | One global player/input/camera; no network transport | Per-player state and presentation; host-owned simulation, inventory and expedition outcomes |
| Presentation | Procedural pixel skeletons, Canvas2D effects, synthesized WebAudio and sequenced music | Authored sprite/environment/audio assets with shaders, particles and adaptive playback |
| Persistence | Browser local storage for scores/settings/unlocks | Versioned campaign saves, unique item IDs, atomic transactions, recovery and visible save failures |

Key evidence: [run initialization](https://github.com/IanSzymanski/slashyslash/blob/d45fd63227317bbd4edfa8499d119d98b7ba3b07/js/main.js#L42), [save schema](https://github.com/IanSzymanski/slashyslash/blob/d45fd63227317bbd4edfa8499d119d98b7ba3b07/js/settings.js#L88), [level geometry](https://github.com/IanSzymanski/slashyslash/blob/d45fd63227317bbd4edfa8499d119d98b7ba3b07/js/level.js#L5), [health pickups](https://github.com/IanSzymanski/slashyslash/blob/d45fd63227317bbd4edfa8499d119d98b7ba3b07/js/enemies.js#L749), [run upgrades](https://github.com/IanSzymanski/slashyslash/blob/d45fd63227317bbd4edfa8499d119d98b7ba3b07/js/upgrades.js#L6). Absences refer to this inspected repository, not unpublished external work.

## 3. Problems to resolve before adding content

Priorities here concern the redesign sequence; they are not production incident severity ratings.

| Priority | Finding and evidence | Consequence and decision |
|---|---|---|
| First | **Verified defect:** enemy damage setting is unused. Settings 0, 1 and 3 all produced 12 damage and 88 remaining shield in the probe. See [damage method](https://github.com/IanSzymanski/slashyslash/blob/d45fd63227317bbd4edfa8499d119d98b7ba3b07/js/enemies.js#L80). | Difficulty preset comparisons are unreliable. Centralize damage categories and apply multipliers once before tuning. |
| First | **Verified rule inconsistency:** dash respects committed attacks, while parry deletes an active heavy immediately. See [parry input](https://github.com/IanSzymanski/slashyslash/blob/d45fd63227317bbd4edfa8499d119d98b7ba3b07/js/player.js#L734). | Decide an explicit cancel table. Do not preserve accidental bypasses as invisible balance rules. |
| First | **Verified discrepancy:** counter healing is capped per function call; direct kills and individual chain kills call it separately. Replaying those healing calls for three direct plus five chain kills restored 32 HP, exceeding the documented 12. See [counter healing](https://github.com/IanSzymanski/slashyslash/blob/d45fd63227317bbd4edfa8499d119d98b7ba3b07/js/player.js#L927). | Define a per-activation budget. Any extraction sustain model must account for the actual result. |
| First | **Verified architecture conflict:** hitstop, slow motion, cutscenes and blur/pause alter shared simulation/input. See [time control](https://github.com/IanSzymanski/slashyslash/blob/d45fd63227317bbd4edfa8499d119d98b7ba3b07/js/main.js#L93). | Co-op needs separate local presentation and authoritative action timing. A player's visual settings must not change another player's reaction window. |
| Early | **Balance hypothesis:** counter may dominate. It combines 135 direct damage, chain damage, invulnerability, refund, healing and reward generation. A light opener does 14. | Compare counter-led play against varied offense using identical gear. Split defense, sustain and burst roles if one response solves most encounters. Damage numbers alone do not prove dominance. |
| Early | **Verified resource coupling, severity unmeasured:** shield funds both parry and tether, so damage can remove defense and traversal. | Prevent a mistake from disabling the tools needed to recover. Separate basic actions from advanced ability costs. |
| Early | **Extraction mismatch:** free shield recovery, wave healing, counter healing and a seven-second invulnerable ultimate reduce long-term attrition. | Rebuild sustain and escape budgets. Simply adding valuable drops would not create reliable stakes. |
| Early | **Difficulty model risk:** health, count, speed, aggression, wind-up, elites and wave scaling interact. Ranged threats/hazards are not fully covered by melee attack slots. | Budget simultaneous threats and compositions. Night must not multiply every existing difficulty knob again. |
| Early | **Reward mismatch:** style recognizes hit categories and pays mostly score/ultimate charge; exploration naturally breaks it. | Reward skilled defense and conversions; bank encounter performance and cap economic bonuses. |
| Before scale | **Production gap:** new item/world/save/content systems have no existing foundation to extend. | Build these once in the selected engine, behind a functioning extraction slice. |

There are useful safeguards already: input buffers, coyote time, enemy tells, restricted simultaneous melee attacks, training and move-specific enemy answers. Carry these intentions forward. Do not translate every existing tuning value literally.

## 4. The experience to design around

Three loops must reinforce each other:

| Timescale | Player decision | Reward |
|---|---|---|
| Seconds | Read the attack, position, dodge/parry, convert an opening into a combo | Immediate control, spectacle, energy efficiency and reduced damage |
| One expedition | Choose routes and objectives, spend supplies, carry loot, push deeper or extract | Bank equipment/materials/progress, learn the city, accept or avoid greater risk |
| Across expeditions | Choose a build and infrastructure investment, investigate a mystery, prepare for a stronger threat | New capabilities, access, relationships, mastery and visible growth |

Suggested expedition rhythm: a short route can end in 5–10 minutes; an ordinary expedition might take 15–25 minutes; optional bosses or deep routes extend it. These are pacing hypotheses. Never pad an expedition to hit a timer.

An illustrative trip: you need a relay component for the workshop. You leave in daylight with a basic blade, two modules and limited healing. A rooftop route avoids a defended street but exposes you to marksmen. You use a tether approach, dodge a shot, launch a guard and finish through a crawler's armor. A cache contains the component and clues to a sealed clinic. Dusk is approaching. You can leave with the upgrade, or pursue a night-only core while risking both the haul and your equipped gear. Returning turns a specific discovery into a new build option.

That decision is the central test of the game. If extracting is always obvious, resources are irrelevant. If fighting is usually an unnecessary expense, the extraction rules have displaced the intended combat fantasy.

## 5. Combat, skill floor and difficulty ceiling

**Start the character weak in equipment, capacity and options, while keeping the basic controller fully capable.** Dodge, basic parry, useful movement, a satisfying string and a valid answer to common threats should exist immediately. Progression can expand them; it should not sell responsiveness back to the player.

### Combat rules

- Author startup, active frames, recovery, movement, hitboxes and cancel permissions as move data. Presentation follows the combat clock. A frame dropped by rendering must not delete a hit or change a parry window.
- Preserve light/heavy routing, dash attacks, launch/air/ground conversions, tether traversal and environmental attacks. Give each a tactical purpose: approach, control, armor break, damage, escape or resource conversion.
- Prototype separate light/heavy inputs alongside the existing tap/hold system. Lights currently fire on release, with a 150 ms heavy threshold. That may be a deliberate feel choice, but control ambiguity should not supply the difficulty.
- Make action commitments consistent. For example, light recovery allows defensive cancellation; heavy startup permits a short feint; a committed heavy/finisher must complete its dangerous portion. These are proposed rules, not a demand to make every action cancellable.
- Give enemies at least two valid responses, even if one is especially effective. A shield can favor flanking/heavy guard break; it should not make a solo build incapable of progressing.
- Preserve punish windows. An enemy that reads player input needs a visible reaction delay and must not cancel its own promised recovery into a perfect defense.
- Prevent infinite air juggles, repeated proc loops and permanent stagger through bounded rules visible in training. Avoid blanket boss immunity that deletes the interesting parts of builds.

### Resource contract

| Resource | Purpose | Proposed recovery rule |
|---|---|---|
| Health | Expedition attrition; mistakes consume a finite survival budget | Limited medical supplies, base recovery, occasional deliberate field opportunities |
| Shield | Renewable protection against a small number of mistakes | Delayed recharge; does not pay for ordinary parry or necessary route traversal |
| Reactor energy | Empowered attacks, aggressive cancels, utilities and advanced tether effects | Active execution and measured regeneration; basic offense/defense remain usable at zero |
| Dash charges | Short-term movement/defense timing | Predictable cooldown; no unlimited immunity through overlapping states |
| Supplies | Preparation and long-term risk | Crafted or recovered; healing requires an exposed, interruptible action |

This is enough resource complexity initially. Adding a universal stamina bar that repeatedly stops movement and attacks would need a strong reason. Do not add hunger/thirst simply because the game contains scavenging.

Perfect dodge should be a recognized event with a clear near-hit rule, not every ordinary dash. It can grant a brief punish opportunity or energy return. Parry can create stagger or a branching counter. Varied offense converts those openings into efficient kills. None should simultaneously supply the best defense, damage, crowd clear, healing and escape in nearly every situation.

Rework Sawblade before using it in extraction. Strong transformations are welcome; seven seconds of unconditional immunity can become a routine extraction bypass. Prefer a shorter payoff, strong mitigation with readable vulnerabilities, or a scarce activation cost. Extraction interaction must not complete inside unconditional immunity.

### Flashiness that helps the game

Score meaningful events: varied finishers, perfect defense, armor breaks, environmental conversions, air-to-ground routes and cooperative rescues. Limit rewards per enemy/encounter so harmless enemies, summons and healing loops cannot generate infinite value.

Keep style local to an encounter, bank its grade when the encounter ends, and retain clear feedback about why it rose or fell. Exploring, reading a clue or deliberately disengaging should not erase the value of an excellent fight. Strong equipment may kill a weak enemy before a long string; reward efficient execution instead of requiring players to prolong it.

Style should primarily improve combat efficiency and grant a bounded bonus to carried salvage. Do not apply an uncapped multiplier to all permanent XP, rare drops and healing. Cautious survival remains viable, while exceptional execution supports faster, deeper and more profitable expeditions.

### Fair high difficulty

Challenge should come from reading, execution, positioning, resource choices and enemy combinations. Use stable tells and defined attack categories: ordinary/parryable, guard-breaking, and positional hazards requiring relocation. Reinforce categories with shape, motion and sound, not color alone.

The rival's red attack currently bypasses ordinary invulnerability, shield and parry. Such an exception requires unmistakable teaching and a valid response for every loadout. An extraction boss should first test familiar rules, then introduce one new rule with a survivable learning opportunity.

Expand the melee attack-slot idea into an encounter threat budget covering ranged lines, melee commitments, hazards and pursuit per player. Stronger enemies should create harder decisions, not unavoidable overlapping damage. Use advanced combinations and optional challenges for the ceiling. Let a powerful character convincingly dominate earlier daytime areas; do not silently scale every enemy to erase growth.

### Learning and interface

Keep an optional hub practice sequence for movement, a basic string, ordinary defense and the first special attack category. Make the opening daytime objective teach departure, one resource decision and extraction. Its reward should immediately enable a visible workshop or module improvement. A subsequent trip introduces an optional dusk detour. This teaches the complete loop without giving away advanced combo mastery or forcing repeated tutorials after death.

Support rebindable inputs and prompts that follow those bindings. Prototype gamepad aiming/tether selection early if controller support is intended; keyboard/mouse responsiveness does not establish controller quality. Resolve overloaded crouch/slide/drop/plunge inputs deliberately. Keep the map, extraction forecast, supplies and cargo value readable without covering incoming threats. Offer deeper item details at the hub, quick field comparisons, and separate world/UI scaling. A high skill floor should test execution and decisions rather than tiny text or hidden input rules.

## 6. Progression, equipment and customization

Use three clearly separated layers:

1. **Permanent character:** levels, weapon mastery, learned skills, researched recipes and unlocked utilities. Favor modest bounded statistical growth plus meaningful options.
2. **Persistent equipment:** crafted/looted weapons, frame armor and modules stored at the base, with deployed equipment exposed to loss.
3. **Expedition-only effects:** temporary overclocks, field buffs, special tools and short-lived conditions cleared on return or failure.

An initial loadout needs one weapon, one frame, two module slots and one utility. Later depth can come from capacity budgets, weapon families and mutually exclusive specializations. Do not begin with a dozen equipment slots or several overlapping skill trees.

Examples of distinct build directions:

| Build | Behavior | Tradeoff |
|---|---|---|
| Air duelist | Launch, tether redirect, air cancel and plunge conversion | Requires positioning and energy; less comfortable against grounded heavy pressure |
| Breaker | Armor damage, committed finishers and ground shockwaves | Slower recovery; must create safe openings |
| Conductor | Precision parries, marks and controlled chain reactions | Depends on threat reading; limited burst without setup |

These are build identities, not initial classes. They can share a character body and universal controls. Start with a small set of modules that actually changes choices. Aftershock/Breaker-style ideas are better foundations than dozens of interchangeable damage percentages.

Rarity should describe an item's properties and specialization rather than exponential superiority. Show the behavioral change, power band, resource cost and drawback in concise comparisons. Prevent multiplicative damage/crit/cooldown/proc combinations from bypassing every commitment. Provide cheap hub respecs, saved loadouts and a practice room. Favoriting and locking equipment must precede bulk salvage.

Make eventual power feel enormous through reach of capability: access to dangerous districts, mastery of former bosses, powerful interactions and control of once-threatening encounters. Preserve optional deep-night challenges through new behaviors and encounter demands, not an endless staircase of inflated health.

## 7. Extraction, death and recovery

Recommended first prototype: **the character persists; deployed gear and cargo are at risk.** Literal character permadeath is a separate optional ruleset, not the default meaning of “every expedition could be your last.” Erasing the whole character would fight the long-term growth fantasy and make network faults disproportionately costly.

| Outcome/state | Rule |
|---|---|
| Successful extraction | Bank carried loot and expedition rewards; retain equipped gear; commit the result once |
| Death / party wipe | Lose deployed replaceable gear, modules, carried supplies, cargo and unbanked expedition XP |
| Already banked levels, skills, recipes, stash and base | Retained |
| Discovered map knowledge and read lore | Retained; physical quest items still require extraction |
| Re-entry after losing everything deployed | Always-free complete starter kit, with all essential combat/traversal actions; no sale or salvage value |
| Optional objective left unfinished | Partial extraction remains valid and profitable |
| Extraction attempt | Clearly announced exposed interaction; finite threat budget; interrupt rules visible; no immunity bypass |
| Repeated total failure | Immediate playable recovery path; no repair debt or forced idle waiting |

Full equipment loss is a hypothesis to test, not a sacred genre rule. If testers hoard favorite equipment and avoid interesting builds, compare **cargo loss plus bounded equipped-gear repair**. Preserve one clear stakes model. Do not stack full equipment loss, level loss, durability collapse, repair debt and mandatory corpse recovery.

Make replacement predictable: researched recipes, targeted material sources and a usable low-cost craft. Losing a rare roll can hurt without deleting the entire build concept. Do not require hours of trivial farming to attempt the exciting content again.

Show the stakes before departure and the cause of failure afterward. A death recap should identify the attack, whether it was parryable, the player's action state and the lost/banked items. Avoid presenting an incorrect or speculative “you should have dodged” hint.

At least one baseline extraction remains reachable by design. Other exits can exchange distance, exposure, a consumable cost or a faction condition. Telegraph any closure ahead of time. No late random event should silently make every exit impossible.

## 8. Economy and base infrastructure

Every meaningful material should answer “where do I get it?” and “what decision does spending it enable?” Start with three classes:

| Material | Main source | Main use |
|---|---|---|
| Scrap | Common enemies, salvage and unwanted gear | Routine crafting, replacements and basic infrastructure |
| Components | Specific enemy families, faction caches and named objectives | Modules, weapon recipes and facility tiers |
| Unstable cores | Optional elites, bosses and night objectives | Advanced sidegrades, controlled reforging and high-tier research |

Add a separate credit currency only if trading needs it. Do not introduce a different token for every station. Unwanted loot should salvage into purposeful progress. Bosses should reliably advance a signature recipe or goal; optional exceptional rolls can remain uncertain.

| Facility | Meaningful function | Scope |
|---|---|---|
| Storage | Keep several builds, supplies and materials; sort, compare, favorite and batch salvage | Slice |
| Workshop/processor | Turn salvage into known materials; craft a replacement and one meaningful module | Slice; combined station initially |
| Power | Capacity for advanced facilities; choosing what to activate creates a preparation tradeoff | One useful upgrade in slice |
| Research/calibration | Unlock recipes and deliberately alter a property | Expand after core economy works |
| Reforge | Target a property at a known cost, with controlled variance or a guarantee | Later; avoid endless opaque rerolls |
| Medical/training | Restock healing and safely test builds | Basic function early; elaborate facility later |

Power should be a capacity decision, not recurring fuel maintenance that prevents playing. Processing can resolve through clear batches or expedition milestones; real-time waiting is not automatically interesting. Begin with a compact functional hub rather than a free-placement factory simulator.

Evaluate **net** reward, including failed runs:

`expected net value = extraction probability × loot value − failure probability × deployed gear value − consumed supplies`

Illustration only: day at 80% extraction, 100 loot value, 60 risked gear and 15 supplies yields 53 value/run. Night at 40% extraction, 260 loot, 100 risked gear and 30 supplies yields only 14. A 2.6× headline loot multiplier can still be poor compensation. Also compare value per minute, downside variance and the value of unique rewards; this formula is a diagnostic, not a complete player utility model.

Night should have substantially better upside for prepared, skilled players. Day should still support reliable replacement materials, learning, faction goals and specific routes. Avoid forcing night farming for every ordinary upgrade.

Prevent simple economy exploits from the beginning: no free-kit salvage; no unlimited rewards from summoned/extraction enemies; no chest reroll by reopening UI; no repeat rewards from reconnect; no duplicate transactions on crash recovery. Track owned item instances separately from item definitions.

## 9. City, day/night, enemies and factions

Build a sprawling city as a graph of authored districts and interiors with bounded loading/simulation. A huge continuous coordinate plane would add performance and authoring work without guaranteeing exploration. Stable geography gives knowledge value; authored variable patrols, caches, doors and events give repeat visits variation.

Each district needs a landmark, distinctive traversal, a resource identity, enemy composition, a local mystery, a boss or major threat, and a route that changes with knowledge or investment. Long-term candidates include the industrial fringe, commercial roofs, flooded transit and a sealed research core. These are roles for future content, not a requirement to build four zones immediately.

Fast traversal needs deliberate geography. Maintain combat pockets, approach routes, pursuit spaces, shortcuts and extraction exposure. Do not counter mobility by simply placing invisible walls everywhere. A player who learns a safer route should benefit; profitable objectives can still require an exposed interaction or deliberate confrontation.

| Period | Challenge | Reward and purpose |
|---|---|---|
| Day | Readable patrols, known routes and ordinary specialists | Reliable supplies, learning, faction objectives and preparation |
| Dusk | Patrol changes, contested routes, warning signs and growing pursuit | Transitional opportunities and a visible decision to stay or leave |
| Night | New predator behaviors, dangerous faction responses, anomalies and optional bosses | Exclusive targets, rare material concentrations and exceptional optional build rewards |

Choose departure time at the hub without waiting for real-world time. Advance one expedition clock shared by the party. Forecast the time remaining and warn before transitions. Time of day, district depth and local alert are separate variables players should understand.

Night must remain readable. Silhouettes, attack cues and safe response information survive darkness and effects settings. Increase danger through behavior, composition, persistence of pursuit and consequences. Do not just shorten every tell or make enemies invisible.

Enemies should form useful compositions: a frontliner creates pressure, a marksman controls a lane, a support unit changes priorities, a flanker punishes tunnel vision. Give each a resource or faction association so enemies matter to route planning as well as combat. Prefer a few distinct roles over many reskinned stat variants. Bosses test established skills, reward targeted progress and can gate deeper optional routes without unexpectedly trapping every expedition.

Start factions with conflicting goals and observable actions: one restores infrastructure, one salvages or monopolizes it. Their patrols, caches, contracts and access permissions make them tangible. Reputation can change services and routes later. A fully simulated citywide war is outside the first production scope.

## 10. Story and environmental discovery

Create a short narrative bible before producing dozens of logs. It must answer what caused the ruin, why the night is dangerous, what the factions want, how the player returns after death, why recovered technology increases power, and what becoming the strongest costs.

One possible premise, **not established canon**: the city's reconstruction network stores both machine patterns and fragments of human memory. The blackout interrupted it rather than shutting it down. At night, unstable reconstruction cycles reactivate districts and dangerous entities. The player's upgrades use the same technology that caused the disaster, while factions disagree about restoring or destroying it. This links night, loot, reconstruction, infrastructure and identity to one mystery.

Use a discovery chain rather than an encyclopedia dump:

1. A powered cable enters a supposedly abandoned clinic; the environment establishes an inconsistency.
2. A recovered component and a short maintenance record imply that power is being deliberately rerouted.
3. A guarded machine or boss reveals who maintains it and changes the meaning of the evidence.
4. A hub upgrade uses the recovered technology, giving the discovery a mechanical consequence.

Each major revelation should have environmental, item/log and later confirming or conflicting evidence. Essential instructions need redundant delivery; optional interpretation can remain ambiguous. Track discovered facts, not just collected files. Index logs by place and subject; preserve them after death; let players read safely at base. In LAN, reading a long log must not freeze everyone else.

Resolve a small complete mystery in the first district while leaving a larger question open. Complexity should emerge from connected causes, motives and discoveries. A large word count alone will not create it.

## 11. Graphics overhaul and authored asset pipeline

Use authored character animations, tiles, props, effect textures/flipbooks and sound files. Particles and shaders still run in real time, as they do in ordinary engines; their source assets and presets are authored and reusable. That satisfies the requested direction without trying to replace all dynamic effects with prerecorded imagery.

Create an art bible and a polished sample room before generating a city. Fix sprite scale, pixel grid, palette roles, outlines, pivots, animation timing, foreground/background contrast, camera framing and lighting. Compare the current 480×270 presentation with a 640×360 sample at actual gameplay speed. Choose a resolution for readable bodies, weapons and tells; UI can render at a higher resolution.

The overhaul should prioritize:

- Readable key poses, anticipation, impact and recovery; stronger character silhouettes and distinct enemy roles.
- Authored slash/impact/explosion flipbooks, textured particles, debris and material-specific contact effects.
- Restrained bloom, emissive materials, local lights, optional normal maps and small distortion effects.
- Layered environments, interiors, foreground treatment and landmarks with better route readability.
- A protected threat-cue layer. Friendly attacks, enemy danger, loot and scenery need distinguishable visual roles.
- Scalable effects, motion/flash reduction, adjustable UI size and redundant color/shape/audio cues. Low-effects settings retain all necessary information.

More effects are not automatically more polish. Measure whether an enemy tell survives two players attacking in a dark room. Set light/particle/transparency budgets using that scene on target hardware. The current browser inspection showed effective slash silhouettes and atmosphere; its small figures and dense bright attack effects make cue separation a priority for the new art direction. This is a limited visual observation, not a completed readability study.

Customization has a hidden multiplication cost: body animations × weapon families × visible gear × directions. Keep most modules as gameplay changes with limited attachment/emissive variations. Reserve bespoke animation sets for weapon families that change play. Do not promise a unique fully animated appearance for every random stat roll.

**AI workflow:** approved concepts and pose references → precise dimensions/pivots/palette → short generated or assisted animation sequence → manual cleanup and timing → atlas and metadata → engine import → inspect in motion with hitboxes → retain editable masters, provenance and final exports. AI-generated spritesheets frequently need alignment, anatomy, weapon-length, pixel-grid and temporal consistency fixes. Treat generation as part of asset production, not a substitute for it.

Use existing AI access first. A minimal toolchain is Godot plus [Pixelorama](https://orama-interactive.itch.io/pixelorama) or [Aseprite](https://www.aseprite.org/), optional [Krita](https://krita.org/en/) for paintovers, and [Audacity](https://www.audacityteam.org/) for sound editing. Add a new paid tool only when a sample asset proves it saves cleanup/integration work. Keep asset IDs, source files, export settings and rights/source records alongside the project.

## 12. Sound effects and a recreated soundtrack

Replace the synthesized source sounds and current sequenced score. Preserve useful event names and the idea of changing music intensity. The source audit establishes how audio is generated; it does not establish a listening-based quality rating.

Build SFX as curated families: blade whoosh and material impact, armor break, shield hit/break/recovery, dodge/perfect dodge, parry/counter, tether launch/attach/reel/rebound, enemy tells, loot pickup, extraction and machinery. Use a small number of selected variations, no immediate repeats, controlled pitch variation and distinct sonic identities. Punch comes from transient, body, timing and contrast, not uniform loudness or long reverb.

Separate threat cues, player actions, enemies, ambience, UI and music into buses. Limit simultaneous low-priority sounds and duck them for critical tells. Co-op should not double the loudness and hide incoming attacks. Test stereo positioning, offscreen threats, headphones, ordinary speakers and a low dynamic-range preset. Keep visual equivalents for essential audio cues.

Compose a new score around a shared motif and connected district/faction identities. The first slice needs a base cue, exploration/combat layers, a night layer and boss/extraction transitions. Expand into a full soundtrack only after its musical language works in repeated play. Use beat/bar-aligned transitions and state hysteresis so music does not jump every time an enemy enters or leaves range. Exploration needs space and quiet for danger to have impact.

If using generated music/SFX, verify commercial-use/export terms for the chosen service and retain the source record. Edit loops, transients, tails and artifacts. Adaptive stems need compatible tempo, key, length and musical boundaries; unrelated generated songs do not become coherent stems automatically. Keep lossless masters. [REAPER](https://www.reaper.fm/) is an optional arrangement/mixing tool when the soundtrack requires it. No additional AI subscription is assumed necessary by this audit.

## 13. LAN co-op and persistence

**Prove two-player LAN first.** Four players are a later design/performance test. LAN is networked multiplayer; it still requires ownership, synchronization and latency handling. Couch co-op, internet matchmaking, accounts, anti-cheat economy and host migration are separate scopes.

Use a host-authoritative session. The host owns enemies, combat results, drops, interactions, extraction and time. Clients present local movement/actions immediately, reconcile accepted state and interpolate remote actors. Precise defense needs explicit timestamp/validation policy; synchronized transforms alone are insufficient.

For the first version, recommend a **host-owned campaign with campaign-bound character slots and personal inventories**. A guest advances their character in that campaign; those items do not automatically merge into a separate solo save. This is a deliberate portability limitation that avoids cross-machine item transfer and duplicated progression. The same campaign can be played solo. Revisit portable characters only after the core save model is proven.

| Co-op rule | Initial policy |
|---|---|
| Join | Fresh joins at the hub only; reconnecting participants can resume their existing deployed actor during its grace period |
| Loot | Host creates each unique drop once; material bundles allocate by explicit rule; equipment has a clear claim and can be intentionally transferred |
| Progress | Shared campaign objectives/lore; per-character levels/equipment; no last-hit requirement for ordinary participation credit |
| Base | Shared campaign facilities; show costs and prevent simultaneous double spending |
| Downed state | Limited revive opportunity with exposed interaction and a supply cost; no endless revive chain |
| Solo failure | Resolve death through the same expedition loss contract; no mandatory second player |
| Extraction | Individual completion can bank that player's cargo; others explicitly see who remains. An extracted player cannot redeploy, resupply or transfer items into that expedition until everyone resolves |
| Host player extracts | Host process continues until the party finishes; reaching safety is different from closing the session |
| Disconnect | Brief reconnect grace while the authoritative character remains vulnerable in the world; expiry resolves that participant as a failed expedition under the normal loss rules. No safe extraction by unplugging |
| Host failure | Resume from a consistent saved expedition checkpoint; no live migration. A replay window is acceptable for trusted LAN friends |
| UI and feedback | Inventory does not pause the party; ordinary parry/hit feedback is local; shared cinematic transitions require explicit synchronized rules |

Maintain a small explicit save lifecycle: `hub → deployed → resolved(success/failure) → hub`. Save a unique expedition ID, item instance IDs and resolution transaction. Moving gear out of the stash and into the deployed record must be atomic. Completing an extraction twice must produce the same final inventory as completing it once. Track terminal per-player outcomes within the party's active expedition; the party becomes deployable again only when all participants resolve.

Use versioned local saves, temporary-file/atomic replacement, a known-good backup and visible failure reporting. Recovery uses a consistent checkpoint containing both loot/world state and player inventories. Persist that complete checkpoint at each successful individual extraction, and acknowledge banked rewards only after the durable write succeeds. Do not independently restore stale stash and fresh cargo. An ordinary host crash may replay uncommitted field actions since the checkpoint; it must preserve acknowledged extraction outcomes. Backup recovery after storage corruption can lose more recent progress and must say so explicitly. Trusted local saves are not a cheat-proof online economy.

Test disconnect during revive, pickup and extraction; repeated requests; death concurrent with extraction completion; host closure after one player exits; full storage; corrupted save; and a schema migration. These tests matter more to an extraction game than adding another weapon before inventory ownership is reliable.

## 14. Engine choice and architecture

| Option | Fit for this project | Main cost | Decision |
|---|---|---|---|
| Current JavaScript/Canvas2D | Excellent lightweight combat reference | Asset/editor/world/network/save foundations must be added or replaced; current presentation and gameplay are coupled | Retain as laboratory |
| Godot 2D | Dedicated 2D workflow, scenes/resources, shaders/lights, authored audio and LAN networking; no engine license fee | Learn the editor and build the game's action/network/persistence rules | Recommended default |
| Unity 2D + URP | Mature 2D asset workflow, C#, 2D lighting and broad tooling | Package/tool choices and licensing eligibility; fast action networking remains custom work | Choose if expertise/tooling wins the sample implementation |
| Unreal/Paper 2D | Suitable if 3D environments or established Unreal expertise become central | More workflow overhead than this 2D brief needs | Conditional alternative |

Browser technology can use authored assets and GPU shaders. The issue is the cost of moving this particular prototype to a production pipeline, not an inherent inability of JavaScript to make games.

For Godot, begin with typed GDScript unless existing C# proficiency gives a clear advantage. Use Resources for moves, item definitions, modules, loot tables and encounters; scenes for actors/rooms; tilemap layers for districts; audio buses and imported streams. Separate movement/action simulation from animation/rendering and effects. Pin a stable engine version after the sample passes.

Keep boundaries small and explicit: input commands; actor/action state; combat events; local presentation; world/encounters; expedition lifecycle; inventory/persistence; content definitions; LAN transport. Avoid a custom ECS, a general-purpose framework or a backend service unless profiling or a proven requirement demands one.

Carry forward **specifications and learning**: movement traces, timings, enemy roles, tether concept, string grammar, training tools and feedback vocabulary. Reinterpret balance, immunity, resource coupling, rival behavior and style. Replace the wave director, fixed arena, singleton player/camera, localStorage progression and procedural art/audio generation. Most production code will be new.

The old [3D plan](3d-plan.md) concerns a separate 3D lane and its no-asset constraints. It does not govern this new 2D, authored-asset direction.

Official capability/licensing references: [Godot 2D lighting](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html), [Godot multiplayer](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html), [Godot license](https://godotengine.org/license/), [Unity 2D/URP](https://docs.unity.com/en-us/engine/6000.3/manual/unity2d/2d-urp), [Unity networking](https://docs.unity.com/en-us/multiplayer/netcode/netcode), [Unity Personal](https://unity.com/products/unity-personal), [Unreal Paper 2D](https://dev.epicgames.com/documentation/en-us/unreal-engine/2d-in-unreal-engine), [Unreal networking](https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview-for-unreal-engine), [Unreal licensing](https://www.unrealengine.com/license). These establish capabilities and terms, not the subjective ranking. Review distribution terms at release; no pricing forecast is needed for this decision.

## 15. A production plan with gates, not deadlines

No fixed deadline changes scheduling freedom. It does not eliminate maintenance, animation multiplication, integration work or the need to finish a playable loop. Expand when a gate passes, not when a calendar milestone arrives.

| Gate | Deliverable | Evidence required before proceeding |
|---|---|---|
| A. Preserve the reference | Tagged/source-preserved browser build, action/movement measurements, known-rule defect list | A repeatable basis for comparing responsiveness and behavior |
| B. Combat + asset sample | Godot room, one weapon, melee/ranged enemies, authored sprite/effect/SFX samples | Movement feels at least as good; tells remain readable; import/revision is practical |
| C. LAN risk | Two separate PC clients using fast movement, parry and tether | No recurring client-only unavoidable hits, duplicate hits or global feedback pauses |
| D. Expedition + save | Hub, small district, objective, cargo, two exits, death and persistent rewards | Successful and failed trips have correct consequences; crash/reconnect cannot duplicate committed items |
| E. Complete vertical slice | Content list below, final-direction art/audio, day/night and a small story | Testers voluntarily replay, understand deaths and make different push/extract choices |
| F. Production expansion | Next weapon family and district, then broader progression/story | Measured asset throughput and actual content costs support the next addition |

**Complete slice scope:** one hub with stash, combined workshop/processor, training and a power upgrade; one district with three small connected subareas; one weapon with four selectable modules and one utility; four ordinary enemy roles, one elite variant and one optional boss; one main objective and a side opportunity; two exits; three material classes; day/night behavior change; one complete lore mystery; two-player LAN; authored visual/SFX samples and a small adaptive score.

This is the destination of several gates, not the first coding sprint. Gate B is much smaller. If the whole slice is too expensive, reduce its content count while retaining the complete prepare/expedition/extract/invest loop.

Defer a massive city, four-player balancing, many weapon families, multiple fully animated characters, extensive base automation, portable cross-campaign characters, online services and a full soundtrack catalog. These remain possible ambitions; they should not block proving the game.

### Acceptance and playtest plan

| Question | Test and provisional acceptance target |
|---|---|
| Is the floor demanding for the right reasons? | After brief optional training, testers identify required defensive responses and explain most deaths. Separate missed cues, mistaken inputs and bad decisions |
| Does mastery matter? | Compare novice and experienced players on fixed starter gear; experts should use fewer supplies and win harder encounters without one repeated universal answer |
| Is style worth pursuing? | Compare varied offense, parry-focused and cautious play across compositions; each has contexts of value, and no farming loop generates unlimited rewards |
| Is growth meaningful? | Return to the same early encounter with later gear; clear advantage is visible while deeper/night content still demands execution |
| Are stakes productive? | Observe whether players bring and try good equipment, recover from losses, and choose extraction at different times; change the loss model if hoarding dominates |
| Does night justify risk? | Track survival, net reward/minute, gear loss and route choice by skill/build; preserve useful daytime play and substantial prepared-night upside |
| Does the interface support action? | Track time spent sorting, accidental salvage, mistaken comparisons and blocked sightlines; inspect loot while keeping danger legible |
| Does LAN preserve skill? | Test wired/Wi-Fi on two PCs; simulate 10/30/60 ms round-trip delay, jitter and 1–3% loss as exploratory conditions; establish the supported envelope from results |
| Are saves trustworthy? | Fault-test deployment, pickup, extraction and return; repeated completion is idempotent; recovery reports its last consistent checkpoint |
| Does presentation scale? | Target 60 fps on declared minimum hardware in the busiest intended scene; inspect frame-time spikes/percentiles, two-player VFX and audio cue masking |
| Can one creator maintain it? | Replace one animation, add one item and author one room through the intended content workflow; record total cleanup/integration time, not generation time alone |

Record deaths by source/phase, incoming simultaneous threats, resources at death, attacks selected, style events, supplies consumed, extraction time, cargo/gear value, build picks and reward transactions. Start with local logs; a hosted analytics service is unnecessary. Use a small repeatable tester cohort for iteration, and avoid treating a handful of observations as statistical proof.

The immediate next implementation step is **Gate B with early Gate C work**: preserve the browser reference, build the movement/attack/parry/tether sample in Godot with imported assets, and make a second LAN client work before producing the city. Continue expanding the migration when that playable result meets the combat and LAN criteria.

## 16. Verification record and detailed evidence

- Existing smoke test, 90 simulated seconds per mode: demo, endless, boss, duel and training exercised. Its original run reported an external Google Fonts certificate error. A second run fulfilled only the external font stylesheet with empty CSS in a temporary adapter; original gameplay assertions remained unchanged and all five modes passed. No certificate verification was disabled.
- The test uses invincibility, random inputs, forced boss transitions and bounds checks. It does not prove that every wave was cleared, that default difficulty is fair, or that players enjoy it.
- `node docs/audit-combat-probes.cjs` reproduced the damage-setting, committed-parry and counter-healing findings against actual methods with presentation hooks stubbed. It is a logic probe, not a complete combat simulation.
- Native browser inspection established that the current build loads and demonstrated training, attacks and an enemy encounter. It did not provide a formal audio quality review or reliable input-latency measurement.
- No gameplay code or production assets were changed, and no new engine project was created. The deliverables are the audit and its reproducible supporting evidence.

Supporting reviews: [combat findings](audit-combat-notes.md), [systems findings](audit-systems-notes.md), [technology and asset findings](audit-technology-notes.md), [executable combat probes](audit-combat-probes.cjs). The consolidated policies in this document are the recommended baseline where the supporting reviews describe alternatives.
