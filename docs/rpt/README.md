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

> Tämä taulukko on tilanne siltä hetkeltä. Jyväskylän rivi osoittautui
> myöhemmin harhaanjohtavaksi: kaupungilla on Tweb-asennus, mutta päätökset
> ovat myös CaseM:ssä. Ks. alempaa "Jyväskylä EI ollut viides alustaperhe".

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

## Oikea syy löytyi

Kun jokainen variantti ajettiin **omassa prosessissaan**, kuva oli toinen:

| variantti | ms / ehdokas |
|---|---|
| täysi | 14674 |
| hankkeen kuvaus pois | 14159 — ei vaikutusta |
| **ehdokkaan kuvaus pois** | **1924** |
| molemmat pois | 550 |

Kustannus on kokonaan **ehdokkaan puolella**, ei hankkeiden. Syy on
kutsujärjestyksessä: `descriptionSimilarity` saa ehdokkaan kuvauksen
ensimmäisenä argumenttina, joten se on sama merkkijono koko silmukan ajan —
mutta se tokenisoitiin uudelleen jokaiselle 4412 hankkeelle.

Korjaus on yhden alkion muisti, ks. [D-030](../03_DECISIONS.md). Häviötön ja
algoritmisesti varma, vaikka kellotettu nopeutus (1,7×) jäi selvästi alle sen
mitä eristetty mittaus lupasi — hajonta ajojen välillä on ±2×.

## Seuraava askel jos nopeutta tarvitaan lisää

Yksittäisen parin kustannus on nyt pienempi, mutta **parien määrä** on
ennallaan: 1039 ehdokasta × 4412 hanketta ≈ 4,6 miljoonaa. Seuraava voitto
tulee parien vähentämisestä, ei parin halventamisesta — esimerkiksi
esikarsinnalla kuten duplikaattiskannerissa. Se on kuitenkin herkkä paikka:
tuonnin todisteportti sallii osuman ilman samaa kaupunkia (tunniste, osoite,
tekstitodiste), joten kaupunkiryhmittely hukkaisi osumia.

---

# Dynasty-alusta (Espoo, Kuopio, Lahti + 5 muuta)

Toinen kaupunki aloitettu. `espoo.oncloudos.com` on **Dynasty 7.00.030** ja sen
klassinen CGI-rajapinta vastaa palvelinpuolen HTML:llä:

```
/cgi/DREQUEST.PHP?page=meeting_frames        toimielinluettelo
/cgi/DREQUEST.PHP?page=meetings&id=<orgId>   kokouslista (87 kokousta)
/cgi/DREQUEST.PHP?page=meeting&id=<mtgId>    asialista (16 asiaa, 28 kt)
/cgi/DREQUEST.PHP?page=meetingitem&id=<id>   yksittäinen asia
```

Etusivu palauttaa tyhjän rungon (vaatii JS), mutta CGI-polut toimivat ilman
sitä. **Hakutoimintoa ei ole** — `page=search`, `fsearch`, `search_start` ja
`asiakirjahaku` palauttavat kaikki nolla tavua.

## Olennainen ero Helsinkiin

| | Helsinki | Dynasty |
|---|---|---|
| rajapinta | Elasticsearch | HTML-läpikäynti |
| suodatus | lähteen oma kategoria | otsikon perusteella |
| pyyntöjä / ajo | **1** | **~230** |
| kuvaus | valmiina samassa vastauksessa | erillinen pyyntö per asia |

Helsingin lähde on yksi kysely. Dynasty vaatii ketjun: toimielimet →
kokoukset → asialistat → asiat. Karkea arvio Espoolle 18 kk ikkunalla on noin
230 pyyntöä ja reilu minuutti — mahtuu 800 sekuntiin, mutta kahdeksan
Dynasty-kuntaa samassa ajossa ei mahdu.

## Mitä tämä tarkoittaa toteutukselle

Yksi jäsentäjä kattaa **kahdeksan kuntaa** (espoo, kuopio, lahti, kirkkonummi,
tuusula, savonlinna, tornio, ylöjärvi), koska polut ovat identtiset ja vain
verkkotunnus vaihtuu. Se on paras tuotto per työtunti koko 18 kaupungin
listalla.

