# Työmaakuvat lähteenä — kokeiltava toimintatapa

**Tila: kokeilu, aloitettu 8.10.2026.** Mitattu 14 hankkeella
(Gemma + 13 hankkeen erä 8.10.2026, ks. "Ensimmäinen erä" alla).
Dokumentti on ohje kokeilun ajaksi, ei vakiintunut prosessi — päätös
jatkosta tehdään luvuilla, ei tuntumalla. Päätös: D-252.

**Kuva voi olla myös kuvakaappaus**: LinkedIn-julkaisu, Instagram-tili
tai video. Samat vaiheet pätevät; ero on siinä, että kyltissä on
yleensä hankekohtainen ihminen ja somejulkaisussa yleensä yhtiön
myynti tai viestintä.

## Miksi

**Yhteystiedot ratkaisevat palvelun tulevaisuuden.** Blueprintin §1.1
nimeää kolme syytä miksi testiasiakkaat eivät jääneet; kolmas on
*"liian vähän yhteystietoja — hanke ilman yhteyshenkilöä on
puolivalmis"*. Johannes 6.10.2026 (D-239): *"nyt aloitetaan
keskittyminen yhteyshenkilöihin toden teolla."* Tavoite on
**hankekohtainen** yhteyshenkilö, ei yrityksen yleinen (D-241), ja juuri
sitä verkosta on vaikein saada: verkkohaku löytää sen 36 %:lla hintaan
0,20 € (D-244). Työmaakuvat ovat tämän tavoitteen palveluksessa — ne
ovat paras yksittäinen tapa saada työmaan oma ihminen, ja samalla ne
kertovat mitä lähteitä puuttuu (§1.1:n syy 1, kattavuus).

Työmaakyltti on lakisääteinen ja sisältää sen mitä verkosta ei saa:
**vastaavan työnjohtajan nimen ja suoran puhelinnumeron**. Sama tieto
maksaa verkkohaulla 0,20 € per hanke ja löytyy 36 %:n todennäköisyydellä
(`docs/05_AI.md`). Kyltti osuu kerralla ja maksaa nolla.

Ensimmäinen mitattu tapaus (As Oy Sompasaaren Gemma, Sompasaari,
8.10.2026): yksi valokuva tuotti hankkeen jota **ei ollut kannassa
lainkaan** — nimi, osoite, aikataulu, rakennuttaja, pääurakoitsija,
pääsuunnittelija, lupatunnus ja hankekohtainen yhteyshenkilö suorine
numeroineen.

## Toimintatapa

Jokainen kuva käydään läpi samassa viidessä vaiheessa. Vaiheita ei saa
yhdistää: tarkistus ennen lisäystä on se mikä estää kaksoiskappaleet.

### 1. Lue kyltti

Poimi kaikki mitä kyltissä lukee, myös se mitä et heti tarvitse:
hankkeen nimi, osoite(et), aikataulu, rakennuttaja, pääurakoitsija,
vastaava työnjohtaja yhteystietoineen, suunnittelijat, lupatunnus.

### 2. Tarkista kanta ennen kuin lisäät mitään

Hae **vähintään neljällä avaimella**, koska sama hanke voi olla kannassa
eri nimellä:

| avain | mistä |
|---|---|
| nimi | `projects.name` ja `potential_projects.title` |
| osoite | `projects.location` — molemmat osoitteet erikseen |
| lupatunnus | `metadata.permit_id` / `permit_number` |
| urakoitsija | `builder` ja `developer` |

Hae myös `source_documents`ista: jos asiakirja on, mutta hanketta ei,
vika on jäsennyksessä eikä lähteessä — eri korjaus.

### 3. Täydennä verkosta ja merkitse mistä mikin on

Kyltti on vahva lähde, verkko heikompi. **Älä sekoita niitä**: kirjaa
`metadata.tiedon_lahteet`, jossa on erikseen mitkä kentät tulivat
kyltistä ja mikä URL vahvistaa verkosta haetun.

Jokainen verkosta otettu väite tarvitsee **elävän** URL:n. Ensimmäisessä
kokeilussa kolme Oikotie-ilmoitusta oli jo poistettu (HTTP 410);
asuntomäärä varmistettiin etuovi.com-sivulta joka vastasi.

