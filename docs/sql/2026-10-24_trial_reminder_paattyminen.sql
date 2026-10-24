-- PAATTYMISVIESTI LOKIIN (D-339, jatko)
--
-- Aja tama Supabasen SQL-editorissa SEN JALKEEN kun
-- 2026-10-24_trial_reminder_log.sql on ajettu.
--
-- Johannes 24.10.2026: *"Ilmoitus pitaa tulla myos paattymispaiva. Ei
-- katkaista palvelun kayttoa, mutta ilmoitetaan etta se on paattynyt."*
--
-- Neljas viesti kirjataan samaan lokiin virstanpylvaalla 0, jolloin se
-- saa saman tuplasuojan kuin muut: uniikki (user_id, virstanpylvas).
-- Alkuperainen check-rajoite salli vain 7, 14 ja 21, joten se on
-- korvattava -- muuten paattymisviesti lahtisi mutta kirjaus kaatuisi,
-- ja sama viesti lahtisi huomenna uudelleen.

alter table public.trial_reminder_log
  drop constraint if exists trial_reminder_log_virstanpylvas_check;

alter table public.trial_reminder_log
  add constraint trial_reminder_log_virstanpylvas_check
  check (virstanpylvas in (0, 7, 14, 21));

-- Tarkistus (pitaa palauttaa rivi jossa nolla on mukana):
--   select pg_get_constraintdef(oid)
--   from pg_constraint
--   where conname = 'trial_reminder_log_virstanpylvas_check';
