# Phase 5 — Implementation Plan

> Systems are ordered by dependency. Each system must be fully implemented and committed before the next begins.
> Per CLAUDE.md: one subsystem per session.

---

## System order

| # | System | Depends on | LLM cost |
|---|--------|-----------|----------|
| 1 | Population dynamics | Nothing (schema already partial) | No |
| 2 | Economy engine | Population (citizens die/born, job pool changes) | No |
| 3 | Political system | Economy (candidates need wealth/status), Population (voters) | No |
| 4 | District evolution | Economy (businesses exist), Politics (policies affect districts) | No |
| 5 | Historical archive | All above (summarises everything) | Yes — approval needed before wiring |

---

## System 1 — Population dynamics

**Goal:** Citizens age, die of old age or need crisis, are born to romantic couples, and new citizens migrate in.

### Codebase state
- `diedAt Int?` already on `Citizen` model — no schema migration needed
- `bornAt Int` already on `Citizen` model — seeded as `0` for all initial citizens (tick 0)
- `age Int` already on `Citizen` model — never updated after seed, needs incrementing
- `main.ts` already queries `where: { diedAt: null }` for loading living citizens
- In-memory `citizens` array is passed by reference — mutations propagate automatically

### New constants (`packages/sim-engine/src/constants.ts`)
```typescript
export const TICKS_PER_SIM_YEAR = TICKS_PER_SIM_DAY * 365;   // 8760 ticks ≈ 6 real days
export const CITIZEN_MIN_DEATH_AGE = 60;
export const CITIZEN_MAX_DEATH_AGE = 90;
export const BIRTH_PROBABILITY_PER_TICK = 0.0002;             // ~1 birth per 5000 ticks per couple
export const MIGRATION_PROBABILITY_PER_TICK = 0.0005;         // ~1 arrival per 2000 ticks
export const CRISIS_DEATH_CONSECUTIVE_TICKS = 48;             // citizen dies if all needs at 0 for 48 ticks (2 sim days)
```

### New event types (`packages/shared/src/types/event.ts`)
Add to `EventType` enum:
```typescript
CitizenBorn = 'citizen_born',
CitizenDied = 'citizen_died',
CitizenMigrated = 'citizen_migrated',
```

### New file: `packages/sim-engine/src/population-engine.ts`
Class `PopulationEngine` with:
- `tickAgeing(citizens, tickNumber, prisma)` — on `tickNumber % TICKS_PER_SIM_YEAR === 0`, increment `age` in memory and in DB for all living citizens
- `checkNaturalDeaths(citizens, tickNumber)` — for each citizen with `age >= CITIZEN_MIN_DEATH_AGE`, apply a per-tick death probability that scales linearly from `0` at `MIN_DEATH_AGE` to `1` at `MAX_DEATH_AGE`. Returns `PendingEvent[]` of `CitizenDied` events.
- `checkCrisisDeaths(citizens, tickNumber, consecutiveCrisisMap)` — tracks how many consecutive ticks each citizen has had all three needs below `NEEDS_CRISIS_THRESHOLD`. Returns `CitizenDied` events for any exceeding `CRISIS_DEATH_CONSECUTIVE_TICKS`.
- `killCitizen(citizen, citizens, tickNumber, prisma)` — sets `diedAt` in DB, splices citizen from in-memory array
- `checkBirths(citizens, relationships, tickNumber, prisma)` — iterates romantic couples where both partners are alive and under 45 simulated years. Each pair has `BIRTH_PROBABILITY_PER_TICK` chance of producing a birth. Calls `createCitizen` with inherited traits (average of both parents ± 0.15 random noise, clamped 0–1). Pushes new citizen to DB and in-memory array. Returns `CitizenBorn` events.
- `checkMigration(citizens, tickNumber, prisma)` — `MIGRATION_PROBABILITY_PER_TICK` chance per tick of a new citizen arriving with fully random traits. Randomly assigns a district and job type. Returns `CitizenMigrated` event.

### Trait inheritance for births
```typescript
function inheritTrait(parentA: number, parentB: number): number {
  const base = (parentA + parentB) / 2;
  const noise = (Math.random() - 0.5) * 0.3; // ±0.15
  return Math.max(0, Math.min(1, base + noise));
}
```
Newborn citizen: age 0, `bornAt = tickNumber`, random job `Unemployed` until they reach working age (16 sim years = 16 * TICKS_PER_SIM_YEAR ticks). Job assigned at working age in a future tick (flag with a `citizenBecameAdult` event or check age each year tick).

