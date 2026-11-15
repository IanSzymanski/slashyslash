# Systems audit notes: progression, expeditions, world and co-op

Audit date: 2026-11-14. These notes are a source inspection and design recommendation, not measured playtest results. Line references describe the inspected repository. Proposed numbers are prototype hypotheses. Scope assumes the existing side-view 2D combat remains the camera/movement foundation. The user clarified: sole creator, PC first, likely LAN co-op, no deadline, and current AI subscriptions plus optional AI asset tools as the budget. Recommend two-player LAN first; four-player support is a later validation gate. This does not require accounts, matchmaking, cloud services or an always-online economy.

## Current implementation: evidence and implications

| Area | Verified implementation | Implication for the proposed game |
|---|---|---|
| Persistent progression | `js/settings.js:88-91` saves best wave, best score, demo clear, boss kill count and one AEGIS unlock in local storage. `js/util.js:277-278` suppresses storage errors. | No persistent character levels, equipment, inventory, recipes, base state or extraction ledger. A silent failed save is unacceptable once hours of gear are at stake. |
| Run lifecycle | `js/main.js:42-64` constructs a new player, clears entities, resets all statistics and clears upgrades every run. `js/main.js:209-229` ends a run and saves score records. | Run loss currently costs a score attempt. An extraction lifecycle is a new system, not a menu addition. |
| Character selection | `js/rival.js:23-24` defines Ronin and AEGIS metadata; `js/player.js:67` always sets `charId = 'ronin'`. `js/ui.js:98` calls the unlock a future roster. | There is a character registry seed, not a completed multi-character progression system. |
| Equipment/customization | `js/upgrades.js:6-16` has eight run sidegrades; `js/upgrades.js:25-30` offers three unowned choices every three waves starting at wave two. `js/main.js:58` clears them on restart. | These are useful examples of build-altering tradeoffs. They are neither dropped items nor a persistent build system. With eight total, the pool eventually exhausts. |
| Loot | `js/main.js:203-207` gives score, ultimate charge, optional kill healing and HP pickups. `js/enemies.js:749-774` implements a +15 HP pickup that expires after 14 seconds. | No cargo value, rarity, item ownership, item inspection, crafting ingredients or risk of losing inventory. |
| Economy | `js/waves.js:117-132` grants wave score and 15 HP, then a break. | The arena replenishes survival. There is no economy of extraction, preparation or long-term resource sinks. |
| City | `js/level.js:5-70` defines one 2400 by 440 arena with fixed geometry. Buildings are scenery, roofs are one-way platforms (`:18-19`). | Strong visual premise but no district graph, interiors, points of interest, route choice, streaming, world persistence or extraction sites. |
| Encounters | `js/waves.js:50-74` raises enemy budget, HP and damage by wave. `:144-163` spawns around the player using fixed spawn points. | Good arena prototype. A roaming city needs authored encounter placement, patrol territories, pursuit limits and local encounter budgets. |
| Time of day | `js/upgrades.js:18-23` has a per-wave blackout modifier; `js/waves.js:83` randomly selects modifiers. | Blackout is not a persistent day/night clock or a risk/reward contract. |
| Story | Rival introduction, enrage and defeat sequences exist in `js/rival.js`; `js/main.js:131-147` provides cutscene and session skip state. | Some dramatic staging can inform a new story. No quest, codex, item-text, faction relationship or narrative discovery framework was found in source. |
| Co-op | One `Game.player` and one camera (`js/main.js:14-15`), one global input (`js/input.js:4-15`), one player update (`js/main.js:282`), global hitstop/slow motion (`js/main.js:97-120`), pause (`:71-84`) and input-locking cutscenes (`:131-147`). No network transport or replicated entity ownership found. | Co-op requires architectural and rules changes. It cannot safely be bolted on after the campaign. |
| Simulation | Fixed 120 Hz tick (`js/main.js:262-265`), but gameplay and presentation both consume global `Math.random` (`js/util.js:11-14`, `js/waves.js:66-71`, `js/render.js:135`). | A fixed tick is useful, but does not make this implementation deterministic, replay-safe or network-ready. |

Source-wide searches and the repository file inventory support the listed absences; they do not prove that an external unpublished branch lacks those systems. `docs/3d-plan.md` describes a separate 3D direction and should not be treated as current shipped implementation or override the user's 2D request.

## Product direction