Jos lähdettä ei ole, kenttä jätetään tyhjäksi. Geneerinen kunnan
etusivu ei ole lähde — se näyttää lähteeltä olematta sellainen.

### 4. Kirjoita suoraan kantaan — jonoon vain epävarma kaksoiskappale

**Muutettu 8.10.2026 (D-252).** Ensimmäinen versio vei rivin jonoon,
koska "hyväksyntä on ihmisen". Johannes: *"Lisää hankkeet suoraan
kantaan koska ne ovat todellisia ja olemassa."* Kuvan tuoja on jo se
ihminen joka hyväksyy, joten jonokierros on kaksinkertainen työ — ja
hyväksyntäreitti tuotti Gemmassa kolme virhettä (D-249).

- **Puuttuu kannasta** → `projects` + `project_phase_history`
  (+ `project_identifiers` jos lupatunnus). `metadata.source:
  "tyomaakyltti"` tai `"kasin_kuvakaappaus"`, `resolver: "manual"`.
- **Löytyy kannasta** → täydennä vain puuttuvat kentät. Nimeä ei
  vaihdeta (kuvan nimi `also_known_as`-listaan), eikä käsin lisättyjä
  osapuolia korvata.
- **Löytyy useana rivinä** → älä yhdistä itse; pari
  `project_duplicate_candidates`-jonoon, kun aiempaa katselmointia ei
  ole (Kurkela–Kuusisto oli kolmena rivinä).
- **Henkilöt:** hankkeen omat `metadata.contact_persons`-listaan
  (`level: "project"`). Yrityksen yleiset johtajat (aluejohtaja,
  yksikön johtaja, toimitusjohtaja) `yritys_yhteyshenkilot`-rekisteriin
  (D-242). Viestintä, HSE, lakiasiat ja työhyvinvointi eivät ole
  ostajia — eivät rekisteriin.
- **Kuivaharjoitus ensin**, ja tuloste luetaan riveittäin. Erässä
  kuivaharjoitus paljasti kaksi keksittyä yksityiskohtaa (nimike jota
  kyltissä ei lukenut, väärä aluekoodi) ennen kirjoitusta.

### 5. Kysy miksi hanke puuttui — ja korjaa lähde

Tämä on vaiheista tärkein. Jokainen puuttuva hanke on vihje puuttuvasta
tai rikkinäisestä lähteestä (RPT-periaate). Jos julkaisija — myös
aliurakoitsija — kertoo saman asian omalla sivullaan eikä ole
`discovery_sources`-taulussa, se rakennetaan lähteeksi
(Kastelli/Kerava-malli: parseri, spec oikealla näytteellä,
kuivaharjoitus, `lisaa-*-lahde.ts`). Instagram ja LinkedIn eivät ole
lähteitä; yhtiön ajankohtaista- tai kohdesivu on.

## Mitä tarkistetaan hyväksynnän JÄLKEEN

Hyväksyntä kirjoittaa kentät uudelleen, eikä se aina osu. Ensimmäisessä
kokeilussa **kolme asiaa meni pieleen** (kaikki korjattu, D-249):

1. **Nimi.** "As Oy Sompasaaren Gemma" muuttui muotoon "Rakennushanke,
   &lt;osoite&gt;". Koodi on korjattu, mutta tarkista silti.
2. **Sijainti.** Hanke osui 3,2 km väärään paikkaan, koska `address`
   sisälsi kaksi osoitetta kauttaviivalla. **Anna vain yksi osoite**;
   toinen kuuluu kuvaukseen.
3. **Keksitty puhelinnumero.** Tekstipoiminta luki lupatunnuksen
   `LP-091-2025-08983` puhelinnumeroksi. Korjattu, mutta tarkista
   yhteystiedot.

Tarkistuslista hyväksynnän jälkeen: nimi, kartalla oikea paikka,
yhteystiedot, vaihe.

## Mitä kokeilusta pitää mitata

Päätös "jatketaanko" tehdään näillä, ei tuntumalla:

- **Montako kuvattua hanketta puuttui kannasta kokonaan?** Ensimmäinen
  otos: 1/1. Yksi hanke ei ole otos.
- **Montako tuotti hankekohtaisen yhteyshenkilön?** Vertailuluku on
  verkkohaun 36 %.
- **Mikä lähde olisi pitänyt poimia hankkeen?** Jokainen puuttuva hanke
  on vihje puuttuvasta tai rikkinäisestä lähteestä
  (`docs/06_KNOWLEDGE_LOG.md`, RPT-periaate). Gemman tapauksessa
  Helsingin rakennuslupa ei ollut tullut mitään lähdettä pitkin, vaikka
  Helsinki on Lupapisteen parhaiten katettu kunta (180 LP-091-mainintaa,
  43 vuodelta 2025). ~~Syy jäi auki~~ — **selvitetty 8.10.2026**, ks.
  alla: Lupapiste-lähde aloitti 2.7.2026 eikä näe sitä vanhempia lupia.

## Ensimmäinen erä 8.10.2026: 13 hanketta

Seitsemän työmaakylttiä (Helsinki, Laajasalo–Herttoniemi) ja kuusi
kuvakaappausta (LinkedIn, Instagram, video).

### Kattavuus: 9/13 puuttui kannasta kokonaan

| | kyltit (7) | kuvakaappaukset (6) | yhteensä |
|---|---|---|---|
| puuttui kokonaan | 5 | 4 | **9** |
| oli, täydennettiin | 2 | 2 | 4 |

Kaikki neljä olemassa ollutta saivat jotain mitä kannassa ei ollut:
yhteyshenkilöitä, oikean osoitteen ja karttapisteen (Nihti osui
Helsingin keskustaan), pääurakoitsijan (Valurinpuisto) tai
aliurakoitsijan.

### Yhteyshenkilöt: kyltti antaa työmaan ihmisen

Tiukalla määritelmällä (nimi + puhelin tai sähköposti, D-239):

| mistä | hankkeita joilla hankekohtainen henkilö |
|---|---|
| kuvasta itsestään | 4/13 |
| kuva + verkkohaku samaan hankkeeseen | 8/13 |
| **työmaan oma ihminen** (vastaava tj / työmaapäällikkö / työpäällikkö), kyltit | **3/7 nimellä** + 1 numero ilman nimeä |

Ero kylttien ja kuvakaappausten välillä on laadullinen: kyltti antaa
**työmaan** ihmisen (Tencon, Pohjola, Skanska — vastaava työnjohtaja
suorine numeroineen), somejulkaisu ja verkko antavat **myynnin tai
johdon** (asuntomyyjä, toimitusjohtaja). Aliurakoitsijaa myyvälle
käyttäjälle edellinen on se joka ratkaisee.

### Lähteet: viisi korjausta yhdestä kävelystä

Jokainen puuttuva hanke kysyttiin "miksi". Vastaukset:

| syy | korjaus | mitä toi |
|---|---|---|
| Varten keräin hylkäsi uuden "Urakat"-tunnisteen | 771934f | LOAS Baletti ja jatkossa kaikki Varten urakat |
| Pääurakoitsijan omaa sivua ei luettu | VRJ lähteeksi (D-250) | 3 ehdokasta jonoon |
| Aliurakoitsijan sivua ei luettu | Torppari, Pelti-Ässät (D-250) | 12 ehdokasta jonoon (3 ohitettu) |
| Kaupungin vuokrayhtiön uudiskohdelistaa ei luettu | Heka (D-251) | 8 kohdetta, 5 uutta |
| Helsingin luvat ennen 2.7.2026 | **ei korjattavissa lähteellä** | ks. alla |

**Lupapisteen sokea piste.** Kuusi kuvattua Helsingin hanketta (Gemma +
viisi Laajasalosta ja Herttoniemestä) oli saanut luvan 2024–2025.
Lupapiste-lähde aloitti 2.7.2026, ja kuulutus poistuu verkosta
(muistio: vanhenevat lähteet). **Nyt rakenteilla olevat hankkeet ovat
juuri niitä joiden lupa on vanhempi kuin lähde** — eli tämä aukko ei
umpeudu itsestään ennen kuin nykyinen rakennuskanta on valmistunut.
Se on suurin yksittäinen syy siihen miksi kävelyllä löytyy puuttuvia
hankkeita, ja se kannattaa ratkaista erikseen (esim. Helsingin
rakennusvalvonnan karttapalvelu tai kunnan aloitusilmoitukset).