### Significance scores (add to `packages/sim-engine/src/significance-scorer.ts`)
```typescript
[EventType.CitizenBorn]: 0.70,
[EventType.CitizenDied]: 0.80,
[EventType.CitizenMigrated]: 0.30,
```
Apply prominence boost for deaths of prominent/noteworthy job citizens as usual.

### Tick engine changes (`packages/sim-engine/src/tick-engine.ts`)
- Instantiate `PopulationEngine` alongside `RelationshipEngine`, pass to `startTickEngine`
- Each tick: call `populationEngine.checkNaturalDeaths`, `checkCrisisDeaths`, `checkBirths`, `checkMigration` — collect returned `PendingEvent[]` into `allEvents`
- On year boundary (`tickNumber % TICKS_PER_SIM_YEAR === 0`): call `tickAgeing`
- Log `population` count (living citizens length) in day-complete log line

### DB sync changes (`packages/sim-engine/src/db-sync.ts`)
- Add `syncCitizenAge(citizenId, age, prisma)` — used by `tickAgeing` to update `age` column
- Death writes `diedAt: tickNumber` directly in `killCitizen` (not in `syncCitizensToDb`)
- New citizen DB insert factored into `population-engine.ts` (not seed.ts)

### No schema migration required
All columns (`age`, `bornAt`, `diedAt`) already exist.

---

## System 2 — Economy engine

**Goal:** Citizens earn wages, accumulate wealth, spend it on needs. Businesses open and close. Citizens change jobs based on wealth and ambition.

### Schema migration (`packages/db/prisma/schema.prisma`)
Add to `Citizen`:
```prisma
wealth Float @default(0)
```

New model:
```prisma
model Business {
  id         String   @id @default(uuid())
  name       String
  type       String   // enum: pub, shop, factory, clinic, school, church
  districtId String
  district   District @relation(fields: [districtId], references: [id])
  ownerId    String?  // nullable — some businesses are institutions
  openedAt   Int
  closedAt   Int?
  employeeIds String[]

  @@map("businesses")
}
```

Add `Business[]` relation to `District`.

### New constants (`packages/sim-engine/src/constants.ts`)
```typescript
// Base hourly wages per job type — applied each tick a citizen is Working
export const WAGE_PER_TICK: Record<string, number> = {
  unemployed: 0,
  labourer: 2,
  factory_worker: 2,
  shopkeeper: 3,
  teacher: 4,
  publican: 3,
  footballer: 5,
  doctor: 7,
  journalist: 4,
  clergy: 2,
  councillor: 5,
};
export const BUSINESS_OPEN_WEALTH_THRESHOLD = 500;   // citizen needs £500 to open a business
export const BUSINESS_FAIL_PROBABILITY_PER_WEEK = 0.02;
export const JOB_CHANGE_WEALTH_THRESHOLD = 200;      // min wealth to seek a better job
export const JOB_CHANGE_CHECK_INTERVAL_TICKS = TICKS_PER_SIM_WEEK * 4; // quarterly
```

### New event types (`packages/shared/src/types/event.ts`)
```typescript
BusinessOpened = 'business_opened',
BusinessClosed = 'business_closed',
Promotion = 'promotion',
UnemploymentSpike = 'unemployment_spike',
Strike = 'strike',
```

### New shared type (`packages/shared/src/types/business.ts`)
```typescript
export enum BusinessType {
  Pub = 'pub',
  Shop = 'shop',
  Factory = 'factory',
  Clinic = 'clinic',
  School = 'school',
  Church = 'church',
}

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  districtId: string;
  ownerId: string | null;
  openedAt: number;
  closedAt: number | null;
  employeeIds: string[];
}
```

### Update `Citizen` interface (`packages/shared/src/types/citizen.ts`)
Add `wealth: number` field.

### New file: `packages/sim-engine/src/economy-engine.ts`
Class `EconomyEngine` with:
- `tickWages(citizens)` — add `WAGE_PER_TICK[citizen.job]` to `citizen.wealth` for each citizen currently `Working`
- `checkBusinessOpportunities(citizens, tickNumber, prisma)` — citizens with `wealth >= BUSINESS_OPEN_WEALTH_THRESHOLD` and high ambition (`> 0.7`) have a small probability of opening a business. Deducts wealth, creates `Business` DB record. Returns `BusinessOpened` events.
- `checkBusinessFailures(businesses, tickNumber, prisma)` — each business has `BUSINESS_FAIL_PROBABILITY_PER_WEEK` chance of closing each sim week. Sets employees to `Unemployed`. Returns `BusinessClosed` events.
- `checkJobChanges(citizens, tickNumber, prisma)` — runs every `JOB_CHANGE_CHECK_INTERVAL_TICKS`. Citizens with high ambition and sufficient wealth may seek promotion (job type upgrade). Citizens unemployed for > 2 sim weeks actively seek any available job. Returns `Promotion` / job change events.
- `checkUnemploymentSpike(citizens, tickNumber)` — if unemployed > 20% of population, emit `UnemploymentSpike` event.

