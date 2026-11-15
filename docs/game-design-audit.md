# SlashySlash: full game design and production audit

**Date:** November 14, 2026. **Inspected build:** `d45fd63227317bbd4edfa8499d119d98b7ba3b07`.

**Design revision:** November 15, 2026, incorporating the creator's clarified direction. Character and secured equipment persist; only the expedition's unsecured haul is dropped on death, with recovery expeditions supported. This replaces the earlier full-loadout-loss recommendation. Source findings still describe the inspected build; revised systems below are design specifications and proposals, not implemented features or new playtest results.

**Creator constraints:** solo developer; PC first; likely LAN co-op; no fixed deadline; existing AI subscription budget, with additional asset tools possible. Retain side-view, retro 2D presentation. All current assets are replaceable.

## 1. Recommendation

**Build the proposed game on a fresh Godot 2D foundation. Preserve SlashySlash as a playable combat reference and testing laboratory. Prove a small, polished extraction loop and two-player LAN before expanding the city.**

The current game contains valuable combat ideas. It does not contain the persistent world, inventory, economy, authoring pipeline or multiplayer architecture that the proposed game needs. Adding those systems to this implementation would mean developing much of a game engine and content editor while also redesigning the game. A controlled restart is justified by those structural differences, not by dissatisfaction with the existing art.

Unity 2D is a credible alternative if existing Unity/C# experience or a specific tool demonstrably improves your workflow. Unreal is difficult to justify for this particular solo, predominantly 2D brief unless you already know it well or intentionally move toward 3D environments. An engine does not solve design or content production automatically; the recommendation is conditional on a small playable proof.

The intended game should have a concise identity:

> A solo and cooperative expedition action RPG in a ruined vertical city, with Terraria-inspired character and equipment progression: keep the character and gear you have earned, risk the haul you have just found, and build powerful combat combinations while deciding how much longer to stay outside.

Terraria is the reference for attachment to a persistent character, lasting equipment, discoverable upgrades and an inventory usable during action. The world structure is an authored city revisited through runs, with a functional home base. Sandbox construction, terrain mining and a destructible world are not implied. Extraction creates tension around bringing discoveries home; equipment ownership supports long-term experimentation.

The best part of the present game is the relationship between movement and combat. Make that the defining advantage of the extraction game. Collecting and crafting should give players reasons to use that combat, and consequences for how well they perform it.

## 2. What this audit established

Reviewed the source, README, existing planning documents, rendering/audio implementation, persistence and smoke test. Inspected the running title screen, training, movement, attack feedback and a spawned enemy encounter in Chromium. Ran the existing five-mode smoke test through the environment's Chromium adapter and isolated probes against actual combat methods.

This is a design and implementation audit with limited direct interaction. It is **not** a controlled human playtest, a listening review, a production performance benchmark, or a successful engine/network prototype. Balance conclusions are labeled as hypotheses where appropriate. All future numerical targets below are proposals to test.

| Area | Current implementation | Required direction |
|---|---|---|
| Combat | Mixed light/heavy strings, launches, plunges, dash attacks, parry/counter, tether and environmental attacks | Primary/secondary/utility setup-and-payoff builds; preserve responsiveness and consistent commitments |
| Challenge | Enemy roles and tells, melee attack slots, wave growth, overlapping difficulty multipliers | Authored encounter pressure, readable attack rules, deliberate progression and night threats |
| Progression | Eight temporary endless sidegrades, score records, completion flags and an AEGIS unlock | Persistent character and secured gear, permanent discoveries, earned movement, build presets and temporary expedition bonuses |
| Characters | Ronin/AEGIS metadata exists, but the player constructor selects Ronin | Build identity through loadouts; avoid making several fully animated characters an initial prerequisite |
| Loot | Health pickups, score and ultimate charge | Secured/unsecured item provenance, random item affixes, recoverable death caches and meaningful sources |
| Inventory | No equipment or cargo management | Live Terraria-inspired inventory with movement, combat and quick use available while open |
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

An illustrative trip: you need a relay component for the workshop. You leave in daylight with a secured primary, secondary, armor, two modules and limited healing. A service passage avoids a defended street but requires watching patrols; an optional rooftop route is easier with an earned tether. You disable a guard's shield, apply bleed with the secondary and convert it into a primary-weapon finisher. A cache contains the component and clues to a sealed clinic. The expedition's threat is rising. You can leave with the upgrade, or pursue a rarer core while risking the entire unsecured haul. Death returns you with your established build intact and leaves a recoverable cache outside. Returning safely turns a discovery into permanent equipment, character or base growth.

That decision is the central test of the game. If extracting is always obvious, resources are irrelevant. If fighting is usually an unnecessary expense, the extraction rules have displaced the intended combat fantasy.

## 5. Combat, skill floor and difficulty ceiling

**Start with responsive but bounded movement, modest gear and a small set of reliable actions.** Basic dodge, defense, running/jumping and a satisfying string exist immediately. Tether and a second dash charge are earned capabilities, not baseline entitlements. The current character is a reference for an advanced moveset, not the starting power level. Input buffering, clear feedback and responsiveness remain universal.

### Combat rules

