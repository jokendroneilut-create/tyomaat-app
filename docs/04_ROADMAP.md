# Työmaat.fi – Roadmap

Tuotteen suunta ja priorisointi. Vastaa kysymykseen *"mitä seuraavaksi ja miksi
juuri se"*. Täydentää visiodokumentteja: [`00_PRODUCT_BLUEPRINT.md`](00_PRODUCT_BLUEPRINT.md)
(miksi olemme olemassa) ja [`01_ARCHITECTURE.md`](01_ARCHITECTURE.md) (miten
järjestelmä rakentuu). Priorisointipäätökset kirjataan myös
[`03_DECISIONS.md`](03_DECISIONS.md):hen ja toteutunut työ
[`CHANGELOG.md`](CHANGELOG.md):hen.

Ylin = tärkein / seuraavaksi.

---

## Nykytila (2026-07)

Missä olemme suhteessa blueprintin vaiheisiin (Stage 1 → 2 → 3):

| Kerros | Tila | Huomio |
|---|---|---|
| **Discovery (Stage 1)** | 🟢 Erittäin kypsä | Kymmeniä lähteitä, myös hankkeen aikaisimmat signaalit (YVA, ympäristölupa, suunnittelukilpailu). Dedup, suodatus, kuvausteksti-matchays. Laskeva tuotto lisälähteistä. |
| **Intelligence / candidate→project (Stage 2, sisäinen)** | 🟢 Kypsä | CQE-pisteytys (`lib/agent/quality`: business_value, recommended_action), candidate-kerros, lifecycle, TIC-komentokeskus, promootio. |
| **Asiakaskerros** | 🟡 Ohut | `/today` (alue + yritysprofiili -suodatus), `/watchlists` (hakuvahdit), sähköpostidigestit, CRM, analytiikka. Käytännössä *suodatettu lista*. |
| **Personoitu mahdollisuuspisteytys (Stage 2→3)** | 🟡 Rakennettu, ei viimeistelty | **Päivitetty 15.8.2026:** ei enää puutu. `lib/opportunity/` (roolimatriisi, `persistScores`, `projectPhaseKey`), taulu `opportunity_scores` 7 899 riviä, `/today` järjestää pisteellä (`todayRanking.ts`) ja perustelut näkyvät (`reasons`). Puutteet alla P1:ssä. |

**Ydinhavainto:** Blueprintin ydinlupaus — *"näytä oikea mahdollisuus oikealle
asiakkaalle oikeaan aikaan"* (§13, §15, §18) ja personoitu opportunity-pisteytys
(Milestone 5) — ei ole vielä rakennettu. Discovery tuottaa raakasignaaleja
enemmän kuin asiakaskerros osaa jalostaa.

### Mitattu tilanne 15.8.2026

Luvut asiakkaille näkyvistä hankkeista (5 439 kpl) ja käyttäjistä. Nämä
ovat P1:n lähtötaso — mitattu, ei arvioitu.

| | |
|---|---|
| asiakastilejä | 70 |
| aktiivisia 30 vrk sisällä | 30 |
| Tänään-asetukset säätäneitä | 24 |
| **peukkupalautteita yhteensä** | **2** |

**Palautesignaalia ei käytännössä ole.** P1:n neljäs vaihe
(palauteoppiminen) ei voi nojata kahteen peukkuun — pisteytyksen on
toimittava deterministisesti ensimmäisestä päivästä, ja oppiminen on
myöhempi lisä. Tämä on syytä tietää ennen suunnittelua.

Datan kattavuus, joka rajaa mitä pisteytys voi käyttää:

| kenttä puuttuu | osuus |
|---|---|
| kustannusarvio | 96 % |
| valmistumisaika | 92 % |
| urakoitsija | 86 % |
| rakennuttaja | 59 % |
| kohdetyyppi | 42 % |
| kaupunki / koordinaatit | 1 % |

Käytännössä **alue ja vaihe ovat ainoat lähes täydelliset ulottuvuudet**,
kohdetyyppi kohtuullinen. Kustannusarvioon tai osapuoliin nojaava
pisteytys jäisi useimmilla hankkeilla laskematta.