Kuntakohtainen ajo kannattaa kuitenkin tehdä **omana lähteenään**
(`discovery_sources`-rivi per kunta), jotta putken oma vuorottelu jakaa ne eri
ajoihin eikä yksi kunta syö koko budjettia. Sama kuvio kuin kaavalähteillä.

**Avoin kysymys ennen rakentamista:** riittääkö asialistan otsikko
suodatukseen, vai pitääkö jokainen asia hakea erikseen kuvauksen vuoksi
(D-027). Otsikot ovat muotoa "12 § Hankesuunnitelman hyväksyminen…", joten
suodatus onnistuu niistä — mutta kuvaus vaatii oman pyyntönsä, ja se määrää
pyyntöjen määrän.

---

# CaseM-alusta (Tampere) — kesken

Kolmas alustaperhe aloitettu. `tampere.cloudnc.fi` on CaseM, ja se poikkeaa
molemmista edellisistä: **ei RSS:ää eikä JSON-rajapintaa.**

## Mitä on selvitetty

| polku | tulos |
|---|---|
| `/fi-FI/Toimielimet` | 200, listaa **15 tuoreinta asiaa** linkkeinä |
| `/fi-FI/content/<a>/<b>` | 200, **yksittäinen asia täydellä tekstillä** (38 kt) |
| `/fi-FI/Haku?searchtext=…` | 200, 101 kt, mutta **nolla tuloslinkkiä** |
| `/api/v1/sitesearchautocomplete` | 404 |
| `/rss`, `/fi-FI/rss`, `/api/meetings` | 404 |

Sisältösivut ovat palvelinpuolen HTML:ää ja sisältävät koko asiatekstin, eli
jäsentäminen onnistuu. Ongelma on **enumerointi**: listaus antaa vain 15
tuoreinta, eikä hakua ole saatu tuottamaan tuloksia.

