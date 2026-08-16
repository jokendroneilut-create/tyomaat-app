# Työmaat.fi – Kilpailijat

Kuka muu myy samaa asiaa samalle asiakkaalle, mitä hän myy ja millä hinnalla.
Tarkoitus ei ole seurata kilpailijaa vaan tietää **mihin emme voi kilpailla ja
mihin meidän on pakko** — asemointipäätös on turha ilman kilpailijan
kustannusrakennetta ja hintaa.

Täydentää dokumentteja [`00_PRODUCT_BLUEPRINT.md`](00_PRODUCT_BLUEPRINT.md)
(miksi olemme olemassa) ja [`04_ROADMAP.md`](04_ROADMAP.md) (mitä seuraavaksi).
Kattavuusvertailu RPT:tä vastaan on omassa tiedostossaan:
[`rpt/README.md`](rpt/README.md).

**Päivitys:** lisää havainto päivämäärällä ja kerro mistä se on peräisin
(sivusto, oma käyttökokemus, asiakas). Ero on olennainen: markkinointisivun
väite ja mitattu tosiasia eivät saa näyttää samalta.

---

Suoria kilpailijoita on kaksi, ja ne edustavat kahta eri mallia:
**RPT Smart** kerää datan ihmisillä ja myy kalliisti, **Metroc** kerää sen
automaatiolla ja myy keskihintaan. Jälkimmäinen on meidän mallimme — ja siksi
vaarallisempi vertailukohta.

---

## RPT Smart (Hubexo Finland Oy)

Markkinan vanha ja suuri toimija. Havainnot 16.8.2026 myyntisivulta, FAQ:sta ja
tukisivustolta, ellei toisin mainita.

### Yritys

| | |
|---|---|
| yhtiö | Hubexo Finland Oy, Ruukinkuja 3, Espoo |
| ent. nimi | RPT Byggfakta (konserni Byggfakta Group → Hubexo, loppuvuosi 2024) |
| historia | Suomessa 1975, konserni 1936 (Ruotsi) |
| konserni | ~25 maata, ~2 500 työntekijää |
| omistus | Stirling Square Capital Partners, TA Associates, Macquarie Capital |

Omistuspohja on pääomasijoittajavetoinen. Se tarkoittaa katteen optimointia ja
tuotteiden yhdenmukaistamista yli maiden — ei nopeaa paikallista reagointia
Suomen erityispiirteisiin.

### Hinta — mitattu, ei arvattu

**600 €/kk pelkästään Uudellamaalla, kun mukana ovat kaikki hanketyypit**
(uudisrakentaminen, sisäpuoliset korjaukset jne.). Lähde: Johanneksen oma
käyttökokemus palvelusta. Sivustolla hintaa ei julkaista lainkaan; FAQ sanoo
vain että hinta "riippuu markkina-alueesta ja palvelun käyttötarkoituksesta".

Tämä on analyysin tärkein yksittäinen luku, ja siitä seuraa kolme asiaa:

1. **Paketointiakselit ovat alue ja hanketyyppi.** Molempia rajaamalla
   syntyy halvempi hinta — eli asiakas maksaa siitä, ettei näe koko markkinaa.
   Yksi maakunta täydellä hanketyyppivalikoimalla on 7 200 €/v; koko Suomi on
   moninkertainen.
2. **Se on yritysmyynnin hinta, ei työkalun hinta.** 600 €/kk edellyttää että
   asiakkaalla on nimetty myyntiorganisaatio, jolle hankevirta on
   liiketoiminnan ydin. Pieni urakoitsija ei osta sitä, vaikka FAQ vakuuttelee
   ettei palvelu ole "vain suurille yrityksille".
3. **Se on meidän hintakattomme referenssi.** Emme voi olla kalliimpia
   kattavuudella, joka on mitatusti heikompi (ks. alla).

### Miten data kerätään — tämä on koko juttu

FAQ:n vastaus lähes sanatarkasti:

> "Käytämme kehittynyttä datankeruuta, **paikallisia tutkimustiimejä** ja
> **suoria lähteitä julkisilta ja yksityisiltä projektin omistajilta**."

Eli ihmiset soittavat rakennuttajille. Se selittää kaiken muun: yksityiset
hankkeet, yhteyshenkilöt, urakkamuoto, kustannustaso, demon takana oleva hinta
ja 600 €/kk. **Tätä ei skrapata.**

### Väitteet ja mitä ne oikeasti sanovat

