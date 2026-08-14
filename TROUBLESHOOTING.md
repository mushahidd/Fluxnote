# Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: Tasks Not Appearing After Creating Sticky Notes

**Symptoms:**
- Create sticky note with action text
- Wait 3+ seconds
- No task appears in Task Board

**Possible Causes & Solutions:**

1. **Groq API Key Missing/Invalid**
   ```bash
   # Check backend/.env
   GROQ_API_KEY=gsk_...
   
   # Test API key
   curl https://api.groq.com/openai/v1/models \
     -H "Authorization: Bearer $GROQ_API_KEY"
   ```
   **Solution**: Get valid API key from https://console.groq.com/

2. **AI Classification Failed**
   ```bash
   # Check backend logs for:
   [aiService] Intent classification error: ...
   ```
   **Solution**: Check Groq API status, verify API key, check rate limits

3. **Database Connection Failed**
   ```bash
   # Check backend logs for:
   [Persist] Failed to save nodes to database
   ```
   **Solution**: Verify DATABASE_URL in .env, check Supabase connection

4. **WebSocket Not Connected**
   ```bash
   # Check frontend console for:
   [useTaskBoard] WebSocket connected
   ```
   **Solution**: Verify WS_URL, check backend is running, check CORS settings

---

### Issue 2: Viewer Can Still Edit Canvas

**Symptoms:**
- User role is "viewer"
- Can still create/edit/delete nodes
- No "View-Only Mode" banner

**Possible Causes & Solutions:**

1. **Role Not Set in Database**
   ```sql
   -- Check user role
   SELECT id, email, role FROM users WHERE id = 'user-id';
   
   -- Update role
   UPDATE users SET role = 'viewer' WHERE id = 'user-id';
   ```

2. **Auth Context Not Loading Role**
   ```javascript
   // Check frontend console
   console.log('User:', user);
   // Should show: { id: '...', role: 'viewer', ... }
   ```
   **Solution**: Verify auth context is providing user.role

3. **Case Sensitivity Issue**
   ```javascript
   // Backend checks both cases
   if (user.role === 'viewer' || user.role === 'Viewer')
   ```
   **Solution**: Already handled in code, but verify database has lowercase 'viewer'

4. **Frontend Not Blocking**
   ```javascript
   // Check console for:
   [useCanvas] Viewers cannot add nodes
   ```
   **Solution**: Verify useCanvas hook is checking user.role

---

### Issue 3: "Go to Node" Button Not Working

**Symptoms:**
- Click "Go to Node" button
- Canvas doesn't scroll
- Node not highlighted

**Possible Causes & Solutions:**

1. **Node Has Invalid Coordinates**
   ```javascript
   // Check node data
   console.log('Node:', node);
   // Should have: { x: number, y: number }
   ```
   **Solution**: Ensure node has valid x, y coordinates

2. **Canvas Engine Not Initialized**
   ```javascript
   // Check console for:
   [CanvasWrapper] Cannot scroll to node: abc123
   ```
   **Solution**: Wait for canvas to fully load before clicking

3. **Event Listener Not Attached**
   ```javascript
   // Check console for:
   [CanvasWrapper] Scrolled to node: abc123
   ```
   **Solution**: Verify CanvasWrapper has event listener for 'canvas:scrollToNode'

4. **Viewport API Missing**
   ```javascript
   // Check if viewport has panTo method
   viewport.panTo(x, y);
   ```
   **Solution**: Verify Viewport class has panTo method implemented

---

### Issue 4: WebSocket Keeps Disconnecting

**Symptoms:**
- WebSocket connects then immediately disconnects
- Reconnection attempts fail
- Tasks don't update in real-time

**Possible Causes & Solutions:**

