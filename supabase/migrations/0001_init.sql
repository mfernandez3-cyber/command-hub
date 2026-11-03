-- Agent Hub, Phase 1 schema
-- Run this once in the Supabase SQL editor (or with `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Who may log in. Add a row here for every teammate.
-- ---------------------------------------------------------------
create table public.allowed_emails (
  email text primary key,
  role text not null default 'member' check (role in ('owner', 'member')),
  added_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now()
);

-- New sign-ups get a profile only if their email is on the allow list.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_role text;
begin
  select role into allowed_role from public.allowed_emails where lower(email) = lower(new.email);
  if allowed_role is not null then
    insert into public.profiles (id, email, display_name, role)
    values (new.id, new.email, split_part(new.email, '@', 1), allowed_role)
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner');
$$;

-- ---------------------------------------------------------------
-- Agents
-- ---------------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  role text not null,
  adapter text not null check (adapter in ('xai', 'cursor', 'claude_code', 'browser_queue', 'manual')),
  tier text not null check (tier in ('full', 'bridge')),
  model text,
  system_prompt text,
  tools jsonb not null default '[]'::jsonb,
  visibility text not null default 'team' check (visibility in ('team', 'owner')),
  status text not null default 'idle' check (status in ('idle', 'working', 'needs_you', 'error', 'paused', 'setup')),
  daily_spend_cap_usd numeric(10, 2) not null default 5.00,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

-- Can the current user see this agent?
create or replace function public.can_see_agent(agent_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_member() and (
    public.is_owner()
    or exists (select 1 from public.agents a where a.id = agent_id and a.visibility = 'team')
  );
$$;

-- ---------------------------------------------------------------
-- Tasks, the live event thread, and approvals
-- ---------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  instruction text not null,
  agent_id uuid references public.agents (id),
  parent_id uuid references public.tasks (id) on delete cascade,
  project text,
  status text not null default 'queued' check (status in ('queued', 'running', 'needs_you', 'done', 'failed', 'cancelled')),
  priority int not null default 2 check (priority between 1 and 3),
  result_summary text,
  cost_usd numeric(10, 4) not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_status_idx on public.tasks (status, updated_at desc);
create index tasks_agent_idx on public.tasks (agent_id);

create table public.events (
  id bigint generated always as identity primary key,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author text not null, -- agent name, 'system', or a person's display name
  type text not null check (type in ('message', 'step', 'output', 'error', 'status')),
  body text not null,
  link text,
  created_at timestamptz not null default now()
);
create index events_task_idx on public.events (task_id, created_at);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  action_type text not null check (action_type in ('spend', 'post', 'send', 'merge', 'delete')),
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  amount_usd numeric(10, 2),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_by text not null,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index approvals_pending_idx on public.approvals (status, created_at desc);

-- ---------------------------------------------------------------
-- Shared memory (replaces the Bot Briefs folder)
-- ---------------------------------------------------------------
create table public.memory (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global' check (scope in ('global', 'project', 'agent')),
  agent_id uuid references public.agents (id) on delete cascade,
  project text,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  updated_by text,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Browser queue that Polar (and later Muse) polls
-- ---------------------------------------------------------------
create table public.browser_jobs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  target text not null check (target in ('polar', 'muse')),
  steps text not null,
  status text not null default 'waiting' check (status in ('waiting', 'claimed', 'done', 'failed', 'stuck')),
  claimed_at timestamptz,
  result text,
  created_at timestamptz not null default now()
);

-- Keep tasks.updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- An approval decision updates its task and leaves a trail in the thread.
create or replace function public.on_approval_decided()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  who text;
begin
  if new.status <> old.status and new.status in ('approved', 'rejected') then
    select coalesce(display_name, email) into who from public.profiles where id = new.decided_by;
    insert into public.events (task_id, author, type, body)
    values (new.task_id, coalesce(who, 'someone'), 'status',
            initcap(new.status) || ': ' || new.summary);
    update public.tasks
      set status = case when new.status = 'approved' then 'queued' else 'cancelled' end
      where id = new.task_id
        and not exists (select 1 from public.approvals a
                        where a.task_id = new.task_id and a.status = 'pending' and a.id <> new.id);
  end if;
  return new;
end;
$$;
create trigger approvals_decided after update on public.approvals
  for each row execute function public.on_approval_decided();

-- ---------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------
alter table public.allowed_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.agents enable row level security;
alter table public.tasks enable row level security;
alter table public.events enable row level security;
alter table public.approvals enable row level security;
alter table public.memory enable row level security;
alter table public.browser_jobs enable row level security;

create policy "owner manages allow list" on public.allowed_emails
  for all using (public.is_owner()) with check (public.is_owner());

create policy "members read profiles" on public.profiles
  for select using (public.is_member());
create policy "update own profile" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

create policy "members read visible agents" on public.agents
  for select using (public.can_see_agent(id));
create policy "owner manages agents" on public.agents
  for all using (public.is_owner()) with check (public.is_owner());

create policy "members read visible tasks" on public.tasks
  for select using (public.is_member() and (agent_id is null or public.can_see_agent(agent_id)));
create policy "members create tasks" on public.tasks
  for insert with check (public.is_member() and created_by = auth.uid() and (agent_id is null or public.can_see_agent(agent_id)));
create policy "members update visible tasks" on public.tasks
  for update using (public.is_member() and (agent_id is null or public.can_see_agent(agent_id)));

create policy "members read events" on public.events
  for select using (exists (select 1 from public.tasks t where t.id = task_id));
create policy "members add events" on public.events
  for insert with check (public.is_member() and exists (select 1 from public.tasks t where t.id = task_id));

create policy "members read approvals" on public.approvals
  for select using (exists (select 1 from public.tasks t where t.id = task_id));
create policy "members request approvals" on public.approvals
  for insert with check (public.is_member() and status = 'pending' and exists (select 1 from public.tasks t where t.id = task_id));
create policy "members decide approvals" on public.approvals
  for update using (public.is_member() and status = 'pending')
  with check (decided_by = auth.uid() and status in ('approved', 'rejected'));

create policy "members read memory" on public.memory
  for select using (public.is_member() and (agent_id is null or public.can_see_agent(agent_id)));
create policy "members write memory" on public.memory
  for insert with check (public.is_member() and (agent_id is null or public.can_see_agent(agent_id)));
create policy "members edit memory" on public.memory
  for update using (public.is_member() and (agent_id is null or public.can_see_agent(agent_id)));
create policy "members delete memory" on public.memory
  for delete using (public.is_member() and (agent_id is null or public.can_see_agent(agent_id)));

create policy "members read browser jobs" on public.browser_jobs
  for select using (exists (select 1 from public.tasks t where t.id = task_id));

-- Live updates for the task thread and boards
alter publication supabase_realtime add table public.tasks, public.events, public.approvals;
