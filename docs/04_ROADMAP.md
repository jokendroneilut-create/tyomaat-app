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
| **`business_value` (aito arvo)** | **96 %** — 61 % `"unknown"`, 35 % puuttuu |
| **`size_class` (aito arvo)** | **100 %** — ei yhtään aitoa arvoa |
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

**"Muu"-osuus on nyt mittari, ei enää pelkkä vika.** Vaihtoehto
säilyy valikossa tarkoituksella — pakollisessa modaalissa on oltava
ulospääsy, tai käyttäjä valitsee väärän roolin päästäkseen eteenpäin,
ja väärä rooli on huonompi kuin tyhjä. Mutta sen osuus kertoo suoraan
kattaako valikko kentän:

- **osuus pysyy ~50 %:ssa** → neljä uutta roolia eivät osuneet,
  valikossa on yhä aukko → katso taas verkkotunnukset kuten 15.8.
- **osuus laskee** → valikko kattaa, ja jäljelle jäävä "Muu" on aitoa
  jäännösjoukkoa jolle kolmiportainen varasuunnitelma riittää.

Mittaus vaatii **uusia tai asetuksiaan päivittäneitä tilejä**, joten se
kannattaa lukea aikaisintaan noin kuukauden päästä (n. 15.9.2026) — ei
aiemmin, koska nykyiset 13 tiliä eivät siirry itsestään (kohta 5) ja
lukisivat mittarin väärin liian aikaisin. Sama roolijakauma-ajo kuin
15.8., ks. D-071.

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

**3. Peukkuja on 1 — mutta palautedataa ~330 tapahtumaa (tarkennettu
15.8.2026).** Kahdesta `project_feedback`-rivistä toinen on testitili,
eli ulkoisia peukkuja on **yksi, yhdeltä tililtä**. Peukku on kuollut
mittari.

Käyttäytymissignaalia sen sijaan on: `project_open` 191 (25 tiliä),
suosikit 84 (10 tiliä), hankkeen tilamuutos 59 (7 tiliä) — ja
tilamuutoksissa **won 6, lost 8, offer_sent 12, contacted 27**. Won/lost
ei ole relevanssin korvike vaan relevanssi itse.

Oppiminen on siis kehitettävissä nyt, mutta **lähde on vaihdettava
peukusta käyttäytymiseen**. Este: emme kirjaa näyttökertoja, joten
tämän dokumentin oma mittari *"avatut / näytetyt"* ei ole laskettavissa
eikä avausten järjestysvinoumaa voi korjata. Toimintalogiikka ja
varaukset: [`08_P1_OPPORTUNITY_ENGINE.md`](08_P1_OPPORTUNITY_ENGINE.md) §9b.

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

**3¾. HANKKEEN ARVO PUUTTUU KÄYTÄNNÖSSÄ AINA — ja se on pisteytyksen
suurin moduuli (mitattu 15.8.2026).**

| kenttä | kattavuus 5 481 aktiivisesta |
|---|---|
| `estimated_cost` | 200 (**4 %**) |
| `floor_area` | 140 (3 %) |
| `apartments` | 180 (3 %) |
| jokin näistä | 406 (**7 %**) |
| `metadata.business_value` aito arvo | 236 (**4 %**) |

`business_value` on 61 %:lla `"unknown"` ja 35 %:lta puuttuu kokonaan;
aitoja arvoja on high 213, medium 21, low 2. **Moduuli `businessValue`
on pisteytyksen suurin (50 p) ja se vaikenee 96 %:lla hankkeista.**
Käytännössä valtaosan hankkeista pistemäärä on tuoreus + lähde + vaihe.

Ja kun se puhuu, se on ylivoimainen: 50 p voittaa roolin huippuvaiheen
(40 p). Mitattu vaikutus 24 tilin top 20:iin yhteisellä 1 000 hankkeen
joukolla (ilman aluerajausta, jotta mittaus koskee roolia):

- **52 %** kaikista top 20 -paikoista on `business_value = high`
- 24 tilin top 20 -listat koostuvat yhteensä vain **56 eri
  hankkeesta** (jos listat olisivat erilaiset: 480)
- mutta **0 hanketta on kaikkien 24 listalla** — eli syötteet eivät ole
  identtisiä, ja rooli erottelee aidosti (Rakennusliike 20 % high vs.
  Kiinteistönomistaja 75 %)

Rehellinen tulkinta: **ei "kaikille sama lista", vaan kaikille lista
samasta 56 hankkeen altaasta.** Personointi toimii, mutta se valitsee
liian pienestä joukosta, koska arvokenttä ratkaisee kärjen ja se on
tiedossa vain 4 %:lla.

Kustannusarvio myös keskittyy: 175/200 tulee lähteestä jolla ei ole
`source_name`ia (vanha legacy-erä) ja 32 % "Rakentaminen aloitettu"
-vaiheen hankkeista — kaavoituksessa (52 % varastosta) arvo on
**0 hankkeella 2 853:sta**. Tämä on sama vinouma kuin kohdassa 3½,
eri kenttänä.

*Mahdollisia suuntia (ei päätetty):* arvon johtaminen kerrosalasta tai
asuntomäärästä, kohdetyyppikohtainen mediaanihinta karkeana arviona,
`business_value`-luokittelun laajentaminen kuvaustekstistä, tai
`"unknown"`-arvon käsittely eri tavalla kuin puuttuvan.

#### "Liian pieni hanke" ei ole tällä hetkellä toimeenpantavissa

Kysymys nousi 15.8.2026: jos käyttäjä valitsee peukun syyksi *"Liian
pieni hanke"*, millä me ylipäätään mittaamme kokoa? Vastaus on että
emme mitenkään — kolme erillistä katkosta samassa ketjussa:

1. `reason_category` **tallennetaan mutta pisteytys ei lue sitä**
   (`08_P1` §9b).
2. Vaikka lukisi, kokoulottuvuutta ei ole: `estimated_cost` 4 %,
   `floor_area` 3 %, `apartments` 3 %.
