-- Dynasty-kunnat Espoon lisäksi.
--
-- Sama jäsentäjä kuin Espoolla (lib/agent/fetchDynastySource.ts), vain
-- verkkotunnus vaihtuu. Jokainen kunta on oma lähteensä, jotta putken
-- vuorottelu jakaa ne eri ajoihin eikä yksi kunta syö koko aikabudjettia.
--
-- Mitattu ennen käyttöönottoa (ehdokkaita / kuvauksen mediaani):
--   Tuusula      17 / 5659      Kuopio       13 / 3538
--   Kirkkonummi  13 / 2242      Savonlinna    7 / 2316
--   Tornio        6 / 5380
--
-- KAKSI KUNTAA JÄTETTIIN POIS, koska ne tuottivat nolla ehdokasta eivätkä
-- ne ole jäsentäjän vika:
--   Ylöjärvi - koko RSS on vuodelta 2021 tai vanhempi, alusta hylätty
--   Lahti    - 206 tuoretta asiaa mutta pelkkiä menettelyasioita
--              ("Laillisuus ja päätösvaltaisuus", "Muut asiat"),
--              sisältö julkaistaan muualla
-- Molemmat kannattaa tarkistaa uudelleen jos kunta vaihtaa alustaa.

insert into discovery_sources (
  id, name, type, category, url, priority, enabled, refresh_minutes, collector, parser
) values
  ('legacy-kuopio-paatokset', 'Kuopion päätökset', 'api', 'municipality_decisions',
   'https://kuopio.oncloudos.com/cgi/DREQUEST.PHP?page=rss/meetingitems',
   10, true, 1440, 'legacyFetchCollector', 'kuopio_paatokset'),

  ('legacy-kirkkonummi-paatokset', 'Kirkkonummen päätökset', 'api', 'municipality_decisions',
   'https://kirkkonummi.oncloudos.com/cgi/DREQUEST.PHP?page=rss/meetingitems',
   10, true, 1440, 'legacyFetchCollector', 'kirkkonummi_paatokset'),

  ('legacy-tuusula-paatokset', 'Tuusulan päätökset', 'api', 'municipality_decisions',
   'https://tuusula.oncloudos.com/cgi/DREQUEST.PHP?page=rss/meetingitems',
   10, true, 1440, 'legacyFetchCollector', 'tuusula_paatokset'),

  ('legacy-savonlinna-paatokset', 'Savonlinnan päätökset', 'api', 'municipality_decisions',
   'https://savonlinna.oncloudos.com/cgi/DREQUEST.PHP?page=rss/meetingitems',
   10, true, 1440, 'legacyFetchCollector', 'savonlinna_paatokset'),

  ('legacy-tornio-paatokset', 'Tornion päätökset', 'api', 'municipality_decisions',
   'https://tornio.oncloudos.com/cgi/DREQUEST.PHP?page=rss/meetingitems',
   10, true, 1440, 'legacyFetchCollector', 'tornio_paatokset');
