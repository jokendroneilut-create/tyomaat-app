-- HOAS ensimmaiseksi asuntosaatiolahteeksi.
--
-- MIKSI HOAS EIKA AYY.
--
-- Aloitin AYY:sta, mutta mittaus 29.8.2026 osoitti HOASin
-- tuottavammaksi: 6 eri hanketta vs. AYY:n 1. HOASin arkistossa on myos
-- se tiedote josta koko tyo lahti liikkeelle (402 asuntoa, 60 M€).
--
-- YKSI KERAAJA, MONTA LAHDETTA. parser = "foundationReleaseParser"
-- palvelee kaikkia opiskelija-asuntosaatioita; seuraava saatio on RIVI
-- tassa taulussa eika uusi keraaja. Paatepiste luetaan url-kentasta.
--
-- SAATIO ON RAKENNUTTAJA. Nimesta karsitaan " tiedotteet" -paate, ja
-- loppu menee hankkeen developer-kenttaan. Siksi nimi on tasmalleen
-- "Hoas tiedotteet" eika esim. "HOAS-uutiset".
--
-- ROBOTS: tarkistettu 29.8.2026, www.hoas.fi sallii /wp-json/ -polun.

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
values (
  gen_random_uuid(),
  'Hoas tiedotteet',
  'api',
  'developer_release',
  'https://www.hoas.fi/wp-json/wp/v2/posts',
  -- Prioriteetti keskitasoa: lahde on laadukas mutta pieni, noin
  -- 2 uutta hanketta vuodessa.
  20,
  true,
  -- Kerran vuorokaudessa riittaa: tiedotteita tulee muutama kuukaudessa.
  1440,
  'apiCollector',
  'foundationReleaseParser'
)
on conflict do nothing;


-- TARKISTUS AJON JALKEEN.
--
--   select name, url, parser, enabled from public.discovery_sources
--    where parser = 'foundationReleaseParser';
--   -- yksi rivi: Hoas tiedotteet
--
-- ENSIMMAISEN AJON JALKEEN kannattaa katsoa mita jonoon tuli:
--
--   select title, status, created_at from public.source_documents
--    where source_name = 'Hoas tiedotteet' order by created_at desc;
--   -- odotettu ~9 dokumenttia, 6 eri hanketta
--
-- Kaksi niista on nimeamattomia (projectName null): tiedote koskee
-- kahta kohdetta tai katu on mainittu ilman numeroa. Ne on tarkoitettu
-- katselmoitaviksi, ei automaattisesti hyvaksyttaviksi.
