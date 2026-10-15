# Työmäärä ja rahallinen arvio

Elävä dokumentti. Kirjaa toteutuneen kehitystyön laajuuden ja siitä johdetun
arvion Tyomaat.fi:n nykyarvosta perusteluineen. Päivitetään aika ajoin — uusi
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
| 2026-10-16 | 1318 | ~60 800 | 1172 | 59 | 57 | **Ensimmäiset maksavat asiakkaat + go-to-market käyntiin** |

Ensimmäinen commit 2026-02-19 → ~8 kk lähes päivittäistä yhden hengen
kehitystä (1318 committia, 119 aktiivista committipäivää / 239 kalenteripäivää,
viime 30 pv 226 committia). Rivit = `app src lib hooks types`, `.ts`/`.tsx`,
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
| 2026-10-16 | 140–260 k € | 40–120 k € (ei enää esitulovaiheessa) |

**Rakennuskustannuksen peruste (13.9.2026):** ~46 k riviä testattua ja
dokumentoitua TypeScriptiä, 49 räätälöityä scraperia, discovery-/agenttiputki,
LLM-pohjainen duplikaattien tunnistus (kahden äänen portti), auth + RLS, CRM ja
TIC-hallintakeskus. Arvioitu työmäärä ~900–1500 h. Toimisto-/senioritaso
Suomessa ~70–110 €/h → ~110–200 k €.

**Kauppahinnan peruste:** esitulovaiheen SaaS-MVP:t ilman todennettua
liikevaihtoa myydään tyypillisesti murto-osalla rakennuskustannuksesta; koodi
yksin ei tuo lähelle korvausarvoaan.

**Tarkennus (16.10.2026) — ARR-kerroin vs. kauppahinta:** todennettu ARR on
2 976 €. Pelkkä 2–4× kerroin antaisi ~6–12 k € — se on **lattia ja aliarvioi
rajusti**, koska se jättää huomiotta sen mistä arvo tässä vaiheessa muodostuu:
~60 k rivin tuote + 59 keräintä (datavallihauta), 61 trial-asiakkaan lämmin
suppilo, kasvava käyttö (62 aktiivista / 90 vrk, 12 min istunto) ja strateginen
kiinnostavuus (Metroc-pariteetti somessa, Rakennuslehti-kumppanuus vireillä).
Siksi kauppahinta-arvio 40–120 k € on **strategisen/polkuarvon** haarukka, ei
ARR-kerroin: puhdas finanssiostaja maksaisi lähempänä lattiaa, strateginen
ostaja tai jakelukumppani ylempää. Haarukka kapenee heti kun konversio
(trial → maksava) ja churn näkyvät luvuissa.

### Liikevaihtoskenaariot (havainnollistus, ~2–4× ARR)

| Asiakkaita | Hinta/kk | ARR | Arvo (2–4×) |
|---|---|---|---|
| 10 | 200 € | 24 k € | 50–100 k € |
| 25 | 250 € | 75 k € | 150–300 k € |
| 50 | 300 € | 180 k € | 350–700 k € |

Nämä ovat esimerkkejä, eivät toteumaa. Kun todellinen asiakasmäärä ja
kuukausihinta ovat tiedossa, korvaa rivi oikeilla luvuilla.

---

## Vetovoima ja go-to-market (kirjattu 2026-10-16)

Tämä on arvion suurin yksittäinen käänne: tuote siirtyi todistetusti
maksulliseksi. Pelkkä ARR-kerroin aliarvioi tilanteen vielä, koska
liikevaihto on pieni mutta **suunta ja riskin pieneneminen** ovat nyt se mitä
arvioidaan.

- **2 maksavaa asiakasta, MRR 248 € / ARR 2 976 €** (käsin laskutettuna, ks.
  [[customer-billing]]; ~124 €/asiakas/kk = matala hintapiste). Loppuvuodelle
  tulossa **3–5 lisää** → vuodenvaihteessa realistisesti 5–7 maksavaa.
- **Lämmin suppilo: 61 trial-asiakasta** (87 asiakasta / 115 tunnusta).
  Järjestelmän laskema **potentiaalinen ARR 112 044 €** = jos kaikki trialit
  maksaisivat — se on katto, ei ennuste, mutta kertoo suppilon koon.
- **Käyttö kasvaa:** 90 vrk aktiivisia käyttäjiä 62, istuntoja 524,
  sivulatauksia 8 676, istunnon keskikesto 12 min (sitoutuminen pitää, ks.
  [16_ADMIN_JA_ANALYTIIKKA.md](16_ADMIN_JA_ANALYTIIKKA.md)).
- **Markkinointisivu** www.tyomaat.fi julki 27.9.2026, viritetty tuomaan
  käyttäjiä (erillinen repo `tyomaat-site`).
- **Instagram ~875 seuraajaa**, tasoissa kilpailija **Metrocin** kanssa; useita
  itse tehtyjä videoita. Orgaaninen jakelu kasvaa.
