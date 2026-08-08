# RPT:n hankelista vs. oma data

Työtiedosto. RPT Smart julkaisi aiemmin nettisivuillaan kaupunkikohtaiset
listat suurimmista rakennushankkeista. Listalta saa **vain hankkeen nimen ja
kaupungin** — ei kuvausta, osoitetta, rakennuttajaa eikä aikataulua.

Tarkoitus on kahtalainen: löytää hankkeet joita meillä ei ole, ja samalla
selvittää **mistä lähteistä ne olisi pitänyt löytyä**. Jälkimmäinen on se
kestävä tuotos — yksittäinen lista vanhenee, puuttuva lähde ei korjaa itseään.

## Lähteen tila

Vanha palvelu `rakennushankkeet.rpt.fi` vastaa **HTTP 526** (Cloudflare:
invalid SSL certificate). Sitä ei voi ajastaa eikä hakea uudelleen — tämä on
kertaluontoinen tilannekuva, ei lähde. Aineisto on tallennettu tähän kansioon
sellaisenaan, jotta työ on toistettavissa ilman alkuperäistä Exceliä.

| tiedosto | sisältö |
|---|---|
| `rpt-projects.json` | 726 hanketta, 18 kaupunkia (nimi, kaupunki, sijaluku) |
| `rpt-match-results.json` | täsmäytyksen tulos hanketta kohden perusteluineen |

## Täsmäytys tehtiin kahdessa vaiheessa

Sama periaate kuin AI-relevanssiportissa ([D-021](../03_DECISIONS.md)):
säännöt ensin, malli vain harmaalle alueelle.

1. **Mekaaninen esikarsinta** — saman kaupungin hankkeista poimitaan
   sanapäällekkäisyyden perusteella 8 lähintä. Ei kynnystä; tämän tehtävä on
   vain rajata mallille annettava lista.
2. **LLM ratkaisee** (`claude-haiku-4-5`) — onko jokin niistä sama hanke.
   Jokainen päätös kirjataan varmuuden ja perustelun kanssa.

**Miksei pelkkä mekaaninen riitä.** Oma `calculateMatch` löysi 726:sta vain
**8 osumaa**. Nimeämistavat eroavat täysin: *"Lentorata välille
Helsinki-Vantaa-Kerava"* on meillä nimellä *"002653 Lentorata osa 2"*, eikä
niillä ole yhtään yhteistä erottuvaa sanaa. Mikään sanapohjainen mitta ei voi
löytää sitä. LLM löysi **174** — kaksikymmenkertaisesti.

## Tulos

| | |
|---|---|
| RPT-hankkeita | 726 |
| **meillä jo** | **174 (24 %)** |
| **puuttuu** | **552 (76 %)** |
| LLM-kutsuja | 71 |

Osumien varmuusjakauma:

| varmuus | kpl | tulkinta |
|---|---|---|
| 0.90–1.00 | 70 | luotettava |
| 0.80–0.89 | 38 | todennäköisesti oikein |
| 0.70–0.79 | 47 | pistokoe riittää |
| alle 0.70 | 19 | **tarkistettava käsin** |

Kaupungeittain:

| kaupunki | RPT | jo | puuttuu | | kaupunki | RPT | jo | puuttuu |
|---|---|---|---|---|---|---|---|---|
| Helsinki | 100 | 33 | 67 | | Vaasa | 29 | 6 | 23 |
| Espoo | 75 | 9 | 66 | | Lappeenranta | 22 | 5 | 17 |
| Turku | 72 | 15 | 57 | | Kouvola | 21 | 7 | 14 |
| Tampere | 68 | 16 | 52 | | Rovaniemi | 21 | 4 | 17 |
| Vantaa | 64 | 18 | 46 | | Pori | 19 | 5 | 14 |
| Oulu | 53 | 12 | 41 | | Seinäjoki | 19 | 5 | 14 |
| Kuopio | 35 | 6 | 29 | | Hyvinkää | 15 | 5 | 10 |
| Joensuu | 34 | 4 | 30 | | Porvoo | 15 | 5 | 10 |
| Lahti | 34 | 10 | 24 | | Jyväskylä | 30 | 9 | 21 |

## Mikä kaipaa ihmisen silmää

**22 tapausta, joissa useampi RPT-nimi osui samaan hankkeeseemme.** Syy on
useimmiten se että **oma nimemme on geneerinen** ja RPT:llä on tarkempi:

```
"Kerrostalo Malmille"      <- Heka Malminkenttä Lepistönkatu 2
                           <- Heka Malminkenttä Suistolankatu 2
"Kerrostalo Finnooseen"    <- Finnoo Pohjantähti, Aamurusko ja Aamunkoi
                           <- Finnoon Lounatuulikorttelin jatko
```

Nämä ovat todennäköisesti eri rakennuksia, jotka meillä on yhtenä rivinä.
RPT on siis paikoin **tarkempi kuin me** — tieto jota kannattaa käyttää.

Joukossa on myös selviä virheitä, jotka matala varmuus paljasti:

```
0.40  "Tahkoluodon merituulipuiston laajennus"  ->  "MÄNTYLUOTO 65. kaupunginosan asemakaava"
0.55  "Hintsankujan päiväkoti Turkuun"          ->  "Lujatalolle kaksi korjausrakentamisen..."
0.70  "Toimitilat Embers Business Garden"       ->  "Garden Helsinki"
```

## Havainto lähteistä

Puuttuvat hankkeet ovat isoja ja julkisesti merkittäviä: *Töölön kisahallin
perusparannus*, *Laajasalon raitiovaunuvarikko*, *Meilahden tornisairaalan
peruskorjaus*, *Suvilahti Event Hub*, *Vuosaaren seniorikeskus*, *Stoan
laajennus*. Yksikään ei ole kannassa missään muodossa.

Se kertoo aukon paikan. Katamme **kaavoituksen** (kaavanumeroilla),
**kilpailutuksen** (Hilma) ja **rakentamisen** (yritysten tiedotteet) — mutta
emme väliin jäävää **nimettyä investointipäätösvaihetta**, joka on juuri se
mitä RPT:n lista edustaa.

## Seuraava vaihe

Puuttuvat 552 käydään läpi yksi kerrallaan RPT:n sijaluvun järjestyksessä.
Jokaisesta selvitetään tila (rakenteilla · valmistunut · peruttu · yhä
suunnitteilla), sisältö ja **mistä lähteestä tieto löytyi**.

Hanketta ei julkaista ilman lähdettä. Ehdokas luodaan vasta kun siitä on
kuvaus — pelkkä nimi hylätään katselmoinnissa, mikä on mitattu
([D-027](../03_DECISIONS.md)).

Löydetyt lähteet lisätään sitä mukaa kun ne varmistuvat.

---

# Läpikäynti

## Tutkitut hankkeet

### Helsinki #3 — Meriveden lämmöntalteenottohanke, tunnelit

**Tila:** kehitysvaihe, toteutuspäätöstä ei ole tehty. YVA-ohjelma 2021,
YVA-selostus 2023. Vesienottotunneli n. 17 km, purkutunneli n. 9 km,
lämpöpumppulaitos Salmisaareen. Rakennuttaja Helen Oy.

**Lähde löytyi:** `ymparisto.fi` YVA-sivu + `helen.fi`.

**Miksi puuttuu:** YVA julkaistiin **2023-10-17**, ja YVA-poimijamme
tuoreusraja on 18 kuukautta eli 2025-02-08. Hanke on 16 kuukautta liian
vanha. Lähde on siis meillä, ikkuna ei riitä.

### Helsinki #13 — Töölön kisahallin perusparannus

**Tila:** suunnitteilla. Tarveselvitys valmistui 10/2025, hankesuunnitelma
odotetaan 6/2026, rakentaminen talonrakennusohjelmassa **6/2028–7/2031**.
Yli 75-vuotias rakennus, vaippa ja talotekniikka käyttöikänsä päässä.

**Lähde löytyi:** `paatokset.hel.fi` (tarveselvityspäätös),
`hel.fi/.../rakennushankkeet` (hankesivu), `sttinfo.fi` (kaupungin tiedotteet).

**Miksi puuttuu:** ei ole missään kannassamme. Kaupungin oma
investointipäätösketju ei ole meillä lähteenä.

### Helsinki #5 — Viikin-Malmin pikaraitiotie

**Tila:** yleissuunnitelma hyväksytty **16.4.2025**. Hankesuunnitelma
valmistellaan 2025–2026, päätös siitä 2026. Rakentaminen suunniteltu
alkavaksi **2028**, liikennöinti **2032**. Ensimmäinen vaihe Kumpulasta
Viikin ja Malminkentän kautta Malmin sairaalalle; toisessa vaiheessa
Jakomäki. Kustannusarvio 340 M€ + 100 M€.

