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

Kolme mitattua puutetta, tärkeysjärjestyksessä:

**1. Puolet käyttäjistä on roolissa "Muu", jolla ei ole painoja
lainkaan.** 26:sta rooli on valittu kaikilla, mutta jakauma on: Muu 13,
Infra 6, Rakennustuotteet 4, Kiinteistönomistaja 1, Talotekniikka 1,
Rakennusliike 1. Matriisissa `Muu: {}` eli tyhjä — **puolet
käyttäjistä ei siis saa roolipisteytystä ollenkaan**, vaikka koko
kerros on rakennettu. Tämä on P1:n suurin yksittäinen vipuvarsi: joko
kattavammat roolivaihtoehdot, roolin päättely toimialasta, tai
oletuspainot "Muu"-roolille.

**2. Vaihesanasto on epäyhtenäinen.** "Suunnittelussa" 1 271 vs
"Suunnittelu" 212, "Rakentaminen aloitettu" 395 vs "Rakenteilla" 264.
Pisteytys nojaa vaiheeseen, joten kahdella nimellä oleva sama vaihe
vääristää painotusta suoraan. Halpa korjata (ks. Työjono).

**3. Palautetta on 2 kappaletta.** Vaihe 4 (palauteoppiminen) ei voi
olla riippuvuus millekään muulle — pisteytyksen on toimittava
deterministisesti, ja oppiminen on myöhempi lisä.

**Rajaus:** vain alue ja vaihe ovat lähes täydellisiä kenttiä,
kohdetyyppi kohtuullinen. Kokoon tai osapuoliin nojaava painotus jäisi
59–96 %:lla hankkeista laskematta (ks. *Mitattu tilanne*).

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

- **Vaihesanasto on epäyhtenäinen.** "Suunnittelussa" 1 271 vs
  "Suunnittelu" 212, "Rakentaminen aloitettu" 395 vs "Rakenteilla" 264 —
  samoja vaiheita kahdella nimellä. Sama vika kuin kohdetyypeissä ennen
  yhtenäistystä (198 arvoa → 20, ks. D-059). **Vaihe on asiakkaan
  tärkein suodatin ja P1:n keskeisin ulottuvuus**, joten tämä kannattaa
  korjata ennen pisteytystä.
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
