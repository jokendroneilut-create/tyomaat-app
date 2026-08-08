-- Helsingin päätösjärjestelmä (Ahjo) uutena lähteenä.
--
-- Kattaa vaiheen jota meillä ei aiemmin ollut: kunnan nimetyn
-- investointipäätöksen. Hanke on päätetty ja nimetty muttei kilpailutettu,
-- joten se ei näy Hilmassa eikä urakoitsijan tiedotteissa. Aukko löytyi
-- RPT:n hankelistaa läpikäymällä, ks. docs/rpt/README.md.
--
-- Mitattu ennen käyttöönottoa: 1039 ehdokasta 18 kk ikkunalla, kuvaus
-- 1038:lla (mediaani ~5000 merkkiä), katuosoite 441:llä. Kaikki RPT:n
-- puuttuvista Helsinki-hankkeista löytyivät (Töölön kisahalli,
-- Pukinmäenkaaren peruskoulu, Stoan laajennus, Vuosaaren seniorikeskus,
-- Laajasalon raitiovaunuvarikko).
--
-- Kulkee legacyFetchCollectorin kautta kuten muut fetch-pohjaiset lähteet.

insert into discovery_sources (name, type, category, url, priority, enabled, refresh_minutes, collector, parser)
values (
  'Helsingin päätökset',
  'api',
  'kunta',
  'https://paatokset-elastic-proxy.api.hel.ninja/paatokset_decisions/_search',
  2,
  true,
  360,
  'legacyFetchCollector',
  'helsinki_paatokset'
);
