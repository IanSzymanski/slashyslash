# Systems audit notes: progression, expeditions, world and co-op

Audit date: 2026-11-14. These notes are a source inspection and design recommendation, not measured playtest results. Line references describe the inspected repository. Proposed numbers are prototype hypotheses. Scope assumes the existing side-view 2D combat remains the camera/movement foundation. The user clarified: sole creator, PC first, likely LAN co-op, no deadline, and current AI subscriptions plus optional AI asset tools as the budget. Recommend two-player LAN first; four-player support is a later validation gate. This does not require accounts, matchmaking, cloud services or an always-online economy.

Design revision: 2026-11-15. The creator selected protected character gear, recoverable unsecured cargo, live inventory, primary/secondary build workflows and earned mobility. These replace earlier loss-policy alternatives. The [consolidated audit](game-design-audit.md) defines the baseline, including campaign-bound characters and individual extraction; these supporting notes now use the same policies. No additional runtime tests are claimed.

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

Build a PvE expedition action RPG with Terraria-inspired character/equipment permanence in an authored city. The player grows through discovered, crafted and scavenged upgrades, equipment synergies and mastery. Runs supply materials, blueprints, new gear and candidate field credits for the base. Staying longer raises danger and reward. Death preserves the established character/build and leaves the unsecured haul recoverable outside. Sandbox terrain editing and unrestricted construction are not part of this reference.

The design must reconcile three tensions explicitly:

1. **Extraction encourages caution; style combat encourages risk.** Reward varied, well-executed aggression with immediate combat efficiency and bounded bonus salvage. Do not make basic economic viability depend on maintaining SSS or encourage keeping weak enemies alive to farm meter.
2. **Permanent power can erase a high skill ceiling.** Give meaningful but bounded stat growth, broad horizontal build growth, and stable enemy tells. Let veterans dominate earlier districts. Reserve new patterns, encounters and optional challenge conditions for dangerous districts and night; avoid scaling every enemy to the character forever.
3. **Experimentation needs low friction.** Protect all secured gear through death, support named hub presets and inexpensive respecs, and provide free practice. New loot stays at risk until extracted even if equipped. Recovering a haul must never require rebuilding the character first.

## Recommended expedition contract

**Prepare → choose departure and objective → infiltrate → explore/fight/loot → decide whether to push deeper → reach and complete extraction → process, equip and invest → repeat.**

A first playable expedition should take roughly 15–25 minutes with an early extraction option. This is a design hypothesis to test, not a commitment to pad traversal. A player with a small valuable haul must be able to leave after 5–10 minutes; a boss detour should be a deliberate extension.

Before departure show the district, time until dusk/dawn, elapsed-threat escalation, known exits, expected threats, objective, selected preset and existing recovery-cache markers. Explain secured equipment versus unsecured field finds. Discovery can reveal optional objectives and alternate routes during the run.

During the expedition:

- The layout and landmarks remain legible across visits. Patrols, caches, power states and events vary within authored constraints.
- Loot has a physical location and a clear source. Common materials can be collected quickly; equipment needs a short inspect/swap interaction with readable comparisons. Never require a complex inventory puzzle while an attack is hidden behind the UI.
- At least one baseline extraction route is guaranteed to remain attainable. Additional exits offer different costs: a quieter long walk, a defended lift, or a short exposed signal activation. A boss must not unexpectedly disable every escape.
- Extracting begins an explicit exposed action. Damage or moving out of the extraction zone can interrupt it, with progress behavior stated consistently. The extraction challenge uses finite encounter budgets; it must not generate unlimited rewards.
- The player can leave without completing the selected objective. A partial successful trip is still a success.

Recommended loss rules for the first prototype:

