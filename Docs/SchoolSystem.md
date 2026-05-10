# School System — Design Document

Wixbury has one school serving all children aged 4–17.
Children attend Monday–Friday, 8am–4pm sim time.
School shapes them: socially, academically, and subtly in character.

---

## Eligibility

| Constant | Value | Meaning |
|---|---|---|
| `SCHOOL_MIN_AGE` | `4` | Starts school at age 4 |
| `SCHOOL_MAX_AGE` | `17` | Leaves school at end of age 17 (becomes adult at 18) |
| `SCHOOL_START_HOUR` | `8` | First school tick of the day |
| `SCHOOL_END_HOUR` | `16` | First non-school tick (hours 8–15 inclusive = 8 ticks/day) |

A citizen is **school-age** when `age >= SCHOOL_MIN_AGE && age <= SCHOOL_MAX_AGE`.

---

## Conflict: MIN_WORKING_AGE

`MIN_WORKING_AGE` is currently `16`. School runs to age 17.
These constants are incompatible — a 16-year-old cannot both work and attend school.

**Resolution:** Raise `MIN_WORKING_AGE` from `16` to `18`.
Children leave school at 17, turn 18, and enter the workforce.
This also aligns with `MIN_ROMANTIC_AGE = 18`.

---

## New CitizenAction: School

Add `School = 'school'` to the `CitizenAction` enum in `packages/shared/src/types/citizen.ts`.

---

## New LocationId: WixburySchool

Add `WixburySchool = 'wixbury_school'` to `LocationId` in `packages/shared/src/types/citizen.ts`.

The school is a single building. In the world map it sits in the Town Centre district.
Add it to `JOB_WORK_LOCATION` and the world layout accordingly.

---

## Schedule Logic

Sim time derivation (tick number → hour of day, day of week):

```typescript
const simHour = tickNumber % TICKS_PER_SIM_DAY;            // 0–23
const simDayOfWeek = Math.floor(tickNumber / TICKS_PER_SIM_DAY) % 7; // 0 = Mon … 6 = Sun
const isWeekday = simDayOfWeek < 5;
const isSchoolHour = simHour >= SCHOOL_START_HOUR && simHour < SCHOOL_END_HOUR;
const isSchoolTime = isWeekday && isSchoolHour;
```

A school-age citizen attends school when `isSchoolTime === true`, **unless** a critical need overrides it (see Priority below).

---

## Decision Priority for School-Age Citizens

Replace the current `if (citizen.age < MIN_WORKING_AGE) return CitizenAction.Leisure` shortcut
with the following logic:

```
1. Hunger < NEED_PRIORITY_THRESHOLD  →  Eating       (critical need trumps school)
2. Energy < NEED_PRIORITY_THRESHOLD  →  Sleeping     (critical need trumps school)
3. isSchoolTime === true              →  School
4. Hunger < NEED_RECOVERY_TARGET     →  Eating       (continuing meal recovery)
5. Energy < NEED_RECOVERY_TARGET     →  Sleeping     (continuing sleep recovery)
6. Otherwise                         →  Leisure
```

Social need is **not** a school-skip trigger — children socialise *at* school.

Outside school hours and at weekends, children fall through to Leisure as before.

---

## Needs During School Hours

School replaces home-based `feedChildren()` recovery during school time.
The school provides lunch and a supervised environment.

| Need | Effect | Rate |
|---|---|---|
| Hunger | Partial recovery (school lunch) | `SCHOOL_HUNGER_RECOVERY_PER_TICK = 0.12` |
| Energy | Normal decay continues — children tire during the day | no recovery |
| Social | Partial recovery — children interact with peers | `SCHOOL_SOCIAL_RECOVERY_PER_TICK = 0.20` |

These apply every tick the citizen's action is `School`.

`feedChildren()` continues to run each tick but is gated on a parent being home.
During school hours the child is at `LocationId.WixburySchool`, so the parent-home check
naturally fails and `feedChildren()` provides nothing — school lunch handles it instead.

---

## Peer Relationships at School

No new code needed in the relationship engine.
Children at `WixburySchool` are co-located → `processColocations()` fires automatically.

Existing guards already permit child↔child interaction:
- `MIN_SOCIAL_AGE = 5`: children aged 4 will not form peer relationships until they turn 5 — fine.
- `aIsMinor !== bIsMinor` guard blocks child↔adult unless parent–child — teachers are adults,
  so teacher↔pupil relationships are blocked by this guard. Correct.

School-age peers build friendships through normal compatibility scoring.
High-sociability children will accumulate more friends; low-sociability children fewer.

---

## Trait Development (Formative Learning)

The founding design treats traits as fixed at birth. School introduces one exception:
**formative development** — slow, bounded drift in three traits during school attendance,
representing the cumulative effect of education on character.

