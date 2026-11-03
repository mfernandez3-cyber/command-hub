# Command Hub

One app, on iPhone and web, where you give an instruction once and it gets routed to the right AI agent, tracked to done, and held for your approval before anything risky happens.

This is **Phase 1: Foundation**. It gives you:

- **Command**: type or speak an instruction, `@mention` an agent, or let it default to Tara
- **Agents**: the full roster with live status (Grok team, Cursor, Claude Code, Polar, Muse)
- **Tasks**: one board for every task, filterable by status or agent
- **Task thread**: the running log for a task, with replies, status changes, and approval requests
- **Approvals**: one tap to approve or reject anything public, paid, sent, merged, or deleted
- **Memory**: shared notes every agent will read (replaces the Bot Briefs folder)
- Email sign-in for an allow-listed team; Millie and the investing bots are visible only to the owner
- Live updates across screens and installable to the iPhone home screen

Agents don't run on their own yet. That starts in Phase 2 (Grok team on the xAI API), Phase 3 (Cursor and Claude Code), and Phase 4 (Polar and Muse via the browser queue). Until then the Hub works as the shared task board and approvals inbox.

## Set up (about 15 minutes)

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste in `supabase/migrations/0001_init.sql`, and run it.
3. Open `supabase/migrations/0002_seed.sql`, check the owner email at the top, add a line for each teammate (role `member`), and run it.
4. Go to **Authentication > URL Configuration** and set the Site URL to your Vercel address (after step 2 below). Add `https://YOUR-APP.vercel.app/auth/callback` under Redirect URLs.

To add someone later, run:

```sql
insert into public.allowed_emails (email, role) values ('name@example.com', 'member');
```

### 2. Vercel

1. Import this GitHub repo in Vercel.
2. Add two environment variables from Supabase **Project Settings > API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy.

### 3. Put it on your iPhone

Open the Vercel address in Safari, tap **Share**, then **Add to Home Screen**.

## Run locally

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev
```

## How it's built

- Next.js (App Router) with server actions
- Supabase for Postgres, sign-in, row-level security, and live updates
- Schema: `agents`, `tasks`, `events` (the thread and audit log), `approvals`, `memory`, `browser_jobs`

An approval decision automatically writes to the task thread and moves the task back to the queue (approved) or cancels it (rejected).
