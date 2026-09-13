# Työmäärä ja rahallinen arvio

Elävä dokumentti. Kirjaa toteutuneen kehitystyön laajuuden ja siitä johdetun
arvion Työmaat.fi:n nykyarvosta perusteluineen. Päivitetään aika ajoin — uusi
rivi mittaritaulukkoon ja arviotaulukkoon, vanhoja rivejä ei poisteta, jotta
kehityskaari säilyy.

**Tämä ei ole talousneuvontaa eikä virallinen arvonmääritys.** Se on
ohjelmiston omaisuuserän tekninen arvio, jonka tarkoitus on antaa suuruusluokka
ja seurata sen kehittymistä.

---

## Menetelmä — kolme näkökulmaa

Arvo lasketaan kolmesta suunnasta, koska mikään yksittäinen luku ei kerro sitä:

1. **Rakennuskustannus** — mitä vastaavan koodin ja lähdeverkoston teettäminen
   ulkopuolisella maksaisi. Kertoo tehdyn työn korvausarvon, ei markkina-arvoa.
2. **Realistinen kauppahinta nyt** — mitä tästä maksettaisiin sellaisenaan, jos
   liikevaihtoa ei ole tai sitä ei voi todentaa. Esitulovaiheen tuotteet
   vaihtavat omistajaa murto-osalla rakennuskustannuksestaan.
3. **Liikevaihtopohjainen arvo (ARR-kerroin)** — vasta maksavat asiakkaat
   tekevät arvosta kestävän. Varhaisvaiheessa tyypillinen kerroin on ~2–4×
   vuotuinen toistuva liikevaihto (ARR).

### Ratkaiseva puuttuva luku

Arvo ratkeaa lopulta liikevaihdolla, mutta **laskutus hoidetaan käsin eikä
tilaus- tai kokeilutilaa kerätä järjestelmään** (ks. [10_USERS.md](10_USERS.md)
ja `lib/users/trial.ts`). Siksi tämä dokumentti antaa suuruusluokan
rakennuskustannuksen kautta ja havainnollistaa liikevaihtoarvon skenaarioina.
Todellisella asiakasmäärällä ja kuukausihinnalla saa tarkan luvun ARR-kertoimella.

### Strateginen ydin

Arvokkain omaisuus ei ole koodi vaan **kasvava tietokanta ja suomalaisten
rakennusalan lähteiden keräinverkosto** (49 räätälöityä keräintä, ks.
[01_ARCHITECTURE.md](01_ARCHITECTURE.md) ja lähdedokumentit 07/09/12/13). Se on
työläs kopioida ja se on kilpailuetu — mutta realisoituu vain asiakkaiden kautta.

---

## Mittarit ajassa

| Päivä | Committeja | Koodirivejä (oma) | Tiedostoja | Lähdekeräimiä | API-reittejä | Vaihe |
|---|---|---|---|---|---|---|
| ~2026-07 | 464 | ~15 000 | 734 | ~47 | 34 | Tekninen MVP, ei monetisaatiota |
| 2026-08-29 | 995 | ~38 000 | 951 | ~45 | 44 | Kokeilujakso + myyjäroolit → alkava vetovoima |
| 2026-09-13 | 1088 | ~46 000 | 1028 | 49 | 50 | Datavallihaudan syventäminen |

Ensimmäinen commit 2026-02-19 → ~6,8 kk lähes päivittäistä yhden hengen
kehitystä (1088 committia). Rivit = `app src lib hooks types`, `.ts`/`.tsx`,
ilman `node_modules`, `.next` ja `.claude`-worktreejä.

### Kehitystahti (mitattu 2026-09-13)

- **206 kalenteripäivää**, joista **94 aktiivista committipäivää** (~46 %:na
  päivistä syntyi koodia) → työ on purskeista, ei tasaisen päivittäistä.
