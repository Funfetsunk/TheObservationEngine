# City simulation — build phases

A persistent online city simulation that runs autonomously, generating emergent history, citizens, politics, economy, and culture. Visitors observe via a read-only website. No player interaction.

---

## Phase 1 — Proof of concept: the citizen loop
**Duration:** 1–2 weeks  
**Tag:** Start here

**Goal:** Prove the core mechanic works before building anything else. One citizen, making decisions, over simulated time.

**Tasks:**
- Single citizen agent — name, age, traits (5 floats), one daily decision loop
- Tick engine — a simple cron job advancing time, calling each citizen's decision function
- Flat file persistence — write citizen state to JSON after each tick; no database yet
- Console output — print what the citizen did each simulated day to a log file
- No LLM yet — decisions are pure rule-based logic: if hungry → find food, if tired → sleep

**Deliverable:** A script you can run that produces a readable log of one person's life over 100 simulated days.

**Stack:** Node.js or Python, Cron / setInterval, JSON files

---

## Phase 2 — World state: database and relationships
**Duration:** 2–3 weeks  
**Tag:** Core data layer

**Goal:** Move from flat files to a real persistent world. Add a handful of citizens, a single district, and the relationship graph.

**Tasks:**
- Database schema — citizens, relationships, events, districts tables
- 10–20 citizens — each with traits, a home location, and a job type
- Relationship engine — citizens who share space accumulate relationship scores over time
- Event log — every significant action writes a row to an events table with timestamp and location
- Basic needs model — hunger, rest, social — driving daily movement decisions

**Deliverable:** A running simulation with a small population whose relationships shift over time, fully persisted to a database.

**Stack:** PostgreSQL, Prisma ORM, Redis for tick state

---

## Phase 3 — Content generation: the newspaper
**Duration:** 2–3 weeks  
**Tag:** LLM integration

**Goal:** Wire up the first LLM layer. After each simulated day, scan significant events and generate a newspaper edition.

**Tasks:**
- Event significance scorer — rule-based filter that flags events worth writing about
- Article generator — structured prompt sending flagged events to Claude, returning a formatted article (one edition per simulated week = 168 ticks)
- Newspaper archive — store generated articles in the database with edition dates
- Citizen biography updater — short LLM call after major life events to update a prose summary
- Cost controls — batch events, cap daily LLM calls, cache summaries aggressively

**Deliverable:** A daily newspaper that reads like real local journalism, generated entirely from simulation events.

**Stack:** Claude API (Sonnet), prompt templates, job queue (BullMQ)

---

## Phase 4 — Public website: read-only viewer
**Duration:** 3–4 weeks  
**Tag:** First public version

**Goal:** Build the website visitors actually see. Map, newspaper archive, and citizen profiles. No interaction — observe only.

**Tasks:**
- Map renderer — SVG or canvas city map generated from district and building data
- Citizen profile pages — static-ish pages showing traits, history, current status, relationships
- Newspaper archive — browsable by date, searchable by citizen or district
- WebSocket live feed — push event markers to the map in real time as the sim runs
- Public API layer — read-only REST endpoints the frontend consumes; sim engine stays separate

**Deliverable:** A live website a stranger can visit, explore the map, read the newspaper, and follow citizens.

**Stack:** Next.js, Tailwind, WebSockets, Vercel (web) / Oracle Cloud Always Free (sim engine + db)

---

## Phase 5 — Scale up: economy, politics, history
**Duration:** Ongoing  
**Tag:** Depth and complexity

**Goal:** With the foundation solid, layer in the systems that create long-term drama: economy, politics, crime, culture, aging, death.

**Tasks:**
- Economy engine — jobs, wages, prices, businesses opening and closing
- Political system — council elections, policies, factions forming around issues
- Population dynamics — births, deaths, migration in and out of the city
- District evolution — buildings constructed, neighbourhoods changing character over years
- Historical archive — LLM-generated summaries of each simulated year as it closes

**Deliverable:** A city with genuine history, drama, and a sense that anything could happen next.

**Stack:** Iterative — build one system at a time, each system = its own PR

---

## Key architectural principles

- **Sim engine and website are separate processes** — they communicate only through the database and a read-only API. Never couple them directly.
- **Every phase ends with something real** — no phase produces only scaffolding. Each one has a runnable deliverable.
- **Tick rate is a config constant** — decide early (e.g. 1 real minute = 1 simulated hour) and write it as a single changeable value.
- **Write a founding design document first** — tick rate, initial population size, citizen trait schema, events table shape, significance threshold. Paste it at the start of every Claude coding session.
- **One Claude conversation per subsystem** — don't mix concerns across sessions. Context clarity = better code output.
