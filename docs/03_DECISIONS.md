# Työmaat.fi – Päätökset (ADR-tyyliin)

Merkittäviä suunnittelupäätöksiä ja niiden perustelut, jottei niitä käydä
uudelleen läpi joka sessiossa. Ylin = uusin.

---

### D-012 – Tontinluovutukset jätetty väliin (ei siistiä lähdettä)
Selvitetty kilpailija-aukkona: ei kansallista eikä siistiä kaupunkikohtaista
rajapintaa. Helsingin `tontit.hel.fi` on poistettu, ja tonttiasiat ovat nyt
yleisissä päätösjärjestelmissä (`paatokset.hel.fi` ym.) yksittäisinä
pöytäkirjoina kaiken muun seassa — signaali/kohina huono, rakennuttajan/tontin
louhinta epäluotettavaa, ja tieto hajallaan joka kaupungissa erikseen. Menee
myös päällekkäin kaavan (jo poimitaan) ja rakennuslupien kanssa. **Päätös:**
kohiseva päätös-scraperi haittaisi TIC-jonoa enemmän kuin hyödyttäisi → ei
rakenneta ennen kuin löytyy siisti, korkean signaalin lähde.

### D-011 – Varhaisen vaiheen lähteet kilpailija-aukon sulkemiseen
Metroc/RPT Smart poimivat isot hankkeet aikaisin. Aukon sulkevat lähteet jotka
osuvat hankkeen KAIKKEIN aikaisimpaan julkiseen signaaliin, ennen rakennuslupaa
ja urakkakilpailutusta: **YVA** (ympäristövaikutusten arviointi — suurimmat
energia-/teollisuus-/infrahankkeet), **ympäristölupa** (isot yksityiset
laitokset ilman julkista kilpailutusta, esim. datakeskukset) ja
**suunnittelukilpailu** (SAFA — merkittävät julkiset rakennukset konseptivaiheessa,
myös Hilman ulkopuoliset kutsukilpailut). Kriteeri uudelle lähteelle: korkea
signaali/kohina ja aikaisempi vaihe kuin nykylähteet — ei volyymi volyymin
vuoksi (vrt. [D-012]).

### D-010 – Duplikaatteja yhdistettäessä säilytä hanke jolla on käyttäjädataa
Suosikit (`user_project_favorites`) ja omistajuus viittaavat `project_id`:hen.
Jos yhdistettäessä poistetaan väärä hanke, käyttäjien suosikit eivät seuraa
uuteen kopioon (eri id) — ne katoavat/roikkuvat. **Sääntö:** säilytä se hanke
johon käyttäjät ovat koskeneet; jos suunta on toinen, siirrä `user_project_favorites`
(ja muu project_id-viitteinen data) säilyvälle ennen poistoa.

### D-009 – Tarkoituksella pois kytketty lähde ei ole "ongelma"
Discovery Sources -taulussa "ongelma" = oikeasti rikki (virheitä). Pois
kytketty (`enabled=false`) lähde on eri tila (⚪ pois), ei punainen ongelma.
Esim. vanha Helsingin WFS jätettiin pois-tilaan SUKKAn varalle — se ei saa
näyttää ongelmalta.

### D-008 – Vanhat uutiset kahdella riippumattomalla mekanismilla
Uutispohjaiset lähteet tuovat vanhoja, jo valmistuneita hankkeita. Suodatus:
(1) **teksti** — mennyt valmistumispäivä kuvauksessa → `recommended_action=ignore`
(keskitetty `resolvePotentialProject`iin); (2) **julkaisupäivä** — yli 24 kk
vanha artikkeli (esim. Puolustuskiinteistöt) käsitellään kuin valmistunut.
Kahta tarvitaan, koska osa uutisista ei mainitse päivää tekstissä ja osalla ei
ole luotettavaa julkaisupäivää.

### D-007 – Discovery-cron 6 h välein (4×/vrk)
Kerran/yö -ajolla yksittäisen lähteen häntäkierto oli ~35 pv (250 lähdettä ÷
~7 paikkaa). 6 h -välein (4 ajoa/vrk) se on ~9 pv. Ajon kesto mitattu (~187 s),
selvästi alle 500 s turvarajan / 800 s Fluid Compute -katon.
Ks. `lib/agent/pipeline/cronConfig.ts` (`DISCOVERY_RUNS_PER_DAY`).

### D-006 – Deterministinen ensin, LLM fail-open
Kaikki poiminta yritetään ensin sääntöpohjaisesti; LLM (Haiku) vain kun sääntö
ei riitä, ja aina fail-open (ilman API-avainta ohitetaan). Putki toimii aina
ilman AI:ta. Ks. [`05_AI.md`](05_AI.md).

### D-005 – Rikas lähde deterministisen jäsennyksen sijaan kun rajapinta antaa sen
Helsingin WFS antoi vain geometrian + kaavatunnuksen; SUKKA-rajapinta antaa
kuvauksen, yhteystiedon, vaiheen ja liitteet. Kun kunnalla on rikkaampi
(Sitowise/Oskari) rajapinta, käytä sitä — vähemmän jälkirikastusta.

### D-004 – Manuaalinen "aseta vanhenemaan" pienten hankkeiden suodatukseen
LLM-luokittelun sijaan hyväksyjä voi merkitä pienen hankkeen vanhenemaan
vuoden päästä (tick box). Yksinkertaisempi ja käyttäjän hallinnassa.

### D-003 – Testit `*.spec.ts` (Vitest), ei `*.test.ts`
Repossa oli jo `*.test.ts`-tiedostoja jotka ovat console.log-skriptejä, eivät
framework-testejä. Vitest-testit nimetään siksi `*.spec.ts`. CI ajaa
`npm install` (ei `npm ci`) cross-platform-lockin vuoksi.

### D-002 – Kaksi ehdokasjärjestelmää (siirtymävaihe)
`potential_projects` (pääpolku, uudet resolverit) ja legacy
`candidate_projects` (saveSignal/classifySignal). Uusi työ menee
`potential_projects`iin.

### D-001 – Lähde rekisteröitävä Supabaseen, ei pelkkä koodi
Pelkkä collectorin committaaminen ei riitä — lähde tarvitsee rivin
`discovery_sources`-tauluun. Ks. [`07_ZONING_SOURCES.md`](07_ZONING_SOURCES.md)
(luotettavuushuomio + 8-tiedosto-kaava).