- Author startup, active frames, recovery, movement, hitboxes and cancel permissions as move data. Presentation follows the combat clock. A frame dropped by rendering must not delete a hit or change a parry window.
- Preserve light/heavy routing, dash attacks, launch/air/ground conversions and environmental attacks as a vocabulary distributed across weapon families and upgrades. Tether traversal belongs to earned equipment or skills. Give each a tactical purpose: approach, control, armor break, damage, escape or resource conversion.
- Prototype separate light/heavy inputs alongside the existing tap/hold system. Lights currently fire on release, with a 150 ms heavy threshold. That may be a deliberate feel choice, but control ambiguity should not supply the difficulty.
- Make action commitments consistent. For example, light recovery allows defensive cancellation; heavy startup permits a short feint; a committed heavy/finisher must complete its dangerous portion. These are proposed rules, not a demand to make every action cancellable.
- Give common and mandatory enemies multiple valid responses. A shield can favor flanking/heavy guard break. Optional extreme enemies may overwhelm a particular build; scouting, evasion and another route must then be viable responses. A universal ability to kill every roll would undermine the intended risk ceiling.
- Preserve punish windows. An enemy that reads player input needs a visible reaction delay and must not cancel its own promised recovery into a perfect defense.
- Prevent infinite air juggles, repeated proc loops and permanent stagger through bounded rules visible in training. Avoid blanket boss immunity that deletes the interesting parts of builds.

### Resource contract

| Resource | Purpose | Proposed recovery rule |
|---|---|---|
| Health | Expedition attrition; mistakes consume a finite survival budget | Limited medical supplies, base recovery, occasional deliberate field opportunities |
| Shield | Renewable protection against a small number of mistakes | Delayed recharge; does not pay for ordinary parry or necessary route traversal |
| Reactor energy | Empowered attacks, aggressive cancels, utilities and advanced tether effects | Active execution and measured regeneration; basic offense/defense remain usable at zero |
| Dash charges | Short-term movement/defense timing | Prototype one starting charge; extra charges are earned; predictable cooldown and no unlimited immunity chain |
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

The rival's red attack currently bypasses ordinary invulnerability, shield and parry. Such an exception requires unmistakable teaching and a valid baseline response in mandatory encounters. An extraction boss should first test familiar rules, then introduce one new rule with a survivable learning opportunity. Extreme optional variants can subsequently make the encounter an inadvisable fight for the current build.

Expand the melee attack-slot idea into an encounter threat budget covering ranged lines, melee commitments, hazards and pursuit per player. Ordinary and mandatory encounters must remain readable. At the extreme end, optional affix combinations can be brutally unfavorable or effectively unwinnable for the current build: recognizing that fight and getting around it is part of mastery. Telegraph the threat before commitment and preserve a bypass or retreat. Do not quietly insert such a roll into the only route home. Let a powerful character convincingly dominate earlier ordinary enemies; do not silently scale every enemy to erase growth. Daylight is a lower relative threat band, not a promise of safety: a bad commitment can still be lethal.

### Movement is a progression axis

| Layer | Candidate abilities | Design obligation |
|---|---|---|
| Starting controller | Run, jump, basic dodge, defensive action and modest terrain negotiation | Dynamic immediately; cannot trivially outrun or vault every early encounter |
| Permanent character upgrades | An earned additional movement option, improved control or a learned traversal technique | Once installed/learned, persists through death; the specific upgrade source is authored |
| Accessories/modules | Tether, extra dash charge, air redirect, specialized movement interactions | A build choice with slot/capacity cost; removal must not strand the player |
| Advanced combinations | Chained zip/launch/air routes and specialized evasive play | Reward execution and investment without granting permanent escape or invulnerability |

The allocation of each advanced move between permanent upgrade and accessory is a prototype decision. The firm requirement is that tether and double dash are absent from the default starting kit. Do not grant the entire current mobility stack automatically over the first few upgrades. Test pursuit and terrain with the starter, a mobility build and a damage build separately. Critical routes need a baseline path; earned traversal can create shortcuts and optional access. A recovery cache must remain reachable without an unsecured movement drop that was lost at death.

### Learning and interface

Keep an optional hub practice sequence for movement, a basic string, ordinary defense and the first special attack category. Make the opening daytime objective teach departure, one resource decision and extraction. Its reward should immediately enable a visible workshop or module improvement. A subsequent trip introduces an optional dusk detour. This teaches the complete loop without giving away advanced combo mastery or forcing repeated tutorials after death.

Support rebindable inputs and prompts that follow those bindings. Prototype gamepad aiming/tether selection early if controller support is intended; keyboard/mouse responsiveness does not establish controller quality. Resolve overloaded crouch/slide/drop/plunge inputs deliberately. Keep the map, extraction forecast, supplies and cargo value readable without covering incoming threats. Offer deeper item details at the hub, quick field comparisons, and separate world/UI scaling. A high skill floor should test execution and decisions rather than tiny text or hidden input rules.

### Live inventory: an explicit control requirement

Opening inventory never pauses, roots, disarms or automatically slows the character in solo or co-op. Movement, jumping, dodge, defense, weapon switching, attacks and quick-use remain available. This is the desired Terraria-like interaction, not merely a menu drawn over a running simulation.

Use a compact inventory overlay with visible primary, secondary, armor, module and consumable slots, plus a clearly marked unsecured cargo region. Mark secured status on the item itself as well: moving items between regions must not change ownership. Provide quick-stack, sort, compare, favorite/lock and rapid transfer at the hub. Field pickup should rarely demand dragging stacks while under attack.

Prototype input routing explicitly: movement and combat bindings continue to reach the character; pointer clicks on an inventory control affect that control only; clicks in the exposed world retain their combat function. Keep weapon/quick-use hotkeys usable without closing the panel, and offer remappable combat actions for using them while the pointer is over inventory. Keyboard/controller inventory navigation needs deliberate focus rules without swallowing movement. The same click must never both move an item and fire a weapon. Check held movement when opening/closing, drag cancellation, incoming hits during sorting and attacks aimed beside the panel. Dismissible tooltips and a compact layout protect sightlines; closing the overlay must be immediate.

## 6. Progression, equipment and customization

Use three clearly separated layers:

1. **Permanent character:** installed upgrades, learned skills, optional weapon mastery, researched recipes and utility unlocks. Terraria-like growth can come from rare world discoveries, scavenged components and crafted implants; an XP level treadmill is not required. Once committed, these upgrades survive death.
2. **Secured equipment:** crafted or successfully extracted weapons, armor, accessories and modules. These remain the character's property when taken outside, equipped, swapped or carried as spares. No durability loss, breaking, repair bill or insurance requirement. An old item can optionally become an explicitly confirmed ingredient in a later recipe.
3. **Expedition state:** unsecured finds, finite consumables, temporary overclocks and conditions. The haul needs extraction; field buffs expire by stated rules. Acquiring a physical blueprint or implant is different from permanently researching/installing it.

Prototype a loadout with **one primary weapon, one secondary weapon, armor, two accessory/module slots and a small tertiary quick-use group** for grenades, medicine or other consumables. Two modules is a scope proposal, not a fixed final count. Primary and secondary describe equipped roles, not rigid classes or an assumption that the secondary must be weak. Both can materially enable a build. Weapon families should differ in reach, timing, resource use, status delivery, defense interaction and conversion opportunities.

Examples of distinct build directions:

| Build | Behavior | Tradeoff |
|---|---|---|
| Air duelist | Launch, tether redirect, air cancel and plunge conversion | Requires positioning and energy; less comfortable against grounded heavy pressure |
| Breaker | Armor damage, committed finishers and ground shockwaves | Slower recovery; must create safe openings |
| Conductor | Precision parries, marks and controlled chain reactions | Depends on threat reading; limited burst without setup |
| Hemorrhage hunter | Pulse strips a shield, daggers apply bleed, a primary cashes in the status | Requires an opening and finite utility supply; poor into bleed-resistant targets |

These are build identities, not initial classes. They can share a character body and universal controls. Start with a small set of modules that actually changes choices. Aftershock/Breaker-style ideas are better foundations than dozens of interchangeable damage percentages.

Rarity should describe an item's properties and specialization rather than exponential superiority. Show the behavioral change, power band, resource cost and drawback in concise comparisons. Prevent multiplicative damage/crit/cooldown/proc combinations from bypassing every commitment. Weapons, armor and modules can come from enemy drops, chests and crafting; distinct source tables let players pursue a build deliberately.

### Build workflows: create a condition, apply a status, exploit it

The creator's example should be an acceptance case for the combat model:

| Step | Player action | Required interaction and feedback |
|---|---|---|
| Open the defense | Throw a pulse grenade at a shielded enemy | Suppresses/breaks the shield for a stated window; clear shield-off cue; consumes a grenade |
| Establish the status | Switch to daggers and land the bleed sequence | This bleed cannot normally pass an active shield; daggers are poor shield-breakers; successful application is visible |
| Convert the setup | Switch to a primary with a bleeding-target bonus | A defined attack gains its special payoff while bleed is active; tooltip states whether it consumes the status |
| Reinforce the loop | Equip armor/accessories supporting bleed or the conversion | Extend the window, improve buildup or reward the finisher; do more than add interchangeable damage percentages |

The satisfaction is choosing and executing a workflow across the whole loadout. Do not make these three inputs an automatic macro or the mandatory answer to every enemy. A failed application, shield regeneration, incoming pressure or a missed conversion can disrupt it. Switching should be quick enough to execute the loop, with explicit cancel rules and no double-triggered on-equip effects. A fallback such as flanking or a slower guard break prevents an ordinary shield from becoming a consumable lock. Other builds can emphasize shield damage, direct damage, stagger, elemental reactions, distance or stealth.

Model damage type, elemental affinity, status buildup, defensive layer and trigger conditions separately. Tags such as `shield_active`, `bleeding` and `armor_broken` support understandable interactions. Define status duration, buildup threshold, refresh/stack rule and whether a payoff consumes it. Bound proc recursion, per-target triggering and multiplayer stacking. Display why an effect failed: shield blocked bleed, target resists buildup, or the conversion window expired. Avoid blanket boss status immunity; use shorter windows or explicit resistance where appropriate, preserving setup/payoff play.

### Elements: matchup choices with a setting-specific identity

Provide advantages and disadvantages against different defenses, materials and enemy families. Fire/electric/ice/earth illustrate the intent, not the final element list. Candidate setting-specific names need a fiction and distinct tactical purpose before becoming content; none is canon yet. Illustrative matchups to test:

| Candidate element | Favored matchup | Resisted matchup | Possible utility |
|---|---|---|---|
| Arc | Exposed conductive machinery | Grounded/insulated units | Disrupt electronic actions or bridge marked conductors; ordinary Arc damage does not automatically suppress shields |
| Resonance | Rigid armor and brittle structures | Flexible/damped plating | Build fracture to open a brief armor-break opportunity |
| Entropy | Repair swarms and regenerative systems | Isolated inert machinery | Interfere with repair or regeneration, creating a conversion window |

Start with a small matchup table. For each element state its favored target/defense, resisted target/defense, signature status or utility and one visible counterplay cue. Treat shield suppression, armor damage and bleed permission as explicit rules rather than consequences of an unexplained color wheel. Do not imply that every electrical hit strips every shield. Carrying complementary primary/secondary types should broaden options; a disadvantage usually reduces efficiency rather than dealing zero damage. Optional extreme enemies can demand adaptation or avoidance. Prototype a few interactions before committing to a combinatorial reaction system or requiring mid-run inventory swaps for every opponent.

### Item affixes and reforging

On crafting or finding an item, resolve its modifier from a compatible weighted pool. Include beneficial rolls, harmful rolls, exceptional sought-after rolls, genuinely poor rolls and situational tradeoffs that differ by build. An attack-speed penalty might be unacceptable for bleed application but worthwhile on a high-commitment finisher with a large payoff. Rarity, base item and affix are separate; a rare chassis need not automatically have a desirable modifier.

