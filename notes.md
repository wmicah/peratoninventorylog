make notes as admin for audits

give a way for officers/loggers to actually view whats going on with badges ie turned off turned on

give a way for admins to set why badges are on or off, adding notes to things would help, maybe a more streamlined ui

if a badge is set to missing for a week straight turn it off by default, add a notification system that works on login only so to not eat resources taht lets admins know whats happening

give admins the ability to remove and edit normal accounts/loggers

change all the times we say loggers to just say accounts instead or something

keep logs for up to 5 years and remove them if they are longer

inventory "day" is 8am–8am (you can complete badge inventory for a day up to the next day at 8am), not calendar midnight

per-site timezone: each facility has a timezone (e.g. America/Los_Angeles for California). If using Supabase, add: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS time_zone TEXT DEFAULT 'America/New_York';`

sites state filter: assigned sites on account create/edit are filtered by state (e.g. VA). If using Supabase, add: `ALTER TABLE sites ADD COLUMN IF NOT EXISTS state TEXT;` (null = treated as VA). Add more state codes in admin Facilities and in `STATE_OPTIONS` / loggers `availableStates` as needed.

missing badges persist: a badge reported missing stays missing until a new inventory run marks it present (e.g. if Tuesday inventory was not taken, Wednesday still shows Monday’s missing list). Officers and admins can “Turn off all missing” to hide those badges from inventory while they disable the physical badge in other software.

badge “reason why off”: admins can set a reason/notes when a badge is turned off (Open items + Facilities → [site] badge list). If using Supabase, add: `ALTER TABLE badges ADD COLUMN IF NOT EXISTS deactivated_reason TEXT;`

auto-off after 7 days missing: when an admin loads the dashboard, any badge that has been missing for 7+ days (from the latest submitted run per site) is automatically turned off. A one-time notification is shown on the dashboard listing what was turned off (login-only, no background cron).

5-year log retention: admins can purge audit sessions older than 5 years from Audit Log → “Purge data older than 5 years”. Submitted sessions use submitted_at; drafts use created_at. After purge, the session list is refetched.