| State | Survives failed extraction? | Reason |
|---|---|---|
| Installed character upgrades, learned moves, mastery and allocated permanent skills | Yes | Preserves identity; growth need not depend on XP levels. |
| Recipes already researched, unlocked base facilities, discovered map and recorded lore | Yes | Knowledge is the durable progression layer. |
| Stashed equipment and materials | Yes | Gives preparation meaning. |
| Secured primary, secondary, armor, modules and carried spares | Yes, wherever carried | Established gear is permanent property; no durability, breakage or repair charge. |
| Expedition materials, equipment, physical blueprints/upgrade items and field credits | Drop into a persistent death cache | Most should be recoverable; extraction secures new property. |
| Newly found equipment used in the field | Still drops | Equipping is not extraction. |
| Unused secured consumables | Yes, proposed default | Spent supplies stay spent; newly scavenged supplies remain cargo. |
| One-time story knowledge discovered in the field | Immediately recorded; physical quest cargo still requires extraction | Death should not force repeated log reading. |

Secured status follows the item's origin/ownership ledger, not a bag or equipment slot. Swapping a secured primary into the backpack does not expose it to death loss; swapping a found weapon into the primary slot does not secure it. Proposed initial rule: install physical upgrade items and research blueprints at the hub after extraction. Permanent knowledge/lore is recorded directly. No durability, death repair, insurance or full-equipment-loss alternative is required.

### Recovery-cache lifecycle

Recovery belongs in the complete slice. Create an owner-labeled persistent cache at death, with an accessible fallback point for hazards/invalid terrain. Record district/location, contents, item rolls and a map marker. Most cargo is recoverable: initially preserve unique gear/blueprints/upgrades and test only a modest common-salvage/currency loss. The exact fraction is unresolved. Consumed materials and spent charges do not return.

Ordinary run resets refill chests and alter patrols but preserve death caches. Begin without real-time expiry or deletion of earlier caches on a later death. Retrieval atomically moves items into unsecured cargo; extraction is still necessary. Another death drops the carried remainder without copying a cache. Recovery may be abandoned or approached with another preset/route. Never place cargo behind a permanently closed gate or require a lost unsecured movement item to reach it. Co-op cache ownership and permissions must be explicit; unrestricted theft is not implied.

## Progression and customization model

Use three distinct clocks:

1. **Permanent character growth:** world-discovered, scavenged or crafted implants/upgrades, learned skills, optional weapon-family proficiency and utility unlocks. Once installed or learned, they persist. Conventional levels are optional, not the assumed growth backbone.
2. **Persistent gear/build growth:** secured weapons, armor, modules, affixes and recipes. Old equipment remains usable indefinitely and may optionally become a confirmed ingredient in a later recipe. A few equipment slots with substantial interactions beat many slots of fractional stat changes.
3. **Expedition-only changes:** scarce temporary overclocks, buffs, injuries or carried tools, all cleared on return or failure.

Proposed initial loadout: one primary, one secondary, one armor piece, two module/accessory slots and a small tertiary quick-use group. Keep basic dodge, defense and baseline traversal universal; tether and the second dash charge are earned, not standard. Weapon families differ in reach, commitment, air control, defensive matchups, status application and conversion. The current endless sidegrades are module candidates rather than automatic permanent abilities.

Module capacity is a budget, not unlimited slot accumulation. A module can add an air cancel or convert a launcher into a ground-wave route; it should also consume capacity or impose a concrete tradeoff. Avoid a single best damage multiplier that every build must equip. Store build presets in the hub and allow inexpensive respecs there so customization remains experimentation.

Rarity should signal the number or specificity of interesting properties, not exponential superiority. Keep item comparison short: damage/defense band, behavioral modifier, resource cost and drawback. A lower-rarity item with the desired move property can remain useful. Give bosses predictable access to a signature recipe and variable bonus rolls, avoiding rare mandatory progression drops.

The player should start weak in damage, protection, supplies and options, with responsive but bounded movement and a basic dodge. Prototype one dash charge. Earned accessories/skills can add tether, air redirects or another charge with a capacity/opportunity cost. The current controller represents advanced capability and can outmaneuver too much as a starting kit. Keep baseline paths usable without these upgrades and compare starter/mobility/damage builds against the same pursuit and terrain. Let advanced gear dominate old ordinary threats without scaling their numbers to erase growth; even daytime retains dangerous encounters and punishable mistakes.