Build a PvE extraction action RPG whose risk comes from what the player chooses to carry, where they choose to go, and whether they can execute under pressure. The permanent character is the player's investment; expeditions risk the current loadout and haul. Treat literal character permadeath as a later optional ruleset, not the default: erasing permanent mastery after a network failure or one misunderstood attack conflicts with the requested growth from weak to powerful.

The design must reconcile three tensions explicitly:

1. **Extraction encourages caution; style combat encourages risk.** Reward varied, well-executed aggression with immediate combat efficiency and bounded bonus salvage. Do not make basic economic viability depend on maintaining SSS or encourage keeping weak enemies alive to farm meter.
2. **Permanent power can erase a high skill ceiling.** Give meaningful but bounded stat growth, broad horizontal build growth, and stable enemy tells. Let veterans dominate earlier districts. Reserve new patterns, encounters and optional challenge conditions for dangerous districts and night; avoid scaling every enemy to the character forever.
3. **Gear loss can punish experimentation.** Preserve learned moves, recipes, map knowledge and base unlocks; provide an immediately available, low-value starter loadout with the complete essential defensive toolkit. A lost weapon must not delete the ability to dodge or parry.

## Recommended expedition contract

**Prepare → choose departure and objective → infiltrate → explore/fight/loot → decide whether to push deeper → reach and complete extraction → process, equip and invest → repeat.**

A first playable expedition should take roughly 15–25 minutes with an early extraction option. This is a design hypothesis to test, not a commitment to pad traversal. A player with a small valuable haul must be able to leave after 5–10 minutes; a boss detour should be a deliberate extension.

Before departure show the district, time until dusk/dawn, known extraction options, expected threats, one chosen objective and the replacement value of equipped gear. These are decisions, not a wall of percentages. Discovery can reveal optional objectives and alternate routes during the run.

During the expedition:

- The layout and landmarks remain legible across visits. Patrols, caches, power states and events vary within authored constraints.
- Loot has a physical location and a clear source. Common materials can be collected quickly; equipment needs a short inspect/swap interaction with readable comparisons. Never require a complex inventory puzzle while an attack is hidden behind the UI.
- At least one baseline extraction route is guaranteed to remain attainable. Additional exits offer different costs: a quieter long walk, a defended lift, or a short exposed signal activation. A boss must not unexpectedly disable every escape.
- Extracting begins an explicit exposed action. Damage or moving out of the extraction zone can interrupt it, with progress behavior stated consistently. The extraction challenge uses finite encounter budgets; it must not generate unlimited rewards.
- The player can leave without completing the selected objective. A partial successful trip is still a success.

Recommended loss rules for the first prototype:

| State | Survives failed extraction? | Reason |
|---|---|---|
| Character level, learned moves, allocated permanent skills | Yes | Preserves mastery and long-term identity. |
| Recipes already researched, unlocked base facilities, discovered map and recorded lore | Yes | Knowledge is the durable progression layer. |
| Stashed equipment and materials | Yes | Gives preparation meaning. |
| Equipped replaceable gear and modules | No | Makes the loadout an explicit stake. |
| Expedition cargo, unbanked XP/material rewards and unused carried consumables | No | Creates the extraction decision. |
| Free starter kit with essential movement/defense | Always available, non-saleable and non-salvageable | Prevents bankruptcy and mandatory low-level chores after repeated failure. |
| One-time story knowledge discovered in the field | Immediately recorded; physical quest cargo still requires extraction | Death should not force repeated log reading. |

Before development, validate this full-loadout-loss policy against a softer alternative in player tests. If players hoard their favorite builds, switch to guaranteed recovery of equipped gear with a bounded repair cost while retaining loss of cargo and consumables. Do not stack full gear loss, XP loss, durability decay, repair debt and a corpse run simultaneously. High stakes need clarity, not many overlapping punishments.

Do not add corpse recovery or insurance to the first slice: they can soften loss but introduce more rules, duplication paths and repeat-trip obligation before the basic risk feels fair.

## Progression and customization model

Use three distinct clocks:

1. **Permanent character growth:** small level-based stat increases, weapon-family proficiency, skill nodes and utility unlocks. Earn progress from successful objectives and extracted combat data, with explicit caps or diminishing returns for repeated trivial encounters.
2. **Persistent gear/build growth:** weapons, armor, modules, quality upgrades and recipes kept in the base. A few equipment slots with substantial interactions beat many slots of fractional stat changes.
3. **Expedition-only changes:** scarce temporary overclocks, buffs, injuries or carried tools, all cleared on return or failure.