| väite sivulla | tulkinta |
|---|---|
| "Pohjoismaiden suurin hanketietokanta" | brändiväite |
| "yli 50 000 ajantasaista aktiivista projektia" | **ei kerrota onko Suomi vai Pohjoismaat**; alaotsikko "Kokeile Suomen suurinta hanketietokantaa" jättää tämän tahallaan auki. Todennäköisesti pohjoismainen luku. |
| "20.000+ käyttäjää" | pohjoismainen, ei Suomen |
| "100 vuoden ajan" | konsernin ikä, ei Suomen toiminnan |

### Tuotteen mekaniikka (tukisivustolta)

- **Kaksi näkymää:** *Hanketietokanta* (koko kanta, sama kaikille yrityksen
  käyttäjille, tyypillisesti vuosi takautuvasti) ja *Minun valintani* (vain
  omien suodattimien läpäisevät hankkeet, yritykset ja kontaktit).
- **Suodatinulottuvuudet:** vaihe (esim. "arkkitehdin valinta"), alue,
  rakennustyyppi (hotellit, ravintolat, teollisuus…), kustannustaso,
  **käytetyt materiaalit**.
- **Kilpailutus-suodatin erikseen:** urakan tyyppi, alue, puitesopimukset
  mukaan/pois.
- **Yrityshaku:** nimi, kotipaikka, rooli, hankkeiden sijainti; järjestys
  hankemäärän tai rakennuskustannusten mukaan; yritysten lisääminen
  seurattaviin.
- **Sarakkeet:** hankkeen nimi, aloituspäivä, valmistuminen, yhteyshenkilön
  nimi, urakkamuoto, rakennuttaja, urakoitsija. Käyttäjä järjestää itse,
  tulostaa tai vie PDF:ksi.
- **Myyntityökalut kannan päällä:** vastuuhenkilö, muistiinpanot, tehtävät,
  ranking-lista, tallennetut haut, yritysanalyysi, CRM-API.
- **Push:** sähköposti-ilmoitukset päivityksistä, "Smartin hankesuositukset",
  interaktiivinen kartta.

Ydinparadigma on **haku ja suodatus**: käyttäjän on tiedettävä mitä etsii ja
rakennettava suodattimet itse. Tuki on YouTube-videoita per toiminto, mikä
kertoo tuotteen opettelukynnyksestä.

### Myyntimalli

Ei julkista hintaa, ei itsepalvelurekisteröintiä, ei ilmaista kokeilua. Ainoa
polku sisään on demo nimetyn account managerin kanssa (sivulla kolme myyjää
kuvineen). Sama data monetisoidaan monta kertaa: Smart, Smart Tender,
SIR-tietokanta, Rakennusfakta, Forecon PRIX, ProdLib, suoramarkkinointi,
Tactics, rakennusmarkkinaennuste ja hankkeiden markkinaindeksi. Yksi
keruukustannus, monta tuotetta — rakenne kestää, ja Smartin hintaa voi
tarvittaessa subventoida.

### Missä he ovat edellä — luvut omalta puolelta 15.8.2026

| ulottuvuus | RPT | me |
|---|---|---|
| yksityiset hankkeet | tutkimustiimi soittaa omistajille | ei systemaattista lähdettä |
| investointipäätösvaihe | ydinaluetta | **76 % puuttui** 726 hankkeen otoksesta ([rpt/README.md](rpt/README.md)) |
| kustannusarvio | suodatettava kenttä | puuttuu 96 %:lta |
| urakoitsija | sarake | puuttuu 86 %:lta |
| rakennuttaja | sarake | puuttuu 59 %:lta |
| yhteyshenkilöt | sarake + yrityshaku | ei ole |
| urakkamuoto, materiaalit | suodatettavissa | ei ole |
| jakelu | 20 000 käyttäjää, myyntiorganisaatio, 50 v suhteet | 70 tiliä, 30 aktiivista |

**Suodatinkenttä on tuotteessa turha jos kenttä on tyhjä.** Heidän
suodatinvalikkonsa on käytännössä luettelo siitä, mitä meiltä puuttuu. Meillä
alue ja vaihe ovat ainoat lähes täydelliset ulottuvuudet.

Lisähavainto omasta täsmäytyksestä: 22 tapauksessa useampi RPT-nimi osui yhteen
meidän hankkeeseemme, koska **heidän rajauksensa on hienojakoisempi** (rakennus
kerrallaan, ei "Kerrostalo Finnooseen").

### Missä he ovat haavoittuvia

1. **Kustannusrakenne on ihmisiä.** Tutkimustiimi on sekä moat että lattia
   hinnalle. 600 €/kk yhdestä maakunnasta ei voi laskea murto-osaan ilman että
   keruu ja myyntikäynti lakkaavat kannattamasta.