3. **`metadata.size_class` on `"unknown"` 64 %:lla ja puuttuu
   36 %:lta — aito arvo on 0 hankkeella.** Kenttä on silti
   `AFFINITY_ATTRIBUTES`-listalla ja peukkulomake lähettää sen, eli
   oppimissilmukassa on attribuutti jota ei ole olemassa.

**Diskreetit kokosignaalit jotka OVAT olemassa** (sama ajo):

| signaali | kattavuus | huomio |
|---|---|---|
| kohdetyyppi (`building_type`\|`property_type`) | **59 %** | korreloi kokoon: Sairaala / Energiantuotanto / Infrahanke ≫ Päiväkoti / Rivitalo |
| euromäärä **kuvaustekstissä** (regex-arvio) | **14 %** (765 kpl) | vrt. rakenteinen kenttä 200 kpl — **3,8× enemmän** |
| kerrosala kuvaustekstissä | 7 % (374 kpl) | vrt. `floor_area` 140 kpl — 2,7× enemmän |
| asuntomäärä kuvaustekstissä | 1 % | vähäinen |

Kaksi johtopäätöstä. **Kohdetyyppi on paras käytettävissä oleva
diskreetti kokoluokka** (59 %) ja se on jo yhtenäistetty (D-059) —
kokoluokka voidaan johtaa siitä ilman yhtään uutta lähdettä.
Ja **teksti sisältää moninkertaisesti enemmän euroja kuin rakenteinen
kenttä**, eli poiminta on alihyödynnetty, ei data puuttuva.

**Kohdetyyppi ennustaa kokoa — todennettu, ei oletettu.** Niistä 200
hankkeesta joilla on kustannusarvio, **199:llä on myös kohdetyyppi**.
Mediaanikustannus tyypeittäin:

| kohdetyyppi | n | mediaani € |
|---|---|---|
| Datakeskus | 11 | 100 000 000 |
| Energiantuotanto | 12 | 100 000 000 |
| Kulttuurirakennus | 6 | 61 400 000 |
| Sairaala | 5 | 50 000 000 |
| Liikuntapaikka | 7 | 31 500 000 |
| Toimitila | 39 | 28 000 000 |
| Infrahanke | 30 | 24 000 000 |
| Koulu | 22 | 18 000 000 |
| Päiväkoti | 5 | 14 000 000 |
| Kerrostalo | 26 | 13 000 000 |
| Hoivakoti | 6 | 10 000 000 |
| Silta | 6 | 8 500 000 |
| Rivitalo | 4 | 5 500 000 |

Ero on **18-kertainen** päästä päähän ja järjestys on intuitiivinen.

⚠️ **Korjaus 15.8.2026 (myöhempi mittaus): tämä taulukko lupasi liikaa,
ja arvioni 59 %:n kattavuudesta oli väärä.** Mediaani kertoo tyyppien
välisen eron, mutta ei tyypin sisäistä hajontaa — ja se on iso. Kun
315 tunnetun arvon joukolla testattiin, kuinka usein kohdetyypin
mediaanista johdettu luokka osuu oikeaan:

| jako | osuvuus | vertailukohta (arvaa aina yleisin) | hyöty |
|---|---|---|---|
| 2 luokkaa, raja 10 M€ | **68 %** | 51 % | **+17 pp** |
| 2 luokkaa, raja 5 M€ | 70 % | 62 % | +8 pp |
| 3 luokkaa (<2 / 2–20 / >20 M€) | 52 % | 36 % | +16 pp |
| 3 luokkaa (<1 / 1–10 / >10 M€) | 50 % | 49 % | **+1 pp, hyödytön** |
| 4 luokkaa | 40 % | 31 % | +9 pp |

**Vain karkea kahtiajako 10 M€:n kohdalta kantaa** — ja sekin on
väärässä joka kolmannella. Kolme luokkaa 10 M€:n rajalla ei ole
perusarvausta parempi lainkaan.

Tyyppikohtainen luotettavuus 10 M€:n rajalla (osuus havainnoista
enemmistön puolella): Rivitalo 100 %, Datakeskus 92 %, Teollisuus
83 %, Silta 75 % — mutta **Kerrostalo 57 %, Hoivakoti 50 %**, eli
kolikonheitto. Suuret tyypit ovat juuri niitä epävarmoja.

**Ja luotettavien tyyppien kattavuus on pieni.** 75 %:n rajalla
mukaan pääsevät Rivitalo, Datakeskus, Teollisuus ja Silta = **292
hanketta eli 5 % kannasta** — tuskin enempää kuin ne 315, joilla arvo
jo on. (Laskelma näyttää 47 %, mutta siitä 2 272 on hankkeita **ilman
kohdetyyppiä**; tyypittömälle ei voi päätellä tyypistä mitään, joten
ne eivät kelpaa mukaan.) 70 %:n rajalla mukaan tulevat
Energiantuotanto, Toimitila ja Sairaala → n. 20 % kannasta, mutta joka
kolmas merkintä on väärä.

**Johtopäätös: johdettu kokoluokka ei ratkaise kattavuutta.** Se on
lisä tunnetun arvon päälle, ei sen korvike. Kattavuus tulee
poiminnasta (ks. D-072), ei päättelystä.

#### Kokoluokan määritelmä (ehdotus, ei päätetty)

Rajat mitatusta jakaumasta (315 tunnettua arvoa: p25 = 774 k€,
mediaani = 9 M€, p75 = 29 M€), joten 10 M€ osuu luontevasti mediaanin
kohdalle — sama raja jonka Johannes ehdotti itsenäisesti:

| luokka | raja | osuus tunnetuista |
|---|---|---|
| Pieni | < 1 M€ | 27 % |
| Keskikokoinen | 1–10 M€ | 24 % |
| Suuri | 10–50 M€ | 31 % |
| Erittäin suuri | ≥ 50 M€ | 18 % |

