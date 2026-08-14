-- ============================================================
-- Fix RLS policies for room_shares and room_share_invites
-- to handle rooms without workspace_id
-- ============================================================

-- Drop existing policies
drop policy if exists "room_shares_select" on public.room_shares;
drop policy if exists "room_shares_insert" on public.room_shares;
drop policy if exists "room_shares_update" on public.room_shares;
drop policy if exists "room_shares_delete" on public.room_shares;
drop policy if exists "share_invites_select" on public.room_share_invites;
drop policy if exists "share_invites_insert" on public.room_share_invites;
drop policy if exists "share_invites_update" on public.room_share_invites;
drop policy if exists "share_invites_delete" on public.room_share_invites;

-- ============================================================
-- RLS for room_shares (updated to handle rooms without workspace)
-- ============================================================

-- Users can read share config if:
-- 1. They created it, OR
-- 2. They are a member of the room's workspace (if it has one), OR
-- 3. The room has no workspace (allow all authenticated users)
create policy "room_shares_select" on public.room_shares for select
  using (
    created_by = auth.uid()
    or exists (
      select 1 from public.rooms r
      left join public.workspace_members wm on wm.workspace_id = r.workspace_id and wm.user_id = auth.uid()
      where r.id = room_id
        and (r.workspace_id is null or wm.user_id is not null)
    )
  );

-- Users can create share config if:
-- 1. They are lead/owner in the room's workspace, OR
-- 2. The room has no workspace (allow all authenticated users)
create policy "room_shares_insert" on public.room_shares for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.rooms r
      left join public.workspace_members wm on wm.workspace_id = r.workspace_id and wm.user_id = auth.uid()
      where r.id = room_id
        and (
          r.workspace_id is null
          or (wm.user_id is not null and wm.role in ('owner', 'lead'))
        )
    )
  );

-- Users can update share config if:
-- 1. They are lead/owner in the room's workspace, OR
-- 2. The room has no workspace (allow all authenticated users)
create policy "room_shares_update" on public.room_shares for update
  using (
    exists (
      select 1 from public.rooms r
      left join public.workspace_members wm on wm.workspace_id = r.workspace_id and wm.user_id = auth.uid()
      where r.id = room_id
        and (
          r.workspace_id is null
          or (wm.user_id is not null and wm.role in ('owner', 'lead'))
        )
    )
  );

-- Users can delete share config if:
-- 1. They are lead/owner in the room's workspace, OR
-- 2. The room has no workspace (allow all authenticated users)
create policy "room_shares_delete" on public.room_shares for delete
  using (
    exists (
      select 1 from public.rooms r
      left join public.workspace_members wm on wm.workspace_id = r.workspace_id and wm.user_id = auth.uid()
      where r.id = room_id
        and (
          r.workspace_id is null
          or (wm.user_id is not null and wm.role in ('owner', 'lead'))
        )
    )
  );

-- ============================================================
-- RLS for room_share_invites (updated to handle rooms without workspace)
-- ============================================================

-- Users can read invites if:
-- 1. They were invited (by email or user_id), OR
-- 2. They invited someone, OR
-- 3. They are lead/owner in the room's workspace, OR
-- 4. The room has no workspace (allow all authenticated users)
create policy "share_invites_select" on public.room_share_invites for select
  using (
    invited_by = auth.uid()
    or user_id = auth.uid()
    or exists (
      select 1 from public.rooms r
      left join public.workspace_members wm on wm.workspace_id = r.workspace_id and wm.user_id = auth.uid()
      where r.id = room_id
        and (
          r.workspace_id is null
          or (wm.user_id is not null and wm.role in ('owner', 'lead'))
        )
    )
  );

-- Users can create invites if:
-- 1. They are lead/owner in the room's workspace, OR
-- 2. The room has no workspace (allow all authenticated users)
create policy "share_invites_insert" on public.room_share_invites for insert
  with check (
    invited_by = auth.uid()
    and exists (
      select 1 from public.rooms r
      left join public.workspace_members wm on wm.workspace_id = r.workspace_id and wm.user_id = auth.uid()
      where r.id = room_id
        and (
          r.workspace_id is null
          or (wm.user_id is not null and wm.role in ('owner', 'lead'))
        )
    )
  );

-- Users can update invites if:
-- 1. They are the invited user (to accept), OR
-- 2. They created the invite, OR
-- 3. They are lead/owner in the room's workspace, OR
-- 4. The room has no workspace (allow all authenticated users)
create policy "share_invites_update" on public.room_share_invites for update
  using (
    user_id = auth.uid()
    or invited_by = auth.uid()
    or exists (
      select 1 from public.rooms r
      left join public.workspace_members wm on wm.workspace_id = r.workspace_id and wm.user_id = auth.uid()
      where r.id = room_id
        and (
          r.workspace_id is null
          or (wm.user_id is not null and wm.role in ('owner', 'lead'))
        )
    )
  );

-- Users can delete invites if:
-- 1. They created the invite, OR
-- 2. They are lead/owner in the room's workspace, OR
-- 3. The room has no workspace (allow all authenticated users)
create policy "share_invites_delete" on public.room_share_invites for delete
  using (
    invited_by = auth.uid()
    or exists (
      select 1 from public.rooms r
      left join public.workspace_members wm on wm.workspace_id = r.workspace_id and wm.user_id = auth.uid()
      where r.id = room_id
        and (
          r.workspace_id is null
          or (wm.user_id is not null and wm.role in ('owner', 'lead'))
        )
    )
  );