## Arvio: mitä tämä tapa on ja mitä se ei ole

**Se ei skaalaudu tiedonkeruuna.** Yksi ihminen, yksi kävely, 13
hanketta. Kannassa on ~5 500 hanketta; käsin ei kateta mitään
merkittävää osuutta.

**Se skaalautuu mittauksena.** Kävely on satunnaisotos todellisuudesta,
jota mikään lähde ei valikoi. 9/13 puuttuvaa kertoo kattavuudesta
enemmän kuin mikään sisäinen mittari, koska sisäinen mittari näkee
vain sen minkä lähteet jo tuovat. Ja jokainen puuttuva hanke johti
lähteeseen joka tuo **muitakin** hankkeita: lähdekorjaukset toivat
jonoon 15 ehdokasta ja Hekasta 5 uutta kohdetta, joita kukaan ei kuvannut.

**Ja se on paras saatavilla oleva yhteystieto.** Työmaan oma ihminen
kyltistä maksaa nolla ja on oikea. Mikään automaattinen lähde ei tuota
vastaavaa työnjohtajaa — paitsi kyltti itse.

Johtopäätös: käytä työmaakuvia **otoksena ja lähdeauditointina**, ja
pidä silmällä suhdelukua "puuttui kannasta". Kun se laskee selvästi
(esim. alle kolmannekseen), lähteet kattavat ja kävely voi harventua.
Jos käyttäjät joskus kuvaavat kylttejä itse, sama prosessi toimii —
mutta se on tuoteidea, ei tämän kokeilun tulos.

## Tietosuoja ja julkinen repo

Kyltissä on yksityishenkilön nimi ja puhelinnumero. Tieto saa mennä
kantaan — se on tuotteen tarkoitus — mutta **ei koskaan repoon**, joka
on julkinen. Skriptit jotka sisältävät yhteystietoja kirjoitetaan
työhakemiston ulkopuolelle, ja lisäys tarkistetaan ennen committia.

## Toinen erä 8.10.2026 illalla: 8 LinkedIn-julkaisua

Kaikki kuvakaappauksia, ei kylttejä. Profiili erosi ensimmäisestä:
**viisi kahdeksasta oli valmistuneita hankkeita** (Lummen kolme
hoivakotia, Kasarminkatu, Kuusijärven savusaunat, Keilaniemen Portti,
DB Schenkerin halli). Yritykset julkaisevat LinkedInissä mieluiten
valmistumisen ja harjannostajaiset, eivät aloitusta.

| | |
|---|---|
| puuttui kannasta | 7/8 (Päijät-Hämeen RV 8 oli, ilman kaupunkia ja rakennuttajaa) |
| lisätty | 10 riviä, joista 6 valmistunutta ja 4 aktiivista |
| ohitettu | Schenkerin halli (sijainti ei selvinnyt), Maalinjan yötyö (liian pieni) |
| hankekohtainen yhteyshenkilö | 0 |

Valmistuneet kirjattiin `phase: "Valmistunut"`, `status: "completed"`
**ilman vaihehistoriaa**, jottei asiakas saa hälytystä valmiista
kohteesta. Niiden arvo on osapuolissa: kuka rakentaa kenelle
(WelCo hoivakoteja Lummelle, VM Suomalainen Vantaalle).

**Arvokkain löydös tuli sivupolulta.** Erkkiheikkilän julkaisu johti
Kouvolan pöytäkirjoihin, joista löytyi kaksi aktiivista hanketta
(Kasarminmäentie–Voimalankatu 1,16 M€, Länsiasemantie 1,55 M€) ja
kierrätyskeskus.

**Sama rakenteellinen aukko kuin Lupapisteessä:** Kouvolan
päätöslähde alkoi 9.8.2026, joten sitä ennen tehdyt urakkapäätökset
(10/2024, 5/2026) eivät tulleet. Lähteen alkupäivää vanhemmat
päätökset ja luvat ovat järjestelmällisesti näkymättömiä — ja juuri
ne ovat nyt rakenteilla.

