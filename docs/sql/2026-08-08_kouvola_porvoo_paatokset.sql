-- Kouvola ja Porvoo. Molemmat Dynastya, kumpikaan ei löytynyt kaavalla.
--
-- Neljästä jäljellä olleesta kaupungista (Lappeenranta, Kouvola, Seinäjoki,
-- Porvoo) kaksi on kerättävissä ja kaksi ei:
--
--   Kouvola       Dynasty  ep10.kouvola.fi              ei robots.txt:tä
--   Porvoo        Dynasty  porvoofi.oncloudos.com       ei robots.txt:tä
--   Seinäjoki     Tweb     listat.seinajoki.fi          Disallow: /
--   Lappeenranta  M-Files  mfiles.lappeenranta.fi       Disallow: /
--
-- MIKSI NÄMÄ EIVÄT LÖYTYNEET AIEMMIN:
--   * Kouvolalla on oma verkkotunnus, ja linkki siihen on vasta
--     paatoksenteko-sivun ALASIVULLA "Esityslistat ja pöytäkirjat".
--   * Porvoo ON oncloudos.com:issa, mutta aliverkkotunnus on "porvoofi" eikä
--     "porvoo". Aiempi 40 kunnan testi ei osunut yhden tavun takia.
--
-- Mitattu ennen käyttöönottoa:
--   Kouvola  30 ehdokasta, 1,6 s, kuvaus mediaani 6065 merkkiä, osoite 2/30
--   Porvoo    3 ehdokasta, 0,9 s, kuvaus mediaani 4671 merkkiä, osoite 1/3
--
-- Kouvola on paras yksittäinen Dynasty-kunta tähän mennessä: mukana
-- Monitoimiareenan urakoitsijan valinta, Kuusankosken yhtenäiskoulu,
-- pääkirjaston peruskorjaus, uusi keskuskeittiö ja teatterin laajennus.
-- Porvoon tuotto on pieni mutta aitoa: Aleksanterinkadun sillan korjaus ja
-- Näsin tekojään perusparantaminen.
--
-- SUODATIN TIUKKENI KAHDELLA MITATULLA KUVIOLLA:
--   * "Perusparannusavustuksen myöntäminen ... yksityistielle" - valtion
--     avustus yksityiselle tiekunnalle, ei kaupungin hanke. Kolme osumaa
--     Kouvolassa.
--   * "...yhteistyösopimuksen (TYM) purkaminen" - sopimuksen purkaminen ei
--     ole rakennuksen purkamista. Porvoossa kaksi neljästä ehdokkaasta oli
--     kohinaa ennen korjausta.
--
-- HUOM PORVOO: syötteessä on Porvoon isännöimän ympäristöterveysjaoston
-- asioita, jotka koskevat naapurikuntia (Loviisa, Sipoo, Askola,
-- Lapinjärvi). Ne ovat pääosin lausuntoja ja terveysvalvonnan määräyksiä,
-- jotka suodatin pudottaa - mutta jos kaupunkikenttä alkaa näyttää väärältä,
-- syy on tässä.

insert into discovery_sources (
  id, name, type, category, url, priority, enabled, refresh_minutes, collector, parser
) values
  ('legacy-kouvola-paatokset', 'Kouvolan päätökset', 'api', 'municipality_decisions',
   'https://ep10.kouvola.fi/cgi/DREQUEST.PHP?page=rss/meetingitems',
   10, true, 1440, 'legacyFetchCollector', 'kouvola_paatokset'),

  ('legacy-porvoo-paatokset', 'Porvoon päätökset', 'api', 'municipality_decisions',
   'https://porvoofi.oncloudos.com/cgi/DREQUEST.PHP?page=rss/meetingitems',
   10, true, 1440, 'legacyFetchCollector', 'porvoo_paatokset');