Begin with one affix per item and a curated pool. Example hypotheses: **Keen** improves precision; **Volatile** adds a burst with extra energy cost; **Sluggish** impairs recovery; **Serrated** favors bleed buildup while weakening another damage role. These illustrate the range, not final names or values. Tooltips show exact changes and compatibility. Negative rolls should create a salvage/reforge decision, never secretly erase a permanent unlock or break an item.

Reforging rerolls that affix at a hub bench, using stated materials/credits and compatible outcomes. Show the current modifier, eligible pool, cost and the treatment of the old roll before committing. A specific reforge recipe, facility tier or catalyst can narrow a pool; define those criteria in content data. Prototype a choice to keep the current roll or accept the new one, plus a bounded route to a chosen affix family after repeated attempts. This preserves random outcomes without making trying another build depend on indefinite luck. Reforge results are committed once, never rerolled by reopening UI or reconnecting. Reforging cannot destroy the equipment, and its cost must not become the admission price for basic experimentation.

### The home base makes changing builds inexpensive

Save named presets containing item-instance references, primary/secondary assignment, armor, modules, quick-use choices and any respec allocation. One click at the hub applies an available preset; preview missing items or supplies and never silently consume crafting ingredients to fill it. Items may appear in multiple presets because presets are references, not duplicate copies. Offer cheap/free hub respecs, a practice target with configurable shields/armor/status resistance, and a clear status/trigger readout. Include easy restocking and compare tools. Preserve favorite/lock protection through salvage, crafting and reforging.

Reward experimentation with different target weaknesses, optional route opportunities and meaningful sidegrades. Keep an established successful build viable; players should want to explore alternatives without being forced to replace gear each run. Test whether they actually try a second preset after failure rather than merely stating that many combinations exist.

Make eventual power feel enormous through reach of capability: access to dangerous districts, mastery of former bosses, powerful interactions and control of once-threatening encounters. Preserve optional deep-night challenges through new behaviors and encounter demands, not an endless staircase of inflated health.

## 7. Extraction, death and recovery

**Keep the character and all previously secured gear; drop the unsecured haul at the death location.** This is the creator's selected direction, not a full-gear-loss experiment. Corpse-cache recovery belongs in the first complete expedition slice. Do not replace it with gear repair, durability, bankruptcy or insurance.

| Outcome/state | Rule |
|---|---|
| Successful extraction | Bank carried loot and expedition rewards; retain equipped gear; commit the result once |
| Death / party wipe | Return with the established character and secured belongings; unsecured loot becomes a persistent recovery cache |
| Secured primary, secondary, armor, modules and carried spares | Retained even if unequipped or swapped in the field; no wear, breakage or repair cost |
| Already installed upgrades, learned skills, researched recipes, stash, wallet and base | Retained |
| New materials, equipment, physical blueprints, upgrade items and field credits/tokens | Unsecured until extracted; drop into the recovery cache even if temporarily equipped |
| Permanent-upgrade item or blueprint found outside | Proposed initial rule: research/install at the hub after extraction; picking up or field-equipping cannot instantly secure it |
| Consumables | Spent charges stay spent; proposed default retains unused secured supplies and drops newly scavenged supplies |
| Discovered map knowledge and read lore | Retained; physical quest items still require extraction |
| Recovery expedition | Bring the same secured build or another hub preset; retrieval restores cargo at risk, not banked ownership |
| Optional objective left unfinished | Partial extraction remains valid and profitable |
| Extraction attempt | Clearly announced exposed interaction; finite threat budget; interrupt rules visible; no immunity bypass |
| Repeated failure | Character and build remain usable immediately; recovery is optional and no repair debt or forced idle waiting applies |

**Protection follows provenance, not the equipment slot.** A newly found sword remains unsecured when equipped, and the secured sword it replaced stays protected in the backpack. Dropping, reclaiming, trading or moving an item between UI regions cannot launder it into secured ownership. Initially, new gear crafted from unsecured field materials should also stay unsecured; hub crafting with secured ingredients produces secured gear. Reforges and upgrades must not destroy the identity or ownership of an existing item accidentally.

### Recovery is another expedition decision

On death, create an owner-labeled cache containing the unsecured haul, at the death location or the nearest valid accessible point if that location is a hazard or invalid terrain. Show it on the map and death recap, including contents and the danger of the route. Preserve the original district/location reference across runs even when ordinary chests and patrols reset.

The creator wants **most** of the haul recoverable. Prototype preservation of all unique equipment, physical blueprints and upgrade items, with at most a modest, clearly displayed loss of common salvage or field currency. The exact fraction is unresolved and should be tested; do not invent an arbitrary percentage as a confirmed rule. Never reroll a recovered item's affix. Used consumables and materials already spent are not recreated.

Start with no real-time expiry and no rule deleting an earlier cache when a new death occurs. Persistence limits or consolidation need a separate visible policy if later necessary; silent deletion would contradict recoverability. After retrieval, the contents are unsecured cargo again and need extraction. A second death drops the carried remainder under the same rule, without copying the old cache. Untouched caches persist. Returning home and abandoning recovery are valid choices; the player is risking a previous haul, not their ability to field a build.

Recovery should retain meaningful danger without reproducing the exact lethal encounter forever. Patrols may vary within the district's normal rules, and players may choose another route or counter-build. Do not force a boss rematch just to retrieve a cache placed beyond a one-way arena gate. Persistent unique IDs and atomic cache claims must handle death during retrieval, two clients attempting a claim, reload and reconnection. Recovery cannot double either a unique item or its salvage payout.

Show the stakes before departure and the cause of failure afterward. A death recap should identify the attack, whether it was parryable, the player's action state, retained equipment, dropped cargo, any unrecoverable portion and the cache marker. Avoid presenting an incorrect or speculative “you should have dodged” hint.

At least one baseline extraction remains reachable by design. Other exits can exchange distance, exposure, a consumable cost or a faction condition. Telegraph any closure ahead of time. No late random event should silently make every exit impossible.

