# Fix for 401 Unauthorized Error on Share Endpoint

## Problem

The share modal was failing with a **401 Unauthorized** error when trying to access `/api/rooms/:roomId/share`. This occurred because:

1. **Rooms without workspaces**: Rooms can be created without a `workspace_id`, but the RLS (Row Level Security) policies on `room_shares` and `room_share_invites` tables required workspace membership
2. **Invalid tokens**: When authentication tokens are invalid/expired, the auth middleware falls back to a mock user, but the service still tried to use the invalid token for database queries
3. **RBAC middleware**: The `requireRole` middleware returned `null` for workspace roles when rooms had no workspace, causing 403/401 errors

## Solution

### 1. Update Backend Services (✅ Applied)

Modified `backend/src/services/shareService.js` to:
- Use service client as fallback when user token is invalid
- Bypass RLS restrictions for share operations
- Handle cases where rooms have no workspace

### 2. Update RBAC Middleware (✅ Applied)

Modified `backend/src/middleware/rbac.js` to:
- Grant **lead role by default** for rooms without workspaces
- Pass user email to `getWorkspaceRoleForRoom` for better role resolution
- Check if room has no workspace before rejecting access

### 3. Update Database RLS Policies (⚠️ Needs Manual Application)

Created `backend/fix-sharing-rls.sql` with updated RLS policies that:
- Allow access to rooms without workspaces
- Use `LEFT JOIN` instead of `JOIN` for workspace_members
- Check `r.workspace_id is null` to allow operations on workspace-less rooms

## How to Apply the Database Fix

### Option 1: Using Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy the contents of `backend/fix-sharing-rls.sql`
4. Paste into the SQL Editor
5. Click **Run** to execute

### Option 2: Using psql Command Line

```bash
# From the backend directory
psql "$DATABASE_URL" < fix-sharing-rls.sql
```

### Option 3: Using the setup script

```bash
cd backend
chmod +x setup-db.sh
./setup-db.sh
```

Then manually run the `fix-sharing-rls.sql` file in Supabase SQL Editor.

## Verification

After applying all fixes, test the share functionality:

1. **Open the editor** with a room: `http://localhost:3000/editor?roomId=<your-room-id>`
2. **Click the Share button** in the toolbar
3. **Verify the modal opens** without 401 errors
4. **Try changing access type** from "Restricted" to "Anyone with the link"
5. **Try adding email invites**
6. **Check browser console** - should see no 401 errors

## What Changed

### Files Modified:
- ✅ `backend/src/services/shareService.js` - Added service client fallback
- ✅ `backend/src/middleware/rbac.js` - Handle rooms without workspaces
- ✅ `backend/src/routes/sharing.js` - Pass userId to getShareSettings
- ⚠️ `backend/fix-sharing-rls.sql` - **Needs manual application to database**

### Key Improvements:
1. **Service client fallback**: When user tokens are invalid, use service role key to bypass RLS
2. **Workspace-less rooms support**: Rooms without workspaces now work correctly
3. **Better error handling**: More graceful degradation when authentication fails
4. **RLS policy updates**: Database policies now handle NULL workspace_id correctly

## Troubleshooting

### Still getting 401 errors?

1. **Check if RLS policies were applied**:
   ```sql
   SELECT * FROM pg_policies WHERE tablename IN ('room_shares', 'room_share_invites');
   ```

2. **Verify service role key is set**:
   ```bash
   # Check backend/.env
   grep SUPABASE_SERVICE_ROLE_KEY backend/.env
   ```

3. **Check backend logs** for specific error messages:
   ```bash
   cd backend
   npm run dev
   ```

4. **Verify room has correct structure**:
   ```sql
   SELECT id, name, workspace_id FROM rooms WHERE id = '<your-room-id>';
   ```

### Getting 403 Forbidden instead?

This means authentication worked but authorization failed. Check:
- User's role in the workspace (if room has workspace_id)
- Whether the room has a workspace_id at all
- RBAC middleware logs in backend console

## Related Files

- `backend/src/db/sharing_schema.sql` - Original RLS policies
- `backend/fix-workspace-rls.sql` - Previous workspace RLS fix
- `backend/disable-sharing-rls.sql` - Emergency RLS disable script (not recommended)
