# Wixbury — founding design document

> Paste this document at the start of every Claude coding session.
> It is the single source of truth for all simulation constants and design decisions.

---

## The city

**Name:** Wixbury  
**Setting:** A small post-industrial city in northern England. The simulation begins in an era with the feel of early 1990s England — recession-era economics, working-class culture, a fading industrial identity. The city has no fixed end-point; if citizens drive it there, Wixbury could become something unrecognisable decades down the line.

**Founding population:** 200 citizens, procedurally generated with varied ages, traits, jobs, and home districts.

**Starting geography:** 3–4 districts at founding. Suggested starting layout:
- **Town centre** — shops, the council offices, the gazette, the pub
- **Millside** — working-class residential, close to old industrial sites
- **Harrowgate** — slightly more affluent residential, professionals and merchants
- **The Works** — light industry, warehouses, the football ground

Districts expand, change character, and new ones emerge organically as the simulation progresses.

---

## Time

**Tick rate:** 1 real-world minute = 1 simulated hour  
**Derived constants:**
- 1 real-world hour = 60 simulated hours (~2.5 simulated days)
- 1 real-world day = 24 simulated days
- 1 real-world week ≈ 4 simulated months
- 1 real-world year ≈ 4 simulated years

**Tick constant name in code:** `TICK_RATE_MS = 60000` (milliseconds per simulated hour)  
This value must never be hardcoded anywhere else in the codebase. All time calculations derive from this single constant.

---

## Citizen schema

Every citizen is a row in the `citizens` table. The trait fields are floats between 0.0 and 1.0.

```
citizens
  id                uuid, primary key
  name              string
  age               integer (in simulated years)
  born_at           simulated timestamp
  died_at           simulated timestamp, nullable
  home_district_id  uuid, foreign key → districts
  job_type          enum (see job types below)
  biography         text  — LLM-generated prose summary, updated on major events

trait_ambition        float  0.0 (no drive) → 1.0 (ruthlessly ambitious)
trait_honesty         float  0.0 (corrupt) → 1.0 (scrupulously honest)
trait_sociability     float  0.0 (reclusive) → 1.0 (deeply social)
trait_empathy         float  0.0 (selfish) → 1.0 (deeply altruistic)
trait_risk_tolerance  float  0.0 (very cautious) → 1.0 (reckless)
trait_religiosity     float  0.0 (secular) → 1.0 (devout)
trait_political       float  0.0 (conservative) → 1.0 (progressive)
```

**Needs (float values, 0.0–1.0, decay each tick and are replenished by actions):**
```
need_hunger   float  0.0 (starving) → 1.0 (full) — decays over time, replenished by eating
need_energy   float  0.0 (exhausted) → 1.0 (rested) — decays while active, replenished by sleeping
need_social   float  0.0 (isolated) → 1.0 (fulfilled) — decays over time, replenished by interactions
```
When any need drops below 0.2 it becomes the citizen's priority, overriding other decisions until resolved.

**Starting job types (Phase 1):** unemployed, labourer, shopkeeper, teacher, doctor, councillor, journalist, publican, factory_worker, clergy, footballer

---

## Relationships

Every pair of citizens who interact accumulates a relationship record.

```
relationships
  id            uuid, primary key
  citizen_a_id  uuid, foreign key → citizens
  citizen_b_id  uuid, foreign key → citizens
  score         float  -1.0 (bitter enemies) → 1.0 (deeply bonded)
  type          enum: acquaintance, friend, family, romantic, rival, colleague
  formed_at     simulated timestamp
  last_updated  simulated timestamp
```

Relationships form when citizens share the same location during a tick. Score drifts based on trait compatibility and shared events.

**Relationship cap:** 50 per citizen. Once a citizen reaches 50 relationships, a new one can only form if it replaces the lowest-scored existing acquaintance.

---

## Events

Every significant simulation action writes to the events table. This is the raw material for the newspaper and historical archive.

```
events
  id            uuid, primary key
  type          enum (see event types below)
  occurred_at   simulated timestamp
  district_id   uuid, nullable — where it happened
  citizen_ids   uuid[]  — citizens involved
  data          jsonb   — event-specific payload (varies by type)
  significance  float   0.0 → 1.0  — computed by significance scorer
  written_up    boolean — has the newspaper used this event?
```

**Significance threshold for newspaper consideration:** 0.6  
Events below this score are logged but never written up.

### Event types active from founding

| Category | Event types |
|---|---|
| Social | birth, death, marriage, divorce, argument, reconciliation, scandal |
| Political | election, council_vote, corruption_allegation, policy_passed |
| Economic | business_opened, business_closed, strike, unemployment_spike, promotion |
| Culture | trend_emerged, subculture_formed, public_gathering |
| Sport | match_result, promotion, relegation, transfer |
| Location | pub_visit, church_visit, workplace_incident |

**Match results:** Random until footballer citizens have accumulated sufficient trait history (approx. 1 simulated season). Once established, results are weighted by the squad's average fitness, morale, and ambition traits. The transition happens automatically — no manual switch required.

Crime, disasters, and migration are deferred to Phase 5.

---

## Starting districts

These four districts exist as database records on founding day. Boundaries are fixed at founding; new districts emerge organically as the simulation progresses.