## 8. Economy and base infrastructure

Every meaningful material should answer “where do I get it?” and “what decision does spending it enable?” Start with three classes:

| Material | Main source | Main use |
|---|---|---|
| Scrap | Common enemies, salvage and unwanted gear | Routine crafting, new build options and basic infrastructure |
| Components | Specific enemy families, faction caches and named objectives | Modules, weapon recipes and facility tiers |
| Unstable cores | Optional elites, bosses and night objectives | Advanced sidegrades, controlled reforging and high-tier research |

A single credit/token currency is a candidate shared sink for base upgrades, crafting services and reforging, even without trading. Field earnings remain unsecured until extracted; the banked wallet is protected. Prototype this only if it creates a distinct spending decision from materials. Do not introduce a different token for every station. Unwanted loot should salvage into purposeful progress. Bosses should reliably advance a signature recipe or goal; optional exceptional rolls can remain uncertain.

| Facility | Meaningful function | Scope |
|---|---|---|
| Storage | Keep several builds, supplies and materials; sort, compare, favorite and batch salvage | Slice |
| Workshop/processor | Turn salvage into known materials; craft weapons/modules and optional upgrades using older gear as ingredients | Slice; combined station initially |
| Power | Capacity for advanced facilities; choosing what to activate creates a preparation tradeoff | One useful upgrade in slice |
| Research/calibration | Unlock recipes and deliberately alter a property | Expand after core economy works |
| Reforge | Reroll a compatible affix at a stated cost; preserve item ownership and offer bounded targeting | One small affix pool in complete slice; broader catalysts/tiers later |
| Medical/training/presets | Restock healing, apply saved builds and test shield/status interactions | Basic function early; elaborate facility later |

Power should be a capacity decision, not recurring fuel maintenance that prevents playing. Processing can resolve through clear batches or expedition milestones; real-time waiting is not automatically interesting. Begin with a compact functional hub rather than a free-placement factory simulator.

Evaluate **net** reward, including failed runs:

`expected settled value = extraction probability × haul value + failure probability × expected net recovered value − supplies consumed on the initial trip`

Here expected net recovered value means the failed trip's cargo eventually banked, discounted by salvage loss, recovery failure and incremental recovery supplies. It is zero if recovery is abandoned. Record that value once against the originating haul; do not also count it as newly generated loot on retrieval. There is no risked-equipped-gear subtraction. Compare total time across the initial and recovery trips as well as value, downside variance and progress toward a specific recipe.

Illustration only: day at 80% extraction, 100 haul, 30 expected net recovery after failure and 15 initial supplies yields 71 settled value. Night at 40%, 260 haul, 50 net recovery and 30 supplies yields 104. Night has greater upside, but could still be worse per minute if its full trip/recovery cycle takes much longer. These are diagnostic assumptions, not forecasts or tuned rewards.

Night and later expedition threat bands should have substantially better upside for prepared, skilled players. Day should still support reliable materials, learning, faction goals and specific routes. Avoid forcing night farming for every ordinary upgrade. Currency, affix rerolls, recipes and base progression can absorb earned resources; durability and replacing death-lost secured gear are not economy sinks.

Prevent simple economy exploits from the beginning: no repeat grants of starter equipment for salvage; no unlimited rewards from summoned/extraction enemies; no chest reroll by reopening UI; no repeat rewards from reconnect; no duplicate cache claims or transactions on crash recovery. Track item instances and their secured provenance separately from item definitions.

## 9. City, day/night, enemies and factions

Build a sprawling city as a graph of authored districts and interiors with bounded loading/simulation. A huge continuous coordinate plane would add performance and authoring work without guaranteeing exploration. Stable geography gives knowledge value; authored variable patrols, caches, doors and events give repeat visits variation.

Each district needs a landmark, distinctive traversal, a resource identity, enemy composition, a local mystery, a boss or major threat, and a route that changes with knowledge or investment. Long-term candidates include the industrial fringe, commercial roofs, flooded transit and a sealed research core. These are roles for future content, not a requirement to build four zones immediately.

Fast traversal needs deliberate geography. Maintain combat pockets, approach routes, pursuit spaces, shortcuts and extraction exposure. Do not counter mobility by simply placing invisible walls everywhere. A player who learns a safer route should benefit; profitable objectives can still require an exposed interaction or deliberate confrontation.

### Fight, sneak or go around

Support frontal combat, stealth and alternate traversal as intentional approaches to the same city. Prototype line of sight, occlusion, audible movement/attacks, an understandable suspicion→alert→search response, and bounded pursuit. Patrol gaps, cover, interior passages and vertical paths create opportunities to observe and act; stealth is more than crouching to reduce a detection radius. Enemies should not know the player's location globally after one alarm.

High-value objectives need both a combat challenge and a credible infiltration challenge: watchers, overlapping sightlines, exposed interactions or patrol timing can protect a chest without forcing a kill. A stealth specialist can extract worthwhile materials and chest rewards without combat-style bonuses. Kill-specific drops still require defeating that enemy; stealth can supply alternative sources for ordinary progression rather than duplicating every exclusive trophy. Some authored bosses require confrontation, but an optional chest or extreme roaming enemy must not turn every run into a compulsory duel.

### Familiar geography, refreshed opportunities

Keep authored chest sockets, not guaranteed identical chests at every socket. At each new run, choose active sockets and refill active containers from district/depth/value tables, with meaningful variation in patrols and access. A chest is finite within that run; reopening, crossing a streaming boundary, dying/reloading the same run or reconnecting does not refill it. An active ordinary chest starts with actual loot, not the previous run's empty state. Persistent death caches are separate objects and are never replaced by this reset.

