-- Espoon päätösjärjestelmä (Dynasty) uutena lähteenä.
--
-- Sama vaihe kuin Helsingin lähteessä: kunnan nimetty investointipäätös.
-- Dynasty-alusta (oncloudos.com) on käytössä kahdeksalla kunnalla ja polut
-- ovat identtiset, joten sama jäsentäjä kattaa myös Kuopion, Lahden,
-- Kirkkonummen, Tuusulan, Savonlinnan, Tornion ja Ylöjärven - ne lisätään
-- omina riveinään kun ne otetaan käyttöön.
--
-- Mitattu ennen käyttöönottoa: 22 ehdokasta, 2 s, kuvaus mediaani 5858
-- merkkiä. Mukana Saarnilaakson koulun ja Postipuun koulun
-- hankesuunnitelmat, jotka ovat RPT:n puuttuvien Espoo-listalla.
--
-- RSS antaa 1000 tuoreinta asiaa yhdellä pyynnöllä, joten läpikäyntiä ei
-- tarvita. Kuvaus haetaan asian sivulta ja se on rajattu 60 hakuun per ajo.

insert into discovery_sources (
  id, name, type, category, url, priority, enabled, refresh_minutes, collector, parser
) values (
  'legacy-espoo-paatokset',
  'Espoon päätökset',
  'api',
  'municipality_decisions',
  'https://espoo.oncloudos.com/cgi/DREQUEST.PHP?page=rss/meetingitems',
  10,
  true,
  1440,
  'legacyFetchCollector',
  'espoo_paatokset'
);
