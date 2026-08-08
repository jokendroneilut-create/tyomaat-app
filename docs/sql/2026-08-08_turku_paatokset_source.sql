-- Turun päätökset. Neljäs alustaperhe: kaupungin oma React-sovellus.
--
-- Rajapinta löytyi JS-nipusta (baseURL), koska selain jumittui sivulla ja
-- jokainen polku palautti saman 622 tavun kuoren. Ketju on kolmiportainen:
-- /toimielimet -> /toimielin/<lyhenne> -> /poytakirja/<id>.
--
-- Hakupäätepiste /api/haku palauttaa 500:n kaikilla kokeilluilla
-- parametreilla, joten sitä ei käytetä. Toimielinketju ei sitä tarvitse.
--
-- Mitattu ennen käyttöönottoa: 6 ehdokasta, 6 s, kuvaus mediaani 8681
-- merkkiä. Mukana Tuomiokirkkosillan hankesuunnitelma ja Länsirata Oy:n
-- osakassopimus.
--
-- TUNNETUT RAJOITTEET, korjattavaksi kun lähde on ollut käytössä:
--   * MAX_MEETINGS_PER_RUN = 40 loppuu kesken ensimmäisillä toimielimillä,
--     joten kattavuus jää vajaaksi. Budjetti kannattaa jakaa toimielinten
--     kesken eikä käyttää järjestyksessä.
--   * Katuosoitetta ei irronnut yhdestäkään (0/6).
--   * Otsikot toistuvat lähes samoina eri toimielimissä; otsikkopohjainen
--     deduplikointi ei nappaa niitä kun loppuosa eroaa.

insert into discovery_sources (
  id, name, type, category, url, priority, enabled, refresh_minutes, collector, parser
) values (
  'legacy-turku-paatokset',
  'Turun päätökset',
  'api',
  'municipality_decisions',
  'https://paatokset.turku.fi/api/toimielimet',
  10,
  true,
  1440,
  'legacyFetchCollector',
  'turku_paatokset'
);
