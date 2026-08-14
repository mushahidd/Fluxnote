-- ============================================================
-- c — Let's Integrate Groups, Manage Anything
-- Supabase SQL Schema (copy-paste into Supabase SQL Editor)
-- ============================================================
-- Run this entire file in Supabase > SQL Editor > New Query
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. USERS
-- Supabase auth.users is the source of truth for auth.
-- This table extends it with profile data.
-- ============================================================
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  display_name text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- 2. WORKSPACES
-- A workspace is the top-level org (like a Notion workspace).
-- ============================================================
create table public.workspaces (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  owner_id    uuid not null references public.users(id) on delete restrict,
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 3. WORKSPACE MEMBERS
-- Roles at workspace level: 'owner' | 'lead' | 'contributor' | 'viewer'
-- ============================================================
create table public.workspace_members (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  role         text not null default 'contributor'
               check (role in ('owner', 'lead', 'contributor', 'viewer')),
  joined_at    timestamptz not null default now(),
  unique (workspace_id, user_id)
);

-- ============================================================
-- 4. ROOMS (canvas sessions)
-- Each room is one infinite canvas session.
-- status: 'active' | 'archived'
-- viewport_state: persists last known camera position
-- ============================================================
create table public.rooms (
  id             uuid primary key default uuid_generate_v4(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  name           text not null,
  status         text not null default 'active'
                 check (status in ('active', 'archived')),
  viewport_state jsonb not null default '{"x": 0, "y": 0, "zoom": 1}',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- 5. CANVAS NODES
-- Every element on the canvas: sticky note, shape, text, drawing.
-- type: 'sticky' | 'text' | 'shape' | 'drawing' | 'connector'
-- ai_label: 'action_item' | 'decision' | 'open_question' | 'reference' | null
-- version: monotonic integer used for CRDT / OT conflict resolution
-- ============================================================
create table public.canvas_nodes (
  id          uuid primary key default uuid_generate_v4(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  parent_id   uuid references public.canvas_nodes(id) on delete set null,
  created_by  uuid not null references public.users(id) on delete restrict,

  type        text not null
              check (type in ('sticky', 'text', 'shape', 'drawing', 'connector')),

  -- The actual content of the node (text, drawing path data, shape config, etc.)
  content     jsonb not null default '{}',

  -- Position & size on the canvas
  position    jsonb not null default '{"x": 0, "y": 0, "width": 200, "height": 150}',

  -- Visual style (color, font, border, etc.)
  style       jsonb not null default '{}',

  -- AI-classified intent (populated by backend after text change)
  ai_label    text check (ai_label in ('action_item', 'decision', 'open_question', 'reference')),

  z_index     integer not null default 0,
  locked      boolean not null default false,

  -- Monotonic version counter for CRDT merge logic
  -- Increment this on every mutation; use for "last-write-wins with version check"
  -- or as the logical clock for CRDT operations
  version     bigint not null default 1,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_canvas_nodes_room   on public.canvas_nodes(room_id);
create index idx_canvas_nodes_label  on public.canvas_nodes(ai_label) where ai_label is not null;

-- ============================================================
-- 6. NODE-LEVEL PERMISSIONS (per-node RBAC)
-- Controls who can do what on a specific canvas node.
-- role_required: minimum workspace role needed
-- permission:    what is granted ('edit' | 'comment' | 'view')
-- If no row exists for a node, it inherits workspace-level role defaults.
-- ============================================================
create table public.node_permissions (
  id            uuid primary key default uuid_generate_v4(),
  node_id       uuid not null references public.canvas_nodes(id) on delete cascade,
  -- null user_id = applies to all users who have at least role_required
  user_id       uuid references public.users(id) on delete cascade,
  role_required text not null default 'contributor'
                check (role_required in ('owner', 'lead', 'contributor', 'viewer')),
  permission    text not null
                check (permission in ('edit', 'comment', 'view', 'none')),
  created_at    timestamptz not null default now(),
  unique (node_id, user_id)
);

create index idx_node_perms_node on public.node_permissions(node_id);

-- ============================================================
-- 7. TASKS (auto-generated task board)
-- Created automatically when a canvas node is labelled 'action_item' by AI.
-- Also linkable back to the originating canvas node.
-- status: 'todo' | 'in_progress' | 'done'
-- ai_intent: raw AI classification (mirrors canvas_nodes.ai_label)
-- ============================================================
create table public.tasks (
  id             uuid primary key default uuid_generate_v4(),
  room_id        uuid not null references public.rooms(id) on delete cascade,
  source_node_id uuid references public.canvas_nodes(id) on delete set null,
  assigned_to    uuid references public.users(id) on delete set null,
  created_by     uuid not null references public.users(id) on delete restrict,

  title          text not null,
  status         text not null default 'todo'
                 check (status in ('todo', 'in_progress', 'done')),
  priority       text not null default 'medium'
                 check (priority in ('low', 'medium', 'high')),
  ai_intent      text,

  due_date       timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_tasks_room        on public.tasks(room_id);
create index idx_tasks_source_node on public.tasks(source_node_id);
create index idx_tasks_assigned    on public.tasks(assigned_to);

-- ============================================================
-- 8. EVENTS — APPEND-ONLY IMMUTABLE EVENT LOG
-- Every single mutation to the canvas is recorded here.
-- NEVER update or delete rows in this table.
-- event_type examples:
--   node.created | node.moved | node.resized | node.content_updated
--   node.style_changed | node.locked | node.unlocked | node.deleted
--   node.ai_labelled | task.created | task.status_changed
--   permission.set | room.created | member.joined | member.role_changed
-- seq: monotonically increasing per room — used for WebSocket reconnect replay
-- prev_state: snapshot of the node before mutation (for time-travel replay)
-- ============================================================
create sequence public.room_event_seq start 1 increment 1;

create table public.events (
  id           uuid primary key default uuid_generate_v4(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  user_id      uuid references public.users(id) on delete set null,
  node_id      uuid,  -- intentionally no FK so deleted node events are preserved
  event_type   text not null,
  payload      jsonb not null default '{}',
  prev_state   jsonb,   -- full snapshot of node before this mutation
  seq          bigint not null default nextval('public.room_event_seq'),
  occurred_at  timestamptz not null default now()
);

-- Composite index: room + seq is the primary WebSocket replay query
create index idx_events_room_seq  on public.events(room_id, seq);
create index idx_events_node      on public.events(node_id);
create index idx_events_user      on public.events(user_id);

-- Hard-prevent any updates or deletes on events (append-only enforcement)
create or replace function public.prevent_event_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Events are immutable. No UPDATE or DELETE allowed on public.events.';
end;
$$;

create trigger enforce_event_immutability
  before update or delete on public.events
  for each row execute procedure public.prevent_event_mutation();

-- ============================================================
-- 9. PRESENCE — real-time cursor & viewport tracking
-- Updated on every cursor move via WebSocket.
-- This table is ephemeral — cleaned up when user disconnects.
-- One row per (room, user). Upsert on every tick.
-- ============================================================
create table public.presence (
  id              uuid primary key default uuid_generate_v4(),
  room_id         uuid not null references public.rooms(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  cursor_position jsonb not null default '{"x": 0, "y": 0}',
  viewport        jsonb not null default '{"x": 0, "y": 0, "zoom": 1}',
  status          text not null default 'active'
                  check (status in ('active', 'idle', 'disconnected')),
  last_seen       timestamptz not null default now(),
  unique (room_id, user_id)
);

create index idx_presence_room on public.presence(room_id);

-- ============================================================
-- 10. HELPER FUNCTIONS
-- ============================================================

-- Returns the workspace role of a given user (used in RLS policies)
create or replace function public.get_user_role(p_workspace_id uuid, p_user_id uuid)
returns text language sql stable security definer as $$
  select role from public.workspace_members
  where workspace_id = p_workspace_id and user_id = p_user_id
  limit 1;
$$;

-- Checks if a user can edit a specific canvas node (used server-side before mutations)
-- Returns true if: user has 'edit' permission row, or their workspace role >= required role
create or replace function public.can_edit_node(p_node_id uuid, p_user_id uuid)
returns boolean language plpgsql stable security definer as $$
declare
  v_room_id   uuid;
  v_ws_id     uuid;
  v_user_role text;
  v_perm      text;
  v_required  text;
  role_rank   int;
  req_rank    int;
begin
  -- Get room → workspace
  select n.room_id, r.workspace_id
    into v_room_id, v_ws_id
    from public.canvas_nodes n
    join public.rooms r on r.id = n.room_id
   where n.id = p_node_id;

  if not found then return false; end if;

  -- Get user's workspace role
  v_user_role := public.get_user_role(v_ws_id, p_user_id);
  if v_user_role is null then return false; end if;

  -- Check explicit per-node permission first
  select permission, role_required
    into v_perm, v_required
    from public.node_permissions
   where node_id = p_node_id
     and (user_id = p_user_id or user_id is null)
   order by (user_id = p_user_id) desc  -- user-specific row wins over wildcard
   limit 1;

  if found then
    if v_perm = 'none' then return false; end if;
    if v_perm in ('edit') then
      -- Still need to meet minimum role
      role_rank := case v_user_role when 'owner' then 4 when 'lead' then 3 when 'contributor' then 2 when 'viewer' then 1 else 0 end;
      req_rank  := case v_required  when 'owner' then 4 when 'lead' then 3 when 'contributor' then 2 when 'viewer' then 1 else 0 end;
      return role_rank >= req_rank;
    end if;
    return false;
  end if;

  -- No explicit row → fall back to workspace role (contributor+ can edit)
  return v_user_role in ('owner', 'lead', 'contributor');
end;
$$;

-- Convenience: insert an event and return its seq
create or replace function public.log_event(
  p_room_id    uuid,
  p_user_id    uuid,
  p_node_id    uuid,
  p_event_type text,
  p_payload    jsonb,
  p_prev_state jsonb default null
)
returns bigint language plpgsql security definer as $$
declare
  v_seq bigint;
begin
  insert into public.events(room_id, user_id, node_id, event_type, payload, prev_state)
  values (p_room_id, p_user_id, p_node_id, p_event_type, p_payload, p_prev_state)
  returning seq into v_seq;
  return v_seq;
end;
$$;

-- ============================================================
-- 11. UPDATED_AT TRIGGER (auto-update timestamp)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

create trigger trg_rooms_updated_at
  before update on public.rooms
  for each row execute procedure public.set_updated_at();

create trigger trg_canvas_nodes_updated_at
  before update on public.canvas_nodes
  for each row execute procedure public.set_updated_at();

create trigger trg_tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- 12. ROW LEVEL SECURITY (RLS)
-- Enable and lock down every table.
-- ============================================================

alter table public.users              enable row level security;
alter table public.workspaces         enable row level security;
alter table public.workspace_members  enable row level security;
alter table public.rooms              enable row level security;
alter table public.canvas_nodes       enable row level security;
alter table public.node_permissions   enable row level security;
alter table public.tasks              enable row level security;
alter table public.events             enable row level security;
alter table public.presence           enable row level security;

-- USERS: users can read all profiles, edit only their own
create policy "users_select_all"  on public.users for select using (true);
create policy "users_update_own"  on public.users for update using (auth.uid() = id);

-- WORKSPACES: only members can see their workspaces
create policy "workspaces_select" on public.workspaces for select
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = id and user_id = auth.uid()
    )
  );
create policy "workspaces_insert" on public.workspaces for insert
  with check (owner_id = auth.uid());
create policy "workspaces_update" on public.workspaces for update
  using (owner_id = auth.uid());

-- WORKSPACE MEMBERS: members can see their workspace's members
create policy "ws_members_select" on public.workspace_members for select
  using (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_id and wm2.user_id = auth.uid()
    )
  );
create policy "ws_members_insert" on public.workspace_members for insert
  with check (
    public.get_user_role(workspace_id, auth.uid()) in ('owner', 'lead')
  );
create policy "ws_members_update" on public.workspace_members for update
  using (public.get_user_role(workspace_id, auth.uid()) in ('owner', 'lead'));
create policy "ws_members_delete" on public.workspace_members for delete
  using (public.get_user_role(workspace_id, auth.uid()) = 'owner');

-- ROOMS: workspace members can see rooms
create policy "rooms_select" on public.rooms for select
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = rooms.workspace_id and user_id = auth.uid()
    )
  );
create policy "rooms_insert" on public.rooms for insert
  with check (
    public.get_user_role(workspace_id, auth.uid()) in ('owner', 'lead', 'contributor')
  );
create policy "rooms_update" on public.rooms for update
  using (
    public.get_user_role(workspace_id, auth.uid()) in ('owner', 'lead')
  );

-- CANVAS NODES: workspace members can read; edit controlled by can_edit_node()
create policy "nodes_select" on public.canvas_nodes for select
  using (
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
    )
  );
create policy "nodes_insert" on public.canvas_nodes for insert
  with check (
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead', 'contributor')
    )
  );
create policy "nodes_update" on public.canvas_nodes for update
  using (public.can_edit_node(id, auth.uid()));
create policy "nodes_delete" on public.canvas_nodes for delete
  using (
    created_by = auth.uid() or
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );

-- NODE PERMISSIONS: leads/owners can manage
create policy "node_perms_select" on public.node_permissions for select
  using (
    exists (
      select 1 from public.canvas_nodes n
      join public.rooms r on r.id = n.room_id
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where n.id = node_id and wm.user_id = auth.uid()
    )
  );
create policy "node_perms_insert" on public.node_permissions for insert
  with check (
    exists (
      select 1 from public.canvas_nodes n
      join public.rooms r on r.id = n.room_id
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where n.id = node_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );
create policy "node_perms_delete" on public.node_permissions for delete
  using (
    exists (
      select 1 from public.canvas_nodes n
      join public.rooms r on r.id = n.room_id
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where n.id = node_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );

-- TASKS: workspace members can read; contributors+ can create/edit
create policy "tasks_select" on public.tasks for select
  using (
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
    )
  );
create policy "tasks_insert" on public.tasks for insert
  with check (
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead', 'contributor')
    )
  );
create policy "tasks_update" on public.tasks for update
  using (
    created_by = auth.uid() or assigned_to = auth.uid() or
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
        and wm.role in ('owner', 'lead')
    )
  );