Proposed initial loadout: one main weapon, one frame/armor piece, two module slots and one utility. Keep dodge, basic parry and traversal universal. The first two weapon families should differ in reach, commitment, air control and combo routing, rather than simply attack speed and damage. The current endless upgrades are candidates for module prototypes: Aftershock and Breaker show recognizable behavioral changes; Open Guard's defense tradeoff needs care because it taxes a survival mechanic.

Module capacity is a budget, not unlimited slot accumulation. A module can add an air cancel or convert a launcher into a ground-wave route; it should also consume capacity or impose a concrete tradeoff. Avoid a single best damage multiplier that every build must equip. Store build presets in the hub and allow inexpensive respecs there so customization remains experimentation.

Rarity should signal the number or specificity of interesting properties, not exponential superiority. Keep item comparison short: damage/defense band, behavioral modifier, resource cost and drawback. A lower-rarity item with the desired move property can remain useful. Give bosses predictable access to a signature recipe and variable bonus rolls, avoiding rare mandatory progression drops.

The player should start weak in damage, protection, supplies and options—not in input responsiveness or access to the basic dodge. Establish explicit power bands. Early equipment might require several clean openings on an ordinary enemy; advanced equipment can clear that same enemy quickly while advanced zones still demand execution. Do not silently raise the old district's numbers to cancel progression.

## Resource economy and infrastructure

Keep tactical and expedition resources separate. A regenerating combat resource can support expressive moves while limited medical supplies and cargo capacity govern expedition attrition. Waiting behind a wall should not replenish all long-term survival costs. Avoid hunger, thirst, dozens of ores or mobile-style processing timers unless testing identifies a concrete gameplay need.

Start with three material classes:

| Material | Sources | Sinks | Decision supported |
|---|---|---|---|
| Common scrap | Ordinary enemies, salvage, unwanted gear | Starter upgrades, routine crafting, replacement gear | Spend now to improve the next attempt, or save for a facility? |
| Specialized components | Named enemy families, district caches, objectives | New weapon/module recipes and facility tiers | Which route or faction target supports this build? |
| Unstable cores | Optional elites, bosses and night events | High-tier reforging and advanced options | Is this dangerous detour worth carrying the haul through extraction? |

Add one broadly exchangeable credit currency only if trading needs it. Avoid giving every system its own token. The ability to salvage unwanted gear into useful progress prevents the loot pool becoming only disappointment.

Base progression should alter preparation choices:

- **Storage:** keep and label meaningful equipment/materials; starting space must support several builds without immediate cleanup misery.
- **Processor:** convert field salvage into a known yield; unlock better conversion efficiency or handling of unstable material.
- **Workshop:** craft known weapon/module recipes and guarantee a usable replacement path.
- **Power system:** a capacity budget for simultaneously active advanced facilities, with visible benefit. No recurring fuel chore that blocks simply playing the game.
- **Calibration/reforge bench:** alter one property at a known cost; show possible outcomes, cap bad-luck streaks, and avoid indefinitely escalating reroll costs with no target guarantee.
- **Medical/training station:** restock finite field healing and test builds against a dummy at no expedition risk.

For the slice, merge these into storage, one workshop/processor and one power upgrade. Do not build six largely empty menus. Batch salvage, compare equipped items, favorite/lock items, and show which recipe needs a component. Defer automation chains and elaborate base placement until the economy itself generates decisions.

Economy tests must include unsuccessful runs and replacement costs. Measure expected net value per minute, not gross drops:

`expected net value = extraction probability × extracted value − failure probability × lost loadout value − supplies spent`

Night's payout should improve expected return for a skilled, appropriately prepared player while increasing downside variance. It must not be a simple loot multiplier that makes daytime obsolete. Daytime remains useful for learning, reliable common materials, faction work and preparing a specific night objective. Night offers unique combinations, rarer materials and optional high-end targets. No reward should depend on the user's real-world timezone or being online at a particular hour.

Exploit controls needed at design time: no salvage/sale value on free kits; no unlimited kill rewards from summons or extraction spawns; no infinite healing from infinitely respawning weak enemies; no reward duplication on reconnect; and no cancel/restart rerolls of chest contents. Seed and record meaningful rewards when the expedition begins or the container is first resolved, not each time UI opens.

