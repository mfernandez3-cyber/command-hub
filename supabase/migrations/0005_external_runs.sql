-- Command Hub: track outside runs (Cursor cloud agents, GitHub Actions) on each task.
-- Run once in the Supabase SQL editor, after 0004.

alter table public.tasks add column if not exists external jsonb not null default '{}'::jsonb;

-- Cursor and Claude Code are ready to take tasks once their connection is set up.
update public.agents set status = 'idle' where name in ('Cursor', 'Claude Code') and status = 'setup';