-- EVENTS: members can read; insert only (no update/delete — enforced by trigger too)
create policy "events_select" on public.events for select
  using (
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
    )
  );
create policy "events_insert" on public.events for insert
  with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
    )
  );

-- PRESENCE: members can read; each user manages their own row
create policy "presence_select" on public.presence for select
  using (
    exists (
      select 1 from public.rooms r
      join public.workspace_members wm on wm.workspace_id = r.workspace_id
      where r.id = room_id and wm.user_id = auth.uid()
    )
  );
create policy "presence_upsert" on public.presence for insert
  with check (user_id = auth.uid());
create policy "presence_update" on public.presence for update
  using (user_id = auth.uid());
create policy "presence_delete" on public.presence for delete
  using (user_id = auth.uid());

-- ============================================================
-- 13. REALTIME — enable for live canvas sync
-- ============================================================
-- Run these in Supabase Dashboard > Database > Replication
-- or via the SQL editor:

begin;
  -- Enable realtime on canvas_nodes so Prisma/client can subscribe to changes
  alter publication supabase_realtime add table public.canvas_nodes;
  alter publication supabase_realtime add table public.tasks;
  alter publication supabase_realtime add table public.presence;
  alter publication supabase_realtime add table public.events;
commit;

-- ============================================================
-- 14. SEED DATA (optional — for local dev testing)
-- ============================================================

-- Insert a test workspace + room (swap UUIDs after creating a real auth user)
-- insert into public.workspaces (id, name, slug, owner_id)
-- values ('00000000-0000-0000-0000-000000000001', 'Test Workspace', 'test-ws', '<your-user-uuid>');

-- insert into public.workspace_members (workspace_id, user_id, role)
-- values ('00000000-0000-0000-0000-000000000001', '<your-user-uuid>', 'owner');

-- insert into public.rooms (workspace_id, name)
-- values ('00000000-0000-0000-0000-000000000001', 'Sprint Planning');

-- ============================================================
-- DONE! Connect via Prisma using DATABASE_URL from Supabase
-- Settings > Database > Connection String (use "Session mode"
-- port 5432 for Prisma, NOT the transaction pooler port)
-- ============================================================
