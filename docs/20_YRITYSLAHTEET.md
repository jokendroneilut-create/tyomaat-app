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

### Tampereen Tilapalvelut Oy — lähteeksi 24.10.2026 (D-339)

Kaupungin rakennuttaja (koulut, päiväkodit, kulttuuri- ja liikuntatilat).
Löytyi Aamulehden Kanjonin koulu -jutusta: hanke oli kannassa väärin
tiedoin, ja omistajan hankesivu kertoi urakoitsijan, aikataulun, hinnan ja
hankepäällikön. Ensimmäinen ajo 20 ehdokasta, kaikilla hankepäällikkö.

### Oteran Oy — lähteeksi 18.10.2026 (D-310)

Taulukossa alla yhdeksällä hankkeella (kannassa 18.10. jo 11, kaikki
Hilman tai Väyläviraston kautta). Oma syöte toi 14 hanketta 12
kuukaudessa, joista 11 puuttui. Reitti on `/feed/`, koska REST antaa
401; koostejutut eritellään osioittain.

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

### ~~Destia — 13 hanketta~~ → lähteeksi 17.10.2026 (D-295)

Iso infraurakoitsija. Oli merkitty **NRC:tä hankalammaksi**, koska
`destia.fi/referenssit/` renderöi JS:llä ilman upotettua JSONia.

**Se arvio oli oikea mutta väärästä sivusta.** Referenssit ovat
JS-renderöidyt, mutta **uutishuone ei ole sama asia** — ja juuri
uutishuone kertoo urakkavoitot. Lista tulee omasta päätepisteestään:

```
POST https://destia.fi/wp-json/destia/posts
     { lang, perPage, page, postTypes: ["release"], year }
```

Rungon muoto luettiin teeman `main.js`:stä, koska arvaukset palauttivat
`foundPosts: 0`. Ratkaiseva yksityiskohta: parametri on **`postTypes`
monikossa ja taulukkona**. Päätepiste on POST, minkä takia `sitemap.xml`,
`/feed/` ja `wp-json/wp/v2/posts` näyttivät tyhjiltä.

Mitattu 17.10.2026: 391 tiedotetta, **26 viimeisen 12 kk:n sisällä**,
joista **8 on hankkeita** — loput yritysviestintää. Haku 0,9 s.
Kuvauksen mediaani 2 853 merkkiä (vrt. Rakennuslehden ingressi 197).

**Suodatus on koko työ.** Pelkkä musta lista päästi kuivaharjoituksessa
läpi 8 / 16 ei-hanketta (työturvallisuuden johtaminen, tilinpäätös,
edunvalvonta, "Innostavimmat työpaikat" -palkinto, verkkokaupan avaus),
joten vaaditaan **myös positiivinen urakkasignaali**. Rajatapaus joka
opetti sen: *"Destia ja Oulun ammattikorkeakoulu aloittavat
talonrakentamisen koulutuksen"* sisältää rakentamissanan mutta on
koulutusuutinen.

### Rakennuslehti lähdevihjeenä — mittaus 17.10.2026

Johannes: *"katso nyt siis vain että voisi sieltä saada jotain lähteitä."*

Rajaus on perusteltu: D-294 mittasi että 42 / 76 Rakennuslehti-hanketta
ei täsmää mihinkään muuhun, eli ne eivät tule meille mitään muuta
reittiä. Niissä esiintyvä yritys on siksi vahvempi lähde-ehdokas kuin
yritys joka näkyy jo Hilman kautta.

77 Rakennuslehti-hankkeesta irtosi 53 yritysnimeä: **29 on lähteenämme,
24 ei.** Yksikään niistä 24:stä ei esiinny kahdessa
Rakennuslehti-hankkeessa — joten pelkkä kappalemäärä ei kertonut mitään.

#### Ratkaiseva luku ei ole hankemäärä vaan "jäisikö hanke ilman tätä"

Jos yritys on rakennuttaja ja sen rakentaja on jo lähteemme, hanke tulee
meille ilman uutta lähdettä; uusi lähde toisi nopeutta, ei kattavuutta.
Siksi nimet mitattiin koko kannan yli ja laskettiin **montako hanketta
jäisi ilman tätä lähdettä** (ei muuta osapuolta joka on lähteemme tai
julkinen tilaaja):

| nimi | hankkeita | jäisi ilman | tulee jo muualta |
|---|---|---|---|
| **Toivo Group** | 14 | **13** | 1 |
| **Solarigo Systems** | 11 | **11** | 0 |
| Caverion | 13 | 3 | **10** |
| Pajala Yhtiöt | 4 | 3 | 1 |
| Keski-Suomen Betonirakenne | 3 | 3 | 0 |
| Hoivarakentajat | 3 | 3 | 0 |
| Nyab | 3 | 2 | 1 |
| atNorth | 4 | 1 | 3 |

**Caverion on esimerkki luvusta joka pettää.** 13 hanketta näyttää
isolta, mutta 10:stä on toinen osapuoli jo lähteenämme: viisi on
Fingridin sähköasemia, ja Fingrid on lähteemme 15.10. alkaen. Lisäksi
kolme 13:sta oli väärää osumaa — nimi oli pitkässä urakoitsijalistassa
(Harjavallan koulukeskus, HUS sprinklerit, Kainuun keskussairaala).
Rivit oli avattava, luku ei riittänyt ([[verify-findings-against-source]]).

**Avain-yhtiöt eivät ole taulukossa, ja se on mittarin vika.** Nimi
esiintyy kolmena kirjoitusasuna (Avain Asunnot, Avain Yhtiöt, Avain
Rakennuttaja), jotka normalisointi jättää erillisiksi — sama ansa kuin
Rakennusliike Laptilla. Rivit luettuna: 12 hanketta, ja rakentaja on
lähes aina lähteemme (Peab, Bonava, Pohjola Rakennus, Marvea, Aura),
eli Avain olisi enimmäkseen päällekkäinen.

#### Johtopäätös: kaksi nimeä, ei kiirettä

- ~~**Toivo Group (13 jäisi ilman)**~~ → **lähteeksi 18.10.2026 (D-300)**.
  Asuin- ja hoivakotirakennuttaja joka toimii usein omana
  rakennuttajanaan ilman nimettyä rakentajaa. Kuvauksen mediaani
  2 368 merkkiä; reitti on IR-sivun Inderes-widgetin pilvifunktio, ei
  mikään kolmesta ilmeisestä vaihtoehdosta.
- **Solarigo Systems (11/11)** oli jo listan energiakehittäjissä, mutta
  vasta tämä mittaus antoi sille "jäisi ilman" -luvun.
- **Datakeskusryhmä** (atNorth, Sesterce, Data Tank Nordic, CSC, Nala
  Renewables) on yhdessä 8 hanketta viiden eri sivuston takana, ja
  atNorthin rakentajat ovat Skanska, NRC ja YIT — kaikki lähteitämme.
  Heikompi kuin jo lykätty energiakehittäjien ryhmä (6 lähdettä,
  70 hanketta).

Ei rakennettu nyt. `scripts/kartoita-rakennuslehden-yritykset.ts` ajaa
mittauksen uudelleen.

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
