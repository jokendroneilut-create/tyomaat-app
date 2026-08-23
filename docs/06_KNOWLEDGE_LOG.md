# Työmaat.fi – Construction Knowledge Log

## Purpose

This document stores construction market observations, assumptions and expert knowledge before they are converted into rules, inference logic or product features.

The goal is to preserve domain knowledge separately from code.

---

## Format

Each note should include:

- Observation
- Why it matters
- Possible system use
- Confidence
- Status

---

## Notes

### KL-001 – Cibus and Lidl

Observation:
Cibus Nordic Real Estate AB often owns and develops buildings used by Lidl.

Why it matters:
If an early permit or planning document names Cibus as applicant, the final tenant or user may likely be Lidl even if Lidl is not mentioned.

Possible system use:
Entity Extractor detects Cibus.
Inference Engine suggests likely tenant Lidl.

Confidence:
Medium / High

Status:
Candidate for future inference rule.

---

### KL-002 – Customer role depends on customer type

Observation:
Different customer groups need different contacts from the same construction project.

Examples:
- Equipment rental companies often look for project managers or site managers.
- Concrete suppliers often look for procurement managers.
- Architects often look for developers or project owners.
- Building material suppliers often look for procurement or project management contacts.

Why it matters:
The same Candidate Project should be presented differently to different customer profiles.

Possible system use:
Customer Matching Engine recommends the most relevant contact role per customer profile.

Confidence:
High

Status:
Partially represented in customerProfiles.ts.

---

### KL-003 – Kuntien vuokrataloyhtiöiden nimi kertoo kunnan

Observation:
Kuntien vuokrataloyhtiöt rakennuttavat käytännössä vain oman kuntansa alueella,
ja niiden nimi/lyhenne kertoo kunnan luotettavasti. Esim. **VAV** (VAV Asunnot Oy
= Vantaan Vuokra-asunnot) → kaikki hankkeet Vantaalla. Vastaavia: Heka
(Helsinki), TVT (Turku), Espoon Asunnot (Espoo). HUOM: TA/Y-Säätiö, Kojamo/Lumo,
SATO ym. ovat valtakunnallisia (eivät päde) — lisää vain kunnat jotka ovat varmoja.

Why it matters:
Hilma-ilmoituksen työmaan kaupunki puuttuu usein rakenteisesta datasta ja
vapaasta tekstistä (tilaajan osoite = hankintayksikkö, ei työmaa). Tilaajan nimi
on tällöin luotettavin sijaintivihje. Ilman kaupunkia hanke ei näy alueittain
suodatetuissa näkymissä (mm. Tänään).

Possible system use:
`hilmaResolver.ts` → `KNOWN_LOCAL_BUYER_CITIES` -taulukko (sanarajalla `\bvav\b`,
ettei "Nivavaara"/"Rovavaara" osu). Laajennettavissa uusilla varmennetuilla
paikallistoimijoilla. Lisäksi resolveri päättelee kaupungin, jos työmaa on
samalla kadulla kuin tilaajan osoite (kiinteistönomistaja remontoi omaa taloaan).

Confidence:
High (VAV varmistettu käyttäjältä). Uusia yhtiöitä lisättävä vain kun kunta on
varma — valtakunnalliset toimijat eivät päde.

Status:
Koodissa (KNOWN_LOCAL_BUYER_CITIES): VAV (Vantaa), Heka (Helsinki), TVT (Turku),
Espoon Asunnot (Espoo), Sivakka (Oulu), Niiralan Kulma (Kuopio), VTS-Kodit
(Tampere), Kirkkonummen Vuokra-asunnot (Kirkkonummi). Kaikki varmistettu
olemassa oleviksi ja yhden kunnan toimijoiksi. Muut lisätään tapauskohtaisesti
kun kunta on varma — esim. JVA (Jyväskylä), Lahden Talot, Pikipruukki (Vaasa)
ovat todennäköisiä mutta vahvistamatta.

---

### KL-004 – Hilman ilmoituksessa on rakenteinen suorituspaikka, mutta harva täyttää sen

Observation:
eForms-ilmoituksessa on oma kenttä työn suorituspaikalle (BT-5101,
`realizedLocation`). Mitattu 21.8.2026 kaikista ehdokkaista, joilta osoite tai
kunta puuttui (306 kpl): **noin kolmasosassa kenttä oli täytetty**, lopuissa oli
koodi `anyw-cou` ("missä tahansa maassa") tai kenttä oli tyhjä. Täytetty kenttä
on tarkka — se on tilaajan itsensä ilmoittama työmaan osoite, ei hankintayksikön
käyntiosoite.

