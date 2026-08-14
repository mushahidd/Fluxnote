# Share Modal 401 Fix - Application Checklist

## ✅ Step 1: Code Changes (Already Done)

The following files have been updated:
- ✅ `backend/src/services/shareService.js`
- ✅ `backend/src/middleware/rbac.js`
- ✅ `backend/src/routes/sharing.js`

## ⚠️ Step 2: Apply Database Changes (ACTION REQUIRED)

Choose ONE of the following methods:

### Option A: Using the Script (Recommended)
```bash
cd backend
./apply-sharing-fix.sh
```

### Option B: Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click **SQL Editor** in left sidebar
4. Click **New Query**
5. Copy entire contents of `backend/fix-sharing-rls.sql`
6. Paste into editor
7. Click **Run** (or press Cmd/Ctrl + Enter)
8. Verify "Success. No rows returned" message

### Option C: Command Line (psql)
```bash
cd backend
source .env  # or: export $(grep -v '^#' .env | xargs)
psql "$DATABASE_URL" < fix-sharing-rls.sql
```

## ✅ Step 3: Restart Backend Server

If your backend is running, restart it:

```bash
# Stop the current server (Ctrl+C)
cd backend
npm run dev
```

## ✅ Step 4: Test the Fix

1. **Open your browser** to `http://localhost:3000/editor?roomId=<your-room-id>`
   
2. **Open Developer Console** (F12 or Cmd+Option+I)
   
3. **Click the Share button** in the toolbar
   
4. **Verify**:
   - ✅ Modal opens without errors
   - ✅ No 401 errors in console
   - ✅ No red network requests in Network tab
   
5. **Test functionality**:
   - ✅ Change access type (Restricted ↔ Anyone with link)
   - ✅ Add an email invite
   - ✅ Change invite role
   - ✅ Copy share link
   - ✅ Remove an invite

## 🔍 Verification Commands

### Check if RLS policies were applied:
```sql
-- Run in Supabase SQL Editor
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  cmd
FROM pg_policies 
WHERE tablename IN ('room_shares', 'room_share_invites')
ORDER BY tablename, policyname;
```

Expected: You should see 8 policies (4 for each table: select, insert, update, delete)

### Check room structure:
```sql
-- Run in Supabase SQL Editor
SELECT id, name, workspace_id, created_at 
FROM rooms 
ORDER BY created_at DESC 
LIMIT 5;
```

### Check share settings:
```sql
-- Run in Supabase SQL Editor
SELECT * FROM room_shares;
```

## 🐛 Troubleshooting

### Issue: Script fails with "DATABASE_URL not found"
**Solution**: 
```bash
cd backend
cat .env | grep DATABASE_URL
# Copy the URL and run:
export DATABASE_URL="<your-database-url>"
./apply-sharing-fix.sh
```

### Issue: Still getting 401 errors
**Check**:
1. Database changes applied? → Run verification SQL above
2. Backend restarted? → Stop and start `npm run dev`
3. Service role key set? → `grep SUPABASE_SERVICE_ROLE_KEY backend/.env`
4. Browser cache? → Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

### Issue: Getting 403 Forbidden instead
**This means**:
- Authentication works ✅
- Authorization fails ❌

**Check**:
- Does the room have a workspace_id?
- Are you a member of that workspace?
- Try with a room that has no workspace_id

### Issue: "psql: command not found"
**Solution**:
- **Ubuntu/Debian**: `sudo apt-get install postgresql-client`
- **macOS**: `brew install postgresql`
- **Windows**: Use Supabase Dashboard method instead

## 📊 Success Indicators

You'll know the fix worked when:
- ✅ Share modal opens instantly
- ✅ No errors in browser console
- ✅ All network requests return 200 OK
- ✅ Can change access settings
- ✅ Can add/remove invites
- ✅ Can copy share link

## 📝 Notes

- The fix maintains security while supporting rooms without workspaces
- Service client is only used as fallback when user tokens are invalid
- RBAC middleware still enforces permissions at application level
- RLS policies are more flexible but still secure

## 🎯 Next Steps After Fix

Consider:
1. Creating a default workspace for each user
2. Automatically assigning rooms to user's primary workspace
3. Adding workspace creation flow in onboarding
4. Implementing token refresh in frontend
5. Adding better error messages for permission issues

---

**Need more help?** See `FIX_SHARING_401_ERROR.md` for detailed documentation.