**Lähde löytyi:** `paatokset.hel.fi` (kaupunginhallitus, yleissuunnitelman
hyväksyntä), `sttinfo.fi` (kaupungin tiedote), `infraohjelmahelsinki.fi`.

**Miksi puuttuu:** sama syy kuin kisahallilla — kaupungin päätösketju ei ole
lähteenä. STT-tiedote on olemassa, mutta se on vanhempi kuin korjatun haun
12 kuukauden ikkuna.

## Lähdehavainnot

Kaksi hanketta riitti tuottamaan neljä havaintoa. Kaksi ensimmäistä ovat
uusia lähdeaihioita, kaksi jälkimmäistä vikoja jo olemassa olevissa.

**1. `paatokset.hel.fi` — vahvin aihio.** Helsingin päätösjärjestelmä sisältää
tarveselvitys- ja hankesuunnitelmapäätökset jokaisesta kaupungin
talonrakennushankkeesta. Se on täsmälleen se **nimetty investointipäätösvaihe**
jonka puuttuminen tunnistettiin. Vastaava järjestelmä on muillakin
kaupungeilla.

**2. `hel.fi`-karttapalvelun tilahankkeet.** Suodatettava hankerekisteri
(katu-, puisto- ja tilahankkeet). Sama palvelin `kartta.hel.fi` josta jo
haemme SUKKA-kaavoja, eli tekninen polku on tuttu.

**3. YVA:n tuoreusikkuna rajaa liikaa — mutta selittää vain kourallisen.**
Vertasin kaikki 552 puuttuvaa YVA:n koko 1337 hankkeen aineistoon.
Mekaaninen vertailu antoi 32 ehdokasta, mutta käsin tarkistettuna aitoja on
muutama: Meriveden lämmöntalteenotto, Vaasan satamatie ja Länsirata
(= Espoo–Salo-oikorata). Syy on rakenteellinen: YVA koskee vain isoja
ympäristövaikutteisia hankkeita, ei Töölön kisahallin kaltaisia
talonrakennuskohteita. **Ikkunan kasvattaminen ei siis ole ratkaisu tähän
listaan**, vaikka se toisi muutaman ison infrahankkeen.

**4. STT-haku hakee murto-osan aineistosta.** Rajapinta kertoo hakusanalle
"peruskorjaus" **1397 osumaa** mutta palauttaa **10 tiedotetta** — eikä
`count`, `offset` tai `page` muuta sitä. Poimijamme pyytää `count=20` ja
uskoo saavansa 20. Noin 34 hakusanalla katamme siis korkeintaan ~340
tiedotetta.

Tämä on sama vikaluokka kuin [D-026](../03_DECISIONS.md): pyyntö onnistuu,
vastaus näyttää täydeltä, ja katkaisu on näkymätön. Vaatii oman
selvityksensä — oikea sivutusparametri tai eri rajapinta.

**5. `infraohjelmahelsinki.fi` tarkistettu — liian kapea.** Sivustolla on vain
kolme hanketta (Länsiratikat, Länsisataman pikaraitiotie, Viikin–Malmin
pikaraitiotie). Se on allianssiohjelman esittelysivusto, ei hankerekisteri.

**Kuvio kolmen hankkeen jälkeen:** `paatokset.hel.fi` esiintyi kahdessa
kolmesta ja on ainoa lähde joka kattaisi molemmat. Se vahvistaa alkuperäisen
päätelmän — puuttuva vaihe on kunnan investointipäätös, ja se asuu
päätösjärjestelmässä.

## Sivupolku: kattaisiko korjattu STT puuttuvia?

Läpikäynnin aikana löytyi vika STT-poimijasta (ks. [D-029](../03_DECISIONS.md)),
ja korjauksen jälkeen se hakee 883 tiedotetta aiemman 82:n sijaan. Oli siis
syytä tarkistaa kattaisiko se osan puuttuvista.

**Vastaus: ~18 hanketta 552:sta, eli 3 %.** Oikeita osumia mm. Rikhardinkadun
kirjaston perusparannus, OSAO:n Kampus 2030, Muuran yhtenäiskoulu Vantaalla,
Vaaralan varikon infraurakka ja Kelan pääkonttorin peruskorjaus. Tulokset ovat
`stt-coverage.json`:issa.

