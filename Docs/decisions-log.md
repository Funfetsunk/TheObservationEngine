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

### [Hosting] Hetzner VPS + Coolify chosen over Railway
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

*Add entries here as the build progresses.*