**Keilaniemen Portti:** STT-tiedote haettiin 24.9.2026, mutta
valmistumistiedote ei tuottanut ehdokasta. Todennäköisesti
tarkoituksellinen suodatus (valmis kohde ei ole myyntimahdollisuus),
ei vika.

**Lähteitä ei lisätty:** Lumme julkaisee 7 tiedotetta 21 kuukaudessa
(liian harvoin), LapWall ja Mer Architects valmiita referenssejä,
Erkkiheikkilä vain LinkedInissä (Kouvolan päätökset kattavat sen
jatkossa).

## Joukkoistettu kuvaus: Crowdsorsa (selvitys 21.10.2026)

**Tila:** Johannes lähetti Crowdsorsalle pilottiehdotuksen (Turku ja
Tampere, palkkio hyväksytystä työmaataulun kuvasta). Vastausta ei ole
vielä. Johannes on itse kokeillut palvelua pelaajana (lupiinitehtävä:
kohde kartalla, kuva ennen ja jälkeen, tarkistus, palkkio tai ei).

### Miksi tämä on yhteystietotavoitteen ydin

Tavoite on, että **jokaisella hankkeella on yhteystieto**, ja
rakenteilla olevilla sen pitäisi onnistua juuri kylttien kautta:
rakenteilla olevalla työmaalla on aina kyltti, ja kyltti antaa työmaan
oman ihmisen (3/7 omassa kävelyssä, ks. yllä). Mikään automaattinen
lähde ei tuota vastaavaa työnjohtajaa.

Mittarin taso (TIC, `yhteystieto_kattavuus`, D-239/D-241), 21.10.2026:

| vaihe | hankkeita | hankekohtainen | kaikki (myös yrityksen) |
|---|---|---|---|
| Rakenteilla | 850 | **556 (65 %)** | 648 (76 %) |
| Suunnittelussa | 1 702 | 1 287 (76 %) | 1 368 (80 %) |

**Osuus ei liiku.** 6.10. rakenteilla oli 474/725 (65 %), 21.10.
556/850 (65 %): uusia hankkeita tulee 125, ja ne tulevat samalla
osuudella kuin vanhat. Lähteiden lisääminen kasvattaa nimittäjää ja
osoittajaa samassa suhteessa — osuuden nostaminen vaatii uuden
mekanismin, ei lisää samaa.

### Kohdelista: mitä kuvaajille voisi antaa

Rakenteilla olevista **294 hankkeelta puuttuu hankekohtainen
yhteyshenkilö** (mitattu 21.10.2026, sama joukko kuin mittarissa).

| | hankkeita |
|---|---|
| ilman hankekohtaista yhteyshenkilöä | 294 |
| joilla tarkka koordinaatti (ei kaupungin keskipiste) | 187 |
| joilla katuosoite numerolla | 82 |
| **molemmat — valmis karttakohteeksi** | **75** |

Kaupungeittain (294): Helsinki 50, Tampere 32, Espoo 22, Turku 19,
Oulu 17, Vantaa 12. Karttakohteiksi kelpaavat 75: Helsinki 18, Tampere
12, Espoo 8, muut alle 5. Tyypeittäin: infra 81 + sillat 14 (kyltti
on, mutta työmaa on pitkä tieosuus — vaikea kohdistaa), loput
rakennuksia (kerrostalo 65, koulu 28, toimitila 15, hoivakoti 12…).

**Johtopäätös:** kohdistettuun pilottiin on heti valmiina noin 75
kohdetta. Loput ~110 tarkan koordinaatin kohdetta tarvitsevat
osoitteen ennen kuin ne voi antaa kuvaajille — ja juuri osoitteen
puute on usein sama syy kuin yhteyshenkilön puute. Avoin "etsi uusi
työmaa" -tehtävä on ainoa tapa löytää kannasta kokonaan puuttuvat
(omassa kävelyssä 5/7 kylteistä).

### Tarkennus: työmaan oma ihminen on harvinainen (mitattu 21.10.2026)

