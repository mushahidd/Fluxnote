# Backend

Express + WebSocket server with event sourcing, RBAC, disk persistence, and Groq AI.

## Setup

```bash
npm install
npm run dev   # → http://localhost:4000
```

Once DB is connected (see root `SUPABASE_SETUP.md`):
```bash
npm run prisma:migrate
```

## Structure

```
src/
  index.js          HTTP server + WebSocket upgrade router (/ws, /yjs)
  app.js            Express app + routes
  routes/
    auth.js         POST /api/auth/register|login
    canvas.js       GET|POST /api/canvas/:roomId
    nodes.js        PATCH|DELETE /api/nodes/:nodeId
    tasks.js        GET|PATCH /api/tasks
    rooms.js        GET|POST /api/rooms
  ws/
    yjsServer.js    /yjs — Yjs CRDT sync (binary) + disk persistence
    wsServer.js     /ws  — presence, cursors, events (JSON)
  services/
    canvasService.js    Replay events → canvas state (DB fallback to Y.Doc)
    eventService.js     Append-only event log (graceful DB failure)
    intentService.js    Groq AI classification (debounced 1.5s)
    rbacService.js      Node ACL checks (permissive when DB unavailable)
  db/
    schema.prisma   User · Room · Event · NodeAcl · Task
    prisma.js       PrismaClient singleton
  utils/
    crdt.js         decodeYjsUpdate helpers
    wsUtils.js      parseWsQuery, broadcastToRoom, safeClose
```

## Persistence

Canvas state is saved in two ways:

1. **Disk** — Y.Doc binary snapshots in `data/ydocs/<roomId>.bin`, written 2s after each change. Survives backend restarts.
2. **Database** — Event log in Postgres (requires Supabase connection). Enables full audit history and AI export.

Without DB, real-time sync and disk persistence still work fully.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | nodemon dev server |
| `npm start` | production start |
| `npm test` | Jest test suite |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Run DB migrations |
| `npm run prisma:studio` | Prisma Studio at :5555 |

## Event Types

All mutations are stored as immutable events (never UPDATE/DELETE on the Event table):

`NODE_CREATED` · `NODE_UPDATED` · `NODE_DELETED` · `NODE_MOVED` · `LOCK_NODE` · `RESET` · `CRDT_NODE_*` · `RBAC_VIOLATION`