Learning chest spots is valuable. Encourage further exploration with deeper resource tiers, unknown interiors, rare source tables and better-protected high-value sockets. Both fighting and sneaking past those defenders become harder. Avoid making a memorized safe entrance chest the best source of every endgame material. Seed active sockets, loot, affixes and claims with the expedition ID; restarting UI is not a new run. Unique story containers can follow explicit one-time progression rules instead of the ordinary refill contract.

| Period | Challenge | Reward and purpose |
|---|---|---|
| Day | Readable patrols, known routes and ordinary specialists | Reliable supplies, learning, faction objectives and preparation |
| Dusk | Patrol changes, contested routes, warning signs and growing pursuit | Transitional opportunities and a visible decision to stay or leave |
| Night | New predator behaviors, dangerous faction responses, anomalies and optional bosses | Exclusive targets, rare material concentrations and exceptional optional build rewards |

Choose departure time at the hub without waiting for real-world time. Advance one expedition clock shared by the party. Forecast the time remaining and warn before transitions. Time of day, district depth and local alert are separate variables players should understand.

**Elapsed expedition time is its own pressure source.** The longer the run lasts, the stronger the threat and the better the opportunities, including during daylight. Use legible threat bands adding stronger patrols, enemy-affix budgets, rare encounters and new high-value caches/events. Day/night changes the ecology; it must not be the only source of escalation or a reset that makes a very long run safe at dawn. Show the current band, what changes next and where higher-value opportunities appeared. Exact timings and whether escalation ultimately caps are open tuning questions.

Stronger rewards must have sources and exposure. Do not simply multiply every safe kill or retroactively improve an already claimed chest because the player waited. Later rewards belong to newly activated encounters/events or properly seeded caches in the relevant threat band. Camping the entrance can increase danger without granting a risk-free jackpot. Players choose between extracting a rare find now and exposing their accumulated unsecured haul to the next tier.

Night must remain readable. Silhouettes, attack cues and safe response information survive darkness and effects settings. Increase danger through behavior, composition, persistence of pursuit and consequences. Do not just shorten every tell or make enemies invisible.

Enemies should form useful compositions: a frontliner creates pressure, a marksman controls a lane, a support unit changes priorities, a flanker punishes tunnel vision. Give each a resource or faction association so enemies matter to route planning as well as combat. Prefer a few distinct roles over many reskinned stat variants. Bosses test established skills, reward targeted progress and can gate deeper optional routes without unexpectedly trapping every expedition.

### Enemy affixes and the decision not to fight

Enemy modifiers are distinct from item affixes, but use similarly explicit definitions. Roll compatible behaviors/resistances within a threat budget; expose major traits through names/icons, silhouette/effects and observable tells before the player is trapped. Start with simple single traits, then allow combinations at high depth or elapsed threat. Candidate examples: a shield regenerator, a relay sharing defenses with nearby units, a pursuit specialist or a retaliatory discharge. These are proposed behaviors, not a requirement to author every one initially.

At the highest optional difficulty, some combinations are meant to feel unfair: a shield-regenerating hunter with close-range retaliation may be a terrible fight for a bleed build. The correct answer can be to sneak around, break contact, change the route, return with another preset or take the risk for a valuable drop. Do not promise every enemy is killable with every build. Preserve readable rules and an escape/bypass at the encounter-design level; difficulty must not become an invisible instant kill on the only exit.

Tie reward budget to the rolled threat: higher expected material yield, access to a rarer table or improved rare-drop chance. Display the reason an exceptional target is worth considering. Keep probabilities bounded and separate loot RNG from combat/cosmetic RNG. Evaluate combinations, not just affix count: two interacting traits can be far more dangerous than three weak ones. Mandatory bosses need curated affix eligibility; exclude combinations that create invulnerability, broken AI or unavoidable progression locks. Do not pay repeatedly for summoned units, regenerated shields or deliberately prolonged combat.

### Boss scale and intimate rivals

Metal Gear Rising: Revengeance supplies the intended contrast: spectacular machines establish the power fantasy, while an opponent near the player's own size can be the greatest threat. Include drones, tanks, mechanical beasts, squads and occasional massive bosses, but make human-scale cyborg rivals a major boss category. Physical size is not the difficulty ladder.

These duels should feel like facing another capable fighter: spacing, feints, defense, recovery, mobility, status interaction and a recognizable personal loadout. A rival can counter the player's approach without copying all inputs perfectly or ignoring its own commitments. Let players learn which tools disrupt its pattern and construct their own setup/payoff. Use the existing rival as a staging/behavior reference, not a requirement that every duel repeat its grenade puzzle. Large enemies offer weak-point, positioning and environmental spectacles; intimate bosses test detailed counterplay. Both need production budgets, so the slice should prove one human-scale rival before building a giant roster.

Start factions with conflicting goals and observable actions: one restores infrastructure, one salvages or monopolizes it. Their patrols, caches, contracts and access permissions make them tangible. Reputation can change services and routes later. A fully simulated citywide war is outside the first production scope.

## 10. Story and environmental discovery

Create a short narrative bible before producing dozens of logs. It must answer what caused the ruin, why the night is dangerous, what the factions want, how the player returns after death, why recovered technology increases power, and what becoming the strongest costs.

One possible premise, **not established canon**: the city's reconstruction network stores both machine patterns and fragments of human memory. The blackout interrupted it rather than shutting it down. At night, unstable reconstruction cycles reactivate districts and dangerous entities. The player's upgrades use the same technology that caused the disaster, while factions disagree about restoring or destroying it. This links night, loot, reconstruction, infrastructure and identity to one mystery.

