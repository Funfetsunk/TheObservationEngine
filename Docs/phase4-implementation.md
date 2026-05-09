# Phase 4 implementation plan — Public website: read-only viewer

## Goal

Build the website visitors actually see. A live broadcast of Wixbury — abstract dots on a map,
citizen profiles, a browsable newspaper archive, and a real-time WebSocket feed.

Phase 4 deliverable: a live site a stranger can visit, explore the map, read the newspaper,
and follow citizens.

---

## What exists coming in (Phase 3 complete)

| Package | Status |
|---|---|
| `packages/db` | Prisma schema + client. Tables: `citizens`, `districts`, `relationships`, `events`, `newspaper_editions` |
| `packages/shared` | TypeScript interfaces: `Citizen`, `District`, `Event`, `Relationship` |
| `packages/sim-engine` | Full tick engine, citizen agents, relationship engine, BullMQ newspaper job, Anthropic LLM client |
| `packages/web` | Does not exist yet |

---

## Architecture decisions

### REST API: Next.js API routes

Next.js API routes (`/app/api/...`) read directly from Postgres via the shared Prisma client.
This keeps the web package self-contained and deploys trivially to Vercel.

No separate Express/Fastify service. No API package. One process on Vercel handles both
the React frontend and the read-only REST layer.

**Why not a standalone API package?**
The data is read-only. Next.js API routes on Vercel are free, edge-cached, and require zero
ops overhead. A separate service would add a deployment target for no gain.

### WebSocket: Redis pub/sub bridge

The sim-engine already uses Redis for tick state. We extend it to publish a tick snapshot
to Redis pub/sub after each tick completes. A WS server subscribes and forwards to browsers.

**Flow:**
```
sim-engine → redis PUBLISH wixbury:tick <snapshot JSON>
              ↓
         ws-server (subscribes to Redis channel)
              ↓
         browser WebSocket clients
```

**Where does the WS server live?**
`packages/web` uses a custom Next.js server (`server.ts`) that runs alongside Next.js and
mounts a `ws` WebSocket server on a separate path (`/ws`). It subscribes to Redis on startup.

This keeps the deployment simple: one Vercel-incompatible process running on Oracle Cloud for
the custom server, while the purely static/API parts can be Vercel-deployed later.
For Phase 4 development, everything runs locally and this distinction doesn't matter.

### Map renderer: SVG with React

Phase 4 visual spec from the founding design doc: *"abstract coloured dots moving on a
schematic map."* No pixel art, no sprites.

SVG is the right choice:
- Districts as labelled rectangles
- Citizens as `<circle>` elements, interpolated smoothly between tick positions
- Colour encodes current activity (sleeping=indigo, working=blue, eating=green,
  socialising=amber, leisure=gray)
- CSS transitions handle the interpolation between tick snapshots

No canvas in Phase 4. SVG is simpler to implement, easier to debug, and fully adequate
for coloured dots. Canvas upgrade deferred to Phase 5.

---

## Package structure: `packages/web`

```
packages/web/
├── package.json
├── tsconfig.json
├── next.config.ts
├── server.ts                      # Custom Next.js server + WS server
├── tailwind.config.ts
├── postcss.config.js
├── public/
│   └── favicon.ico
└── src/
    ├── app/
    │   ├── layout.tsx             # Root layout — nav, fonts
    │   ├── page.tsx               # / — city overview + live map
    │   ├── citizens/
    │   │   ├── page.tsx           # /citizens — citizens list
    │   │   └── [id]/
    │   │       └── page.tsx       # /citizens/:id — citizen profile
    │   ├── newspaper/
    │   │   ├── page.tsx           # /newspaper — archive index
    │   │   └── [id]/
    │   │       └── page.tsx       # /newspaper/:id — single edition
    │   └── api/
    │       ├── city/
    │       │   └── state/route.ts
    │       ├── citizens/
    │       │   ├── route.ts
    │       │   └── [id]/
    │       │       ├── route.ts
    │       │       └── events/route.ts
    │       ├── districts/
    │       │   └── route.ts
    │       ├── newspaper/
    │       │   ├── route.ts
    │       │   └── [id]/route.ts
    │       └── events/
    │           └── route.ts
    ├── components/
    │   ├── map/
    │   │   ├── CityMap.tsx        # Root map component — SVG container
    │   │   ├── DistrictLayer.tsx  # District rectangles + labels
    │   │   ├── CitizenDots.tsx    # Citizen circles, colour-coded
    │   │   └── EventFlash.tsx     # Brief flash animation on significant events
    │   ├── newspaper/
    │   │   ├── EditionCard.tsx    # Summary card for archive list
    │   │   └── ArticleView.tsx    # Full edition renderer
    │   ├── citizen/
    │   │   ├── CitizenCard.tsx    # Summary card for list
    │   │   ├── TraitBars.tsx      # Visual trait display
    │   │   ├── NeedsDisplay.tsx   # Current needs (hunger/energy/social)
    │   │   └── RelationshipList.tsx
    │   └── ui/
    │       ├── CommentaryFeed.tsx # Sidebar: recent event lines
    │       └── SimClock.tsx       # Current simulated time display
    ├── hooks/
    │   ├── useWebSocket.ts        # WS connection + reconnect logic
    │   └── useCityState.ts        # Subscribes to tick snapshots, exposes citizen positions
    ├── lib/
    │   ├── api.ts                 # Typed fetch wrappers for all REST endpoints
    │   └── activity-colours.ts   # Activity → Tailwind colour map
    └── types/
        └── api.ts                 # Response shape types for all API routes
```