### Significance scores
```typescript
[EventType.BusinessOpened]: 0.65,
[EventType.BusinessClosed]: 0.70,
[EventType.Promotion]: 0.55,
[EventType.UnemploymentSpike]: 0.80,
[EventType.Strike]: 0.85,
```

### Tick engine changes
- Load businesses from DB on startup alongside citizens
- Call `economyEngine.tickWages` every tick
- Call `economyEngine.checkBusinessOpportunities` and `checkBusinessFailures` on week boundary
- Call `economyEngine.checkJobChanges` on `JOB_CHANGE_CHECK_INTERVAL_TICKS`

### DB sync changes
- Add `wealth` to `syncCitizensToDb` update payload
- Add `syncBusinesses(businesses, prisma)` to db-sync.ts

### Web API additions (`packages/web/src/app/api/`)
- `businesses/route.ts` — list all open businesses with district and employee count
- `businesses/[id]/route.ts` — single business with owner and employee citizen stubs

---

## System 3 — Political system

**Goal:** Council seats are contested by election. Citizens vote based on traits and relationships with candidates. Elected councillors propose policies that affect sim constants.

### Schema migration
New models:
```prisma
model Election {
  id           String @id @default(uuid())
  heldAt       Int
  districtId   String?
  candidateIds String[]
  winnerId     String
  voteData     Json   // { candidateId: voteCount }

  @@map("elections")
}

model Policy {
  id          String  @id @default(uuid())
  title       String
  description String
  proposedBy  String  // citizenId
  passedAt    Int?
  effect      Json    // { constant: string, delta: number }
  active      Boolean @default(false)

  @@map("policies")
}

model Faction {
  id         String   @id @default(uuid())
  name       String
  formedAt   Int
  leaderIds  String[]
  memberIds  String[]
  agenda     Json     // { political: number, economic: string }

  @@map("factions")
}
```

### New constants
```typescript
export const ELECTION_INTERVAL_TICKS = TICKS_PER_SIM_YEAR * 4;  // council term = 4 sim years
export const COUNCIL_SEATS = 5;
export const POLICY_VOTE_THRESHOLD = 3;   // 3 of 5 councillors needed to pass
export const FACTION_FORMATION_THRESHOLD = 5;  // min citizens with similar traits to form faction
export const FACTION_POLITICAL_SIMILARITY = 0.2; // max trait distance to be in same faction
```

### New event types
```typescript
ElectionHeld = 'election',
PolicyPassed = 'policy_passed',
FactionFormed = 'faction_formed',
CorruptionAllegation = 'corruption_allegation',
```

### New file: `packages/sim-engine/src/political-engine.ts`
Class `PoliticalEngine` with:
- `runElection(citizens, tickNumber, prisma)` — identifies candidates (existing Councillors + ambitious citizens who declare). Each living citizen casts a vote. Vote weight = relationship score with candidate (default 0.5 if no relationship) + `(1 - |citizen.traits.political - candidate.traits.political|) * 0.5`. Top `COUNCIL_SEATS` vote-getters become Councillors (job type update). Returns `ElectionHeld` event.
- `proposePolicy(councillors, tickNumber, prisma)` — each sim month, a random councillor proposes a policy. Policy effects modify a constant (e.g. `HUNGER_DECAY_PER_TICK *= 0.9` for a food subsidy policy). Other councillors vote. Returns `PolicyPassed` event if threshold met.
- `applyActivePolicies(policies, constants)` — applies active policy effects to runtime constants. Called once on startup and after each `PolicyPassed` event.
- `checkFactionFormation(citizens, tickNumber, prisma)` — groups citizens by political trait similarity. If a group reaches `FACTION_FORMATION_THRESHOLD` and has no existing faction, creates one. Returns `FactionFormed` events.
- `checkCorruption(councillors, tickNumber)` — councillors with low honesty (`< 0.2`) have a small per-tick chance of a `CorruptionAllegation` event.

