-- Command Hub: wake hooks
-- Lets the Hub start an agent the moment there's work for it, instead of waiting for its next check-in.
-- Run once in the Supabase SQL editor, after 0003.

create table if not exists public.agent_webhooks (
  agent_id uuid primary key references public.agents (id) on delete cascade,
  url text not null check (url like 'https://%'),
  secret text not null,
  secret_hint text not null,
  enabled boolean not null default true,
  last_sent_at timestamptz,
  last_status int,
  last_error text,
  created_at timestamptz not null default now()
);

-- No policies on purpose: only the server can read this table, so the secret never reaches a browser.
alter table public.agent_webhooks enable row level security;
