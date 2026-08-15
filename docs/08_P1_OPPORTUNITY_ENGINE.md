# P1 – Opportunity Engine (per-asiakas relevanssipisteytys)

Roadmapin ([`04_ROADMAP.md`](04_ROADMAP.md)) prioriteetin P1 tarkka speksi.
Tavoite: jokainen hanke saa asiakaskohtaisen **0–100 relevanssipisteen +
ihmisluettavan selityksen**, ja **rooli ohjaa pisteytystä automaattisesti**.

Tämä on **evoluutio** olemassa olevasta `todayRanking`-moottorista, ei
uudelleenkirjoitus.

---

## 0. Lähtökohta: mitä on jo, mitä puuttuu

P1 on jo ~40 % rakennettu.

| Palanen | Tila | Sijainti |
|---|---|---|
| Per-käyttäjä asetukset (rooli, alueet, myyntihetket, lähteet, max) | 🟢 On | taulu `user_today_preferences`, `getTodaySettings.ts` |
| Pisteytysmoottori (business_value + tuoreus + lähde + myyntihetki + palaute) | 🟢 On | `todayRanking.ts` → `calculateTodayScore` |
| Palauteoppiminen (peukku → affiniteetti per attribuutti) | 🟢 On | taulu `project_feedback`, `getUserFeedbackContext.ts` |
| Kanoninen vaihemalli (idea→…→completed) | 🟢 On | `lib/projects/phases.ts` |
| **Rooli ohjaa pisteytystä** | 🔴 Puuttuu | `companyProfile` kerätään, mutta `calculateTodayScore` ei lue sitä |
| **Selitys "miksi tämä sopii sinulle"** | 🔴 Puuttuu | pisteet ovat paljas luku |
| **Rakenteinen vaihe pisteytyksessä** | 🔴 Puuttuu | nyt `text.includes("hilma")` -sumeaa, ei `PhaseKey` |
| **0–100 normalisointi + tallennettu score** | 🔴 Puuttuu | `today_score` on rajaton summa, ei persistoitu |

**Ydinaukko:** rooli on inertti. Käyttäjä valitsee myyntihetket käsin, vaikka
idea on että rooli johtaa relevantin vaiheen automaattisesti.

## 1. Scope

**In scope:** rooli→vaihe-matchays, vaiheen kanonisointi pisteytykseen,
selityskerros, pisteytyksen refaktorointi moduuleiksi joilla on `reason`,
UI-muutokset /today-kortille ja asetuksiin.

**Out of scope (myöhemmät P:t):** tapahtumapohjaiset hälytykset (P2), trendit
(P4), LLM-pohjainen matchays (voi tulla V3+ fail-open-lisänä).

## 2. Ydinidea: rooli → elinkaaren vaihe (relevanssimatriisi)

Kunkin roolin myyntihetki johdetaan `PhaseKey`-vaiheista painoilla (huippuvaihe =
täysi, viereiset = osittainen):

| Rooli | Relevantit vaiheet (paino) |
|---|---|
| **Arkkitehti** | idea (1.0), zoning (1.0), planning (0.8) |
| **Kiinteistönomistaja** | idea (1.0), zoning (0.8), planning (0.6) |
| **Rakennesuunnittelu** | planning (1.0), permit (0.8) |
| **Rakennusliike** (pääurakoitsija) | tender (1.0), permit (0.6), contract_awarded (0.4) |
| **Infra** | zoning (0.4), tender (1.0), construction (0.7) |
| **Sähköurakoitsija** | contract_awarded (1.0), tender (0.7), construction (0.6) |
| **Talotekniikka** | contract_awarded (1.0), tender (0.7), construction (0.6) |
| **Rakennustuotteet** (materiaalit) | contract_awarded (0.8), construction (1.0), nearing_completion (0.5) |
| **Muu** | ei vaihepainotusta (neutraali) |

Logiikka: mitä myöhempi rooli arvoketjussa, sitä myöhempi vaihe — arkkitehti
kaavassa, materiaalitoimittaja rakentamisessa. Matriisi on **yksi tarkistettava
taulukko** (`lib/opportunity/roleStageMatrix.ts`), ei hajautettua logiikkaa.

## 3. Tietomalli (muutokset minimissään)

- **`user_today_preferences`** — käytä sellaisenaan. Rooli (`companyProfile`)
  nostetaan ensisijaiseksi. `bestSalesMoments` säilyy **override**ina (käyttäjän
  valinta voittaa roolin oletuksen). Uusi valinnainen `keywords text[]` myöhemmin
  (V3).
- **Ei uutta pakollista saraketta hankkeille.** Vaihe ratkaistaan ajonaikaisesti
  (`projectPhaseKey()`), kuten `today_score` nyt. Persistoidaan vasta kun P2
  vaatii (V4).