1. **CORS Issues**
   ```bash
   # Check backend logs for:
   ❌ CORS: Blocked origin: http://localhost:3000
   ```
   **Solution**: Add origin to ALLOWED_ORIGINS in backend/.env
   ```env
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

2. **JWT Token Invalid**
   ```bash
   # Check backend logs for:
   WebSocket authentication failed: Invalid token
   ```
   **Solution**: Verify auth token in localStorage, re-login if needed

3. **Port Conflicts**
   ```bash
   # Check if port 4000 is in use
   lsof -i :4000
   ```
   **Solution**: Kill conflicting process or change PORT in .env

4. **Max Reconnect Attempts Reached**
   ```javascript
   // Check console for:
   [useTaskBoard] Max reconnect attempts reached
   ```
   **Solution**: Refresh page to reset reconnection counter

---

### Issue 5: Duplicate Tasks Created

**Symptoms:**
- One sticky note creates multiple tasks
- Task Board shows duplicates
- Database has multiple tasks for same nodeId

**Possible Causes & Solutions:**

1. **Duplicate Check Not Working**
   ```javascript
   // Check backend logs for:
   [AI] Auto-created task xyz789 for node abc123
   ```
   **Solution**: Verify `findFirst({ where: { nodeId } })` is working

2. **Race Condition**
   - Multiple rapid updates to same node
   **Solution**: Already handled with debounce, but verify 3-second delay

3. **Database Constraint Missing**
   ```sql
   -- Add unique constraint
   ALTER TABLE tasks ADD CONSTRAINT unique_node_id UNIQUE (node_id);
   ```

---

### Issue 6: AI Classification Always Returns "Reference"

**Symptoms:**
- All sticky notes classified as "Reference"
- No tasks created even for action text
- Backend logs show successful classification

**Possible Causes & Solutions:**

1. **Groq API Response Format Changed**
   ```javascript
   // Check backend logs for raw response
   console.log('Groq response:', responseText);
   ```
   **Solution**: Update parsing logic in aiService.js

2. **Temperature Too High**
   ```javascript
   // Current setting
   temperature: 0.3
   ```
   **Solution**: Already optimal, but can lower to 0.1 for more consistency

3. **Prompt Not Clear**
   ```javascript
   // Current prompt
   "Classify the following text as exactly one of these categories: Action, Decision, Question, Reference."
   ```
   **Solution**: Prompt is clear, check Groq API status

---

### Issue 7: Task Status Not Updating

**Symptoms:**
- Click "Start" or "Complete" button
- Task doesn't move to new column
- Other users don't see update

**Possible Causes & Solutions:**

1. **API Request Failing**
   ```javascript
   // Check console for:
   Failed to update task: ...
   ```
   **Solution**: Check network tab, verify API endpoint, check auth token

2. **WebSocket Broadcast Not Working**
   ```bash
   # Check backend logs for:
   Broadcasting task:updated to room room-123
   ```
   **Solution**: Verify broadcast() function is called, check room ID

3. **Frontend Not Listening**
   ```javascript
   // Check console for:
   [useTaskBoard] Task updated: { id: '...', status: 'in_progress' }
   ```
   **Solution**: Verify WebSocket message handler is attached

4. **Optimistic Update Failed**
   ```javascript
   // Check if local state updates
   setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
   ```
   **Solution**: Verify task ID matches, check state update logic

---

## Debugging Commands

### Backend Debugging

```bash
# Check if backend is running
curl http://localhost:4000/health

# Check WebSocket endpoint
wscat -c ws://localhost:4000/ws?token=YOUR_TOKEN&roomId=test-room

# Check Groq API
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"

# Check database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tasks;"

# View backend logs
tail -f backend/logs/app.log  # if logging to file
```

### Frontend Debugging

```javascript
// Check WebSocket connection
console.log('WS State:', ws.readyState);
// 0 = CONNECTING, 1 = OPEN, 2 = CLOSING, 3 = CLOSED

// Check auth token
console.log('Token:', localStorage.getItem('auth_token'));

// Check user role
console.log('User:', user);

// Check canvas nodes
console.log('Nodes:', canvasNodes);

// Check tasks
console.log('Tasks:', tasks);

// Force WebSocket reconnect
disconnect();
connect();
```

### Database Debugging

```sql
-- Check tasks
SELECT * FROM tasks ORDER BY created_at DESC LIMIT 10;

-- Check user roles
SELECT id, email, role FROM users;

-- Check room members
SELECT * FROM workspace_members WHERE workspace_id = 'workspace-id';

-- Check events
SELECT * FROM events WHERE room_id = 'room-id' ORDER BY timestamp DESC LIMIT 20;

-- Check for duplicate tasks
SELECT node_id, COUNT(*) as count 
FROM tasks 
GROUP BY node_id 
HAVING COUNT(*) > 1;
```

---

## Performance Issues

### Issue: Slow AI Classification

**Symptoms:**
- Takes >5 seconds to create task
- Backend logs show slow Groq API response

**Solutions:**
1. Check Groq API status: https://status.groq.com/
2. Reduce max_tokens in aiService.js (currently 10)
3. Use faster model (already using fastest: llama-3.3-70b-versatile)
4. Check network latency to Groq API

### Issue: High Memory Usage

**Symptoms:**
- Backend memory grows over time
- Frontend tab becomes slow

**Solutions:**
1. **Backend**: Clear old Y.Doc instances
   ```javascript
   // In yjsServer.js, add cleanup
   setInterval(() => {
     // Remove Y.Docs for rooms with no connections
   }, 60000);
   ```

2. **Frontend**: Disconnect unused WebSockets
   ```javascript
   // Already handled with ref counting
   ```

### Issue: WebSocket Message Backlog

**Symptoms:**
- Tasks appear with delay
- Multiple updates arrive at once

**Solutions:**
1. Check network latency
2. Verify WebSocket is not being throttled
3. Check for message queue buildup in backend

---

## Emergency Fixes

### Quick Fix: Reset Everything

```bash
# Backend
cd backend
rm -rf node_modules
npm install
npm start

# Frontend
cd frontend
rm -rf node_modules .next
npm install
npm run dev

# Database
# Run migrations again
cd backend
npx prisma migrate reset --schema=src/db/schema.prisma
```

### Quick Fix: Clear WebSocket Connections

```bash
# Kill all node processes
pkill -f node

# Restart backend
cd backend
npm start
```

### Quick Fix: Clear Browser State

```javascript
// In browser console
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## Getting Help

If issues persist:

1. **Check Logs**: Backend console + Frontend console
2. **Check Network**: Browser DevTools > Network tab
3. **Check Database**: Verify data is being saved
4. **Check Environment**: Verify all .env variables are set
5. **Check Dependencies**: Run `npm install` in both backend and frontend

**Still stuck?** Check:
- GitHub Issues
- Groq API Documentation
- Supabase Documentation
- Yjs Documentation

---

**Remember**: Most issues are configuration-related. Double-check environment variables first!
