# The Observation Engine

A persistent, autonomous city simulation. Wixbury runs 24/7 with no player interaction. Visitors observe via a read-only website. Citizens make decisions, form relationships, age, and die through emergent behaviour.

---

## What it is

Wixbury is a northern English town, circa 1991. ~15 citizens (dev) live, work, eat, sleep, and socialise across four districts. Every action writes to an event log. Once a simulated week, the Wixbury Gazette publishes a newspaper edition written by Claude from those events.

Nobody plays it. You just watch.

---

## Architecture

```
packages/
├── sim-engine/   # Autonomous simulation — persistent background process
├── db/           # PostgreSQL schema, migrations, Prisma client
├── shared/       # TypeScript types shared across packages
└── web/          # Next.js read-only viewer
```

Sim engine and website are **completely separate processes**. They communicate only through the database and Redis pub/sub. Never import across that boundary.

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) |
| Database | PostgreSQL via Prisma |
| Cache / tick state | Redis |
| Job queue | BullMQ |
| Frontend | Next.js 16, Tailwind CSS |
| Real-time | WebSockets (ws) — standalone port |
| LLM | Anthropic Claude (claude-sonnet-4-6) |
| Deployment | Oracle Cloud Always Free ARM VM + Coolify (sim + db), Vercel (web) |

---

## Running locally

**Prerequisites:** Node 20+, PostgreSQL, Redis

```bash
# Install dependencies
npm install

# Environment
cp .env.example .env   # fill in DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY

# Database
npx prisma migrate dev --schema packages/db/prisma/schema.prisma

# Terminal 1 — web server (Next.js + WebSocket on port 3001)
npx ts-node --project packages/web/tsconfig.json packages/web/server.ts

# Terminal 2 — sim engine
npx ts-node --project packages/sim-engine/tsconfig.json packages/sim-engine/src/main.ts
```

Open [http://localhost:3000](http://localhost:3000).

**Cost note:** `.env` ships with `MOCK_LLM=true`. Keep it that way during development — newspaper editions fire every 168 ticks and each one hits the Anthropic API. Only set `MOCK_LLM=false` for a deliberate smoke test.

---

## Tick system

```
1 real minute = 1 simulated hour
TICK_RATE_MS = 60_000
```

All durations derive from this constant. `TICK_INTERVAL_MS` in `.env` overrides the actual interval for fast dev runs (default 5000ms = one sim hour every 5 real seconds).

---

## Build phases

| Phase | Status | Description |
|---|---|---|
| 1 — POC citizen loop | ✅ Complete | Single citizen, rule-based decisions, console output |
| 2 — Persistent world | ✅ Complete | PostgreSQL, 15 citizens, relationship engine, event log |
| 3 — Newspaper | ✅ Complete | BullMQ job, significance scorer, Claude-generated Gazette editions |
| 4 — Public website | ✅ Complete | Live SVG map, citizen profiles, newspaper archive, WebSocket feed |
| 5 — Economy & politics | 🔜 Planned | Jobs, wages, elections, population dynamics, district evolution |

---

## Key design rules

- **Sim engine and website are separate processes** — database + Redis only, never direct import
- **Every tick is driven by one constant** — `TICK_RATE_MS` in `constants.ts`, nowhere else
- **Events are permanent** — the events table is the city's memory; rows are never deleted
- **Needs override everything** — if hunger/energy/social drops below 0.2, citizen ignores all other logic until resolved above 0.4
- **Relationship cap** — 50 per citizen; new relationships displace the lowest-scored acquaintance
