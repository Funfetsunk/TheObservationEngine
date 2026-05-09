# Wixbury — decisions log

A running record of architectural and design decisions made during development.
Add a new entry after any session where a non-obvious choice was made.
Paste this file into Claude Code sessions when working on affected subsystems.

**Format:**
> ### [Area] Short description of decision  
> **Date:** when  
> **Decision:** what was decided  
> **Reason:** why  
> **Alternatives rejected:** what else was considered  

---

## Founding decisions (pre-build)

### [Time] Tick rate set to 1 real minute = 1 simulated hour
**Date:** Pre-build  
**Decision:** `TICK_RATE_MS = 60_000`  
**Reason:** Medium pace gives visitors noticeable change between daily visits while allowing history to accumulate at a meaningful rate (~5 sim years per real month). Slow rate felt too static; fast rate made individual citizens impossible to follow.  
**Alternatives rejected:** 1 min = 1 sim day (too fast, citizens lived and died within days), 1 hour = 1 sim day (too slow, nothing visible between visits)

### [Stack] Node.js / TypeScript chosen over Python
**Date:** Pre-build  
**Decision:** TypeScript throughout — sim engine, shared types, and Next.js frontend  
**Reason:** Event-driven, I/O-bound simulation is Node's natural domain. Same language across sim engine and frontend eliminates context switching. Async model is mature for long-running processes.  
**Alternatives rejected:** Python (better for data science/ML, weaker async story for persistent processes)

### [Hosting] Hetzner VPS + Coolify chosen over Railway *(superseded — see Phase 4 decision below)*
**Date:** Pre-build  
**Decision:** Hetzner CX22 (~£4/mo) with Coolify for deployment management  
**Reason:** Dramatic cost saving over Railway for a long-running always-on process. Railway suitable for early prototyping but Coolify/Hetzner is the target for Phase 4 launch.  
**Alternatives rejected:** Railway Hobby ($5/mo + usage, higher long-term), Render (free tier spins down — unsuitable for always-on sim engine)

### [Citizens] Needs model chosen as three float bars
**Date:** Pre-build  
**Decision:** `need_hunger`, `need_energy`, `need_social` — each 0.0–1.0, decaying each tick  
**Reason:** Continuous float values produce more nuanced and realistic behaviour than binary state flags. Three bars covers the core drivers of human daily movement without over-complicating Phase 1.  
**Alternatives rejected:** Simple state flags (too coarse), single wellbeing score (loses granularity needed for interesting decisions)

### [Relationships] Cap at 50 per citizen
**Date:** Pre-build  
**Decision:** Hard cap of 50 relationships per citizen. New relationships displace the lowest-scored acquaintance when cap is reached.  
**Reason:** Keeps relationship graph manageable at 200 citizens. Produces realistic social behaviour — reclusive citizens maintain tight small circles, sociable citizens constantly refresh theirs.  
**Alternatives rejected:** Cap at 150 (performance risk at scale), no cap (unbounded graph growth)

### [Football] Random results transitioning to trait-driven
**Date:** Pre-build  
**Decision:** Match results are seeded randomly until footballer citizens have ~1 simulated season of trait history, then transition automatically to trait-weighted results  
**Reason:** Avoids blocking football functionality on complex trait systems in Phase 1 while ensuring results become meaningful once player data exists.  
**Alternatives rejected:** Always random (misses emergent storytelling potential), trait-driven from day one (too complex for Phase 1)

### [Viewer] Live camera broadcast model
**Date:** Pre-build  
**Decision:** Core visitor experience is a live floating camera over the city — visitors tune in and watch citizens in real time, not a static map they explore  
**Reason:** More emotionally engaging than a map. Transforms the project from a website into a broadcast. Camera is architecturally free — reads existing sim data, adds no engine load.  
**Alternatives rejected:** Static map with manual exploration (less compelling, visitors passive rather than engaged)

---

## Development decisions

### [Phase 1] POC tick rate uses separate constant from production rate
**Date:** 2026-05-08
**Decision:** `POC_TICK_INTERVAL_MS = 100` drives `setInterval` in Phase 1. `TICK_RATE_MS = 60_000` remains the canonical constant but is not used as the interval until Phase 2.
**Reason:** 100 simulated days at 60s/tick would take 40 real hours. POC needs to run in minutes to be iterable.
**Alternatives rejected:** Overriding `TICK_RATE_MS` directly (violates the single-constant rule), env var override (adds complexity with no benefit in Phase 1)

---

### [Citizens] Work quota derived from ambition trait
**Date:** 2026-05-08
**Decision:** Employed citizens work `round(5 + ambition × 5)` hours per day (5–10h). Unemployed work 0h. Remaining hours are `Leisure` (pure downtime, no recovery).
**Reason:** 21h/day work (the naive "work unless needs fire" default) is unrealistic. Ambition is the most semantically correct trait for work drive. Leisure hours will be where relationships form in Phase 2.
**Alternatives rejected:** Fixed 8h for all citizens (no trait influence), leisure giving passive social recovery (crowded out active socialising — removed)