2. **Demo-portti on kitkaa.** Ei kokeilua, ei hintaa, ei itsepalvelua. Jokainen
   asiakas maksaa myyntikäynnin ennen kuin näkee tuotteen.
3. **Työ on käyttäjällä.** Tuote antaa suodattimet ja kannan; relevanssin
   määrittely ja ylläpito jää käyttäjälle. "Hankesuositukset" on ensimmäinen
   askel tästä pois, mutta se on markkinointimaininta ilman tukiartikkelia —
   todennäköisesti tuore ja kevyt.
4. **Alue- ja hanketyyppirajaus on asiakkaan kannalta huono kauppa.** Asiakas
   maksaa siitä, ettei näe koko markkinaa. Tämä on suoraan hyökättävissä.
5. **Vanha ilmainen julkinen hankelista on kuollut** (`rakennushankkeet.rpt.fi`
   → HTTP 526, ei korjattu). Hakukonenäkyvyys ja ilmainen sisäänheitto
   menetetty.

**Älä oleta erottautumista siitä mitä heillä ei muka ole:** sähköpostidigestit
relevanteista hankkeista heillä jo on ("saat relevantit projektit ja
päivitykset suoraan sähköpostiisi"). Se ei ole meidän erottautumisemme.

---

## Metroc Oy

Läheisin kilpailija — **sama malli kuin meillä**: julkiset lähteet, automaattinen
keruu, tekoälyrikastus, suosittelumalli. Havainnot 16.8.2026 sivustolta ja
julkisista taloustiedoista.

### Yritys ja luvut

| | |
|---|---|
| perustettu | 29.8.2019, Helsinki (Antinkatu 3 D) |
| perustajat | Jussi Virnala (tj.), Janne Johansson |
| rahoitus | 300 k€ enkelikierros → 2 M€ kierros |
| liikevaihto 2024 | 1,2 M€ (+19,6 %), 18 hlöä, liiketulos −0,6 M€ |
| **liikevaihto 2025** | **1,4 M€ (+16,0 %), 23 hlöä, liiketulos −0,2 M€ (−8,4 %)** |
| asiakkaat | "400+ rakennusalan yritystä", Suomi ja Ruotsi |

Kaksi asiaa luvuista. **Tappio on kutistunut −52 %:sta −8 %:iin** — malli
skaalautuu ja he ovat lähellä kannattavuutta 23 hengellä. Mutta **kasvu on
16 %**, mikä on riskirahoitetulle ohjelmistoyhtiölle vaatimatonta. Markkina ei
siis räjähdä; se on hidas ja myyntivetoinen.

### Johdettu hinta ≈ 290 €/kk

Hintaa ei julkaista, mutta se on laskettavissa: 1,4 M€ / 400+ asiakasta ≈
**3 500 €/v ≈ 290 €/kk keskimäärin per asiakas**. Varaukset: luku sisältää
kaikki viisi tuotetta ja molemmat maat, ja "400+" on 2026 kun liikevaihto on
2025 — todellinen keskihinta on pikemminkin hieman korkeampi, luokkaa
300–400 €/kk.

Yhdessä RPT:n 600 €/kk (yksi maakunta) kanssa tämä antaa markkinan
hintahaarukan: **automatisoitu tuote ~300 €/kk, ihmiskeruu ~600 €/kk ja ylös.**

Sopimusehdot (`/yleiset-ehdot`): koko sopimuskausi **laskutetaan etukäteen**,
maksuaika 14 pv, sopimus **uusiutuu automaattisesti** ellei irtisanota 60 pv
ennen kauden loppua. Konserniyhtiöt tarvitsevat oman sopimuksen. Tämä on
vuosisopimusmyyntiä, ei kuukausitilausta.

### Tuoteperhe — viisi erillistä tuotetta

| tuote | sisältö |
|---|---|
| **Projects** | "yli 100 000 meneillään olevaa ja tulevaa rakennushanketta"; kartta- ja listanäkymä; suodattimet sijainti, hankeluokka, vaihe, kustannusluokka; **luonnollisen kielen haku** ("kirjoita mitä etsit", synonyymihaku); **suosittelumalli joka oppii tarpeista**; markkinaseuranta, asiakasseuranta, kohdeseuranta; päättäjäkontaktit ja yritystiedot hankkeeseen linkitettynä |
| **Public Investments** | kunnat, kaupungit, hyvinvointialueet, valtionvirastot; **"miljoona sivua" pöytäkirjoja ja budjettiasiakirjoja** tekoälyanalysoituna; **AI Chat** ("kysy mitä vain julkisista investoinneista"); organisaatiohakemisto (budjetit, investointiohjelmat, päätökset, yhteyshenkilöt kaavoituksesta, hankinnoista ja teknisestä johdosta); Hilman ja muiden portaalien seuranta; automaattiset hälytykset alueen, organisaation ja aihepiirin mukaan |
| **Real Estates** | 3,9 milj. kiinteistöä, 2,9 milj. rakennusta; **yli 70 karttatasoa** (kaavat, pohjavesialueet, väestörakenne, muuttoliike, ikäjakauma); rakennusvuosi, pinta-ala, käyttötarkoitus, lämmitysmuoto; **hankehistoria kiinteistökohtaisesti** |
| **Buildings** | As Oy / K Oy -rakennukset; isännöitsijät, kiinteistömanagerit, huoltoyhtiöt, **hallituksen jäsenet**; korjausrakentamisen kohdehaku; CRM-toiminnot |
| **Lead** | liidityökalu edellisten päälle; segmenttisivut rakennusliikkeille, urakoitsijoille, suunnittelijoille ja tavarantoimittajille |

Integraatiot nimeltä: **HubSpot, Salesforce, Pipedrive, CSV/Excel**.

Hankevaiheet, jotka he sanovat kattavansa: kaavoitus, suunnittelukilpailut,
tontit ja kiinteistökaupat, rakennushankkeiden suunnitelmat, julkisten
hankintojen ilmoitukset ja hankintapäätökset. "Ohjelmistomme kokoaa tietoa
tuhansista lähteistä."

### Mitä tämä tarkoittaa meille — epämiellyttävä osa

**Metroc Public Investments on täsmälleen se siirto, jonka RPT-analyysi ehdotti
meille seuraavaksi.** Kuntien budjetit, pöytäkirjat, investointiohjelmat,
päätökset ja päättäjien yhteystiedot — se aukko, jonka mittasimme 76 %:n
puutteena, on heillä tuotteistettuna ja AI-chatin takana. Siirto on yhä
tehtävä (aukko on meidän, ei heidän), mutta **se ei ole erottautuminen.**

Sama koskee muuta erottautumisvarastoa: luonnollisen kielen haku, oppiva
suosittelumalli, kartta, CRM-integraatiot ja seurannat ovat heillä jo. Ainoa
ero suosittelussa on, että heillä se oppii käyttäjän toiminnasta — meillä
palautesignaalia on **kaksi peukkua** ([04_ROADMAP.md](04_ROADMAP.md)).

Myönteinen puoli: he ovat 23 hengellä ja 1,4 M€:lla eivät mikään ylivoima, ja
tuoteperheen pirstaleisuus (viisi tuotetta, viisi ostopäätöstä) on aito
heikkous. 16 %:n kasvu kertoo, että myynti — ei tuote — on tämän markkinan
pullonkaula.

---

## Vertailu

| | RPT Smart | Metroc | Työmaat.fi |
|---|---|---|---|
| keruumalli | tutkimustiimit soittavat | automaatio + AI julkisista lähteistä | automaatio + AI julkisista lähteistä |
| hankemäärä (väite) | "yli 50 000" (Pohjoismaat?) | "yli 100 000" | 5 439 asiakkaille näkyvää |
| yksityiset hankkeet | kyllä, ydinaluetta | osin (teollisuus, tontit) | ei |
| julkiset investointipäätökset | tutkimustiimillä | oma tuote, AI Chat | **aukko** |
| yhteyshenkilöt | kyllä | kyllä, päättäjätasolla | ei |
| luonnollisen kielen haku | ei | kyllä | ei |
| suosittelu | "hankesuositukset", kevyt | oppiva malli | pisteytys rakennettu, palaute puuttuu |
| CRM-integraatiot | API | HubSpot, Salesforce, Pipedrive | oma CRM |
| hinta | **600 €/kk / maakunta** (mitattu) | **~300–400 €/kk** (johdettu) | — |
| itsepalvelu / julkinen hinta | ei / ei | ei / ei | — |
| koko | konserni, 2 500 hlöä | 23 hlöä, 1,4 M€ | 1 hlö |

**Hankemääriä ei voi verrata suoraan.** 100 000 ja 50 000 ovat eri asioita eri
rajauksilla; oma 5 439 on suodatettu ja katselmoitu. Luku kertoo enemmän
julkaisukynnyksestä kuin kattavuudesta.

---

## Johtopäätökset asemointiin

**Kattavuuskilpailu on hävitty molempia vastaan.** RPT:tä vastaan siksi että
aukko on puhelinsoittoja; Metrocia vastaan siksi että he tekevät samaa
automaatiota 23 hengellä ja viiden vuoden etumatkalla. Kumpaakaan ei kurota
kiinni lisäämällä lähteitä.

**Ominaisuuskilpailu on niin ikään hävitty.** Luonnollisen kielen haku,
suosittelumalli, kartta, hälytykset, CRM-integraatiot — kaikki on jo olemassa
Metrocilla. Uusi ominaisuus ei ole erottautumista; se on kiinniottoa.

**Mikä jää jäljelle: hinta, läpinäkyvyys ja ostettavuus.** Kumpikaan ei julkaise
hintaa, kumpikaan ei anna kokeilla ilman myyjää, molemmat myyvät
vuosisopimuksen etukäteen laskutettuna. Se ei ole sattumaa vaan seuraus
myyntiorganisaation kustannuksesta — ja siksi se on ainoa rakenteellisesti auki
oleva rako. Julkinen hinta, itsepalvelukokeilu ja kuukausisopimus ovat asioita,
joita kumpikaan ei voi kopioida purkamatta omaa myyntimalliaan.

**Toinen rako: kapeus.** Metroc myy viittä tuotetta neljälle segmentille, RPT
kymmentä. Molemmat vastaavat kysymykseen "mitä kaikkea markkinassa tapahtuu".
Kysymys "mitä minun pitäisi tehdä tänään" on yhä kenenkään omistamatta — mutta
sen voittaminen vaatii, että vastaus on **oikea**, ei että se on olemassa.

**Hinnoittelun ankkuri.** Automatisoidun tuotteen markkinahinta Suomessa on
~300 €/kk (Metrocin toteutunut ARPU) ja ihmiskeruun ~600 €/kk yhdestä
maakunnasta (RPT, mitattu). Alle 300 €/kk hinta on uskottava vain jos tuote on
kapeampi tai ostettavampi — ei jos se yrittää olla sama tuote halvemmalla.

**Mitä tehdä silti:**

- *Investointipäätösvaihe lähteeksi.* Talonrakennusohjelmat, tarveselvitys- ja
  hankesuunnitelmapäätökset (`paatokset.hel.fi` -ketju). Ei erottautumista vaan
  kilpailukelpoisuuden minimi: ilman sitä 76 %:n aukko pysyy ja tuote on
  mitattavasti huonompi molempia vastaan.
- *Hankkeen rajaus hienojakoisemmaksi.* RPT:n lista todisti että "Kerrostalo
  Finnooseen" on oikeasti neljä hanketta.
- *Selvitä Metrocin todellinen listahinta.* ARPU on johdettu luku, ei
  hinnasto. Yksi demo tai yksi asiakas kertoo sen tarkasti — ja se on
  hinnoittelupäätöksen tärkein puuttuva tieto.

---

## Lähteet

**RPT Smart.** Myyntisivu ja FAQ: <https://www.rpt.fi/rpt-byggfakta-smart> ·
tukisivusto: <https://www.rpt.fi/smart-tuki> (alasivut *omat valinnat*,
*suodattimet*, *sarakkeet*, *kilpailutus*, *yrityshaku*) ·
nimenmuutos ja omistus: <https://hubexo.com/news/byggfakta-group-becomes-hubexo/>,
<https://www.stirlingsquare.com/news/byggfakta-group> ·
**hinta 600 €/kk: oma käyttökokemus (16.8.2026).**

**Metroc.** Etusivu ja tuotesivut: <https://metroc.ai/palvelumme/projects/>,
`/palvelumme/public-investments/`, `/palvelumme/real-estates/`,
`/palvelumme/metroc-buildings/`, `/palvelumme/metroc-lead/`,
`/rakennusliikkeet/`, `/tarinamme/` ·
sopimusehdot: <https://metroc.ai/yleiset-ehdot/> ·
taloustiedot: <https://www.asiakastieto.fi/yritykset/fi/metroc-oy/30192269/taloustiedot>,
<https://www.proff.fi/yrityksen/metroc-oy/helsinki/tietokoneohjelmistot-ja-ohjelmistokehitys/3019226-9I009O> ·
rahoituskierrokset: <https://www.rakennuslehti.fi/avainsanat/metroc/>,
<https://metroc.ai/fi/materiaalit/metroc-kerasi-2-miljoonaa-euroa-uudella-rahoituskierroksella/>
