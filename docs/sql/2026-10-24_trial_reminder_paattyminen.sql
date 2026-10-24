-- PAATTYMISVIESTI LOKIIN (D-340, jatko)
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

-- TARKISTUS AJETAAN, EI KOMMENTOIDA. Ensimmaisella kerralla tama oli
-- kommenttina, jolloin editori palautti vain ALTERin "no rows" -- ja
-- rajoite oli jaanyt muuttumatta ilman etta se nakyi mistaan. Nyt
-- viimeinen lause palauttaa rivin, jossa nollan pitaa nakya.

select conname, pg_get_constraintdef(oid) as rajoite
from pg_constraint
where conname = 'trial_reminder_log_virstanpylvas_check';