---

### [Citizens] Sleep tuned to ~7h/day with explicit decay/recovery rates
**Date:** 2026-05-08
**Decision:** `ENERGY_DECAY_PER_TICK = 0.012`, `ENERGY_RECOVERY_PER_TICK = 0.04`. Net sleep recovery = +0.028/tick → 0.20→0.40 in ~7 ticks. Awake period 0.40→0.20 = ~17 ticks. 24h natural cycle.
**Reason:** Default 1h sleep was unrealistic. Target was 5–8h; 7h emerged from matching decay/recovery to produce a natural 24h cycle without hardcoding a sleep duration.
**Alternatives rejected:** High recovery rate (0.50/tick) giving 1-tick sleep, raising `NEED_RECOVERY_TARGET` for energy only (asymmetric constants harder to reason about)

---

### [Phase 3] LLM client uses dependency injection — mock in tests, real in prod
**Date:** 2026-05-09
**Decision:** `NewspaperJob` and `BiographyUpdater` accept an `LLMClient` interface via constructor. Tests inject `MockLLMClient` returning fixture text. Production injects real `AnthropicClient`. Real API calls reserved for manual smoke tests only.
**Reason:** All pipeline logic (event batching, significance filtering, article storage, `written_up` flag) is testable without incurring API cost. One manual smoke test verifies prompt quality, token counts, and cache behaviour.
**Alternatives rejected:** `MOCK_LLM` env var toggle (leaks test concern into prod code), always hitting real API in tests (unnecessary cost, slow feedback loop)

---

### [Phase 3] Cost estimate confirmed before proceeding
**Date:** 2026-05-09
**Decision:** Phase 3 estimated at ~$5–7/month at 15-citizen scale, ~$10–15/month at full 200 citizens. Primary driver: ~257 newspaper API calls/month at ~3k input + ~1k output tokens each. Aggressive bio caching (cache rate $0.30/M vs $3.00/M) is the main cost lever.
**Reason:** CLAUDE.md requires explicit user approval before wiring any LLM call. Cost breakdown reviewed and approved before implementation begins.
**Alternatives rejected:** N/A — cost awareness decision, not an implementation choice

---

### [Phase 3] Significance scorer replaces hardcoded values
**Date:** 2026-05-09
**Decision:** `scoreSignificance(type, involvedCitizens)` in `significance-scorer.ts` replaces hardcoded `significance: 0.3/0.4/0.5` literals in `relationship-engine.ts` and `tick-engine.ts`. Prominent jobs (Journalist, Councillor, Doctor) add +0.20; noteworthy jobs (Clergy, Teacher, Publican) add +0.10.
**Reason:** RelationshipChanged + prominent citizen = 0.70 → newspaper eligible. Two labourers = 0.50 → not eligible. This produces newspaper content from Phase 2 events without lowering the 0.6 threshold.
**Alternatives rejected:** Lowering SIGNIFICANCE_THRESHOLD (waters down the newspaper), hardcoding per-pair rules (not extensible)

---

### [Hosting] Oracle Cloud Always Free chosen over Hetzner CX22
**Date:** 2026-05-09  
**Decision:** Oracle Cloud Always Free ARM VM (4 OCPU / 24GB RAM) replaces Hetzner CX22 (~€4/mo) as the deployment target for sim-engine + Postgres + Redis. Coolify still used for deployment management.  
**Reason:** Hetzner was never set up. Oracle Cloud Always Free tier provides genuinely free persistent hosting with significantly more resources (24GB RAM vs 4GB on CX22). No monthly cost means no ongoing commitment before the project has visitors.  
**Alternatives rejected:** Hetzner CX22 (€4/mo — not free), Fly.io free tier (256MB/VM too tight for Node + Postgres + Redis), Render free tier (spins down — unsuitable for always-on sim engine)

---

### [Phase 3] BullMQ via beta.promptCaching.messages API
**Date:** 2026-05-09
**Decision:** Newspaper job enqueued via BullMQ every 168 ticks. `AnthropicClient` uses `client.beta.promptCaching.messages.create()` (SDK 0.26.x beta namespace) with `cache_control: { type: 'ephemeral' }` on system prompt. Bio updates capped at 3 per edition, threshold 0.75 significance.
**Reason:** SDK 0.26.x has prompt caching under beta namespace — not in the main `messages` API. BullMQ provides jobId-based deduplication (prevents double editions if tick loop fires twice near the interval).
**Alternatives rejected:** Direct async call from tick loop (no deduplication), upgrading SDK (requires testing)

