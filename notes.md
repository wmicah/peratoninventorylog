make notes as admin for audits

give a way for officers/loggers to actually view whats going on with badges ie turned off turned on

give a way for admins to set why badges are on or off, adding notes to things would help, maybe a more streamlined ui

if a badge is set to missing for a week straight turn it off by default, add a notification system that works on login only so to not eat resources taht lets admins know whats happening

give admins the ability to remove and edit normal accounts/loggers

change all the times we say loggers to just say accounts instead or something

keep logs for up to 5 years and remove them if they are longer

inventory "day" is 8am–8am (you can complete badge inventory for a day up to the next day at 8am), not calendar midnight

per-site timezone: each facility has a timezone (e.g. America/Los_Angeles for California). If using Supabase, add: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS time_zone TEXT DEFAULT 'America/New_York';`