### Significance scores
```typescript
[EventType.ElectionHeld]: 0.90,
[EventType.PolicyPassed]: 0.75,
[EventType.FactionFormed]: 0.65,
[EventType.CorruptionAllegation]: 0.85,
```

### Tick engine changes
- On `ELECTION_INTERVAL_TICKS` boundary: call `runElection`
- Weekly: call `checkFactionFormation`, `checkCorruption`
- Monthly: call `proposePolicy`

### Web API additions
- `api/elections/route.ts` — election history with candidates and vote counts
- `api/policies/route.ts` — active and historical policies
- `api/factions/route.ts` — factions with member list

---

## System 4 — District evolution

**Goal:** Districts change character over time. New buildings are constructed. Neighbourhoods can shift from working-class to affluent (or decline).

### Schema migration
New model:
```prisma
model Building {
  id          String   @id @default(uuid())
  name        String
  type        String   // enum: housing, pub, shop, factory, park, church, clinic, school
  districtId  String
  district    District @relation(fields: [districtId], references: [id])
  builtAt     Int
  demolishedAt Int?
  capacity    Int

  @@map("buildings")
}
```

Add to `District`:
```prisma
wealthScore     Float @default(0.5)   // 0 = deprived → 1 = affluent
populationScore Float @default(0.5)   // relative population density
```

### New constants
```typescript
export const DISTRICT_WEALTH_DRIFT_RATE = 0.001;  // per tick, toward mean wealth of residents
export const BUILDING_CONSTRUCTION_INTERVAL_TICKS = TICKS_PER_SIM_YEAR;
export const BUILDING_CONSTRUCTION_WEALTH_COST = 1000;
```

### New event types
```typescript
BuildingConstructed = 'building_constructed',
BuildingDemolished = 'building_demolished',
DistrictEvolved = 'district_evolved',
```

### New file: `packages/sim-engine/src/district-engine.ts`
Class `DistrictEngine` with:
- `tickWealthDrift(districts, citizens, tickNumber, prisma)` — on year boundary, recalculate each district's `wealthScore` as mean wealth of its residents. If change > 0.1, emit `DistrictEvolved` event and update `character` text.
- `checkConstruction(districts, citizens, tickNumber, prisma)` — annually, wealthy citizens (`wealth > BUILDING_CONSTRUCTION_WEALTH_COST`) in a district may pool resources to construct a building. Building type chosen based on district character and existing buildings. Returns `BuildingConstructed` event.
- `checkDemolition(buildings, tickNumber, prisma)` — derelict or low-capacity buildings occasionally demolished.
- `updateDistrictCharacter(district, wealthScore)` — updates `character` string based on `wealthScore` band (e.g. `"deprived industrial"` → `"recovering residential"` → `"affluent professional"`).

### Significance scores
```typescript
[EventType.BuildingConstructed]: 0.65,
[EventType.BuildingDemolished]: 0.60,
[EventType.DistrictEvolved]: 0.70,
```

### Tick engine changes
- Load buildings from DB on startup
- Call `districtEngine.tickWealthDrift` on year boundary
- Call `districtEngine.checkConstruction` and `checkDemolition` on year boundary

### Web API additions
- `api/buildings/route.ts` — buildings per district with type and capacity
- `api/districts/[id]/route.ts` — district detail with wealth score, character history

### Web frontend additions
- District detail page showing character history and buildings
- Map: color districts by `wealthScore` (CSS gradient from grey to gold)

---

## System 5 — Historical archive

> ⚠️ Incurs LLM cost. Get explicit approval before wiring the job to the tick engine.
> Cost estimate: ~1 API call per 8,760 ticks (~6 real days). At ~4k tokens/call: ~$0.05/call. ~5 calls/real month = ~$0.25/month at 15-citizen scale.

**Goal:** At the end of each simulated year, generate an LLM-authored historical summary article covering major events, deaths, births, elections, and business changes.

### Pre-implementation: mocking system

Before writing `HistoricalArchiveJob`, extend the mock LLM infrastructure so all job logic can be tested without API calls. `HistoricalArchiveJob` uses constructor-injected `LLMClient` (same pattern as `NewspaperJob`), so the existing interface already supports this — but `MockLLMClient` needs call tracking and configurable fixture content.

**Enhance `packages/sim-engine/src/llm/mock-llm-client.ts`:**