- **`project_feedback`** — säilyy oppimissilmukkana sellaisenaan.

## 4. Pisteytys refaktoroituna (moduulit + selitys)

`calculateTodayScore` → nimetyt moduulit jotka palauttavat `{ points, reason? }`:

```ts
type ScoreModule = (ctx: OpportunityContext) => { points: number; reason?: string }
// ctx: { project, phaseKey, settings, feedback }
```

| Moduuli | Tila | Selitysesimerkki |
|---|---|---|
| `roleStageFit` ⭐ | UUSI | "Rakenteilla — sopii materiaalitoimittajalle" |
| `businessValue` | on | "Suuri hanke (datakeskus)" |
| `freshness` | on | "Uusi tänään" |
| `feedbackAffinity` | on (per-käyttäjä) | "Muistuttaa hankkeita joista pidit" |
| `tradeKeywordFit` | ✅ V3 | "sähkö, valaistus mainittu" |
| `sourceQuality` | on | — (sisäinen) |

Summa → **normalisoi 0–100** (jaa teoreettisella maksimilla, clamp). Palauta
`{ score, breakdown: {module, points, reason}[] }`.

## 5. Selityskerros

Kortilla näytetään **match-% + top 2–3 `reason`ia** (suurimman kontribuution
mukaan). Toteuttaa arkkitehtuuriperiaatteen "explain every decision" ja on suurin
luottamus/UX-parannus. Peukut säilyvät (ruokkivat `feedbackAffinity`ä).

## 6. Vaiheen kanonisointi

Uusi `projectPhaseKey(project): PhaseKey | null` — **yksi totuuslähde**, joka
korvaa sumean `projectPhaseText().includes()` -logiikan pisteytyksessä. Rakentuu
`normalizeLegacyPhase()`-funktion päälle + nykyiset tekstiheuristiikat
fallbackina. `todayFilters.ts`:n myyntihetki-suodatus voi käyttää samaa.

## 7. UI-muutokset

