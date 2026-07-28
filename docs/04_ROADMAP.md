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
| **Personoitu mahdollisuuspisteytys (Stage 2→3)** | 🔴 Puuttuu | `opportunity_score` / `overall_priority` / `customer_interest` = 0 tiedostoa. Yritysprofiili on passiivinen leima, ei aktiivinen matchays. |

**Ydinhavainto:** Blueprintin ydinlupaus — *"näytä oikea mahdollisuus oikealle
asiakkaalle oikeaan aikaan"* (§13, §15, §18) ja personoitu opportunity-pisteytys
(Milestone 5) — ei ole vielä rakennettu. Discovery tuottaa raakasignaaleja
enemmän kuin asiakaskerros osaa jalostaa.

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

## P2 — Elinkaari-laukaistut hälytykset: "oikea aika"

**Tavoite.** Ilmoita kun asiakkaan kiinnostava hanke *etenee hänen
vaiheeseensa* — materiaalitoimittajalle pingi kun rakentaminen alkaa,
urakoitsijalle kun kilpailutus aukeaa.

**Rakentuu olemassa olevan päälle.** Palaset ovat jo: lifecycle-moottori,
`/watchlists` (hakuvahdit), digest-järjestelmä (`app/api/digests`). Kytke ne
**tapahtumapohjaisiksi** ilmoituksiksi jaksottaisen digestin sijaan:
lifecycle-vaiheen muutos + asiakkaan P1-relevanssi → laukaisu.

**Riippuvuus:** hyötyy P1:n relevanssipisteytyksestä (kenelle laukaistaan).

**Tila (2026-07-28):** 🟡 Rakennettu, cron ei vielä päällä. Endpoint
`app/api/opportunity-alerts` laukaisee kun hanke etenee roolin huippuvaiheeseen
(paino 1.0), alue-suodatus huomioiden. Opt-out `settings.opportunityAlerts`
(oletus päällä, edellyttää roolia). Dedup taulu `opportunity_alerts`
(docs/sql/2026-07-28_opportunity_alerts.sql). `?dry=1` esikatselee lähettämättä.
**Seuraava:** aja SQL + dry-run, sen jälkeen lisää Vercel-cron (kerran/vrk).

## P3 — TIC "mitä minun pitäisi tehdä tänään" (operaattori)

**Tavoite.** TIC päätös-edellä (§14): "5 signaalia odottaa päätöstäsi, 2 korkean
prioriteetin hanketta löytyi, 3 lähdettä kaatui, 12 ehdokasta valmiina
tarkistukseen." Listat toissijaisia, päätökset ensisijaisia.

**Tila:** osin olemassa (TIC-näkymät, discovery health, runs). Työ = koota
päivän toimenpiteet yhdeksi päätösnäkymäksi.

## P4 — Proaktiivinen markkinatieto / trendit

**Tavoite.** "Datakeskukset saavat huomiota", alue kuumenee, perutut/tauolla
olevat hankkeet arvokkaana signaalina (§12). Nice-to-have, kun P1–P2 tuottavat
jo käyttäjädataa jonka päälle trendit lasketaan.

---

## Tietoisesti taakse / ei nyt

- **Lisää discovery-lähteitä** ilman asiakaskerroksen kehitystä — laskeva tuotto,
  kasvattaa vain suodattamatonta listaa.
- **Tontinluovutukset** — ei siistiä lähdettä, kohiseva päätösdata (ks. D-012).
- Kriteeri uudelle lähteelle säilyy: korkea signaali/kohina + aikaisempi vaihe
  kuin nykylähteet (D-011) — ei volyymi volyymin vuoksi.

## Kehitysrytmi (blueprint §16)

design → päivitä docs tarvittaessa → toteuta → testaa → commit → deploy.
`docs/` on projektin virallinen muisti.
