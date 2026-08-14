# Supabase Setup Guide

Follow these steps to connect the database and enable full persistence.

---

## Step 1 — Get the database password

The project owner already knows the password. Ask them to share it, or if you are the owner:

1. Go to: https://supabase.com/dashboard/project/dpezlvyebkbchgqalpro/settings/database
2. The password was set when the project was created — it's the one you chose at that time
3. If you've forgotten it, scroll to **"Reset database password"** and set a new one

---

## Step 2 — Get the Session Pooler connection string

1. On the same settings page, click the **"Connect"** button (top right)
2. Select **"Session pooler"** (required — direct connection is IPv4 incompatible on most networks)
3. Select **Type: URI**
4. Copy the connection string — it looks like:
   ```
   postgresql://postgres.dpezlvyebkbchgqalpro:[YOUR-PASSWORD]@aws-0-XX-XXXX-X.pooler.supabase.com:5432/postgres
   ```
5. Replace `[YOUR-PASSWORD]` with the actual password

---

## Step 3 — Update .env

Open `backend/.env` and set:

```env
DATABASE_URL=postgresql://postgres.dpezlvyebkbchgqalpro:[YOUR-PASSWORD]@aws-0-XX-XXXX-X.pooler.supabase.com:5432/postgres
```

---

## Step 4 — Get fresh API keys

1. Go to: https://supabase.com/dashboard/project/dpezlvyebkbchgqalpro/settings/api
2. Copy **anon public** key → update `SUPABASE_ANON_KEY` in `.env`
3. Copy **service_role** key → update `SUPABASE_SERVICE_ROLE_KEY` in `.env`

---

## Step 5 — Run database migrations

Open a terminal in `backend/` and run:

```bash
npm run prisma:migrate
```

This creates all tables: `User`, `Room`, `Event`, `NodeAcl`, `Task`

If migration fails, run the SQL manually in Supabase SQL editor:

```sql
-- Go to: https://supabase.com/dashboard/project/dpezlvyebkbchgqalpro/sql/new
-- Paste and run the contents of: backend/src/db/ligma_schema.sql
```

---

## Step 6 — Verify connection

```bash
cd backend
node test-db.js
```

You should see:
```
✅ Database connected! Users: 0
✅ Rooms: 0
✅ Events: 0
```

---

## Step 7 — Restart the backend

```bash
npm run dev
```

---

## What works WITHOUT the database (current state)

Even without DB connected, the app works with these guarantees:

| Feature | Without DB | With DB |
|---|---|---|
| Real-time drawing sync | ✅ Works (Yjs WebSocket) | ✅ Works |
| Drawings visible to all users in session | ✅ Works | ✅ Works |
| Drawings survive page refresh (same session) | ✅ Works (disk persistence) | ✅ Works |
| Drawings survive backend restart | ✅ Works (saved to `backend/data/ydocs/`) | ✅ Works |
| Event history / audit log | ❌ Not saved | ✅ Saved |
| AI canvas summary export | ❌ No history | ✅ Full history |
| RBAC enforcement | ⚠️ Permissive (allows all) | ✅ Enforced |

---

## Troubleshooting

**"Tenant or user not found"** — You're using the direct connection URL. Switch to Session Pooler (Step 2).

**"Can't reach database server"** — Your network blocks port 5432 to Supabase direct. Use Session Pooler.

**"Invalid API key"** — API keys were rotated. Get fresh ones from Step 4.

**Prisma generate fails (EPERM on Windows)** — Close any running backend process first, then run `npm run prisma:generate`.