Under that candidate fiction, the base reconstructs registered equipment and installed character upgrades, while unregistered field cargo remains at the death site. Successful extraction registers a new pattern or returns the physical item. This explains the secured/unsecured boundary, including a newly found weapon used before extraction, without requiring durability or insurance. The ownership ledger still permits only one usable instance; reconstruction cannot be exploited to duplicate a weapon by dropping it before dying. Alternative lore is welcome, but must explain the same player-facing contract.

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
| UI and feedback | Live inventory retains character control in solo/co-op; ordinary parry/hit feedback is local; shared cinematic transitions require explicit synchronized rules |
| Death caches | Host records cargo, provenance, owner and location; only an authorized claim can move it; returning cargo still needs extraction |

Maintain a small explicit save lifecycle: `hub → deployed → resolved(extracted/dead) → hub`. Recovery caches have their own durable lifecycle: `unclaimed → carried(unsecured) → banked`, with a new cache on another death while carrying them. Save expedition/cache/transaction IDs, item instance IDs, origin and secured status. Deployment changes the location of secured gear, not its ownership or death protection. Extraction atomically promotes unsecured cargo; death atomically retains secured belongings and moves eligible unsecured cargo into a cache. Completing an extraction, death resolution or cache claim twice must have the same outcome as completing it once. Track terminal per-player outcomes within the party's active expedition; the party becomes deployable again only when all participants resolve.

Use versioned local saves, temporary-file/atomic replacement, a known-good backup and visible failure reporting. Recovery uses a consistent checkpoint containing both loot/world state and player inventories. Persist that complete checkpoint at each successful individual extraction, and acknowledge banked rewards only after the durable write succeeds. Do not independently restore stale stash and fresh cargo. An ordinary host crash may replay uncommitted field actions since the checkpoint; it must preserve acknowledged extraction outcomes. Backup recovery after storage corruption can lose more recent progress and must say so explicitly. Trusted local saves are not a cheat-proof online economy.

Test disconnect during revive, pickup, cache recovery, reforge and extraction; repeated requests; death concurrent with extraction completion; host closure after one player exits; full storage; corrupted save; and a schema migration. Include newly found gear equipped before death and secured gear unequipped before death. These tests matter more to an extraction game than adding another weapon before inventory ownership is reliable.

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

Carry forward **specifications and learning**: movement traces, timings, enemy roles, tether concept, string grammar, training tools and feedback vocabulary. Reinterpret starting mobility, upgrade allocation, balance, immunity, resource coupling, rival behavior and style. A reference trace records the current advanced controller; it is not an instruction to give every move to a new character. Replace the wave director, fixed arena, singleton player/camera, localStorage progression and procedural art/audio generation. Most production code will be new.

The old [3D plan](3d-plan.md) concerns a separate 3D lane and its no-asset constraints. It does not govern this new 2D, authored-asset direction.

