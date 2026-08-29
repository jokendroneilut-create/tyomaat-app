-- Loput asuntosaatiolahteet: POAS, KOAS, Sevas, TYS, AYY, Savonlinna.
--
-- Nelja ja viides lahde samalle keraajalle. Uusi saatio on RIVI tassa
-- taulussa eika uusi keraaja: parser = "foundationReleaseParser" ja
-- paatepiste url-kentassa. Nimen " tiedotteet" -paate karsitaan, ja
-- loppu menee hankkeen rakennuttajaksi.
--
-- MITATTU 29.8.2026 nykyisella poimijalla (eri hankkeita arkistossa):
--
--   POAS         7    Kuopio
--   KOAS         4    Jyvaskyla   -- tyyppi on news, ei posts
--   Sevas        4    Seinajoki
--   TYS          2    Turku
--   Savonlinna   2    Savonlinna
--   AYY          1    Espoo       -- vahan, mutta paras osuma-aste
--
-- AYY otetaan yhdesta hankkeesta huolimatta: Otakaari 15 kulkee koko
-- elinkaaren lapi omina tiedotteinaan ja siita saatiin urakoitsija
-- (Varte Oy), asuntomaara ja huoneistoala. Laatu korvaa maaran.
--
-- POIS JATETYT JA MIKSI:
--
--   Kuopas          0 hanketta 40 tiedotteesta
--   VOAS            0 hanketta 11 tiedotteesta
--   Joensuun Elli   0 hanketta  9 tiedotteesta
--   Soihtu (JYY)    1 hanketta 200 tiedotteesta -- huono suhde
--   Kajaanin Pietari 1 hanketta 44 tiedotteesta -- huono suhde
--
-- Jokainen lahde maksaa hakuaikaa ajobudjetista (D-129), joten
-- tyhjaa tuottavaa ei kannata lisata. Nama voi ottaa myohemmin jos
-- niiden tiedotevirta muuttuu.
--
-- SAO EI OLE OMA LAHTEENSA. www.sao.fi ja savonlinnanasuntopalvelu.fi
-- ovat SAMA sivusto (todettu julkaisutunnisteista), joten kummankin
-- lisaaminen tuottaisi jokaisesta hankkeesta kaksoiskappaleen.
--
-- ROBOTS: kaikki kuusi tarkistettu 29.8.2026, /wp-json/ sallittu.

insert into public.discovery_sources (
  id, name, type, category, url, priority, enabled, refresh_minutes, collector, parser
)
values
  (gen_random_uuid(), 'POAS tiedotteet', 'api', 'developer_release',
   'https://poas.fi/wp-json/wp/v2/posts', 20, true, 1440,
   'apiCollector', 'foundationReleaseParser'),

  -- KOAS julkaisee tyypilla "news". Oletus "posts" olisi tuottanut tyhjan.
  (gen_random_uuid(), 'KOAS tiedotteet', 'api', 'developer_release',
   'https://www.koas.fi/wp-json/wp/v2/news', 20, true, 1440,
   'apiCollector', 'foundationReleaseParser'),

  (gen_random_uuid(), 'Sevas tiedotteet', 'api', 'developer_release',
   'https://sevas.fi/wp-json/wp/v2/posts', 20, true, 1440,
   'apiCollector', 'foundationReleaseParser'),

  -- TYS palauttaa isolla sivukoolla vajaan JSONin; keraaja kayttaa 20.
  (gen_random_uuid(), 'TYS tiedotteet', 'api', 'developer_release',
   'https://www.tys.fi/wp-json/wp/v2/posts', 20, true, 1440,
   'apiCollector', 'foundationReleaseParser'),

  (gen_random_uuid(), 'Savonlinnan Asuntopalvelu tiedotteet', 'api', 'developer_release',
   'https://savonlinnanasuntopalvelu.fi/wp-json/wp/v2/posts', 20, true, 1440,
   'apiCollector', 'foundationReleaseParser'),

  (gen_random_uuid(), 'AYY Asunnot tiedotteet', 'api', 'developer_release',
   'https://ayyasunnot.fi/wp-json/wp/v2/posts', 20, true, 1440,
   'apiCollector', 'foundationReleaseParser')
on conflict do nothing;


-- TARKISTUS AJON JALKEEN.
--
--   select name, url, enabled from public.discovery_sources
--    where parser = 'foundationReleaseParser' order by name;
--   -- yhdeksan rivia: AYY, Hoas, KOAS, Lahden Talot, POAS, PSOAS,
--   --                 Savonlinnan Asuntopalvelu, Sevas, TYS