```typescript
import { LLMClient, LLMResponse } from './llm-client';

export class MockLLMClient implements LLMClient {
  private calls: Array<{ systemPrompt: string; userPrompt: string }> = [];
  private fixtureContent: string = '[Mock LLM output — no API call made]';

  setFixtureContent(content: string): void {
    this.fixtureContent = content;
  }

  getCallCount(): number {
    return this.calls.length;
  }

  getLastCall(): { systemPrompt: string; userPrompt: string } | undefined {
    return this.calls[this.calls.length - 1];
  }

  reset(): void {
    this.calls = [];
    this.fixtureContent = '[Mock LLM output — no API call made]';
  }

  async generate(systemPrompt: string, userPrompt: string): Promise<LLMResponse> {
    this.calls.push({ systemPrompt, userPrompt });
    return {
      content: this.fixtureContent,
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, estimatedCostUsd: 0 },
    };
  }
}
```

**Fixture content for archive tests** — a realistic one-page retrospective. Used by `setFixtureContent` in test setup:

```typescript
// packages/sim-engine/src/llm/__fixtures__/historical-archive-fixture.ts
export const HISTORICAL_ARCHIVE_FIXTURE = `WIXBURY — THE YEAR IN REVIEW: YEAR ONE

It was a year of quiet upheaval for this northern town. The population of Wixbury, never large, shifted perceptibly as three new faces arrived from beyond the district boundaries and two of the founding generation passed away, their names now written into the permanent record.

Margaret Hollis, 74, died in late autumn after a period of declining health. She had worked for thirty years as a shopkeeper in the Town Centre. Roy Finch, 81, followed in winter. Both are survived by neighbours who remember them as unremarkable in the best sense — steady, present, reliable.

On the economic front, The Miner's Rest reported its busiest period on record, attributed by regulars to a run of cold weather and the uncertain employment picture following the closure of two factory positions at The Works. Unemployment in Millside reached a high of twenty-two percent in the third quarter before recovering modestly.

The council held its first election under the new term. Five seats were contested; three incumbents retained their positions. The result was received with characteristic Wixbury indifference.

One child was born this year: a daughter to Elaine and Dennis Park of Harrowgate. They have not yet named her publicly.

The Wixbury Gazette is published weekly. All rights reserved.`;
```

**Test file: `packages/sim-engine/src/jobs/__tests__/historical-archive-job.test.ts`**

Tests to write before implementing the job:
- `run()` makes exactly one LLM call
- LLM call user prompt contains valid JSON parseable as the expected payload shape (`events`, `citizens`, `elections` keys)
- Events below `HISTORICAL_SUMMARY_SIGNIFICANCE_THRESHOLD` are excluded from payload
- `HistoricalSummary` DB record is inserted with correct `simYear`, `yearStart`, `yearEnd`, `content`
- `YearClosed` event is written to the events table
- If zero significant events exist, job still completes (empty events array in payload — no crash)
- `run()` is idempotent: BullMQ `jobId: year-${simYear}` deduplication prevents double insert (test via queue layer, not job directly)

### Schema migration
```prisma
model HistoricalSummary {
  id        String @id @default(uuid())
  simYear   Int     // simulated year number (1, 2, 3 ...)
  yearStart Int     // tick number
  yearEnd   Int     // tick number
  content   String  // LLM-generated prose
  createdAt DateTime @default(now())

  @@map("historical_summaries")
}
```

### New constants
```typescript
export const HISTORICAL_SUMMARY_SIGNIFICANCE_THRESHOLD = 0.65;  // events included in year summary
```

### New event types
```typescript
YearClosed = 'year_closed',
```

### New file: `packages/sim-engine/src/jobs/historical-archive-job.ts`
Class `HistoricalArchiveJob` with method `run(yearStart, yearEnd, simYear, prisma, llmClient)`:
1. Fetch all events in `[yearStart, yearEnd]` with `significance >= HISTORICAL_SUMMARY_SIGNIFICANCE_THRESHOLD`
2. Fetch all citizens born or died in the year
3. Fetch elections held in the year
4. Build structured JSON payload (same pattern as newspaper job)
5. Single LLM call: system prompt establishes Wixbury, voice is a local historian looking back. Returns a one-page prose retrospective.
6. Insert `HistoricalSummary` record.
7. Emit `YearClosed` event.

### Queue integration (`packages/sim-engine/src/queue.ts`)
Add `generate_historical_summary` job type alongside `generate_newspaper_edition`.

### Tick engine changes
- On `TICKS_PER_SIM_YEAR` boundary: enqueue `generate_historical_summary` job with `jobId: year-${simYear}` for deduplication.