Vain **varmuus ≥ 0.90 kelpaa**: 0.80–0.89 -kaista tarkistettiin näytteellä ja
se oli valtaosin väärin (*"Tapiolan kirkon piharakennusten peruskorjaus"* ->
*"Tapiolan kirkko täyttää 60 vuotta"*).

Ensimmäinen ajo tuotti 61 osumaa mutta oli kelvoton: esikarsinta laski
sanapäällekkäisyyden ≥5 merkin sanoista, jolloin `espoo`, `helsinkiin` ja
`peruskorjaus` hallitsivat ja malli sai eteensä pelkkiä saman kaupungin
osumia. Karsinnasta poistettiin kaupunkien nimet ja rakentamisen yleissanasto.

**Tämä ei vastaa siihen ovatko hankkeet ajankohtaisia** — se vaatii
hankekohtaisen selvityksen, joka jatkuu yllä olevassa läpikäynnissä.

---

# Selvitys: kuntien päätösjärjestelmät lähteenä

Kolmen hankkeen läpikäynti osoitti että puuttuva vaihe on **kunnan
investointipäätös** ja se asuu päätösjärjestelmässä. Selvitettiin voisiko
siitä tehdä lähteen — ja voisiko sen tehdä kerralla koko Suomelle.

## Helsinki: paatokset.hel.fi

Drupal-sivusto, sisältö palvelinpuolella HTML:nä. Yksittäinen asiasivu on
haettavissa ja sisältää päätöstekstin (todennettu: Töölön kisahallin
tarveselvitys). Hakusivu `/fi/asia` on sen sijaan React-sovellus jonka takana
on Elasticsearch — bundlesta löytyivät kenttänimet `decision_content`,
`field_is_decision`, `field_decision_section`, mutta proxyn osoite ei ollut
suoraan luettavissa.

`robots.txt` estää vain `/core/`, `/admin/`, `/search/` ja käyttäjäpolut —
asiasivut ovat sallittuja.

## "Kaikille kunnille" ei onnistu — alustoja on monta

Testattiin 11 kaupungin päätösjärjestelmä:

| alusta | kaupungit |
|---|---|
| Drupal / Ahjo | Helsinki |
| Dynasty (`oncloudos.com`) | Espoo, Kuopio, Lahti |
| CaseM (`cloudnc.fi`) | Tampere |
| oma (`paatokset.turku.fi`) | Turku |
| Tweb (`ktwebbin`) | Jyväskylä |

Toiveena oli että `oncloudos.com` kattaisi valtaosan. **Se ei kata:** 40
testatusta kunnasta vain 8 vastasi (espoo, kuopio, lahti, kirkkonummi,
tuusula, savonlinna, tornio, ylöjärvi). Loput 32 — mm. Vantaa, Joensuu, Pori,
Kouvola, Lappeenranta, Vaasa — ovat muualla, tyypillisesti kunnan omalla
verkkotunnuksella.

Alustaperheitä on siis 4–5, mutta **osoitteet eivät noudata yhtä kaavaa**,
joten jokainen kunta pitää löytää erikseen. Sama työ on jo tehty kerran:
kaavalähteitä on 248 ja ne rakennettiin kunta kerrallaan.

## Suositus: 18 kaupunkia, ei 309 kuntaa

Puuttuvat 552 hanketta ovat **18 kaupungissa**, ja ne ovat RPT:n mukaan
kunkin kaupungin suurimpia. Koko Suomen kattaminen ei ole tarpeen tämän
aukon paikkaamiseksi — riittää että katetaan ne kaupungit joissa isot
hankkeet ovat.

Työmäärä on silti tuntuva: 18 kaupunkia jakautuu 4–5 alustaperheeseen, eli
noin viisi jäsentäjää ja 18 lähdemäärittelyä. Helsinki on suurin yksittäinen
hyöty (67 puuttuvaa) ja samalla ainoa jonka rajapinta on vielä auki.

## Helsingin rajapinta löytyi

Vanha Open Ahjo (`dev.hel.fi/paatokset/v1`) on kuollut — DNS ei vastaa.
Nykyinen rajapinta löytyi ajamalla haku selaimessa ja tallentamalla
`fetch`-kutsut:

```
POST https://paatokset-elastic-proxy.api.hel.ninja/paatokset_decisions/_search
```