| District | Character | Key locations |
|---|---|---|
| Town centre | Commercial and civic heart | Council offices, The Wixbury Gazette, shops, The Miner's Rest pub |
| Millside | Working-class residential | Housing terraces, old industrial sites, community spaces |
| Harrowgate | Slightly more affluent residential | Professional housing, St. Aldred's Church, merchants |
| The Works | Light industry and leisure | Factories, warehouses, Wixbury Park Rangers ground |

---

## The newspaper

**Name:** The Wixbury Gazette  
**Frequency:** Once per simulated week (every 168 ticks / 168 real-world minutes)  
**Voice:** Neutral, local, understated. Reads like a real small-town English paper — not sensationalist, not literary. Factual with a hint of community investment.

**Edition structure:**
- Lead story — the highest-significance event of the week
- 2–3 secondary stories — other events above the significance threshold
- Births, deaths, marriages — always included if any occurred
- Football result — always included if Wixbury Park Rangers played

**LLM prompt contract:** The article generator receives a structured JSON payload of flagged events and returns formatted article text. It must not invent events beyond what is in the payload.

---

## The live viewer experience

Wixbury is not a website people browse — it is a broadcast people tune into. The core visitor experience is a live camera floating over the city, showing citizens going about their lives in real time. Visitors observe; they never interact.

**The concept:** A floating camera over Wixbury that anyone can tune into at any moment. Citizens walk to work, sit in the pub, attend a football match, argue in the street, fall asleep at home. All of it is visible, live, as it happens.

**How it works technically:**
- The sim engine writes citizen position, current activity, and emotional state to the database every tick
- A WebSocket connection pushes each tick's state to connected browsers instantly
- The browser renderer interpolates smoothly between tick positions — citizens appear to walk fluidly rather than teleport
- No additional simulation work is required; the camera is purely a display layer over existing data

**Core viewer modes:**

| Mode | Description |
|---|---|
| City overview | Default view — all citizens visible as moving figures across the full map |
| Citizen cam | Click any citizen to lock the camera onto them and follow their day |
| Location cam | Lock onto a specific place — The Miner's Rest, the factory floor, the football ground |
| Event cam | Camera automatically cuts to wherever a significant event just fired |

**The citizen cam** is the emotional heart of the experience. A visitor locks onto a citizen, watches them walk from Millside to the market, sees them stop and interact with someone they have a poor relationship with, follows them to The Miner's Rest at 6pm. The camera follows until the visitor unlocks it or the citizen goes to sleep.

**The live commentary feed** runs alongside the camera as a quiet sidebar — not dramatic narration, but the understated tone of a local observer noting what they see:
> *Mara Voss, 34, arrives at The Miner's Rest. 6:14pm.*
> *Roy Finch and Del Barrow have been sitting at the same table for 40 minutes.*
> *The pub is unusually busy for a Tuesday.*

Commentary lines are generated from event data — no LLM call required for routine lines. LLM narration is reserved for genuinely significant moments.

**Visual representation (phased):**
- Phase 4 launch — abstract coloured dots moving on a schematic map. Simple, still compelling.
- Phase 5+ — upgrade to illustrated top-down figures without touching the sim or data layer.

**Key design rule:** The camera adds zero load to the simulation engine. It reads from the database; it never writes. All visual fidelity decisions are independent of the simulation and can be upgraded at any time.

---

## Founding institutions

These exist as database records on day one, not emergent from the simulation.

| Institution | Type | District | Notes |
|---|---|---|---|
| Wixbury Town Council | Government | Town centre | 5 elected councillors at founding |
| The Wixbury Gazette | Media | Town centre | One journalist citizen assigned |
| St. Aldred's Church | Religion | Harrowgate | One clergy citizen assigned |
| The Miner's Rest | Social | Millside | The pub; highest relationship formation rate of any location |
| Wixbury Park Rangers | Sport | The Works | Plays weekly; results affect citizen morale |

---

## Key architectural rules

These must be respected in every phase of development.

1. **Sim engine and website are separate processes.** They communicate only through the database and a read-only API. Never import sim logic into the frontend.
2. **`TICK_RATE_MS` is the only place time is defined.** Everything else derives from it.
3. **Every phase ends with a runnable deliverable.** No phase produces only scaffolding.
4. **One Claude conversation per subsystem.** Don't mix citizen agent code with database schema work. Context clarity produces better output.
5. **The events table is the city's memory.** If it didn't write an event row, it didn't happen.

---

## Resolved decisions

All founding decisions have been made. No open questions remain before Phase 1.

| Decision | Resolution |
|---|---|
| Citizen needs model | Three float bars — hunger, energy, social — each 0.0–1.0, decaying each tick |
| Needs priority threshold | Any need below 0.2 overrides all other citizen decisions |
| Max relationships per citizen | Capped at 50; lowest-scored acquaintance displaced when cap is reached |
| Core visitor experience | Live camera broadcast — visitors tune in and watch, never interact |
| Citizen movement rendering | Position interpolation between ticks — smooth animation at 60fps |
| Visual fidelity at launch | Abstract coloured dots on schematic map; upgradeable in Phase 5 |
| Commentary feed | Event-driven text sidebar; LLM only for significant moments |
| Match result determination | Random until players are established (~1 sim season), then trait-driven |
| Starting districts | Town centre, Millside, Harrowgate, The Works — confirmed |
