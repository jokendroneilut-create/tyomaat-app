-- Senaatin kilpailutuskalenteri lähteeksi
-- =======================================
--
-- MIKSI. Kaikki 307 nykyistä lähdettä kertovat jostain mikä on jo
-- tapahtunut: kaava on vireillä, lupa myönnetty, kilpailutus julkaistu.
-- Tämä on ensimmäinen lähde joka kertoo hankkeesta ENNEN julkaisua.
--
-- Sarake on "Ennakoitu julkaisuajankohta", ja mitattu 22.8.2026 se
-- ulottui neljänneksestä kahteen vuoteen eteenpäin:
--
--     2026/Q2  4     2027/Q1  8
--     2026/Q3 26     2027/Q2  4
--     2026/Q4 12     2027/Q3  3     2027/Q4 1     2028/Q2 2
--
-- 60 rivistä 15 on rakentamista, ja kaikilla 15:llä on yhteystieto
-- (13 nimettyä henkilöä). Osuu suoraan konversioesteeseen "liian
-- myöhään" (docs/00_PRODUCT_BLUEPRINT.md 1.1).
--
-- Volyymi on pieni ja se on tarkoitus: arvo on ajoituksessa.
--
-- HUOM: rivit ovat ENNUSTEITA. Resolveri merkitsee vaiheeksi aina
-- "Suunnitteilla" eikä väitä kilpailutusta alkaneeksi.
--
-- Ks. [D-001]: pelkkä koodi ei riitä, lähde tarvitsee rivin tähän.
-- Aja Supabasen SQL-editorissa.

insert into public.discovery_sources
  (id, name, type, category, url, priority, enabled, refresh_minutes, collector, parser)
values
  (
    'senaatti-kilpailutuskalenteri',
    'Senaatti-kiinteistöt kilpailutuskalenteri',
    'api',
    'procurement',
    'https://www.senaatti.fi/tietoa-meista/hankinnat/kilpailutuskalenteri/',
    10,
    true,
    1440,
    'apiCollector',
    'senaattiTenderParser'
  )
on conflict (id) do update set
  name            = excluded.name,
  type            = excluded.type,
  category        = excluded.category,
  url             = excluded.url,
  priority        = excluded.priority,
  enabled         = excluded.enabled,
  refresh_minutes = excluded.refresh_minutes,
  collector       = excluded.collector,
  parser          = excluded.parser;


-- Varmistus:
--
--   select id, name, parser, enabled, last_success_at, error_count
--     from public.discovery_sources
--    where id = 'senaatti-kilpailutuskalenteri';
--
-- Ensimmäisen ajon jälkeen source_documents-taulussa pitäisi olla ~15
-- riviä lähteellä 'Senaatti-kiinteistöt kilpailutuskalenteri'.