## Priorisointiperiaate

Painopiste siirtyy **"kerää enemmän" → "muunna kertynyt data per-asiakas-arvoksi."**
Perustelu: (a) se on blueprintin oma ydindifferentiaatio, (b) se mistä asiakas
maksaa ja mikä pitää hänet, (c) vaikeasti kopioitava kun ruokkii itseään
käyttäjädatalla. Jokainen lisälähde ilman tätä kerrosta vain kasvattaa listaa
jota kukaan ei ehdi lukea — vastoin tuotefilosofiaa (§3: *"should not show
everything"*).

---

## P1 — Opportunity Engine: per-asiakas relevanssipisteytys ⭐

**Tavoite.** Jokainen hanke saa asiakaskohtaisen relevanssipisteen +
ihmisluettavan **selityksen** ("miksi tämä sopii sinulle"). Yritysprofiili
muuttuu passiivisesta suodattimesta aktiiviseksi matchaykseksi.

**Miksi ensin.** Korkein vipuvarsi: tekee kertyneestä datasta myytävää ja
pysyvää, ja jokainen tuleva investointi (lisää lähteitä, trendit) kasvattaa sen
arvoa automaattisesti. Toteuttaa suoraan §13/§18 ja Milestone 5:n ytimen.

**Pisteytyksen ulottuvuudet:**
- **Rooli** (urakoitsija / aliurakoitsija / arkkitehti/suunnittelija /
  materiaalitoimittaja / konsultti) → määrää mikä *elinkaaren vaihe* on
  relevantti: arkkitehti ← kaava/suunnittelukilpailu; pääurakoitsija ←
  kilpailutus; materiaalitoimittaja ← rakentaminen alkaa; aliurakoitsija ←
  pääurakoitsija valittu.
- **Alue** (jo kerätään today-asetuksissa).
- **Hanketyyppi & koko** (business_value jo olemassa CQE:ssä).
- **Toimiala / avainsanat** (asiakkaan oma erikoisala).
- **Palautesignaalit** — peukku ylös/alas kerätään jo (`TodayFeedbackButtons`) →
  kerros oppii ajan myötä.

**Rakentuu olemassa olevan päälle.** Sama periaate kuin CQE:ssä ("score
transparently, explain every decision"), mutta *asiakaskohtaisena* kerroksena
CQE:n tuottaman yleisen prioriteetin päällä. Deterministinen ensin, LLM vain
epävarmoihin/korkean arvon tapauksiin (D-006), fail-open.

**Karkea vaiheistus:**
1. Tietomalli: asiakkaan profiili (rooli, alueet, toimiala/avainsanat) +
   `opportunity_score` per (asiakas, hanke) tai laskettuna kysyntähetkellä.
2. Ensimmäinen deterministinen pisteytysmoduuli (rooli × elinkaaren vaihe +
   alue + business_value) + selitysteksti.
3. `/today` järjestää ja perustelee pisteellä pelkän suodatuksen sijaan.
4. Palauteoppiminen (peukut säätävät painotuksia).

**Onnistumisen mittarit:** peukku-ylös-osuus /today-syötteessä nousee;
"avatut hankkeet / näytetyt" paranee; asiakas löytää relevantin hankkeen
vähemmällä selaamisella.

### Mitä on jo rakennettu (tarkistettu 15.8.2026)

**Älä aloita tyhjästä.** Vaiheet 1–3 ovat käytännössä tehty:

| osa | missä |
|---|---|
| rooli × elinkaaren vaihe -painot | `lib/opportunity/roleStageMatrix.ts` |
| kanoninen vaiheavain | `lib/opportunity/projectPhaseKey.ts` |
| pisteiden tallennus | `lib/opportunity/persistScores.ts` → taulu `opportunity_scores` (7 899 riviä) |
| `/today` järjestää pisteellä | `app/today/services/todayRanking.ts` |
| selitysteksti | `opportunity_scores.reasons`, esim. *"Rakenteilla — sopii infrarakentajalle"*, *"Suuri hanke"* |
| rooli asiakasprofiilissa | `user_today_preferences.settings.companyProfile` |

### Mistä jatkaa

Mitatut puutteet, tärkeysjärjestyksessä. Kohta 1 on tehty 15.8.2026;
kohdat 4–5 tulivat sen mittauksesta.

**1. ~~Puolet käyttäjistä on roolissa "Muu"~~ — korjattu 15.8.2026
(D-071).** Jakauma oli Muu 13, Infra 6, Rakennustuotteet 4,
Kiinteistönomistaja 1, Talotekniikka 1, Rakennusliike 1, ja matriisissa
`Muu: {}` eli tyhjä.

Syy ei ollut käyttäjien haluttomuus vaan **listan aukko**:
"Muu"-tilien verkkotunnukset olivat henkilöstövuokrausta (4),
erikoisurakointia (2), konevuokrausta ja mittauspalvelua — yhtäkään ei
ollut valikossa. Kun valikko on pakollinen eikä siinä ole omaa
toimialaa, "Muu" on ainoa ulospääsy.

Roolin päättely toimialasta suljettiin pois, koska avainsanoja oli
asettanut 0/26 tiliä — mutta huomaa mistä se johtuu: **avainsanoja ei
kysytä pakollisessa aktivointimodaalissa lainkaan**, kun taas rooli ja
myyntihetki kysytään (26/26 on siis pakotettu, ei vapaaehtoinen luku).
Puuttuva data on kysymättä jäänyt kysymys, ei käyttäjien vastahakoisuus.

Toteutus: neljä uutta roolia + kolmiportainen `resolveStageFit`
(rooli → omat myyntihetket → mitattu oletus). Samalla korjattiin
myyntihetkimoduuli, joka tunnisti vain 5 vaihetta 9:stä.

**Mitattu tulos:** "Muu"-tileillä vaihepisteet nousivat nollasta
keskimäärin 43 %:lle hankkeista, mutta **top 20 vaihtui vain 3/20** —
koko (50 p) ja tuoreus (25 p) hallitsevat yhä. Roolillisilla vaihtui
8/20 (vaihesanaston korjauksesta). Seuraava vipuvarsi on siis
**moduulipainojen tasapaino**, ei enää roolin puuttuminen.

**2. ~~Vaihesanasto vääristää pisteytystä~~ — väite tarkistettu ja se ei
pidä paikkaansa (15.8.2026).** Kirjoitusasuja on 11, mutta
`normalizeLegacyPhase` kanonisoi niistä 10. Ainoa tunnistumaton on
"Suunnittelukilpailu" (3 hanketta), eli **0 % aktiivisista hankkeista
jää pisteytykseltä näkymättä**. "Suunnittelussa" ja "Suunnittelu"
päätyvät molemmat avaimeen `planning`, "Rakentaminen aloitettu" ja
"Rakenteilla" avaimeen `construction`.

Epäyhtenäisyys on siis **näyttö- ja siisteysasia, ei pisteytysvirhe**,
ja pudotettu tästä listasta prioriteettina. Ainoa aito korjaus:
"Suunnittelukilpailu" → `planning` tai oma vaihe.

**3. Palautetta on 2 kappaletta.** Vaihe 4 (palauteoppiminen) ei voi
olla riippuvuus millekään muulle — pisteytyksen on toimittava
deterministisesti, ja oppiminen on myöhempi lisä.

**3½. VARASTO JA ASIAKASKUNTA OVAT ELINKAAREN ERI PÄISSÄ — P1:n uusi
suurin este (mitattu 15.8.2026).** Aktiivisten hankkeiden vaihejakauma:

| vaihe | kpl | osuus |
|---|---|---|
| Kaavoitus | 2 853 | **52 %** |
| Suunnittelu (yhteensä) | 1 501 | 27 % |
| Rakenteilla (yhteensä) | 663 | 12 % |
| Sopimus myönnetty | 185 | 3 % |
| Kilpailutus | 170 | 3 % |
| Rakennuslupa | 100 | 2 % |

Yli puolet varastosta on kaavoituksessa. Kaavoitukselle antaa painoa
vain kolme roolia (Arkkitehti 1.0, Kiinteistönomistaja 0.8, Infra 0.4)
— ja **arkkitehtejä on asiakaskunnassa nolla**. Asiakkaat ovat
Infrassa, materiaalitoimituksessa, urakoinnissa ja vuokrauksessa, eli
elinkaaren loppupäässä, jossa on 20 % varastosta.

Tämä selittää mitatun 24 %:n: roolillisella käyttäjällä vaihepisteet
ovat nollassa kolmella neljäsosalla syötettä, koska hankkeet ovat
väärässä päässä elinkaarta. **Pisteytystä ei voi säätää tämän ympäri**
— kyse on varaston koostumuksesta, ei painoista. Siksi Työjonon
"Stara ja liikelaitokset" (voittajat) ja muut myöhäisen vaiheen
lähteet nousevat P1:n kannalta tärkeämmiksi kuin uudet kaavalähteet.

**4. Moduulipainojen tasapaino (uusi, D-071:n mittauksesta).** Rooli on
40 pistettä ja hankkeen koko 50, joten **iso epärelevantti hanke voittaa
pienen relevantin**. Tämä selittää miksi "Muu"-tilien järjestys ei
juuri muuttunut vaikka vaihepisteytys korjattiin: koko ja tuoreus (75 p
yhdessä) hallitsevat kärkeä.

*Korjattu viittaus:* tässä luki aiemmin että vaihesanasto on
korjattava ennen painojen säätöä. Se este osoittautui olemattomaksi
(kohta 2), joten painojen säätöä ei jarruta mikään — paitsi että
kohdan 3½ varastovinouma kannattaa ratkaista ensin, koska painojen
säätäminen ei tuo syötteeseen hankkeita joita siellä ei ole.

**5. Nykyiset "Muu"-tilit eivät siirry uusiin rooleihin itsestään.**
13 tiliä on yhä roolissa "Muu"; uudet vaihtoehdot näkyvät heille vasta
jos he palaavat asetuksiin. Vaihtoehdot: kohdennettu viesti, asetusten
esiinnosto /today:ssa, tai kertaluontoinen kartoitus verkkotunnuksen
perusteella (ei automaattinen — se olisi arvaus käyttäjän puolesta).

**6. Aktivointimodaali kysyy kaksi asiaa kolmesta.** Rooli ja
myyntihetki ovat pakollisia, avainsanat eivät ole siinä lainkaan —
siksi `tradeKeywordFit` (25 p) on käytännössä kuollut moduuli 0/26
tilillä. Yksi lisäkysymys pakolliseen modaaliin ("mitä myyt / mikä on
erikoisalasi") herättäisi valmiin moduulin ja antaisi samalla sen
toimialadatan, jonka puuttuminen esti roolin päättelyn. Halvin
jäljellä oleva tapa lisätä personointia.

**Rajaus:** vain alue ja vaihe ovat lähes täydellisiä kenttiä,
kohdetyyppi kohtuullinen. Kokoon tai osapuoliin nojaava painotus jäisi
59–96 %:lla hankkeista laskematta (ks. *Mitattu tilanne*).

### Ehdotetut seuraavat askeleet — EI PÄÄTETTY (15.8.2026)

Nämä kolme nousivat D-071:n mittauksista. **Johannes ei ole päättänyt
näistä mitään**, eikä yhtäkään saa aloittaa tämän kirjauksen nojalla —
tämä on muistilista, ei suunnitelma. Järjestys on ehdotettu
tärkeysjärjestys perusteluineen, jotta päätöksen voi tehdä myöhemmin
ilman että aineisto pitää kaivaa uudestaan.

**E1. Myöhäisen vaiheen lähteet (Stara ja liikelaitokset, voittajat,
sopimusilmoitukset).** Peruste: kohta 3½ — 52 % varastosta on
kaavoituksessa, asiakkaat elinkaaren loppupäässä. Pisteytys ei voi
näyttää hankkeita joita syötteessä ei ole.

*Huomaa jännite olemassa olevaan linjaan:* "Tietoisesti taakse"
-osiossa lisälähteet on merkitty laskevaksi tuotoksi. Mittaus ei kumoa
sitä yleisesti — uusi **kaava**lähde on yhä laskevaa tuottoa — mutta
myöhäisen vaiheen lähde ruokkii suoraan sitä päätä jossa asiakkaat
ovat. Jos E1 valitaan, D-011:n kriteeri ("aikaisempi vaihe kuin
nykylähteet") on kirjattava uudelleen, koska tämä on tarkoituksella
päinvastainen. Se on päätös, ei sivuhuomio.

**E2. Yksi lisäkysymys pakolliseen aktivointimodaaliin ("erikoisalasi").**
Peruste: kohta 6 — herättää kuolleen `tradeKeywordFit`-moduulin (25 p,
käytössä 0/26 tilillä) ja tuottaa toimialadatan, jonka puute esti
roolin päättelyn. Halvin toteutus, mutta lisää kitkaa jo pakolliseen
onboardingiin — se on hinta joka on punnittava.

**E3. Moduulipainojen tasapaino (rooli 40 vs. koko 50).** Peruste:
kohta 4. Halvin koodimuutos, mutta pienin vaikutus ennen E1:tä:
painojen säätäminen ei tuo syötteeseen hankkeita joita siellä ei ole.

**Mitä ratkaisisi valinnan:** E1:n kohdalla se, kuinka monta
loppupään hanketta puuttuvista lähteistä oikeasti tulisi (mitattavissa
otoksella ennen rakentamista). E2:n kohdalla se, paljonko onboardingin
keskeytys kasvaa — nykyistä läpäisyprosenttia ei ole mitattu. E3:n
kohdalla peukkupalaute, jota on 2 kpl, eli ei mitään.

## P2 — Elinkaari-laukaistut hälytykset: "oikea aika"

**Tavoite.** Ilmoita kun asiakkaan kiinnostava hanke *etenee hänen
vaiheeseensa* — materiaalitoimittajalle pingi kun rakentaminen alkaa,
urakoitsijalle kun kilpailutus aukeaa.

**Rakentuu olemassa olevan päälle.** Palaset ovat jo: lifecycle-moottori,
`/watchlists` (hakuvahdit), digest-järjestelmä (`app/api/digests`). Kytke ne
**tapahtumapohjaisiksi** ilmoituksiksi jaksottaisen digestin sijaan:
lifecycle-vaiheen muutos + asiakkaan P1-relevanssi → laukaisu.

**Riippuvuus:** hyötyy P1:n relevanssipisteytyksestä (kenelle laukaistaan).

**Tila (2026-07-28):** 🟢 Live. Endpoint `app/api/opportunity-alerts` laukaisee
kun hanke etenee roolin huippuvaiheeseen (paino 1.0), alue-suodatus huomioiden.
Opt-out `settings.opportunityAlerts` (oletus päällä, edellyttää roolia). Dedup
taulu `opportunity_alerts`. Vercel-cron kerran/vrk klo 8 (30h ikkuna). `?dry=1`
esikatselee lähettämättä. Huom: `.in()`-id-listat pilkotaan 100:n paloihin
(iso lista -> PostgREST 400).

## P3 — TIC "mitä minun pitäisi tehdä tänään" (operaattori)

**Tavoite.** TIC päätös-edellä (§14): "5 signaalia odottaa päätöstäsi, 2 korkean
prioriteetin hanketta löytyi, 3 lähdettä kaatui, 12 ehdokasta valmiina
tarkistukseen." Listat toissijaisia, päätökset ensisijaisia.

**Tila (2026-07-28):** 🟢 v1 live. `TicDailySummary` kytketty TIC-etusivulle
(`app/tic/page.tsx`), luvut `getTicDailySummary()`-palvelusta: päätöstä vaativat
(ei-ohitetut), korkea prioriteetti, tarjoukset, kaavoitus, auto-suodatetut,
kaatuneet lähteet. Kortit linkittävät tarkistuslistaan / operationsiin.
**Seuraava (v2):** korttien suodatettu porautuminen (esim. "tarjoukset" ->
vain ne listassa), ja mahdollinen roolikohtainen priorisointi jonossa.

## P4 — Proaktiivinen markkinatieto / trendit

**Tavoite.** "Datakeskukset saavat huomiota", alue kuumenee, perutut/tauolla
olevat hankkeet arvokkaana signaalina (§12). Nice-to-have, kun P1–P2 tuottavat
jo käyttäjädataa jonka päälle trendit lasketaan.

---

---

## Työjono (kirjattu 15.8.2026)

Tukityö joka ei ole P1–P4 mutta on tiedossa. Aiemmin hajallaan
päätösten "Auki"-kohdissa; koottu tähän jotta se ei ole yhden session
muistin varassa.

### Datan laatu

- **Vaihesanasto on epäyhtenäinen** — mutta ei niin haitallinen kuin
  tässä aiemmin väitettiin. Tarkistettu 15.8.2026: 11 kirjoitusasua,
  joista `normalizeLegacyPhase` kanonisoi 10. "Suunnittelussa" 1 285 ja
  "Suunnittelu" 216 päätyvät molemmat avaimeen `planning`,
  "Rakentaminen aloitettu" 397 ja "Rakenteilla" 266 avaimeen
  `construction`. Pisteytys ei siis vääristy. Aito korjattava on
  **"Suunnittelukilpailu" (3 hanketta), joka ei kanonisoidu lainkaan**.
  Loput on siisteyttä: yksi vaihe, yksi nimi näytöllä.
- Kohdetyyppi puuttuu 2 260 hankkeelta (42 %).
- Lähdelinkki puuttuu 734 hankkeelta (13 %), joista suurin osa on vanhaa
  legacy-erää.
- Kuvaus alle 200 merkkiä 1 803 hankkeella (33 %).

### Lähdekattavuus

- **Fingridin liityntähankkeet** — yksityisten suurhankkeiden katvealue.
  Microsoftin Kirkkonummen datakeskus osui meihin vain YVA:n kautta
  (ks. muistiinpano yksityisten rakennuttajien katvealueesta).
- **Stara ja liikelaitokset** — voittajia jää poimimatta, Stara on aito
  kilpailija.
- **Ruotsinkieliset päätökset** — jäävät poimimatta.
- **RPT-lista:** Tampereen 9 kadonnutta ehdokasta, Turku ei aja,
  lupakirjeet kirjaamoissa.

### Poimintalogiikka

- **Rakennuttaja ingressistä** (D-066 auki). Vaatii genetiivin
  perusmuodon päättelyn: "Fingridin" → Fingrid, mutta "Skanskan" →
  Skanska. Ei yksikäsitteinen, joten sama varovaisuus kuin
  `allativeToNominative`-funktiossa.
- **Kuvaustäydennys irti nähty-ehdosta** (D-068, vaihtoehto D). Tarpeen
  vain jos lyhyitä kuvauksia alkaa kertyä.
- **LLM-duplikaattiskannaus harmaalle vyöhykkeelle**: 3 168 paria
  ≈ 0,9 $/ajo. Lykätty; aloita 259 parin katselmoinnista.

### Operointi

- **Mittaa ajokesto** noston 14 → 20 jälkeen (Ajot-sivu). Oma raja 500 s,
  alustan kova katto 800 s.
- **Todenna STT ja Rakennuslehti** kun ne osuvat vuoroon — korjaukset on
  tehty mutta niitä ei ole vielä ajettu kertaakaan.
- **`sync-account-lifecycle` ei ole cronissa.** Supabasen
  hallintapaneelista poistettu tili voi kadottaa luontipäivänsä, jos
  täsmäytystä ei ole ajettu välissä.

## Tietoisesti taakse / ei nyt

- **Lisää discovery-lähteitä** ilman asiakaskerroksen kehitystä — laskeva tuotto,
  kasvattaa vain suodattamatonta listaa.
- **Tontinluovutukset** — ei siistiä lähdettä, kohiseva päätösdata (ks. D-012).
- Kriteeri uudelle lähteelle säilyy: korkea signaali/kohina + aikaisempi vaihe
  kuin nykylähteet (D-011) — ei volyymi volyymin vuoksi.

## Kehitysrytmi (blueprint §16)

design → päivitä docs tarvittaessa → toteuta → testaa → commit → deploy.
`docs/` on projektin virallinen muisti.