Johannes: *"kyltissä oleva vastaavan nimi on eri asia kuin joku yleinen
yritysnumero."* Mittarin "hankekohtainen" (D-241) tarkoittaa mitä
tahansa hankkeen omasta asiakirjasta poimittua nimettyä henkilöä —
myös tilaajan projektipäällikköä, toimitusjohtajaa tai tiedotteen
viestintäpäällikköä. Se ei kerro onko hankkeella **työmaan** ihmistä.

Rakenteilla 850 hanketta, luokiteltu yhteyshenkilön nimikkeen mukaan
(työmaan rooli = vastaava työnjohtaja, työnjohtaja, työmaapäällikkö,
työpäällikkö, työmaainsinööri, rakennuspäällikkö):

| | hankkeita |
|---|---|
| työmaan oma ihminen | **45 (5 %)** |
| muu nimetty henkilö | 511 (60 %) |
| ei hankekohtaista | 294 (35 %) |

"Muu nimetty" -ryhmän henkilöistä 439:llä ei ole nimikettä lainkaan;
nimetyt ovat projektipäälliköitä (37), toimitusjohtajia (26),
viestintää (31) ja johtoa. Osa nimikkeettömistä voi olla työmaan
väkeä, mutta valtaosa tulee tiedotteiden ja päätösten
yhteystietolohkoista.

**Kohdelista tällä määritelmällä:** 805 rakenteilla olevaa hanketta
ilman työmaan ihmistä, joista **213 valmiita karttakohteiksi**
(tarkka koordinaatti + katuosoite) ja 480 tarkalla koordinaatilla.
Aiempi 75 on niiden osajoukko, joilta puuttuu yhteyshenkilö kokonaan
— luonteva pilotin ensimmäinen erä, mutta koko potentiaali on 213.

**Mittari ei näe tätä.** Jos työmaan ihminen on tavoite, se tarvitsee
oman lukunsa (esim. kolmas neula tai rivi TIC:iin). Ei rakennettu —
päätös Johannekselle.

### Crowdsorsa (Finnora Oy) — mitä siitä tiedetään

- Tampere, perustettu 2020 (Toni Paju), 8 henkeä, liikevaihto 587 000 €
  (2024). Business Finland -rahoitus; toimintaa Suomessa, Ruotsissa,
  Virossa, Isossa-Britanniassa, Kanadassa ja Yhdysvalloissa.
- **Hakee nyt yksityisen sektorin asiakkaita** (Business Finland 2025);
  tähän asti asiakkaat kuntia ja luonnonsuojelujärjestöjä.
- Malli: asiakas tilaa tehtävän ja rahoittaa palkkiot, Crowdsorsa ajaa
  tehtävän pelissä ja tarkistaa laadun. Tehtävät ovat sijaintiin
  sidottuja, ja kerätty kohde katoaa kartalta kaikilta — sama kohde ei
  tule kahdesti. Pelaajia "tuhansia", paljon nuoria.
- Pelaajan ansio "jopa 20 €/h"; Helsingin pyörätiekartoituksessa
  keskimäärin yli 3 €/km. **Asiakashintoja ei ole julkaistu.**
- **Lähin vastine:** Tampereen kaivonkannet, 23 500 kpl kuvattu
  24 tunnissa — kiinteä esine tunnetussa paikassa, yksi kuva riittää.
  Sama tehtävätyyppi kuin työmaataulu. Muut: Helsinki 550 km pyöräteitä
  90 minuutissa, vieraslajeja 500 000 m² neljässä viikossa.
- **Yksityiset asiakkaat tähän mennessä (STT-uutishuone, 7 tiedotetta
  4/2025–10/2026):** vain **Kotipizza Group** (5/2025: henkilöstö teki
  pelissä yli 1 000 ilmastotekoa — vastuullisuus- ja sitouttamiskäyttö,
  ei datankeruuta) ja **Riesa Consultative Oy** (Riihimäen
  esteettömyyspalautteen kehityskumppani, ei maksava asiakas). Muut
  tiedotteet: kunnat (Rovaniemi, Riihimäki, Kajaani, Kemi) ja WWF.
  **Yksityistä datankeruun asiakasta ei ole julkisesti** — Tyomaat.fi
  olisi ensimmäinen, ja toistuva tarve (työmaat vaihtuvat) on heille
  uusi markkina. Tämä on neuvotteluvaltti hinnoittelussa.