**Tarkkuus seuraa todistetta — tämä on ehdotuksen ydin:**

- **Arvo tiedossa** (315 hanketta) → neljä luokkaa, eksakti, ja
  euromäärä näkyviin: *"Suuri — 12,5 M€"*. Sopimusarvo voidaan
  merkitä erikseen toteutuneeksi.
- **Arvo johdettu kohdetyypistä** → **vain kahtiajako** *"Suuri
  hanke (yli 10 M€)"* / ei merkintää, ja vain tyypeille joiden
  luotettavuus ≥ 75 %. Ei koskaan euromäärää, koska sitä ei tiedetä.
- **Ei kumpaakaan** → ei kokoluokkaa lainkaan. Tyhjä ei valehtele.

**PÄÄTETTY 15.8.2026: johdettua kokoluokkaa ei tehdä lainkaan.**
Käytetään vain tiedossa olevaa arvoa. Kohdetyypistä päättely olisi
kattanut ~5 % ja ollut väärässä joka neljännellä — arvaus jota asiakas
lukisi faktana. Sama periaate kuin D-057:ssä ja D-072:ssa: tyhjä kenttä
ei valehtele. `cost_source: "derived"` jää käyttämättä.

Kokoluokka voidaan siis johtaa **vain tunnetusta arvosta** (yllä oleva
neliportainen taulukko), ja se kattaa sen minkä poiminta kattaa.

#### Yrityslähteet: oikea oletus, mutta lähteet eivät tuota

Hypoteesi 15.8.2026: yritykset ilmoittavat itse voittamiensa urakoiden
arvon, joten yrityslähteet olisivat euromäärien paras suoni. Oletus on
oikea — mutta **lähteet eivät tuota juuri mitään.**

Rekisteröityjä yrityslähteitä on 28 (SRV, YIT, Skanska, NCC, Peab,
Lujatalo, Fira, Hartela, Bonava…). Ne ovat tuottaneet yhteensä **97
aktiivista hanketta 5 481:stä eli 1,8 %:**

| lähde | hankkeita | joilla arvo |
|---|---|---|
| rakennuslehti | 24 | **6 (25 %)** |
| srv | 11 | 0 |
| pohjola_rakennus | 11 | 0 |
| skanska | 7 | 1 |
| hartela | 6 | 0 |
| lujatalo | 5 | 0 |
| peab / fira / jatke / ncc / bonava | 1–2 kukin | 0 |
| **yit, grk, asura, asuntosäätiö, espoonasunnot, mangrove** | **0** | – |

Kaksi johtopäätöstä. **Rakennuslehti on koko kannan paras arvolähde:**
25 % sen hankkeista on euromäärä, kun koko kannan keskiarvo on 6 %.
Ammattilehti raportoi urakkasummat rutiininomaisesti. **Ja isot
urakoitsijalähteet ovat käytännössä kuolleita** — YIT, GRK ja viisi
muuta eivät ole tuottaneet yhtäkään hanketta, ja SRV:n 11 hankkeesta
yhdelläkään ei ole arvoa.

Ongelma ei siis ole poiminta vaan keruu: tekstistä on jo poimittu
kaikki mihin ankkurit yltävät (`poimittavissa vielä 0` mitattuna).
Euromäärien kattavuus kasvaa vain saamalla lisää **niitä tekstejä,
joissa summa mainitaan** — ammattilehtityyppisiä lähteitä ja
toimivia urakoitsijatiedotteita.

**Selvitetty 15.8.2026 — lähteet eivät ole rikki, ne hakevat.** Audit
(`scripts/audit-company-sources.ts`) ajoi kaikki 26 lähdettä livenä:
ne palauttavat yhteensä ~380 ehdokasta per ajo (SRV 81, Skanska 35,
Hartela 28, Pohjola 26, Lujatalo 25, Jatke 22, Tekova 20). Kannassa on
silti vain 97 hanketta, joten **pudotus tapahtuu tuonnin ja
katselmoinnin välissä, ei haussa.**

Kaksi erillistä vikatyyppiä erottui:

**A. ~~Kuvaukseton ehdokas (13 lähdettä)~~ — mittausvirhe, korjattu
15.8.2026.** Ensimmäinen lukema "13 lähdettä palauttaa kuvauksen 0 %:lla"
oli **mitattu väärin**: audit ajettiin ilman `--enrich`-lippua, ja
skriptin oma kommentti varoittaa juuri tästä — ilman lippua taulukko
mittaa tuotoksen ENNEN rikastuskoukkua.

Koukun kanssa ajettuna (`--enrich --sample=4`) samat kahdeksan lähdettä
antavat **kuvauksen 100 %:lla**, urakoitsijan useimmilla ja kohdetyypin
50–100 %:lla. `createCompanyEnricher` siis toimii. Lähteet eivät ole
rikki eikä niissä ole korjattavaa.

**A2. Oikea vika: jo tallennettu rivi ei koskaan täydenny.**
Tuonnissa koukkua kutsutaan vain **vielä näkemättömille** osoitteille
(`legacyFetchCollector`: `seenUrls`), ja budjetti on 40 kandidaattia per
ajo. Kerran kuvauksettomana tuotu rivi jää siis pysyvästi vajaaksi,
vaikka koukku osaisi täydentää sen. Siksi jäämä purettiin erillisellä
skriptillä: `scripts/backfill-company-enrichment.ts`.

**Tulos 15.8.2026** (128 hanketta + 60 jonoriviä):

| kenttä | osuus rikastetuista |
|---|---|
| asiakkaalle näkyvä kuvaus ≥ 400 mrk | **128 (100 %)**, mediaani 3 570 mrk |
| kohdetyyppi | 114 (89 %) |
| rakennuttaja | 94 (73 %) |
| urakoitsija | 75 (59 %) |
| euromäärä | 9 (7 %) |

Kaikki nämä kentät olivat näillä riveillä aiemmin tyhjiä. Kohdetyyppi
89 %:lla on merkittävin: se on alueen jälkeen asiakkaan tärkein
suodatin.