Kaksi ansaa mitattiin: osa tilaajista laittaa kenttään oman **postilokeronsa**
("PL 125"), ja postinumeroissa on lyöntivirheitä (kuusinumeroinen "123390").

Varsinaiset tarjouspyyntöasiakirjat, joissa osoite lähes aina on, ovat
toimittajaportaalissa (tarjouspalvelu.fi / Cloudia) **rekisteröitymisen takana**.
Ilmoituksen "Liitteet ja linkit" sisältää vain ilmoituksen oman PDF-tulosteen.

Why it matters:
Tämä on tarkin saatavilla oleva työmaan osoite ilman kirjautumista, ja se on
riippumaton vapaan tekstin jäsennyksestä. Ilman osoitetta hanke ei paikannu
kartalle eikä osu osoitepohjaisiin hakuihin. Täydentää KL-003:a: kun kenttä on
täytetty, se voittaa tilaajan nimestä pääteltävän kunnan.

Possible system use:
`lib/agent/hilmaRealizedLocation.ts`; kutsutaan `hilmaResolver.ts`:stä vain kun
osoite tai kunta puuttuu. Kenttä ei tule käyttämästämme hakurajapinnasta
(`avp/eformnotices`) vaan vaatii erillisen haun ilmoitussivun rajapinnasta.

Kentän `cityName` on usein kylä tai ruotsinkielinen nimi ("Ylämylly",
"Jakobstad", "Sirkka"), jota kuntaluettelo ei tunne — silloin osoite otetaan
mutta kunta jätetään tyhjäksi.

Confidence:
High — mitattu 306 ilmoituksesta, ei arvio.

Status:
Koodissa ja ajettu takautuvasti (D-092). Kuntahaku laajennettu 21.8.2026
ruotsinkielisillä nimillä, lakanneilla kunnilla ja mitatuilla kylillä (D-093),
jolloin loputkin tunnistuivat — paitsi ulkomainen "Venice", joka jää oikein
tunnistumatta.

---

### KL-005 – Lupapisteen rakennuslupa kertoo hankkeen, mutta vain PDF:ssä ja vain hetken

Observation:
Lupapisteen kuulutusrajapinta antaa hankkeesta vain lyhyen toimenpidenimikkeen
(mitattu 21.8.2026: 15–119 merkkiä, esim. "Rakentamista valmistelevat työt").
Varsinainen sisältö on päätösasiakirjan PDF:ssä, keskimäärin 6 500 merkkiä.
Siellä on hakijan oma kuvaus hankkeesta, kaavan käyttötarkoitus, pinta-alat,
massamäärät ja hankkeen vaativuusluokka.

Mitattu tapaus: Vantaan LP-092-2026-02341 (Mittalinja 1) on rajapinnassa
rutiinikaivuu, mutta PDF kertoo että kyse on **tulevien datakeskusrakennusten**
ja lämmöntalteenottorakennuksen pohjatöistä — kaivualue 42 465 m², louhinta
22 621 m², kaava T-6 teollisuus- ja varastorakennusten korttelialue.

**Kuulutus poistuu verkosta muutoksenhakuajan päätyttyä**, tyypillisesti noin
kuukauden kuluttua päätöksestä ("Julkaisu poistuu verkosta 25.9.2026"). PDF
katoaa samalla. Mitattu: 491 tallennetusta kuulutuksesta PDF irtosi enää
275:ltä, eli 216 oli jo mennyt.

Why it matters:
Rakennuslupa on aikaisin luotettava signaali isosta hankkeesta — aikaisempi
kuin kilpailutus. Mutta lupa myönnetään valmistelevalle työvaiheelle, jonka
nimike ei kerro mitään lopullisesta kohteesta. Pelkän rajapintatekstin varassa
datakeskus, logistiikkakeskus ja omakotitalon pohjatyöt näyttävät samalta.

Possible system use:
`lib/agent/lupapisteBulletinPdf.ts`; haku tehdään collectorissa keräysvaiheessa
eikä jälkikäteen, koska aikaikkuna sulkeutuu. Koko teksti tallennetaan
`raw_payload.bulletin_pdf_text`-kenttään pysyväksi kopioksi.

