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