- **/today-kortti:** match-% + top-syyt; peukut ennallaan.
- **Asetukset:** rooli ensisijaiseksi; "myyntihetki" muuttuu lisäasetukseksi
  (oletus johdetaan roolista: "Johdettu roolistasi: Rakenteilla, Sopimus
  myönnetty" + mahdollisuus ohittaa). Valinnainen avainsanakenttä (V3).
- **Tyhjä/matala tila:** jos osumia vähän, ehdota alueen/roolin laajentamista.

## 8. Vaiheistus (jokainen erikseen deployattava)

| Versio | Sisältö | Arvo / riski | Tila |
|---|---|---|---|
| **V1** ⭐ | `projectPhaseKey()` + `roleStageFit` + moduulien `reason`-breakdown + selitys kortilla | Suurin arvo, ei skeemamuutosta | ✅ Tehty |
| **V2** | Rooli johtaa myyntihetki-oletukset; asetusten UX; 0–100 normalisointi näkyviin | Keskisuuri | ✅ Tehty |
| **V3** | Avainsana/toimiala-matchays (`tradeKeywordFit` + `keywords` asetuksissa) | Tarkkuus | ✅ Tehty |
| **V4** | Persistoi `opportunity_score` per (käyttäjä, hanke) → pohja P2-hälytyksille + analytiikka | Avaa P2:n | ✅ Tehty |

**V4-huom:** taulu `opportunity_scores` (user × hanke), kirjoitetaan
kysyntähetkellä /today-latauksessa (`lib/opportunity/persistScores.ts`),
best-effort (ei kaada näkymää). DDL: `docs/sql/2026-07-28_opportunity_scores.sql`.

**V3-huom:** `keywords` talletetaan `user_today_preferences.settings`-JSON-blobiin
(ei erillistä `text[]`-saraketta) — ei skeemamuutosta. Lyhyet avainsanat (< 4 mkt)
matchataan sananrajalla, pitkät alimerkkijonona (suomen taivutus eduksi).

## 9. Mittarit

Peukku-ylös-osuus /today-syötteessä ↑; avatut/näytetyt ↑. Analytiikka
(`analytics/track`) on jo olemassa.

⚠️ **"Avatut / näytetyt" ei ole laskettavissa** (todettu 15.8.2026):
`analytics_events` kirjaa `project_open`-tapahtumat (191 kpl, 25 tiliä,
kaikissa `project_id`), mutta **näyttökertoja ei kirjata lainkaan**.
Osoittaja on, nimittäjää ei. Mittari on ollut tässä dokumentissa alusta
asti, mutta sitä ei ole koskaan voitu lukea.

## 9b. Palauteoppiminen: nykyinen toimintalogiikka

Kirjattu 15.8.2026, koska mekanismi ei ollut dokumentoituna missään.
Kyse ei ole koneoppimisesta vaan **laskurista**:

1. **Peukku tallentaa hankkeen ominaisuudet mukaansa.**
   `TodayFeedbackButtons` kirjoittaa `project_feedback`-riville
   `rating`in lisäksi hankkeen attribuutit (`region`, `business_value`,
   `construction_type`, `building_type`, `size_class`, `source_name`).
   Tämä on tarkoituksellista: palaute säilyy tulkittavana vaikka hanke
   myöhemmin muuttuisi tai vaihe etenisi.
2. **Affiniteetti per attribuutti.** `getUserFeedbackContext` summaa
   käyttäjän rivit (ylös +1, alas −1) attribuuttiarvoittain →
   `affinity["region"]["Pirkanmaa"] = +2`.
3. **Pisteytys lukee summan.** `feedbackAffinity` käy uuden hankkeen
   kuusi attribuuttia, kertoo netto­summan viidellä, rajaa ±30.
   Perustelu: *"Muistuttaa hankkeita joista pidit"*.

Lisäksi peukku alas **piilottaa hankkeen kokonaan**
(`downvotedProjectIds`) — paljon jyrkempi mekanismi kuin pisteiden
vähennys, ja riskialtis näin ohuella datalla.

**Syykategoriat kerätään mutta ovat käyttämättä.** `reason_category`
(*"Liian pieni hanke"*, *"Väärä alue"*, *"Ei kiinnosta"*) ja
`reason_text` tallentuvat, mutta pisteytys ei lue niitä. Oppiminen on
myös tiukasti per käyttäjä — kukaan ei hyödy toisen palautteesta.

⚠️ **`size_class` on kuollut attribuutti silmukassa.** Se on
`AFFINITY_ATTRIBUTES`-listalla ja peukkulomake lähettää sen, mutta
mitattuna 15.8.2026 kenttä on `"unknown"` 64 %:lla ja puuttuu
36 %:lta — **aito arvo on 0 hankkeella 5 481:stä**. Siksi syy *"Liian
pieni hanke"* ei ole toimeenpantavissa, vaikka pisteytys lukisikin
syykategoriat. Käytettävissä olevat kokosignaalit ja mitatut
kattavuudet: [`04_ROADMAP.md`](04_ROADMAP.md) kohta 3¾.

### Mitattu signaalitilanne 15.8.2026

| signaali | kpl | tilejä |
|---|---|---|
| 👍👎 peukut | **1** (2 riviä, joista 1 testitili) | 1 |
| `project_open` | 191 | 25 |
| suosikit (`user_project_favorites`) | 84 | 10 |
| tilamuutos (`user_project_status`) | 59 | 7 |

Tilamuutosten sisältö: contacted 27, offer_sent 12, lost 8, new 6,
**won 6**.

**Johtopäätös: peukku on kuollut mittari, mutta palautedataa on ~330
tapahtumaa 25 tilillä.** Ja won/lost ei ole relevanssin *korvike* vaan
relevanssi itse — käyttäjä kertoi että hanke muuttui rahaksi. Oppimisen
lähde voidaan vaihtaa koskematta `feedbackAffinity`-moduuliin, koska
`getUserFeedbackContext` tuottaa jo oikean muotoisen
`affinity[attribuutti][arvo]`-kartan.

**Kaksi varausta ennen kuin avauksista opitaan:**
- **Järjestysvinouma.** Käyttäjä avaa mitä näytämme ylimpänä, joten
  avauksista oppiminen vahvistaa nykyistä järjestystä riippumatta siitä
  onko se oikea — itseään ruokkiva silmukka, ei oppimista.
- **Vinoumaa ei voi korjata ilman näyttökertoja** (ks. §9). Siksi
  näyttökertojen kirjaaminen (mitkä hankkeet, missä järjestyksessä,
  millä pisteellä) on edellytys sekä mittarille että oppimiselle.
  Suosikit ja won/lost kelpaavat sellaisenaan, koska järjestysvinouma
  vaikuttaa niihin vähemmän.

## 10. Periaatteet & riskit

- **Deterministinen ensin, fail-open** (D-006): V1–V3 sääntöpohjaista; LLM vasta
  myöhemmin lisäkerroksena.
- **Cold-start:** ilman palautetta rooli + business_value kantavat pisteytyksen
  — toimii ensimmäisestä käytöstä.
- **Riski — matriisi on mielipiteellinen:** siksi yksi tarkistettava taulukko
  (§2), helppo säätää.
- **Riski — vaiheen tunnistus epätarkka:** `projectPhaseKey` fallbackaa tekstiin;
  tuntematon vaihe ei rankaise (neutraali), ei putoa pois.
