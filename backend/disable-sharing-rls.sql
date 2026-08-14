-- Temporarily disable RLS on sharing tables to fix infinite recursion
-- Run this in Supabase SQL Editor

-- Disable RLS on room_shares
ALTER TABLE public.room_shares DISABLE ROW LEVEL SECURITY;

-- Disable RLS on room_share_invites  
ALTER TABLE public.room_share_invites DISABLE ROW LEVEL SECURITY;

-- Drop the problematic policies
DROP POLICY IF EXISTS "room_shares_select" ON public.room_shares;
DROP POLICY IF EXISTS "room_shares_insert" ON public.room_shares;
DROP POLICY IF EXISTS "room_shares_update" ON public.room_shares;
DROP POLICY IF EXISTS "room_shares_delete" ON public.room_shares;
DROP POLICY IF EXISTS "share_invites_select" ON public.room_share_invites;
DROP POLICY IF EXISTS "share_invites_insert" ON public.room_share_invites;
DROP POLICY IF EXISTS "share_invites_update" ON public.room_share_invites;
DROP POLICY IF EXISTS "share_invites_delete" ON public.room_share_invites;
