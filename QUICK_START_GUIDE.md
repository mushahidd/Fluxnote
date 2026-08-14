# Quick Start Guide - Testing New Features

## Prerequisites

1. **Groq API Key**: Get one from https://console.groq.com/
2. **Backend running**: `cd backend && npm start`
3. **Frontend running**: `cd frontend && npm run dev`
4. **Database**: Supabase or PostgreSQL connected

## Setup

### 1. Configure Environment Variables

**backend/.env:**
```env
GROQ_API_KEY=gsk_your_groq_api_key_here
DATABASE_URL=postgresql://...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PORT=4000
NODE_ENV=development
```

**frontend/.env.local:**
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

### 2. Start Services

```bash
# Terminal 1 - Backend
cd backend
npm install
npm start

# Terminal 2 - Frontend
cd frontend
npm install
npm run dev
```

## Testing Feature 1: AI Intent + Auto Task Creation

### Test Scenario 1: Create Action Task
1. Open http://localhost:3000/editor?roomId=test-room-1
2. Click the sticky note tool (N key)
3. Create a sticky note with text: **"We need to implement user authentication"**
4. Wait 3-5 seconds
5. **Expected Result**: 
   - Task appears in Task Board under "todo" column
   - Task shows author name and "AI task" badge
   - Backend console shows: `[AI] Classified node X as: Action`
   - Backend console shows: `[AI] Auto-created task Y for node X`

### Test Scenario 2: Non-Action Text
1. Create a sticky note with text: **"What is the deadline for this project?"**
2. Wait 3-5 seconds
3. **Expected Result**:
   - No task created (classified as "Question")
   - Backend console shows: `[AI] Classified node X as: Question`

### Test Scenario 3: Real-Time Sync
1. Open the same room in **two browser windows**
2. In Window 1: Create sticky note with action text
3. **Expected Result**:
   - Window 2 shows the task appear automatically (no refresh)
   - Both windows show identical task list

## Testing Feature 2: Live Task Board

### Test Scenario 1: Task Status Update
1. Open room in two browser windows
2. In Window 1: Find a task in "todo" column
3. Click the "Start" button
4. **Expected Result**:
   - Task moves to "in_progress" in Window 1
   - Task moves to "in_progress" in Window 2 (instantly, no refresh)
   - Backend console shows: `Broadcasting task:updated to room`

### Test Scenario 2: Go to Node
1. Create a sticky note at position (500, 500)
2. Pan canvas to a different location (e.g., 0, 0)
3. In Task Board, click "Go to Node" button
4. **Expected Result**:
   - Canvas pans smoothly to center the sticky note
   - Sticky note is highlighted/selected
   - Console shows: `[CanvasWrapper] Scrolled to node: X`

### Test Scenario 3: Task Filtering by Status
1. Create multiple tasks with different statuses
2. **Expected Result**:
   - Tasks organized in 3 columns: todo, in_progress, done
   - Each column shows correct count
   - Completed tasks show strikethrough text

## Testing Feature 3: Node-Level RBAC

### Test Scenario 1: Viewer Cannot Edit (Frontend)
1. Set user role to "viewer" in auth context or database
2. Open editor
3. **Expected Result**:
   - Yellow banner at top: "🔒 View-Only Mode — You cannot edit this canvas"
   - Try to create sticky note → blocked (no action)
   - Try to edit existing note → blocked
   - Console shows: `[useCanvas] Viewers cannot add nodes`

### Test Scenario 2: Viewer Cannot Edit (Backend - Yjs)
1. As viewer, try to create/edit node via Yjs
2. **Expected Result**:
   - Backend console shows: `[RBAC] User X is a Viewer - blocking all mutations`
   - Update is NOT applied to Y.Doc
   - Update is NOT broadcast to other users
   - Canvas state remains unchanged

### Test Scenario 3: Viewer Cannot Edit (Backend - WebSocket)
1. As viewer, send node:create message via /ws WebSocket
2. **Expected Result**:
   - Backend console shows: `FORBIDDEN: Viewers cannot edit the canvas`
   - Client receives error message: `{ type: 'ERROR', error: 'FORBIDDEN: ...' }`
   - Node is NOT created

### Test Scenario 4: Viewer Can View Tasks
1. As viewer, open Task Board
2. **Expected Result**:
   - All tasks are visible
   - Task status buttons (Start/Complete) are HIDDEN
   - "Go to Node" button still works (read-only navigation)

### Test Scenario 5: Contributor Can Edit
1. Set user role to "contributor"
2. Refresh page
3. **Expected Result**:
   - No "View-Only Mode" banner
   - Can create/edit/delete nodes
   - Can change task status
   - All edit controls visible and functional

## Debugging Tips

### Backend Logs to Watch:
```bash
# AI Classification
[AI] Classified node abc123 as: Action
[AI] Auto-created task xyz789 for node abc123

# RBAC Checks
[RBAC] User 123 is a Viewer - blocking all mutations
FORBIDDEN: Viewers cannot edit the canvas

# WebSocket Broadcasts
Broadcasting task:created to room room-123
Broadcasting task:updated to room room-123
```

### Frontend Console Logs:
```javascript
// Task Board
[useTaskBoard] WebSocket connected
[useTaskBoard] Task created: { id: '...', text: '...', ... }
[useTaskBoard] Task updated: { id: '...', status: 'in_progress' }

// Canvas RBAC
[useCanvas] Viewers cannot add nodes
[useCanvas] Viewers cannot update nodes

// Scroll to Node
[CanvasWrapper] Scrolled to node: abc123 { x: 500, y: 500 }
```

### Common Issues:

**Issue**: Tasks not appearing
- **Check**: Groq API key is valid
- **Check**: Backend console for AI classification logs
- **Check**: WebSocket connection is established
- **Check**: Database connection is working

**Issue**: Viewer can still edit
- **Check**: User role is correctly set in database
- **Check**: Auth context is loading user role
- **Check**: Backend logs show role during authentication

**Issue**: "Go to Node" not working
- **Check**: Node has valid x, y coordinates
- **Check**: Canvas engine is initialized
- **Check**: Console for scroll event logs

## Success Criteria

✅ **Feature 1 Complete When:**
- Sticky note text → AI classifies → Task created within 3 seconds
- Task appears on all users' screens instantly
- No duplicate tasks for same node

✅ **Feature 2 Complete When:**
- Task status changes propagate to all users instantly
- "Go to Node" scrolls canvas to correct position
- Task board shows real-time updates

✅ **Feature 3 Complete When:**
- Viewers see "View-Only Mode" banner
- Viewers cannot create/edit/delete nodes (frontend blocked)
- Viewers' edit attempts are blocked on backend (Yjs + WebSocket)
- Viewers can see tasks but cannot change status
- Contributors/Leads can edit normally

## Performance Notes

- **AI Classification**: ~1-2 seconds per request (Groq API)
- **WebSocket Latency**: <100ms for local network
- **Task Creation**: <500ms from classification to database insert
- **Broadcast Delay**: <50ms to all connected clients

## Next Steps

After successful testing:
1. Deploy to staging environment
2. Test with real users in different roles
3. Monitor Groq API usage (free tier limits)
4. Set up error tracking for AI failures
5. Add analytics for task creation rates

---

**Happy Testing! 🚀**
