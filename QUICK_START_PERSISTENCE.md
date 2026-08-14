# Quick Start: Enable Canvas Persistence

## 🚀 3-Step Setup

### Step 1: Run the SQL Migration

Open your **Supabase SQL Editor** and run:

```sql
CREATE TABLE IF NOT EXISTS "CanvasNode" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "y" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL DEFAULT '{}',
    "color" TEXT,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "intent" TEXT,
    "taskStatus" TEXT,
    "assignee" TEXT,
    "points" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CanvasNode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CanvasNode_id_roomId_key" ON "CanvasNode"("id", "roomId");
CREATE INDEX IF NOT EXISTS "CanvasNode_roomId_idx" ON "CanvasNode"("roomId");
CREATE INDEX IF NOT EXISTS "CanvasNode_createdBy_idx" ON "CanvasNode"("createdBy");
```

### Step 2: Restart the Backend

```bash
cd backend
npm start
```

### Step 3: Test It!

1. Open the editor in your browser
2. Draw something (sticky note, shape, etc.)
3. Wait 5 seconds
4. Refresh the page
5. ✅ Your drawing should still be there!

## ✨ What Changed?

### Before
- ❌ Drawings only in memory
- ❌ Lost on page refresh
- ❌ No persistence

### After
- ✅ Drawings saved to database automatically
- ✅ Persist across page refreshes
- ✅ Real-time sync between users
- ✅ Never lose your work

## 🔍 Verify It's Working

### Check Backend Logs

You should see:
```
[Persist] Saving 3 nodes to database for room: room-xxx
✅ [Persist] Successfully saved 3 nodes to database
```

### Check Database

```sql
SELECT * FROM "CanvasNode" ORDER BY "updatedAt" DESC LIMIT 10;
```

## 🐛 Troubleshooting

### "Table does not exist"
→ Run Step 1 again (SQL migration)

### "Can't reach database"
→ Check your `.env` file has correct `DATABASE_URL`

### Drawings still disappear
→ Check backend logs for errors
→ Verify Supabase is running

## 📚 More Info

See `CANVAS_PERSISTENCE_SETUP.md` for detailed documentation.

---

**That's it!** Your canvas now saves automatically. 🎉