Puhdas Elasticsearch, **ei tunnistautumista**, toimii selaimen ulkopuolelta.
Sama muoto kuin ymparisto.fi:n YVA-proxy jota jo käytämme, eli tekninen polku
on tuttu.

| | |
|---|---|
| päätöksiä indeksissä | **143 221** |
| osumia haulla "hankesuunnitelma" | 1 666 |

Kentät ovat poikkeuksellisen hyvät. Mitattu esimerkki *Pukinmäenkaaren
peruskoulun perusparannuksen hankesuunnitelma* — joka on RPT:n puuttuvien
listalla:

| kenttä | sisältö |
|---|---|
| `subject` | nimi **ja osoite**: "…(Kenttäkuja 12, Pukinmäki)" |
| `decision_content` | 704 merkkiä päätöstekstiä |
| `decision_motion` | **28 192 merkkiä** esittelijän perusteluja: tausta, tarve, laajuus, kustannus, aikataulu |
| `category_name` | "Rakennusten ja rakennelmien suunnittelu ja toteutus" |
| `unique_issue_id` | `HEL-2025-008563`, pysyvä tunniste |
| `organization_name` | päättävä toimielin |
| `meeting_date` | unix-aika |

Tämä ratkaisee myös [D-027](../03_DECISIONS.md):n vaatimuksen: lähde tuottaa
kuvauksen, joten ehdokkaat ovat arvioitavissa. `category_name` mahdollistaa
suodatuksen **ilman hakusana-arvailua** — toisin kuin STT, jossa löyhä
kokotekstihaku pakotti positiiviseen sanalistaan (D-029).

**Avoin toteutusyksityiskohta:** kategoriasuodatus ei toiminut
`category_name.keyword`-kentällä (0 osumaa), joten kenttäkartoitus pitää
tarkistaa `_mapping`-kutsulla ennen kerääjän rakentamista.

---

# Mittaus: miksi tuonti on hidas (ja mikä EI ollut syy)

Helsingin lähde toi 1039 ehdokasta, ja tuonti käsitteli niitä **7,6 s
kappaleelta** — noin 2,2 tuntia koko erälle. Aika menee kokonaan
täsmäytykseen (`findProjectMatchDetailed`), joka vertaa jokaisen ehdokkaan
kaikkiin 4412 hankkeeseen.

## Hypoteesi joka osoittautui vääräksi

Ensimmäinen mittaus näytti että kuvauksen pituus on syy:

```
täysi kuvaus     7657 ms / ehdokas
1000 merkkiä     2234 ms
ei kuvausta       777 ms
```

Päättelin että trigrammien laskenta pitkistä kuvauksista on pullonkaula, ja
rajasin vertailun 1500 merkkiin. **Rajaus ei nopeuttanut lainkaan** — 8888 ms
eli sama kuin ennen.

Syy oli mittausvirhe: ajoin kolme varianttia peräkkäin samassa prosessissa
kiinteässä järjestyksessä, joten myöhemmät hyötyivät V8:n lämmittelystä ja
JIT-optimoinnista. Ero ei johtunut kuvauksen pituudesta vaan
suoritusjärjestyksestä.

Muutos peruttiin, koska se oli häviöllinen ilman hyötyä: verifiointi 16 000
parilla osoitti että 2,23 % vaihtaa pisteytystasoa, aina alaspäin.

**Opetus mittaamiseen:** varianttien vertailu samassa prosessissa peräkkäin ei
kelpaa. Järjestys pitää satunnaistaa tai jokainen variantti ajaa omassa
prosessissaan.

## Mitä tiedetään varmasti

- Täsmäytys on 100 % ajasta; lähteen haku (4,6 s) ja hankelistan lataus
  (4,3 s) ovat kertaluontoisia per ajo.
- Kustannus on `ehdokkaat × hankkeet` = 1039 × 4412 ≈ 4,6 miljoonaa
  paria per ajo.
- Keskeytys on turvallinen: ehdokkaat kirjoitetaan yksi kerrallaan ja
  24 tunnin `source_url`-suoja ohittaa jo tuodut. Todettu käytännössä —
  katkaistu ajo jätti 79 ehjää ehdokasta, ei yhtään puolittaista.

## Seuraava askel

Oikea mittaus: jokainen variantti omassa prosessissaan, ja profilointi sen
sijaan että arvataan mikä osa `calculateMatch`ista on kallis. Vasta sitten
optimointi.