- **~11,6 committia / aktiivinen päivä** — tiheä rytmi silloin kun tehdään.
- **~5,3 committia / kalenteripäivä** koko kaaren keskiarvona.
- Viime 30 pv **308 committia** (~10/pv) → tahti on kiihtynyt, ei hiipunut
  ~7 kk jälkeenkään.

Tulkinta: yhtäjaksoinen, tiivis yhden hengen tahti ilman notkahdusta läpi
projektin. Tämä on rakennuskustannusarvion (~900–1500 h) käytännön peruste ja
vertailukohta, johon tulevaa tahtia peilataan.

### Mitä työhön sisältyy asiakaskoodin lisäksi

Rakennuskustannus ei ole pelkkää asiakasnäkymää: mukana on kokonainen
**ylläpitopuoli ja käyttäjäanalytiikka** (~24 admin-reittiä, dashboard, roolit,
tilin elinkaari sekä GA-tyylinen käyttöseuranta tuloksineen), joka on kuvattu
omassa dokumentissaan [16_ADMIN_JA_ANALYTIIKKA.md](16_ADMIN_JA_ANALYTIIKKA.md).
Analytiikka antaa myös ainoan sisäisen signaalin todellisesta käytöstä, kun
liikevaihtoa ei mitata järjestelmässä.

---

## Arvio ajassa

| Päivä | Rakennuskustannus | Kauppahinta nyt (jos ~ei todennettua liikevaihtoa) |
|---|---|---|
| ~2026-07 | 40–110 k € | 2–15 k € |
| 2026-08-29 | 90–180 k € | 10–40 k € |
| 2026-09-13 | 110–200 k € | 15–45 k € |

**Rakennuskustannuksen peruste (13.9.2026):** ~46 k riviä testattua ja
dokumentoitua TypeScriptiä, 49 räätälöityä scraperia, discovery-/agenttiputki,
LLM-pohjainen duplikaattien tunnistus (kahden äänen portti), auth + RLS, CRM ja
TIC-hallintakeskus. Arvioitu työmäärä ~900–1500 h. Toimisto-/senioritaso
Suomessa ~70–110 €/h → ~110–200 k €.

**Kauppahinnan peruste:** esitulovaiheen SaaS-MVP:t ilman todennettua
liikevaihtoa myydään tyypillisesti murto-osalla rakennuskustannuksesta; koodi
yksin ei tuo lähelle korvausarvoaan.

### Liikevaihtoskenaariot (havainnollistus, ~2–4× ARR)

| Asiakkaita | Hinta/kk | ARR | Arvo (2–4×) |
|---|---|---|---|
| 10 | 200 € | 24 k € | 50–100 k € |
| 25 | 250 € | 75 k € | 150–300 k € |
| 50 | 300 € | 180 k € | 350–700 k € |

Nämä ovat esimerkkejä, eivät toteumaa. Kun todellinen asiakasmäärä ja
kuukausihinta ovat tiedossa, korvaa rivi oikeilla luvuilla.

---

## Reunaehdot ja oletukset

- Yksin ilman ulkopuolista rahoitusta; keveys on tietoinen kilpailuetu. Arvio ei
  oleta tiimiä, rahoitusta eikä kasvupakkoa.
- Arvioon eivät sisälly erikseen: domain, tietokannan kertynyt sisältö
  omaisuutena, mahdollinen tavaramerkki eivätkä ajossa olevat kulut
  (Vercel/Supabase/API:t). Nämä on hinnoiteltava erikseen kaupan yhteydessä.
- Luvut ovat suuruusluokkia, eivät tarjous- tai kirjanpitoarvoja.

---

## Päivityshistoria

- **2026-09-13** — Dokumentti luotu. Kirjattu heinäkuun, elokuun lopun ja
  syyskuun mittarit ja arviot. 29.8.→13.9. työ oli datavallihaudan syventämistä
  (uudet lähdekatalogit, kenttäpoiminta, karttageokoodaus, Health-valvonta),
  ei monetisaatioharppaus; arvo ajautui hieman ylös samassa vaiheessa.