Kuvauksen poiminta on rajattu lainausmerkeissä olevaan hakijan tekstiin
(otsikko "Hankkeen kuvaus hakemuksella/hakemuksessa"). Se osuu harvoin (3/275),
koska kunnat käyttävät eri lomakepohjia — mutta osuessaan se on oikea.
Tallennetusta tekstistä voi poimia lisää myöhemmin ilman että data ehtii kadota.

Confidence:
High — mitattu 491 kuulutuksesta.

Status:
Koodissa ja ajettu takautuvasti (D-096). Avoin: muiden kuntien lomakepohjista
ei ole vielä poimintaa, ja PDF sisältää myös pinta-alat ja kaavatiedot joita ei
vielä lueta omiksi kentikseen.

## 2026-08-23 – Rudolf Steiner -koulun pari, ja oma mittausvirhe

Rakennuslehden hanke ei osunut jo hyväksyttyyn Jatken tiedotteeseen.
Syy EI ollut veto: kaikki neljä vetoa testattiin eikä yksikään laukea.
Pari hylätään todisteiden puutteesta.

```
A: helsingin | rudolf | steiner | koulun     | laajennusurakka | jatke
B: helsingin | steiner-koulussa | käynnistyy | korjausurakka
```

Ainoa yhteinen sana on kuntanimi. "koulun" ja "steiner-koulussa" ovat
sama sana eri taivutuksessa — sama ilmiö kuin [D-106]:ssa, jonka
korjausyritykset mitattiin ja hylättiin. **Pelkkä sama kunta ei riitä
yhdistämiseen eikä pidäkään riittää**, joten täsmäytys toimii tässä
oikein. Pari on yhdistettävissä vain käsin.

### Oma mittausvirhe, joka kannattaa muistaa

Ensimmäinen selitykseni oli väärä. Väitin että kaikilta 50
Rakennuslehti-ehdokkaalta puuttuu kaupunki. Luin kenttää `city`, jota
**`potential_projects`-taulussa ei ole** — sarake on `municipality`.
PostgREST palautti tyhjän eikä virhettä, koska en tarkistanut `error`ia,
ja `undefined` näytti puuttuvalta arvolta.

Oikeat luvut:

```
rakennuslehti-ehdokkaita:      50
  ilman kuntaa:                11     (ei 50)
  niistä korjattavissa:         3
Steiner-ehdokkaan kunta:  "Helsinki"  (oli jo täytetty)
```