Official capability/licensing references: [Godot 2D lighting](https://docs.godotengine.org/en/stable/tutorials/2d/2d_lights_and_shadows.html), [Godot multiplayer](https://docs.godotengine.org/en/stable/tutorials/networking/high_level_multiplayer.html), [Godot license](https://godotengine.org/license/), [Unity 2D/URP](https://docs.unity.com/en-us/engine/6000.3/manual/unity2d/2d-urp), [Unity networking](https://docs.unity.com/en-us/multiplayer/netcode/netcode), [Unity Personal](https://unity.com/products/unity-personal), [Unreal Paper 2D](https://dev.epicgames.com/documentation/en-us/unreal-engine/2d-in-unreal-engine), [Unreal networking](https://dev.epicgames.com/documentation/en-us/unreal-engine/networking-overview-for-unreal-engine), [Unreal licensing](https://www.unrealengine.com/license). These establish capabilities and terms, not the subjective ranking. Review distribution terms at release; no pricing forecast is needed for this decision.

## 15. A production plan with gates, not deadlines

No fixed deadline changes scheduling freedom. It does not eliminate maintenance, animation multiplication, integration work or the need to finish a playable loop. Expand when a gate passes, not when a calendar milestone arrives.

| Gate | Deliverable | Evidence required before proceeding |
|---|---|---|
| A. Preserve the reference | Tagged/source-preserved browser build, action/movement measurements, known-rule defect list | A repeatable basis for comparing responsiveness and behavior |
| B. Combat + asset sample | Godot room, one weapon initially, melee/ranged enemies, bounded starter controller, live inventory, authored sprite/effect/SFX samples | Responsive starter works without tether/double dash; inventory retains combat control; tells/readability and asset revision are practical |
| C. LAN risk | Two separate PC clients using starter and earned-mobility test loadouts, defense and live inventory | No recurring client-only unavoidable hits, duplicate hits or global feedback pauses; inventory does not capture the controller |
| D. Expedition + save | Hub, small district, objective, cargo, two exits, persistent secured gear, death cache and retrieval | Extraction, death and a second recovery death resolve correctly; no slot-based protection exploit or duplicate committed item |
| E. Complete vertical slice | Two-weapon setup/payoff, presets, small affix/reforge pools, optional extreme enemy, stealth, refreshed chests, time escalation, day/night and a small story | Testers voluntarily replay, switch builds, recover cargo and make different fight/bypass/push/extract choices |
| F. Production expansion | Next weapon family and district, then broader progression/story | Measured asset throughput and actual content costs support the next addition |

**Complete slice scope:** one hub with stash, workshop/processor, a minimal reforge function, named presets, training and one base upgrade; one district with three small connected subareas and a stealth/bypass route; two equippable weapon families proving a primary/secondary interaction, four selectable modules and one consumable utility; a small elemental matchup set and item-affix pool; four ordinary enemy roles, a small compatible enemy-affix pool and one optional human-scale rival; one main objective and side opportunity; two exits; three material classes with a candidate shared credit; elapsed-threat bands and day/night change; refreshed authored chest sockets; persistent death-cache recovery; one discoverable permanent upgrade and one earned movement option; one complete lore mystery; two-player LAN; authored visual/SFX samples and a small adaptive score.

This is the destination of several gates, not the first coding sprint. Gate B is much smaller. The clarified direction adds recovery, a second equipped weapon and live inventory to the validation work; acknowledge that production cost. If the slice is too expensive, reduce subarea, enemy or art variation counts while retaining the secured-gear/unsecured-haul rule, recovery, action-capable inventory and one complete multi-item workflow. Do not shrink it back to full gear loss or a one-weapon damage comparison.

Defer a massive city, four-player balancing, many weapon families, multiple fully animated characters, extensive base automation, portable cross-campaign characters, online services and a full soundtrack catalog. These remain possible ambitions; they should not block proving the game.

### Acceptance and playtest plan

| Question | Test and provisional acceptance target |
|---|---|
| Is the floor demanding for the right reasons? | After brief optional training, testers identify required defensive responses and explain most deaths. Separate missed cues, mistaken inputs and bad decisions |
| Does mastery matter? | Compare novice and experienced players on fixed starter gear; experts should use fewer supplies and win harder encounters without one repeated universal answer |
| Is style worth pursuing? | Compare varied offense, parry-focused and cautious play across compositions; each has contexts of value, and no farming loop generates unlimited rewards |
| Is growth meaningful? | Return to the same early encounter with later gear; clear advantage is visible while deeper/night content still demands execution |
| Are stakes productive? | Players accurately predict that secured gear survives and new finds drop even when equipped; observe early exits, pushes, recovery attempts and voluntary abandonment without changing the protected-gear premise |
| Does danger justify staying? | Track survival, net settled reward/minute including recovery, threat band, night and route choice by skill/build; keep early trips useful and later rewards materially tempting |
| Does the interface support action? | While inventory is open, run/jump/dodge/defend/attack/switch/use supplies; test pointer/focus conflicts, held inputs, drag cancellation, accidental salvage and blocked sightlines |
| Does the build workflow work? | Execute pulse → shield down → dagger bleed → primary conversion; verify failed setup feedback, duration/refresh rules, resistant targets and an alternative build |
| Is experimentation inexpensive? | Save/apply two functional presets; switch without rebuilding gear or expensive respecs; test a poor affix, a desirable roll and bounded reforge targeting |
| Do elements and enemy traits inform decisions? | Players recognize a favored/resisted matchup, choose to fight or bypass an extreme optional roll, and explain its reward premium before committing |
| Is recovery trustworthy? | Die, retrieve most cargo, die carrying it again and recover later; preserve original item rolls/IDs, earlier untouched caches and protection of owned spares |
| Does mobility progress? | Starter clears baseline routes without tether/double dash; an earned movement build opens useful options while early pursuit and later threats still function |
| Is repeat exploration worthwhile? | Revisit a socket across runs, verify refill only on a new run, then compare a known safe route with a deeper high-value infiltration/combat route |
| Does LAN preserve skill? | Test wired/Wi-Fi on two PCs; simulate 10/30/60 ms round-trip delay, jitter and 1–3% loss as exploratory conditions; establish the supported envelope from results |
| Are saves trustworthy? | Fault-test deployment, pickup, extraction and return; repeated completion is idempotent; recovery reports its last consistent checkpoint |
| Does presentation scale? | Target 60 fps on declared minimum hardware in the busiest intended scene; inspect frame-time spikes/percentiles, two-player VFX and audio cue masking |
| Can one creator maintain it? | Replace one animation, add one item and author one room through the intended content workflow; record total cleanup/integration time, not generation time alone |

Record deaths by source/phase, incoming simultaneous threats, resources at death, attacks selected, style events, supplies consumed, extraction time, unsecured cargo value, cache claims, time spent recovering, affix rolls, build picks, threat bands, bypass choices and reward transactions. Secured gear value describes progression, not death loss. Start with local logs; a hosted analytics service is unnecessary. Use a small repeatable tester cohort for iteration, and avoid treating a handful of observations as statistical proof.

The immediate next implementation step is **Gate B with early Gate C work**: preserve the browser reference, build responsive starter movement/attack/defense and live inventory in Godot with imported assets, compare a separately equipped tether/extra-dash test build, and make a second LAN client work before producing the city. Add the second weapon and complete setup/payoff at Gate E. Continue expanding when those playable results meet the combat and LAN criteria.

## 16. Verification record and detailed evidence

- Existing smoke test, 90 simulated seconds per mode: demo, endless, boss, duel and training exercised. Its original run reported an external Google Fonts certificate error. A second run fulfilled only the external font stylesheet with empty CSS in a temporary adapter; original gameplay assertions remained unchanged and all five modes passed. No certificate verification was disabled.
- The test uses invincibility, random inputs, forced boss transitions and bounds checks. It does not prove that every wave was cleared, that default difficulty is fair, or that players enjoy it.
- `node docs/audit-combat-probes.cjs` reproduced the damage-setting, committed-parry and counter-healing findings against actual methods with presentation hooks stubbed. It is a logic probe, not a complete combat simulation.
- Native browser inspection established that the current build loads and demonstrated training, attacks and an enemy encounter. It did not provide a formal audio quality review or reliable input-latency measurement.
- No gameplay code or production assets were changed, and no new engine project was created. The deliverables are the audit and its reproducible supporting evidence.
- The November 15 design revision updates progression, protected equipment, recoverable cargo, live inventory, build workflows, item/enemy affixes, elements, boss scale, stealth, repeat loot and earned mobility. It does not add another runtime inspection or establish balance results. Recovery fractions, affix weights, element names, exact slot counts and threat-band timing remain prototype decisions.

Supporting reviews: [combat findings](audit-combat-notes.md), [systems findings](audit-systems-notes.md), [technology and asset findings](audit-technology-notes.md), [executable combat probes](audit-combat-probes.cjs). The consolidated policies in this document are the recommended baseline where the supporting reviews describe alternatives.
