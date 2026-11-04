-- Command Hub: show Manny's name instead of his email prefix in threads and the greeting.
-- Run once in the Supabase SQL editor, after 0005.
update public.profiles set display_name = 'Manny' where email = 'mfernandez3@gmail.com';
update public.events set author = 'Manny' where author = 'mfernandez3';
