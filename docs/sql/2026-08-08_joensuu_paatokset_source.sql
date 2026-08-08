-- Joensuun päätökset. Dynasty, mutta ei oncloudos.com:issa.
--
-- Joensuu ei ollut niiden 40 kunnan joukossa jotka aiemmin testattiin
-- oncloudos.com:ista, koska se ei ole siellä. Asennus on maakunnallinen ja
-- kunta on POLUSSA eikä aliverkkotunnuksessa:
--   https://dynastyjulkaisu.pohjoiskarjala.net/joensuu/cgi/DREQUEST.PHP
-- Palvelimen juuri vastaa 403:lla, joten asennus löytyi vasta kokeilemalla
-- polkua. Jäsentäjään lisättiin siksi valinnainen cgiBase.
--
-- Mitattu ennen käyttöönottoa: 6 ehdokasta, 0,8 s, kuvaus mediaani 5626
-- merkkiä. Mukana uuden uimahallin, Reijolan päiväkodin sekä Niittylahden
-- koulun hankesuunnitelmat.
--
-- HUOMIOITA:
--   * Yksi kuudesta on kaava-asia ("Mehtimäen uimahallin asemakaavan
--     muutoksen luonnosten nähtäville asettaminen"). Kaavoitus on jo katettu
--     248 omalla lähteellä, joten se on kaksoiskappale. CaseM-jäsentäjässä
--     kaava-asiat suodatetaan pois; Dynastyssa ei vielä, koska havainto on
--     toistaiseksi yhden kunnan varassa.
--   * Katuosoite irtosi vain yhdestä kuudesta.

insert into discovery_sources (
  id, name, type, category, url, priority, enabled, refresh_minutes, collector, parser
) values (
  'legacy-joensuu-paatokset',
  'Joensuun päätökset',
  'api',
  'municipality_decisions',
  'https://dynastyjulkaisu.pohjoiskarjala.net/joensuu/cgi/DREQUEST.PHP?page=rss/meetingitems',
  10,
  true,
  1440,
  'legacyFetchCollector',
  'joensuu_paatokset'
);
