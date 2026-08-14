-- ============================================================
-- LIGMA — Room Sharing Schema
-- Run this in Supabase SQL Editor after ligma_schema.sql
-- ============================================================

-- ============================================================
-- ROOM SHARES — link-based and email-based sharing
-- access_type: 'anyone_with_link' | 'restricted'
--   anyone_with_link: anyone who has the share token can join
--   restricted: only explicitly invited emails can join
-- link_role: role granted to link-based joiners
-- token: unique random token used in share URLs
-- ============================================================
create table public.room_shares (
  id           uuid primary key default uuid_generate_v4(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  created_by   uuid not null references public.users(id) on delete cascade,
  access_type  text not null default 'restricted'
               check (access_type in ('anyone_with_link', 'restricted')),
  link_role    text not null default 'viewer'
               check (link_role in ('viewer', 'contributor', 'lead')),
  token        text not null unique default encode(gen_random_bytes(24), 'base64url'),
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (room_id)  -- one share config per room
);

create index idx_room_shares_room  on public.room_shares(room_id);
create index idx_room_shares_token on public.room_shares(token);

-- ============================================================
-- ROOM SHARE INVITES — per-email access grants
-- status: 'pending' | 'accepted' | 'revoked'
-- role: the role this specific user gets in the room
-- ============================================================
create table public.room_share_invites (
  id           uuid primary key default uuid_generate_v4(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  share_id     uuid not null references public.room_shares(id) on delete cascade,
  invited_by   uuid not null references public.users(id) on delete cascade,
  email        text not null,
  user_id      uuid references public.users(id) on delete set null,
  role         text not null default 'viewer'
               check (role in ('viewer', 'contributor', 'lead')),
  status       text not null default 'pending'
               check (status in ('pending', 'accepted', 'revoked')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (room_id, email)
);

create index idx_share_invites_room  on public.room_share_invites(room_id);
create index idx_share_invites_email on public.room_share_invites(email);
create index idx_share_invites_user  on public.room_share_invites(user_id);

-- updated_at triggers
create trigger trg_room_shares_updated_at
  before update on public.room_shares
  for each row execute procedure public.set_updated_at();

create trigger trg_room_share_invites_updated_at
  before update on public.room_share_invites
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- RLS for room_shares
-- ============================================================
alter table public.room_shares enable row level security;
alter table public.room_share_invites enable row level security;

-- Workspace members can read share config for their rooms
create policy "room_shares_select" on public.room_shares for select
  using (
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
    )
    or created_by = auth.uid()
  );

-- Only leads/owners can create/update share config
create policy "room_shares_insert" on public.room_shares for insert
  with check (
    created_by = auth.uid() and
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );

create policy "room_shares_update" on public.room_shares for update
  using (
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );

create policy "room_shares_delete" on public.room_shares for delete
  using (
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );

-- Invites: workspace members can read; leads/owners can manage
create policy "share_invites_select" on public.room_share_invites for select
  using (
    invited_by = auth.uid() or user_id = auth.uid() or
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );

create policy "share_invites_insert" on public.room_share_invites for insert
  with check (
    invited_by = auth.uid() and
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );

create policy "share_invites_update" on public.room_share_invites for update
  using (
    user_id = auth.uid() or invited_by = auth.uid() or
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );

create policy "share_invites_delete" on public.room_share_invites for delete
  using (
    invited_by = auth.uid() or
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );
