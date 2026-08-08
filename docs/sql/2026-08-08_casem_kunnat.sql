-- Jyväskylä, Rovaniemi ja Pori CaseM-jäsentäjälle. Ei uutta koodia
-- kerääjässä: sama fetchCaseMSource, vain isäntänimi ja kunnan tiedot vaihtuvat.
--
-- JYVÄSKYLÄ EI OLE TWEB-KUNTA. Se oli kirjattu viidenneksi alustaperheeksi ja
-- seuraavaksi työksi (docs/rpt/README.md). Kaupungilla on kyllä Tweb-asennus
-- osoitteessa julkinen.jkl.fi, mutta päätökset löytyvät myös CaseM:stä
-- osoitteesta jyvaskyla.cloudnc.fi. Viidettä jäsentäjää ei siis tarvita.
-- Sama kartoitus toi mukanaan Rovaniemen ja Porin, jotka olivat samalla
-- alustalla ilman että sitä osattiin epäillä.
--
-- Mitattu ennen käyttöönottoa (18 kk tuoreusraja, 60 asiasivun budjetti):
--   Jyväskylä  21 ehdokasta,  9 s, kuvaus mediaani 6205 merkkiä, osoite 6/21
--   Rovaniemi  28 ehdokasta, 25 s, kuvaus mediaani 5783 merkkiä, osoite 10/28
--   Pori       18 ehdokasta, 20 s, kuvaus mediaani 11795 merkkiä, osoite 10/18
--
-- Kärjessä ovat aitoja hankepäätöksiä: Kilpisen koulun peruskorjauksen ja
-- Kauramäen päiväkotikoulun hankesuunnitelmat (Jyväskylä), Ounasvaaran lukion
-- hankesuunnitelma ja uuden uimahallin päätökset (Rovaniemi), Porin Stadionin
-- peruskorjaus ja Lentokenttäalueen rakennushanke (Pori).
--
-- OTSIKKOSUODATUS TIUKKENI SAMALLA. CaseM:n haku on kokotekstihaku, joten
-- hakusana osuu asiakirjan runkoon eikä otsikkoon - "peruskorjaus" palautti
-- otsikot "Ajankohtaiset asiat" ja "Ilmoitusasiat / Tekninen lautakunta".
-- Suodatus siirtyi Dynastyn positiiviseen listaan (D-029:n kuvio). Mitattu
-- vaikutus hakutulosten otsikkoihin: Tampere 311 -> 168, Jyväskylä 46 -> 21,
-- Rovaniemi 116 -> 56, Pori 74 -> 19. Tampereen tuotos ei muuttunut (10
-- ehdokasta ennen ja jälkeen), mutta ajoaika puolittui 149 s -> 81 s, koska
-- asiasivubudjetti ei enää kulu kohinaan.
--
-- TUNNETUT RAJOITTEET:
--   * Sama 60 asiasivun budjetti kuin Tampereella, ja haku on
--     relevanssijärjestyksessä (o=Rank) eikä päivämäärän mukaan. Osa aidoista
--     osumista jää siksi ajon ulkopuolelle - mitattu esimerkki
--     "Pirkkala-Linnainmaa -raitiotien allianssisopimus" (Tampere).
--   * Jyväskylän purku-urakkapäätöksiä on paljon peräkkäin (7/21). Ne ovat
--     aitoja, mutta pieniä.

insert into discovery_sources (
  id, name, type, category, url, priority, enabled, refresh_minutes, collector, parser
) values
  (
    'legacy-jyvaskyla-paatokset',
    'Jyväskylän päätökset',
    'api',
    'municipality_decisions',
    'https://jyvaskyla.cloudnc.fi/fi-FI/haku',
    10,
    true,
    1440,
    'legacyFetchCollector',
    'jyvaskyla_paatokset'
  ),
  (
    'legacy-rovaniemi-paatokset',
    'Rovaniemen päätökset',
    'api',
    'municipality_decisions',
    'https://rovaniemi.cloudnc.fi/fi-FI/haku',
    10,
    true,
    1440,
    'legacyFetchCollector',
    'rovaniemi_paatokset'
  ),
  (
    'legacy-pori-paatokset',
    'Porin päätökset',
    'api',
    'municipality_decisions',
    'https://pori.cloudnc.fi/fi-FI/haku',
    10,
    true,
    1440,
    'legacyFetchCollector',
    'pori_paatokset'
  );
