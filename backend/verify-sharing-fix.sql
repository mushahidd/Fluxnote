-- Verify that the sharing RLS policies were applied correctly

-- Check all policies on room_shares table
SELECT 
  policyname,
  cmd as operation,
  permissive,
  CASE 
    WHEN length(qual::text) > 100 THEN left(qual::text, 100) || '...'
    ELSE qual::text
  END as using_clause
FROM pg_policies 
WHERE tablename = 'room_shares'
ORDER BY cmd;

-- Check all policies on room_share_invites table
SELECT 
  policyname,
  cmd as operation,
  permissive,
  CASE 
    WHEN length(qual::text) > 100 THEN left(qual::text, 100) || '...'
    ELSE qual::text
  END as using_clause
FROM pg_policies 
WHERE tablename = 'room_share_invites'
ORDER BY cmd;

-- Check if there are any rooms without workspace_id
SELECT 
  id,
  name,
  workspace_id,
  status,
  created_at
FROM rooms
WHERE workspace_id IS NULL
ORDER BY created_at DESC
LIMIT 5;

-- Check existing share configurations
SELECT 
  rs.id,
  rs.room_id,
  r.name as room_name,
  r.workspace_id,
  rs.access_type,
  rs.link_role,
  rs.created_at
FROM room_shares rs
JOIN rooms r ON r.id = rs.room_id
ORDER BY rs.created_at DESC
LIMIT 5;
