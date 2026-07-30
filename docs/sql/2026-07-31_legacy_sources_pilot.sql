-- 2026-07-31 — Viisi vanhaa lähdettä discovery-putken ajastuksen alle (pilotti).
--
-- Aja Supabasen SQL-editorissa (repo ei sisällä migraatioajuria).
--
-- Tausta: nämä viisi lisättiin 27.–28.7. vanhaan putkeen (lib/agent/sources.ts),
-- joka ajaa 34 lähdettä peräkkäin yhdessä pyynnössä kerran vuorokaudessa. Ne
-- ovat listan viimeiset (indeksit 29–33) eivätkä ole päässeet kertaakaan
-- vuoroon: 7 päivän mittauksessa pisin ajo ylsi indeksiin 28. Syy on
-- kaksiosainen — kierron aloituskohtia on vain kaksi (step = ceil(34/2) = 17)
-- ja ajo kuolee aikaan ennen listan loppua.
--
-- Fetcherit itse toimivat. Suoraan ajettuna ne palauttivat 30.7.:
--   yva                 103 kandidaattia   (tuuli- ja aurinkovoimahankkeet)
--   stt_haku            253                (36 s)
--   rakennuslehti        15
--   ymparistolupa        14                (datakeskukset, 25 s)
--   suunnittelukilpailu   3                (isot julkiset rakennukset)
--
-- Discovery-putki valitsee lähteet järjestyksessä priority DESC, last_run_at
-- ASC nullsFirst. Uusi rivi jolla last_run_at on NULL nousee siis heti oman
-- prioriteettikaistansa kärkeen ja ehtii seuraavaan ajoon (14 paikkaa/ajo,
-- 4 ajoa/vrk). Kaikki viisi tulevat siksi ensimmäisellä ajolla — tämä on
-- tarkoituksellista, ~388 kandidaattia halutaan kerralla jonoon.
--
-- collector = legacyFetchCollector, ja parser kertoo minkä vanhan lähteen
-- fetcheriä ajetaan (täsmää lib/agent/sources.ts:n name-kenttään).
-- url on dokumentaatiota varten; kerääjä ei lue sitä, koska osoite on
-- fetcherin sisällä.
--
-- Peruutus: update public.discovery_sources set enabled = false
--            where collector = 'legacyFetchCollector';
-- Poisto:   delete from public.discovery_sources
--            where collector = 'legacyFetchCollector';


insert into public.discovery_sources
  (id, name, type, category, url, priority, enabled, refresh_minutes,
   collector, parser)
values
  ('legacy-ymparistolupa',
   'Ympäristöluvat (AVI/ELY)',
   'html',
   'environmental_permit',
   'https://ylupa.avi.fi/fi-FI',
   10, true, 1440,
   'legacyFetchCollector', 'ymparistolupa'),

  ('legacy-yva',
   'YVA-hankkeet (ymparisto.fi)',
   'html',
   'environmental_assessment',
   'https://www.ymparisto.fi/fi/osallistu-ja-vaikuta/ymparistovaikutusten-arviointi',
   10, true, 1440,
   'legacyFetchCollector', 'yva'),

  ('legacy-suunnittelukilpailu',
   'Suunnittelukilpailut (SAFA)',
   'html',
   'design_competition',
   'https://www.safa.fi/kilpailut/',
   10, true, 1440,
   'legacyFetchCollector', 'suunnittelukilpailu'),

  ('legacy-rakennuslehti',
   'Rakennuslehti',
   'html',
   'construction_news',
   'https://www.rakennuslehti.fi/',
   10, true, 1440,
   'legacyFetchCollector', 'rakennuslehti'),

  ('legacy-stt-haku',
   'STT-tiedotteet (rakentaminen)',
   'html',
   'press_release',
   'https://www.sttinfo.fi/',
   10, true, 1440,
   'legacyFetchCollector', 'stt_haku')
on conflict (id) do nothing;


-- Tarkistus: viisi riviä, last_run_at NULL (eivät ole vielä ajaneet).
-- select id, name, priority, enabled, collector, parser, last_run_at
--   from public.discovery_sources
--  where collector = 'legacyFetchCollector'
--  order by id;
--
-- Ensimmäisen ajon jälkeen samasta kyselystä pitäisi näkyä last_run_at ja
-- run_count = 1. Ajon kesto näkyy /tic/discovery/runs -sivulla: jos se
-- lähestyy 500 s budjettia, stt_haku (36 s + 253 kandidaattia) kannattaa
-- siirtää omaan ajoonsa tai laskea sen prioriteettia.