---

## REST API endpoints

All endpoints are read-only. No authentication in Phase 4.

### `GET /api/city/state`

Current simulation status. Used by the map header and live clock.

```typescript
interface CityStateResponse {
  tick: number;
  simulatedAt: string;       // ISO timestamp in simulated time
  citizenCount: number;
  livingCount: number;
  eventsFiredToday: number;
}
```

### `GET /api/citizens`

All living citizens. Paginated. Used by the citizens list page.

Query params: `?page=1&limit=50&district=<id>&job=<jobType>`

```typescript
interface CitizensResponse {
  citizens: {
    id: string;
    name: string;
    age: number;
    jobType: string;
    districtId: string;
    districtName: string;
    currentActivity: string;
    biography: string | null;
  }[];
  total: number;
  page: number;
}
```

### `GET /api/citizens/:id`

Full citizen profile.

```typescript
interface CitizenProfileResponse {
  id: string;
  name: string;
  age: number;
  bornAt: string;
  diedAt: string | null;
  jobType: string;
  biography: string | null;
  traits: {
    ambition: number;
    honesty: number;
    sociability: number;
    empathy: number;
    riskTolerance: number;
    religiosity: number;
    political: number;
  };
  needs: {
    hunger: number;
    energy: number;
    social: number;
  };
  currentActivity: string;
  districtId: string;
  districtName: string;
  relationships: {
    citizenId: string;
    citizenName: string;
    score: number;
    type: string;
    formedAt: string;
  }[];
}
```

### `GET /api/citizens/:id/events`

Events involving this citizen. Paginated, desc order.

```typescript
interface CitizenEventsResponse {
  events: {
    id: string;
    type: string;
    occurredAt: string;
    significance: number;
    districtName: string | null;
    data: Record<string, unknown>;
  }[];
  total: number;
}
```

### `GET /api/districts`

All districts. Used by map and filter dropdowns.

```typescript
interface DistrictsResponse {
  districts: {
    id: string;
    name: string;
    character: string;
    citizenCount: number;
  }[];
}
```

### `GET /api/newspaper`

Newspaper editions index. Paginated, desc order.

Query: `?page=1&limit=10`

```typescript
interface NewspaperIndexResponse {
  editions: {
    id: string;
    editionNumber: number;
    publishedAt: string;       // simulated date
    headline: string;          // first line of content, used as preview
  }[];
  total: number;
}
```

### `GET /api/newspaper/:id`

Single edition full content.

```typescript
interface NewspaperEditionResponse {
  id: string;
  editionNumber: number;
  publishedAt: string;
  content: string;             // full LLM-generated article text
  eventsCount: number;
}
```

### `GET /api/events`

Recent significant events. Used by the commentary feed.

Query: `?limit=20&since=<tick>`

```typescript
interface EventsResponse {
  events: {
    id: string;
    type: string;
    occurredAt: string;
    significance: number;
    citizenNames: string[];
    districtName: string | null;
    data: Record<string, unknown>;
  }[];
}
```

---

## WebSocket protocol

### Server → client messages

**`tick` message** — emitted after every sim tick (every 60 real seconds in production)

```typescript
interface TickMessage {
  type: 'tick';
  tick: number;
  simulatedAt: string;
  citizens: {
    id: string;
    name: string;
    districtId: string;
    activity: string;
    positionX: number;         // 0.0–1.0 normalised within district
    positionY: number;
  }[];
}
```

**`event` message** — emitted when a significant event fires (significance >= 0.6)

```typescript
interface EventMessage {
  type: 'event';
  eventId: string;
  eventType: string;
  significance: number;
  districtId: string | null;
  citizenIds: string[];
  citizenNames: string[];
}
```

**`edition` message** — emitted when the newspaper job completes