Huomaa että `/fi-FI/content/504368/23978` EI ole toimielinsivu vaan
yksittäinen asia ("Valtuustoaloite perusteettomista määräaikaisista
työsopimuksista"). Toimielimet-sivu listaa siis suoraan asioita.

## Enumerointi ratkesi

Hakusivu löytyi selaimen kautta: sivusto on ASP.NET WebForms, ja haku on
postback (`ctl00$txtSearchText`). Postback kuitenkin **ohjaa tavalliseen
GET-osoitteeseen**, joka toimii ilman istuntoa:

```
/fi-FI/haku?n=23&d=1&s=<hakusana>&o=Rank&page=<n>
```

20 osumaa per sivu, sivutus toimii (todennettu sivuilla 1 ja 5).
Osumat ovat `/fi-FI/content/<id>/23` -linkkejä eli suoraan asiasivuja,
joissa on koko teksti.

Aiempi yritys `/fi-FI/Haku?searchtext=` epäonnistui kahdesta syystä:
**väärä kirjainkoko ja väärä parametri**. Polku on `haku` pienellä ja
hakusana on `s`.

Kärkiosumat ovat aitoja hankkeita: *Nekalan koulun sisäilmakorjaus*,
*Tammelan koulun rakennuksen 2 peruskorjaus*, *Lielahti–Ylöjärvi
-raitiotien hankesuunnitelma*.

## Toteutus

CaseM on nyt sama kuvio kuin STT: hae hakusanoilla, sivuta, hae kuvaus
osumille. Erona on että asiasivu sisältää koko tekstin, joten kuvaus ei
vaadi erillistä poimintalogiikkaa.

Hakusanat kannattaa ottaa Dynastyn `CONSTRUCTION_SIGNALS`-listasta —
se on jo mitattu toimivaksi kuuden kunnan aineistolla.

---

# Turku — rajapinta löytyi, haku kesken

`paatokset.turku.fi` on React-sovellus jonka kuori on 622 tavua. Selain
jumittui sivulla (navigointi aikakatkaisi 300 s), joten rajapinta
etsittiin JS-nipusta — ja se löytyi sieltä:

```
base:  https://paatokset.turku.fi/api
```

Nippu paljasti myös sovelluksen reitit: `/haku`, `/toimielimet`,
`/asiaryhmat`, `/poytakirja/:id`.

## Toimivat päätepisteet

| polku | tulos |
|---|---|
| `/api/toimielimet` | 200 JSON, 6,8 kt — kaupunginvaltuusto, kaupunginhallitus, lautakunnat, seudulliset lautakunnat, vaikuttajaryhmät, lakkautetut |
| `/api/asiaryhmat` | 200 JSON, taulukko 15 asiaryhmää |
| `/api/haku` | **500** `{"message":"Error fetching data"}` |

Hakupäätepiste on olemassa mutta palauttaa saman 500:n parametreista
riippumatta (kokeiltu `q`, `s`, `hakusana`, `teksti`, `search`, `query`,
`text`, `term` sekä ilman parametria). POST antaa 404, joten reitti on
GET-only.

## Ratkaisu: toimielinketju, ei hakua

Vaihtoehtoja oli kaksi — ajaa haku selaimessa ja tallentaa kutsu, tai
rakentaa ketju toimielinten kautta. Jälkimmäinen valittiin, koska
`/api/toimielimet` toimi jo eikä se vaadi selainta, ja koska hakupäätepiste
voi olla rikki palvelimen päässä eikä vain väärin kutsuttu.

Ketju toimielin -> `/poytakirja/:id` -> pykälät osoittautui auki olevaksi.
Turku on tuotannossa (`lib/agent/fetchTurkuSource.ts`).

# Jyväskylä EI ollut viides alustaperhe

Suunnitelma oli rakentaa Tweb-jäsentäjä Jyväskylää varten. Kartoitus kumosi
sen: Jyväskylän päätökset ovat **CaseM:ssä** (`jyvaskyla.cloudnc.fi`), jota jo
jäsennämme. Kaupungilla on kyllä Tweb-asennus (`julkinen.jkl.fi`), mutta se ei
ole ainoa eikä välttämättä edes ensisijainen.

Kun kaikki 12 jäljellä ollutta kaupunkia ajettiin läpi samalla tavalla — ensin
aliverkkotunnusarvaus, sitten kunnan oman sivun `paatoksenteko`-linkit — löytyi
kolme muutakin jotka olivat jo katettujen perheiden sisällä:

| kaupunki | löytyi | alusta |
|---|---|---|
| Jyväskylä | `jyvaskyla.cloudnc.fi` | CaseM |
| Rovaniemi | `rovaniemi.cloudnc.fi` | CaseM |
| Pori | `pori.cloudnc.fi` | CaseM |
| Joensuu | `dynastyjulkaisu.pohjoiskarjala.net/joensuu/` | Dynasty |

Joensuu oli jäänyt löytymättä siksi että aiempi 40 kunnan testi haki vain
muotoa `<kunta>.oncloudos.com`. Joensuun Dynasty on maakunnallisessa
asennuksessa, jossa kunta on **polussa** eikä aliverkkotunnuksessa, ja
palvelimen juuri vastaa 403:lla. Jäsentäjään lisättiin valinnainen `cgiBase`.

Nämä neljä maksoivat yhteensä yhden konfiguraatiokierroksen, eivät neljää
jäsentäjää. Päätelmä on kirjattu [D-032](../03_DECISIONS.md):ksi.

## Tweb löytyi, mutta robots.txt kieltää

Viides alustaperhe on olemassa ja kattaa viisi kaupunkia. Se on teknisesti
helpoin kaikista — palvelinpuolen HTML, vakiopolut — mutta kaikki viisi
kieltävät haun:

| kaupunki | osoite | robots.txt | meta-robots sivulla |
|---|---|---|---|
| Oulu | `asiakirjat.ouka.fi` | `Disallow: /` | `noindex, nofollow` |
| Vaasa | `tweb.vaasa.fi` | `Disallow: /` | `noindex, nofollow` |
| Hyvinkää | `asianhallintavhp.hyvinkaa.fi` | `Disallow: /` | `noindex, nofollow` |
| Jyväskylä | `julkinen.jkl.fi` | `Disallow: /` | `noindex, nofollow` |
| Vantaa | `paatokset.vantaa.fi` | ei tiedostoa (404) | `noindex, nofollow` |

**Vantaa näytti ensin poikkeukselta** — ei `robots.txt`-tiedostoa lainkaan —
mutta sivun metatiedossa on sama ohje kuin muilla. Palvelimelta puuttuu
tiedosto, ei tahtotila.

Kielto on toimittajan vakio eikä kunnan kanta: kolmen kunnan `robots.txt` on
tavulleen sama tiedosto (26 tavua, sama sha1), ja Oulun ja Hyvinkään
`Last-Modified` on sama sekunnilleen. Syy vakioon on ilmeinen — pöytäkirjat
ovat julkisia mutta sisältävät henkilötietoja, ja vakiintunut käytäntö on että
ne ovat luettavissa mutta eivät hakukoneella löydettävissä. Perustelut
[D-031](../03_DECISIONS.md):ssä.

Kaikille viidelle tarvitaan siis kunnan lupa tai vaihtoehtoinen lähde.
Jyväskylä ei sitä kaipaa, koska CaseM kattaa sen. Vantaa on tärkein: 46
puuttuvaa hanketta, eniten koko listalla.

**LUPAA KYSYTTIIN, JA VASTAUS ON KOLMESTI EI (tilanne 1.9.2026).** Yllä
oleva päätelmä "kielto on toimittajan vakio eikä kunnan kanta" pitää
teknisesti paikkansa mutta johti väärään odotukseen: kun kunnalta
kysytään, kunta ei kumoa vakiota vaan vahvistaa sen.

| kunta | vastaus | peruste kirjeessä |
|---|---|---|
| Hyvinkää (21.8.) | ei | ohjaa RSS-syötteeseen, ei muita sivupyyntöjä |
| Lappeenranta (30.8.) | ei | julkaisujärjestelmässä ollut paljon ongelmia |
| Oulu (1.9., D-160) | ei | tasapuolisuus + kuormitusriski asianhallintaan |

Oulun vastaus on niistä perustelluin ja siksi paras ennuste lopuille:
lupa yhdelle tarkoittaisi luvan antamista kaikille pyytäjille, ja
järjestelmätoimittajan mukaan kutsut voivat heikentää asianhallinnan
käytettävyyttä. Kumpikaan peruste ei ole meistä kiinni eikä muutu
paremmalla pyynnöllä.

Kysyminen kannattaa silti — se maksaa yhden sähköpostin ja tuottaa
kirjallisen tiedon siitä mitä saa hakea — mutta **Tweb- ja
LOOTA-kaupunkeja ei kannata laskea tulevan kattavuuden varaan.**
Vaihtoehtoinen lähde (kaavoitussivu, RSS, Hilma) on niissä oikea polku.

## Neljä viimeistä kaupunkia: kaksi auki, kaksi kiinni

Lappeenranta, Kouvola, Seinäjoki ja Porvoo eivät löytyneet automaattisesti,
koska niiden `paatoksenteko`-sivuilla ei ole linkkiä järjestelmään. Linkki on
**alasivulla** "Esityslistat ja pöytäkirjat". Kolmas taso riitti kaikille
neljälle:

| kaupunki | järjestelmä | alusta | robots |
|---|---|---|---|
| Kouvola | `ep10.kouvola.fi` | Dynasty | ei tiedostoa |
| Porvoo | `porvoofi.oncloudos.com` | Dynasty | ei tiedostoa |
| Seinäjoki | `listat.seinajoki.fi` | Tweb | `Disallow: /` |
| Lappeenranta | `mfiles.lappeenranta.fi` | **M-Files** | `Disallow: /` |

**Porvoo oli koko ajan oncloudos.com:issa** — aliverkkotunnus on vain
`porvoofi` eikä `porvoo`, joten aiempi 40 kunnan testi meni ohi yhden tavun
takia. Kouvolalla on oma verkkotunnus.

Lappeenranta on **kuudes alustaperhe**: M-Files, dokumenttienhallinta eikä
päätösjärjestelmä. Sitä ei tarvitse selvittää pidemmälle ennen kuin robots-
kysymys on ratkaistu, koska se kieltää haun samalla tavalla kuin Tweb.

Mitattu ennen käyttöönottoa: Kouvola 30 ehdokasta (mediaani 6065 merkkiä),
Porvoo 3 ehdokasta (mediaani 4671). Kouvola on paras yksittäinen
Dynasty-kunta tähän mennessä — Monitoimiareenan urakoitsijan valinta,
Kuusankosken yhtenäiskoulu, pääkirjaston peruskorjaus, uusi keskuskeittiö.

Suodatin tiukkeni samalla kahdella mitatulla kuviolla: valtion
perusparannusavustus yksityistielle ei ole kaupungin hanke (kolme osumaa
Kouvolassa), eikä **sopimuksen** purkaminen ole rakennuksen purkamista
(*"yhteistyösopimuksen (TYM) purkaminen"*, Porvoo).

## Tilanne alustoittain

| alusta | kunnat | tila |
|---|---|---|
| Ahjo (Elasticsearch) | Helsinki | tuotannossa |
| Dynasty (RSS) | Espoo, Tuusula, Kuopio, Kirkkonummi, Savonlinna, Tornio | tuotannossa |
| Dynasty (RSS) | Joensuu | tuotannossa |
| Dynasty (RSS) | Kouvola, Porvoo | SQL ajamatta |
| CaseM (GET-haku) | Tampere, Jyväskylä, Rovaniemi, Pori | tuotannossa |
| oma SPA | Turku | tuotannossa |
| Tweb | Vantaa, Oulu, Vaasa, Hyvinkää, Seinäjoki | robots-ohje kieltää |
| M-Files | Lappeenranta | robots-ohje kieltää |

**Kaikki 18 kaupunkia on nyt kartoitettu.** Neljällä jäsentäjällä katetaan
**yksitoista**: Helsinki, Espoo, Kuopio, Tampere, Turku, Jyväskylä,
Rovaniemi, Pori, Joensuu, Kouvola ja Porvoo — sekä viisi pienempää kuntaa
jotka tulivat Dynastyn mukana.

Seitsemän jää ulkopuolelle, ja vain yhdellä syy on tekninen:

| kaupunki | syy |
|---|---|
| Vantaa, Oulu, Vaasa, Hyvinkää, Seinäjoki | Tweb, robots-ohje kieltää |
| Lappeenranta | M-Files, robots-ohje kieltää |
| Lahti | Dynasty toimii, mutta julkaisee vain menettelyasioita |

Kuudessa tapauksessa ei siis ole enää teknistä työtä tehtävänä — kysymys on
luvasta. Vantaa on niistä suurin (46 puuttuvaa hanketta). Lahti on eri
tapaus: sen RSS:ssä on 206 tuoretta asiaa mutta pelkkiä otsikoita kuten
*"Laillisuus ja päätösvaltaisuus"*, eli sisältö julkaistaan muualla.

**Uutta jäsentäjää ei kannata rakentaa ennen kuin lupa-asia ratkeaa**, koska
molemmat jäljellä olevat alustaperheet (Tweb, M-Files) esiintyvät vain
kielletyillä sivustoilla.

---

# Uusintamittaus: sulkiko kuntien päätöslähteiden rakentaminen aukon?

Kun yksitoista kaupunkia oli katettu, 552 puuttuvaa ajettiin uudelleen
kaksivaiheisella menetelmällä.

> **Tämä ajo tehtiin väärällä välineellä.** Oletin että alkuperäinen skripti
> oli kadonnut ja rakensin menetelmän uudelleen (`scripts/rpt-rematch.mjs`).
> Alkuperäinen oli koko ajan versionhallinnassa nimellä
> `scripts/match-rpt-list.ts`. Uudelleenrakennettu versio oli löyhempi, ja
> juuri se tuotti alla kuvatun menetelmäharhan — luvut eivät siis ole
> vertailukelpoisia lähtötason kanssa. Ajo kannattaa toistaa oikealla
> välineellä: `npx tsx scripts/match-rpt-list.ts`. Ks.
> [D-033](../03_DECISIONS.md).

## Otsikkoluku on 165/552, ja se on väärä

Ajo löysi 165 osumaa varmuudella ≥ 0,7. Luku ei kelpaa, ja syy näkyy vasta kun
osumat jaetaan sen mukaan **milloin vastapuolen rivi on luotu**:

| osumatyyppi | kpl | rivi luotu |
|---|---|---|
| hanke | 70 | **kaikki ennen alkuperäistä mittausta** (2026-02…2026-07) |
| katselmointijono | 68 | ennen mittausta |
| katselmointijono | 27 | mittauksen jälkeen |

**Ne 70 hanketta ovat menetelmäharhaa, eivät edistystä.** Alkuperäisellä ajolla
oli täsmälleen sama data käytössään ja se sanoi "ei osumaa". Uusi
toteutukseni sanoo "osuma". Pistokoe kertoo kumpi on oikeassa:

```
0.90  "Hotelli Veska Pirkkalaan"        -> "Pohjolankatu 31 ja 33, Hotelli Kaupin alue"
0.95  "Toimistotalo Kristiinankatu 2"   -> "...Kristiinankatu 5-7 ja Linnankatu 15-17"
0.70  "Kerrostalo ja toimitilat Otokylä ry Ouluun"      -> "Kerrostalo Ouluun"
0.70  "Kerrostalon saneeraus ASO Peltolankaari 13"      -> "Kerrostalo Ouluun"
0.70  "Kerrostalon saneeraus ASO Peltolankaari 3"       -> "Kerrostalo Ouluun"
```

Eri hotelli eri kunnassa, eri katuosoite, ja yksi geneerinen *"Kerrostalo
Ouluun"* imee kolme eri RPT-hanketta. Tämä on sama vikaluokka jonka
alkuperäinenkin ajo raportoi ("22 tapausta, joissa useampi RPT-nimi osui samaan
hankkeeseemme") — nyt vain isompana, koska esikarsintani päästää mukaan
kaava- ja kiinteistörivit, jotka osuvat osoitteella.

**Opetus: täsmäytysajoa ei voi verrata toiseen, jos menetelmä on rakennettu
uudelleen välissä.** Mittausskripti on osa mittausta. Siksi se on nyt
committoitu eikä scratchpadissa.

## Mikä luku kelpaa: 21

Ainoa vertailukelpoinen tulos saadaan kysymällä eri kysymys — **mistä lähteestä
osuma tuli**. Katselmointijonon 95 osumasta kuntien päätöslähteistä on 21:

| kunta | osumaa | kaupungin puuttuvista |
|---|---|---|
| Helsinki | 17 | 67 |
| Espoo | 3 | 66 |
| Kuopio | 1 | 29 |

**Helsingin lähde on kattanut neljäsosan Helsingin aukosta.** Se on koko
linjan todiste: yksi kunnan päätösjärjestelmä, yksi jäsentäjä, 25 % kaupungin
puuttuvista hankkeista. Loput 74 jono-osumaa tulevat lähteistä jotka olivat jo
tuotannossa ennen tätä työtä (kaavoitus, Hilma, yritysten tiedotteet, STT).

**Kaikki 21 ovat yhä tilassa `new`** — katselmoimatta. Lähde on siis tuonut ne
sisään, mutta ne eivät vielä näy asiakkaalle.

## Kahdeksan uutta kuntaa: nolla, ja se on odotettua

Jyväskylä, Rovaniemi, Pori, Joensuu, Kouvola ja Porvoo eivät tuottaneet
yhtäkään osumaa. Niiden SQL ajettiin vasta äsken eivätkä lähteet ole vielä
pyörineet kertaakaan. Mittaus on siis liian aikainen niiden osalta — se
kannattaa toistaa kun jokainen lähde on ajanut muutaman kerran.

## Mitä tästä seuraa

1. **Suunta on oikea, mutta todiste on toistaiseksi yhden kaupungin varassa.**
   Helsinki toimii. Espoon ja Kuopion pienempi osumamäärä EI ole merkki
   heikommasta lähteestä — ks. alla.
2. **Jono ei ole pullonkaula.** 21 osumaa odottaa katselmointia, ja jono
   kasvoi kerralla paljon kun Helsingin lähde tuli tuotantoon. Purkunopeus
   kuitenkin skaalautuu määrän mukana, joten jonon pituus ei ole syy hidastaa
   lähteiden lisäämistä — se on kertaluontoinen piikki, ei rakenteellinen este.
3. **Uusintamittaus vasta kun uudet lähteet ovat ajaneet** — ja alkuperäisellä
   välineellä: `npx tsx scripts/match-rpt-list.ts`. Vain sama skripti tuottaa
   lähtötason kanssa vertailukelpoisen luvun.

## Miksi Espoo ja Kuopio tuottivat vähemmän: ne ovat ajaneet kerran

Osumamäärien vertailu johti harhaan, koska lähteet ovat eri-ikäisiä. Todellinen
tuotos katselmointijonossa:

| lähde | ehdokkaita | ajoja | RPT-osumaa | osumaa / ehdokas |
|---|---|---|---|---|
| helsinki_paatokset | 848 | monta (kehitysajoja 9 vrk) | 17 | **2,0 %** |
| espoo_paatokset | 18 | **1** | 3 | **16,7 %** |
| kuopio_paatokset | 13 | **1** | 1 | **7,7 %** |
| tuusula_paatokset | 17 | 1 | 0 | — |
| kirkkonummi_paatokset | 13 | 1 | 0 | — |
| tornio / savonlinna | 6 / 6 | 1 | 0 | — |

**Ehdokasta kohden Dynasty on Ahjoa selvästi tarkempi**, ei heikompi. Espoo
tuotti kolme RPT-osumaa kahdeksastatoista ehdokkaasta; Helsinki tarvitsi 848
ehdokasta seitsemäätoista varten. Ero absoluuttisissa luvuissa on
ajokertojen ero, ei lähteen laatu.

Dynasty myös toimittaa täsmälleen sen mitä ennen käyttöönottoa mitattiin:
Tuusula 17→17, Kuopio 13→13, Kirkkonummi 13→13, Tornio 6→6, Savonlinna 7→6.
Mikään ei ole rikki.

`discovery_sources.run_count` on **1 jokaisella lähteellä, myös Helsingillä** —
Helsingin 848 ehdokasta syntyivät kehityksen aikaisissa käsiajoissa jotka eivät
kirjautuneet. Kirjanpito ei siis kerro lähteen todellista historiaa.

**Kaksi asiaa jäi auki:**

* **Tampere:** mitattu 10 ehdokasta, jonossa 1. Yhdeksän ei ole
  `source_documents`-taulussa eikä jonossa. Todennäköisin selitys on että ne
  täsmäytyivät olemassa oleviin hankkeisiin eivätkä luoneet uutta ehdokasta,
  mutta sitä ei ole todennettu.
* **Turku:** rekisteröity, mutta `run_count = 0` — ei ole ajanut kertaakaan.
  Kannattaa tarkistaa että se lähtee seuraavassa syklissä.

## Mitä suodatuksesta opittiin samalla

CaseM:n haku on **kokotekstihaku**, joten hakusana osuu asiakirjan runkoon eikä
otsikkoon. Pelkkä poissulkulista ei siksi riittänyt: `peruskorjaus` palautti
otsikot *"Ajankohtaiset asiat"*, *"Ilmoitusasiat / Tekninen lautakunta"* ja
*"Viranhaltijapäätösten otto-oikeus"*. Suodatus siirrettiin Dynastyn
positiiviseen listaan (D-029:n kuvio). Vaikutus hakutulosten otsikkoihin:

| kaupunki | ennen | jälkeen |
|---|---|---|
| Tampere | 311 | 168 |
| Jyväskylä | 46 | 21 |
| Rovaniemi | 116 | 56 |
| Pori | 74 | 19 |

Karsinta mitattiin myös toiseen suuntaan: listasta puuttui kolme sanaa jotka
pudottivat aitoja hankkeita — *"Pirkkala-Linnainmaa -raitiotien
allianssisopimus"*, *"Lentokenttäalueen rakennushanke"* ja *"Neljän tuulen
koulun toteutusmuoto"*. Ne lisättiin. **Positiivista listaa ei voi arvioida
katsomalla vain mitä se päästää läpi.**