- **Espoon Yrittäjien "viikon vieras" -osio** julkaistaan ensi viikolla (näkyvyys).
- **Pitch** parin viikon päästä.
- **FinnBuild-messut**: 3 päivää, kierretty lähes kaikki näytteilleasettajat →
  suora kontaktipinta ja kerätyt yhteystiedot (ks. [[finnbuild-2026-kierros]]).
- **Rakennuslehti-yhteistyö vireillä** (tilaajaetu-keskustelu, ks.
  [[rakennuslehti-partnership]]) → mahdollinen jakelukumppani, jolla on
  valmis yleisö.

**Miksi tämä nostaa arvoa enemmän kuin pelkkä liikevaihto:** kaksi
maksavaa asiakasta todistaa maksuhalukkuuden (suurin yksittäinen riskin
poistaja), ja samaan aikaan syntyy **toistettava jakelukoneisto**
(sivu + somekasvu + media + kumppani). Arvo on tässä vaiheessa enemmän
**polku- ja strateginen arvo** kuin nykyisen ARR:n monikerta: incumbentille
(esim. Metroc) tai jakelukumppanille (Rakennuslehti) datavallihauta +
jalansija on kiinnostavampi kuin pienelle ostajalle puhdas kassavirta.

**Mistä luku ratkeaa seuraavaksi (3–6 kk):** (1) kääntyvätkö 3–5 lisää
asiakkaaksi, (2) pysyvätkö ensimmäiset (churn), (3) toistuuko hankinta ilman
käsityötä. Nämä kolme nostavat kauppahinta-arvion seuraavan rivin, eivät
rivimäärä tai committahti.

---


## Strategia, johon arvio nojaa (kirjattu 6.10.2026)

Johanneksen oma muotoilu, koska se on arvion tärkein oletus:

> "Uskon vahvasti että voin luoda oman markkinan tuonne matalaan
> hintapisteeseen. Se on minun strategiani: yksinkertainen, mutta kattava ja
> edullinen tuote. Pirkka-versio ehkä jonkun mielestä, mutta se käy minulle
> myös jos se on kannattavaa."

Tämä on tietoinen valinta eikä puute, ja se kannattaa pitää mielessä kun
arviota luetaan. **Pirkka ei ole huono tuote — se on tarkoituksella karsittu,
hyvin tehty ja halpa, ja se omistaa valtavan markkinaosuuden.** Arvon ajuri ei
tässä strategiassa ole ominaisuuksien määrä vaan asiakasmäärä ja churn.

Markkinaperustelu on laskettu dokumentissa
[`11_COMPETITORS.md`](11_COMPETITORS.md) kohdassa *Markkinan koko*: Suomen
hanketietomarkkina on ~8–10 M€/v ja ostajia ~1 500–2 300, kun potentiaalinen
yleisö on kokoluokkaa 15 000 yritystä. **85–95 % ei osta mitään, koska halvin
tarjolla oleva hinta on väärässä kokoluokassa.**

---

## Yritysosto — skenaario ja mitä se vaatisi

Byggfakta Group / Hubexo on pääomasijoitettu yritysostokone: kymmeniä
yrityskauppoja 25 maassa, ja Suomen tuoteperheessäkin on ostettuja paloja
(Forecon PRIX, ProdLib). Kysymys on siksi aiheellinen eikä teoreettinen.

### Tänään: epätodennäköistä

Yrityskaupalla on kiinteät kulut (DD, juristit, integraatio), jotka tekevät
alle miljoonan kaupoista kannattamattomia 2 500 hengen konsernille, ellei kyse
ole strategiasta. Nykyinen toistuva liikevaihto ei näy Hubexo Finlandin
P&L:ssä, jossa liikevoitto on 5,2 M€.

Eikä myytävänä ole sitä mitä he ostavat: **he ostavat toistuvaa liikevaihtoa ja
asiakassuhteita, eivät teknologiaa.** Keruuautomaatio on heille kiinnostava
mutta Suomi-kohtainen, ja heidän alustansa on tarkoituksella pohjoismainen.

### Mutta 40 %:n kate tekee ostamisesta heille halvemman aseen kuin hinnan

Tämä on epäintuitiivinen ja analyysin tärkein kohta. Jos matalan hinnan
strategia alkaa purra, heillä on kaksi vastausta:

| vastaus | mitä se maksaa heille |
|---|---|
| laskea hintaa | hinnoittelee 2 000 asiakkaan kannan uusiksi ja syö 5,2 M€:n katteen — **pysyvä** |
| ostaa kilpailija | kertakulu, joka ei koske omaan hinnoitteluun lainkaan |

Jälkimmäinen on halvempi. **Eli mitä paremmin strategia toimii, sitä
houkuttelevampi ostokohde siitä tulee — nimenomaan siksi että se uhkaa
hinnoittelua eikä kattavuutta.** Matalan hinnan asemointi on rakenteeltaan
ostokohde-asemointia, haluttiin sitä tai ei.

