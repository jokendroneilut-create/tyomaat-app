# Yrityslähteet – ketkä esiintyvät hankkeissamme ilman omaa lähdettä

Mittatikku lähdetyölle: kun yritys esiintyy hankkeissamme usein mutta ei
ole lähteenämme, hankkeet ovat tulleet meille jonkun muun kautta (Hilma,
päätökset, media) eikä koskaan suoraan. Sama ajatus kuin
[`07_ZONING_SOURCES.md`](07_ZONING_SOURCES.md):ssä kunnille ja
[`12_DESIGN_FIRM_SOURCES.md`](12_DESIGN_FIRM_SOURCES.md):ssä
suunnittelijoille.

Syntyi 15.10.2026 kysymyksestä: *"katso kaikki muut kannassa olevat
yritykset josta tiedämme että ovat hankkeissa mukana. Ovatko ne meidän
lähteenämme? Tämä NRC esimerkiksi puuttui niin voi olla muitakin."*

---

## Mittaus 15.10.2026

6 822 hanketta, `developer`- ja `builder`-kentät pilkottuna yritysnimiksi
(y-tunnus ja yhtiömuoto pois, pilkkulista hajalle, julkiset tilaajat
rajattu erikseen).

| | |
|---|---|
| yksityisiä yritysnimiä | 1 220 |
| niistä lähteenämme | 201 |
| ei lähteenämme | 1 019 |

**1 019 ei ole työlista.** Kahdenkymmenen suurimman avaaminen lähteestä
paljasti, että luku sisältää kolme eri asiaa — ja kolme kahdestakymmenestä
oli jotain muuta kuin puuttuva lähde:

| nimi | hankkeita | mikä se oikeasti on |
|---|---|---|
| `rakennusliike lapti` | 27 | **kirjoitusasun variantti.** Lapti on lähteenä kahdella rivillä (`lapti`, `lapti_kohteet`); normalisointi ei yhdistä "Rakennusliike Lapti" ja "Lapti" |
| `senaattikiinteistöt` | 8 | sama: Senaatti-kiinteistöt on lähteenä kolmella rivillä |
| `muu` | 9 | roska-arvo kentässä, ei yritys |

Loput olivat aitoja aukkoja. Kirjoitusasujen yhdistäminen on jo
työjonossa omana kohtanaan; se pienentäisi tätä lukua tuntemattoman
verran.

## Mittarin kaksi omaa virhettä

Kirjattu siksi, että kumpikin tuotti uskottavan näköisen työlistan
([[verify-findings-against-source]]):

1. **Ensimmäinen suodatin oli `status = "approved"`.** `projects`-taulussa
   arvo on `active`, joten kysely palautti 0 riviä **ilman virhettä**.
   Sarake oli olemassa, arvo väärä ([[empty-result-may-be-an-error]]).
2. **"Onko lähteenä" -tarkistus vaati nimeltä yli 3 merkkiä.** Siksi
   `grk`, `ncc`, `srv` ja `yit` näkyivät puuttuvina, vaikka kaikki neljä
   ovat lähteitämme. Korjattu sanarajaan, joka ei myöskään osu nimen
   sisään.

Tarkistus on tehtävä **sekä** `lib/agent/sources.ts`:ää **että**
`discovery_sources`-taulua vastaan: Senaatti-kiinteistöt (112 hanketta)
ei ole `sources.ts`:ssä lainkaan vaan kannassa rekisteröitynä parserina.
Pelkkä tiedostohaku olisi väittänyt sitä puuttuvaksi.

---

## Tehty

### Fingrid Oyj — lähteeksi 15.10.2026 (D-289)

Kartoituksen suurin yksittäinen aukko. 31 hanketta (30 rakennuttajana,
1 rakentajana) eikä omaa lähdettä. Kantaverkko on juuri se laji jota
emme muuten näe: valtakunnallinen suurhanke ei osu Hilmaan, kunnan
päätöksiin eikä kaavoihin ([[private-developer-blind-spot]]). Se myös
ennakoi teollisuusinvestointeja, koska tehdas tarvitsee sähkön ennen
seiniä.

