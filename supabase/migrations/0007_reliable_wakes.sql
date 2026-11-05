-- Command Hub: reliable wake-ups
-- Every wake-up is logged, retried if it fails, and re-sent if the agent doesn't start the task.
-- A heartbeat runs every minute inside Supabase to drive the retries.
-- Run once in the Supabase SQL editor, after 0006.

-- 1. The wake-up log
create table if not exists public.wakes (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  event text not null,
  note text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_status int,
  last_error text,
  sent_at timestamptz,
  picked_up_at timestamptz,
  reminded_at timestamptz,
  flagged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists wakes_due_idx on public.wakes (status, next_attempt_at);
create index if not exists wakes_agent_idx on public.wakes (agent_id, created_at desc);
create index if not exists wakes_task_idx on public.wakes (task_id);
alter table public.wakes enable row level security;
drop policy if exists "owner reads wakes" on public.wakes;
create policy "owner reads wakes" on public.wakes for select using (public.is_owner());

-- 2. Private settings (heartbeat token and last run). Server-only: no policies.
create table if not exists public.hub_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.hub_settings enable row level security;
insert into public.hub_settings (key, value)
values ('heartbeat_token', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- 3. The heartbeat: every minute, Supabase pings the Hub so it can retry and follow up.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('hub-heartbeat') where exists (select 1 from cron.job where jobname = 'hub-heartbeat');
select cron.schedule(
  'hub-heartbeat',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://command-hub-phi.vercel.app/api/cron/heartbeat',
    body := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-heartbeat-token', (select value from public.hub_settings where key = 'heartbeat_token')
    ),
    timeout_milliseconds := 30000
  );
  $$
);