- Sijainti ja aikaleima tallentuvat (videoissa varmasti, kuvissa
  Johanneksen kokemuksen mukaan); toimitusmuotoa (API, CSV) ei ole
  kuvattu julkisesti.

Lähteet: businessfinland.fi (Crowdsorsa improves the world with data
and crowd power, 2025), crowdsorsa.com, tuusula.fi 29.4.2025,
Interreg Europe (Forssa), Tampereen yliopiston kenttätutkimus.

### Pilotin rakenne (ehdotus)

1. **Kohdistettu osa:** 75 valmista karttakohdetta koordinaatteineen;
   budjetti ennustettava (kohteet × palkkio). **Johannes 21.10.2026:
   tämä 75 kohteen lista käy pilotiksi sellaisenaan** — kaupunkirajaus
   (Turku/Tampere) ei ole välttämätön, kun kohteet annetaan listana.
   Lista jakautuu: Helsinki 18, Tampere 12, Espoo 8, muut alle 5;
   kysy Crowdsorsalta, riittääkö pelaajia pienten kaupunkien kohteisiin.
   Lista mitataan uudelleen juuri ennen lähettämistä (vanhenee).
2. **Avoin osa:** "kuvaa työmaa jota ei ole kartalla" — maksetaan vain
   kannasta puuttuvista. Kysy onko heillä tällaista tehtävätyyppiä.
3. **Palkkio tiedosta, ei kuvasta:** täysi palkkio jos kyltissä on
   nimetty henkilö numeroineen, pienempi jos vain yrityksen vaihde.
4. **Katto:** liikevaihto 248 €/kk (10/2026); 200 kuvaa × 3–5 € +
   alustamaksu on kuukausien liikevaihto. Pilotti 100–200 kuvaa.
5. **Mitataan samat luvut kuin omassa kävelyssä:** kuinka moni puuttui
   kannasta, kuinka moni antoi työmaan oman ihmisen, ja muuttuuko
   rakenteilla-mittarin hankekohtainen osuus.
6. **Käsittelyputki ennen volyymia:** käsin yksi kyltti vie ~10 min.
   Satoja kuvia varten tarvitaan kuvasta rakenteinen poiminta, vertailu
   kantaan ja kuivaharjoitus.

### Kysymykset palaveriin

- Toimitusmuoto: kuvat, koordinaatit ja aikaleimat — API, CSV?
- Voiko kohteet antaa koordinaattilistana? Onko avoin "etsi"-tehtävä?
- Voiko hyväksymisehdon määritellä itse ("kyltti luettavissa")?
- Alustamaksu vs. pelaajan palkkio; pilotin vähimmäiskoko.
- Henkilötiedot: kumpi on rekisterinpitäjä, käsittelysopimus, kuvien
  oikeudet ja sivullisten sumennus. Kylteissä on yksityishenkilön nimi
  ja numero — se on tarkoitus.
- Turvallisuus: kuva aidan ulkopuolelta, ei työmaa-alueelle.

### Arvio 21.10.2026: työmaan ihminen tuotteena ja Crowdsorsa kumppanina

**Työmaan oma ihminen erottaa meidät.** RPT/Hubexon tutkijat soittavat
rakennuttajille ja omistajille (yhteyshenkilö omistaja- ja
päättäjätasolla), Metroc lukee julkisia päätöksiä (päättäjätaso).
Kumpikaan ei lupaa työmaan vastaavaa työnjohtajaa — ja pienelle
aliurakoitsijalle tai toimittajalle juuri hän on ostaja. Viesti
"soita suoraan työmaalle" sopii matalan hinnan omaan markkinaan
eikä kilpaile Hubexon vahvuudella. Kuvan aikaleima antaa todisteen:
"tarkistettu työmaalla [pvm]".