Laukaisupiste ei ole kaksi vaihtanutta asiakasta. Jossain sadan kohdalla luku
alkaa vaatia selitystä Suomen johdolta eteenpäin.

### Mikä nostaa hintaa — samat asiat jotka tekevät yrityksestä hyvän ilman kauppaa

Konfliktia ei siis ole: osto-optimointi ja itsenäinen menestys osoittavat samaan
suuntaan.

- **toistuva liikevaihto ja matala churn** — käytännössä ainoa arvoajuri
- **vaihtaja-asiakkaat erityisesti**, koska jokainen on heiltä menetettyä
  liikevaihtoa
- **orgaaninen hakukonenäkyvyys**, jota heillä ei ole lainkaan (vanha ilmainen
  hankelista on kuollut, HTTP 526)
- **dokumentaatio ja datan alkuperä** — `docs/` on due diligencessä
  poikkeuksellisen hyvässä kunnossa
- **puhdas omistus**: ei kanssaperustajia, ei sijoittajia, ei optioita. Pieni
  kauppa kaatuu useammin sotkuiseen omistukseen kuin hintaan

Kerroin pienessä B2B-datatuotteessa on sama 2–4 × ARR kuin yllä; strateginen
preemio voi nostaa, muttei korvaa liian pientä liikevaihtoa.

### Mitä kaupassa menettäisi

**Yhden henkilön riski tarkoittaa earn-outia.** Ostaja ei osta tuotetta vaan
yrityksen, joka toimii koska Johannes on siinä. Siksi tällaisissa kaupoissa on
lähes aina ansaintaehto ja 1–3 vuoden sitoutuminen. Se tarkoittaa, että
kaupassa myydään myös se vapaus, joka on tässä dokumentissa ja muistissa
kirjattu tietoiseksi kilpailueduksi (`solo-self-funded`). Se ei tee kaupasta
huonoa, mutta **se on hinnoiteltava mukaan eikä huomattava jälkikäteen.**

### Käytännön varotoimi

Jos yhteydenotto joskus tulee ("keskustellaanpa yhteistyöstä"), se voi yhtä
hyvin olla tiedustelua siitä kuinka suuri uhka Tyomaat.fi on. Ei asiakaslistaa,
hinnoittelua eikä käyttäjämääriä ilman allekirjoitettua salassapitosopimusta —
eikä asiakaslistaa nimitasolla kilpailijalle missään vaiheessa. Tämä on
normaalia varovaisuutta, ei epäluuloa.

### Johtopäätös

**Ei nyt, mutta kyllä jos strategia onnistuu.** Toimintaohje on kumpaankin
suuntaan sama: rakenna toistuvaa liikevaihtoa ja pidä churn matalana. Se tekee
samalla parhaan itsenäisen yrityksen ja parhaan ostokohteen.

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

- **2026-10-16** — **Ensimmäiset 2 maksavaa asiakasta** (3–5 lisää tulossa
  loppuvuodelle). Lisätty *Vetovoima ja go-to-market* -osio. Arvio nostettu:
  rakennuskustannus 140–260 k € (~60,8 k riviä, 1318 committia), kauppahinta
  40–120 k € — tuote ei ole enää esitulovaiheessa. Käänne ei ole koodimäärä
  vaan todistettu maksuhalukkuus + syntyvä jakelu (sivu 27.9., IG ~875 tasoissa
  Metrocin kanssa, Espoon Yrittäjien viikon vieras, pitch, FinnBuild-kierros,
  Rakennuslehti-yhteistyö vireillä). Seuraava rivi ratkeaa konversiosta ja
  churnista, ks. [[customer-billing]].

- **2026-10-06** — Lisätty *Strategia, johon arvio nojaa* ja *Yritysosto —
  skenaario*. Taustalla Hubexo Finlandin tilinpäätös (11,3 M€, liikevoitto
  40,2 %, 63 hlöä, yli 2000 suomalaista asiakasta) ja markkinan koon laskenta
  [`11_COMPETITORS.md`](11_COMPETITORS.md):ssa. Olennaisin uusi havainto
  arvion kannalta: **40 %:n kate tekee kilpailijalle yritysostosta halvemman
  aseen kuin hinnan laskemisesta**, eli onnistuva matalan hinnan strategia
  kasvattaa sekä itsenäistä arvoa että ostohoukutusta samaan suuntaan. Arviota
  itseään ei muutettu — ARR on yhä ratkaiseva puuttuva luku.

- **2026-09-13** — Dokumentti luotu. Kirjattu heinäkuun, elokuun lopun ja
  syyskuun mittarit ja arviot. 29.8.→13.9. työ oli datavallihaudan syventämistä
  (uudet lähdekatalogit, kenttäpoiminta, karttageokoodaus, Health-valvonta),
  ei monetisaatioharppaus; arvo ajautui hieman ylös samassa vaiheessa.