```typescript
interface EditionMessage {
  type: 'edition';
  editionId: string;
  editionNumber: number;
  publishedAt: string;
}
```

### Client → server messages

None in Phase 4. The WebSocket is read-only from the client's perspective.

### Redis channels

The sim-engine publishes to three Redis channels:

| Channel | Payload | Published when |
|---|---|---|
| `wixbury:tick` | `TickMessage` | After each tick completes |
| `wixbury:event` | `EventMessage` | When significance >= 0.6 |
| `wixbury:edition` | `EditionMessage` | When newspaper job completes |

---

## District coordinate system

Districts have fixed screen positions for the SVG map. These are hardcoded in a layout
constant (not in the database — they're display concerns, not simulation data).

```typescript
// packages/web/src/lib/district-layout.ts
interface DistrictLayout {
  id: string;
  x: number;      // SVG units, top-left of bounding rect
  y: number;
  width: number;
  height: number;
  colour: string; // fill for the district region
}

export const DISTRICT_LAYOUT: Record<string, DistrictLayout> = {
  // populated from DB district names — keyed by district name slug
  'town-centre': { x: 200, y: 150, width: 180, height: 140, colour: '#e2e8f0' },
  'millside':    { x: 50,  y: 250, width: 160, height: 160, colour: '#d1fae5' },
  'harrowgate':  { x: 380, y: 100, width: 160, height: 180, colour: '#ede9fe' },
  'the-works':   { x: 200, y: 320, width: 200, height: 140, colour: '#fef3c7' },
};
```

Citizen positions within a district are deterministic from citizen ID — a simple hash
function so citizens have stable-ish positions rather than flickering randomly.

---

## Map: citizen camera mode

When a visitor clicks a citizen dot, the map enters citizen-cam mode:
- Selected citizen dot enlarges and gets a label ring
- Camera view (SVG `viewBox`) smoothly pans to keep the citizen centred
- Sidebar switches to show that citizen's live commentary
- URL updates to `/citizens/:id` without a full navigation (shallow routing)

Deselect by clicking empty space or the citizen again.

---

## Commentary feed

A narrow sidebar alongside the map. Shows the last 10–15 event lines, newest at top.

Lines are generated from `event` WS messages without any LLM call:

```
Mara Voss, 34, arrives at The Miner's Rest. 6:14pm.
Roy Finch and Del Barrow have been sitting at the same table for 40 minutes.
The pub is unusually busy for a Tuesday.
```

Templates per event type, populated with citizen names, locations, and simulated time.
No LLM cost for commentary — pure string interpolation from event data.

---

## Simulated clock display

A persistent header element showing current simulated time. Updated on every `tick` WS message.

```
Wixbury — Wednesday, 14 March 1993 — 6:14 PM
```

Simulated date is derived from the tick count and `TICK_RATE_MS`:
- tick 0 = founding date (e.g. 1 January 1991 — configurable constant)
- each tick = 1 simulated hour

---

## Implementation order

Complete each step fully before starting the next.

### Step 1 — Package scaffold

- Create `packages/web/` with Next.js 14, TypeScript strict, Tailwind
- Add `@wixbury/db` and `@wixbury/shared` as workspace dependencies
- Configure `next.config.ts` to transpile workspace packages
- Verify: `pnpm dev` runs, blank page loads

### Step 2 — REST API routes (no UI)

- Implement all 8 API routes
- Verify each with manual `curl` or browser fetch
- Check types match `packages/shared` interfaces
- No frontend yet — just confirm data is correct

### Step 3 — Newspaper archive pages

Start with the fully static, highest-value content.

- `/newspaper` — list of editions, newest first, with headline preview
- `/newspaper/:id` — full edition display, formatted article text
- No real-time needed. Pure server-rendered pages.
- Style with Tailwind: newspaper-column layout, serif font for article body

### Step 4 — Citizen profile pages

- `/citizens` — paginated list with job, district, brief biography excerpt
- `/citizens/:id` — full profile: traits as bar charts, needs as percentage bars,
  relationships list, recent events feed (from `/api/citizens/:id/events`)
- Server-rendered. No real-time needed.

### Step 5 — Static city map

Before any WebSockets, render the map from a REST snapshot.

- `GET /api/citizens` → positions derived from district assignment
- SVG districts rendered as rectangles
- Citizens rendered as coloured dots at their district's position
- No animation yet — snapshot only
- Verify the map looks right with real simulation data

### Step 6 — Sim-engine: Redis pub/sub publisher

Add to `sim-engine` after each tick:

```typescript
// After tick processing completes in tick-engine.ts
await redis.publish('wixbury:tick', JSON.stringify(tickSnapshot));
```

And in `newspaper-job.ts`, publish `wixbury:edition` after article storage.
And in `event-emitter.ts`, publish `wixbury:event` for high-significance events.

Test: `redis-cli SUBSCRIBE wixbury:tick` and confirm messages arrive.

### Step 7 — WebSocket server

- `packages/web/server.ts` — custom Next.js server using `http` + `ws`
- WS server mounts at `/ws`
- On startup: `SUBSCRIBE wixbury:tick wixbury:event wixbury:edition` via Redis
- On Redis message: broadcast to all connected WS clients
- Implement `useWebSocket.ts` hook in frontend
- Implement `useCityState.ts` to merge incoming ticks with existing state

### Step 8 — Live map

- Wire `useCityState.ts` into `CityMap.tsx`
- Citizens move between district positions on each `tick` message
- CSS transitions (`transition: all 10s linear`) for smooth movement
- `EventFlash.tsx` — brief circle pulse on the district where an event fired
- CommentaryFeed — scrolling sidebar of event lines from `event` messages

### Step 9 — Citizen cam mode

- Click handler on citizen dots
- SVG `viewBox` animation to pan/zoom to selected citizen
- Sidebar swap to show live citizen stats pulled via REST on selection
- Shallow URL update

### Step 10 — Layout and polish

- Root layout: site name, nav (Map / Citizens / Newspaper), simulated clock in header
- Responsive: map full-width on mobile (no sidebar), sidebar visible on ≥ lg
- Loading states: skeleton screens for profile pages during SSR
- Error states: 404 pages for unknown citizen/edition IDs
- Accessibility: aria labels on SVG elements, keyboard navigation for citizen list

---

## Dependencies

```json
{
  "dependencies": {
    "next": "14.x",
    "react": "18.x",
    "react-dom": "18.x",
    "ws": "^8.x",
    "ioredis": "^5.x",
    "@wixbury/db": "workspace:*",
    "@wixbury/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/ws": "^8.x",
    "@types/node": "20.x",
    "tailwindcss": "^3.x",
    "typescript": "5.x"
  }
}
```

`ioredis` is already used in `sim-engine`. Use the same version.
`ws` is the WebSocket library specified in CLAUDE.md.

---

## Sim-engine additions required

Phase 4 requires two additions to `sim-engine` — keep them minimal:

### 1. Position data on citizen state

`citizen-agent.ts` must write a position (normalised 0.0–1.0 within district) to Redis
alongside the existing needs/activity state. Use the citizen's ID hash for stable
intra-district positioning:

```typescript
function getDistrictPosition(citizenId: string): { x: number; y: number } {
  const hash = citizenId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return {
    x: (hash % 100) / 100,
    y: (Math.floor(hash / 100) % 100) / 100,
  };
}
```

### 2. Redis pub/sub publishing in tick-engine

After `tickEngine.runTick()` completes, publish the snapshot. This is ~5 lines in
`tick-engine.ts`. Keep it at the end of the tick so the snapshot is always complete.

---

## Data that doesn't exist yet (needs Prisma query design)

Some API responses require joins not currently used in `sim-engine`. Verify these
Prisma queries work with the existing schema before wiring them into API routes:

- Citizen + relationships + relatedCitizen name: requires include chain
- Events with citizenNames (join on `citizen_ids` array): requires custom raw query
  or Prisma's `findMany` with `where: { citizen_ids: { has: citizenId } }`
- Newspaper edition headline: no `headline` column exists — derive from first line
  of `content` in the API route

---

## Deployment notes (Phase 4)

Both the sim-engine + custom WS server and the Next.js app run on Oracle Cloud Always Free
ARM VM (4 OCPU / 24GB RAM) via Coolify. Vercel deployment is deferred — the custom server
(`server.ts`) is not compatible with Vercel's serverless model until the WS server is extracted.

This is acceptable for Phase 4 launch. Vercel extraction is a Phase 5 task.

Cost impact: Oracle Cloud Always Free — zero cost. Phase 4 adds no new infrastructure costs.

---

## Definition of done

Phase 4 is complete when:

- [ ] A stranger can visit the site and see the live map with moving citizen dots
- [ ] The map updates in real time as the sim runs (WebSocket feed working)
- [ ] Clicking a citizen dot opens their profile with traits, needs, biography, relationships
- [ ] The newspaper archive is browsable — all past editions readable, newest first
- [ ] The commentary sidebar shows live event text as events fire
- [ ] `/citizens` lists all living citizens with basic info
- [ ] All pages load without error on a fresh sim run with seed data
- [ ] TypeScript strict mode passes with no errors
- [ ] Sim engine and web package share no direct imports — only DB + API
