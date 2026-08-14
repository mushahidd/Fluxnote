# Frontend

Next.js · TypeScript · Tailwind · Yjs · Shadcn UI

## Setup

```bash
npm install
npm run dev   # → http://localhost:3000
```

Requires `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

## Structure

```
app/                    Pages (App Router)
  editor/               Collaborative canvas editor
  lobby/                Session list + share links
  dashboard/            Home
  auth/                 Login / register

components/
  canvas/               CanvasWrapper, InfiniteCanvas, NodeOverlay, CursorLayer, ToolBar
  ligma/                AppSidebar, WorkspaceTopbar, SessionGrid
  ui/                   Shadcn/Radix primitives

lib/
  yjs/
    yjsProvider.ts      WebSocket ↔ Y.Doc binary sync
    syncManager.ts      Y.Map CRUD wrapper for canvas nodes
  hooks/
    useCanvas.ts        Canvas nodes via Yjs (auto-connects, loads persisted state)
    usePresence.ts      Live cursors via /ws WebSocket
    useTasks.ts         Tasks via REST API
  auth-context.tsx      useAuth() — JWT + Supabase session
  api.ts                REST API client
```

## Canvas

The infinite canvas uses a dual-layer approach:
- **HTML5 Canvas** — shapes, freehand, arrows, lines, text (pure Canvas 2D)
- **DOM overlay** — sticky notes with inline editing

### Tools & Shortcuts

| Key | Tool | Key | Tool |
|-----|------|-----|------|
| V | Select | P | Freedraw |
| H | Hand/Pan | E | Eraser |
| N | Sticky note | R | Rectangle |
| T | Text | O | Ellipse |
| A | Arrow | L | Line |
| Delete | Delete selected | Ctrl+A | Select all |

### Real-time Sync

`useCanvas({ roomId })` connects to `/yjs`, syncs a `Y.Map<nodes>` via Yjs CRDT. Every change propagates to all clients conflict-free. State is loaded from the backend on join (disk or DB).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server at :3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

## Troubleshooting

| Problem | Fix |
|---|---|
| Module not found | `npm install` |
| Build fails | `rm -rf .next` then `npm run dev` |
| Port 3000 in use | `npm run dev -- -p 3001` |
| Drawings not syncing | Check backend is running and WS URL in `.env.local` |
