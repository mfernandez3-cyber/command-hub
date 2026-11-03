-- Agent Hub, Phase 1 seed data
-- 1) Replace the email below with the owner's login email before running.
insert into public.allowed_emails (email, role) values
  ('mfernandez3@gmail.com', 'owner')
on conflict (email) do nothing;

-- 2) The agent roster. Briefs (system prompts) get filled in during Phase 2.
insert into public.agents (name, role, adapter, tier, visibility, status, sort_order) values
  ('Tara',        'Chief of staff and router',        'xai',           'full',   'team',  'idle',  1),
  ('Diana',       'Dispositions',                     'xai',           'full',   'team',  'idle',  10),
  ('Piper',       'Pipedrive CRM',                    'xai',           'full',   'team',  'idle',  11),
  ('Sonny',       'Social media',                     'xai',           'full',   'team',  'idle',  12),
  ('Mona',        'Systems monitor',                  'xai',           'full',   'team',  'idle',  13),
  ('Millie',      'Multifamily',                      'xai',           'full',   'owner', 'idle',  14),
  ('Franky',      'Investments lead',                 'xai',           'full',   'owner', 'idle',  20),
  ('Ollie',       'Options trading',                  'xai',           'full',   'owner', 'idle',  21),
  ('Koby',        'Crypto trading',                   'xai',           'full',   'owner', 'idle',  22),
  ('Cursor',      'Cloud coding agent',               'cursor',        'full',   'team',  'setup', 30),
  ('Claude Code', 'Coding agent (Agent SDK worker)',  'claude_code',   'full',   'team',  'setup', 31),
  ('Polar',       'Browser automation on the Mac',    'browser_queue', 'bridge', 'team',  'setup', 40),
  ('Muse',        'To be confirmed',                  'browser_queue', 'bridge', 'team',  'setup', 41)
on conflict (name) do nothing;

insert into public.memory (scope, title, body, tags, updated_by) values
  ('global', 'How the Hub works',
   'Every instruction becomes a task. Tara routes it to one agent. Anything public, paid, sent, merged or deleted waits in Approvals until a person taps Approve. Agents post progress to the task thread and never message each other directly.',
   array['hub', 'rules'], 'system')
on conflict do nothing;