### Web API additions
- `api/history/route.ts` — paginated list of historical summaries
- `api/history/[year]/route.ts` — single year's summary

### Web frontend additions
- `app/history/page.tsx` — year browser with summary cards
- `app/history/[year]/page.tsx` — full year retrospective

---

## Cross-cutting changes required by all systems

### `packages/shared/src/types/event.ts`
Each system adds its event types to the `EventType` enum. Additive — no conflicts.

### `packages/sim-engine/src/significance-scorer.ts`
`BASE_SIGNIFICANCE` record must include every `EventType` value. Each system adds its entries. The TypeScript `Record<EventType, number>` type will catch any missing entries at compile time.

### `packages/sim-engine/src/db-sync.ts`
`syncCitizensToDb` must be extended as new fields are added to `Citizen` (`wealth` in System 2). Each system extends this function's `data` payload.

### `packages/sim-engine/src/tick-engine.ts`
New engines are instantiated in `main.ts` and passed into `startTickEngine` signature. Extend signature with each new engine parameter as systems are added.

### `packages/shared/src/types/index.ts`
Export new types from each system (`Business`, `Faction`, `Building`, etc.).

---

## Implementation checklist

### System 1 — Population dynamics
- [x] Add constants to `constants.ts`
- [x] Add `CitizenBorn`, `CitizenDied`, `CitizenMigrated` to `EventType`
- [x] Create `population-engine.ts`
- [x] Update `significance-scorer.ts`
- [x] Update `tick-engine.ts` (wire engine, handle dying/born citizens)
- [x] Update `db-sync.ts` (age sync)
- [x] Update `main.ts` (instantiate engine, pass to tick engine)
- [x] Verify `diedAt` filter in main.ts load query (already present)

### System 2 — Economy engine
- [x] Schema migration: add `wealth` to Citizen, add `Business` model
- [x] Run `prisma migrate dev`
- [x] Add constants to `constants.ts`
- [x] Add `BusinessType` enum and `Business` interface to shared types
- [x] Add `wealth` to `Citizen` interface in shared types
- [x] Add new event types to `EventType`
- [x] Create `economy-engine.ts`
- [x] Update `significance-scorer.ts`
- [x] Update `db-sync.ts` (wealth sync, business sync)
- [x] Update `tick-engine.ts` (wire engine)
- [x] Update `main.ts` (load businesses, instantiate engine)
- [x] Add web API routes for businesses

### System 3 — Political system
- [x] Schema migration: add `Election`, `Policy`, `Faction` models
- [x] Run `prisma migrate dev`
- [x] Add constants to `constants.ts`
- [x] Add new event types to `EventType`
- [x] Create `political-engine.ts`
- [x] Update `significance-scorer.ts`
- [x] Update `tick-engine.ts` (wire engine, election/policy/faction schedule)
- [x] Update `main.ts` (load councillors, instantiate engine)
- [x] Add web API routes for elections, policies, factions

### System 4 — District evolution
- [x] Schema migration: add `Building` model, add `wealthScore`/`populationScore` to District
- [x] Run `prisma migrate dev`
- [x] Add constants to `constants.ts`
- [x] Add `Building` interface to shared types
- [x] Add new event types to `EventType`
- [x] Create `district-engine.ts`
- [x] Update `significance-scorer.ts`
- [x] Update `tick-engine.ts` (wire engine)
- [x] Update `main.ts` (load buildings, instantiate engine)
- [x] Add web API routes for buildings, district detail
- [x] Update map component: district colour by wealth score

### System 5 — Historical archive (get approval first)
- [x] **Get explicit user approval on LLM cost before proceeding**
- [x] Enhance `MockLLMClient` with call tracking (`getCallCount`, `getLastCall`, `setFixtureContent`, `reset`)
- [x] Add `llm/__fixtures__/historical-archive-fixture.ts` with `HISTORICAL_ARCHIVE_FIXTURE` constant
- [x] Write `jobs/__tests__/historical-archive-job.test.ts` (8/8 passing)
- [x] Schema migration: add `HistoricalSummary` model
- [x] Run `prisma migrate dev`
- [x] Add constants to `constants.ts`
- [x] Add `YearClosed` to `EventType`
- [x] Create `jobs/historical-archive-job.ts`
- [x] Update `queue.ts` (new job type)
- [x] Update `tick-engine.ts` (enqueue on year boundary)
- [x] Add web API routes for history
- [x] Add web frontend history pages