**Crowdsorsa kumppanina on hyvää markkinointia:**
- Tekee yhden hengen palvelusta uskottavan: kenttäverkosto ilman
  palkattuja tutkijoita — moderni vastine Hubexon 63 hengen
  puhelintiimille.
- Kumppanin maine (Business Finland, kuntareferenssit, vieraslajit)
  siirtyy osin meille.
- Crowdsorsa tarvitsee ensimmäisen yksityisen datankeruun referenssin,
  joten se todennäköisesti tiedottaa ja käyttää meitä myynnissään —
  ilmaista näkyvyyttä myös startup- ja kuntapiireihin.

**Riskit ja niiden hallinta:**

| riski | hallinta |
|---|---|
| Pelillisyys kuulostaa kevyeltä B2B-ostajalle | viestitään tulosta (tarkistettu työmaatieto pvm:llä), ei peliä |
| Kuvaaja aidan sisällä tai kuvaa työntekijöitä | tehtäväohje + Crowdsorsan tarkistus hylkää |
| Kumppani on 8 hengen startup | kohdelista ja käsittelyputki pidetään omana — kumppani vaihdettavissa |
| Kopioitavuus: Crowdsorsa myy kenelle tahansa | pyydä **toimialan yksinoikeus määräajaksi** (esim. 12 kk); neuvotteluasema olemassa, koska olemme ensimmäinen |
| Liian aikainen julkisuus kertoo mallin kilpailijoille | **tiedotetaan vasta pilotin tulosten jälkeen** |
| Henkilötiedot: kerätty muualta kuin henkilöltä itseltään | GDPR 14 art. informointi ja oikeutettu etu tarkistetaan (juristi) ennen volyymia; tietosuojaseloste kattamaan kylttitiedot |
| Työnjohtajan kuormitus myyntipuheluilla | puhutaan "työmaan yhteystiedosta", ei "henkilökohtaisesta numerosta"; ehdot 3.5.5 rajaavat asialliseen hankekohtaiseen B2B-yhteydenottoon |
| Lupaus ilman katetta (nyt 45/850 = 5 %) | ei markkinoida ennen kuin pilotti näyttää luvun |

**Kilpailijat:** Hubexo tuskin reagoi julkisesti pieneen toimijaan;
työmaatason keruu ei ole sen ydinmallia, mutta se voisi ostaa saman
Crowdsorsalta, jos malli näkyy toimivana. Metroc keskittyy julkisiin
päätöksiin eikä tähän.

**Järjestys:** pilotti → tietosuoja kuntoon → yksinoikeus sopimukseen →
vasta sitten markkinointi.

### Pilotin alue päätetty 22.10.2026: Helsinki, 90 kohdetta

Crowdsorsan toimitusjohtaja Toni Paju soitti 22.10.2026 ja pyysi
kohdelistan Excelinä hinnoittelua varten. Johannes: *"pitäisi olla
maantieteellisesti mahdollisimman tiivis alue"* — 75 kohteen lista oli
hajallaan ympäri Suomea, joten se hylättiin pilotin pohjana.

Tiiviysvertailu (rakenteilla, ei työmaan omaa yhteyshenkilöä, tarkka
sijainti):

| alue | kohteita | prio 1 | mediaani keskipisteestä | 90 % säteellä |
|---|---|---|---|---|
| **Helsinki (valittu)** | **90** | 33 | 5,1 km | 8,3 km |
| Tampere | 40 | 23 | 3,2 km | 7,6 km |
| Pääkaupunkiseutu | 160 | 57 | 7,9 km | 13,0 km |

Helsinki valittiin: riittävä otos tiiviillä alueella, ja Helsingistä on
jo näyttö Lupapisteen sokeasta pisteestä (6/6 kuvattua puuttui).
Tiedosto: `exports/Tyomaat_Crowdsorsa_kohdelista_Helsinki_2026-10-22.xlsx`
(ei repossa; ei henkilötietoja — nimi, osoite, koordinaatit, tyyppi,
prioriteetti). Prioriteetti 1 = ei yhteyshenkilöä lainkaan (33),
2 = ei työmaan omaa (57). Tyypeittäin kerrostalo 43, infra 10, koulu 6,
toimitila 6, päiväkoti 5.