### Synergy, elements and item affixes

Prove the creator's pulse grenade → shield suppression → dagger bleed → primary bleeding-target payoff. Armor/modules reinforce the workflow through buildup, duration or conversion behavior. Explicitly define shield blocking of bleed, the suppression window, status refresh/stacking, weapon-swap commitments and whether the finisher consumes bleed. Provide ordinary shield counterplay when grenades run out. Build variety must include useful alternatives rather than one mandatory sequence.

Separate damage types, elemental affinities, statuses and defense layers in content data. Start with a few readable advantages/resistances and a signature utility per element. Fire/electric/ice/earth are examples; setting-specific names are unresolved. Avoid assuming every shock hit suppresses every shield or every boss ignores every status.

Roll item affixes on creation/finding from weighted compatible pools: positive, negative, exceptional, poor and build-dependent tradeoffs. Start with one affix per item. Reforging costs stated materials/credits, displays eligible results and rerolls the modifier without destroying the item. Prototype keeping the old roll versus accepting the new, and bounded targeting via catalyst/recipe/facility criteria. Preserve resolved rolls through recovery and reconnect. See the [main audit's build and affix specification](game-design-audit.md#6-progression-equipment-and-customization).

Named hub presets reference actual item instances, can share those references across presets, preview missing supplies and never silently craft replacements. Support cheap/free respecs, restock and configurable practice defenses. Training should reveal why an effect failed and how a setup changes the next attack. Trying another build should be cheap, not require perfect reforges first.

### Inventory remains part of the action

Opening inventory does not pause, root, disarm or slow the character, in solo or LAN. Keep run/jump/dodge/defense/attacks/switching/quick-use available. Prototype pointer routing so UI clicks affect only UI and world clicks retain combat, with remappable combat bindings usable over the panel. Inventory navigation must not swallow held movement or produce stuck inputs. Retain quick-use hotkeys and immediate dismissal; test dragging under attack. Clearly distinguish secured items from unsecured cargo regardless of slot. Favor compact panels, quick transfers and dismissible tooltips over a mandatory stop-and-sort interaction.

## Resource economy and infrastructure

Keep tactical and expedition resources separate. A regenerating combat resource can support expressive moves while limited medical supplies and cargo capacity govern expedition attrition. Waiting behind a wall should not replenish all long-term survival costs. Avoid hunger, thirst, dozens of ores or mobile-style processing timers unless testing identifies a concrete gameplay need.

Start with three material classes:

| Material | Sources | Sinks | Decision supported |
|---|---|---|---|
| Common scrap | Ordinary enemies, salvage, unwanted gear | Starter upgrades, routine crafting, new build options | Spend now to improve the next attempt, or save for a facility? |
| Specialized components | Named enemy families, district caches, objectives | New weapon/module recipes and facility tiers | Which route or faction target supports this build? |
| Unstable cores | Optional elites, bosses and night events | High-tier reforging and advanced options | Is this dangerous detour worth carrying the haul through extraction? |

A single broadly exchangeable field credit/token is a candidate for base upgrades, crafting services and reforging, even without trading. Secure it only on extraction; banked funds survive death. Use it only if it creates a useful spending choice beyond materials. Avoid giving every system its own token. Salvaging unwanted gear into useful progress prevents the loot pool becoming only disappointment.

Base progression should alter preparation choices:

- **Storage:** keep and label meaningful equipment/materials; starting space must support several builds without immediate cleanup misery.
- **Processor:** convert field salvage into a known yield; unlock better conversion efficiency or handling of unstable material.
- **Workshop:** craft weapon/module recipes and optional upgrades that explicitly consume older gear; no automatic wear or repair cycle.
- **Power system:** a capacity budget for simultaneously active advanced facilities, with visible benefit. No recurring fuel chore that blocks simply playing the game.
- **Calibration/reforge bench:** reroll a compatible affix at a known cost; show possible outcomes and treatment of the previous roll, bound bad-luck streaks and offer targeting criteria.
- **Medical/training station:** restock finite field healing and test builds against a dummy at no expedition risk.

For the slice, merge these into storage, one workshop/processor with a small reforge function, presets/training and one base upgrade. Do not build six largely empty menus. Batch salvage, compare equipped items, favorite/lock items, and show which recipe needs a component. Defer automation chains and elaborate base placement until the economy itself generates decisions.

Economy tests must include unsuccessful runs, recovery supplies and recovery time. Measure settled net value per minute across the full cycle, not gross drops:

`expected settled value = extraction probability × haul value + failure probability × expected net recovered value − initial-trip supplies consumed`

Net recovered value is the originating failed trip's eventual banked cargo after salvage loss, recovery failure and incremental recovery supply cost. Do not count those same items again as fresh rewards on recovery. There is no lost-loadout or durability cost. Use the originating haul's ledger and total trip/recovery time when comparing routes.

Night's payout should improve expected return for a skilled, appropriately prepared player while increasing downside variance. It must not be a simple loot multiplier that makes daytime obsolete. Daytime remains useful for learning, reliable common materials, faction work and preparing a specific night objective. Night offers unique combinations, rarer materials and optional high-end targets. No reward should depend on the user's real-world timezone or being online at a particular hour.

Exploit controls needed at design time: no repeat starter-kit salvage grants; no unlimited kill rewards from summons or extraction spawns; no infinite healing from infinitely respawning weak enemies; no reward duplication on reconnect/cache claim; no securing a found item by equipping or transferring it; and no cancel/restart rerolls of chest contents or affixes. Seed and record meaningful rewards when the expedition begins or the container is first resolved, not each time UI opens.

## City, time and factions

Create the sense of a sprawling city with an authored graph of connected districts and interiors. Stream bounded spaces or use deliberate transitions. A giant continuous coordinate plane is not itself exploration. At the current movement speeds, distinguish travel corridors, combat arenas and dangerous traversal so movement does not bypass every encounter or turn navigation into empty travel.

Support frontal fighting, stealth and alternate traversal. Prototype sight/occlusion, movement and attack noise, readable suspicion/alert/search states and bounded pursuit. Cover, patrol gaps, interior passages and vertical approaches need to be authored. Valuable chests should be difficult both to fight and sneak toward; stealth must yield worthwhile progression without requiring style or kill bonuses. Exclusive enemy drops still reward defeating that target.

Use authored chest sockets with a per-expedition active selection and refilled loot. Socket memorization is legitimate knowledge; deeper unknown routes offer distinct resources, better tables and tougher combat/infiltration. Claimed chests never refill on UI reopen, streaming reload or reconnect within the same run. Unique story containers can have explicit one-time rules. Ordinary chest reset and persistent death caches are separate systems.

Long-term district roles might include an accessible industrial fringe, dense commercial roofs, a flooded transit network and a sealed research core. Each needs distinct sightlines, traversal routes, enemy mixes, resource signatures, landmarks and at least one shortcut that rewards knowledge. These are candidate content roles, not a requirement for the first build.

Time is a simulation clock that advances during an expedition, forecast before departure. Players can choose a departure period from the hub without waiting in real time. Co-op uses one authoritative expedition clock. Dusk provides repeated, readable warnings; night must not switch on as an unannounced unavoidable damage spike. The transition changes patrol composition, visibility tools, events and pursuit—not just HP, damage or shorter tells. Enemies remain readable at night; darkness cannot hide the information needed for fair reactive combat.

Elapsed run time increases threat independently of the day/night phase. Use announced bands to increase patrol danger, eligible enemy-affix combinations and newly available high-value encounters/events/caches. Dawn must not reset a very long expedition to safety. Depth and local alert add distinct pressures. Tie better rewards to actual new threats/opportunities, not idle waiting beside a safe claimed chest. Exact timings and the ultimate cap are open tuning questions.

Roll simple enemy modifiers first, then compatible combinations at optional extreme difficulty. Some are meant to be unfair for the current build: scouting, bypass, retreat or a different preset can be the correct response. Major traits must be legible before commitment, with a viable route around or away. Curate mandatory encounters and exit access; never roll an unkillable gatekeeper onto the only route home. Reward actual threat with better material yield, rarer tables or bounded improved rare-drop odds. Budget interacting traits, not just their count.

Enemy scale should mix grunts, squads, drones, tanks and large machines with intimate human-scale cyborg rivals. Following the Metal Gear Rising: Revengeance reference, the player-sized opponent can be the hardest. Its spacing, feints, punish windows, personal loadout and status interactions test detailed counterplay rather than sheer size. Prove one human-scale rival in the slice; larger spectacle bosses can follow.

Factions should first influence encounters and routes: competing patrols, contested points, access permissions, trades and conflicting objectives. Use two factions in the slice only if their conflict is central to the objective; otherwise one enemy faction plus one hub contact is sufficient. Never promise a simulated city-wide faction war before testing its production cost.

## Environmental narrative

Build a small narrative bible first: what caused the ruin, what each faction believes happened, what actually happened, why the player can return after death, why technology grows dangerous at night, and what becoming the strongest costs. The mystery should connect the loot/economy/night rules rather than sit beside them.

One candidate explanation is reconstruction of registered gear and installed upgrades, leaving unregistered haul at the death site. It must also explain why a found weapon is unsecured while equipped and an old spare stays protected. This is proposed fiction, not canon; the ledger permits only one usable instance regardless of the explanation.

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
- Inventory retains character movement/combat in solo and co-op. Log screens do not pause the party. Any separate private-session pause is explicit, not the inventory behavior.

Recommended ownership policy:

| Concern | Rule |
|---|---|
| Character and secured equipment | Campaign-bound per-character slots in the host's campaign for the slice; no automatic merging into a separate solo inventory. Terraria inspiration does not by itself specify cross-save portability. |
| Base/world progression | Belongs to the host campaign for the slice; disclose before joining. |
| Guest reward | Host durably records that campaign character's extracted loot and eligible progression; communicate campaign ownership before joining. |
| Loot pickup | Host creates each item once with explicit claim/transfer rules; shared objective cargo and participation credit are visible. Defer unrestricted trading systems. |
| Downed state | Risky revive using a finite charge; no unlimited revive/heal loop. Full defeat retains secured gear and creates an owned unsecured-cargo cache. |
| Extraction | Individual extraction banks that character's cargo after a durable checkpoint. Extracted players cannot resupply/re-enter the same run. Remaining players and their outcomes are explicit. |
| Reconnect | Return to the same expedition/actor during a grace period; no fresh inventory or rerolled rewards. |
| Host failure | Resume a consistent saved expedition checkpoint containing world, caches and inventories; preserve acknowledged extraction outcomes. Host process remains active after the host character extracts. No live migration is required. |
| Recovery claim | Host verifies owner/permission, atomically moves cargo out of the cache and preserves IDs/affixes; recovered items remain unsecured until extraction. |

Self-hosted LAN co-op with offline local progression is the recommended initial delivery model; a secure public economy or public trading market would demand stronger server authority and materially expand scope. No engine supplies the game-specific transaction rules automatically.

Save schema must include version, campaign/character IDs, expedition/cache/transaction IDs, item instance IDs, secured provenance, location, resolved affix and a monotonic commit marker. Deploy relocates protected gear without deleting ownership. Extraction promotes cargo once; death retains secured items and moves the eligible haul into a cache once. Claim, reforge, transfer and recipe consumption are atomic too. Use journaled/atomic writes, complete checkpoints, previous-good backups, explicit corruption handling and migrations. Acknowledge banking only after durable writes. Test simultaneous pickup/death/extraction and recovery followed by another death. Persistence reliability is part of the stakes model.

## Smallest slice that answers the real question

The [consolidated scope and gates](game-design-audit.md#15-a-production-plan-with-gates-not-deadlines) govern the complete slice. It now needs two equipped weapon families proving setup/payoff, presets, live inventory, a minimal item-affix/reforge pool, a small enemy-affix set, one earned movement option, permanent upgrade discovery, stealth/bypass, refreshed chests, elapsed threat and persistent recovery alongside the original hub/district/extraction/LAN loop. Begin with one room, one weapon and one enemy before those systems accumulate. Reduce content counts before deleting the mechanics the slice exists to validate.

Playable sequence: depart with secured primary/secondary/armor/modules; fight or infiltrate for a component; find new gear with a random affix; see threat rise; choose a dangerous optional rival or extraction; bank/craft/reforge and save another build. Also fail once, verify established gear persists, retrieve most of the haul on a later run and extract it. Demonstrate a permanent upgrade and the difference between starting and earned mobility. This loop proves the game better than a larger arena with random loot attached.

Build order:

1. Implement the selected secured/unsecured contract and per-player ownership; prototype bounded starting movement, live inventory and combat under latency.
2. Implement reliable deploy/extract/death/cache-claim/save transactions and the minimal hub.
3. Build one navigable district and authored encounters, with finite resource/reward tables.
4. Add elapsed threat/day-night choice, the two-weapon workflow, presets, small affix/reforge pools and one earned movement/character upgrade.
5. Add the finished art/audio slice and narrative reveal, then test repeat expeditions.
6. Expand only when players voluntarily repeat the loop and can explain what they risked, learned and plan to change.

No deadline does not remove content-production constraints. Measure actual hours for a finished enemy, modular environment kit, weapon animation set, sound family and tested quest, then forecast the larger city from those measured rates. AI subscriptions can accelerate drafts and variants; the solo creator still owns art consistency, animation cleanup, implementation, balancing and regression testing. Defer unrestricted trading, public servers, simulated faction wars, base automation chains and a giant seamless city.

## Validation questions and proposed acceptance gates

These are targets to establish before testing; no current measurements are claimed.

- Can a new target-audience player state what is kept/lost before deployment and accurately predict the death result afterward?
- After three consecutive deaths, does the character retain all secured equipped/carried gear and installed upgrades without durability or repair costs? Can a newly equipped field find still be correctly identified as unsecured?
- Do competent players sometimes extract early with partial cargo and sometimes push into night? If everyone always chooses the same answer, the decision is not working.
- Can a player describe two meaningfully different builds and voluntarily select each for different objectives? If the answer is only higher DPS, customization is shallow.
- Does a longer/harder run advance a chosen goal after supply and recovery costs, while shorter/day runs remain useful?
- Can players reliably explain why they died using the encounter and the death recap? Failure explained only by invisible multipliers is a difficulty failure.
- Can two players navigate, dodge and recognize their own effects during the busiest encounter, at the project's minimum supported frame rate and target network conditions? For LAN, test normal local conditions and Wi-Fi jitter/loss, then simulated 50/100 ms RTT to expose authority/prediction mistakes. Higher Internet-latency support can be a later choice.
- Can disconnects, process crashes, repeated reconnects and repeated extraction acknowledgements ever duplicate or delete committed items? Required result: no duplication/loss in tested transaction fault cases.
- Can a guest leave/rejoin without overwriting personal progression or unexpectedly changing the host's story state?
- Is inventory/base administration short relative to the expedition, with repeat preparation possible in roughly two minutes once learned?
- Can the player move, jump, defend, attack, switch weapons and use supplies while inventory stays open, without double-fired UI/world actions?
- Can a player recover most cargo on a later run, die carrying it again, and recover without duplicated items, rerolled affixes or erased earlier caches?
- Do a resistant matchup and an extreme enemy roll produce understandable build/route choices, including avoiding a fight? Do stealth and deeper chest exploration yield worthwhile progress?
- Can the pulse/bleed/primary workflow and another preset both work, with low switching cost and readable failure reasons? Does earned mobility expand options without making starter routes impossible?

## Priority conclusion

The new experience is currently absent at the loop, world, persistence and multiplayer layers. Preserve the prototype as a reference for combat identity, enemy roles and timing; build the extraction loop around explicit ownership and loss rules. Adding more upgrade cards, wave modifiers or scenery to the existing mode will not establish the desired incentive structure.
