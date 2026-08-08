-- Tampereen päätökset (CaseM). Kolmas alustaperhe Ahjon ja Dynastyn rinnalle.
--
-- Mitattu ennen käyttöönottoa: 10 ehdokasta, 149 s, kuvaus mediaani 21772
-- merkkiä, katuosoite kaikilla. Mukana Sairaalakoulun, Peltolammin
-- hyvinvointikeskuksen ja Tammelan koulun hankesuunnitelmat.
--
-- Tuotto on pieni suhteessa aikaan, ja syy on tiedossa: CaseM:n haku on
-- relevanssijärjestyksessä (o=Rank) eikä päivämäärän mukaan, joten 18 kk
-- tuoreusraja pudottaa valtaosan (60 -> 10). Jos tuottoa halutaan enemmän,
-- kokeile o-parametrin muita arvoja tai laajenna hakusanoja.

insert into discovery_sources (
  id, name, type, category, url, priority, enabled, refresh_minutes, collector, parser
) values (
  'legacy-tampere-paatokset',
  'Tampereen päätökset',
  'api',
  'municipality_decisions',
  'https://tampere.cloudnc.fi/fi-FI/haku',
  10,
  true,
  1440,
  'legacyFetchCollector',
  'tampere_paatokset'
);
