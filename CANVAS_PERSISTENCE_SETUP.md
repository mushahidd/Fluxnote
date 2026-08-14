# Canvas Persistence Setup Guide

## Overview

This guide explains how to set up database persistence for canvas drawings. The system now saves all canvas nodes (drawings, sticky notes, shapes, etc.) to the Supabase database in real-time.

## Architecture

### How It Works

1. **Real-time Sync**: Users draw on the canvas → Changes are synced via Yjs WebSocket
2. **Database Persistence**: After 5 seconds of inactivity, all canvas nodes are saved to the `CanvasNode` table
3. **Recovery**: When users join a room, the canvas state is loaded from the database
4. **Dual Storage**: 
   - **Primary**: CanvasNode table (fast, structured)
   - **Backup**: Binary Yjs snapshots in `backend/data/ydocs/` (fallback)

### Benefits

- ✅ Drawings are **never lost** - saved to database automatically
- ✅ **Fast loading** - direct database queries instead of event replay
- ✅ **Real-time collaboration** - Yjs handles live sync
- ✅ **Offline resilience** - Binary snapshots as backup

## Database Setup

### Step 1: Create the CanvasNode Table

Run this SQL in your Supabase SQL Editor:

```sql
-- Migration: Add CanvasNode table for persisting canvas state
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

-- Create unique constraint on id + roomId
CREATE UNIQUE INDEX IF NOT EXISTS "CanvasNode_id_roomId_key" ON "CanvasNode"("id", "roomId");

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "CanvasNode_roomId_idx" ON "CanvasNode"("roomId");
CREATE INDEX IF NOT EXISTS "CanvasNode_createdBy_idx" ON "CanvasNode"("createdBy");

-- Add comment
COMMENT ON TABLE "CanvasNode" IS 'Stores the current state of all canvas nodes for persistence and recovery';
```

**Alternative**: Run the SQL file directly:

```bash
cd backend
psql $DATABASE_URL -f src/db/add_canvas_node_table.sql
```

### Step 2: Verify the Table

Check that the table was created:

```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'CanvasNode';
```

You should see all the columns listed above.

### Step 3: Grant Permissions (if needed)

If you're using Row Level Security (RLS), you may need to add policies:

```sql
-- Allow authenticated users to read canvas nodes
CREATE POLICY "Users can read canvas nodes" ON "CanvasNode"
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Allow authenticated users to insert/update canvas nodes
CREATE POLICY "Users can modify canvas nodes" ON "CanvasNode"
  FOR ALL
  USING (auth.role() = 'authenticated');
```

## Testing the Persistence

### Test 1: Draw and Verify Save

1. **Open the editor** in your browser
2. **Draw something** (sticky note, shape, or freehand)
3. **Wait 5 seconds** (debounce period)
4. **Check the backend logs**:
   ```
   [Persist] Saving X nodes to database for room: room-xxx
   ✅ [Persist] Successfully saved X nodes to database for room: room-xxx
   ```
5. **Verify in database**:
   ```sql
   SELECT id, type, x, y, "createdBy", "updatedAt" 
   FROM "CanvasNode" 
   WHERE "roomId" = 'your-room-id'
   ORDER BY "updatedAt" DESC;
   ```

### Test 2: Reload and Verify Recovery

1. **Refresh the browser** (or close and reopen)
2. **Check the console logs**:
   ```
   [CanvasService] Loaded X nodes from CanvasNode table
   [SyncManager] Loading X persisted nodes from database
   ```
3. **Verify the canvas** - your drawings should reappear

### Test 3: Multi-User Sync

1. **Open two browser windows** side by side
2. **Draw in window A** - should appear in window B immediately
3. **Wait 5 seconds** - both windows' data is saved
4. **Refresh window B** - drawings should persist

## Troubleshooting

### Issue: "Can't reach database server"

**Cause**: Supabase database is not accessible

**Solutions**:
1. Check your `.env` file has correct `DATABASE_URL`
2. Verify Supabase project is running
3. Check network connectivity
4. **Fallback**: The app will still work with in-memory Yjs (no persistence)

### Issue: "Table CanvasNode does not exist"

**Cause**: Migration not run

**Solution**: Run the SQL migration (Step 1 above)

### Issue: Drawings disappear after refresh

**Cause**: Database save is failing

**Check**:
1. Backend logs for errors: `[Persist] Failed to save nodes`
2. Database permissions (RLS policies)
3. Prisma client is generated: `npm run prisma:generate`

### Issue: Slow loading

**Cause**: Too many nodes in database

**Solutions**:
1. Add pagination to canvas API
2. Implement spatial indexing
3. Archive old rooms

## Configuration

### Adjust Debounce Time

Edit `backend/src/ws/yjsServer.js`:

```javascript
// Change from 5000ms (5 seconds) to your preferred delay
}, 5000)); // <-- Change this value
```

**Recommendations**:
- **Fast saves**: 2000ms (2 seconds) - more database writes
- **Balanced**: 5000ms (5 seconds) - default
- **Slow saves**: 10000ms (10 seconds) - fewer database writes

### Disable Database Persistence

If you want to use only binary snapshots:

```javascript
// Comment out this line in logYjsMutations():
// persistYDocToDatabase(roomId, ydoc, userId).catch(...);
```

## Monitoring

### Check Persistence Status

```sql
-- Count nodes per room
SELECT "roomId", COUNT(*) as node_count, MAX("updatedAt") as last_update
FROM "CanvasNode"
GROUP BY "roomId"
ORDER BY last_update DESC;

-- Recent activity
SELECT "id", "type", "roomId", "updatedBy", "updatedAt"
FROM "CanvasNode"
ORDER BY "updatedAt" DESC
LIMIT 20;

-- Storage size
SELECT 
  pg_size_pretty(pg_total_relation_size('"CanvasNode"')) as total_size,
  COUNT(*) as total_nodes
FROM "CanvasNode";
```

### Backend Logs

Watch for these log messages:

- ✅ `[Persist] Saving X nodes to database` - Save initiated
- ✅ `Successfully saved X nodes` - Save completed
- ❌ `Failed to save nodes to database` - Save failed (check error)

## Performance Tips

1. **Index optimization**: The table has indexes on `roomId` and `createdBy`
2. **Cleanup old data**: Archive or delete nodes from inactive rooms
3. **Binary snapshots**: Keep as backup in `backend/data/ydocs/`
4. **Database connection pooling**: Prisma handles this automatically

## Next Steps

- [ ] Set up automated backups of the CanvasNode table
- [ ] Implement room archival for old/inactive rooms
- [ ] Add canvas version history (optional)
- [ ] Monitor database size and performance

## Support

If you encounter issues:

1. Check backend logs: `npm start` output
2. Check browser console: F12 → Console tab
3. Verify database connection: `npm run prisma:studio`
4. Review this guide's troubleshooting section

---

**Last Updated**: April 29, 2026
**Version**: 1.0.0