### Which traits grow

| Trait | Rationale |
|---|---|
| `ambition` | Academic environment cultivates drive and aspiration |
| `honesty` | Civic education, rule-following, moral instruction |
| `empathy` | Literature, group work, exposure to diverse peers |

Not changed: `riskTolerance`, `sociability`, `religiosity`, `political`.
These are considered more heritable / family-determined.

### Growth rate

A child attends school for 13 years (age 4–17):
- `TICKS_PER_SIM_YEAR = 8760`
- 13 years × 52 weeks × 5 days × 8 hours = **27,040 school ticks** (full career)

Target trait gain over full career: **≈ 0.10–0.15** per trait.
This is noticeable progress but cannot fill the bar — a child born with `ambition = 0.2`
exits school around `0.33`, not `1.0`.

Base per-tick increment per trait:

```
SCHOOL_TRAIT_GAIN_PER_TICK = 0.000005   // 5e-6
```

At base rate: `27,040 × 0.000005 = 0.135` total gain over a full school career.

### Ambition modifier

Ambitious children engage more. The child's own `ambition` trait amplifies learning:

```typescript
const learningRate = SCHOOL_TRAIT_GAIN_PER_TICK * (1 + citizen.traits.ambition * SCHOOL_AMBITION_MULTIPLIER);
```

```
SCHOOL_AMBITION_MULTIPLIER = 0.4
```

| Ambition | Rate multiplier | Career gain |
|---|---|---|
| 0.1 (low) | × 1.04 | +0.140 |
| 0.5 (avg) | × 1.20 | +0.162 |
| 0.9 (high) | × 1.36 | +0.184 |

The spread is intentional — ambitious kids get a modest edge, not a dramatic one.

### Trait cap

Traits are clamped to `[0.0, 1.0]` as always.
The gain is applied **each tick the action is `School`**, before the tick's other logic.

```typescript
if (citizen.currentAction === CitizenAction.School) {
  const learningRate = SCHOOL_TRAIT_GAIN_PER_TICK * (1 + citizen.traits.ambition * SCHOOL_AMBITION_MULTIPLIER);
  citizen.traits.ambition = clamp(citizen.traits.ambition + learningRate);
  citizen.traits.honesty   = clamp(citizen.traits.honesty   + learningRate);
  citizen.traits.empathy   = clamp(citizen.traits.empathy   + learningRate);
}
```

---

## Graduation Event

When a citizen ages from 17 to 18 (in the population engine's birthday tick):

1. Fire an event of type `CitizenGraduated` (new `EventType` entry required).
2. Set their `job` to `Unemployed` — they will seek work naturally via the economy engine.
3. Their `dailyWorkTarget` is computed fresh from their (now-trained) `ambition` trait.

Event significance formula: treat like a `CitizenBorn` — low baseline (~0.35),
elevated only if the graduate's traits are notably high (e.g. ambition > 0.85).

---

## New Constants Summary

All go in `packages/sim-engine/src/constants.ts`:

```typescript
// School system
export const SCHOOL_MIN_AGE = 4;
export const SCHOOL_MAX_AGE = 17;
export const SCHOOL_START_HOUR = 8;
export const SCHOOL_END_HOUR = 16;                        // exclusive (hours 8–15 attend)
export const SCHOOL_HUNGER_RECOVERY_PER_TICK = 0.12;
export const SCHOOL_SOCIAL_RECOVERY_PER_TICK = 0.20;
export const SCHOOL_TRAIT_GAIN_PER_TICK = 0.000005;
export const SCHOOL_AMBITION_MULTIPLIER = 0.4;
```

---

## Files to Change

| File | Change |
|---|---|
| `packages/shared/src/types/citizen.ts` | Add `School` to `CitizenAction`; add `CitizenGraduated` to `EventType` |
| `packages/shared/src/types/citizen.ts` | Add `WixburySchool` to `LocationId` |
| `packages/sim-engine/src/constants.ts` | Add all `SCHOOL_*` constants; change `MIN_WORKING_AGE` to `18` |
| `packages/sim-engine/src/citizen-agent.ts` | Replace `age < MIN_WORKING_AGE → Leisure` with school schedule logic; apply trait gains; apply school needs recovery |
| `packages/sim-engine/src/world.ts` | Add `WixburySchool` location to Town Centre district |
| `packages/sim-engine/src/population-engine.ts` | Fire `CitizenGraduated` event on 17→18 birthday |
| `packages/sim-engine/src/significance-scorer.ts` | Handle `CitizenGraduated` event type |

---

## Out of Scope (future)

- Multiple schools by district (one school is correct for Wixbury's size)
- School quality varying by district wealth
- Truancy — could be driven by `riskTolerance` + social deprivation (later)
- Teacher citizens having a direct effect on pupil outcomes