Mitattu: 52 hanketta listauksella, 51 ehdokasta, vaiheet Ideointi 17 /
Rakenteilla 17 / Suunnittelu 17. **50/52 kesken** — vaihe tulee
Fingridin omasta tilasta. Yksityiskohdat ja kaksi jäsennysansaa
D-289:ssä.

### NRC Group Finland — lähteeksi 15.10.2026 (D-288)

Se josta koko kysymys alkoi. 27 käynnissä olevaa infrahanketta.

---

## Avoimet aukot, suuruusjärjestyksessä

### Energiakehittäjät — kuusi nimeä, 70 hanketta

| nimi | hankkeita |
|---|---|
| Myrsky Energia | 15 |
| ABO Energy Suomi | 13 |
| Neoen Renewables Finland | 12 |
| Solarigo Systems | 11 |
| Winda Energy | 10 |
| wpd Suomi | 9 |

Yksikään ei ole lähteenämme. Nämä ovat tuuli- ja aurinkovoiman
kehittäjiä, ja ryhmä on yhdessä suurempi kuin mikään yksittäinen
puuttuva yritys — mutta se on **kuusi lähdettä kuuden eri sivuston
takana**, ei yksi. Ennen rakentamista on mitattava kaksi asiaa:
kertooko sivu vaiheen (Fingridin vahvuus) ja kuinka moni hanke on
kesken. Hankekehittäjän sivu voi olla vuosia vanha salkkuesittely.

Lykätty, ei hylätty: lykkäsin energiakehittäjät jo aiemmin samassa
sessiossa, ja tämä mittaus antaa niille ensimmäisen kerran luvun.

### Destia — 13 hanketta

Iso infraurakoitsija, `destia.fi/referenssit/`. Tarkistettu: 0 riviä
`discovery_sources`-taulussa, ei mainintaa `sources.ts`:ssä.

**NRC:tä hankalampi.** NRC:n sivu on Next.js ja hankkeet ovat valmiina
upotetussa `__NEXT_DATA__`-JSONissa; Destia renderöi JS:llä ilman
upotettua JSONia, joten jäsennin ei siirry suoraan.

### Metsähallitus — 16 hanketta

Valtion liikelaitos, ei lähteenä. Sama laji kuin Stara
([[winner-extraction-open-items]]): liikelaitos joka on aito
rakennuttaja mutta ei käyttäydy kuten kaupunki eikä kuten yritys.

### Yksittäiset urakoitsijat ja rakennuttajat

| nimi | hankkeita |
|---|---|
| Louhintahiekka | 12 |
| TVT Asunnot | 12 |
| JM Suomi | 11 |
| Toivo | 10 |
| HSY | 9 |
| Oteran | 9 |
| Rakennusliike Soimu | 9 |

Kymmenen hankkeen yritys ei ansaitse omaa jäsennintä pelkän luvun
perusteella; ratkaisu on sama kuin TVT Asunnoilla ja HSY:llä, jotka
ovat kunnallisia toimijoita eivätkä urakoitsijoita. Nämä odottavat
kysymystä "muuttuuko sivu niin usein että lähde kannattaa".

### Suunnittelijat — 116 hanketta (oma dokumentti)

Ramboll, Sweco, FCG, Envineer. Ks.
[`12_DESIGN_FIRM_SOURCES.md`](12_DESIGN_FIRM_SOURCES.md).

Suunnittelijan referenssi ei ole sama asia kuin urakoitsijan: se voi
olla vuosia vanha ja jo rakennettu. Vaiheen tuoreus on mitattava ennen
kuin lähde otetaan — juuri se mittaus jonka Fingrid läpäisi (50/52
kesken) ja jonka urakoitsijoiden referenssisivut läpäisevät huonosti.

---

## Prioriteetti ei ole arvojärjestys

Uutta lähdettä rekisteröidessä `priority` jää **10:een**. Mitattu
15.10.2026: 333 lähteestä 330 on kymmenellä ja 2 kahdellakymmenellä,
eli kenttä on binäärinen. `priority > 10` varaa kiinteän paikan joka
ajossa (4 kertaa/vrk) ja on pois muiden kierrosta. Ks. D-289 ja
`lib/agent/pipeline/cronConfig.ts`.
