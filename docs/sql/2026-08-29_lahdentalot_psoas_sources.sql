-- Lahden Talot ja PSOAS asuntosaatiolahteiksi.
--
-- Toinen ja kolmas lahde samalle keraajalle. Uusi saatio on RIVI tassa
-- taulussa eika uusi keraaja: parser = "foundationReleaseParser" ja
-- paatepiste url-kentassa. Nimen " tiedotteet" -paate karsitaan, ja
-- loppu menee hankkeen rakennuttajaksi.
--
-- KUIVAHARJOITUS 29.8.2026 (ennen ikarajaa):
--   Lahden Talot  74 tiedotetta -> 8 eri hanketta
--   PSOAS        190 tiedotetta -> 7 eri hanketta
--
-- PSOASin seitsemasta nelja oli 27.8.2021 julkaistua historiikkisarjaa
-- vanhoista taloista. Ne eivat ole liideja, joten keraajaan lisattiin
-- kolmen vuoden ikaraja tiedotteelle.
--
-- ROBOTS: molemmat tarkistettu 29.8.2026, /wp-json/ sallittu.

insert into public.discovery_sources (
  id,
  name,
  type,
  category,
  url,
  priority,
  enabled,
  refresh_minutes,
  collector,
  parser
)
values
  (
    gen_random_uuid(),
    'Lahden Talot tiedotteet',
    'api',
    'developer_release',
    'https://www.lahdentalot.fi/wp-json/wp/v2/posts',
    20,
    true,
    1440,
    'apiCollector',
    'foundationReleaseParser'
  ),
  (
    gen_random_uuid(),
    'PSOAS tiedotteet',
    'api',
    'developer_release',
    'https://www.psoas.fi/wp-json/wp/v2/posts',
    20,
    true,
    1440,
    'apiCollector',
    'foundationReleaseParser'
  )
on conflict do nothing;


-- TARKISTUS AJON JALKEEN.
--
--   select name, url, enabled from public.discovery_sources
--    where parser = 'foundationReleaseParser' order by name;
--   -- kolme rivia: Hoas, Lahden Talot, PSOAS
