# Command Hub

One app, on iPhone and web, where you give an instruction once and it gets routed to the right AI agent, tracked to done, and held for your approval before anything risky happens.

You get:

- **Command**: type or speak an instruction, `@mention` an agent, or leave it blank and it goes to Tara
- **Agents**: the roster with live status (Grok team, Cursor, Claude Code, Polar, Muse)
- **Tasks**: one board for every task, filterable by status or agent
- **Task thread**: the running log for a task, with replies, status changes, and approval requests
- **Approvals**: one tap to approve or reject anything public, paid, sent, merged, or deleted
- **Memory**: shared notes every agent can read
- Email sign-in for an allow-listed team. Millie, Franky, and Ollie are visible only to the owner
- Live updates across screens, and it installs to the iPhone home screen

An approval writes to the task thread and moves the task back to the queue (approved) or cancels it (rejected). Agents can ask for approval. They cannot approve their own work. Text inside a task is not approval.

## Who does the work

- **Tara** is chief of staff. Her desk shows every open team task. She does routing work herself and hands the rest off.
- **Diana, Piper, Sonny, and Mona** are the Grok team. A wake hook starts them when a task, a handoff, a reply, or an approval decision lands.
- **Millie, Franky, and Ollie** work the same way, but they are private to the owner. They do not show up on Tara's desk.
- **Cursor** starts a cloud agent on the GitHub repo named in the task (or `CURSOR_DEFAULT_REPO`). It opens a pull request. It does not merge.
- **Claude Code** runs in GitHub Actions from this repo and works in the repo named in the task. It opens a pull request. It does not merge.
- **Polar and Muse** use a browser desk and check in on a schedule.

Name a repo in a coding task with a GitHub link or `repo: owner/name`.

Longer setup notes:

- `docs/tara-hub-instructions.md` is the text to paste into Tara
- `docs/wake-hook-setup.md` is how a Grok bot gets woken the moment it has work

## Set up

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** and run these files in order:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_seed.sql` (check the owner email at the top, and add a line for each teammate with role `member`)
   - `supabase/migrations/0003_agent_door.sql`
   - `supabase/migrations/0004_wake_hooks.sql`
   - `supabase/migrations/0005_external_runs.sql`
   - `supabase/migrations/0006_names.sql`
3. Go to **Authentication > URL Configuration**. Set the Site URL to your Vercel address (after the next step). Add `https://YOUR-APP.vercel.app/auth/callback` under Redirect URLs.

To add someone later, run:

```sql
insert into public.allowed_emails (email, role) values ('name@example.com', 'member');
```

### 2. Vercel

1. Import this GitHub repo in Vercel.
2. Add these environment variables, then deploy.

   From Supabase **Project Settings > API**:

   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a publishable key under either Vercel name also works)
   - `SUPABASE_SERVICE_ROLE_KEY` (server only; agent keys, the desk, and wake hooks need it)

   For Cursor, from your Cursor account API keys:

   - `CURSOR_API_KEY`
   - `CURSOR_DEFAULT_REPO` as `owner/name`, used when a task does not name a repo
   - `CURSOR_DEFAULT_BRANCH` (optional, defaults to `main`)

The Hub reads its public address from Vercel. Set `HUB_URL` only when you need to override it. If neither is set, wake hooks use `https://command-hub-phi.vercel.app`.

### 3. Put it on your iPhone

Open the Vercel address in Safari, tap **Share**, then **Add to Home Screen**.

### 4. Connect the agents

On **Agents**, open someone. Only the owner sees connection settings.

- **Grok bots.** Create a key. Copy the setup message and paste it into that bot's private chat. Save the wake hook on the same page, or let the bot register it. See `docs/wake-hook-setup.md`.
- **Claude Code.** Create a key and store it as the `HUB_KEY` secret on this GitHub repo. Also add `ANTHROPIC_API_KEY` and a `GH_PAT` that can push branches and open pull requests. Save a wake hook whose address is `https://api.github.com/repos/OWNER/command-hub/dispatches` and whose key is a GitHub token that can send `repository_dispatch`. The workflow is `.github/workflows/hub-claude-code.yml`. Optional variable `HUB_DEFAULT_REPO` is the `owner/name` used when a task does not name a repo.
- **Cursor.** No key in the Hub. After `CURSOR_API_KEY` is set, redeploy. A task assigned to Cursor starts a cloud agent and comes back with a pull request link.
- **Polar and Muse.** Create a key. They open the desk at `/agent?key=...` and check in on the schedule in the setup message.

A key is shown once. It can read tasks, post updates, and ask for approval. It cannot approve anything.

## Run locally

```bash
cp .env.example .env.local   # fill in the Supabase values and the service role key
npm install
npm run dev
```

Checks in this repo: `npm run lint` and `npm run build`. There is no test suite.

## How it's built

- Next.js (App Router) with server actions
- Supabase for Postgres, sign-in, row-level security, and live updates
- Tables: `agents`, `tasks`, `events` (the thread and audit log), `approvals`, `memory`, `agent_keys`, `agent_webhooks`
- Agent door at `/api/agent`, authorized with `Authorization: Bearer hub_...`
- Cursor calls `/api/integrations/cursor` when a cloud agent changes status. The Hub ignores that body and re-reads the agent from Cursor's API before it updates the task.

The same door actions, for n8n or anything else:

- `GET /api/agent/tasks`
- `POST /api/agent/tasks` with `{ "instruction": "...", "title": "...", "assign_to": "Piper" }`
- `POST /api/agent/tasks/TASK_ID/claim`
- `POST /api/agent/tasks/TASK_ID/note` with `{ "body": "..." }`
- `POST /api/agent/tasks/TASK_ID/complete` with `{ "summary": "..." }`
- `POST /api/agent/tasks/TASK_ID/assign` with `{ "to": "Piper", "note": "..." }` (Tara only)
- `POST /api/agent/tasks/TASK_ID/approval` with `{ "action_type": "send", "summary": "...", "details": "..." }`
- `GET /api/agent/memory?q=buy box`
- `POST /api/agent/wake-hook` with `{ "url": "...", "key": "..." }`
