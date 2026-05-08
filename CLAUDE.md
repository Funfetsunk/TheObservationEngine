# CLAUDE.md — Wixbury city simulation

This file is read automatically by Claude Code at the start of every session.
It defines the project's architecture, conventions, and rules. Follow all of it precisely.

---

## What this project is

Wixbury is a persistent, autonomous city simulation. It runs 24/7 with no player interaction.
Visitors observe via a read-only website. Citizens make decisions, form relationships, age, and
die through emergent behaviour — nothing is scripted.

The full founding design document is in `Docs/wixbury-founding-design.md`.
Read it before working on anything related to citizens, events, time, or districts.

---

## Monorepo structure

```
/
├── packages/
│   ├── sim-engine/        # The simulation — runs as a persistent background process
│   ├── db/                # Shared database schema, migrations, Prisma client
│   ├── web/               # Next.js public website (read-only viewer)
│   └── shared/            # Shared TypeScript types used across packages
├── Docs/
│   ├── wixbury-founding-design.md   # Single source of truth for all sim constants
│   └── city-sim-build-phases.md     # The five development phases
├── CLAUDE.md              # This file
└── package.json           # Root workspace config
```

**The sim engine and website are completely separate processes.**
They communicate only through the database and a read-only API.
Never import anything from `sim-engine` into `web`, or vice versa.

---

## Tech stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict mode) throughout |
| Runtime | Node.js 20+ |
| Database | PostgreSQL via Prisma ORM |
| Cache / tick state | Redis |
| Job queue | BullMQ |
| Frontend | Next.js 14, Tailwind CSS |
| Real-time | WebSockets (ws library) |
| LLM | Anthropic Claude API (claude-sonnet-4-20250514) |
| Deployment | Hetzner CX22 + Coolify (sim engine + db), Vercel (web) |

---

## The tick system

The entire simulation runs on a single time constant. This is the most important rule in the codebase:

```typescript
// packages/sim-engine/src/constants.ts
export const TICK_RATE_MS = 60_000; // 1 real minute = 1 simulated hour
```

**Never hardcode any time value anywhere else in the codebase.**
All durations, schedules, and intervals must derive from `TICK_RATE_MS`.

```typescript
// Correct
const ONE_SIM_DAY = TICK_RATE_MS * 24;
const ONE_SIM_WEEK = TICK_RATE_MS * 24 * 7;

// Wrong — never do this
setInterval(fn, 60000);
setTimeout(fn, 1440 * 60 * 1000);
```

**Phase 1 exception:** The POC uses `POC_TICK_INTERVAL_MS = 100` as the actual `setInterval` driver so 100 simulated days run in minutes, not 40 real hours. `TICK_RATE_MS` remains the canonical constant for all time calculations but is not used as the interval until Phase 2.

---

## Citizen schema

Every citizen has traits (fixed at birth), needs (constantly decaying), and state (current activity).

```typescript
// packages/shared/src/types/citizen.ts

interface CitizenTraits {
  ambition:       number; // 0.0–1.0
  honesty:        number; // 0.0–1.0
  sociability:    number; // 0.0–1.0
  empathy:        number; // 0.0–1.0
  riskTolerance:  number; // 0.0–1.0
  religiosity:    number; // 0.0–1.0
  political:      number; // 0.0–1.0
}

interface CitizenNeeds {
  hunger: number; // 0.0 (starving) → 1.0 (full)
  energy: number; // 0.0 (exhausted) → 1.0 (rested)
  social: number; // 0.0 (isolated) → 1.0 (fulfilled)
}
```

**Needs priority rule:** If any need drops below `0.2`, it becomes the citizen's sole priority
and overrides all other decision-making until it is resolved above `0.4`.

**Relationship cap:** 50 per citizen. When the cap is reached, a new relationship displaces
the lowest-scored existing acquaintance.

---

## Events table

The events table is the city's memory. If it didn't write an event row, it didn't happen.
Every meaningful simulation action must write to this table.

```typescript
// Significance threshold — events below this are never written up by the newspaper
export const SIGNIFICANCE_THRESHOLD = 0.6;
```

The `written_up` boolean must be set to `true` by the newspaper job after an event is used.
Never delete event rows — the historical archive depends on them being permanent.

---

## The newspaper

- **Name:** The Wixbury Gazette
- **Frequency:** Every 168 ticks (one simulated week = 168 real minutes)
- **Model:** `claude-sonnet-4-20250514`
- **Voice:** Neutral, local, understated. A real small northern English town paper.
- **Prompt contract:** Send a structured JSON payload of flagged events. The model returns
  formatted article text only. It must not invent events beyond the payload.
- **Cost controls:** Batch all events for the week into a single API call. Cap at one call
  per edition. Cache citizen biography summaries aggressively — only regenerate on major events.

---

## Coding conventions

### TypeScript
- Strict mode always — no `any`, no `// @ts-ignore`
- Explicit return types on all exported functions
- Prefer `interface` over `type` for object shapes
- Use `enum` for fixed value sets (job types, event types, relationship types)
- All database IDs are `string` (UUIDs), never `number`

### Naming
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions and variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Database tables: `snake_case`
- Prisma models: `PascalCase`

### File organisation
- One class or logical unit per file
- Keep files under 300 lines — split if larger
- All sim constants live in `packages/sim-engine/src/constants.ts`
- All shared types live in `packages/shared/src/types/`

### Error handling
- Never swallow errors silently
- All tick-loop errors must be caught, logged, and allow the loop to continue
- A single citizen's decision error must never crash the whole tick

### Logging
- Use structured logging (JSON) throughout the sim engine
- Every tick logs: tick number, simulated timestamp, citizen count, events fired
- LLM calls log: model, prompt token count, response token count, cost estimate

---

## One conversation per subsystem

When working with Claude Code, keep sessions focused on a single subsystem:

| Subsystem | Scope |
|---|---|
| Tick engine | The core loop, time advancement, cron scheduling |
| Citizen agents | Decision logic, needs decay, movement |
| Relationship engine | Score updates, cap enforcement, type transitions |
| Event system | Event creation, significance scoring, deduplication |
| Newspaper job | Event batching, prompt construction, article storage |
| Database / schema | Prisma schema, migrations, seed data |
| Public API | Read-only REST endpoints for the frontend |
| Web frontend | Next.js pages, map renderer, citizen profiles |

Do not mix subsystem concerns in a single session. If a task touches two subsystems,
finish one completely before starting the other.

---

## Cost awareness

**Always flag to the user before implementing anything that incurs real-money costs.**

| What | When it costs | Trigger |
|---|---|---|
| Claude API | Phase 3+ | Every newspaper edition (1 call per 168 ticks) |
| Hetzner CX22 | Phase 4+ deployment | ~€4/month for sim engine + DB server |
| Vercel | Phase 4+ deployment | Free tier likely sufficient for read-only frontend |

**Phases 1–2 are entirely free** — local Node.js, Docker Postgres, Docker Redis, no API calls.
**Phase 3 onwards: get explicit user approval before wiring up any LLM call or cloud deployment.**

---

## What we are building right now

**Current phase:** Phase 2 — World state: database and relationships

Goal: persistent world with 15 citizens across 4 districts, relationship graph,
and event log — all persisted to PostgreSQL with tick state in Redis.

See `Docs/city-sim-build-phases.md` for the full phase breakdown.
