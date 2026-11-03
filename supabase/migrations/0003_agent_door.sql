-- Command Hub: the agent door
-- Lets outside agents (Tara in Grok, the other bots, Claude) check in with a private key.
-- Run once in the Supabase SQL editor, after 0001 and 0002.

alter table public.agents
  add column if not exists can_route boolean not null default false,
  add column if not exists last_seen_at timestamptz;

-- Tara is chief of staff: she can see every team task and hand work to other agents.
update public.agents set can_route = true where name = 'Tara';

-- One key per agent. Only a hash is stored, never the key itself.
create table if not exists public.agent_keys (
  agent_id uuid primary key references public.agents (id) on delete cascade,
  key_hash text not null unique,
  key_hint text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.agent_keys enable row level security;

drop policy if exists "owner manages agent keys" on public.agent_keys;
create policy "owner manages agent keys" on public.agent_keys
  for all using (public.is_owner()) with check (public.is_owner());