## City, time and factions

Create the sense of a sprawling city with an authored graph of connected districts and interiors. Stream bounded spaces or use deliberate transitions. A giant continuous coordinate plane is not itself exploration. At the current movement speeds, distinguish travel corridors, combat arenas and dangerous traversal so movement does not bypass every encounter or turn navigation into empty travel.

Long-term district roles might include an accessible industrial fringe, dense commercial roofs, a flooded transit network and a sealed research core. Each needs distinct sightlines, traversal routes, enemy mixes, resource signatures, landmarks and at least one shortcut that rewards knowledge. These are candidate content roles, not a requirement for the first build.

Time is a simulation clock that advances during an expedition, forecast before departure. Players can choose a departure period from the hub without waiting in real time. Co-op uses one authoritative expedition clock. Dusk provides repeated, readable warnings; night must not switch on as an unannounced unavoidable damage spike. The transition changes patrol composition, visibility tools, events and pursuit—not just HP, damage or shorter tells. Enemies remain readable at night; darkness cannot hide the information needed for fair reactive combat.

Factions should first influence encounters and routes: competing patrols, contested points, access permissions, trades and conflicting objectives. Use two factions in the slice only if their conflict is central to the objective; otherwise one enemy faction plus one hub contact is sufficient. Never promise a simulated city-wide faction war before testing its production cost.

## Environmental narrative

Build a small narrative bible first: what caused the ruin, what each faction believes happened, what actually happened, why the player can return after death, why technology grows dangerous at night, and what becoming the strongest costs. The mystery should connect the loot/economy/night rules rather than sit beside them.

Use three layers for each major revelation:

1. An environmental observation the player can notice without stopping.
2. An item or short log that suggests a causal explanation.
3. A later place, character or boss that confirms or challenges it.

Track facts as a discovery graph. Essential route/quest instructions need redundant delivery; optional lore can remain ambiguous. Collected logs go to a readable codex with summaries and a location reference. Reading must not pause an online party or expose a player unexpectedly: auto-collect short records, read fully at base, and let important interactions communicate the needed objective in a sentence.

A useful slice story contains one complete small mystery: a power relay that should be dead is still feeding a sealed facility, a recovered component records why, and the optional boss reveals who is maintaining it. That directly connects the base's power upgrade to a larger moral question. This is an illustrative narrative pattern, not proposed canon.

## Co-op requirements and rules

Target two-player LAN PvE in the first playable slice; evaluate four players only after enemy readability, effects and network performance survive two. Solo must be a fully supported configuration of the same encounter system. Local couch co-op is a separate camera/UI/input problem and should not be implied by LAN support. A trusted host runs the session; connect by local discovery or entered address, with no service backend in the first scope.

Minimum architecture:

- Actor IDs and per-player input commands, state, inventory, style, camera and UI.
- Authority owns enemy decisions, damage resolution, loot generation, extraction and persistent item grants. Clients predict their own movement/actions and reconcile with authority; exact model needs a latency prototype before commitment.
- Keep authoritative simulation separate from audio/VFX. Use dedicated, seeded gameplay RNG streams; cosmetic randomness must not perturb loot or AI.
- Do not make every parry freeze or slow the shared world. Local visual impact, animation holds and camera effects must preserve authoritative action timing. Boss intros need a shared entrance gate or non-blocking presentation, never one player's camera locking everybody without warning.
- Co-op inventory/log screens do not pause the world. Party pause in private play, if wanted, is a unanimous explicit feature with no economic exploit.

Recommended ownership policy:

| Concern | Rule |
|---|---|
| Character and banked equipment | Belong to the player profile, independent of host. |
| Base/world progression | Belongs to the host campaign for the slice; disclose before joining. |
| Guest reward | Keeps personal extracted loot, eligible mastery and discovered lore. Important quest completion is credited only when prerequisite-compatible; otherwise record an assist. |
| Loot pickup | Personal ordinary drops; shared finite objective cargo with clear ownership and contribution credit. Defer unrestricted item trading. |
| Downed state | Short risky revive using a finite charge; no unlimited revive/heal loop. Full defeat risks gear and cargo under the same displayed policy as solo. |
| Extraction | All living participants must be within a clear exit zone and confirm/finish the shared countdown for the slice. Downed players can be carried or revived if feasible; a dead player's status is explicit. Defer split-party extraction. |
| Reconnect | Return to the same expedition/actor during a grace period; no fresh inventory or rerolled rewards. |
| Host failure | Resume the last committed expedition snapshot if practical; otherwise restore committed pre-expedition loadouts and grant no uncommitted cargo. This is an explicitly lenient private-PvE policy, not cheat-resistant competitive infrastructure. |