Kahdeksan yhdestätoista on **oikein tyhjiä**: kaksi Liettuassa ja yksi
Virossa, viisi markkinauutisia ilman työmaata ("Datakeskusbuumi näkyy
tukkukaupassa", "Skanska-pomo varoittaa").

Korjattu käsin luettuina: Parainen, Rovaniemi, Lappeenranta.

**Opetus:** kun kysely palauttaa nollan rivin, syy voi olla puuttuva
sarake eikä puuttuva data. Tarkista `error` aina — kaksi kertaa saman
päivän aikana (`projects.property_id`, `potential_projects.city`)
kysely epäonnistui hiljaisesti ja johti vääriin johtopäätöksiin.

### Automaattinen kunnan päättely ei kelpaa sellaisenaan

23 ehdokasta joilla kunta olisi pääteltävissä tekstistä, luettu
riveittäin: 21 oikein, kaksi kelvotonta.

```
"Varte rakentaa hoivakotia Nokialle"  -> Tampere
   kuvaus: "Varte Tampere on aloittanut... Nokialla"
   yrityksen nimessä oleva paikannimi voitti

"Härmälänojan silta"                  -> Pirkkala
   kuvaus: "Tampereen ja Pirkkalan kuntarajalle"
   kohde on rajalla, kumpikaan ei ole väärin eikä oikein
```

Jokainen tapaus jossa päättely onnistui **pelkästä otsikosta** oli
oikein (15/15); molemmat virheet tulivat kuvauksesta. Jos tämä joskus
automatisoidaan, otsikko on luotettavampi ankkuri kuin koko teksti.


## 2026-08-23 – Puuttuva kunta ei ole systeeminen ongelma

Tarkistettu kaikki lähteet molemmista tauluista:

```
HYVÄKSYTYT (asiakkaille näkyvät)     54 / 5 749    1 %
JONO                                398 / 7 897    5 %
```

**Valtaosa on oikein tyhjiä.** Jonon suurin kasa on `stt_haku` (239), ja
ne ovat tiedotteita joilla ei ole työmaata lainkaan: "Keskuskauppakamari:
velkakonversiomahdollisuus", "ETL:n terveiset budjettiriiheen",
"Ilmaisku vaurioitti Pelastakaa Lasten toimipistettä Ukrainassa".

Hyväksytyistä 54:stä useimmat ovat maakunnallisia infraurakoita joilla ei
ole yhtä kuntaa — "Päällystystyöt 2026 – Satakunta", "Siltatyöt
Varsinais-Suomessa", "Rantaradan kehittäminen Karjaa–Kauklahti",
"Merenkurkun kiinteän yhteyden esiselvitys". **44:llä 54:stä maakunta on
tiedossa**, ja se on näille oikea tarkkuus.

### Genetiivipäättelyä EI kytketä tekstihakuun

`inferMunicipalityFromText` ei käytä yhtään kuntahakufunktiota, vaikka
`municipalityFromGenitive` osaa "Liedon" → Lieto. Kytkentä näytti
ilmeiseltä parannukselta. Mitattu otsikoista, tulos **6/10 väärin**:

```
Rantasalmi  <- "Rantaradan kehittäminen"       rantarata on Helsinki–Turku
Muurame     <- "peruskivi muurattiin"          verbi
Puolanka    <- "Puolan panttijärjestelmän"     maa
Paltamo     <- "Paltan laskelma"               työnantajajärjestö
Sulkava     <- "Sulkavuoren keskuspuhdistamo"  Tampereella
Pyhäntä     <- "Pyhänselän 400 kV"             Muhoksella
```

Syy: funktio tekee viiden merkin etuliitehaun yksikäsitteisyysehdolla.
Se on turvallinen kun syöte on jo tiedossa kuntanimeksi (kuntakenttä,
hankintayksikön nimi), mutta vapaassa tekstissä se osuu verbeihin ja
maiden nimiin. Käyttökonteksti ratkaisee, ei funktio.

Kaupunginosien ja taajamien nimet (Lievestuore, Malminkartano, Jorvas,
Kannelmäki, Pohjois-Haaga, Kimola) vaatisivat oman taulukkonsa;
`PLACE_ALIASES` kattaa 57 nimeä eikä näitä ole siinä. Se on eri työ.


## 2026-08-23 – Kaupunginosataulukkoa ei rakenneta

Kysymys oli: kannattaako kaupunginosien ja taajamien nimistä tehdä
taulukko, jotta "Malminkartanon asematunneli" osaisi Helsinkiin?

Taulukko louhittiin OMASTA DATASTA eikä muistista: riveiltä joilla kunta
on tiedossa poimittiin otsikon nimisanat, ja nimi kelpasi vain jos se
esiintyi yhdessä ainoassa kunnassa. Mitattu kolmella kynnyksellä:

```
kynnys   taulukon koko   täyttäisi
  2         4 838 nimeä    73 / 450 tyhjää
  3         1 097          34 / 450
  5           386          18 / 450
```

**Virheitä on jokaisella tasolla, myös tiukimmalla:**

```
Porvoo    <- "Kokemäenjoen ylittävät Koiviston sillat"   sillat ovat Porissa
Oulu      <- "Iijoen ratasilta"                          Iijoki on Iissä
Helsinki  <- "Jorvin sairaalan palvelut"                 Jorvi on Espoossa
Hyvinkää  <- "Lujan tulosinfo 13.2.2026"                 ei hanke lainkaan
```

**EI RAKENNETA.** Kaksi syytä:

1. Hyöty on pieni. Ne 450 tyhjää ovat valtaosin rivejä joilla *ei
   kuulukaan* olla yhtä kuntaa — maakunnallisia päällystysurakoita
   ("Päällystystyöt 2026 – Satakunta") ja tiedotteita ilman työmaata.
   Oikeasti korjattavia on kymmenkunta.

2. Ylläpito on jatkuvaa ja hiljaista. Taulukko vanhenee ja vinoutuu sen
   mukaan mitä lähteitä kertyy, eikä tuhannen nimen listaa lue kukaan
   läpi. Virheet eivät näy missään ennen kuin asiakas ihmettelee miksi
   espoolainen sairaala on Helsingissä.

Helsinki-rajattu versio olisi tarkempi (Malminkartano, Kannelmäki,
Pohjois-Haaga, Itäkeskus ovat yksiselitteisiä), mutta täyttäisi noin
kymmenen riviä — sama työ ilman parempaa tulosta.


## 2026-08-23 – Poimimattomat kentät muissa lähteissä

Lupapisteen jälkeen tarkistettiin systemaattisesti, onko muissa
lähteissä vastaavaa: mittarina lähdedokumenttiin talletetun raakatekstin
määrä verrattuna siihen mitä hankkeelle päätyy.

**Suurin osa suurista eroista on näennäisiä.** Raakateksti on usein koko
HTML-sivu tai WP-rajapinnan JSON, josta valtaosa on runkoa:

```
Espoon kuulutukset      86 777 merkkiä raakaa  ->  140  (koko HTML-sivu)
Lempäälä                38 936                 ->  499  (JSON + section-HTML)
Senaatti-kiinteistöt    19 510                 ->  470  (WP-postin JSON)
```

Näissä poiminta on jo olemassa; ero on muotoa, ei puuttuvaa tietoa.

### Aito löydös: kaavaselostukset

Kaavalähteiden `attachments`-kentässä on **1 935 PDF-liitettä**, joista
**245 on kaavaselostuksia** — 184 hanketta 56 kunnassa. Yhtäkään ei
haeta.

Kolme haettua näytettä osoittaa mitä niissä on:

```
"Päivi Muhonen puh. +358 44 4598 434 paivi.muhonen@saarijarvi.fi"
"Kaavan laatija: Sitowise Oy, Timo Huhtinen DI, YKS 245"
```

Eli **nimetty henkilö puhelimineen ja sähköposteineen** sekä kaavaa
laativa konsultti — juuri se tieto jota koko päivä on etsitty.

**MUTTA KOKO ON ONGELMA.** Näytteet olivat 229 000, 284 000 ja 884 000
merkkiä. Koko tekstin tallentaminen 245 selostukselle olisi satoja
megatavuja, eikä sitä kannata tehdä (vrt. sama päivä: 195 MB
mittaustuloksia meni vahingossa git-historiaan).

**Ehdotus jos tähän palataan:** haetaan vain `selostus`-nimiset PDF:t,
poimitaan niistä VAIN yhteystietolohko ja kaavan laatija, ja
tallennetaan poiminta — ei koko tekstiä. Sama kuin Lupapisteessä, mutta
tiukemmin rajattuna kokoluokan takia.

Muut 1 690 PDF-liitettä ovat kaavakarttoja, osallistumis- ja
arviointisuunnitelmia ja kuulutuksia; niissä ei ole yhteystietoja
samalla tavalla.


## 2026-08-23 – Liitteet käytiin läpi kaikista lähteistä

Kaavaselostusten poiminnan (D-114) jälkeen tarkistettiin, onko muissa
lähteissä vastaavaa. Haku ei rajoittunut avainnimiin vaan etsi **minkä
tahansa .pdf-osoitteen mistä tahansa kentästä**, myös raakatekstistä.

```
lähteitä joissa PDF-osoitteita:  73
PDF-osoitteita yhteensä:      2 092
```

**Käytännössä kaikki ovat kaavalähteitä.** Ei-kaavalähteitä on viisi,
yhteensä 32 PDF:ää, ja ne ovat kohinaa:

```
26  Espoon kuulutukset      päätösluettelo (vain kirjaamo@espoo.fi),
                            ja "Siirretyt ajoneuvot" -kuulutus
 2  Senaatti                asukastilaisuuden kutsu, 2017 asiakirja
 2  STT                     EK:n mediainfo
 1  Hilma                   ruotsinkielinen tarjouspyyntö
 1  Lupapiste               kaupunkitilaohje
```

### Kaavaliitteiden jakauma ja mitä kustakin saa

```
1 106  muu            kuulutuksia, luontoselvityksiä, seurantalomakkeita
  375  OAS            osallistumis- ja arviointisuunnitelmat
  245  kaavaselostus  POIMITAAN (D-114) — 76 nimettyä henkilöä
  204  kaavakartta
    5  kaavamääräykset
```

**OAS ja "muu" tarkistettiin otoksella, eivätkä ne kannata.** Neljästä
OAS-näytteestä kahdessa ei ollut kontaktia ja kahdessa oli roskaa
("Jyväskylä Jyväskylä" = ELY:n osoite). "Muu"-lokerosta saatiin vain
kunnan kirjaamo (`kirjaamo@multia.fi`,
`kirjaamo.keski-suomi@ely-keskus.fi`) — sama tieto joka on jo D-104:n
kuntarekisterissä.

Selostus on siis ainoa liitetyyppi jossa on nimetty henkilö suorine
yhteystietoineen, ja se on nyt poimittu. **Liitteiden osalta ei jää
tunnettua aukkoa.**
