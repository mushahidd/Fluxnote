# 🚀 Servers Are Running - Test the New Features!

## ✅ Server Status

**Backend**: Running on http://localhost:4000
- REST API: http://localhost:4000/api
- WebSocket (Custom): ws://localhost:4000/ws
- WebSocket (Yjs): ws://localhost:4000/yjs

**Frontend**: Running on http://localhost:3000

---

## 🧪 Quick Test Guide

### Test 1: AI Intent Classification + Auto Task Creation (2 minutes)

1. **Open the editor:**
   - Go to: http://localhost:3000/editor?roomId=test-ai-tasks

2. **Create an action sticky note:**
   - Click the sticky note tool (or press `N`)
   - Click on the canvas to create a note
   - Type: **"We need to implement user authentication"**
   - Click outside the note to save

3. **Wait 3 seconds and check the Task Board:**
   - Look at the right side panel (Task Board)
   - You should see a new task appear in the "todo" column
   - The task should show:
     - ✅ Title: "We need to implement user authentication"
     - ✅ Author name
     - ✅ "AI task" badge with ⚡ icon
     - ✅ "Go to Node" button

4. **Check the backend console:**
   ```
   [AI] Classified node abc123 as: Action
   [AI] Auto-created task xyz789 for node abc123
   Broadcasting task:created to room test-ai-tasks
   ```

5. **Test "Go to Node":**
   - Pan the canvas away from the sticky note
   - Click the "Go to Node" button in the task
   - Canvas should smoothly scroll back to the sticky note

---

### Test 2: Real-Time Task Updates (3 minutes)

1. **Open the same room in TWO browser windows:**
   - Window 1: http://localhost:3000/editor?roomId=test-realtime
   - Window 2: http://localhost:3000/editor?roomId=test-realtime

2. **In Window 1, create a sticky note:**
   - Type: **"Fix the login bug"**
   - Wait 3 seconds

3. **Check Window 2:**
   - The task should appear automatically (no refresh!)
   - Both windows should show the same task

4. **In Window 1, click "Start" on the task:**
   - Task should move to "in_progress" column

5. **Check Window 2:**
   - Task should move to "in_progress" instantly
   - No page refresh needed!

6. **Backend console should show:**
   ```
   Broadcasting task:updated to room test-realtime
   ```

---

### Test 3: Viewer RBAC (Read-Only Mode) (2 minutes)

**Note**: To test this properly, you need to set a user's role to "viewer" in the database.

For now, you can test the UI by temporarily modifying the code:

1. **Simulate viewer role (temporary test):**
   - Open browser console (F12)
   - Run: `localStorage.setItem('test_role', 'viewer')`
   - Refresh the page

2. **Expected behavior:**
   - ✅ Yellow banner at top: "🔒 View-Only Mode — You cannot edit this canvas"
   - ✅ Cannot create sticky notes (clicking does nothing)
   - ✅ Cannot edit existing notes
   - ✅ Cannot delete notes
   - ✅ Can see all tasks
   - ✅ Cannot change task status (buttons hidden)
   - ✅ "Go to Node" still works

3. **Check browser console:**
   ```
   [useCanvas] Viewers cannot add nodes
   [useCanvas] Viewers cannot update nodes
   ```

4. **Check backend console:**
   ```
   [RBAC] User X is a Viewer - blocking all mutations
   FORBIDDEN: Viewers cannot edit the canvas
   ```

---

## 🎯 What to Look For

### ✅ Success Indicators:

**Feature 1 (AI + Tasks):**
- [ ] Sticky note with action text → Task appears in 3 seconds
- [ ] Task shows in Task Board with author name
- [ ] "Go to Node" button scrolls canvas to sticky note
- [ ] No duplicate tasks created

**Feature 2 (Real-Time):**
- [ ] Tasks appear instantly in all open windows
- [ ] Status changes propagate immediately
- [ ] No page refresh needed
- [ ] WebSocket connection stable

**Feature 3 (RBAC):**
- [ ] Viewer sees "View-Only Mode" banner
- [ ] Viewer cannot create/edit/delete nodes
- [ ] Viewer can see tasks but not change status
- [ ] Backend blocks viewer mutations

---

## 🐛 Troubleshooting

### Issue: Tasks not appearing

**Check:**
1. Backend console for AI classification logs
2. Groq API key is set in `backend/.env`
3. WebSocket connection is established (check browser console)

**Fix:**
```bash
# Check backend/.env has:
GROQ_API_KEY=gsk_your_key_here
```

### Issue: WebSocket not connecting

**Check:**
1. Backend is running on port 4000
2. Frontend is running on port 3000
3. No CORS errors in browser console

**Fix:**
```bash
# Restart both servers
# Backend: Ctrl+C in backend terminal, then npm start
# Frontend: Ctrl+C in frontend terminal, then npm run dev
```

### Issue: "Go to Node" not working

**Check:**
1. Canvas is fully loaded
2. Node has valid coordinates
3. Browser console for scroll event logs

**Fix:**
- Wait for canvas to fully load before clicking
- Check console for: `[CanvasWrapper] Scrolled to node: abc123`

---

## 📊 Backend Logs to Monitor

Open the backend terminal and watch for these logs:

```bash
# AI Classification
[AI] Classified node abc123 as: Action
[AI] Auto-created task xyz789 for node abc123

# WebSocket Broadcasts
Broadcasting task:created to room test-room
Broadcasting task:updated to room test-room

# RBAC Checks
[RBAC] User X is a Viewer - blocking all mutations
FORBIDDEN: Viewers cannot edit the canvas

# Yjs Sync
[Yjs] Applied SyncStep2 update from user X
[Persist] Saving 5 nodes to database for room: test-room
```

---

## 🎨 Frontend Console Logs to Monitor

Open browser DevTools (F12) and watch for:

```javascript
// Task Board
[useTaskBoard] WebSocket connected
[useTaskBoard] Task created: { id: '...', text: '...', ... }
[useTaskBoard] Task updated: { id: '...', status: 'in_progress' }

// Canvas
[useCanvas] Viewers cannot add nodes
[CanvasWrapper] Scrolled to node: abc123 { x: 500, y: 500 }

// Yjs Provider
✅ [YjsProvider] Connected to room test-room
```

---

## 🎉 Success Criteria

All features are working if:

1. **AI Classification**: Sticky notes with action text create tasks within 3 seconds
2. **Real-Time Sync**: Tasks appear instantly on all connected users' screens
3. **Go to Node**: Clicking the button scrolls canvas to the linked sticky note
4. **RBAC**: Viewers see banner and cannot edit anything
5. **No Errors**: No errors in backend or frontend consoles

---

## 📝 Next Steps After Testing

1. ✅ Verify all features work as expected
2. ✅ Test with multiple users in different roles
3. ✅ Check Groq API usage (free tier limits)
4. ✅ Monitor backend logs for any errors
5. ✅ Test WebSocket reconnection (disconnect/reconnect network)

---

**Happy Testing! 🚀**

If you encounter any issues, check the `TROUBLESHOOTING.md` file for solutions.