Self-hosted LAN co-op with offline local progression is the recommended initial delivery model; a secure public economy or public trading market would demand stronger server authority and materially expand scope. No engine supplies the game-specific transaction rules automatically.

Save schema must include version, profile/campaign IDs, expedition ID, item instance IDs, active/deployed state, and a monotonic commit marker. Deploy debits inventory atomically; extraction either grants everything once or grants nothing. Use journaled/atomic writes, previous-good backups, explicit corruption handling and migrations. Exercise failure at every transition. If carrying gear is meaningful, persistence reliability is a game-design requirement.

## Smallest slice that answers the real question

For a sole creator, the complete proof slice is one small hub, one compact district with three connected subareas and a shortcut, one core weapon with four modules that produce two genuinely different routes, four enemy roles, one elite/boss, three material types, two extraction locations, day/dusk/night states, storage plus a workshop and a power upgrade, a handful of equipment drops, one small mystery, and two-player LAN networking. This is a staged validation goal, not a single implementation task. Begin with placeholder art and one enemy; complete the pipeline for one character and one district before multiplying content.

Playable sequence: leave in daylight for a component, learn a route, acquire tempting cargo, see dusk approaching, choose an optional night elite or an early exit, extract, craft a module, and take the altered build back out. A failed attempt must exercise the same loss/replacement rules. This loop proves the desired game far better than a larger arena with random loot attached.

Build order:

1. Lock loss policy and per-player state ownership; prototype movement/combat under latency.
2. Implement reliable deploy/extract/fail/save transactions and the minimal hub.
3. Build one navigable district and authored encounters, with finite resource/reward tables.
4. Add the day/night choice and one meaningful crafted build change.
5. Add the finished art/audio slice and narrative reveal, then test repeat expeditions.
6. Expand only when players voluntarily repeat the loop and can explain what they risked, learned and plan to change.

No deadline does not remove content-production constraints. Measure actual hours for a finished enemy, modular environment kit, weapon animation set, sound family and tested quest, then forecast the larger city from those measured rates. AI subscriptions can accelerate drafts and variants; the solo creator still owns art consistency, animation cleanup, implementation, balancing and regression testing. Defer unrestricted trading, public servers, simulated faction wars, base automation chains and a giant seamless city.

## Validation questions and proposed acceptance gates

These are targets to establish before testing; no current measurements are claimed.

- Can a new target-audience player state what is kept/lost before deployment and accurately predict the death result afterward?
- After three consecutive losses, can the player field a viable starter kit immediately, without farming a tutorial zone or accepting debt?
- Do competent players sometimes extract early with partial cargo and sometimes push into night? If everyone always chooses the same answer, the decision is not working.
- Can a player describe two meaningfully different builds and voluntarily select each for different objectives? If the answer is only higher DPS, customization is shallow.
- Does a successful night run materially advance a chosen goal after replacement/supply costs, while day runs remain useful?
- Can players reliably explain why they died using the encounter and the death recap? Failure explained only by invisible multipliers is a difficulty failure.
- Can two players navigate, dodge and recognize their own effects during the busiest encounter, at the project's minimum supported frame rate and target network conditions? For LAN, test normal local conditions and Wi-Fi jitter/loss, then simulated 50/100 ms RTT to expose authority/prediction mistakes. Higher Internet-latency support can be a later choice.
- Can disconnects, process crashes, repeated reconnects and repeated extraction acknowledgements ever duplicate or delete committed items? Required result: no duplication/loss in tested transaction fault cases.
- Can a guest leave/rejoin without overwriting personal progression or unexpectedly changing the host's story state?
- Is inventory/base administration short relative to the expedition, with repeat preparation possible in roughly two minutes once learned?

## Priority conclusion

The new experience is currently absent at the loop, world, persistence and multiplayer layers. Preserve the prototype as a reference for combat identity, enemy roles and timing; build the extraction loop around explicit ownership and loss rules. Adding more upgrade cards, wave modifiers or scenery to the existing mode will not establish the desired incentive structure.