⚠️ **Kolme peräkkäistä virhettä ennen kuin luku oli oikein**, ja
skripti raportoi kaikki kolme kertaa onnistuneena ("196 riviä, 0
virhettä"): (1) mittaus ilman `--enrich`-lippua, (2) `??` ei korvaa
tyhjää merkkijonoa, joten kuvaus ei päätynyt `additional_info`-kenttään
(7/124), (3) korjaus säilytti liian lyhyen tiivistelmän, koska
"ensimmäinen ei-tyhjä" voitti (15/124). Vasta "pisin voittaa" tuotti
100 %. **Skriptin loki kertoo mitä se yritti tehdä, ei mitä kantaan
päätyi** — jälkitarkistus kannasta on pakollinen osa backfillia.

**B. Väärä rajaus (SRV, korjattu — D-074).** Lähde haki hyvin mutta
suodatti pois sijoittajauutiset, joissa pörssiyhtiö julkaisee
merkittävät urakkavoitot. 81 → 165 ehdokasta, euromäärä 16:ssa.

*Seuraava askel (ei päätetty):* harkitse pitäisikö tuonnin ajaa koukku
myös jo nähdyille riveille joiden kuvaus on lyhyt — nyt se on erillisen
skriptin varassa, eli sama jäämä alkaa kertyä uudelleen. Vaihtoehto on
ajastaa backfill-skripti, jolloin tuontiin ei kosketa.

**Metodihuomio, joka maksoi kaksi väärää päätelmää tässä samassa
osiossa.** Ensin väitin vaihesanaston vääristävän pisteytystä
(kohta 2) ja sitten 13 lähteen olevan rikki (A) — molemmat kumoutuivat
kun luku mitattiin oikein. Kummassakin tapauksessa alkuperäinen luku
oli olemassa ja näytti vakuuttavalta; vain sen tuottanut ehto oli
väärä. Mitattu luku ei ole sen luotettavampi kuin sen mittaustapa.

*Rajoitteet rehellisyyden vuoksi:* otos on 199 hanketta, tyyppiä kohti
3–39, joten mediaanit ovat suuntaa-antavia — kelpaavat kokoluokkaan,
eivät euroarvioon. Otos on myös vino (175/200 samasta legacy-erästä ja
32 % "Rakentaminen aloitettu" -vaiheesta), joten mediaanit voivat olla
koko kantaa korkeampia. Ja 41 %:lla ei ole kohdetyyppiä lainkaan, eli
heille koko jää yhä tuntemattomaksi.

*Tarkistettava erikseen:* Hilma-hankkeita on 294 (`cpv_code`,
`procurement_type_code` täytettyinä), mutta `estimated_cost` on
täytetty **yhdessä** niistä. Jos Hilman ilmoituksissa on arvokenttä,
se on suoraan poimimatta jäänyttä rakenteista dataa.

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
- **Kohdetyyppi puuttuu 2 092 hankkeelta (36 %).** Tilanne 1.9.2026
  luokittimen kytkennän ja takautuvan korjauksen jälkeen (D-159): tyyppi
  on 3 650:llä eli 64 %:lla, kun ennen työtä se oli 57 %:lla.
  Suodattimen arvolista lyheni 63 arvosta 35:een. Puuttuvat 2 092 ovat
  rivejä joilla **sääntö ei löydä tyyppiä otsikosta eivätkä mallin kaksi
  kutsua pääse yksimielisyyteen** — eli tyhjä on tässä tarkoituksellinen,
  ei unohdus. Niiden täyttäminen vaatii uuden todisteen (kuvausteksti,
  liite tai lähteen oma luokitus), ei uutta arvausta.

  **Avoinna kolme asiaa:**

  1. **Sanastosta puuttuu "Julkinen rakennus".** Kaupungintalo,
     kasarmi, vankila ja poliisiaseman kaltaiset kohteet eivät osu
     mihinkään 20:stä kanonisesta tyypistä, joten ne päätyvät joko
     Toimitilaan tai Kulttuurirakennukseen. Kaksi tiedossa olevaa
     huononnusta 1.9.2026 korjausajossa tulee juuri tästä:
     "Kaupungintalon saneeraus" siirtyi Toimitilasta
     Kulttuurirakennukseen ja "Poliisiammattikorkeakoulun asuntoloiden
     uudistaminen" Kerrostalosta Kouluun. Uusi tyyppi on sanastomuutos,
     joka koskee sekä sääntöä, mallin promptia että asiakkaan
     suodatinta — tehdään harkiten, ei ohimennen.
  2. **18 riviä on yhä sanaston ulkopuolella** (15 eri arvoa:
     "Julkinen rakennus" 6, "Tori", "Kylpylä", "Vankila", "koulu",
     "toimisto" …). Ne eivät osu asiakkaan suodattimeen. Sääntö ei
     tunnista niitä otsikosta eikä malli anna vastausta, joten ne
     odottavat joko kohtaa 1 tai käsin tehtyä päätöstä.
  3. **Mittari kannattaa toistaa** kun uusia hankkeita on kertynyt:
     `scripts/fix-building-type.ts --vaihe=b` vahvistaa tai korjaa
     mallin kirjoittamat arvot, ja sen tulos kertoo pysyykö kahden
     äänen portti tarkkana.
- **Osapuolet puuttuvat kokonaan 221 hankkeelta** joissa työ on käynnissä
  tai suunnitteilla (mitattu 15.8.2026). Asiakkaalle näkyvistä 2 136
  suunnittelu- tai rakentamisvaiheen hankkeesta 10 %:lta puuttuu **sekä
  rakennuttaja että pääurakoitsija** — eikä 219:llä ole edes
  `related_companies`-merkintää. Näistä **30 on rakentamisvaiheessa**, mikä
  on pahin tapaus: käynnissä oleva työmaa jolle ei ole ketään
  soitettavaa. Vertailuksi 1 510 hankkeella on toinen osapuoli ja 405:llä
  molemmat.

  Lähteittäin: **yva 94** (43 %), tuntematon lähde 45, discovery_agent 26,
  Espoon kuulutukset 14, rakennuslehti 11.

  *Tarkistettu YVA:n osalta:* poiminta ei ole rikki — 240 YVA-hankkeesta
  146:lla (61 %) rakennuttaja on. Puuttuvilla 94:llä hankevastaavan nimi
  **ei ole tallennetussa kuvaustekstissä** (osuma 1/94), joten korjaus
  vaatisi YVA-sivun uudelleenhaun. Kaikilla 94:llä on `source_url`
  tallessa, joten se on tehtävissä — mutta YVA-lähteellä ei ole
  rikastuskoukkua, joten se ei tule ilmaiseksi D-075:n työntekijän mukana.

  **Kolmen kohdan suunnitelma osapuolten täydentämiseen (15.8.2026),
  tässä järjestyksessä:**

  1. **Muokkausreitti hyväksytylle hankkeelle** (D-076) — tehty
     ensin, koska ilman sitä kaksi muuta tuottavat tietoa jota ei voi
     tallentaa eikä korjata.
  2. ~~**YVA-poimija.**~~ Tarkistettu 29.8.2026 (D-144): poimija on jo
     olemassa (`createYvaEnricher`) ja kattaa 259/273 hanketta. Puute on
     enää **14, ei 94** — ja niistä 11:llä rakennuttajaa ei ole
     YVA-sivulla lainkaan, ei kenttänä eikä leipätekstissä. Kolme
     löytynyttä päivitettiin. Alkuperäinen kirjaus: hankevastaava on
     nimettynä kenttänä ("Hankkeesta vastaava: Valoa Networks Oy") osiossa
     "Hankkeen yhteystiedot", ja samalla saisi yhteysviranomaisen,
     diaarinumeron ja YVA-aikataulun. **Deterministinen, ei LLM:ää** —
     sama ankkurointi kuin `createCompanyEnricher`issa. Arvio: yksi
     poimija ~80 riviä + 94 sivun kertahaku. Kattaa 43 % puutteesta.
  3. **Haku + LLM käsin lisätyille (46 kpl).** Näillä ei ole
     lähdetekstiä lainkaan — kuvaus tyhjä, ei lähdettä — joten
     poimittavaa ei ole ja tieto on haettava ulkopuolelta. Yksi
     verkkohaku antaa esim. Atrian tehtaalle rakennuttajan, 82,4 M€:n ja
     aikataulun. Kustannus on suuruusluokkaa **1–3 $ kertaluontoisesti**
     221 hankkeelle, eli raha ei ole este.

     *Este on oikeellisuus.* Väärä yritysnimi on asiakkaalle pahempi kuin
     tyhjä kenttä (D-057, D-072, D-073). Siksi tällaisen on kirjoitettava
     lähde-URL ja luottamustaso mukaan ja mentävä TIC:iin tarkistettavaksi
     — ei suoraan asiakkaalle. LLM ehdottaa, ihminen hyväksyy.
- Lähdelinkki puuttuu **650** hankkeelta (12 %). Oli 742; 124 palautettiin
  15.8.2026 `source_document_id`:n kautta
  (`scripts/backfill-from-stored-documents.ts`). **Loput eivät ole
  palautettavissa:** niillä ei ole dokumenttitunnusta, ilmoitusnumeroa
  eikä lupanumeroa. Ne ovat helmi–maaliskuun 2026 erä (286 + 200 kpl),
  joka tuotiin ennen lähdehistorian kirjaamista. Hyväksytty tappioksi —
  metsästäminen ei tuota mitään.
- **Kuvauksen lyhyys on osin lähteen ominaisuus, ei meidän vikamme.**
  Mitattu 15.8.2026: 1 571 lyhytkuvauksisesta 965:llä on lähteen
  `description`-kenttä tallessa, mutta **sen mediaanipituus on 135
  merkkiä** — kaavakuvaukset ovat lähteessä itsessään lyhyitä. Vain
  125:llä kenttä ylitti 200 merkkiä. Mittari mittaa siis osittain
  lähdeaineistoa, ei puutetta poiminnassa.

  **TARKENNUS 29.8.2026 (D-143):** tämä pitää paikkansa LISTAUSTASON
  kentistä, mutta ei kohdesivuista. Taivassalo (D-130) ja Pietarsaari
  (D-143) osoittivat että teksti on usein sivulla olemassa ja jää vain
  poimimatta — Pietarsaaressa 17 ehdokasta 19:stä sai 2–4-kertaisen
  kuvauksen. Lyhyt kuvaus kannattaa siis tarkistaa lähteestä ennen kuin
  se kirjataan lähteen viaksi.
- Kuvaus alle 200 merkkiä **1 571** hankkeella (29 %). Oli 1 803;
  yrityslähteiden jälkirikastus (15.8.2026) pudotti lukua 232:lla.

### Lähdekattavuus

- **Fingridin liityntähankkeet** — yksityisten suurhankkeiden katvealue.
  Microsoftin Kirkkonummen datakeskus osui meihin vain YVA:n kautta
  (ks. muistiinpano yksityisten rakennuttajien katvealueesta).
- **Hyvinkään viranhaltijapäätösten RSS-syöte** — kaupunki vahvisti
  30.8.2026 että viranhaltijapäätösten otsikot ovat omassa
  RSS-syötteessään (kokouspykälille syötettä ei ole). Se on ainoa
  myönteinen tieto koko lupakierroksesta, ja ensimmäinen otsikollinen
  kanava Tweb-kunnasta. Syötteen osoite on saatava **kysymällä, ei
  sivustoa selaamalla** — kirjallinen lupaus koskee yhä kaikkea muuta
  paitsi syötettä (D-098, D-149). Sen jälkeen mittaa kelpaako otsikkotaso
  hankkeen tunnistamiseen.

- **Oulun RSS-syötteen tulkinta jäi kysymättä** — Oulu kieltäytyi
  1.9.2026 (D-160) ja mainitsi ohimennen, että `asiakirjat.ouka.fi`:n
  julkaisusivulla on RSS-syöte. Kirje ei anna sille lupaa eikä kiellä
  sitä nimeltä, ja kirjeen lopetuslause kieltää hakemisen
  järjestelmästä. **Tulkitsemme sen kielloksi**: syötettä ei lueta.
  Kysymys jätettiin tietoisesti lähettämättä 1.9.2026 — vastaus
  kirjattiin, mutta kirjaamoon ei vastattu.

  Jos syöte joskus halutaan käyttöön, järjestys on: kysy lupa
  kirjallisesti (asianumero OUKA/10674/07.01.04.02/2026), ja vasta
  myönteisen vastauksen jälkeen lisää `sallittuSyote` Oulun riville
  `kielletytLahteet.ts`:ssä. Sama kaava kuin Hyvinkäällä. Ilman tätä
  askelta syötteen lukeminen rikkoisi kirjallisen lupauksemme.

- **Stara ja liikelaitokset** — voittajia jää poimimatta, Stara on aito
  kilpailija.
- ~~**Pornaisten arkisto-osio kerätään liideiksi**~~ Tehty 30.8.2026
  (D-150): arkistorivi tunnistetaan nyt osiosta eikä tekstistä, ja 21
  hanketta vanhennettiin. Muut kolme lähdettä tarkistettu
  samana päivänä (D-151): **Porvoo ja Tuusula eivät vuoda** — niiden
  suoja toimii eikä yhtään voimaan tullutta kaavaa ole päätynyt
  hankkeeksi. Seinäjoki (43 näkyvää) ja Oulu (17) vuotavat, mutta syy ei
  ole sivurakenne vaan järjestys: suoja nojaa detaljisivun hakuun, joka
  on budjetoitu, joten ehdokas syntyy ennen kuin tila tiedetään. Ne
  korjautuvat vanhentamissäännöllä, ei lähdekohtaisella muutoksella.

- ~~**Seinäjoen "Asemanseutu II-vaihe (01120)" puuttuu meiltä**~~
  **Väärä havainto, korjattu 30.8.2026 (D-153).** Sivu vastaa 404 eikä
  kaupungin oma haku löydä sitä — hakukoneen tulos oli vanhentunut.
  Kattavuus mitattiin samalla: kaupungin listalla 104 kaavaa, meillä 105
  dokumenttia, puuttuu 0. Kerääjässä ei ole vikaa.

- ~~**Vanha lainvoimainen kaava pois näkyvistä**~~ Tehty 30.8.2026
  (D-152): 41 hanketta vanhennettu, cron `expire-stale-zoning` 5:20.

- **Poistumispolku puuttuu rakentamisvaiheelta** — noin 2400 hanketta
  suunnittelu-, lupa- ja rakentamisvaiheissa jää listalle kunnes joku
  kertoo valmistumisesta. Kaavoitus sai polun 29.8.2026 (D-146,
  `docs/14_POISTUMISPOLUT.md`), nämä eivät.

- ~~**Voimaan tullut kaava jää vaiheeseen "Kaavoitus"**~~ Hoidettu
  29.–30.8.2026 (D-152): `advance-effective-zoning` ajaa vuorokausittain
  klo 5:15 ja `expire-stale-zoning` klo 5:20. **Tarkistettu 1.9.2026
  reitin omalla logiikalla: siirrettäviä 0** (73 voimaantulopäivällistä
  dokumenttia, 2 863 kaavoitusvaiheen hanketta). Rivi jäi tähän auki
  vaikka työ oli tehty.

- ~~**Samannimiset lohkot muissa kaavalähteissä**~~ Tarkistettu
  30.8.2026 (D-154): 143 listaussivua, kahdeksalla otsikko toistuu,
  **menetyksiä 0** — ainoa aito oli Pietarsaari ja se on korjattu.
  Tarkistus on skriptinä (`scripts/check-duplicate-blocks.ts`) ja sen
  voi ajaa uudelleen. Kolme sivua vastasi virheellä eikä niitä käyty
  läpi.

- **Ruotsinkieliset päätökset** — jäävät poimimatta.
- **RPT-lista:** Tampereen 9 kadonnutta ehdokasta, Turku ei aja,
  lupakirjeet kirjaamoissa.

- ~~**HOAS ja muut opiskelija-asuntosäätiöt lähteiksi**~~ — kartoitettu
  29.8.2026, ks. `docs/13_FOUNDATION_SOURCES.md`. 16/27 tarjoaa
  koneluettavan tiedotevirran, tuotto ~3–6 hanketiedotetta vuodessa
  toimijaa kohti. Ylioppilaskunnat kartoitettu erikseen ja hylätty.
  Toteutus odottaa täsmäytyksen ratkaisua (D-132).

  Alkuperäinen kirjaus 28.8.2026:

  Herätteenä hyväksytty hanke Rakennuslehdestä: HOAS rakentaa Helsinkiin
  402 uutta opiskelija-asuntoa, lähes 60 M€ investointi
  (`hoas.fi/2026/08/25/...`). Tieto tuli meille kiertotietä lehden
  kautta, vaikka rakennuttaja itse tiedotti sen.

  **Miksi tämä ryhmä on poikkeuksellisen hyvä:** säätiöt ovat
  rakennuttajia, eivät urakoitsijoita — ne tiedottavat hankkeesta kun
  investointipäätös on tehty, eli ennen urakkakilpailua. Ne ovat myös
  yleishyödyllisiä ja ARA-rahoitteisia, joten tiedottaminen on
  avointa ja säännöllistä. Yksi säätiö kattaa yhden kaupunkiseudun,
  joten kymmenkunta lähdettä kattaisi kaikki yliopistokaupungit.

  Tunnetut toimijat: HOAS (Helsingin seutu, `hoas.fi`), TOAS (Tampere),
  **TYS (Turun ylioppilaskyläsäätiö, `tys.fi`)**, KOAS (Jyväskylä),
  PSOAS (Oulu), POAS (Kuopio), LOAS (Lappeenranta), VOAS (Vaasa), DAS
  (Rovaniemi), Elli (Joensuu).

  **Mukaan myös ylioppilaskuntien omat säätiöt ja kiinteistöyhtiöt**,
  jotka ovat eri asia kuin asuntosäätiöt: ylioppilaskunnat omistavat
  merkittävää kiinteistövarallisuutta ja rakennuttavat myös muuta kuin
  asuntoja (HYY Yhtymä, TYY, TREY, OYY). Nämä eivät osu
  asuntosäätiöhakuun, joten ne on lueteltava erikseen.

  **Täydellinen lista on otettava SOA ry:n (Suomen opiskelija-asunnot)
  jäsenluettelosta** eikä muistista — sama periaate kuin RPT-listalla:
  puuttuvasta toimijasta päätellään puuttuva lähde.

  Työ alkaa `scripts/probe-design-firms.ts`-koettimella, joka lukee
  robots.txt:n ja etsii koneluettavan tiedotelistauksen. Sama seula
  kuin suunnittelutoimistoilla (`docs/12_DESIGN_FIRM_SOURCES.md`), ja
  sama mittari ratkaisee: montako **kesken olevaa** hanketta lähde
  tuottaisi.


### Poimintalogiikka

- **Rakennuttaja ingressistä** (D-066 auki). Vaatii genetiivin
  perusmuodon päättelyn: "Fingridin" → Fingrid, mutta "Skanskan" →
  Skanska. Ei yksikäsitteinen, joten sama varovaisuus kuin
  `allativeToNominative`-funktiossa.
- **Kuvaustäydennys irti nähty-ehdosta** (D-068, vaihtoehto D). Tarpeen
  vain jos lyhyitä kuvauksia alkaa kertyä.
- **LLM-duplikaattiskannaus harmaalle vyöhykkeelle** — mitattu 1.9.2026
  (D-158) ja tehtävä muutti muotoaan. Yläkaista (≥95 pistettä,
  kuvaustodiste) ratkesi **säännöllä**: 10 paria, kaikki aitoja, ei
  mallikutsua. Täysi skannaus toi 32 paria katselmoitavaksi.

  **LLM on perusteltu vasta kaistalle 70–78** (37 paria), jossa sääntö ei
  erota oikeaa väärästä. Tee se vasta kun nuo 32 on katselmoitu —
  katselmoinnin tulos kertoo onko uusi sääntö oikeassa.

### Operointi

- ~~**TARKISTA 16.–17.8.2026: purkautuuko `listed`-jono.**~~ Mitattu
  30.8.2026: `listed` = **0**, jono on purettu. `no_enricher` = 563, mikä
  on kohdan 2 odottama tila eikä virhe. Alkuperäinen kirjaus:
  Runkotyöntekijä
  (D-075, vaihe 2) ajastettiin 15.8. Kaksi asiaa katsottava ensimmäisen
  täyden discovery-kierroksen jälkeen:
  1. **Jonon kasvu vs. purku.** 49 legacy-lähdettä × sadat kandidaatit
     voi tuottaa ison erän kerralla, ja työntekijä purkaa 25 per ajo eli
     100/vrk. Jos `select count(*) from source_documents where status =
     'listed'` kasvaa nopeammin kuin purkautuu, `DEFAULT_LIMIT` on
     nostettava.
  2. **Kuntapäätöslähteet päätyvät `no_enricher`-tilaan**, koska niillä
     ei ole rikastuskoukkua. Se on odotettua eikä virhe — mutta jos ne
     eivät saa tuota tilaa, ne täyttävät jonoa turhaan.
- **Vasta sitten vaihe 3** (D-075:n valmistumisehto): poista haun
  puolelta `ENRICH_PER_RUN` ja `seenUrls`-ohitus sekä
  `scripts/backfill-company-enrichment.ts`. Ei ennen kuin jonon
  purkautuminen on nähty tuotannossa.

- **Täsmäytyslista maksaa 10,4 s joka legacy-ajossa.** Mitattu 31.8.2026
  Hartelan ajosta: haku 6,8 s, **täsmäytyslista 10,4 s**, kuvauspituudet
  3,1 s, ja loput per-kandidaatti-työtä (täydennys 138,7 s ja tuonti
  213,9 s kumulatiivisesti, 6 rinnakkain). `loadProjectsForMatching`
  lukee hankelistan joka ajolla, ja se **kasvaa hankemäärän mukana** —
  tänään 5 732 näkyvää hanketta.

  Se on 12 % 90 sekunnin budjetista ja ainoa osa joka kasvaa itsestään.
  Neljä lähdettä on jo katon rajassa: Hartela 81–92 s, Rovaniemi 88,9 s,
  Tampere 83,7 s, Skanska 73,3 s. Kaikkien ajojen mediaani on 5,6 s ja
  90. persentiili 34,7 s, joten ongelma koskee vain näitä muutamaa —
  toistaiseksi.

  **Mitattu vaihtoehto joka EI auta:** "lataa lista vain jos uusia
  kandidaatteja on" — vain 6 % onnistuneista ajoista tallentaa nolla
  kandidaattia. Oikea korjaus on rajata itse kyselyä (esim. sama kunta
  tai tuoreet hankkeet), ja se vaatii oman mittauksensa siitä mitä
  täsmäytys oikeasti tarvitsee.

- **Mittaa ajokesto** noston 14 → 20 jälkeen (Ajot-sivu). Oma raja 500 s,
  alustan kova katto 800 s.
- **Todenna STT ja Rakennuslehti** kun ne osuvat vuoroon — korjaukset on
  tehty mutta niitä ei ole vielä ajettu kertaakaan.
- ~~**`sync-account-lifecycle` ei ole cronissa.**~~ Tarkistettu
  30.8.2026: se on `vercel.json`:ssa aikataululla `0 3 * * *`.

### Asiakaskäyttöliittymä

- ~~**Miksi käyttäjä valitsee lähteet?**~~ Ratkaistu 29.8.2026 (D-135):
  valinta poistettiin, koska vastaus ei tallentunut mihinkään eikä lähde
  ole asiakkaan käsite. Alkuperäinen kirjaus:

  Onboardingin vaihe `StepSources` kysyy "Mistä lähteistä Tänään saa
  etsiä hankkeita?", ja valinta on aito suodatin: `matchesSources`
  rajaa Tänään-näkymää `getTodaySummary`ssä.

  **Epäilys on aiheellinen: lähde on meidän putkistoamme, ei asiakkaan
  käsite.** Urakoitsija välittää alueesta, vaiheesta ja kohdetyypistä —
  ei siitä tuliko liidi Hilmasta, kaavapäätöksestä vai rakennuttajan
  tiedotteesta. Valinta myös vanhenee itsestään: jokainen uusi lähde on
  sellainen jota vanha käyttäjä ei ole valinnut.

  Tyhjä valinta ei onneksi tyhjennä näkymää — `matchesSources`
  palauttaa `true` jos lista on tyhjä tai kaikki on valittu. Riski on
  siis osittaisessa valinnassa, joka kaventaa syötettä hiljaisesti.

  Ratkaisuvaihtoehdot kun palataan: (a) poistetaan valinta kokonaan,
  (b) jätetään mutta oletukseksi kaikki eikä kysytä onboardingissa,
  (c) korvataan käsitteellä joka on asiakkaalle merkityksellinen
  (esim. "vain vahvistetut hankkeet" vs. "myös aikaiset signaalit").

  Ennen päätöstä kannattaa mitata: kuinka moni käyttäjä on tosiasiassa
  rajannut lähteitä, ja kuinka paljon se kaventaa heidän syötettään.


- ~~**Omat muistiinpanot hankkeelle (`/crm`).**~~ Tehty 28.8.2026.
  Oma taulu `user_project_notes`, jotta teksti säilyy vaikka hanke
  poistetaan omista — omista poisto on oikea DELETE.
  DDL: `docs/sql/2026-08-28_user_project_notes.sql`.

- ~~**Maakuntavalikko monivalinnaksi (`/projects`).**~~ Tehty 28.8.2026
  (`c2f323e`). Sääntö "merkkijono tai lista" oli kopioituna kolmessa
  paikassa ja on nyt jaettu `lib/watchlists/filterValues.ts`:aan.

- ~~**Myyjänäkymä: oma tunnustaso ja rajattu käyttäjälista.**~~ Tehty
  29.8.2026 (D-134). Alkuperäinen kirjaus: Myyjä näkisi
  vain hänen hankkimansa asiakkaat ja heidän kirjautumisensa, jotta hän
  voi muistutella niitä jotka eivät ole ottaneet tuotetta käyttöön.

  Selvitetty 28.8.2026, ja **työ on suurempi kuin miltä se kuulostaa**:

  **Rooleja ei ole olemassa.** Admin-oikeus tulee ympäristömuuttujasta
  `ADMIN_EMAILS`, jota vasten verrataan sähköpostia kymmenessä eri
  reitissä (`is-admin`, `list-users`, `invite-user`, `lock-user`,
  `delete-user`, `analytics`, `send-broadcast`, `usage-alert`,
  `health-check`, `record-phase-change`). Kolmas taso ei mahdu tähän:
  ympäristömuuttuja ei voi kertoa *kenen* asiakkaita kukin myyjä sai.

  Siksi ensimmäinen osa on oikea roolimekanismi kannassa. Se on
  turvallisuusmuutos eikä käyttöliittymämuutos, ja sen on syytä olla
  hallittu: RLS ratkaisee mitä myyjä näkee, ei käyttöliittymä.

  Osat:
  1. **Rooli kantaan** — käsin ajettava DDL + RLS. Nykyinen
     `ADMIN_EMAILS` on syytä säilyttää rinnalla varmistuksena, ettei
     admin lukitse itseään ulos.
  2. **Asiakkaan liittäminen myyjään** — admin-näkymään kenttä jolla
     käyttäjälle merkitään hankkinut myyjä.
  3. **Rajattu Käyttäjät-näkymä** — sama sivu kuin adminilla mutta vain
     omat asiakkaat, ja **ilman** kutsu-, lukitus- ja poistotoimintoja.
  4. **Valikko roolin mukaan.**

  Data on jo olemassa: `list-users` palauttaa `created_at` ja
  `last_sign_in_at`, eli "kuka ei ole kirjautunut" saadaan suoraan.

  **HUOM — trial-tilaa ei kerätä.** Myyjän varsinainen tarve on
  muistutella trial-asiakkaita, mutta järjestelmä ei tiedä kuka on
  trialilla: tilaustietoa ei tallenneta lainkaan. Ilman sitä myyjä näkee
  vain "ei ole kirjautunut", ei "trial päättyy pian". Tämä on päätettävä
  ennen toteutusta: joko myyjänäkymä rajoittuu kirjautumistietoon, tai
  tilaustieto aletaan kirjata.



## Tietoisesti taakse / ei nyt

- **Lisää discovery-lähteitä** ilman asiakaskerroksen kehitystä — laskeva tuotto,
  kasvattaa vain suodattamatonta listaa.
- **Tontinluovutukset** — ei siistiä lähdettä, kohiseva päätösdata (ks. D-012).
- Kriteeri uudelle lähteelle säilyy: korkea signaali/kohina + aikaisempi vaihe
  kuin nykylähteet (D-011) — ei volyymi volyymin vuoksi.

## Kehitysrytmi (blueprint §16)

design → päivitä docs tarvittaessa → toteuta → testaa → commit → deploy.
`docs/` on projektin virallinen muisti.
