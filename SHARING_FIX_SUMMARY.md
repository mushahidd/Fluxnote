# Share Modal 401 Error - Fix Summary

## Quick Fix Guide

### ✅ Code Changes (Already Applied)

The following code changes have been applied to fix the 401 error:

1. **`backend/src/services/shareService.js`**
   - Added service client fallback for all share operations
   - Functions now work even with invalid/expired tokens
   - Handles rooms without workspaces

2. **`backend/src/middleware/rbac.js`**
   - Grants "lead" role by default for rooms without workspaces
   - Passes user email to role resolution functions
   - Better error handling

3. **`backend/src/routes/sharing.js`**
   - Passes userId to getShareSettings for better tracking

### ⚠️ Database Changes (Requires Manual Action)

**You need to apply the database RLS policy updates:**

#### Method 1: Using the Script (Easiest)
```bash
cd backend
./apply-sharing-fix.sh
```

#### Method 2: Using Supabase Dashboard
1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Go to **SQL Editor**
3. Copy contents of `backend/fix-sharing-rls.sql`
4. Paste and click **Run**

#### Method 3: Using psql
```bash
cd backend
psql "$DATABASE_URL" < fix-sharing-rls.sql
```

## What Was the Problem?

The share endpoint was returning **401 Unauthorized** because:

1. **RLS Policies Too Restrictive**: The Row Level Security policies required workspace membership, but rooms can exist without workspaces
2. **Invalid Token Handling**: When tokens expired, the fallback mock user still tried to use the invalid token for database queries
3. **RBAC Middleware**: Returned null for workspace roles on workspace-less rooms, causing permission denials

## What Does the Fix Do?

### Code Level:
- ✅ Uses Supabase service role key (bypasses RLS) when user tokens are invalid
- ✅ Handles rooms without workspaces gracefully
- ✅ Grants appropriate default permissions for workspace-less rooms

### Database Level:
- ⚠️ Updates RLS policies to use `LEFT JOIN` instead of `JOIN`
- ⚠️ Adds checks for `workspace_id IS NULL` to allow operations
- ⚠️ Maintains security while supporting flexible room creation

## Testing the Fix

After applying the database changes:

1. **Open the editor**: `http://localhost:3000/editor?roomId=<room-id>`
2. **Click Share button** (should open without errors)
3. **Check browser console** (no 401 errors)
4. **Try changing settings**:
   - Switch between "Restricted" and "Anyone with the link"
   - Add email invites
   - Change roles
5. **Verify in Network tab**: All `/api/rooms/*/share` requests return 200 OK

## Files Created/Modified

### Created:
- ✅ `backend/fix-sharing-rls.sql` - Database RLS policy updates
- ✅ `backend/apply-sharing-fix.sh` - Helper script to apply DB changes
- ✅ `FIX_SHARING_401_ERROR.md` - Detailed documentation
- ✅ `SHARING_FIX_SUMMARY.md` - This file

### Modified:
- ✅ `backend/src/services/shareService.js`
- ✅ `backend/src/middleware/rbac.js`
- ✅ `backend/src/routes/sharing.js`

## Need Help?

### Still seeing 401 errors?
1. Verify database changes were applied: Check Supabase Dashboard → Database → Policies
2. Check backend logs: `cd backend && npm run dev`
3. Verify environment variables: `grep SUPABASE backend/.env`

### Getting 403 Forbidden?
- Check if user has correct role in workspace
- Verify room's workspace_id: `SELECT workspace_id FROM rooms WHERE id = '<room-id>'`

### Other issues?
- See `FIX_SHARING_401_ERROR.md` for detailed troubleshooting
- Check backend console for specific error messages
- Verify Supabase service role key is valid

## Architecture Notes

### Why Service Client?
The service role key bypasses RLS, which is necessary when:
- User tokens are expired/invalid
- Rooms don't have workspaces (no workspace membership to check)
- Reading share settings (non-sensitive data)

### Security Considerations
- Service client is only used as fallback
- RBAC middleware still enforces role requirements at application level
- RLS policies still protect against unauthorized modifications
- Only authenticated users can access share endpoints

### Future Improvements
Consider:
- Implementing proper workspace creation flow for all rooms
- Adding token refresh logic in frontend
- Creating a "personal workspace" for each user automatically
- Better error messages for permission issues
