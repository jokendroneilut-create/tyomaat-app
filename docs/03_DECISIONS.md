# Työmaat.fi – Päätökset (ADR-tyyliin)

Merkittäviä suunnittelupäätöksiä ja niiden perustelut, jottei niitä käydä
uudelleen läpi joka sessiossa. Ylin = uusin.

---

### D-097 – Paikallislehti ei ole löytölähde siellä missä kaupungin oma lähde on

Arvioitiin Helsingin Uutiset ja Länsiväylä lähteiksi. **Ei otettu käyttöön.**

Molemmilla on RSS (`/feed/rss`), 30 juttua per syöte. Mitattu 21.8.2026:

| lehti | juttuja | rakentamiseen viittaavia | oikeasti hankkeesta |
|---|---|---|---|
| Helsingin Uutiset | 30 (3,3 vrk) | 6 | **0** |
| Länsiväylä | 30 (9,1 vrk) | 6 | **3** |

Länsiväylän kolmekin purkautuvat luettaessa: valmistunut Jorvin sairaala,
Espoon kaava jonka saamme jo kaupungilta, ja kolumni. Loput ovat jääkiekkoa,
ravintoloita ja kolareita.

**RATKAISEVA TESTI: OLIKO ESIMERKKIJUTTU JO KANNASSA?** Oli. Juttu
"Kuuluisa teollisuuskortteli myllätään Helsingissä" kertoo asemakaavasta,
joka on kannassa nimellä *"Pitäjänmäki, Kutomotie 6 lähialueineen"* —
hyväksytty, vaihe Kaavoitus, lähde SUKKA. Pitäjänmäessä on 7 hanketta,
kaikki kaupungin omista lähteistä.

Tästä yleistys: pääkaupunkiseudun paikallislehti raportoi kaupungin
päätöksistä ja kaavoista, eli **samasta aineistosta jonka keräämme jo
alkulähteeltä** (helsinki_paatokset 519 hanketta, SUKKA 194, lisäksi Espoon
ja Vantaan kaavat). Lehti on jälkijunassa oleva kopio.

**MIKÄ SIINÄ SILTI OLI HYVÄÄ.** Juttu kertoi suunnittelijan (Sitowise),
kerrosluvun ja asukasmäärän, joita kaavarivillä ei ole. Se tekee siitä
rikastuslähteen, ei löytölähteen — eikä rikastus kannata osumatiheydellä
0–3 / 30.

Vertailukohta: `stt_haku` 900 ehdokasta / 355 hyväksyttyä (39 %) ja
`rakennuslehti` 42 / 26 (62 %). Ne tuottavat, koska kattavat koko maan ja
kirjoittavat nimenomaan rakentamisesta. Paikallislehti tekee päinvastoin:
kapea alue, laaja aihepiiri.

**HUOM NIMISEKAANNUS.** Kannassa oleva lähde `helsinki_uutiset` EI ole
Helsingin Uutiset -lehti vaan hel.fi:n kaupungin uutiset. Paikallislehtiä
ei ole yhtään.

**JOS TÄHÄN JOSKUS PALATAAN**, kulma on toinen: molemmat lehdet kuuluvat
samaan konserniin, joten sama `/feed/rss` -muoto toimii todennäköisesti
kymmenillä lehdillä. Arvo olisi **kunnissa joiden omaa kaava- tai
päätöslähdettä meillä ei ole** — ei pääkaupunkiseudulla. Avoin: mitkä kunnat
ovat ilman lähdettä ja onko niissä konsernin lehteä. Tätä ei ole mitattu.

### D-096 – Lupapisteen päätös-PDF on haettava heti, koska kuulutus poistuu verkosta

Vantaan kuulutus LP-092-2026-02341 on rajapinnassa *"Rakentamista
valmistelevat työt"*. Päätös-PDF kertoo mistä on kyse:

> Tulevien **datakeskusrakennusten** ja lämmöntalteenottorakennuksen
> rakentamista valmistelevat pohjatyöt… Kaivuu- ja täyttöalueiden laajuus on
> 42 465 m². Louhinta-alueiden laajuus on 22 621 m².

Ilman PDF:ää iso datakeskushanke näyttää rutiinikaivuulta. Rajapinta antaa
mitatusti 15–119 merkkiä, PDF keskimäärin 6 500.

**AIKAIKKUNA ON KIINNI.** Kuulutuksessa lukee "Julkaisu poistuu verkosta
25.9.2026", ja sen mukana menee PDF. Mitattu 21.8.2026 otoksesta 25
tallennettua kuulutusta: PDF irtosi enää **15:ltä**. Teksti on siis otettava
talteen keräysvaiheessa — myöhemmin sitä ei saa mistään. Siksi haku tehdään
collectorissa eikä erillisessä työntekijässä.

Osoite `api/raw/download-bulletin-doc?bulletinId=…` löytyi sovelluksen omasta
`bulletins.js`:stä; arvatut polut palauttivat 404/401.

**KUVAUKSEN POIMINTA ANKKUROIDAAN OTSIKKOON.** Ensimmäinen versio otti
pisimmän lainausmerkeissä olevan jakson. Mitattu 15 päätöksellä: se osui
yhteen, ja sekin oli väärä kohta — poikkeamispäätöksen perustelu
("Autosuojan nykyinen sijainti ei muutu"), ei hankkeen kuvaus. Otsikkoon
sidottuna poiminta on harvinaisempi mutta oikea. Otsikon loppuosa vaihtelee
kunnittain ("hakemuksella" / "hakemuksessa"), mikä sekin löytyi vasta
kuivaharjoituksesta: yksi kuvaus alkoi sanoilla `hakemuksessa: "`.

Koko PDF-teksti tallennetaan aina, vaikka kuvausta ei poimittaisi — se on
pysyvä kopio siitä mikä muuten katoaisi.

**LÄHDELINKKI.** Lupapiste-riveillä ei ollut lähdelinkkiä lainkaan, joten
"avaa lähde" ei tehnyt mitään. Linkki lisättiin, mutta se toimii vain
kuulutusaikana. Se on hyväksyttävää: katselmointi osuu juuri siihen
ikkunaan, ja sen jälkeen tieto on tallessa omassa kannassa.

Ks. `lib/agent/lupapisteBulletinPdf.ts`,
`scripts/backfill-lupapiste-pdf.ts`.

### D-095 – Otsikkovertailu on Jaccard, ja pitkä lomakeotsikko laimentaa sen

Kysymys oli aiheellinen: eikö yhteisten sanojen pitäisi nostaa pisteitä?
Pitäisi, mutta `titleSimilarity` on **Jaccard** — yhteiset sanat jaettuna
KAIKKIEN sanojen määrällä:

```
"Herttoniemen kirkon purku-urakka"                              3 sanaa
"Purkamislupahakemus, Herttoniemen kirkon purkaminen,
 Herttoniemi, Länsi-Herttoniemi, 091-043-0102-0005,
 Hiihtomäentie 23, Helsingin seurakuntayhtymä, ..."            10 sanaa

yhteisiä 2  ->  Jaccard 2/11 = 0,18   (alle 0,3:n rajan = NOLLA pistettä)
                kattavuus 2/3 = 0,67
```

Kunnan päätösotsikko on lomaketäytettä, jossa toistuvat osoite,
kiinteistötunnus ja kaupunginosat. Se rankaisee lyhyttä, täsmällistä otsikkoa.

**Kokeiltiin `max(jaccard, coverage)` täsmäytyksessä — kaadettiin mittauksessa.**
Duplikaattijono nousi 37 parista 106:een, ja 69 uudesta valtaosa oli vääriä:
Helsingin katusuunnitelmapäätökset jakavat sanat "katusuunnitelmat" ja
kaupunginosan nimen, jolloin kattavuus 0,67 syntyy pelkästä lomakekielestä.

```
 75  NCC toteuttaa Vantaan uuden oikeustalon Tikkurilaan | Sähköasema Vantaalle
 73  Ounasvaarantie, Pallaksentie, katusuunnitelmat, Mellunkylä
     Laakavuorenkuja, katusuunnitelma, Mellunkylä
```

Muutos peruttiin ja lähtötaso todennettiin (37 → 37, 0 uutta).

**Kattavuus vietiin sen sijaan ehdotuslistaan** samalla periaatteella kuin
katuavain (D-094). Kaksi rajausta mitattiin:

1. **Vähintään kaksi yhteistä sanaa.** Yksi riittäisi erottamaan kaksi eri
   taloyhtiötä samassa korttelissa toisistaan väärin perustein
   ("Kuusiluodonrannan Runo" / "Kuusiluodonrannan Saaga" jakavat yhden).
2. **Kuntanimi ei ole yhteinen sana.** Ensimmäinen mittaus tuotti kolme uutta
   ehdotusta, kaikki vääriä ja kaikki pelkän kuntanimen varassa ("Lahden
   sote-keskuksen korjaus" ja "Kokonaispurku-urakka, Lahden Nastolan kohteet"
   jakoivat sanat "lahden" ja "lahti"). Maantiede lasketaan jo `same_city`nä,
   ja ehdotukset haetaan muutenkin vain samasta kaupungista.

Erottelu rajauksien jälkeen:

| pari | kattavuus | yhteiset sanat |
|---|---|---|
| Herttoniemen kirkko (sama) | **0,67** | herttoniemen, kirkon |
| Niuvanniemen sairaala (sama) | **0,67** | niuvanniemen, sairaalan |
| Kuusiluodonranta Runo/Saaga (eri) | 0,50 | kuusiluodonrannan |
| Mellunkylän katusuunnitelmat (eri) | 0,33 | mellunkylä |
| Lahti- ja Vantaa-parit (eri) | 0,00 | – |

Nykyisestä jonosta tämä tuottaa **0 uutta ehdotusta**, eli se ei lisää
katselmoitavaa — se on turvaverkko sille tapaukselle jossa osoite puuttuu ja
katuavain ei siksi auta.

### D-094 – Katuavain kuuluu ehdotuslistaan, ei täsmäytykseen

Herttoniemen kirkon purku oli kannassa kahdesti — Helsingin päätöksistä ja
Hilmasta — eikä pari yhdistynyt eikä edes noussut ehdotukseksi. Syy mitattiin:
`calculateMatch` vertaa osoitteita **merkkijonona sellaisenaan**.

```
ehdokas  "Osoite Hiihtomäentie 23, 00800 Helsinki"
hanke    "Hiihtomäentie 23, Helsinki"
```

Sama rakennus, eri kirjoitusasu → `same_location` ei täyty, ja kun osoite
putoaa, muutakaan todistetta ei jää: otsikkojen samankaltaisuus alle 0,3
(hankkeen otsikko on 160 merkkiä lomaketäytettä) ja rakennuttaja eri
(hankkeella virheellinen "Helsingin kaupunki", ehdokkaalla oikea "Helsingin
seurakuntayhtymä"). Tulos oli **null** — ei edes matalaa pistemäärää.

**Skannaus ei olisi löytänyt sitä koskaan.** Simuloitu ehdokas hyväksyttynä
hankkeeksi: molemmat suunnat null, ja parhaassakin tapauksessa (identtinen
osoite) 60 — alle skannauksen 70:n portin, joka lisäksi vaatii nimi- tai
tunnistetodisteen.

**Ratkaisu ei ole löysentää täsmäytystä.** D-090 mittasi että samalla kadulla
ja numerolla on aidosti eri hankkeita ("Maunonkatu 2, Oulu" = kaksi eri
taloyhtiötä, "Koroistentie 10" = kolme eri hanketta). Katuavain jää siis pois
`calculateMatch`ista ja 70:n rajasta.

Sen sijaan katuavain lisättiin **ehdotuslistaan**, joka on ihmiselle
katsottavaksi ja jossa väärä ehdotus maksaa yhden silmäyksen. Ero on
olennainen: sama tieto on liian karkea automaattiin mutta juuri oikea
ihmiselle. Sama kaupunki vaaditaan, koska kadunnimet toistuvat kunnasta
toiseen ("Koulukatu 15").

**Selauslista oli järjestämätön.** Varalistana näytettiin "25 ensimmäistä
saman kaupungin hanketta" siinä järjestyksessä kuin rivit tulivat kannasta.
Helsingissä on 1 044 hanketta ja etsitty oli sijalla 93 — lista ei siis voinut
näyttää sitä. Nyt järjestys on karkea osuvuus (sama katuosoite, yhteiset
erottelevat sanat), jolloin oikea hanke nousi sijalle **1/1044**.

Mitattu koko jonosta (164 ehdokasta): 49:llä on katuavain, 5:llä osuma
hankkeeseen, ja niistä **1 on uutta tietoa** — täsmälleen tämä tapaus. Loput
neljä näkyivät jo pisteytettyinä. Muutos ei siis tuo kohinaa.

Ks. `lib/projects/streetKey.ts`,
`app/api/tic/projects/match-suggestions/route.ts`.

### D-093 – Kuntaluettelon aliakset mitataan aineistosta, ei arvata

Kuntahaku tunsi vain perusmuotoiset kuntanimet ja kuuden rivin käsilistan
postitoimipaikkoja. Laajennus tehtiin **mittaamalla mitkä nimet oikeasti
jäävät tunnistumatta** (`scripts/measure-unknown-place-names.ts`), ei
kirjoittamalla listaa muistista.

Mittaus paljasti yllättävän ykkösen: **"Pedersöre" esiintyi 26 rivillä**, eikä
se ole kylä tai vanha kunta vaan olemassa oleva kunta, jonka virallinen nimi
rekisterissä on *"Pedersören kunta"*. Samasta syystä ei löytynyt
*"Maarianhamina - Mariehamn"*. Nämä olivat rekisterin nimeämistapa, eivät
puuttuvaa tietoa.

Aliakset jaettiin neljään ryhmään alkuperän mukaan, koska niiden luotettavuus
on eri: postitoimipaikat/kylät, lakanneet kunnat, ruotsinkieliset nimet ja
rekisterin viralliset nimet. Yhteen läjään heitettynä tieto siitä, mihin
kutakin voi luottaa, katoaisi.

**Mitä EI lisätty.** Kirjoitusvirheitä ("Kirkonummi", "Pertumaa", "Kokkolam")
ei legitimoida aliaksena — ne korjataan riviltä (`scripts/fix-city-typos.ts`),
ei hausta. Monitulkintaisia ei myöskään: "Kuivasjärvi" on sekä Oulussa että
Parkanossa, "Kemijoki" on joki ja "Kouvola-Kotka" tieosuus. Ulkomainen
"Venice" jää oikein tunnistumatta.

Tulos: tuntemattomia nimiä 20 → 6, eli 39 riviä sai kunnan.

**Kuntarekisteri tarkistettiin lähdettä vasten.** Kirjoitusvirheen korjaus
kaatui siihen, ettei "Pertunmaa" ollut rekisterissä. Rekisteri verrattiin
Tilastokeskuksen luokituspalveluun (`kunta_1_20250101`): **308/308 täsmää**,
ei puuttuvia, ylimääräisiä eikä nimieroja. Pertunmaa oli 2024-luokituksessa
ja poistui 2025 — se on luokituksen ainoa muutos vuosien välillä, ja kunta
liitettiin Mäntyharjuun 1.1.2025. Lisättiin lakanneisiin kuntiin.

Hankkeen kaupungiksi jätettiin silti "Pertunmaa": korjattiin kirjoitusvirhe,
ei siirretty hanketta toiseen kuntaan. Maakunta ratkeaa aliaksen kautta.

**Testi tarkistaa jokaisen aliaksen kohteen.** Alias ratkaistaan rekisteriä
vasten, joten kohteen kirjoitusvirhe palauttaisi hiljaa tyhjän eikä mikään
kaatuisi. Sen takia testi käy kaikki 55 aliasta läpi ja varmistaa myös, ettei
yksikään avain ole jo rekisterissä (kuollutta koodia).

**Oma virhe, joka löytyi samalla:** edellinen suorituspaikkatäydennys asetti
hankkeelle kaupungin mutta **ei maakuntaa**, jolloin kuusi asiakkaille näkyvää
hanketta putosi alueittain suodatetuista näkymistä. Kaupunki ilman maakuntaa
on huonompi kuin ei kaupunkia lainkaan, koska vika ei näy mistään.
Korjattu sekä skriptissä että takautuvasti
(`scripts/backfill-project-region.ts`).

Ks. `lib/geo/municipalityFromName.ts` (`PLACE_ALIASES`).

### D-092 – Työmaan osoite luetaan ilmoituksen omasta kentästä, ei PDF:stä

Osoitteita jouduttiin kaivamaan käsin Hilman tarjouspyynnöistä. Selvitettiin
voiko sen PDF:n lukea automaattisesti — **ei voi, eikä kannata**:

| Reitti | Tulos |
|---|---|
| "Ilmoituksen PDF" | osoittaa `/print`-tulosteeseen samasta ilmoituksesta |
| `attachments` / `links` rajapinnassa | molemmat tyhjiä |
| "Osallistu hankintaan" → tarjouspalvelu.fi | ohjaa Cloudian kirjautumissivulle, 0 pdf-linkkiä |

Varsinaiset tarjouspyyntöasiakirjat ovat toimittajaportaalissa
rekisteröitymisen takana. Hilman oma ohjeteksti sanoo tämän suoraan.

**Osoite löytyi silti — väärästä kentästä.** eForms-ilmoituksessa on
rakenteinen suorituspaikka `realizedLocation` (BT-5101), jota emme lukeneet.
Käyttämämme hakurajapinta (`avp/eformnotices`) **ei palauta sitä lainkaan**;
kenttä on vain ilmoitussivun omassa rajapinnassa
`web/api/public/procedure/{N}/enotice/{M}`. Siksi resolver tekee nyt toisen
haun — mutta vain kun osoite tai kunta puuttuu.

Mitattu 21.8.2026: 306 vajaasta ehdokkaasta **93 sai osoitteen ja 24 kunnan**,
ja niistä syntyneistä hankkeista 59 sai osoitteen ja 14 kunnan. Noin kaksi
kolmasosaa tilaajista jättää kentän täyttämättä (koodi `anyw-cou` =
"missä tahansa maassa") — juuri niin kävi Isonkyrön latukonehallissa, joka
selvityksen aloitti.

**Kuivaharjoitus paljasti kaksi vikaa, joita testit eivät olisi löytäneet:**
kaksi päällystysurakkaa olisi saanut osoitteekseen tilaajan postilokeron
"PL 125", ja yhden ilmoituksen postinumeroksi oli kirjoitettu kuusinumeroinen
"123390". Molemmat suodatetaan nyt (`isPostBoxOnly`, viiden numeron tarkistus).

Kunta täytetään vain jos kuntaluettelo tunnistaa sen: kenttä sisältää usein
kylän tai ruotsinkielisen nimen ("Ylämylly", "Jakobstad"), jolloin osoite
otetaan mutta kunta jätetään tyhjäksi. 15 tapausta jäi näin ilman kuntaa —
tyhjä on parempi kuin arvattu.

Ks. `lib/agent/hilmaRealizedLocation.ts`,
`scripts/backfill-hilma-realized-location.ts`.

### D-091 – Tunnisteen pitää olla pysyvä, ei ilmoituskohtainen

Sama hankinta julkaistaan Hilmassa useana ilmoituksena (korjaus, jälki-,
keskeytysilmoitus) ja **jokainen saa oman ilmoitusnumeronsa**. Tunnisteena
käytettiin `hilma_notice_number`ia, joka siis eroaa joka kerta — niinpä
korjausilmoitus loi uuden ehdokkaan, vaikka hanke oli jo kannassa. Resolver-
reitti ei tee sumeaa täsmäystä hyväksyttyihin hankkeisiin, joten mitään ei
sitonut niitä yhteen, ja duplikaatti ehti käyttäjän näkyville.

Korjaus: `hilma_procedure_id` (hankinnan tunnus) pysyy samana kaikissa saman
hankinnan ilmoituksissa. Se kirjataan nyt tunnisteeksi, ja jonossa olevat
duplikaatit sivuutettiin takautuvasti (`ignored`, ei poistoa — ks. D-088).

**Kaavapäätöksissä ei ole samaa ongelmaa.** Tarkistettu 20.8.2026: 2 966
kaavatunnistetta, 2 966 eri arvoa, **0** tunnistetta jolla olisi useampi
ehdokas; 3 162 kaavaehdokkaasta vain 58 ilman tunnistetta eikä yhtään
samannimistä duplikaattiryhmää. Syy on rakenteellinen — kaavatunnus
(`AK-2145`) pysyy samana kaavan edetessä vaiheesta toiseen.

Yleistys: **tunnisteeksi kelpaa vain se, mikä ei muutu kohteen elinkaaren
aikana.** Ilmoitus-, versio- ja päätösnumerot eivät kelpaa.

Ks. `lib/projects/identity.ts`, `scripts/backfill-hilma-procedure-id.ts`.

### D-090 – Uusi lähde on jaettujen poimijoiden testi

GRK:n projektisivuja lisättäessä joukkoon lipsahti **virolainen
ratahanke suomalaisena**. Syy ei ollut uudessa lähteessä vaan
`detectCityFromText`issä, jota kaikki lähteet käyttävät:

```
"vuoden 2028 loppuun mennessä"  →  kunta "Loppi"
```

Kanta **"lopp"** + päätelistan **"uun"** osuu sanaan "loppuun".
Sananrajat täyttyvät, joten mikään olemassa oleva suoja ei estänyt sitä.

**VIKA OLI OLLUT KANNASSA KOKO AJAN.** Mitattu 19.8.2026: kahdeksasta
`city = "Loppi"` -hankkeesta **kolme oli väärässä kunnassa** — mm.
"Tekova rakentaa JYSKin uudet liiketilat Järvenpäähän" ja "Ämttön silta
Porissa maantiellä 13004". Ne olivat olleet asiakkaille näkyvissä väärän
maakunnan alla, eikä mikään ollut kertonut siitä.

Korjaus oli yhden rivin lisäys `STEM_MATCH_EXCLUDED`-listalle, jossa oli
jo täsmälleen sama ratkaisu kunnalle "Kaavi" (kanta "kaav" vs. sanat
"kaava", "kaavoitus"). Ennen muutosta varmistettiin, ettei se riko aitoja
osumia: **astevaihtelun takia muodot "Lopen" ja "Lopella" eivät osu
kantaan muutenkaan**, joten poisto ei menetä mitään. Ajossa "Ämttön silta
Porissa" korjautui Poriksi.

**YLEINEN HAVAINTO.** Jaettu poimija on testattu vain sillä aineistolla
jota sille on syötetty. Uusi lähde tuo uudenlaista tekstiä — tässä
tapauksessa ulkomaita käsittelevää proosaa — ja paljastaa siksi vanhoja
vikoja, jotka eivät ole koskaan aiemmin osuneet. Sama toistui tässä
työssä kolmesti:

| lähde joka paljasti | vika jaetussa koodissa |
|---|---|
| Sitowise | `extractReleaseBody` valitsi tyhjän `<article>`-kääreen |
| Varte | hännän leikkaus tunsi vain yhden sanamuodon; kaupunki tuli yritysnimestä |
| GRK | `detectCityFromText` luki kunnan sanasta "loppuun" |
| Hartela | katuosoitteen normalisointi täsmäytykseen — **ei tehty**, ks. alla |

Uutta lähdettä lisättäessä kannattaa siis katsoa **ensimmäisen ajon
tulosta riveittäin** eikä vain lukumääriä: poikkeava rivi kertoo
useammin jaetusta poimijasta kuin uudesta lähteestä.

**NELJÄS TAPAUS PÄÄTTYI TOISIN: MUUTOSTA EI TEHTY.** Hartelan uudet
hankkeet eivät täsmänneet olemassa oleviin riveihin, koska osoitteet
eroavat merkkijonoina — `Ukonkellontie 6` vs. `Ukonkellontie 6, 02450
Kirkkonummi`. Ilmeinen korjaus olisi verrata vain katua ja numeroa.

Mittaus koko kannasta kumosi sen. Samalla kadulla ja numerolla on
hankkeita jotka EIVÄT ole sama hanke:

```
Maunonkatu 2, Oulu   "Asunto Oy Kuusiluodonrannan Runo" ja "Kuusiluodonrannan Saaga"
Koroistentie 10      Teboilin purku · Junatien metrosilta · Patterimäen asemakaava
```

Eri taloyhtiöitä samassa korttelissa, ja kolme täysin eri hanketta
samalla osoitteella — jälkimmäinen ilmeisesti hallinnollinen osoite,
ei hankkeen sijainti. Normalisointi olisi yhdistänyt ne.

**Kahden duplikaatin käsittely jonossa on halvempaa kuin väärin
yhdistetyt hankkeet**, joten täsmäytys jätettiin ennalleen. Tämä on
myös vastaus siihen miksi D-088:n duplikaattiongelmaa ei kannata
ratkaista löysentämällä täsmäytystä.

**JÄI KÄSIN KORJATTAVAKSI.** Kaksi riviä on yhä väärässä kunnassa, koska
oikeaa kaupunkia ei voi johtaa tekstistä automaattisesti: JYSK/Järvenpää
(illatiivi "Järvenpäähän" ei tunnistu) ja Ilmasotakoulu/Tikkakoski (nimeä
ei mainita). Niitä ei arvattu.

---

### D-089 – Yrityksen projektisivut ovat oma lähdeluokkansa, ja kattavuus on mitattava sivukohtaisesti

Espoon Prismakeskuksen tapaus (D-088) nosti kysymyksen: Skanskan omalla
projektisivulla lukee suoraan "Asiakas: HOK-Elanto" ja "Status: Käynnissä",
joten miksi luemme sen STT-tiedotteesta?

**PROJEKTISIVU ON ERI ASIA KUIN UUTINEN.** Uutinen kertoo hetkestä: mitä
juuri nyt julkistettiin. Projektisivu kertoo hankkeen tilan ja osapuolet
nimettyinä kenttinä, ja se pysyy ajan tasalla koko hankkeen ajan. Sama
yritys voi siis olla kaksi eri lähdettä, ja niin nyt on: `skanska`
(uutiset) ja `skanska_projektit`.

**KATTAVUUS MITATAAN HANKESIVUILTA, EI LISTAUSSIVUN SANOISTA.** Tämä oli
kierroksen kallein oppi. Kartoitin lähteitä hakemalla listaussivulta
sanoja "Tilaaja", "Rakennuttaja", "Laajuus" ja päättelin niiden
esiintymisestä, että Lujatalo on paras vaihtoehto. Se oli väärin:

| lähde | hankesivuja | käynnissä | rakennuttaja | osoite | suunnittelijat |
|---|---|---|---|---|---|
| **NCC** | 21 | 20 | 71 % | **95 %** | **95 %** |
| Skanska | 53 | ~50 % | **94 %** | – | – |
| GRK | 239 | **16** | 0 % | – | – |
| Hartela (tulevat) | 15 | 15 | – | **53 %** | – |
| HC Hoivakodit | 1 | 1 | 100 % | 100 % | – |
| Lujatalo | 115 | **7** | **12 %** | – | – |

Lujatalon sanat olivat listaussivulla, eivät jokaisella hankesivulla —
25 sivun otoksesta tilaaja tai rakennuttaja löytyi vain kolmelta. Ja sen
115 referenssistä 108 on valmistuneita, eli historiaa eikä
mahdollisuuksia; lähde rajattiin siksi käynnissä oleviin.

**NCC TUOTTAA KAKSI KENTTÄÄ, JOITA MIKÄÄN MUU LÄHDE EI OLE TUOTTANUT.**

1. **Katuosoite postinumeroineen** ("Rauhankatu 17, 00170 Helsinki").
   Se on duplikaattitäsmäytyksen vahvin avain — juuri sen puuttuminen
   hajotti Espoon Prisman kahdeksi riviksi.
2. **Suunnittelijat urakkalajeittain**: arkkitehti-, rakenne-, LVIA-,
   sähkö- ja pohjarakennesuunnittelu. Kannassa on ollut sarakkeet näille
   koko ajan (`projectCompanies.ts`), eikä yksikään lähde ollut täyttänyt
   niitä. Jonoon tuli 11/15 vähintään yhdellä.

**MONIVAIHEISET SIVUT.** Osa sivuista kokoaa saman hankkeen useita
vaiheita samaan listaan (NCC:n OYS 2030 kattaa 2019–2030 kolmena
jaksona), eikä lohkojen JÄRJESTYS kerro tuoreutta — tällä sivulla ylin on
vanhin. Kaksi ensimmäistä korjausyritystäni nojasi järjestykseen ja meni
siksi pieleen. Vaihe päätellään nyt koko sivun rakennusajoista: jos mikä
tahansa niistä ulottuu tulevaisuuteen, hanke on kesken. Käynnissä oleva
työmaa ei saa näkyä valmistuneena.

**TOISTUVA ANSA: cheerio ei erota elementtejä.** `$(el).text()` liittää
lapsielementit ilman välilyöntiä, joten sivun teksti on muodossa
"StatusKäynnissäProjektin tiedot" ja "Asiakas:Skanska Kodit". Kentät on
siksi luettava DOM-rakenteesta (`<h3>` + `<p>`, `<li><strong>`), ei
tekstiä pilkkomalla. Sama vika iski kaikkiin kolmeen lähteeseen.

**GRK ON NELJÄS, MUTTA ERI LUOKKAA.** Kartoituksen suurin yksittäinen
löytö oli GRK:n 239 suomenkielistä projektisivua — enemmän kuin muilla
yhteensä. Sivuilla EI kuitenkaan ole nimettyjä kenttiä, joten poiminta on
tekstipohjaista ja rakennuttaja jää tyhjäksi. Se otettiin silti käyttöön,
koska GRK on iso infratoimija ja infrassa kattavuutemme on ohuempi kuin
talonrakentamisessa: 16 käynnissä olevaa hanketta (Hailuodon kiinteä
yhteys, Jätkäsaaren kannaksen silta, Turun raitiotie).

GRK:lle ei tehty rikastuskoukkua lainkaan. Sivut ovat 700–1600 merkkiä ja
koko 239 sivun haku vie rinnakkain 7,9 s, joten haku tekee kaiken
kerralla — näin poiminta ei jää `ENRICH_PER_RUN`-katon taakse eikä odota
runkotyöntekijää. Sama ratkaisu sopii muillekin pienisivuisille lähteille.

**KARTOITUS TARKISTI HARTELALTA VÄÄRÄN SIVUN.** Totesin ettei Hartelalla
ole käyttökelpoista sivua, koska katsoin vain `/referenssit` — se on
valmistuneita kohteita. Sivu `/tulevat-asuinalueet` on päinvastoin
tulevia, ja siellä **katuosoite löytyy 8 sivulta 15:stä** eli parempi
osuus kuin yhdelläkään muulla yrityslähteellä. Se löytyi vasta kun
käyttäjä huomasi joutuneensa lisäämään osoitteen käsin.

Opetus on sama kuin kattavuusmittauksessa mutta askelta aiemmin:
**yhden sivun tarkistaminen ei riitä päätelmään koko sivustosta.**
Referenssit ja tulevat kohteet ovat eri sivustoilla eri paikoissa, eikä
yhden puuttuminen kerro toisesta mitään.

**HC HOIVAKODIT** lisättiin samasta syystä: käsin lisätty
"Hommaksenkaari 5" oli heidän omassa tiedotteessaan valmiina.
Listaussivu on JS-vetoinen (53 kB HTML, 116 merkkiä tekstiä), joten
käytetään WordPressin REST-rajapintaa. Koko sivustolla on yksi
artikkeli — lähde on halpa ja tuo osoitteen, mutta sen tuottoon ei pidä
nojata ennen kuin sitä on mitattu uudelleen.

**MUUT ISOT RAKENNUSLIIKKEET KARTOITETTIIN, EIKÄ VASTAAVAA LÖYTYNYT.**
Fira (116 sivua), Destia (72), Consti (2), SRV ja YIT: kaikilla on
referenssisivut, mutta niissä ei ole nimettyjä kenttiä. Nopea sanahaku
antoi kaksi houkuttelevaa mutta väärää tulosta — Fira "rakennuttaja 8/8"
oli navigaatiotekstiä ("hyödyt rakennuttajalle") ja SRV "rakennuttaja
3/3" murupolkua ("Rakennuttajalle › Referenssit"). Molemmat karsiutuivat
sivukohtaisessa tarkistuksessa, eli sama virhe kuin Lujatalon kohdalla oli
toistumassa.

**PROSESSIHUOMIO.** Regexien kirjoittaminen shell-skriptin läpi söi
kenoviivat kolme kertaa tässä työssä: `\s` muuttui kirjaimeksi "s" ja
`\d` kirjaimeksi "d". Yhdessä tapauksessa se söi arvon alkukirjaimen
("Skanska Kodit" → "kanska Kodit") ja pääsi tuotantoon asti, koska testi
sattui käyttämään syötettä jossa väärä kuvio ei osunut. Regexit
kirjoitetaan jatkossa suoraan tiedostoon.

---

### D-088 – Duplikaatti ei hävitä tietoa, se piilottaa sen toiselle riville

"Lisäsin Skanskan käsin pääurakoitsijaksi, ja se on kadonnut."

Tieto ei ollut kadonnut. Espoon Prismakeskus oli kannassa **kahtena**,
molemmat STT:stä, kahdesta eri tiedotteesta:

```
ee6f0d96  Espoo    · Kauppa     · HOK-Elanto · urakoitsija –
f9c20a9f  Helsinki · Kerrostalo · HOK-Elanno · urakoitsija Skanska Oy
```

**VÄÄRÄ KAUPUNKI SYNNYTTI DUPLIKAATIN.** Skanska-rivillä kaupunki oli
Helsinki (tiedotteen päiväys; HOK-Elannon kotipaikka) ja tyyppi
Kerrostalo. Ajettu täsmäytys näiden välillä antaa **"EI OSU"** kynnyksellä
70. Kun kaupunki ja tyyppi eroavat, pisteet jäävät alle rajan — ja
duplikaatti jää eloon jakaen tiedon kahtia.

Tästä seuraa yleisempi asia: **duplikaatin oireena on puuttuva kenttä,
ei kaksi riviä.** Käyttäjä ei näe kahta riviä; hän näkee yhden rivin
jolta puuttuu se mitä hän itse lisäsi.

**YHDISTÄMINEN SIIRTÄÄ TIEDON.** Olemassa oleva duplikaattikäsittely
(`/api/tic/duplicates/hide-project`) vain piilottaa hävinneen rivin
siirtämättä mitään — jolloin piilotus hävittäisi sen mitä vain hävinnyt
tiesi. Repossa oli jo tähän työkalu
(`scripts/merge-duplicate-projects.ts`), jonka **kirjoitin vahingossa
uusiksi huomaamatta sen olemassaoloa**. Alkuperäinen oli kattavampi:
se yhdistää lähdehistorian ja `also_known_as`-kentän, käy läpi kaikki
metadata-avaimet ja siirtää suosikit sekä vastuutukset. Se palautettiin.

Yhdistyksessä säilyvälle täytetään vain TYHJÄT kentät: säilyväksi
valitaan se rivi jonka tiedot ovat oikein. Prismalle siirtyi
pääurakoitsija ja kustannusarvio **60 M€**, joka oli vain hävinneellä
rivillä.

**ASTEVAIHTELU EI OLE PÄÄTELTÄVISSÄ.** Hävinneellä rivillä rakennuttaja
oli "HOK-Elanno" — allatiivin "HOK-Elannolle" väärä perusmuoto.
Vokaalisäännön piti sulkea astevaihtelu pois, mutta se katsoo vain
viimeistä kirjainta, ja vaihtelu tapahtuu sitä EDELTÄVÄSSÄ konsonantissa
(nt → nn). Heikon asteen kaksoiskonsonantista ei voi päätellä kumpi vahva
aste oli: "Elanno-" voi tulla sanasta Elanto, mutta "Auroranlinna" on jo
perusmuoto. Kenttä jää siksi tyhjäksi — sama ratkaisu kuin "kaupungille".

Mitattu 1 256 nimestä: heikon asteen näköisiä viisi, joista neljä on
oikeita nimiä jotka eivät tule tästä muunnoksesta. Rajaus ei siis riko
mitään olemassa olevaa.

---

### D-087 – Terveysmittari näyttää milloin lähde kaatui, ei onko se rikki

TIC:n discovery-sivu näytti **11 ongelmaa**. Selvitys osoitti, että vain
yksi oli aito vika.

**Kahdeksan yhdestätoista oli vanhentunutta kohinaa.** Virheet olivat
97–115 h vanhoja eli samasta ikkunasta 4–5 vrk takaa. Testasin viisi
niistä suoraan: `srv` 3,0 s / 165 ehdokasta, `jatke` 1,7 s / 22,
`lujatalo` 9,7 s / 25, `rakennuslehti` 0,5 s / 17, `stt_haku` 15,5 s /
877. **Kaikki toimivat.**

**Syy on kierron ja vanhenemisikkunan suhde.** Mitattu 18.8.2026: 300
lähdettä, noin 47 eri lähdettä ajossa vuorokaudessa → **koko kierto 6,3
vrk** (mediaani viime ajosta 2,1 vrk, vanhin 6,8). "Rikki"-merkintä
vanhenee vasta 7 vrk:ssa. Ikkuna on siis pidempi kuin kierto, joten
kertaluontoisesti kaatunut lähde ehtii näyttää punaiselta lähes koko
kierron ajan **ilman että sitä testataan kertaakaan uudelleen**.

Mittari ei valehtele — se vain mittaa eri asiaa kuin miltä näyttää.

**Automaattista uusintayritystä EI tehdä.** Se vaihtaisi punaisen
vihreäksi kertomatta miksi lähde kaatui, eli piilottaisi oireen
selvittämättä syytä. Kun lähde menee punaiselle, syy selvitetään.
Jos näkymä jatkossa häiritsee, oikea korjaus on erottaa "kaatui kerran"
ja "ei ole toiminut sitten viime yrityksen" toisistaan — ei piilottaa
virhettä.

**Ainoa aito vika oli Marttilan kaavoitus**, ja siinä oli kaksi
kerrostumaa. Palvelin lähettää vain palvelinvarmenteen ilman
välivarmennetta, mihin oli jo tehty korjaus: puuttuva varmenne haetaan
AIA-kentän osoitteesta. Korjaus haki kuitenkin **tasan yhden tason**,
koska silloin ketjusta puuttui täsmälleen yksi (Let's Encrypt R13 → ISRG
Root X1). Let's Encrypt on sittemmin vaihtanut välivarmenteeseen **YR2**,
eikä yksi hyppy enää päädy Noden luottamaan juureen.

Pahempi kerrostuma oli toinen: virhe vaihtui muotoon
`UNABLE_TO_GET_ISSUER_CERT` — **täsmälleen niin kuin vanha kommentti oli
ennustanut** — mutta juuri sitä koodia ei ollut vajaan ketjun
koodilistalla. Varmennekorjaus ei siis enää käynnistynyt lainkaan; lähde
kaatui ennen kuin ehti yrittää korjata ketjua.

Ketjua seurataan nyt kunnes vastaan tulee itse allekirjoitettu juuri tai
AIA loppuu (syvyys rajattu neljään), ja koodi on lisätty listalle. Ketjua
ei ohiteta: haettu välivarmenne kelpaa vain jos se ketjuttuu järjestelmän
juurivarmenteeseen. Todennettu: 2,6 s, 2 dokumenttia, tila 🟢.

**Opetus koodikommenteista:** vanha kommentti kertoi tarkalleen mitä
tapahtuisi jos ketju syvenisi, ja juuri niin kävi. Kommentti oli oikeassa
mutta koodi ei seurannut sitä loppuun asti — ennuste kirjattiin, mutta
sen varalta ei varauduttu.

---

### D-086 – Runkojonon läpimeno haetaan tiheydestä, ei eräkoosta

Runkojono oli 984 riviä ja kasvoi. Toisin kuin D-082:ssa, nyt **979/984
tarvitsi oikean verkkohaun** (`stt_haku` 599, `yva` 315), joten
kirjanpitorivien pyyhkäisy ei auttanut lainkaan — raja itse oli
pullonkaula.

Mitattu 18.8.2026: **1,22 s per dokumentti**, eli 25 rivin erä vei 30 s
reitin 300 sekunnin budjetista. Kymmenesosa käytössä, ja purkuteho 100
kpl/vrk kertymää vastaan.

Erä 25 → 50 (mitattu 55,8 s) ja cron 4×/vrk → tunneittain. Yhdessä
**1 200 kpl/vrk**, joten jono purkautuu alle vuorokaudessa.

**Erää ei nostettu lähelle kattoa**, vaikka ~196 mahtuisi: pitkä ajo
menettää kaiken tekemänsä jos se katkeaa, kun taas lyhyt ajo toistuu
tunnin päästä. Sama periaate kuin lähdeajoissa — läpimeno haetaan
toistotiheydestä, ei yhden erän koosta.

Todennettu oikealla ajolla: 50 kpl / 55,8 s, jono 954 → 904, ja samalla
47 jonoriviä ja 21 hanketta sai täydennystä.

---

### D-085 – Yksi tiedote paljasti viisi vikaa, ja kuivaharjoitus esti neljä virhettä

Yksi Varten hoivakotitiedote (18.8.2026) tuotti kannalle rivin, jossa oli
väärä kaupunki, puuttuva rakennuttaja, väärä vaihe, puuttuva osoite ja
kuvaus täynnä naapuriartikkeleita. Jokaisella oli oma syynsä.

**1. Sivun hännän leikkaus tunsi vain yhden sanamuodon.** Kuvio odotti
"Sinua saattaisi kiinnostaa", mutta Varten sivulla lukee "Sinua VOISI
kiinnostaa myös" — yhden sanan ero, joka jätti kaksi naapuriartikkelia ja
uutiskirjemainoksen kuvaukseen. Merkit on nyt **mitattu 12 513
kuvauksesta**, ei arvattu, ja leikkaus tehdään vain tekstin loppupuolelta
(yli 40 %), koska kaikki mitatut roskamerkit osuivat 64–93 % kohdalle.

**"Katso myös" jätettiin pois vaikka se oli yleisin (294 esiintymää).**
YVA-sivuilla se ei aloita häntää vaan on keskellä sivua linkkilaatikkona,
ja sen jälkeen jatkuu aito hankekuvaus. Fingridin voimajohtohankkeesta
olisi kadonnut 1 514 merkkiä: johdon pituus, reitti, kunnat ja
hankevastaavan yhteystiedot.

**2. Tilaaja jäi ingressirajauksen taakse.** Osapuolet luetaan vain
ensimmäisestä 700 merkistä, jottei naapuriartikkelin yritys poimiudu
tilaajaksi — mutta "Hankkeen tilaajana toimii Asuntorakennuttajat Group
Oy" on merkillä 832. Uusi `extractExplicitClient` lukee koko rungon mutta
**vain yksiselitteisistä ilmauksista** ("tilaajana toimii X"), joten
rajauksen alkuperäinen syy ei palaa.

**3. Kaupunki tuli yritysnimestä.** "Varte Tampere Oy" teki Nokialle
rakentuvasta hoivakodista tamperelaisen. Julkaisijan nimi leikataan nyt
pois ennen kaupunkitunnistusta — mutta vain siitä, ei kuvauksesta.

**4. Vaihe ei tunnistanut käynnissä olevaa työmaata.** "Työt ovat
tontilla jo täydessä vauhdissa" ei osunut yhteenkään kuvioon.

**5. Osoite jäi tyhjäksi vaikka katu oli tiedossa.** Talonumeron vaatimus
on tarkoituksellinen — numeroton osoite ei ole täsmäytyksen todiste — ja
se jätettiin koskematta. Kadunnimi poimitaan nyt omaan vihjekenttäänsä,
**ei `location`iin**: tieto katsojalle, ei avain.

**Lisäksi: kenttien alkuperä.** Esikatselu näytti arvot muttei sitä mistä
ne tulivat, joten katselmoija hyväksyi sokkona. Jokainen rikastuksen
täyttämä kenttä saa nyt merkinnän — *lähde*, *teksti* tai *julkaisija*.
Merkintä kertoo mistä arvo tuli, **ei sitä onko se oikein**: väärä
Tampere olisi ollut yhtä lailla "teksti".

**KUIVAHARJOITUS ON TÄMÄN KIRJAUKSEN VARSINAINEN OPETUS.** Neljä erillistä
takautuvaa ajoa oli valmiina ajettavaksi, ja kuivaharjoitus paljasti
jokaisessa virheen ennen kirjoittamista:

| aiottu ajo | mitä kuivaharjoitus näytti | lopputulos |
|---|---|---|
| kuvausten siivous | 2 865 riviä muuttuisi, mutta muutos oli välilyöntien normalisointia | rajattiin 128:aan |
| kaupunkien korjaus | Oulu → Jyväskylä, Kuopio → Jyväskylä: yhdeksän oikeaa kaupunkia olisi rikkoutunut | **hylättiin kokonaan** |
| vaiheen korjaus | kolme jo valmistunutta hanketta olisi siirtynyt rakenteille | 68 → 51 |
| vaiheen korjaus | kuntapäätöksen teksti kuvaa ympäristöä, ei hanketta | 51 → 44 |

Ilman kuivaharjoituksia kaksi näistä olisi mennyt asiakkaille asti. Sääntö
on siis kirjattava vahvempana kuin tapana: **takautuvaa ajoa ei kirjoiteta
ilman, että sen tuotos on ensin luettu riveittäin** — ei vain laskettu.

Ajettu lopulta: 128 kuvausta siivottu (104 978 merkkiä roskaa), 4
rakennuttajaa täydentyi, 44 hanketta siirtyi rakentamiseen (38 jonossa, 6
hyväksyttyä, jokainen kuudesta tarkistettu yksitellen).

---

### D-084 – Tunnus lukitaan käsin, kone vain ilmoittaa

Kokeilujaksoa kalastelleet yhteydenotot (yleisösähköposti, ei nimettyä
päämiestä, hiljaisuus kun pyydettiin työsähköpostia) nostivat kysymyksen:
mitä tunnukselle voi tehdä jos käyttö osoittautuu väärinkäytöksi?

**Vastaus oli: ei mitään.** Ainoa olemassa oleva toimenpide oli KOVA
POISTO. Väärinkäytön havaitessa ainoa vipu olisi ollut tuhota tili
lopullisesti — jolloin katoavat sekä todisteet että mahdollisuus perua
virhe. Sama periaate kuin D-080:ssa: peruttava toimenpide ennen
peruuttamatonta.

**Lukitus** (`/api/admin/lock-user`) estää kirjautumisen mutta säilyttää
tilin, historian ja analytiikkatapahtumat. Kaksi estettä vahingolle:
perustelu on pakollinen, ja erillinen vahvistus jossa sähköposti ja syy
ovat luettavissa. Vapautus ei vaadi kumpaakaan. Oman tai toisen
ylläpitäjän tunnuksen lukitseminen on estetty palvelinpuolella.

**AUTOMAATTISTA LUKITUSTA EI TEHTY, JA SE ON PÄÄTÖS.** Perustaso mitattiin
ilman ylläpitäjän omaa käyttöä: 28 asiakasta on avannut hankkeita,
mediaani 6 eri hanketta, innokkain 43. Kolme syytä:

1. **Perustaso on liian lähellä.** Mikä tahansa kynnys lähellä todellista
   käyttöä lukitsee ennen pitkää maksavan asiakkaan kesken työpäivän.
   Virheen hinnat ovat epäsymmetriset: väärä lukitus maksaa
   asiakassuhteen, myöhästynyt havainto muutaman tunnin dataa.
2. **28 aktiivista asiakasta mahtuu ihmisen katseeseen.** Automaatio
   ansaitsee paikkansa vasta kun tapahtumia on enemmän kuin ehtii katsoa.
3. **Automaattinen raja opettaa kaappaajalle missä raja on.** Hän jää sen
   alle. Hiljainen ilmoitus ei opeta mitään ulospäin.

Tilalle **ilmoitus** (`/api/admin/usage-alert`, cron 06:00): kynnys 200
eri hanketta / 24 h eli noin viisinkertainen innokkaimpaan asiakkaaseen.
Koko hankekannan läpikäynti vaatisi yli 5 000 avausta, joten aito
kaappaus ylittää kynnyksen moninkertaisesti eikä sen tarkka arvo ratkaise.
Päätös jää ihmiselle.

**Kaksi vikaa jäi kiinni todentamisessa ennen tuotantoa.**
`account_lifecycle`-taulussa on uniikkirajoite `(user_id, event)`, joten
toinen lukitus olisi kaatunut duplikaattivirheeseen — ja koska kirjaus on
try/catchin sisällä, lukitus olisi silti onnistunut mutta jäänyt
kirjaamatta. Nyt upsert; rajoite jää, eli taulu säilyttää VIIMEISIMMÄN
lukituksen syineen eikä koko historiaa. Toiseksi lukitustila kirjataan
myös `app_metadata`an, koska `banned_until` ei kanna perustelua.

**Sivutuote: kirjautumisvirheet suomennettiin.** Lukittu käyttäjä näki
Supaben oman viestin "user is banned". Se on ainoa kohta jossa lukittu
käyttäjä kohtaa palvelun, joten hän saa nyt ohjeen ottaa yhteyttä.
Tuntematon virhe palautetaan yhä sellaisenaan: geneerinen suomennos
piilottaisi syyn silloinkin kun se olisi hyödyllinen.

**Todennettu oikeassa ajossa 18.8.2026:** lukitus → kirjautuminen estyy →
vapautus → tila palautuu, ja päiväkirjaan jäi molemmista merkintä
tekijöineen.

**Metodinen opetus:** väitin kahdesti että Supaben rajapinta ei palauta
jotain kenttää (`last_sign_in_at`, `banned_until`). Molemmat väitteet
syntyivät YHDEN käyttäjän otoksesta, ja supabase-js jättää null-kentät
kokonaan pois oliosta. Puuttuva avain ei siis todista puuttuvaa kenttää —
kenttien olemassaolo on mitattava koko joukosta.

---

### D-083 – RLS-pyyhkäisy ohitti analytiikkataulun, eikä oire näkynyt kenellekään

Kokeilujaksoa kalastelleista yhteydenotoista syntyi kysymys, havaitaanko
poikkeava selaus. Sitä selvitettäessä `analytics_events`-taulusta löytyi
**544 tapahtumaa ilman `user_id`:tä** (15.7.–5.8.2026), joista 205 oli
hanke-avauksia — kolmasosa kaikista.

**Ensin esitin tämän nykyisenä vikana. Se oli väärin.** Uudessa datassa
aukkoa ei ole: 6.8.–17.8. kertyi 7 672 tapahtumaa ja **nolla**
tunnistamatonta. Ilmiö oli päättynyt 12 vuorokautta ennen kuin sitä
katsottiin.

**Syyn jäljitys sulki pois kolme selitystä.** Kirjausreitti on luotu
14.7. eikä sitä ole muokattu kertaakaan, ja siinä on alusta asti suoja
joka ei kirjoita riviä ilman kirjautunutta käyttäjää
(`app/api/analytics/track/route.ts`) — rivit eivät voi olla siitä.
Yhtään tiliä ei ole poistettu, joten viite ei ole nollautunut
poistossa (kaikki 34 analytiikan käyttäjää ovat yhä `profiles`-taulussa).
Koodissa ei ole toista kirjoittajaa.

**Selitys löytyi RLS-korjauksen kattavuudesta.** 30.7. suljettiin 16
anon-avaimelle avointa taulua (`docs/sql/2026-07-30_enable_rls_exposed_tables.sql`),
mutta **`analytics_events` ei ollut niiden joukossa**. Taulu jäi siis
auki, ja nollarivit jatkuvat täsmälleen siihen asti kunnes RLS ilmeisesti
ulotettiin siihen erikseen. Nyt anon-avaimen kirjoitus on estetty
(todennettu: `new row violates row-level security policy`), luku on
sallittu mutta palauttaa nolla riviä.

En pysty nimeämään kirjoittajaa ilman heinäkuun palvelinlokeja, enkä
esitä arvausta faktana.

**Varsinainen opetus ei ole RLS vaan havaitseminen.** Taulussa oli
kuukauden ajan rivejä, joiden syntyminen on koodin perusteella
mahdotonta, eikä kukaan huomannut — koska mikään ei katsonut. Oire oli
olemassa koko ajan ja luettavissa yhdellä kyselyllä.

Siksi analytiikkaan lisätään mittariksi **"tapahtumia ilman
käyttäjätunnistetta"**. Sen kuuluu olla aina nolla; nollasta poikkeava
luku tarkoittaa tuntematonta kirjoittajaa. Tämä olisi paljastanut asian
heinäkuussa.

**Termi kirjattuna, koska sitä käytetään mittareissa:** *tapahtuma* =
yksi rivi `analytics_events`-taulussa. Tyypit ovat `pageview`, `login` ja
`project_open`. Jaksolla 6.8.–17.8. jakauma oli 5 993 / 1 487 / 192.
Hanke-avauksia kertyy siis noin 16 vuorokaudessa — poikkeaman
kynnysarvot on asetettava vasta kun jakaumaa on katsottu, ei etukäteen.

---

### D-082 – Jono kasvoi koska halpa työ kulutti kallista budjettia

Kaksi eri jonoa kasvoi samasta syystä: **budjetti oli mitoitettu
verkkohaulle, mutta se rajoitti myös työtä joka ei hae mitään.**

**Dokumenttijono.** `releaseBodyWorker`in `DEFAULT_LIMIT = 25` on
olemassa rajoittamaan sivuhakuja. Kuntapäätöksillä ei ole rikastajaa —
niiden koko sisältö tuli jo hausta — joten ne vain merkitään
käsitellyiksi. Silti ne kuluttivat saman budjetin.

Mitattu 17.8.2026: jonossa 418 riviä, joista **414 ei tarvinnut
verkkohakua lainkaan** ja vain 4 tarvitsi. Kertymä ~200/vrk, purkuteho
100/vrk (25 × 4 ajoa) → jono kasvoi noin sata riviä vuorokaudessa,
vaikka 99 % siitä oli ilmaista työtä. Nyt ne kuitataan
joukkopäivityksenä budjetin ulkopuolella: **418 → 0, kesto 9,7 s.**

**Kandidaattijono.** `legacyFetchCollector`issa ohitustarkistus "onko
tämä osoite jo nähty" oli tuontisilmukan sisällä, sen ensimmäisenä
ehtona. Kaikki kandidaatit kulkivat siis rinnakkaisuusjonon läpi ja
kuluttivat aikabudjetin tarkistuksen, vaikkei niille tehty mitään.

`stt_haku` palauttaa 12 kuukauden ikkunasta ~874 kandidaattia, joista
mitattuna vain **52 oli uusia**. 70 sekunnin tuontibudjetti loppui
kesken, 448 siirtyi seuraavaan ajoon — ja seuraava ajo aloitti taas
samasta 874:stä. **Rästi ei voinut purkautua**, ja lähde kaatui 90
sekunnin aikakatkaisuun 9 kertaa viikossa; viimeisin onnistuminen 5.8.

Karsinta siirretty silmukan eteen. Semantiikka ei muutu — ohitushaara ei
tehnyt muuta kuin kasvatti laskuria.

| | kesto | siirtyi seuraavaan |
|---|---|---|
| ennen | 77 s | 448 |
| rästiä purkaessa | 85 s | 22 |
| vakaa tila | 26 s | 0 |

**Kiinteä yleiskustannus mitattiin samalla**, koska se määrää mihin
lähde ylipäätään mahtuu: haku 13–31 s (vaihtelee ajokerroittain),
`loadProjectsForMatching` 9 s, dokumenttirivit 2 s — eli ~38 s ennen
kuin yhtään kandidaattia on käsitelty. Jokainen **uusi** kandidaatti
maksaa noin 1,4 s. Jos raja tulee vastaan uudelleen, oikea korjaus on
lyhentää 12 kuukauden ikkunaa, ei nostaa budjettia.

**Yleistys:** kun ajo rajoitetaan, rajan pitää koskea sitä resurssia
jota se suojaa. Molemmissa tapauksissa raja oli oikea mutta kohdistui
väärään joukkoon, ja seuraus oli sama — jono, joka näytti kasvavan
"liian monesta hankkeesta" mutta koostui työstä jota ei tarvinnut tehdä.

---

### D-081 – Suunnittelutoimisto on lähde, mutta vain uutisensa

Yksityiset suurhankkeet eivät osu Hilmaan, päätöksiin eivätkä kaavoihin
(ks. muistiinpano yksityisten rakennuttajien katvealueesta).
Suunnittelija valitaan hankkeen alussa, joten sen tiedote tulee ennen
urakkakilpailua — ja yltää sinne minne lupalähteet eivät.

**Referenssisivut hylättiin mitattuna.** Otos WSP:n kymmenestä
projektisivusta 16.8.2026: **7 valmista, 2 käynnissä, 1 tuntematon.**
Referenssisivu on markkinointia jälkikäteen. Lisäksi WSP:n listaus pyörii
Coveo-hakupalvelun päällä ilman palvelimen renderöimää HTML:ää, eikä
nykyinen keräin saisi siitä mitään. Sweco: 34+ sivua ilman rakenteisia
asiakas- tai vaihekenttiä. Granlund: valikoitu case-kokoelma.

**Uutis- ja sijoittajatiedotteet kelpaavat.** Pörssiyhtiö tiedottaa
voitetut toimeksiannot nimeltä ja ajallaan. Ensimmäinen lähde on
`sitowise`; RSS-syöte hylättiin, koska se on vuoden vanha (tuorein
13.8.2025) vaikka sivusto julkaisee yhä.

**Uusi rooli `designer`.** Suunnittelija ei ole rakennuttaja eikä
pääurakoitsija, joten julkaisijaa ei kirjata kumpaankaan kenttään.
Ilman omaa rooliaan oletuslogiikka olisi kirjannut Sitowisen
rakennuttajaksi aina kun tilaajaa ei saada tekstistä jäsennettyä.

**Suunnittelija tallennetaan silti** — se on hankkeen tiedossa oleva
yritys ja usein ainoa mitä tästä lähteestä varmasti tiedetään.
`metadata.related_companies` on oikea koti, koska tuonti yhdistää sen
olemassa olevaan hankkeeseen eikä ylikirjoita: suunnittelijan tiedote voi
olla ENSIMMÄINEN havainto hankkeesta, jota myöhemmät lähteet
täydentävät.

**Vaihepäättely eroaa urakoitsijasta.** `CONTRACT_PATTERNS` jätetään
pois: suunnittelijan "sopimus solmittu" tarkoittaa suunnittelusopimusta,
ja urakaksi luettuna hanke siirtyisi vuosia todellisuutta edelle.

Ajettu 17.8.2026: 13 ehdokasta jonoon, **kuvaus 13/13, suunnittelija
13/13, kaupunki 10/13**. Rakennuttaja jää 0/13, koska tilaajakuviot on
viritetty urakoitsijan tiedotteille ("rakentaa X:lle") — tiedossa oleva
puute, ei arvaus.

**Sivutuote, joka koski kaikkia yrityslähteitä.** Ensimmäinen ajo antoi
kuvauksen 0/14. `extractReleaseBody` valitsi `.first()` koko
valitsinunionista, ja Sitowisen sivulla ensimmäinen `<article>` on tyhjä
kääre (5 merkkiä, kun toisessa on 5 780). Alle 120 merkin tulos palautti
`null`. Nyt valitaan **pisin siivottu** osuma. Mitattu 11 lähteen
sivulla: 9 sama, 2 parempi, 0 huonompi.

---

### D-080 – Piilotettu hanke ei ole jonotyötä

Piilotettu hanke jäi TIC:n osapuolettomien jonoon, koska kysely rajasi
vain `status = active`. Piilotus näytti siis siltä ettei se tehnyt
mitään: hanke katosi asiakkailta mutta jäi työlistalle.

Jono rajaa nyt `is_public = true`. Osapuolten täydentäminen hankkeelle,
jota kukaan ei näe, ei hyödytä ketään (jono 124 → 122).

**Nimihaussa piilotetut näkyvät yhä, merkittynä "piilotettu"** — muuten
piilotettua hanketta ei löytäisi TIC:stä lainkaan palauttaakseen sen
näkyviin. Sama periaate kuin D-079:ssä: virheen korjaamisen pitää olla
helpompaa kuin sen tekemisen.

**Piilotus, ei poisto.** Duplikaattitäsmäytys lataa kaikki
`projects`-rivit ilman `is_public`-suodatinta, joten piilotettu rivi
toimii muistimerkkinä: sama sivu ei synny uutena hankkeena. Poistettu
rivi ei estä mitään, ja lähde loisi sen uudelleen seuraavassa haussa.

---

### D-079 – Piilotus ei piilottanut Tänään-syötteestä

Kysymys "onko dashboard ainoa tapa poistaa tämä ja onko se järkevä"
paljasti että **piilotus ei toiminut siellä missä sillä on eniten
väliä.**

`is_public = false` suodatettiin karttasivulla (`/projects`) ja
digesteissä, mutta **`getTodayProjects` ei suodattanut sitä lainkaan**.
Tänään-syöte on pääasiallinen asiakasnäkymä, joten piilotettu hanke
katosi kartalta ja jäi silti näkyviin sinne.

**Mitattu 16.8.2026: 43 hanketta oli merkitty piilotetuksi, ja niistä
40 osui yhä Tänään-kyselyyn.** Joku oli siis tehnyt työn ja luullut sen
tehdyksi.

Suodatin lisätty molempiin `getTodayProjects`in kyselyihin — listaan ja
"kaikki hankkeet alueellasi" -lukuun. `is_public` on `null`-vapaa
(5 566 true, 43 false, 0 null), joten `.eq("is_public", true)` on
turvallinen eikä pudota mitään vahingossa.

**Piilotus siirtyi myös oikeaan paikkaan.** Ainoa yleinen tapa oli
dashboardin kytkin, joka kirjoittaa `is_public`in suoraan ilman
perustelua ja ilman jälkeä. Piilotus on kuitenkin päätös — "tämä ei ole
hanke" — ja perustelematon päätös on seuraavalle katsojalle arvoitus,
aivan kuten D-076:n muokkausjälki.

TIC:n hankesivulla on nyt näkyvyysosio, ja se kulkee saman
muokkausreitin kautta:

- **Perustelu on pakollinen piilotettaessa** (400 ilman sitä),
  valmiilla vaihtoehdoilla ("Ei hanke — pelkkä uutinen tai
  markkinointi", "Duplikaatti", "Väärä tieto", …).
- **Palauttaminen ei vaadi perustelua** — virheen korjaamisen pitää
  olla helpompaa kuin sen tekemisen.
- Syy ja ajankohta jäävät metadataan (`hidden_reason`, `hidden_at`), ja
  piilotetun hankkeen sivu näyttää ne.

**Juurisyy on eri asia eikä ratkaistu tässä.** Kysytty hanke
("Laatukoteja yhteistyöllä Helsingin ykkösalueille", lähde `varte`) on
yrityksen markkinointiuutinen ilman yksilöitävää kohdetta. Se pääsi
katselmoinnista läpi, ja piilotus on oire eikä korjaus — sama
D-027:n perhe. Jos näitä alkaa kertyä, oikea paikka on
relevanssiportti, ei piilotusnappi.

---

### D-078 – Haku + LLM ehdottaa osapuolet, ihminen hyväksyy

**Miksi tämä on poikkeus sääntöön "deterministinen ensin" (D-006).** Käsin
lisätyillä hankkeilla ei ole lähdetekstiä lainkaan: mitattu 15.8.2026,
46 hanketta joilla kuvaus on tyhjä, lähdettä ei ole ja metadatassa on
yksi kenttä. Poimittavaa ei siis ole — ainoa tie on hakea tieto
ulkopuolelta. Juuri tähän D-006 varaa LLM:n: "epävarmoihin ja korkean
arvon tapauksiin".

**Haku + malli, ei pelkkä malli.** Malli yksin arvaisi. Verkkohaku
(`web_search`) tuottaa lähteet, ja **lähde-URL vaaditaan jokaiselta
ehdotukselta** — ilman sitä tulos hylätään koodissa, ei kehotteessa.

**Kaksi vaihetta, koska yksi ei toiminut.** Ensin yritettiin yhtä kutsua
jossa haku ja rakenteinen ulostulo (`output_config.format`) yhdistetään.
Se palautti johdonmukaisesti tyhjän: hakuvastaus sisältää sitaatti- ja
koodisuorituslohkoja, eikä lopputeksti ole silloin JSONia. Nyt vaihe 1
hakee vapaamuotoisesti ja vaihe 2 jäsentää skeemaan **ilman työkaluja** —
jälkimmäinen näkee vain vaiheen 1 löydökset, joten se ei voi keksiä
mitään mitä lähteissä ei ollut.

**EI KIRJOITA ASIAKKAALLE NÄKYVIÄ KENTTIÄ.** Tulos menee
`metadata.ai_suggestion`iin ja odottaa ihmisen hyväksyntää TIC:ssä.
Hyväksyntä kulkee D-076:n muokkausreitin kautta, joten hyväksytty arvo
saa merkinnän `cost_source: "manual"` ja jättää muokkausjäljen —
hyväksytty ehdotus on ihmisen päätös, ei koneen. Hyväksyntä täyttää vain
tyhjät kentät eikä koskaan yliaja tarkistettua tietoa.

**Todennettu tunnetulla tapauksella.** "Valmisruokalaitos Nurmoon"
(Atrian tehdas, jonka oikean vastauksen Johannes tiesi): rakennuttaja
**Atria Oyj**, pääurakoitsija **YIT Oyj**, kustannus **82 400 000 €**,
varmuus high, 8 lähdettä. Kaikki oikein.

**Ja se osaa olla vastaamatta.** "Uimahallin laajennus, Kotka" ei
tuottanut ehdotusta lainkaan — liian yleinen nimi, ei tunnistettavaa
hanketta. Tyhjä on oikea vastaus, ja se on koodissa pakotettu: ilman
lähdettä tai ilman yhtäkään kenttää palautetaan null.

**Yksi vika jäi kiinni kuivaharjoittelussa.** Malli palautti
urakoitsijaksi *"Keski-Suomen Betonirakenne Oy (KSBR) – infraurakka
(maanrakennus-, perustus- ja kaapelointityöt)"*. Nimikenttään kuuluu
nimi, ei selitys, joten arvo katkaistaan sulkuun tai ajatusviivaan ja
yli 80 merkin arvo hylätään. Sotkuinen arvo hankekortilla on melkein
yhtä paha kuin väärä.

*Rajaus:* varmuustaso (`high`/`medium`/`low`) on mallin oma arvio eikä
mitattu. Sitä ei pidä lukea todennäköisyytenä — se on lajittelun apu,
ja lähteet ovat se mitä tarkistetaan.

**Jälkitarkistus 16.8.2026: 4/36 ehdotuksessa sama yritys oli
molemmissa rooleissa. Kolme oli oikein, yksi ei.** Kaikki neljä
tarkistettiin alkuperäisistä lähteistä:

| hanke | tulos |
|---|---|
| Asura | **oikein** — lähde: "rakentamisesta vastasi yrityksen oma kokenut henkilöstö" |
| Hartela | **oikein** — omaperusteinen, myyty valmistuttua Balderille; nimi yhtenäistettiin molempiin rooleihin |
| HC Hoivakodit | **oikein** — lähde: kehittäjä ja toteuttaja; Humana on vuokralainen, ei tilaaja **vaikka hankkeen otsikko niin väittää** |
| Peab | **väärin** — lähde kertoo vain "vapaarahoitteinen asuntohanke" eikä nimeä urakoitsijaa |

Peabin tapaus on opettavainen: ehdotus ei ollut hallusinaatio vaan
**toimialapäättely**. Perustajaurakointi on Suomessa niin yleistä, että
rakennuttajasta voi useimmiten päätellä urakoitsijan — ja juuri siksi
malli teki sen, vaikka kehote kielsi arvaamisen. Päättely oli
todennäköisesti oikea, mutta se ei ollut lähteessä, eikä
tarkistamatonta väitettä voi erottaa tarkistetusta kortilla.

**Kaksi korjausta, jotta tämä ei toistu.** Skeemaan lisättiin
`omaperusteinen`-kenttä, joka pakottaa mallin ottamaan kantaa sen
sijaan että tarkistaja päättelisi sen perustelutekstistä. Ja koodissa
sama yritys molemmissa rooleissa hyväksytään **vain** jos malli
merkitsi hankkeen omaperusteiseksi — muuten urakoitsija tyhjennetään.
Tarkistus on koodissa, ei kehotteessa, koska kehote ei riittänyt.

---

### D-077 – YVA:n hankevastaava luetaan nimetystä kentästä, ei proosasta

`fetchYvaSource` poimii rakennuttajan hakurajapinnan leipätekstistä
proosakuvioilla (`extractYvaDeveloper`: "X Oy suunnittelee…"). Se osuu
146:een hankkeeseen 240:stä. Puuttuvilla 94:llä nimi **ei ole
leipätekstissä lainkaan** — haku sanalla "hankevastaava" osui 1/94.

Nimi on hankesivulla nimettynä kenttänä, jota hakurajapinta ei palauta:

```html
<div class="yva_content__item">
  <span class="yva_content__title">Hankkeesta vastaava:</span>
  Valoa Networks Oy, Dominic Marshall
</div>
```

Rakenne on sama kaikilla tarkistetuilla sivuilla ja sisältää seitsemän
kenttää: Tila, Alueet, Aihealue, Hankkeesta vastaava, Konsultti,
Yhteysviranomainen, Diaarinumero. **Nimetty kenttä on aina luotettavampi
kuin proosasta arvattu** — sama oppi kuin D-074:ssä. Yhteysviranomainen,
konsultti ja diaarinumero tulevat samasta jäsennyksestä ilman lisätyötä.

**Ensimmäinen sääntö oli väärä, ja kuivaharjoittelu paljasti sen.**
"Ota kaikki ensimmäiseen pilkkuun asti" tuotti 15 mitatusta kentästä
**viisi henkilön nimeä** — kenttä alkaa usein yhteyshenkilöllä ja
organisaatio on vasta seuraavana ("Annemarie Kallström, Myrsky Energia
Oy"). Lisäksi se katkaisi ELY-keskuksen nimen ("Uudenmaan elinkeino-"),
koska organisaation nimessä on pilkkuja.

Korjattu sääntö käy osat läpi ja valitsee ensimmäisen, joka ei ole
henkilö eikä yhteystieto. Julkiset toimijat tunnistetaan
organisaatiosanasta (virasto, keskus, hallitus, säätiö, rahasto…),
koska "Metsähallitus" ja "Väylävirasto" eivät kanna yhtiömuotoa eikä
`looksLikeCompany` siksi tunnistaisi niitä. Tavuviivaan päättyvä osa
liitetään seuraavaan, jotta pilkullinen nimi säilyy ehjänä.

**Ilman kuivaharjoittelua viiden hankkeen rakennuttajaksi olisi
kirjoittunut henkilön nimi.** Se on tämän istunnon toistuva opetus:
skriptin oma raportti kertoo mitä se yritti tehdä, ei mitä kantaan
päätyy.

Koukku on rekisteröity `lib/agent/sources.ts`:n yva-lähteelle, joten
uudet hankkeet saavat kentän D-075:n runkotyöntekijän kautta ilman
lisätyötä.

---

### D-076 – Hyväksyttyä hanketta ei voinut muokata lainkaan

**Löydös.** Johannes kertoi lisänneensä käsin tiedot hankkeelle
"Valmisruokalaitos Nurmoon" (Atrian tehdas, 82,4 M€) ja ihmetteli miksi
ne olivat kadonneet. Kanta kertoi että ne eivät kadonneet:

| | |
|---|---|
| luotu | 18.2.2026 |
| vaihehistoria | 0 riviä |
| tuontitapahtumat | 0 |
| metadata | vain `building_type` |

Data ei ole duplikaatissa eikä jonorivillä (haettu Atria/Nurmo/
valmisruoka).

⚠️ **Yksi todiste jouduttiin perumaan.** Päättelin ensin että riviä ei
ole koskaan päivitetty, koska `updated_at` oli tyhjä. Se ei todistanut
mitään: **`projects`-taulussa ei ole `updated_at`-saraketta lainkaan** —
se selvisi vasta kun tämä muokkausreitti kaatui siihen. Tyhjä kenttä ja
olematon kenttä näyttivät kyselyssä samalta. Muokkausaika kirjataan
siksi metadataan (`edited_at`).

Jäljelle jäävä näyttö (ei vaihehistoriaa, ei tuontitapahtumia, metadata
lähes tyhjä, ei muokkausreittiä olemassa) tukee yhä sitä ettei tietoja
ole tallennettu hankkeelle sovelluksen kautta — mutta **sitä ei voi
todistaa**, koska muokkausjälkeä ei ole kerätty mihinkään. Se on itse
asiassa tämän päätöksen kolmannen säännön koko peruste.

**Syy: sovelluksessa ei ollut reittiä hyväksytyn hankkeen
muokkaamiseen.** `app/api/tic/projects/update` muokkaa
`potential_projects`-taulua eli ehdokkaita. `projects`-tauluun
kirjoittivat vain approve, auto-complete, expire, duplikaattien
piilotus ja agentin verify — yhtään kenttäeditoria ei ollut. Käsin
syötetyt tiedot eivät siis voineet tallentua hankkeelle minkään
sovelluspolun kautta.

**Tämä oli myös este kaikelle rikastukselle.** 221 hanketta on
suunnittelu- tai rakentamisvaiheessa ilman rakennuttajaa ja
urakoitsijaa, eikä kukaan voinut korjata niitä käsin. Sama este koskisi
LLM-avusteista täydennystä: ehdotettua tietoa ei olisi voinut
hyväksyä mihinkään.

**Päätös: lisätään muokkausreitti, ja se noudattaa kolmea sääntöä.**

1. **Metadata yhdistetään, ei korvata.** Juuri metadatan
   ylikirjoittaminen on se mekanismi jolla tietoa katoaa huomaamatta.
2. **Käsin syötetty arvo on vahvin.** `cost_source` sai kolmannen
   tason `manual`, joka voittaa sekä `contract`in että `text`in — ihmisen
   korjaus ei saa kumoutua seuraavalla poiminnalla. Ks. D-072.
3. **Muokkaus jättää jäljen.** `metadata.edited_at` ja
   `metadata.edited_fields` kirjataan, ja vaiheen muutos menee
   vaihehistoriaan lähteellä `dashboard_admin`. Ilman jälkeä sama
   kysymys ("miksi tämä katosi") ei olisi vastattavissa ensi
   kerrallakaan — kuten se ei ollut nytkään.

**Todennettu tuotantodataa vasten** (Atrian tehdas, 15.8.2026):
reitti kirjoitti rakennuttajaksi "Atria Oyj" ja kustannukseksi
82 400 000 €, `building_type` säilyi metadatassa, toinen sama kutsu
palautti "ei muutoksia", ja simuloitu myöhempi poiminta (sopimusarvo
12 M€ + tekstistä 45 M€) EI kumonnut käsin syötettyä arvoa.

**Vaiheen käsimuutos saa peruuttaa taaksepäin.** Tuonnissa vaihe ei saa
peruuttaa (`phaseAdvances`), koska vanhentunut ilmoitus ei saa siirtää
hanketta väärään suuntaan. Ihmisen korjaus on eri asia: se on
nimenomaan sitä varten että kone luki väärin.

---

### D-075 – Osoite dokumentiksi haussa, runko myöhemmin

**Ongelma.** Legacy-reitin rikastus voi tapahtua vain niin kauan kuin
tiedote on vielä lähteen listaussivulla: `seenUrls` ohittaa jo nähdyt
(7 vrk) ja `ENRICH_PER_RUN` rajaa 40:een per ajo. Kun tiedote vierähtää
listalta, se jää pysyvästi siihen mitä otsikosta saatiin. Mitattu
15.8.2026: 128 hanketta oli kuvauksetta, ja vain käsin ajettu backfill
korjasi ne.

**Harkittu vaihtoehto oli siirtää kaikki 49 legacy-lähdettä
dokumenttimalliin.** Arvio: 49 lähdettä ≈ 15 parseria (kuntapäätökset
16 → 4, yritystiedotteet 28 → 1 jaettu + n. 5 poikkeusta, muut 5–6),
n. 5 267 riviä pääosin uudelleenkäytettävää logiikkaa. Kaksi asiaa
puhui sitä vastaan juuri nyt: **kaikki 49 lähdettä toimivat**
(jokaisella onnistunut ajo 10 vrk:n sisällä, ei virheitä), joten koko
riski olisi regressio ja koko hyöty rakenteellinen — ja kohdetiedosto
`apiCollector.ts` on **38 587 riviä ja 248 `source.parser ===`
-haaraa**, joten siirto sellaisenaan vaihtaisi "monta pientä tiedostoa"
-ongelman pahempaan.

**Päätös: tallennetaan haussa vain OSOITE dokumenttiriviksi
(`status: "listed"`), runko haetaan erillisessä työntekijässä.**

Perustelut:
- Se irrottaa rikastuksen listaussivun ikkunasta, mikä on koko ongelma.
- Runkoa **ei** haeta ajon sisällä — sivuhaku on juuri se kustannus
  jota `ENRICH_PER_RUN` rajoittaa.
- Se on **aito osajoukko täydestä siirrosta**, ei kiertotie: samat rivit
  joita siirretyt parserit myöhemmin lukisivat. Mikään ei mene hukkaan.
- Kun runko on kerran tallessa, poimintaa voi parantaa **takautuvasti**
  ilman uutta verkkohakua. Tämä olisi säästänyt kolme backfill-kierrosta
  15.8.2026.

**Yksi suoja oli pakollinen.** `factWorker` poimii dokumentit ehdolla
`facts_extracted_at is null` **ilman statussuodatinta**, joten
rungottomat rivit olisivat menneet suoraan faktojen poimintaan.
Lisätty `.neq("status", "listed")`. Todennettu kannalla: ilman suojaa
jonoon olisi tullut juuri ne 10 uutta riviä, suojan kanssa 0.

**Valmistumisehto, jottei tämä jää roikkumaan.** Kun vaihe 2
(runkotyöntekijä) toimii, `ENRICH_PER_RUN` ja `seenUrls`-ohitus
poistetaan haun puolelta ja `scripts/backfill-company-enrichment.ts`
**poistetaan**. Skriptin olemassaolo on merkki siitä että työ on kesken.

**Vaihe 2 tehty 15.8.2026:** `lib/agent/workers/releaseBodyWorker.ts`
hakee rungon `listed`-dokumenteille, tallentaa sen `raw_text`iin ja vie
rikastuksen jonoriville ja hankkeelle. Ajastettu 6 h välein
(`40 */6 * * *`), 30 min lähdeajon jälkeen. Todennettu 10 dokumentilla:
10/10 haettu, runko mediaani 3 598 merkkiä, 24 jonoriviä ja 2 hanketta
päivittyi, `factWorker`in jono pysyi nollassa.

Kolme yksityiskohtaa, jotka ratkaisivat oikein toimimisen:
- **Dokumenttia ei syötetä faktaputkeen.** Legacy-reitti on jo tuonut
  kandidaatin `importCandidate`illa, joten `factWorker`in läpi ajaminen
  loisi saman hankkeen toiseen kertaan. Rivi merkitään käsitellyksi
  (`facts_extracted_at`), mikä pitää sen pois jonosta.
- **Jono järjestetään `updated_at`in mukaan**, ei luontiajan. Virheeseen
  kaatunut rivi jää `listed`-tilaan uutta yritystä varten, ja
  luontijärjestys nostaisi saman rikkinäisen osoitteen kärkeen joka
  ajolla — nyt se siirtyy hännille itsestään.
- **Kuvauksessa pisin voittaa**, muissa kentissä olemassa oleva
  säilyy. Sama sääntö kuin backfill-skriptissä, ja siihen meni kolme
  yritystä (ks. roadmap 3¾).

---

### D-074 – Sijoittajauutinen on urakkatiedote, ei hallintotiedote

Kysymys "miksi tätä uutista ei ole poimittu" (SRV:n Hämeenlinnan Lyseo,
sopimuksen arvo 21,5 M€) paljasti **kaksi toisistaan riippumatonta
vikaa**, jotka molemmat piti korjata ennen kuin yksikin tällainen
tiedote menee läpi.

**1. Kategoriasuodatin sulki pois juuri arvokkaimmat tiedotteet.**
`fetchSrvSource` vaati kategorian Type002 ("Lehdistötiedote")
perustellen että sijoittajatiedotteet ovat hallinnollisia. Päättely oli
väärä: **pörssiyhtiölle merkittävä voitettu urakka ON olennainen tieto
sijoittajille**, joten suurimmat urakkavoitot julkaistaan Type004:nä
("Sijoittajauutinen"). Suodatin siis torjui sitä paremmin mitä
suuremmasta urakasta oli kyse.

Mitattu 15.8.2026: 24 kk:n ikkunassa 241 suomenkielistä tiedotetta,
joista 165 hankemaisia — Type002-ehto päästi läpi 81. Rajaus tehdään
nyt sisällöllä (avainsanat) eikä julkaisukanavalla; pois suljetaan vain
Type003 (johdon liiketoimet), jossa ei voi olla hanketta.

**2. "Sopimuksen arvo" ei ollut ankkuri.** Poimijassa oli "urakan
arvo" muttei "sopimuksen arvo" — ja juuri jälkimmäinen on pörssiyhtiön
vakiomuoto, koska tieto kirjataan sopimuksena tilauskantaan.

**2b. Ja este torjui senkin.** `AGGREGATE` sisälsi paljaan sanan
`tilauskan`, joka lisättiin torjumaan yrityksen tilauskantaa
koontilukuna. Mutta urakoitsijatiedotteen vakiofraasi on *"Sopimuksen
arvo on noin 18 miljoonaa euroa **ja se kirjataan yhtiön
tilauskantaan**"* — tilauskanta mainitaan nimenomaan siksi että kyse on
yhdestä uudesta sopimuksesta. Este rajattiin muotoon jossa tilauskanta
itse on luvun kohde (`tilauskanta oli 1,2 miljardia`).

Este oli myös epävakaa: se laukesi Kouvolan tiedotteessa muttei
Hämeenlinnan, koska ero oli yksi sana ikkunan reunalla. Sellainen vika
näyttää satunnaiselta eikä sitä huomaa ilman mittausta.

**Uusi ankkuri vaati oman esteensä.** Testit paljastivat regression
heti: "Toistaiseksi voimassa olevan sopimuksen arvo on 10 miljoonaa
euroa" (Tiera Oy:n palveluhankinta) on sopimuksen arvo muttei
rakennushankkeen kustannus. Lisätty `FRAMEWORK_CONTRACT`-este
(puitesopimus, vuosisopimus, toistaiseksi voimassa) joka koskee vain
sopimusankkuria — muut ankkurit sanovat jo itse mistä on kyse.

**Tulos:** SRV-lähde 81 → **165 ehdokasta**, ja euromäärä poimitaan
16:sta (10 %) — mukaan lukien molemmat kysytyt tiedotteet (21,5 M€ ja
18,0 M€). Vertailuksi: koko kannan keskiarvo on 6 %.

**Yleistettävä oppi:** lähdettä ei pidä rajata *julkaisukanavan* vaan
*sisällön* perusteella. Kanava kertoo kenelle tiedote on suunnattu,
ei sitä onko siinä hanke.

---

### D-073 – Hankkeen kokoa ei arvata, vain mitataan

Kokoluokka ("Suuri hanke") olisi voitu johtaa kohdetyypistä, koska
tyyppien mediaanit eroavat 18-kertaisesti (datakeskus 100 M€ →
rivitalo 5,5 M€). Mitattuna päättely ei kuitenkaan kanna:

- neljä luokkaa osui oikeaan **40 %:lla** (perusarvaus 31 %)
- kolme luokkaa 10 M€:n rajalla **50 %** — perusarvaus 49 %, eli
  hyödytön
- vain kahtiajako 10 M€:n kohdalta erottui: 68 % vs. 51 %

Tyyppien sisäinen hajonta on liian suuri: Kerrostalo 57 % ja
Hoivakoti 50 % ovat kolikonheittoja, ja juuri ne ovat yleisiä.
Luotettavat tyypit (≥ 75 %) kattavat **292 hanketta eli 5 %** — tuskin
enempää kuin ne 315, joilla arvo jo on.

**Päätös: kokoluokka lasketaan vain tiedossa olevasta arvosta.**
5 %:n lisäkattavuus hinnalla, että joka neljäs merkintä on väärä, ei
ole vaihtokauppa jonka asiakas häviäisi hiljaa — hän lukisi arvauksen
faktana ja tekisi myyntipäätöksiä sen varassa. Sama periaate kuin
D-057:ssä (tyhjä on parempi kuin väärä) ja D-072:ssa (alkuperä
näkyviin). `cost_source: "derived"` jää varatuksi mutta käyttämättä.

**Seuraus:** euromääräinen suodatus (kartta, /today) rajautuu siihen
mitä poiminta tuottaa. Kattavuus kasvaa vain keräämällä lisää tekstejä
joissa summa mainitaan — ei päättelemällä. Mitattu suunta: ammattilehti
(Rakennuslehti 25 % vs. koko kannan 6 %) ja urakoitsijatiedotteet, ks.
roadmap 3¾.

---

### D-072 – Hankkeen arvo kolmella tarkkuudella, alkuperä tallennettuna

Euromääräinen arvo oli 4 %:lla aktiivisista hankkeista (200/5 481),
vaikka se on asiakkaan kannalta keskeinen suodatin ja pisteytyksen
suurin moduuli nojaa siihen (`businessValue`, 50 p). Kartoituksessa
selvisi ettei kyse ollut puuttuvasta datasta vaan **kolmesta
katkenneesta kytkennästä**.

**1. Hilman sopimusarvo poimittiin jo — se ei vain päätynyt perille.**
`extractHilmaFacts` lukee `noticeResultTotalAmount`-kentän ja
tallentaa sen `metadata.contract_value`iin. Mitattu 15.8.2026: 105
aktiivisella hankkeella oli sopimusarvo, ja niistä **104:llä
`estimated_cost` oli tyhjä**. Syy: `syncApprovedProject` päivitti
metadatan muttei koskaan sarakekenttää. Tämä on paras mahdollinen
arvotieto — toteutunut hinta, ei arvio — ja se makasi käyttämättä.

**2. Tekstipoimija oli olemassa mutta sitä ei kutsuttu tuonnissa.**
`extractCostFromText` (D-062) oli kytketty **vain käsin ajettavaan
backfill-skriptiin**. Uusi hanke ei siis saanut kustannusta lainkaan,
ellei joku muistanut ajaa skriptin. Nyt ratkaisu on keskitetty
`resolvePotentialProject`iin samaan kohtaan kuin valmistumisajan
päättely, joten se koskee kaikkia lähteitä automaattisesti.

**3. Poimija tunnisti vain miljoonia.** Kuvio oli
`miljoonaa|milj|M€|Meur`, joten **alle miljoonan hankkeet olivat
rakenteellisesti näkymättömiä** — ja ne ovat enemmistö: Hilman
sopimusarvojen mediaani on 278 600 €. Lisätty täysien eurojen kuvio
(`850 000 euroa`, `1.250.000 €`) samoilla ankkureilla ja esteillä,
alaraja 10 000 €.

**Alkuperä tallennetaan (`metadata.cost_source`), koska eksakti
sopimusarvo ja arvio eivät saa näyttää samalta.** Järjestys
`contract > text`, ja `resolveProjectCost` estää huonomman alkuperän
kirjoittamisen paremman päälle: sopimusarvo saa korvata tekstiarvion,
ei toisinpäin. Merkitsemätön vanha arvo tulkitaan arvioksi — muuten
aito sopimusarvo ei koskaan kirjoittuisi sen päälle.

**Mitattu tulos.** Kattavuus 200 → 315 / 5 607 (4 % → 6 %), joista
**104 on eksaktia sopimusarvoa**. Jonoon kirjoitettiin 197 riviä
(135 sopimusarvoa, 62 tekstistä), jotka valuvat hankkeisiin
hyväksynnän myötä. Olemassa olevista 200 arvosta **täsmälleen yksi
muuttui**: 425 000 → 395 000, kun arvio korvautui sopimusarvolla.

**Tärkein vaikutus ei ole tuo 2 %-yksikköä vaan se, että kytkennät
ovat nyt olemassa** — aiemmin kenttä täyttyi vain käsin ajetusta
skriptistä, nyt jokainen uusi Hilma-sopimus ja jokainen
kustannusarvion mainitseva teksti poimitaan automaattisesti.

**Kolmas taso ("oma arvio") jätettiin tarkoituksella tekemättä.**
Kohdetyypistä johdettu mediaani nostaisi kattavuuden 59 %:iin, ja
korrelaatio on todennettu (roadmap 3¾: 100 M€ datakeskus → 5,5 M€
rivitalo). Mutta arvatun luvun näyttäminen asiakkaalle on
tuotepäätös, ei poimintapäätös: `cost_source: "derived"` on varattu
sitä varten, eikä `resolveProjectCost` tuota sitä ennen kuin
näyttötavasta on päätetty.

---

### D-071 – "Muu" ei ollut käyttäjän valinta vaan listan aukko

Puolet asetuksensa säätäneistä tileistä (13/26) oli roolissa "Muu", jonka
painot olivat `Muu: {}` — tyhjä. Rooli on 40 pistettä pisteytyksen 160:n
viitemaksimista eli sen suurin yksittäinen moduuli, joten **puolen
käyttäjäkunnan syöte järjestyi vain hankkeen koon ja tuoreuden mukaan**.
Se on täsmälleen se kaikille sama lista, jonka P1:n piti poistaa.

**Syy selvisi katsomalla keitä he ovat.** "Muu"-tilien verkkotunnukset
15.8.2026: henkilöstövuokrausta 4 tiliä, erikoisurakointia 2 (maalaus,
teräsrakenteet), konevuokrausta 1, mittauspalvelua 1. Yhdeksän
vaihtoehdon listalla ei ollut yhtäkään näistä. Kyse ei ollut siitä
etteivät käyttäjät viitsineet valita, vaan siitä ettei heille ollut
mitään valittavaa. Roadmap tarjosi kolme vaihtoehtoa (lisää rooleja /
päättely toimialasta / oletuspainot); data valitsi niistä kaksi ja
sulki yhden pois.

**Roolin päättely toimialasta suljettiin pois: siihen ei ole dataa.**
Avainsanoja oli asettanut **0 tiliä 26:sta**. Profiilissa ei ole
yritys- eikä toimialakenttää. Ainoa käytettävissä oleva vihje olisi
sähköpostin verkkotunnus, ja sen tulkinta on arvausta.

**HUOM tulkinnasta: nämä kaksi lukua eivät ole vertailukelpoisia.**
`RoleActivationModal` pakottaa roolin ja vähintään yhden myyntihetken
(`canSave = Boolean(role) && selectedMoments.length > 0`), kun taas
avainsanoja ei kysytä siinä lainkaan. "0/26 avainsanaa" ei siis kerro
haluttomuudesta vaan siitä **ettemme kysy** — ja "26/26 myyntihetkeä"
on pakotettu valinta, ei vapaaehtoinen signaali. Molemmat ovat
korjattavissa kysymällä, eivät päättelemällä.

**Myyntihetki on silti paras käytettävissä oleva signaali** — se on
tietoinen klikkaus nimettyihin vaiheisiin, ja "Muu"-tileistä
enemmistö valitsi 1–5 vaihetta yhdeksästä eli erotteli aidosti.
Rakenteilla oli valittuna kaikilla kolmellatoista. Rajoite on
tunnettava: pakotettu valinta tuottaa myös kohinaa, ja muutama tili
valitsi kaikki 8–9 vaihetta, jolloin paino on vakio eikä erottele
mitään.

Pakotus selittää myös itse ongelman: kun valikko on pakollinen eikä
siinä ole omaa toimialaa, "Muu" on ainoa ulospääsy. 50 %:n osuus ei
siis mittaa välinpitämättömyyttä vaan valikon kattavuutta.

Ratkaisu on siksi kolmiportainen (`resolveStageFit`): **rooli →
käyttäjän omat myyntihetket → mitattu oletus**. Neljä puuttunutta
roolia lisättiin (Henkilöstövuokraus, Aliurakointi, Konevuokraus,
Konsultti), ja niiden painot johdettiin näiden samojen tilien omista
valinnoista — ei arvattu.

**Pääteltu paino jää tarkoituksella alle 1.0:n (0.9 / oletus 0.6–0.9).**
P2-hälytys laukeaa vain painolla 1.0, joten päättely ei saa nostaa
signaalia ilmoitetun roolin tasolle: se lähettäisi sähköpostia
ihmisille jotka eivät ole kertoneet meille mitä tekevät. Hälytysten
`roleStageWeight` jätettiin muuttumatta puhtaaksi roolikyselyksi.

**Sivulöydös, joka osoittautui isommaksi.** Myyntihetkimoduuli vertasi
vapaaseen tekstiin viidellä substring-säännöllä, joten yhdeksästä
vaiheesta neljä — "Sopimus myönnetty", "Valmistumassa", "Valmistunut",
"Ideointi" — ei tuottanut pisteitä koskaan, vaikka ne ovat
valittavissa ja käytössä. Nyt vertailu tehdään kanoniseen vaiheeseen
kuten muuallakin P1:ssä. Pistemäärä pidettiin 20:ssä (ei nostettu
30:een), koska vanha 30 oli katto joka täyttyi vain kahden säännön
osuessa samaan hankkeeseen — muuten korjaus olisi nostanut moduulin
painoa 50 % sivutuotteena.

**Mitattu vaikutus todellisilla asetuksilla** (top 20, 24 asiakastiliä):
"Muu"-tileillä vaihepisteet nousivat nollasta keskimäärin 43 %:lle
hankkeista, mutta **top 20 vaihtui vain 3/20** — koko (50 p) ja tuoreus
(25 p) hallitsevat yhä, ja moni "Muu"-tili on valinnut niin monta
vaihetta että bonus on lähes vakio. Roolillisilla tileillä vaihtui
8/20, ja se muutos tulee kokonaan vaihesanaston korjauksesta. Eli:
selitys ja pisteytys korjaantuivat kaikille, mutta järjestys muuttui
eniten niillä joilla rooli oli jo kunnossa.

**Auki:** (a) moduulipainojen tasapaino — rooli 40 vs. koko 50 tarkoittaa
että iso epärelevantti hanke voittaa pienen relevantin; (b) nykyiset 13
"Muu"-tiliä eivät siirry uusiin rooleihin itsestään, vaan vasta jos
palaavat asetuksiin; (c) vaihesanaston epäyhtenäisyys (Työjono)
vääristää juuri tätä ulottuvuutta.

---

### D-070 – Keskeytetty hankinta ei ole myönnetty sopimus
Hilma julkaisee hankinnan keskeyttämisen **samalla ilmoitustyypillä**
kuin sopimuksen myöntämisen (`ContractAwardNotices`), joten peruttu
kilpailutus sai vaiheen "Sopimus myönnetty". Asiakkaalle kerrottiin että
urakka on annettu jollekin, vaikka ketään ei valittu. Mitattu
15.8.2026: 11 riviä, joista **kolme oli asiakkaille näkyvissä**.

**Kaksi rakenteista signaalia kokeiltiin ja molemmat hylättiin.**

`isCancelled` on Hilman oma kenttä ja se on **false** myös
ilmoituksella jonka otsikko on "Keskeytysilmoitus, TAPO Köyliöntien…" —
varmistettu raakadatasta. Kenttä ei kerro tästä mitään.

`notice_type` ei erottele: tyyppi 29 on 83 riviä joista 5 keskeytyksiä,
tyyppi E4 on 174 riviä joista 5. Ne ovat sopimusilmoituksen
alatyyppejä, eivät keskeytyksen tunnuksia.

**Voittajan puuttuminen yksin on liian löysä.** 290 sopimusilmoituksesta
45:ltä puuttuu voittaja, mutta vain 10 niistä on keskeytyksiä — 35
väärää osumaa.

Toimiva tunnistus on **otsikko ja voittajan puuttuminen yhdessä**: osuu
kaikkiin 11 keskeytysriviin eikä yhteenkään väärään. Voittajaehto on
turva sille tapaukselle että ilmoitus keskeyttää yhden osan ja myöntää
toisen — silloin voittaja on merkitty eikä hanketta saa palauttaa
kilpailutukseen.

**Hanketta ei hylätä eikä piiloteta.** Keskeytetty kilpailutus
kilpailutetaan yleensä uudelleen, joten liidi on yhä aito — jopa
arvokas, koska se palaa. Väärin oli vain vaihe, joten hanke palautetaan
kilpailutukseen. Sama päättely kuin D-057:ssä: tyhjä tai varovainen on
parempi kuin väärä väite.

Ajettu: 10 riviä korjattu (3 näkyvissä, 7 jonossa).

---

### D-069 – Tunnuksesta jää päiväkirjamerkintä, tilaustietoa ei kerätä
Tunnuksen poisto on kova poisto (`auth.admin.deleteUser`), eikä siitä
jäänyt mitään jäljelle. Vuoden päästä ei siis voisi sanoa montako
tunnusta on kaikkiaan luotu - tieto katoaisi jokaisen poiston mukana.

**Ratkaisu on erillinen loki, ei kenttä olemassa olevassa taulussa.**
`account_lifecycle` saa merkinnän jokaisesta tunnuksesta. Kolme
ominaisuutta tekevät siitä pysyvän:

- **Ei vierasavainta `auth.users`iin.** Vierasavain `ON DELETE CASCADE`
  pyyhkisi historian samalla kun tunnus poistetaan, eli tekisi
  täsmälleen sen mitä taululla estetään.
- **Poisto estetty triggerillä.** Pelkkä RLS ei riitä, koska service
  role ohittaa sen. Muokkaus on sallittu: sähköposti ja nimi on voitava
  nollata poistopyynnön yhteydessä, jolloin merkintä ja päivämäärä
  jäävät ja luvut säilyvät ilman henkilötietoa.
- **Vain lisäyksiä.** Tila luetaan tapahtumista, kuten
  `analytics_events`-taulussa.

Ylläpito on täsmäytys (`scripts/sync-account-lifecycle.ts`), ei
triggeri `auth.users`-tauluun. Tilejä syntyy useaa reittiä, ja
unohdettu reitti jäisi hiljaa kirjaamatta; täsmäytys kattaa kaikki ja
myös menneet. Triggeriä Supabasen omaan skeemaan ei tehdä, koska
rikkinäinen triggeri siellä estäisi kirjautumisen.

**`profiles.created_at` EI OLE TILIN LUONTIPÄIVÄ.** Se on profiilirivin
luontipäivä. Mitattu 15.8.2026: 40 profiiliriviä oli luotu kaikki
samana päivänä 3.5.2026 - se on taulun käyttöönoton täydennysajo - ja
51 tiliä 73:sta oli eri päivällä kuin `auth.users`, suurin ero **78
vuorokautta**. Ensimmäinen tilannekuva laskettiin profilesin mukaan ja
raportoi "40 tilin erän toukokuussa". Sellaista erää ei ollut:
todellisuudessa helmikuussa 28 ja maaliskuussa 11. Rekisteröitymispäivä
luetaan siis `auth.users`ista.

**Yritys tunnistetaan sähköpostin domainista**, koska erillistä
yrityskenttää ei ole. 52 tiliä 73:sta on yritysdomainissa (23 eri
yritystä), 21 ilmaissähköpostissa eikä niitä voi yhdistää yritykseen
millään. Ilman ilmaissähköpostilistaa "gmail.com" olisi näyttänyt
suurimmalta asiakkaalta 15 tilillä.

**Tilaus- ja trial-tilaa EI kerätä.** Kannassa ei ole
`subscriptions`-, `plans`- eikä `trials`-tauluja, eikä niitä lisätä:
omistaja laskuttaa asiakkaat itse ja tietää maksavien määrän ilman
järjestelmää (päätös 15.8.2026). `account_lifecycle` tukee tarvittaessa
tapahtumia `trial_started`, `converted` ja `cancelled`, mutta niitä ei
kirjoiteta mistään. **Älä ehdota tilaustenhallintaa uudelleen ilman
että sitä pyydetään.**

---

### D-068 – "Onko tämä käsitelty" on eri kysymys kuin "syntyikö tästä hanke"
Nähty-tarkistus kysyi `project_sources`-taulua, joka vaatii
`project_id`:n. Se vastaa kysymykseen *syntyikö tästä hanke* - ei
kysymykseen *onko tämä jo käsitelty*. Hylätty kandidaatti ei jättänyt
sinne jälkeä, joten se tuotiin ja hylättiin uudelleen joka ajossa.

Toinen vika oli ikkunassa: 24 h, kun näiden lähteiden `refresh_minutes`
on 1440 eli myös 24 h. **Ikkuna joka ei ole pidempi kuin lähteen ajoväli
ei voi rakenteellisesti ohittaa mitään** - edellinen ajo on aina juuri
liian vanha.

Mitattu stt_haku: 861 kandidaatista 859:llä oli jo tuontitapahtuma (411
skipped, 282 queued_for_review, 166 verified) ja vain **2** oli aidosti
uusia. Silti tuontiin meni 866. Noin 0,84 s per kandidaatti tarkoittaa
~12 minuuttia työtä 90 sekunnin budjetissa.

Tarkistus lukee nyt `project_import_events`-taulua, johon jokainen
yritys kirjautuu myös hylättynä, ja ikkuna on viikko. Mitatut
vaihtoehdot tuontiin menevistä: nykyinen 866, tapahtumat + 24 h 670,
tapahtumat + 7 vrk **45**, tapahtumat + 30 vrk 2. Kuukausi hylättiin:
niin pitkällä ikkunalla sivun aito päivitys jäisi huomaamatta.

Todennettu: stt_haku 874 -> 50 tuontiin, rakennuslehti 16 -> 2. Ajon
arvio 42 s, kun raja on 90 s.

**Hinta on kuvaustäydennys.** `enrich()` ajetaan vain näkemättömille
kandidaateille, joten jo tuodun rivin kuvausta ei enää täydennetä tätä
kautta. Aiemmin se toimi vahingossa: kaikki näyttivät näkemättömiltä,
joten 40 täydennyspaikkaa saattoi osua mihin tahansa riviin. Nyt pooli
on vain aidosti uudet. Vaihtoehto olisi irrottaa täydennys
nähty-ehdosta kokonaan; se jätettiin tekemättä, koska kuvausten
takautuva täydennys hoidetaan jo omilla skripteillään
(`backfill-stt-bodies`, `backfill-rakennuslehti-bodies`) eikä
sivutuotteena turhasta tuonnista.

`isSourceUrlSeenRecently` (/api/agent/seen-source) jätettiin ennalleen:
se on eri rajapinta eikä osa keräysputkea.

---

### D-067 – "Ongelmia 13" oli enimmäkseen oman valvonnan jälkiä
TIC näytti 13 rikkinäistä lähdettä. Mittaus: 2 062 ajoa, mediaanikesto
4,1 s, p90 19,2 s, ja viimeisestä 1 000 ajosta 971 onnistui. Kaikilla
13:lla oli `success_count > 0`. Aidosti rikki oli **yksi**.

**1. Vahtikoira leimasi virheajan väärään hetkeen.** Jumiin jäänyt ajo
merkittiin virheeksi SIIVOUSHETKEEN, joka voi olla viikkoja ajon
jälkeen. Koska tila vertaa `last_error_at > last_success_at`, lähde jäi
punaiseksi vaikka olisi onnistunut sen jälkeen. Rovaniemen Kaavatorin
virhe oli oikeasti 20.7. mutta leimattuna 13.8. - **24 vuorokauden**
ero, ja neljä tuoreinta ajoa oli onnistunut.

Aikaleima otetaan nyt ajon omasta alusta. Päättymisajaksi merkitään
alku + tunti eli hetki jolloin ajo tiedettiin kuolleeksi; nykyhetki
tuotti kestoja kuten 2 131 658 s, jotka pilasivat kestotilastot (p99 oli
10 037 s). Vanhat rivit korjattiin ajolokista: 20 ajoa ja 22
aikaleimaa, joista **4 lähdettä lakkasi näkymästä rikkinäisenä**.

**2. Katkaisuviesti syytti lähdettä omasta työstämme.** "Lähde ei
vastannut 90 sekunnissa" on väärä: raja kattaa koko ajon - haun,
täydennyksen ja kaikkien kandidaattien tuonnin. Mitattu: Rakennuslehden
syöte ja kaikkien kandidaattien täydennys vievät 1,2 s, mutta ajo
katkesi 114 sekuntiin. Hitaus oli tuonnissa.

**3. Virheellä ei ollut tuoreutta.** Kertaluontoinen katko jäi
näkyviin, kunnes lähde sattui onnistumaan. Yli viikon vanha korjaamaton
virhe näytetään nyt omana tilanaan eikä lasketa "ongelmiin". Sitä ei
piiloteta: se jää listaan ja suodattimeen.

**STT oli se yksi aito - ja syy oli aikakatkaisu itse.** Lähteen
ONNISTUNEET ajot kestivät 209-216 s. Kun 90 sekunnin katkaisu lisättiin
(D-060), lähde ei voinut enää onnistua kertaakaan: kahdeksan peräkkäistä
virhettä. Katkaisu oli siis puolet siitä mitä lähde tarvitsi.

Ratkaisu on sama kuin ajokohtaisessa aikabudjetissa (D-062): tuonti
lopetetaan siististi ennen katkaisua ja ajo kirjataan onnistuneeksi
sillä mitä ehdittiin. Budjetti lasketaan ajon alusta, koska haku on osa
katkaistavaa aikaa - haun jälkeen aloitettu budjetti ylittäisi rajan
juuri niillä lähteillä joita sen on tarkoitus suojata.

**Matkalla löytyi kaatava vika.** `findRecentlySeenSourceUrls` pilkkoi
osoitelistan sadan paloihin. STT:n osoitteet ovat pitkiä: 100 kpl =
17 585 merkkiä, mikä ylittää PostgRESTin 16 kt otsikkorajan
(UND_ERR_HEADERS_OVERFLOW). Funktio heittää, joten se pysäytti koko
lähteen ajon. Pala mitoitetaan nyt pituuden mukaan.

**Ratkaistu D-068:ssa - kandidaatit tuodaan uudelleen joka ajossa.** Nähty-tarkistus
lukee `project_sources`-taulua, jossa on 763 riviä ja joka vaatii
`project_id`:n. Hylätty kandidaatti ei siis jätä sinne jälkeä, vaikka
jokainen tuontiyritys kirjautuu `project_import_events`-tauluun
(34 392 riviä). Mitattu: STT:n 874 kandidaatista vain **8** tunnistettiin
nähdyiksi. Tarkistus kysyy siis taulua joka ei rakenteeltaan voi
vastata kysymykseen. Korjaus muuttaisi kaikkien 300 lähteen käytöstä ja
kytkeytyy kuvaustäydennyksen kiertoon (täydennys ajetaan vain
näkemättömille), joten se on oma päätöksensä.

---

### D-066 – Urakoitsija myös ingressistä, ja artikkelin loppu on katkaistava ilman maksumuuriakin
Sääntö ei poiminut urakoitsijaa siltä riviltä josta se sai alkunsa
("Nyab rakentaa sähköaseman Forssaan"). Rajaus oli tiedossa ja
dokumentoitu D-065:ssä, mutta se on korjattavissa: tilaaja **on**
tekstissä, vain ei otsikossa.

**Todiste kelpaa nyt myös ingressistä.** "Infrarakentaja Nyab on sopinut
kantaverkkoyhtiö Fingridin kanssa ... sähköaseman rakentamisesta."
Sopimuskumppanin NIMEÄ ei poimita: genetiivin perusmuoto ei ole
yksikäsitteinen ("Fingridin" → Fingrid, mutta "Skanskan" → Skanska).
Urakoitsijapäättelyyn riittää todiste erillisestä tilaajasta, eikä sen
tarvitse tietää tilaajan nimeä.

Kuviot ovat tarkoituksella eri otsikossa ja leipätekstissä. Otsikossa
kelpaa allatiivi, koska rakenne on lyhyt ja vakiintunut. Leipätekstissä
`-lle` osuu jatkuvasti yleissanoihin ("tontille", "alueelle"), joten
siellä vaaditaan sopimusmaininta tai nimetty rooli (tilaajana,
rakennuttajana, toimeksiannosta). Yhteistyömaininta hylätään:
kumppanuudesta ei voi päätellä kumpi osapuoli urakoi.

**Allatiivi on suomessa myös määränpää.** "Fira rakentaa
pysäköintitalon Hyvinkäälle" ei nimeä tilaajaa lainkaan. Mitattu: 57
osumasta **yksi** nojasi paikannimeen. Lopputulos sattui olemaan oikein
(Fira on urakoitsija), mutta todiste oli pätemätön, joten paikannimi
suljetaan pois.

**Maksumuuri ei ollut oikea raja.** D-065 katkaisi tekstin
kirjautumiskehotukseen. Maksuttomassa jutussa sitä ei ole, jolloin
poiminta jatkui uutislistaan: "Härmälänojan silta" venyi 4 000 merkkiin
ja loppuosa oli naapuriartikkelien otsikoita ("Rakennusteholle iso
OSAO-urakka", "Tekovalta liikekompleksi Ouluun").

Tämä muuttui vaaralliseksi juuri nyt: niin kauan kuin urakoitsija
luettiin vain otsikosta, roskainen kuvaus oli kosmeettinen haitta. Kun
sama kuvaus on todistusaineistoa, naapurijutun yritysnimi on väärä
urakoitsija. Katkaisuun lisättiin lehden omat palkit; sama juttu on nyt
2 778 merkkiä ja loppuu allianssin kokoonpanoon.

**Kuvateksti ei ole hankkeen tekstiä.** Leipäteksti alkoi
"Kuvituskuva. Kuva: Nyab ...". Krediitin yritysnimi on valokuvaaja, ei
rakentaja, ja se oli ingressin EDESSÄ eli juuri siinä ikkunassa josta
osapuolet luetaan. `figcaption` poistetaan nyt kaikilta
tiedotelähteiltä.

Ajettu: 50 kuvausta haettu uudelleen (Nyab 56 → 199 merkkiä),
2 urakoitsijaa täydennetty (Nyab, KSBR).

**Auki:** rakennuttaja jää yhä tyhjäksi (Fingrid). Se vaatii genetiivin
perusmuodon päättelyn, jota ei voi tehdä yksikäsitteisesti - sama este
kuin `allativeToNominative`-funktiossa, joka palauttaa nullin
epävarmassa tapauksessa.

---

### D-065 – Urakoitsija otsikosta, artikkelin teksti ja pelkkä vuosi
Kolme puutetta samalta riviltä ("Nyab rakentaa sähköaseman Forssaan").

**1. Urakoitsija jäi tyhjäksi.** Yritysten omilla sivuilla se tulee
julkaisijasta, mutta uutislähteillä julkaisija on toimitus. Otsikon
rakenne kertoo tekijän silti.

Pelkkä "X rakentaa" ei kuitenkaan riitä: omaperusteisessa tuotannossa
tekijä rakentaa itselleen ja on rakennuttaja. Mitatut esimerkit:
"Espoon Asunnot rakentaa 82 vuokra-asuntoa", "PeeÄssä rakentaa
S-marketin", "Mainiokodit rakentaa asumispalveluyksikön". Siksi
vaaditaan tilaaja allatiivissa ("Hartela toteuttaa A-Kruunulle...").

Tarkkuus mitattiin olemassa olevaa dataa vasten: sääntö osuu 57 riviin,
joista **42:lla urakoitsija oli jo kirjattu ja se on sama nimi**.

Rajaus maksaa kattavuutta: se EI kata sitä riviä josta ilmoitus tuli,
koska uutisotsikko ei nimeä tilaajaa lainkaan. Väärä rooli olisi
pahempi kuin tyhjä kenttä, koska urakoitsijaa käytetään
kilpailija-analyysiin.

**2. Kuvaus oli 56 merkkiä.** RSS antaa vain ingressin. Artikkelin alku
sisältää kaiken olennaisen - urakoitsija, tilaaja, kohde, sijainti ja
aikataulu - joten sivu haetaan nyt erikseen.

Maksumuuri on katkaistava: Rakennuslehti näyttää vain alun ja sen
jälkeen listaa MUIDEN artikkelien otsikoita. Ilman katkaisua ne
päätyisivät kuvaukseen, mikä on sama saaste joka tuotti vääriä
kohdetyyppejä ja kustannuksia. Mitattu: 56 -> 223 merkkiä, roskaton.

**3. Valmistumisvuotta ei poimittu.** Kysymys oli aiheellinen: teksti
sanoo "valmista on vuonna 2028", eikä mikään kuvio poiminut sitä, koska
kaikki vaativat kuukauden. Mitattu 109 riviä samassa tilassa.

Pelkkä vuosi kartoitetaan vuoden VIIMEISEEN päivään, samasta syystä
kuin vuodenajat kartoitetaan myöhäisimpään kuukauteen: hanketta ei
merkitä valmiiksi ennen aikojaan.

Samalla löytyi piilevä vika vartijassa: "valmis"-vartalo osuu myös
sanaan **valmistelu**, joka tarkoittaa päinvastaista. "Hankkeen
valmistelun yhtiön kanssa vuoden 2024 aikana" olisi antanut
valmistumisajaksi 2024.

Ajettu: 15 urakoitsijaa, 277 valmistumisaikaa (joista 96 siirtyi
tavoitteeksi ja 16 poistettiin mahdottomana).

**Kaksi ohjausmerkkiä matkalla.** Regexien muokkaus Python-heredocilla
muunsi `\b`:n kahdesti kirjaimelliseksi backspace-merkiksi (0x08),
jolloin kuvio vaati tekstiltä ohjausmerkkejä eikä osunut koskaan.
Molemmat näyttivät oikealta editorissa ja läpäisivät tyyppitarkistuksen.
Vika löytyi vasta `cat -A`:lla. Älä muokkaa regexejä heredocilla.

---

### D-064 – Vaihepäättely oli kuollutta koodia kaikille tiedotelähteille
"Nyab rakentaa sähköaseman Forssaan" jäi vaiheeseen Suunnittelussa,
vaikka kuvaus sanoo **"Rakentaminen alkaa elokuussa"** ja avainsana
"rakentaminen alkaa" on ollut sanastossa alusta asti.

Syy oli yhdessä ehdossa: `importCandidate` kutsui `inferPhaseFromText`
vain kun lähde EI antanut vaihetta. Noin **20 lähdettä** asettaa sen
kiinteästi muodossa `completed ? "Valmistunut" : "Suunnittelussa"`, joten
ehto ei täyttynyt koskaan - päättely ei ajanut yhdellekään
tiedotelähteelle.

**AVAINSANA YKSIN EI RIITÄ, JA SE MITATTIIN.** Kun päättely kytkettiin
päälle, se olisi siirtänyt 68 riviä. Tarkistin kohteet:

| kohde | tulos |
|---|---|
| Rakennuslupa (18) | kuudesta tarkistetusta **yksi** oikein - muut menneitä lupia, vasta haettavia, kustannuserittelyn rivejä ("suunnittelut (rakennuslupa)") tai lomaketekstiä |
| Kilpailutus (2) | osui aikataululistaan "urakkalaskenta ja urakoitsijavalinnat 2-4/2027" |
| Rakenteilla (42) | paras, mutta mukana "rakentaminen alkaa suunnitelmien mukaan **2028**" |

Siksi teksti saa siirtää vaihetta vain rakentamisen alkamiseen, ja vain
kun `constructionHasStarted` vahvistaa ajankohdan menneeksi. Päätevaiheet
(Valmistunut, Peruttu) jäävät kokonaan pois: "valmistui" tarkoittaa
tiedotteissa lähes aina kohteen alkuperäistä rakennusvuotta, ja
valmistuneeksi merkitseminen piilottaa hankkeen asiakkaalta.

**VARTIJA POIMI ENSIN VÄÄRÄN VUODEN.** Ensimmäinen versio luki
90 merkin ikkunan verbin jälkeen, ja lauseesta "Rakentaminen alkaa
elokuussa ja valmista on vuonna 2028" se poimi 2028:n eli
VALMISTUMISvuoden - jolloin juuri se rivi jonka piti korjaantua jäi
korjaamatta. Ikkuna katkaistaan nyt lauseenosaan (`ja`, `sekä`, `jonka`,
piste), koska sivulause aloittaa uuden asian.

Vika näkyi vain siksi että tarkistin nimenomaan sen rivin josta ilmoitus
tuli, eikä pelkkää kokonaislukua: rajaus näytti ensin toimivan (86 riviä
siirtyi), mutta oikea rivi ei ollut joukossa.

Ajettu: 13 riviä. Ero 86:een tulee siitä että katkaisu pudotti pois ne
joissa osuma perustui väärään vuoteen.

---

### D-063 – Kerays ja kasittely omiin cron-kutsuihinsa
Ajokohtainen budjetti (D-062) teki pullonkaulasta nakyvan heti
ensimmaisessa ajossa: **14.8.2026 klo 21 ajo paattyi merkintaan
`stopped_at: "facts"`**.

| | |
|---|---|
| kesto | 381 s (76 %) |
| lahteita | 14 (kierto palautui) |
| lahteet veivat | 317 s |
| faktavaiheelle jai | ~60 s -> 14 tyota |
| jono | 34 -> **41** |

Kerays on siis kunnossa; kasittely ei pysy perassa. Ilman
`stopped_at`-kenttaa tama olisi nayttanyt samalta kuin "hitaat lahteet",
ja optimointi olisi kohdistunut vaaraan paahan.

**RATKAISU OLI JO KUVATTU KOODISSA MUTTA JAANYT KYTKEMATTA.**
`discoveryPipeline.ts`:n kommentti kuvaa kahta erillista cron-kutsua
(kerays, sitten kasittely omalla budjetillaan), mutta `vercel.json`:ssa
oli vain yksi. Niin kauan kuin vaiheet jakavat saman 380 sekunnin
budjetin, kasittely saa aina vain sen mita keraykselta jaa yli.

Toinen cron ajaa nyt kymmenen minuuttia myohemmin
(`?mode=process`), ja se saa oman taydet budjettinsa: 120 faktatyota ja
40 tunnistuksen kiinniottoa aiemman 45/5 sijaan.

**Sama reitti, ei uutta.** Tunnistus ja lokitus ovat jo
`/api/tic/discovery/run`:ssa, joten toinen reitti kahdentaisi ne. Moodi
valitaan kyselyparametrilla kuten `scan-duplicates`-cronissa jo tehdaan.

**Yksi kytkenta puuttui.** `maxIdentityCatchUpJobs` ei kulkenut
`run-pipeline`-reitin lapi lainkaan, joten kasittelyajon oma arvo olisi
jaanyt huomiotta ja kiinniotto olisi kayttanyt oletusta 5 - juuri se
mita erillisella ajolla yritettiin korjata.

---

### D-062 – Ajokohtainen aikabudjetti: tapettu ajo katoaa tilannekuvasta
Lähdekohtainen 90 sekunnin katkaisu (D-060) esti yksittäisen jumittajan,
mutta ei sitä että USEA hidas lähde osuu samaan ajoon. Mitattu
14.8.2026 klo 15:

| lähde | kesto |
|---|---|
| Hilma, Lieto, Naantali, Iisalmi | 2,9–18,7 s |
| Asura tiedotteet | 54,7 s |
| SRV tiedotteet | **91,9 s → katkaistu** |
| Jatke tiedotteet | **111,8 s → katkaistu** |
| Tekova tiedotteet | alkoi **+375 s**, jäi kesken |

Alusta tappoi funktion 500 sekunnin katossa kesken Tekovan. Aikakatkaisu
siis toimi - SRV ja Jatke kirjautuivat virheiksi eivätkä jääneet
`started`-tilaan - mutta ajo ehti silti loppua kesken.

**TAPETTU AJO ON PAHEMPI KUIN LYHYT AJO.** Lokirivi kirjoitetaan vasta
lopussa, joten ajo katoaa tilannekuvasta kokonaan: TIC:in ajolistalla ei
näy mitään, ja ilman `discovery_runs`-taulun kaivamista näyttää siltä
ettei ajoa yritettykään. Sama vikaluokka kuin jumittuneessa lähteessä.

Budjetti pysäyttää UUSIEN töiden aloittamisen 380 sekunnissa, jolloin ajo
päättyy siististi ja kertoo mihin se ehti (`stoppedAt`). Kesken jääneet
lähteet ovat seuraavan ajon kärjessä, koska niiden `last_run_at` ei
päivittynyt.

**380 s eikä lähempänä kattoa:** jäljelle jäävä 120 sekuntia riittää
siihen että käynnissä oleva lähde saa aikakatkaisunsa (90 s) loppuun ja
lokirivi ehtii kirjoittua. Tarkistus on jokaisen vaiheen silmukassa, ei
vain lähdevaiheessa - faktapoiminta voi yhtä lailla ylittää katon kun
jono kasvaa.

`stoppedAt` tallentuu sarakkeeseen `discovery_pipeline_runs.stopped_at`
(lisätty käsin SQL-editorissa 14.8.2026). Ilman sitä lyhyt ajo näyttää
tilannekuvassa samalta kuin tyhjä yö: viisi lähdettä neljäntoista
sijaan, eikä mikään kerro loppuiko aika vai lähteet.

---

### D-061 – STT ei jumittunut vaan oli liian hidas
D-060 esti jumittunutta lähdettä pysäyttämästä putkea, mutta jätti auki
miksi STT jumittui. Se ei jumittunut lainkaan: rajapinta vastaa
moitteetta, lähde on vain liian hidas mahtuakseen ajon budjettiin.

**MITTASIN ENSIN VÄÄRIN.** Arvioin 44 hakusanaa × 10 sivua = 440
pyyntöä ≈ 200 s, koska käytin koettimessa sivukokoa 20. Todellinen
`STT_PAGE_SIZE` on 100, jolloin tuoreusraja katkaisee useimmat
hakusanat ensimmäiseen sivuun. Oikea mittaus: **58 pyyntöä, 59,6 s,
5 250 tiedotetta**, keskimäärin 1 027 ms per pyyntö.

Kuusikymmentä sekuntia on jo yksin enemmän kuin lähdeajolle jäävä
budjetti kestää, kun päälle tulee 876 kandidaatin tuonti ja 40
tiedotesivun täydennys. Ajo ylitti reitin `maxDuration`-rajan, alusta
tappoi sen kesken, eikä rivi päivittynyt - siitä syntyi ikuinen
`started`-tila.

**KORJAUS KOHDISTUU PULLONKAULAAN.** Hakusanat ovat toisistaan
riippumattomia, joten ne haetaan nyt kuusi kerrallaan rinnakkain.
Mitattu: **59,6 s → 15,1 s**, ja tulos on sama 876 kandidaattia.
Järjestys säilyy, koska tulokset kootaan hakusanan indeksin mukaan eikä
siinä järjestyksessä kuin pyynnöt palasivat.

Lisäksi jokaisella pyynnöllä on nyt 15 sekunnin katkaisu. Mitattu tarve:
hakusana "rakennusurakka" vastasi kerran 15,5 sekunnissa kun mediaani on
noin sekunti - yksi tällainen riittää kaatamaan ajon aikarajaan.

**Mikä jää auki.** Tuontivaihe (876 kandidaattia täsmäytyksineen) on
mittaamatta, joten ei ole varmaa mahtuuko koko ajo 90 sekuntiin. Se ei
kuitenkaan enää ole putken ongelma: D-060:n aikakatkaisu keskeyttää
liian pitkän ajon, kirjaa virheen ja päästää muut lähteet vuoroon.

---

### D-060 – Jumittunut lähde pysäytti koko keräysputken kahdeksi päiväksi
TIC:in ajohistoriasta löytyi umpikuja. Cron ajaa kuuden tunnin välein ja
käsittelee 14 lähdettä, mutta **11.8.2026 klo 12 alkaen jokainen ajo
käsitteli enää kaksi**: Hilman ja yhden jumittajan.

| ajo | lähteitä |
|---|---|
| 11.8. klo 00 | 14 |
| 11.8. klo 06 | 11 |
| 11.8. klo 12 – 13.8. klo 18 (kaikki 9 ajoa) | **2** |

Jumittajat olivat YVA (3 ajoa) ja sen jälkeen STT-tiedotteet (8 ajoa).
Ajo kuoli niihin eikä koskaan edennyt lopuille 12:lle lähteelle, joten
**70 lähdettä 300:sta jäi ajamatta viikoksi** - mukana Helsingin kaavat,
Väylävirasto ja Rakennuslehti.

**KOLME VIKAA KETJUSSA, JA JOKAINEN YKSIN RIITTI PITÄMÄÄN UMPIKUJAN.**

*1. Haulla ei ollut aikakatkaisua.* Vastaamaton palvelin jumitti ajon
ikuisesti. Rivi jäi tilaan `started`, `finished_at` tyhjänä - ja koska
kumpikaan try/catch-haara ei suoriutunut, virhettä ei kirjattu koskaan.
Lähteen tilannekuva näytti terveeltä: `error_count: 0`,
`last_success_at` viideltä päivältä sitten.

*2. `last_run_at` päivittyi vain ajon lopussa.* Putki valitsee lähteet
järjestyksessä vanhin ensin, joten jumittunut lähde pysyi ikuisesti
vanhimpana ja valittiin joka ajossa ensimmäisenä. Leima kirjoitetaan nyt
ajon ALUSSA, mikä katkaisee kierteen: jumittunutkin lähde siirtyy jonon
hännille.

*3. Kesken jäänyttä ajoa ei havainnut mikään.* `started`-tilaan
jääneitä oli 18 kpl heinäkuulta asti. Vahtikoira merkitsee yli tunnin
vanhat virheiksi ja kasvattaa lähteen virhelaskuria; se ajetaan putken
alussa ennen lähteiden valintaa.

**AIKAKATKAISU MITOITETAAN AJON BUDJETTIIN.** Ensimmäinen versio asetti
rajaksi viisi minuuttia, mikä ei olisi korjannut mitään: reitin
`maxDuration` on 500 s ja yksi ajo käsittelee 14 lähdettä, joten yksi
jumittaja olisi syönyt 60 % budjetista ja loput olisivat jääneet yhä
ajamatta. Raja on 90 s eli nelinkertainen mitattuun toteumaan (~20 s
per lähde).

Siivottiin 18 kesken jäänyttä ajoa. Sen jälkeen virhelaskuri kertoo
totuuden: STT 8 virhettä, Helsingin vireillä olevat kaavat 3.

---

### D-059 – LLM kohdetyypille: suljettu sanasto ja mitattu ensin
Kohdetyyppi on asiakkaan ensisijainen suodatin ja se oli kahdella tavalla
rikki. Mitattu 13.8.2026: **3 688 riviltä puuttui kokonaan**, ja
asetetuissa oli **198 eri arvoa** 1 907 rivillä - "Koulu" ja "koulu"
erikseen, "Tuulivoima" / "Tuulivoimalahankkeet" / "Aurinkopuisto"
erikseen, ja häntänä vapaata tekstiä kuten "Prisma" ja
"Asiantuntijapalvelut".

Sääntöpohjainen poimija ratkaisi otsikosta 193 riviä. Kuvauksesta se
ratkaisi 529 lisää, mutta niistä kaksi kolmasosaa oli väärin ("HAM
Helsingin taidemuseo" -> Logistiikka), koska kuvaus kertoo ympäristöstä
eikä kohteesta. Juuri tuo ero - mikä tekstissä on KOHDE - on se jonka
LLM osaa.

**KONTROLLIAJO ENNEN KIRJOITUSTA.** Aineistona rivit joiden tyyppi
tiedetään otsikosta; malli ei nähnyt tallennettua arvoa.

| | ensimmäinen ohje | säädetty |
|---|---|---|
| samaa mieltä | 85 | **94** |
| jätti tyhjäksi | 14 | 4 |
| eri mieltä | 1 | 2 |

Tarkkuus vastatuissa 98 %, ja molemmat erimielisyydet puolustettavia
("Koulun ja päiväkodin peruskorjaus" on aidosti molempia). Ensimmäinen
ohje jätti turhaan tyhjäksi ilmiselviä tapauksia, koska painotti
varovaisuutta liikaa; lisäys "otsikko yksin riittää kun se nimeää
kohteen" pudotti tyhjät 14:stä neljään.

**SANASTO ON SULJETTU JA TYHJÄ ON SENTINELI.** Malli saa palauttaa vain
20 kanonista arvoa tai `EI_TIEDOSSA`. Skeema `{ type: ["string","null"],
enum: [...] }` hylätään rajapinnassa, ja sentineli tekee tyhjästä
vastauksesta mallille nimenomaisen valinnan eikä jotain jonka se jättää
pois.

**SÄÄNTÖ AJETAAN ENSIN.** Otsikosta luettu tyyppi on mitattu tarkaksi
eikä maksa mitään, joten LLM:ää kysytään vain kun sääntö ei osaa.

Lopputulos: kohdetyyppi **1 907 → 3 174 riviä (35 % → 59 %)** ja eri
arvoja **198 → 20 kanonista**, jotka kattavat kaikki paitsi 23 riviä.
Kaksoiskirjoitusasut yhdistyivät: `Aurinkopuisto`, `Aurinkosähköpuisto`,
`Tuulivoimahanke` ja `Tuulipuisto` ovat nyt yksi `Energiantuotanto`.

---

### D-058 – Vahvistus ei ole purku, ja eri paikannimi on veto
Massahyväksynnän jälkeen ajettiin täysi duplikaattiskannaus. Se paljasti
kaksi eri vikaa.

**1. Vahvistetut duplikaatit jäivät listalle.** Katselmoinnissa pari
merkitään `confirmed_duplicate`-tilaan, mutta se on päätös - ei
toimenpide. Mitattu 13.8.2026: **41 vahvistetusta parista 21:llä
molemmat rivit olivat yhä asiakkaan listalla.** Nämä olivat siis jo
tunnistettuja duplikaatteja, jotka vain jäivät purkamatta.

Purussa tieto siirretään ennen piilotusta: jäävä rivi valitaan
täytettyjen kenttien ja kuvauksen pituuden perusteella, ja puuttuvat
kentät täydennetään piilotettavalta. Kuvaukset liitetään eikä korvata -
sama oppi kuin D-057:ssä. 19 riville 21:stä siirtyi tietoa.

**2. Energiahankkeet ristiinpariutuivat.** 68 uudesta ehdokkaasta
**51 oli samaa kuviota**: kaksi eri tuulipuistoa samassa kunnassa, joiden
otsikoista neljä sanaa viidestä on samoja.

    "Vitsakankaan tuulivoimaa koskeva osayleiskaava"
    "Pitkämaan tuulivoimaa koskeva osayleiskaava"

Tervolassa kuusi eri puistoa tuotti 15 paria. `haveDifferentEnergySites`
on nyt ehdoton veto samalla perusteella kuin urakkalaji: pisteytys ei
erota niitä, koska erottava tieto on yksi sana.

**Testi paljasti pahemman piilevän vian.** Sääntö ei aluksi lauennut
lainkaan, ja syy oli pysäytyssanastossa: siinä oli "tuulivoima" mutta ei
partitiivia "tuulivoimaa", joten yleissana laskettiin PAIKANNIMEKSI
molemmille. Vika oli vaarallisempi yhdistämissuuntaan: yhteinen
geneerinen sana riittää `haveSameEnergySite`-ehtoon, joten kaksi eri
tuulipuistoa saattoi **yhdistyä** sanalla jota ei tarkoitettu
paikannimeksi. Sanasto perustuu nyt vartaloihin.

Skannauksesta jäi katselmoitavaksi 9 paria, joista aidoiksi
duplikaateiksi tunnistui yksi (Herttoniemen liikuntapuiston
huoltorakennus kahdella otsikolla). Loput olivat vääriä pareja tai
lausuntorivejä, jotka eivät ole hankkeita lainkaan.

---

### D-057 – Luvattu valmistumisaika on tavoite, ei aikataulu
D-056 alkoi poimia käyttöönottopäiviä Helsingin tarveselvityksistä. Se
oli oikea poiminta mutta väärä johtopäätös, ja urakoitsijan oma sivu
todisti sen:

| lähde | mitä sanoo |
|---|---|
| kaupungin tarveselvitys 8/2021 | käyttöön **8/2023** mennessä |
| NCC:n hankesivu | rakentaminen **1/2024–5/2025**, käyttöön **8/2025** |

**Kaksi vuotta myöhässä.** Varhaisen vaiheen päätöksessä esitetty päivä
on tavoite: hanketta ei ole vielä kilpailutettu eikä urakoitsijaa
valittu.

Tämä ei ole kosmeettinen ero. `estimated_completion` ei ole lisätieto
vaan väite - kun päivä menee, auto-complete merkitsee hankkeen
valmistuneeksi ja se katoaa asiakkaan listalta. Tavoitteen
kirjoittaminen kenttään olisi piilottanut Kirsikkapuiston työmaan
juuri kun se oli alkamassa.

Tavoite tunnistetaan kahdesta merkistä: päätöksen tyyppi
(tarveselvitys, hankesuunnitelma, lausunto) tai **yli 18 kuukauden
etäisyys** päätöksestä luvattuun päivään. Mitattu jakauma jonossa:
mediaani 9 kuukautta, mutta 75 riviä 218:sta lupaa yli 18 kuukautta
eteenpäin.

**Mittaus paljasti myös mahdottomia päiviä.** Ero päätöksestä
valmistumiseen oli pienimmillään **-124 kuukautta** eli päivä oli
vuosia ENNEN omaa päätöstään. Ne ovat poimintavirheitä, eivät
aikatauluja.

Ajettu: **171 riviä siirtyi `metadata.planned_completion`-kenttään**
(tieto säilyy näytettäväksi mutta ei merkitse valmiiksi) ja **42
mahdotonta päivää poistettiin**. Näistä **99 oli jo mennyt** eli ne
olisivat merkinneet hankkeen valmistuneeksi seuraavassa cron-ajossa.

---

### D-056 – Käyttöönotto on valmistuminen, väistötilan käyttöönotto ei
Jonossa oli tarveselvityksiä päiväkodeista jotka ovat jo auki. Mitattu
tapaus: **"Abraham Wetterin tien päiväkodin uudisrakennuksen
tarveselvitys"** (päätös 8/2021), joka toimii tänään nimellä Päiväkoti
Kirsikkapuisto - ja jonka omassa tekstissä lukee:

> Uudisrakennus **otetaan käyttöön** kalustettuna **elokuuhun 2023**
> mennessä.

Päivä oli siis lähteessä koko ajan. Kaksi syytä miksi se jäi poimimatta.

**1. Vartija tunsi vain "valmis"-vartalon.** Helsingin tarveselvitys- ja
hankesuunnitelmapäätöksissä luovutus ilmaistaan vakiokaavalla, jossa
sanaa "valmis" ei esiinny lainkaan. Mitattu: **31 jonoriviä käytti
muotoa, ja niistä vain kaksi sai päivän.**

**2. Kuukausi oli väärässä sijamuodossa.** Kuvio odotti inessiiviä
("elokuuSSA 2023"), mutta käyttöönotto ilmaistaan illatiivilla
("elokuuHUN 2023 mennessä"). Pääte on nyt valinnainen.

**VÄISTÖTILAN KÄYTTÖÖNOTTO ON PÄINVASTAINEN SIGNAALI.** Väistötila
otetaan käyttöön kun varsinainen työ ALKAA. Este tarkistetaan kuitenkin
vain samasta lauseesta, koska kuvauksissa lukee usein "hankkeen
toteutuksen yhteydessä ei tarvita väistötiloja" - koko tekstin
tarkistaminen olisi estänyt poiminnan 25 rivillä 31:stä.

**Löytyi myös regressio.** Kuukausipäätteen tekeminen valinnaiseksi
päästi läpi rakennusvuoden: yksi rivi sai valmistumisajaksi
**1982-08-31**. Vuosi on nyt rajattu 2000-luvulle kaikissa kuvioissa,
kuten numeromuotoisessa jo oli. Tämä näkyi vain siksi että menneet
päivät luetellaan erikseen ennen kirjoitusta.

Ajettu molempiin tauluihin: **155 riviä sai valmistumisajan**, joista
111 tulevia ja 44 menneitä. Jonosta siirtyi 13 riviä valmistuneina.

---

### D-055 – Valmistumista ei voi lukea päätöslähteestä, mutta hanketyypistä voi
Kysymys oli: voiko lähteestä päätellä onko hanke päättynyt? Mitattu
vastaus on kolmiosainen.

**1. Valmistuminen ei ole päätös.** Koko Ahjon indeksistä (143 318
päätöstä): "loppuselvitys" esiintyy 8 otsikossa, "vastaanottotarkastus"
0:ssa. Kunta päättää hankkeiden ALOITTAMISESTA; valmistuminen ei kulje
poliittisen päätöksenteon läpi. Meidän 579 jonorivistä yhdessä on
vastaanottomaininta.

**2. Sana "valmistui" on ansa.** Se esiintyy 38 jonorivin tekstissä,
mutta katsotuista esimerkeistä valtaosa on kohteen ALKUPERÄINEN
rakennusvuosi:

> Hietakummun ala-aste **on valmistunut 1959**. Rakennuksessa on todettu…

Sääntö sen varassa merkitsisi peruskorjaushankkeen valmiiksi siksi että
rakennus on vanha. Sama ansa kuin "hankesuunnitelma valmistuu" (D-053)
ja YVA:n "Päättynyt" (D-048), mutta kavalampi - sana on identtinen, vain
subjekti eri.

**3. Hanketyyppi ratkaisee.** Purkupäätös tehdään, työ tehdään
kuukausissa, eikä siitä tule uutta päätöstä. Peruskorjaus saa aidosti
kestää vuosia. Siksi sääntö on tyyppikohtainen eikä yleinen ikäraja:
yleinen raja olisi sulkenut Finlandia-talon perusparannuksen, joka oli
vuosia kesken ja koko ajan elossa.

Toteutus: `selfCompletingWork.ts` tunnistaa purkuhankkeen otsikosta ja
merkitsee sen tehdyksi kun päätöksestä on yli **kaksi vuotta**. Raja on
väljä tarkoituksella - purkutyö kestää kuukausia, joten kaksi vuotta
antaa tilaa viivästyksille ja uudelleenkilpailutukselle.
Sopimuksen purkaminen suljetaan pois erikseen; ilman sitä hallinnollinen
sopimusriita merkittäisiin valmistuneeksi rakennustyöksi.

Ajettu: **27 jonoriviä ja 6 asiakkaille näkyvää hanketta**. Näkyvät
olivat kaikki vuodelta 2020 ja yhä vaiheessa "Suunnittelussa" - kuusi
vuotta vanhoja purkuja.

Lista on tarkoituksella lyhyt: vain purku on mitattu. Muita lyhyitä
tyyppejä lisätään vasta kun ne on mitattu erikseen.

**Mitä jää auki.** Finlandia-talon kokoluokan hankkeen valmistuminen ei
näy missään nykyisessä lähteessä - ei päätöksissä eikä tiedotteissa
(jonossa nolla valmistumisilmoitusta Helsingin päätösten ulkopuolelta).
Se tieto on uutisissa ja kaupunkien hankesivuilla, joita ei lueta.

---

### D-054 – Helsingin tuoreusraja ei ollut voimassa lainkaan
Jonossa oli hankkeita vuodelta 2021 - mm. Kannelmäen peruskoulun
purkaminen (HEL-2021-006032), jonka tekstissä lukee "Työ on suunniteltu
valmistuvaksi 5 kk/2021". Kaksi erillistä vikaa.

**1. Muoto "5 kk/2021" jäi poimimatta.** Numeropoimija odotti muotoa
`5/2021`, joten yksikkö väliin esti osuman. Mitattu: 22 jonoriviä käytti
muotoa, ja 18:lla vuosi oli jo mennyt - lähes kaikki Helsingin
purkupäätöksiä. Korjauksen jälkeen `ignore-stale-completed` siivosi
17 riviä jonosta ilman uutta politiikkaa.

**2. Tuoreusraja oli tehoton.** `meeting_date` on indeksissä date-kenttä,
ja Elasticsearch tulkitsee paljaan luvun **epoch-millisekunneiksi**.
Sekunteina annettu raja (1 739 401 512) tarkoitti sille 21.1.1970.
Mitattu samalla kyselyllä:

| suodatin | osumia | vanhin |
|---|---|---|
| ei suodatinta | 143 318 | 2015-01-23 |
| **sekunteina (entinen)** | **143 318** | **2015-01-23** |
| ISO-merkkijonona | 25 943 | 2025-02-13 |

Raja ei siis vuotanut vähän - sitä ei ollut. Lähde on tuonut jonoon
päätöksiä vuoteen 2015 asti, ja se on suora syy siihen että 2021-vuoden
asioita ilmestyi hyväksyttäväksi. Raja annetaan nyt ISO-merkkijonona,
joka ei riipu yksikkötulkinnasta.

**3. Päätöspäivä talteen.** `meeting_date` on ollut haettuna alusta asti
mutta sitä ei tallennettu, joten emme tienneet milloin päätös tehtiin -
vain milloin ME näimme sen. Vuosia vanha päätös näytti tuoreelta jos se
tuotiin kantaan tänään. Nyt `metadata.decision_date` kirjoitetaan
kaikista kolmesta päätösalustasta (Ahjo, Dynasty, CaseM); kahdessa
jälkimmäisessä kokouspäivä oli jo jäsennetty tuoreussuodatusta varten
mutta heitetty pois.

**4. Päivät haettiin takautuvasti.** Ahjon asiatunnus (HEL-2021-006032)
on haettavissa suoraan indeksistä sata tunnusta kyselyä kohti; Dynastyn
ja CaseM:n kokouspäivä luetaan asiasivulta. Tulos: **1 156 / 1 209 riviä
(96 %)**, ja jonon jokaisella 579 rivillä on nyt päätöspäivä.

**UUSIN PÄÄTÖS, EI VANHIN.** Ensimmäinen versio otti asiatunnuksen
vanhimman päätöksen sillä perusteella että se kertoo milloin asia tuli
vireille. Se on väärä valinta: jos 2021 avatussa asiassa on tehty päätös
2026, hanke on elossa eikä vanhentunut, ja vanhin päivä merkitsisi sen
viisi vuotta vanhaksi. Mitattu ero: 24 riviä siirtyi vuosilta 2017-2019
uudempiin. Uusin päätös vastaa siihen mitä vanhentumisesta halutaan
tietää - milloin asiassa viimeksi tapahtui jotain.

Asiatunnuksen vuosi (HEL-2021-...) jätettiin tarkoituksella käyttämättä
automaattisena sääntönä: iso hanke elää vuosia saman tunnuksen alla,
joten 304 jonorivin piilottaminen sen perusteella olisi vienyt mukanaan
eläviä hankkeita. Nyt kun päätöspäivä on tiedossa, sääntö voidaan
kirjoittaa oikealle signaalille: **jonossa on 211 riviä joiden viimeisin
päätös on yli kolme vuotta vanha**, asiakasnäkymässä 74.

---

### D-053 – Asiakirjan valmistuminen ei ole hankkeen valmistuminen
`inferCompletionDateFromText` vartioi päivää "valmis"-vartaloisella
sanalla. Se ei riitä, koska hankkeen elinkaaren alussa valmistuu
nimenomaan papereita: mitattu tapaus on Huutoniemen sairaala-alue
(45 M€), jonka tekstissä lukee **"kehitys- ja hankesuunnitelmat
valmistuvat elokuussa 2026"** kun työmaavaihe on 2027–2028. Kenttään
olisi kirjoitettu 2026-08-31, ja `auto-complete-projects` olisi
merkinnyt hankkeen valmiiksi ennen kuin rakentaminen alkaa.

Sääntö hylkää päivän, jos valmistuva subjekti on asiakirja:
suunnitelma, kaava, selvitys, selostus tai auditointi. Ikkuna on
leveämpi kuin "valmis"-vartijan (120 vs. 40 merkkiä), koska subjekti voi
olla kauempana, ja välimerkki sallitaan sivulauseen takia
("hankesuunnitelmat, jotka valmistuvat elokuussa 2026").

**"Suunnitelman mukaan" on poikkeus.** Se on adverbiaali, ei subjekti –
"suunnitelman mukaan rakennus valmistuu 12/2027" kertoo rakennuksen
valmistumisesta, ja sen hylkääminen olisi ollut yhtä väärin toiseen
suuntaan. Asiakirjasanan jälkeen ei siksi saa seurata "mukaan".

Mitattu: ehdokkaat **87 → 26**. Jäljelle jääneistä 24 on tulevia päiviä
ja **2 menneitä**. Ero on olennainen: tuleva päivä on lisätietoa
kortilla, mennyt päivä johtaa siihen että hanke merkitään valmiiksi ja
katoaa asiakkaan listalta. Molemmat menneet tarkistettiin käsin
(Onttolan rakennushanke ja Mehiläisen Kemin laajennus, kumpikin
tosiasiassa valmistunut 3/2026).

---

### D-052 – Täydennysbudjetti kului aina samoihin, ja kustannus ankkuroidaan lauseeseen
STT-rivi Huutoniemen sairaala-alueesta oli kannassa 194 merkin mittaisena,
vaikka tiedotteessa on kustannusarvio 45 M€, aikataulu 2025–2032 ja kolme
yritystä rooleineen.

**Budjetti kului aina samoihin.** Tiedotteen leipäteksti haetaan erikseen
(`enrich`), ja budjetti on 40 kandidaattia ajossa. Kandidaatit käsiteltiin
lähteen omassa järjestyksessä, joka on ajosta toiseen sama, joten budjetti
kului aina listan alkuun eikä häntä täydentynyt koskaan. Mitattu 12.8.2026:
**186 jonoriviä ja 66 hyväksyttyä** oli yhä pelkän hakurajapinnan
metadescriptionin varassa. Kandidaatit järjestetään nyt tallennetun
kuvauksen pituuden mukaan – lyhin ensin – jolloin jokainen ajo vie jonoa
eteenpäin. Olemassa olevat 254 riviä haettiin erikseen
(`backfill-stt-bodies.ts`), ja 47 sai samalla kunnan jota tiivistelmässä
ei ollut.

**Kustannus: läheisyys ei kelvannut ankkuriksi.** `estimated_cost` on
ollut sarakkeena ja näkyy asiakkaalle, mutta mikään ei kirjoittanut siihen
mitään. Ensimmäinen poimija hyväksyi summan jos lähellä oli
rakentamissana: **391 osumaa, joissa mitattuna mm. Puolustusvoimien koko
maan vuosi-investoinnit (356 M€), ajoneuvojen huoltoleasingin arvo ja
yrityksen tilauskanta.** Lisäksi Iin koulun tiedotteesta poimittiin
Jyväskylän toimistotalon urakkasumma, koska tiedote käsitteli kahta
hanketta.

Poimija ankkuroi nyt nimettyyn lauseeseen (kustannusarvio, urakan arvo,
investointikustannus, "X euron rakennushanke") ja lukee vain tekstin
alusta, jossa tiedotteen oma aihe kerrotaan. **49 osumaa, jokainen
tarkistettuna oikea.** Loput 620 summamainintaa jäävät poimimatta
tarkoituksella: väärä kustannus näkyy asiakkaalle numerona jota hän uskoo,
tyhjä kenttä ei valehtele.

**Valmistumisaikaa EI täydennetty.** Nykyinen poimija antaa Huutoniemen
riville 2026-08-31, koska tekstissä lukee "kehitys- ja hankesuunnitelmat
valmistuvat elokuussa 2026" – se on suunnitelman, ei rakennuksen
valmistuminen, ja työmaavaihe on 2027–2028. Kentän täyttäminen olisi
johtanut siihen että auto-complete merkitsee 45 M€:n hankkeen valmiiksi
ensi kuussa. Sama ansa kuin D-048:ssa ja kaavojen valmistumispäivissä.

---

### D-051 – Sama kuvausvika löytyi 19 kerääjästä lisää, kahdesta syystä
D-047 korjasi neljä kerääjää, mutta vika oli laajempi. Mitattu 12.8.2026:
**79 kaavalähteellä 205:stä kuvauksen mediaani oli alle 250 merkkiä**,
yhteensä 1437 dokumenttia.

**Sama vika, eri kirjoitusasu.** Haku `if (description) return` löysi
vain neljä kohtaa, koska sama asia oli kirjoitettu myös näin:

    const description = paragraphs.find((p) => p.length > 40) ?? null

`.find()` tekee täsmälleen saman kuin silmukka joka lopettaa
ensimmäiseen osumaan – ottaa yhden kappaleen ja hylkää loput. Näitä oli
**16 kappaletta**, plus kaksi `$("p").first()`-muotoa. Yhteensä 23
kerääjää käyttää nyt samaa budjettikeräintä.

**Uudelleenkeräys ei riittänyt.** Seinäjoki ja Kerava hakevat kuvauksen
erilliseltä alasivulta ja **ohittavat haun kokonaan** jos rivillä on jo
arvo (`raw_payload.phase`, `description_fetched`). Ensimmäisen ajon
jälkeen niiden mediaani oli yhä 174 ja 181 – vaikka uusi poiminta olisi
tuottanut samoilta sivuilta 338–872 merkkiä. Se ei näkynyt mitenkään
paitsi siinä että luku ei liikkunut, mikä olisi ollut helppo tulkita
"näillä sivuilla ei vain ole enempää tekstiä". Välimuistimerkintä on nyt
mitätöitävissä (`--refetch`), ja koska haku on rajattu kahdeksaan sivuun
ajoa kohti, keräys ajetaan silmukassa.

Lopputulos: **21 kerääjää 23:sta parani**, 475 dokumenttia. Mitatut
ennen/jälkeen: Pieksämäki 194 → 1421, Kirkkonummi 390 → 1262,
Valkeakoski 131 → 516, Kurikka 188 → 482, Paimio 164 → 416, Seinäjoki
174 → 344, Heinola 137 → 343, Kerava 181 → 276.

Kaksi ei liikkunut, ja kummallakin on syy joka EI ole tämä vika:
Lappeenrannan "Tavoite"-osio on aidosti yhden kappaleen mittainen, ja
Ilmajoen sivulla ei ole kuvailevia kappaleita lainkaan vaan pelkkä
aikajana. Niille ei siis ole mitään poimittavaa – eri ongelma, ei
korjattavissa kappalebudjetilla.

---

### D-050 – Tuulipuiston paikannimi tunnistaa saman hankkeen kahdesta menettelystä
Tuulivoimahanke kulkee rinnakkain kahtena virallisena menettelynä: kunnan
osayleiskaavana ja ELY:n YVA:na. Meille se tulee kahtena rivinä eri
nimellä ja eri lähteestä:

    YVA:   "Niinimäen tuulivoimahanke, Hattula, Hämeenlinna"
    kaava: "Hattulan Niinimäen tuulivoimaosayleiskaava"

**Mitattu ennen korjausta**, viisi varmennettua paria: kaksi ei tuottanut
täsmäytyksessä osumaa **lainkaan** (`null`) ja loput jäivät 38–50
pisteeseen, kun yhdistäminen vaatii 70. Yksikään ei olisi yhdistynyt
koskaan, eikä kahta olisi edes nähnyt ehdotuksena.

Tunnistus perustuu **paikannimeen**, ei hanketyyppiin: tuulipuiston nimi
on kunnan sisällä yksilöivä. Pelkkä "sama kunta + tuulivoima" ei riitä
alkuunkaan – Siikalatvalla on seitsemän eri tuulipuistoa.

Kolme asiaa on pudotettava, ja jokainen löytyi mittaamalla:

- **Kuntanimet.** Otsikot luettelevat vaikutusalueen kunnat, joten
  kuntanimi olisi yhteinen sana kahdella eri saman seudun hankkeella.
- **Sähkönsiirto.** Otsikko kertoo lähes aina myös liitynnän. Ilman tätä
  Pihtiputaan Uusimo osui Varisvuoreen (90) ja Leppäkankaaseen (83)
  pelkän sanan "sähkönsiirto" perusteella – ja väärä osuma oli vielä
  oikeaa (83) vahvempi.
- **Ilmansuunta ja laajennus.** Kauhajoella "Pallonevan pohjoinen" ja
  "Pallonevan eteläinen" ovat eri hankkeita eri yhtiöillä. Kumpikin
  erottaa vain symmetrisesti: jos toinen puoli ei mainitse suuntaa
  lainkaan, kyse on samasta hankkeesta (Ranualla kaava kattaa "itäisen ja
  läntisen", YVA ei sano kumpaakaan).

**Oma aiempi sääntöni oli osa ongelmaa.** `different_name_subjects`
(D-044, Tikka/Tikkakoski) leikkasi kaikki viisi paria tasan 65:een, koska
eroavat sanat ovat "tuulivoimahanke" vs "tuulivoimapuiston
osayleiskaava". Sääntö on kirjoitettu erottamaan eri KOHTEET, mutta tässä
eroavat sanat kertovat MENETTELYSTÄ. Kappi ohitetaan kun paikannimi on jo
todistanut kohteen samaksi.

**Painoarvoa ei nostettu niin että maantiede yksin riittäisi.** Koodissa
on jo maksettu oppi: 16 väärää yhdistymistä sai 73 pistettä pelkästä
maantieteestä ja ne jouduttiin purkamaan `unmerge-wrong-matches.ts`:llä.
Siksi paikannimi+kunta jää 65:een eli ehdotukseksi, ja 70 ylittyy vasta
kun otsikko, kuvaus tai rakennuttaja tukee.

Sääntö ajetaan tuonnin yhteydessä, joten jo kannassa olleet parit
purettiin erikseen (`merge-energy-site-duplicates.ts`): **29 yhdistettiin
ja 14 jäi jonoon ehdotukseksi.** Jonorivi merkittiin `ignored`-tilaan ja
linkitettiin hankkeeseen, mutta tieto siirrettiin ensin: jokainen 29
hankkeesta sai YVA-rivin rakennuttajan ja/tai sen pidemmän kuvauksen,
jossa on voimaloiden määrä, teho ja hankealueen pinta-ala. Kaavarivi
jäi näkyväksi, koska se kertoo hankkeen etenemisestä.

Kauhajoki todisti parhaan osuman valinnan tarpeen: Windfarm Palloneva
Oy:n rivi osui sekä pohjoiseen (95) että eteläiseen (100) puistoon, ja
valinta meni oikein eteläiseen eli saman yhtiön hankkeeseen.

Loput 14 luettiin läpi käsin (molempien tekstit kokonaan) ja jokainen
varmistui samaksi hankkeeksi, joten nekin yhdistettiin `--min=40`.
Matala pistemäärä ei johtunut epävarmuudesta vaan siitä että kaavarivin
tallennettu kuvaus oli useassa tapauksessa lähes tyhjä - Kannuksella
koko teksti oli "Osallistumis- ja arviointisuunnitelma". Se on sama
vika kuin D-047, mutta eri kuntien kerääjissä.

**KUVAUKSIA EI SAA KORVATA, VAIN LIITTÄÄ.** Ensimmäinen versio otti
pidemmän tekstin kahdesta, ja koska YVA-teksti on lähes aina pidempi,
kaavarivin oma teksti hävisi 25 hankkeelta. Ero ei ole muodollinen:
kaavateksti kertoo hankkeen ETENEMISEN (nähtävilläolot, valitukset,
keskeytykset), YVA-teksti vain suunnitelman. Ranualla juuri kaavateksti
sisälsi lauseen "Hanketoimija on ilmoittanut keskeyttävänsä ...
17.4.2026" - 105 voimalan ja 12 520 hehtaarin hankkeesta. Tekstit
palautettiin lähdedokumenteista
(`restore-merged-kaava-descriptions.ts`), ja Kupinavaaran vaiheeksi
merkittiin `Peruttu`.

---

### D-049 – Tilaajan osoite kelpaa kunnaksi vain kun tilaaja on paikallinen
Hilma-rivit jäivät ilman kuntaa, vaikka `buyer_address` sisälsi
postitoimipaikan. Houkutus on ilmeinen: lue kunta osoitteesta.

**Mittaus kielsi sen.** 12.8.2026, 298 kunnatonta riviä: kun sekä
ilmoituksen teksti että tilaajan osoite antoivat kunnan, ne olivat eri
mieltä **16 kertaa 24:stä**. Tilaajan osoite on valtakunnallisilla
toimijoilla pääkonttori, ei työmaa – Metsähallitus tilaa Helsingin
osoitteesta moottorikelkkaurat Lappiin, ELY Oulusta tilusjärjestelyt
Nivalaan, Museovirasto Helsingistä Olavinlinnan kattoremontin
Savonlinnaan.

Ketju oli siksi jo valmiiksi varovainen: osoitteen kaupunki kelpasi vain
jos ilmoituksen teksti vahvisti sen (`isCityCorroboratedByText`). Puuttui
yksi periaatteellinen poikkeus:

**Yhden kohteen kiinteistöyhtiön osoite ON kohde.** Kiinteistö- ja
asunto-osakeyhtiö perustetaan yhtä kiinteistöä varten, usein nimeä myöten
("Kiinteistö Oy Eliel Saarisen tie 41-45"). Sillä ei ole pääkonttoria
erillään kohteesta, joten vahvistusta ei tarvita. Mitattu tapaus: 13
Englantilaisen koulun urakkaa samalta tilaajalta, eikä kuvaus mainitse
Helsinkiä kertaakaan.

Valtakunnalliset suljetaan pois nimen perusteella ennen sääntöä, koska
esimerkiksi **Puolustuskiinteistöt** sisältää sanan "kiinteistö" mutta
rakennuttaa koko maahan.

Täydennetty: 150 jonoriviä ja 14 hyväksyttyä hanketta. **148 jätettiin
tyhjäksi tarkoituksella** – niillä olisi ollut osoite, mutta tilaaja on
valtakunnallinen eikä kunta olisi ollut hankkeen kunta.

---

### D-048 – YVA:n "Päättynyt" ei tarkoita valmista hanketta
YVA-lähteen jokainen rivi sai kovakoodatun vaiheen `"Suunnittelussa"`,
vaikka lähde kertoo tilan itse. Kenttä `projectPhase` oli haettu
ES-vastauksen `_source`-listassa alusta asti mutta jäänyt käyttämättä.

Mitattu 12.8.2026, 1324 hanketta: **"Päättynyt / perusteltu päätelmä
annettu" 1073, "Vireillä" 251.** Kenttä on rakenteinen ja kattava, joten
tilaa ei tarvitse jäsentää leipätekstistä.

**"Päättynyt" tarkoittaa että YVA-MENETTELY on päättynyt, ei hanke.**
Yhteysviranomainen on antanut perustellun päätelmänsä, joka on
edellytys lupahakemuksille (ympäristölupa, rakennuslupa). Hanke on
läpäissyt portin ja etenee luvitukseen – se on hankkeen elinkaaren
myönteinen käännekohta, ei sen loppu. Todiste samasta aineistosta:
Kirkkonummen datakeskuksen perusteltu päätelmä annettiin 9.7.2024 ja
hanke on nyt rakenteilla.

**Siksi tilaa ei käännetä vaiheeksi.** Jos "Päättynyt" mäpättäisiin
vaiheeksi "Valmistunut", yli tuhat elävää hanketta merkittäisiin
valmiiksi – ja `auto-complete-projects`-cron sekä
`ignore-stale-completed.ts` siivoaisivat ne pois jonosta ja
asiakasnäkymästä. Kumpikaan tila ei myöskään kerro onko rakentaminen
alkanut. Vaihe pysyy suunnitteluna; tila talletetaan omaan kenttäänsä
`metadata.yva_status` ja kirjoitetaan kuvauksen alkuun, koska
katselmoija ja asiakas lukevat kuvausta eivät metadataa.

Täydennetty: 288 jonoriviä ja 122 hyväksyttyä hanketta. Jonossa olevista
151 on jo läpäissyt YVA:n – ne ovat lähempänä rakentamista kuin muut,
mikä ei aiemmin näkynyt rivillä mitenkään.

---

### D-047 – Kuvaus kerätään useasta kappaleesta, budjetin verran
Kirkkonummelle rakentuva **Microsoftin datakeskus** – 50 hehtaaria, kolme
rakennusta – tuli tietoomme vasta YVA-lähteen kautta 11.8.2026, ja
kysymys kuului: miten noin iso hanke ei osu mihinkään aiempaan lähteeseen?

Etsiessä löytyi naapurikaava **"Energiakuja"**, jonka kuvaus katkesi
sanoihin "hanke on luonteeltaan elinkeinopoliittinen". Vasta seuraavassa
kappaleessa lukee:

> Alue on toistaiseksi rakentamaton, mutta **lähiympäristössä** on
> toteutumassa useita rakennushankkeita, **kuten** Microsoft 3465 Oy:n
> datakeskuskokonaisuus sekä Fortum Oyj:n lämpöpumppulaitos

**Energiakuja ei ole datakeskus vaan sen naapuri** – 8,2 ha ja 16 000 k-m²
olemassa olevaa rakennusoikeutta, kun datakeskusalue on 50 ha. Datakeskus
mainitaan siinä vain ympäristön kuvauksena. Vastaus alkuperäiseen
kysymykseen on siis se epämukavampi: **YVA oli aidosti ensimmäinen
lähteemme**, koska hanke on yksityinen (ei Hilmaa, ei kunnan
hankintapäätöksiä), yhtiö on nimeltään "Microsoft 3465 Finland Oy" eikä
alue tarvinnut uutta kaavaa. Yksityissektorin katvealue on todellinen.

Pidin näitä hetken samana hankkeena ja ehdin piilottaa Energiakujan
duplikaattina; virhe paljastui vasta kun luin molemmat tekstit kokonaan,
ja rivi palautettiin näkyviin. Sama ansa kuin Tikka/Tikkakoski: kaksi
lähekkäistä hanketta, joiden erottava tieto on vain tekstissä.

Itse vika oli silti aito, ja se on korjattu. Neljässä kerääjässä toistui
kuvio `if (description) return` –
poimitaan **ensimmäinen** riittävän pitkä `<p>` ja lopetetaan. Loppu sivusta
heitettiin pois *ennen* relevanssiluokitusta, poimintaa ja hakua, joten
mikään myöhempi vaihe ei olisi voinut löytää mainintaa.

**Kaikkia kappaleita ei kuitenkaan oteta.** Energiakujan sivulla on 29
kappaletta, joista 24 on päätöshistoriaa ja liitelinkkejä ("Kartta 3529",
lautakuntien pykäläviittaukset). Kuvaus kerätään **1500 merkin budjetin**
verran: se pitää mukana kuvailevan alkuosan ja katkeaa ennen koneistoa.
Ensimmäinen kappale otetaan aina, vaikka se yksin ylittäisi budjetin.

Mitattu: Kirkkonummen 40 kaavasivulla kuvauksen mediaani 390 → 1262
merkkiä. Jo hyväksytyt hankkeet täydennettiin erikseen (26 riviä), koska
`projects`-rivi on hyväksynnän hetken tilannekuva eikä putken
uudelleenajo koske siihen.

Hyöty ei ole se että datakeskus olisi löytynyt aiemmin – se ei olisi.
Hyöty on että **naapurin kaavan maininta on itsessään signaali**:
"lähiympäristössä on toteutumassa useita rakennushankkeita" kertoo että
alueella tapahtuu, ja se tieto oli aiemmin heitetty pois lukematta.

---

### D-046 – Yksisivusovellus vastaa 200:lla myös väärään osoitteeseen
Hilma-rivin "avaa lähde" ei tehnyt mitään: `source_url` puuttui **kaikilta
320 Hilma-ehdokkaalta**, koska resolveri ei rakentanut sitä lainkaan.

Korjatessa paljastui isompi vika. Kerääjä rakensi lähdeasiakirjoille
osoitteen muodossa

    /fi/public/procurement/{noticeId}/notice/overview/overview

joka vie sivulle **"Ilmoitusta ei löytynyt"**. Oikea muoto tarvitsee myös
menettelyn tunnisteen:

    /fi/public/procedure/{procedureId}/enotice/{noticeId}/

**Miksi virhe ei ollut näkynyt:** Hilma on yksisivusovellus. Väärä polku
vastaa `200 OK` ja täsmälleen samalla 9 656 tavun kuorella kuin oikea —
sisältö haetaan vasta selaimessa. HTTP-status ja vastauksen koko eivät siis
kerro mitään, ja automaattinen tarkistus näyttäisi vihreää.

Osoite selvisi vain **avaamalla sivu selaimessa**: Hilman oma hakutulos
(`/fi/search`) paljasti linkkien todellisen muodon. Kokeillut ja
toimimattomat: pelkkä noticeId, eForms-tunniste (`1f1451f8-…-01`) ja API:n
palauttama id `EF-54530`.

Sääntö: **kun lähde on yksisivusovellus, linkin toimivuutta ei voi
todentaa hakemalla — se on avattava.**

Osoitteen rakennus on yhdessä paikassa
(`lib/agent/hilmaNoticeUrl.ts`), ja se palauttaa `null` jos kumpi tahansa
tunniste puuttuu: etusivulle ohjaava linkki näyttäisi toimivalta mutta
veisi väärään paikkaan, mikä on huonompi kuin puuttuva linkki.

Täydennetty 318/320 riville; kahdelta puuttuvat tunnisteet lähteestä.

**Muut lähteet (tutkittu jälkikäteen).** Linkki puuttui myös 1 865
riviltä muista lähteistä, mutta syy oli eri: osoite oli tallessa
`source_documents.document_url`-kentässä eikä vain kulkenut ehdokkaalle.
Puute oli **historiallinen** — kaikki puuttuvat rivit ovat heinäkuulta, ja
elokuun 1 243 rivillä linkki on jokaisella. Putki tuottaa siis linkit jo
oikein, joten kerääjiin ei tarvittu muutosta.

**Sokea kopiointi olisi silti ollut väärin.** Sama oletus — että
tallennettu osoite toimii — piilotti Hilman vian. Otos jokaisesta
lähteestä ajettiin läpi, ja neljä hylättiin:

| lähde | rivejä | vika |
|---|---|---|
| Tampere | 129 | osa 404 |
| Kuopio | 56 | vain 700 tavun SPA-kuori |
| Kerava | 35 | 500 |
| Pori | 25 | osa 404 |

Lisäksi ohitettiin 93 API-päätepistettä (valtaosa Helsingin WFS): ne
palauttavat XML:ää eivätkä ole ihmiselle avattavia sivuja, mutta menivät
status- ja kokotarkistuksesta läpi.

Täydennetty 1 522 riviä.

**Jokainen linkki tarkistettiin (vaatimus: yksikään ei saa olla rikki).**
Kaikki 5 886 eri osoitetta molemmista tauluista käytiin läpi. Kolme asiaa
opittiin:

- **Otos ei riitä perusteeksi hylätä lähdettä.** Neljä lähdettä oli
  hylätty kolmen osoitteen otoksella. Yksitellen tarkistettuna 169
  osoitetta toimi — **126 niistä Tampereelta**, jonka olin hylännyt
  kokonaan.
- **Yksi tarkistus ei riitä toteamaan linkkiä kuolleeksi.** 162:sta
  ensimmäisellä kierroksella kaatuneesta **66 toipui** toisella
  yrityksellä: rinnakkainen ajo törmää nopeusrajoituksiin ja hetkellisiin
  katkoksiin. Vain kahdesti kaatuneet tyhjennettiin.
- **Kuollut linkki poistetaan, ei jätetä näkyviin.** Osoite säilyy
  `dead_source_url`-kentässä jäljitettävyyttä varten; lähde voi palata.

Lopputulos: ehdokkaista **96 % linkillä ja katselmointijonossa 100 %**
(761/761). Ilman linkkiä jää 252 ehdokasta ja 789 hanketta — niillä ei ole
toimivaa osoitetta lähteessäkään, joten linkki puuttuu eikä ole rikki.

### D-045 – Nimien erottava sana ratkaisee, ei yhteinen osa
Kaksi jyväskyläläistä päiväkotia yhdistyi yhdeksi hankkeeksi:

> "Tikan päiväkodin purku-urakka" — JyväskyläDno-2025-**1438**, 15.5.2025
> "Tikkakosken päiväkodin purku-urakka" — JyväskyläDno-2025-**1439**, 3.6.2025

Täsmäytys antoi näille **varmuuden 100** (`similar_title`), eli yhdistäminen
oli järjestelmän suositus eikä käyttäjän lipsahdus.

Syy: nimivertailu painottaa YHTEISTÄ osaa, ja kunnan aineistossa yhteinen
osa on geneerinen — "…päiväkodin purku-urakka", "Asunto Oy Espoon …",
"… 2026, Nokia". Erottava sana on juuri se joka kertoo kohteen, mutta se
hukkuu yhteisen massaan.

**Mitattu koko hankejoukolla (4 472 hanketta):**

| | pareja |
|---|---|
| varmuus ≥ 70 eli yhdistyisi | 267 |
| niistä nimien erottavat osat eivät liity toisiinsa | **194** |
| yhdistämiskynnyksen ylittäviä säännön jälkeen | **71** |

Esimerkkejä jotka olisivat yhdistyneet automaattisesti: "Asunto oy
puustellinpuisto" ja "Asunto oy Arlanhuippu" (100), "Miharintien AKK
uusiminen 2026, Nokia" ja "Österbackantien rakentaminen 2026, Nokia" (82).

**Rajoittava, ei estävä** — sama malli kuin
[`nameNumbers.ts`](../lib/projects/nameNumbers.ts): varmuus painetaan
kynnyksen alle (65), jolloin pari jää ihmisen katsottavaksi ehdotuksena.
Absoluuttinen veto hukkaisi aitoja osumia: "Kerrostalo Ruissalontielle
Turkuun" ja "Uusi kerrostalo rakentuu Ruissalontielle" ovat sama hanke eri
otsikolla, ja ne jäävät nyt ehdotukseksi.

Kaksi ehtoa pitävät säännön turvallisena:

- **Erottava sana vaaditaan molemmilta.** Yksipuolinen lisäys on tarkennus,
  ei ero — muuten jokainen "…, urakoitsijan valinta" olisi irronnut omaksi
  hankkeekseen.
- **Yhteinen vartalo kumoaa.** Muuten suomen taivutus laukaisisi säännön
  jatkuvasti: "purkaminen" ja "purkamisen" ovat sama sana eri sijassa.

Tunniste (lupanumero, kiinteistötunnus) voittaa säännön, kuten numeroerossa.

**Sääntö tarvitsee OMAN tokenisointinsa.** Ensimmäinen versio käytti
matcherin `titleWords`-funktiota, joka pudottaa alle neljän merkin sanat
kohinana. Nimivertailussa se on oikein, mutta erottavana sanana lyhyt sana
on juuri se tieto joka kertoo kohteen — asunto-osakeyhtiöiden nimet ovat
usein lyhyitä:

> "Asunto Oy Helsingin **Pyy**" vs "Asunto Oy Helsingin **Evia**" → 75

"Pyy" katosi, jolloin erottavia sanoja jäi vain toiselle puolelle eikä
sääntö lauennut. Raja on tässä säännössä **kolme merkkiä**, ja
nimivertailun oma viritys jää koskematta. Yhtiömuodot ja sidesanat
pudotetaan erikseen, koska ne mahtuvat nyt rajan yli. Puhtaat luvut
jätetään pois, koska niillä on jo oma sääntönsä — muuten sama ero
kapittaisi parin kahdesti ja hämärtäisi syyn.

Vaikutus: yhdistämiskynnyksen ylittäviä pareja 71 → **65**.

**Tunnettu aukko:** vartaloetuliite päästää läpi osan pareista ("Kaskia"
vs "Kaskenmäen" — vartalo "kask" on "kaskenm":n alku). Karkea vartalointi
on tietoinen kompromissi: oikea morfologia estäisi tämän, mutta hinta olisi
sanastoriippuvuus.

### D-044 – Otsikko on kahdessa paikassa, ja vain toinen näkyy listassa
Otsikon siivous ([D-042](#d-042--otsikko-nimeää-päätöksen-hanke-tarvitsee-oman-nimen))
näkyi hankesivulla mutta EI TIC:n listassa. Syy: tuonti kirjoittaa saman
arvon kahteen paikkaan (`title`-sarake ja `metadata.operation`), ja lista
renderöi `metadata.operation ?? title`.

**Operationia ei silti saa ylikirjoittaa sokeasti.** Mitattu ennen
korjausta:

| lähde | `title` | `metadata.operation` |
|---|---|---|
| Lupapiste (304 riviä) | "Rakennuslupa: Vanha-Stens 5" | "Urheilukentän rakentaminen tontille" |

Lupapisteellä operation on **parempi** kuin otsikko — siksi UI suosii sitä.
Päätösriveilläkin 62 eroaa aidosti: sama ehdokas on täsmätty useasta
lähteestä, ja operation kantaa toisen lähteen otsikkoa.

Sääntö: **päivitä operation vain kun se on vanhentunut kopio otsikosta.**
Testinä se, että siivottuna se antaa täsmälleen nykyisen otsikon.

**Tarkennus:** parempi sääntö on siivota operation PAIKALLAAN omana
tekstinään (`operation = genericizeDecisionTitle(operation)`) eikä korvata
sitä otsikolla. Korvaus osui vain vanhentuneisiin kopioihin, ja 11 rivillä
operation kantaa toisen lähteen otsikkoa — sama ehdokas on täsmätty
useasta päätöksestä. Ne jäivät siivoamatta ja näkyivät listassa yhä
muodossa "…hyväksyminen". Paikallaan siivottuna molemmat hoituvat: vanha
kopio päätyy samaan kuin otsikko, ja toisen lähteen otsikko siistiytyy
sisältöään menettämättä. Lupapisteen operation ei sisällä päätöslajia,
joten sen 304 riviä pysyvät koskemattomina.

Ensimmäinen ehto `operation === row.title` ei osunut kertaakaan, koska
`row.title` oli jo siivottu edellisessä ajossa. Ajo raportoi 0 muutosta ja
näytti onnistuneelta — virhe löytyi vain koska tulos mitattiin ajon
jälkeen, samoin kuin [D-041](#d-041--alustan-tunnus-on-päätepiste-ei-verkkotunnus-luokkanimi-ei-ole-rakenne).

### D-043 – Salassapitomerkintä koskee liitettä, ei asiaa
Kahden Kouvolan päätöksen otsikossa on "(salassa pidettävä, julkisuuslaki
6.1 § 2)". Merkintä ei tarkoita että asia olisi salainen:

- **Asiasivu on kunnan itse julkaisema ja julkinen.** Se on avoimessa
  verkossa ilman tunnistautumista, ja sen teksti sisältää hankkeen
  laajuuden, kustannusarvion ja aikataulun.
- **Merkintä koskee LIITETTÄ.** JulkL 6 § 1 mom 2 kohdan mukaan
  tarjouspyyntöasiakirjat tulevat julkisiksi vasta kun hankinta on tehty.
  Salassa on siis tarjouspyyntö, ei päätös siitä että kilpailutus
  aloitetaan.
- **Liitteitä ei haeta.** Tarkistettu: yksikään neljästä päätösjäsentäjästä
  ei lataa PDF-liitteitä, vain asiasivun HTML:n.

Näitä ei siis jätetä keräämättä. Ne ovat päinvastoin aineiston
**aikaisimpia** signaaleja: päätös kilpailutuksen aloittamisesta tulee
ennen hankintailmoitusta.

Merkintä poistetaan otsikosta, koska se kertoo liitteestä eikä hankkeesta
([D-042](#d-042--otsikko-nimeää-päätöksen-hanke-tarvitsee-oman-nimen)).

Jos kunta joskus pyytää poistamaan jonkin asian, se hoidetaan
lähdekohtaisesti — sama menettely kuin robots.txt-kiellon kanssa
([D-031](#d-031--robotstxt-ratkaisee-ei-alustan-tekninen-soveltuvuus)).

### D-042 – Otsikko nimeää päätöksen, hanke tarvitsee oman nimen
Kunnan otsikko kuvaa kokouksen asiaa, ei rakennuskohdetta:

> "Puhjon risteyssilta (W) korjausurakka 2026 (KU), korjausurakan
> kilpailuttaminen, kilpailutusperiaatteet (salassa pidettävä,
> julkisuuslaki 6.1 § 2)"

Sama silta on jonossa toisenkin kerran nimellä "Puhjon risteyssilta (W)
korjausurakka, 2026 (KU) – urakan hankinta". Ne ovat sama hanke kahdessa
päätösvaiheessa, mutta otsikot eivät täsmää, joten ne näkyvät kahtena.

**Sokea poisto olisi väärin.** Mitattu aineistosta ennen sääntöjen
kirjoittamista:

| yleisin pilkulla erotettu häntä | kpl |
|---|---|
| hankesuunnitelman hyväksyminen | 29 |
| **Malmi** | 19 |
| **Vartiokylä / Kaarela** | 15 + 15 |
| **Jätkäsaari** | 14 |

Yleisin häntä on siis KAUPUNGINOSA, ei päätöslaji — ja se on
sijaintitietoa. Sulkeissa on samoin osoitteita ja kaupunginosia. Poisto
perustuu siksi **sanastoon** (päätöslajien luetteloon), ei välimerkkeihin.

Kaksi mittauksessa löytynyttä ansaa:

- **Väliviiva vaatii välilyönnin edellä.** Ilman sitä kuvio osui yhdyssanan
  sisään: "purku-urakoitsijan valinta" → "purku".
- **Vuosilukua ei poisteta.** Kokeiltuna se sulautti neljä eri vuoden
  päällystysurakkaa yhdeksi ("Katujen uudelleenpäällystykset 2021/2023/
  2025") ja katkaisi ilmauksen "vuodelle 2026". Hyöty oli yksi
  duplikaattipari, haitta neljä väärää — jätetty valinnaiseksi ja pois
  päältä.

Tulos: 21 otsikkoa siistiytyi, 0 jäi liian lyhyeksi, ja **kaksi uutta
oikeaa duplikaattiparia** löytyi (Puhjo ja Asfalttiurakka — molemmat sama
hanke kilpailutus- ja hankintapäätöksenä).

**Hyväksymishäntä ja sijamuoto (lisätty myöhemmin).** Yleisin hallinnollinen
häntä koko aineistossa on `<asiakirja>n hyväksyminen`: 177 otsikkoa päättyy
sanaan "hyväksyminen", ja niistä 172 on tätä muotoa (hankesuunnitelman 109,
puistosuunnitelman 27, katusuunnitelman 10, tarveselvityksen 9).

> "Tuohimäen päiväkodin elinkaarta jatkavan korjauksen **hankesuunnitelman
> hyväksyminen**" → "…korjauksen **hankesuunnitelma**"

**Pelkkä hännän poisto ei riitä** — se jättäisi genetiivin roikkumaan
("…korjauksen hankesuunnitelman"). Poisto ja sijamuodon muunnos tehdään
siksi yhdessä, tai ei ollenkaan: tunnistamattomasta genetiivistä
("muutoksen hyväksyminen") otsikko jätetään koskematta, koska väärä
nominatiivi olisi huonompi kuin pitkä otsikko. Viisi riviä jäi näin
ennalleen.

Rinnasteinen asiakirja muunnetaan myös, muuten sijamuoto vaihtelisi saman
rinnastuksen sisällä: "Mikkelänpellon puistosuunnitelma**n** ja … sillan
siltasuunnitelma". Muunnos rajautuu samoihin asiakirjatyyppeihin, joten
kohteen nimen genetiivi säilyy ("Koulun ja päiväkodin hankesuunnitelma").

Korjattu 167 ehdokasta ja 10 jo hyväksyttyä hanketta
(`scripts/backfill-projects-titles.ts`).

Vaihe luetaan ALKUPERÄISESTÄ otsikosta, koska siivous poistaa juuri sen
sanan josta kilpailutus tunnistetaan. Siivotusta luettuna korjaus jäi
tekemättä: mitattu 0 muutosta, kun niitä piti olla 2.

### D-041 – Alustan tunnus on päätepiste, ei verkkotunnus; luokkanimi ei ole rakenne
Dynastyn sivukalusteet piti rajata pois kuvauksesta. Kaksi rajausta meni
ensin väärin, ja molemmat epäonnistuivat **hiljaisesti** — ajo raportoi
onnistuneensa, mutta osa riveistä jäi siivoamatta:

**1. Isäntä ei kerro alustaa.** Täydennys rajattiin `oncloudos.com`-
osoitteisiin, koska Dynasty on siellä. Kunnilla on kuitenkin omat
verkkotunnuksensa (`ep10.kouvola.fi`,
`dynastyjulkaisu.pohjoiskarjala.net`), joten 34 riviä kahdesta kunnasta
ohitettiin. Alustan tunnus on sen **CGI-päätepiste** `DREQUEST.PHP`, joka
on sama kaikilla kahdeksalla isännällä.

**2. Luokkanimi ei ole rakenne.** Navigaatiotaulu poistettiin kuviolla
`<table class='…navigation…'>`. Dynastyn versiot merkitsevät sen eri
tavoin — luokka on siirtynyt taulusta sitä ympäröivään diviin:

```
10.4.0.260401:  <table class='tbl navigation'>
10.4.0.250317:  <div class='data-part page-navigation'><table class='data-part-table'>
```

Luokkaan sidottu kuvio siivosi vain vanhemman version: 76 rivistä 57 jäi
roskaiseksi. Molemmissa taulussa on kuitenkin **otsake "Navigointi"**,
joten poistetaan se taulu jonka sisällä sana on.

Sääntö: **valitse ankkuriksi se mikä ei vaihdu version mukana.**
Päätepiste ja näkyvä otsake pysyivät, verkkotunnus ja luokkanimi eivät.

**Liiteluettelo ja kirjainkoko (lisätty myöhemmin).** Sama sääntö laajeni
kahdesti:

- **Liiteluettelo on oma taulunsa ja tulee ennen leipätekstiä**, joten
  kuvaus alkoi tiedostonimillä ("Hankesuunnitelman liite 11:
  Pohjatutkimusraportti_Tela02042026_kh13042026_kv11052026 …"). Poisto
  ankkuroitiin `<caption>`-otsakkeeseen (`Navigointi`, `Liitteet`,
  `Oheismateriaali`) — tarkistettu yhdeksällä isännällä, otsake on sama
  kaikilla vaikka luokkanimi vaihtelee.
- **Osiotunniste on kirjainkokoherkkä.** Kirjainkoosta riippumaton haku
  osui liitetiedoston nimeen: "selostus_Tela02042026" ja "Huoneselostus".
  Se katkaisi kuvauksen väärästä kohdasta ja **hävitti alkuosan** — yksi
  mitattu kuvaus oli kutistunut 41 merkkiin ("päätös: Merkittiin
  tiedoksi."). Tunniste vaaditaan nyt isolla ja sanan alusta.

Jälkimmäinen oli hiljainen tietohäviö, ei kosmetiikkaa: korjauksen jälkeen
useimmat kuvaukset PITENIVÄT, koska niiden alku oli aiemmin leikattu pois.
Mitattu lopputulos: liitetiedostonimiä 31 → 0, navigaatiota 0, kuvauksen
mediaanipituus 2 729 merkkiä.

Molemmat löytyivät vasta kun tulos mitattiin ajon jälkeen
([D-039](#d-039--kuvion-muodot-luetaan-aineistosta-ei-muistista)):
"teksti korjattu: 76" näytti onnistumiselta.

### D-040 – Lähteen kirjoitusvirhe tuodaan sellaisenaan
Jyväskylän hankintapäätös lukee sanatarkasti "hankitaan edullisimman
tarjouksen jättäneeltä **Mansiirto** Harry Mäkelä Oy:ltä". Sama yritys
esiintyy muissa päätöksissä oikein kirjoitettuna ("Maansiirto"), joten
virhe on ilmeinen ja korjaus olisi helppo tehdä.

Sitä ei tehdä. Poiminnan tehtävä on kertoa mitä päätöksessä lukee, ei mitä
siinä oletettavasti pitäisi lukea. Nimen "korjaaminen" olisi tiedon
keksimistä, ja se rikkoisi jäljitettävyyden: käyttäjä joka avaa
lähdelinkin näkisi eri nimen kuin sovelluksessa. Sama koskee päivämääriä
ja summia.

Jos virheellinen kirjoitusasu haittaa täsmäytystä, ratkaisu on
täsmäytyksen sumeus (`lib/projects/identity`), ei lähdetiedon muokkaus.

Vahvistettu 9.8.2026: "ihan oikein tuo kirjoitusvirhe pitää tuoda
sellaisena kun se on."

### D-039 – Kuvion muodot luetaan aineistosta, ei muistista
Ablatiivin ostoverbi tunsi vain aktiivin `hankkii`. Kun kaikki
ablatiiviesiintymät haettiin ja niitä edeltävät verbit laskettiin, kuva oli
toinen:

| verbi | rivejä |
|---|---|
| hankkii | 14 |
| **hankitaan** (passiivi) | **9** |
| tilata / tilaa / tilataan | 3 |

Passiivi oli lähes yhtä yleinen kuin aktiivi, eikä se ollut kuviossa —
kuvio vaati kaksois-k:n. Sama toistui koko session ajan: voittajan
päätöslauseita löytyi kuusi eri muotoa, joista neljä ensimmäistä löytyi
vasta kun aineisto luettiin läpi muoto kerrallaan.

Sääntö: **kun kirjoitat suomen kielen kuviota, laske muodot aineistosta
ennen kuin kirjoitat kuvion.** Yksi hakuajo maksaa minuutin ja kertoo mitä
muotoja oikeasti esiintyy; muistista listattu kuvio kattaa sen mitä sattuu
tulemaan mieleen.

Liittyy [D-035](#d-035--ingressi-kertoo-hankkeen-loppuosa-kertoo-ympäristön):
katso otos ennen kuin kirjoitat.

### D-038 – Vaihe luetaan päätöstekstistä, otsikko jää varalle
Vaihe pääteltiin pelkästä otsikosta: `/urak/` → "Sopimus myönnetty", muuten
"Suunnittelussa". Sama rivi oli kopioituna kolmeen jäsentäjään. Otsikko ei
kerro mitä päätöksessä tehtiin:

> "Keskusurheilukentän tekonurmen peruskorjaus" → **Suunnittelussa**

vaikka päätös on 5.12.2025, urakoitsija valittu ja teksti sanoo "Hankinnan
sopimuskausi on 15.4.–24.5.2026" — hanke on tänään tehty. Mitattu: 1017
päätösrivistä 966 oli suunnitteluvaiheessa.

Kaksi vahvempaa signaalia, tässä järjestyksessä:

1. **Sopimuskausi** kertoo missä hanke on juuri nyt — päättynyt kausi
   tarkoittaa valmista, käynnissä oleva rakenteilla olevaa.
2. **Voittaja** kertoo että sopimus on myönnetty, vaikka aikaa ei mainita.

Kumpikaan ei ole otsikossa, joten otsikkopäättely jää viimeiseksi varalle —
Helsingillä se on rikkaampi kuin muilla (hankesuunnitelma, tarveselvitys,
rakentamispäätös), eikä sitä haluta menettää.

**Vanhentuneet rivit pois jonosta.** Numeromuotoisen valmistumisajan
löytyminen paljasti 43 riviä joiden valmistumisaika oli yli vuosi sitten -
vanhimmat vuodelta 2019. Ne siirrettiin `ignored`-tilaan ja merkittiin
valmistuneiksi (`scripts/ignore-stale-completed.ts`).

**Vuoden raja on tarkoituksellinen.** Suunniteltu valmistuminen ei ole
todiste toteutuneesta: kolme kuukautta myöhässä oleva hanke on
todennäköisesti yhä kesken, yli vuoden vanha ei. Rajan alle jäi 9 riviä,
jotka jätettiin näkyviin.

**Epäuskottava päivä ei kelpaa perusteeksi.** Yhdellä rivillä oli arvo
`1914-12-31`, vaikka teksti sanoo "alkaa 6/2022 ja valmistua 9/2022".
Arvo oli kentässä jo ennestään, eikä se tullut tästä kuviosta - mutta
ilman uskottavuusrajaa rivi olisi ohitettu väärästä syystä. Skripti
ohittaa nyt vuosisadan ulkopuoliset arvot ja raportoi ne. Koko
aineistossa niitä oli tasan yksi, ja se korjattiin käsin.

**Hyväksytyt hankkeet tarkistettiin erikseen.** `projects`-taulussa oli
vain yksi vanhentunut valmistumisaika, eli `auto-complete-projects`-cron
toimii. Tekstistä luettavissa oli 17 lisää, mutta ne ovat pääosin
kaavoitusta, jossa "valmistuu 2024" tarkoittaa KAAVAN valmistumista eikä
rakennusta - sama ansa kuin "hankesuunnitelma valmistui". Niihin ei
koskettu.

**Numeromuotoinen valmistumisaika (lisätty myöhemmin).** Kuntien
hankesuunnitelmissa aikataulu kirjoitetaan lähes aina numeroina, ei
kuukauden nimellä:

> "Rakentaminen alkaa 06 /19, ja työ **valmistuu 12 /2019**."

Valmistumisajan tunnistus osasi kuukausien nimet ja vuodenajat mutta ei
tätä, joten **43 jonossa olevaa riviä oli vuosia sitten valmistuneita
hankkeita** merkinnällä "Suunnittelussa" — vanhimmat vuodelta 2020.

Sama "valmis"-vartija kuin muillakin muodoilla: ilman sitä kuvio poimisi
aloituspäivän, joka on tyypillisesti samassa virkkeessä, ja hanke
näyttäisi valmistuneen ennen kuin se alkoi. Nelinumeroinen vuosi
vaaditaan, koska kaksinumeroinen ("06 /19") jäisi vuodeksi 19.

Kenttä ruokkii olemassa olevaa `auto-complete-projects`-cronia, joten
vaihepäättelyyn ei tarvittu uutta sääntöä. Täydennettynä valmistumisaika
on 171 päätösrivillä, joista 121 on jo mennyt.

**Valmistuminen voittaa voittajan (lisätty myöhemmin).** Valmistunut
hanke jossa on nimetty urakoitsija näytti aina "Sopimus myönnetty", koska
voittajasääntö ajoi ennen kaikkea muuta paitsi sopimuskautta. Mitattu
rivi: "Veikkolan yleisurheilukentän perusparannushankkeen valmistuminen",
jossa teksti sanoo "Urakka valmistui 29.10.2025 ja kohde siirrettiin
kunnan hoitoon".

**KAKSI RIIPPUMATONTA SIGNAALIA VAADITAAN:**

| signaali | mitä ilman sitä tapahtuu |
|---|---|
| A: päätös koskee valmistumista | B yksin osuu kilpailutusehtoihin, joissa vastaanottotarkastus vasta luvataan |
| B: luovutus on tapahtunut | A yksin osuu hankesuunnitelmapäätöksiin |

**Suurin ansa oli sanan "valmistui" subjekti.** Aineiston yleisin muoto on
"**hankesuunnitelma** valmistui" — asiakirja valmistui, ei rakennus.
Kymmenestä "valmistui"-rivistä **kuusi oli suunnitteluvaiheen päätöksiä**,
joten pelkkään sanaan perustuva sääntö olisi merkinnyt ne valmiiksi.
Yhdistelmä osuu mitattuna yhteen riviin ja nollaan väärään.

**Kilpailutus voi olla vain tekstissä (lisätty myöhemmin).**
"Päällystysurakka 2026 + optiot – sisäinen hankintapäätös" ei kerro
otsikossa mitään kilpailutuksesta, mutta teksti sanoo "Päällystysurakassa
KILPAILUTETAAN ... työt". Otsikon sana "urakka" antoi silti vaiheeksi
"Sopimus myönnetty", vaikka mitään ei ole myönnetty.

**Kolme vartijaa**, koska pelkkä sana "kilpailutetaan" osuu aineistossa
neljään riviin joista vain yksi on kilpailutuspäätös — muut ovat
vuokrauspäätös, lausunto ja toteutusmuotopäätös:

| vartija | pudottaa |
|---|---|
| voittajaa ei ole | jo ratkenneet |
| ei mennyttä muotoa ("on kilpailutettu") | jo kilpailutetut |
| otsikossa "urak" | vuokraus, lausunto, toteutusmuoto |

Mitattu: 2 riviä korjaantui, 0 väärää. Vaihe "Kilpailutus" on nyt
4 rivillä.

**Kuukausiväli (lisätty myöhemmin).** Sopimuskausi kirjoitetaan myös
pelkkinä kuukausina: "Sopimuskausi on 04-12.2025". Päivämääräkuvio ei osu
siihen, joten kausi jäi lukematta ja hanke näytti myönnetyltä sopimukselta
vielä puoli vuotta päättymisen jälkeen. Kausi päättyy loppukuukauden
viimeisenä päivänä, ja vuodenvaihteen ylittävä väli ("11-03.2026") alkaa
edellisenä vuonna — ilman sitä alku olisi loppua myöhempi. Kuvio ajetaan
päivämääräkuvion JÄLKEEN, jottei "1.5.2026 – 30.9.2026" osu siihen.

**Tietoisesti pois: "toteutusaikataulu" ja "urakka-aika".**
Toteutusaikataulu on lähes aina ALUSTAVA ja kuvaa suunnitteluvaiheita
("hankesuunnitelman hyväksyminen 6/2026, toteutussuunnittelu 8/2026–2/2027"),
eli hanke on juuri siinä vaiheessa miksi se on merkittykin. Urakka-aika
mainitaan tyypillisesti ilman päivämäärää ("urakka-aika alkaa kun sopimus on
allekirjoitettu"). Kummastakin luettu vaihe olisi arvaus.

**Täydennyksen varalla on nykyinen arvo, ei otsikkopäättely.** Otsikosta
uudelleen laskettuna 28 riviä olisi heilahtanut "Suunnittelu" ↔
"Suunnittelussa" ilman että mikään niissä korjaantui. Kohina ei ole korjaus,
joten ilman vahvaa signaalia rivi jää ennalleen. Muutoksia tuli 13.

**Sopimuskausi kytkettiin myös tuontiin.** `inferCompletionDateFromText`
esti jo vanhentuneiden hankkeiden pääsyn TIC-jonoon, mutta se tunsi vain
tiedotteiden sanamuodot ("valmistuu syyskuussa 2025") — kunnan päätös ei
puhu niin. Sopimuskauden loppu on nyt viimeinen vaihtoehto samassa
funktiossa, jolloin jo tehty hankinta ei enää päädy jonoon mahdollisuutena.
Järjestys on tarkoituksellinen: yllä olevat kuviot on viritetty yritysten
tiedotteiden aineistolla, ja uusi haara ajetaan vasta kun ne eivät löydä
mitään.

Vaikutus mitattiin ennen kytkentää: koko aineistossa sopimuskausi
tunnistuu 8 rivillä, joista 4 on jo päättynyt. Ei yhtään väärää osumaa.

Ks. `lib/agent/decisionPhase.ts` ja
`lib/projects/inferCompletionDateFromText.ts`.

### D-037 – Sisältöalue rajataan HTML:n rakenteesta, ei tekstin avainsanoista
CaseM-asiasivun vasemmassa laidassa on viranhaltijavalikko: linkkilista
jokaiseen kunnan viranhaltijanimikkeeseen. Rovaniemellä se on 93 nimikettä ja
2 700 merkkiä, ja HTML:ssä se tulee ennen varsinaista asiaa. Murupolusta
katkaisu ei sitä poistanut, koska valikko on murupolun jälkeen.

**Vika ei ollut kosmeettinen.** Kohdetyyppi luetaan tekstin alusta
([D-035](#d-035--ingressi-kertoo-hankkeen-loppuosa-kertoo-ympäristön)), ja
valikossa on kymmenien koulujen rehtorit, kirjastonjohtaja ja
museonjohtajat. Sipolantien 9 **purku-urakka** sai kohdetyypin "Koulu".
Mitattuna kaikilla 59 CaseM-rivillä valikko oli kuvauksessa, ja 22:lla
kohdetyyppi korjaantui — useimmat väärästä tyhjäksi.

Rajaus tehdään alustan omilla tunnisteilla (`id="ContentStart"`, sivuvalikko
`id="Content_sidenaviArea"`), ei suomenkielisillä avainsanoilla. Rakenne on
sama kaikilla neljällä asennuksella. Kaksi asiaa, jotka rajaus rikkoisi
hiljaisesti, jos ne tehtäisiin väärin:

- **Kokouspäivä luetaan koko sivulta**, koska murupolku on sisältöalueen
  ulkopuolella. Rajatusta alueesta luettuna tuoreusraja lakkaisi toimimasta
  ilman että mikään näyttäisi rikkoutuneelta.
- **Leikkaus alkaa avaustagin sulkevasta merkistä**, ei tunnisteesta. Muuten
  tagin loppuosa jää tekstiksi: kuvaus alkoi `id="ContentStart" role="main">`.

Samalla poistui CaseM:n oma entiteettilista: se kattoi vain tässä
aineistossa sattumalta nähdyt merkit, ja puuttuva `&sect;` jätti
pykälämerkin purkamatta. Purku delegoidaan nyt jaetulle
`lib/agent/htmlEntities.ts`:lle.

### D-036 – Voittaja ankkuroidaan päätöslauseeseen, ei y-tunnukseen
Hankintapäätöksestä poimitaan urakan voittaja. Ensimmäinen versio ankkuroi
poiminnan y-tunnukseen suluissa, koska se on tekstin täsmällisin merkki.
Ankkuri oli väärä: y-tunnus on myös jokaisella HÄVIÄJÄLLÄ, koska päätös
sisältää lähes aina tarjousvertailutaulukon.

Mitattu 11 rivin otoksella: **3 oikein, 8 väärin**. Kuusankosken
yhtenäiskoulusta tuli kolme voittajaa vaikka teksti sanoo
"KVR-urakoitsijaksi valitaan Varte Lahti Oy" — Lujatalo ja Lapti eivät
tulleet hylätyiksi, ne vain hävisivät vertailun, joten hylkäyssuodatinkaan ei
niitä poistanut. Hylkäyssuodatin oli olemassa ja testattu, mutta se mittasi
väärää asiaa.

Oikea ankkuri on lause jossa päätös tehdään. Muotoja on neljä, kaikki
aineistosta:

| Muoto | Esimerkki | Tulos |
|---|---|---|
| Monikkorooli + luettelo | "hyväksyä puitesopimuskumppaneiksi seuraavat tarjoajat: …" | monta |
| Yksikkörooli | "urakoitsijaksi valitaan MVR-Yhtymä Oy" | yksi |
| Viranhaltijan valinta | "Päätös Valitsen Saltex Infra Oy:n hinnaltaan halvimpana." | yksi |
| Ablatiivi + ostoverbi | "kaupunki hankkii … urakan Peab Industri Oy:ltä" | yksi |

Ratkaisevaa on roolisanan **sija ja luku**: "-kumppaneiksi" ja
"-urakoitsijoiksi" ovat voittajarooleja, mutta "tarjoajiksi" ja
"ehdokkaiksi" eivät — "Tarjoajiksi valittiin seuraavat kolme (3) ehdokasta"
on tarjoajalista, ei päätös. Ilman päätöslausetta tulos on tyhjä.

Uudelleenmittaus samalla otoksella: 9/9 oikein (kaksi riviä joilla ei ole
voittajaa tyhjeni oikein). Koko aineistossa 1003 päätösrivistä 27:llä on
voittaja: 24 yksittäistä urakoitsijaa ja 3 puitesopimusta.

**Viides muoto ja i-lippu (lisätty myöhemmin).** Pienhankinnassa lukee
"sopimustoimittajiksi valitaan hinnaltaan halvimman kokonaistarjouksen
jättänyt Lapin Timanttisahaus Oy": monikkorooli mutta yksi voittaja, ja
verbin ja nimen välissä on perustelu. Roolin luku ei siis kerro voittajien
määrää — se ratkaisee vain kumpaa reittiä yritetään ensin. Välisanat
sallitaan verbin jälkeen, rajattuna viiteen ja vain pienellä alkavina.

Tämä paljasti pahemman vian: **kuvio ei voi käyttää i-lippua.** Se tekee myös
nimen kuviosta `[A-ZÅÄÖ]` kirjainkoosta riippumattoman, jolloin isolla
alkava sana lakkaa olemasta vaatimus — ja juuri se erottaa yritysnimen sitä
edeltävistä perustelusanoista. Kantaan oli päätynyt voittajina
"kokonaistaloudellisesti edullisimman tarjouksen jättänyt Oteran Oy" ja
"halvimman tarjoushinnan tehnyt Lappset Group Oy". Roolit ja verbi
kirjoitetaan siksi molemmilla alkukirjaimilla (`[Vv]alit`,
`[Uu]rakoitsijaksi`) eikä lipulla.

**Kuudes muoto ja nimen "ja" (lisätty myöhemmin).** Rovaniemen
viranhaltijalauseessa valintaverbi on roolin EDELLÄ ja roolin ja nimen
välissä on pelkkä perustelu: "Päätän valita … urakan pääurakoitsijaksi
kokonaishinnaltaan edullisimman tarjouksen jättäneen Oulun Maa- ja
Vesirakennus Oy:n". Verbi kaapataan siksi omaan ryhmäänsä, ja jos sitä ei
ole roolin jälkeen, se etsitään roolia edeltävästä ikkunasta. Ilman
valintaverbiä osuma hylätään: rooli on silloin pelkkä maininta.

Samassa lauseessa oli toinen vika: **nimen sisällä oleva "ja"** katkaisi
isokirjainketjun, eikä kuvio osunut koko lauseeseen. "ja" sallitaan nyt
nimen sisällä, mutta toisto on **laiska** — ahne toisto yhdistäisi kaksi eri
yritystä yhdeksi ("Rakennus Oy ja Kone Oy"). Laiska pysähtyy ensimmäiseen
yhtiömuotoon. Sivutuotteena myös etuliitteinen "Oy Sähkö-Vendelin Ab"
toimii, ja puitesopimuslistasta korjaantui katkennut "Kvl Putki- ja
Poltinhuolto Oy" (oli "Poltinhuolto Oy").

**Seitsemäs muoto: y-tunnukseton luettelo (lisätty myöhemmin).**

> "…puitejärjestely**sopimuskumppaneiksi valitaan:** Koneurakointi
> M. Niiranen Oy, Oteran Oy, Maansiirto Eero Huttunen Oy, Koneurakointi
> Jarkko Kosunen ja KoneNeliö Oy."

Kolme syytä miksi mikään aiemmista kuvioista ei osunut: **rooli on ennen
verbiä**, verbin perässä on **kaksoispiste**, eikä yhdelläkään yrityksellä
ole **y-tunnusta** — eikä yhdellä ole edes yhtiömuotoa ("Koneurakointi
Jarkko Kosunen"). Luettelo rajataan siksi virkkeeseen ja pilkotaan
erottimista, ja jokainen pala tarkistetaan erikseen.

Kaksi ehtoa pitävät sen turvallisena:

- **Vähintään kaksi kelvollista nimeä.** Yhden nimen tapauksessa
  yksittäisvoittajan kuvio on tarkempi: se osaa ohittaa perustelusanat
  ("valitaan hinnaltaan halvimman tarjouksen jättänyt X Oy"), joita
  pilkkujako ei erota.
- **Piste ei lopeta virkettä jos sitä edeltää yksi iso kirjain.** Se on
  nimen alkukirjain, ja siihen katkaistuna luettelo jäisi muotoon
  "Koneurakointi M".

Mitattu koko aineistolla: 1 uusi rivi, 0 muuttunutta, 0 poistunutta.

**Kahdeksas ja yhdeksäs muoto — ja missä sääntöpohja loppuu.** Ennen
näiden kirjoittamista mitattiin paljonko poimittavaa on jäljellä. 1 016
päätösrivistä 964 oli ilman voittajaa, mutta valtaosassa voittajaa ei ole
olemassa:

| | rivejä |
|---|---|
| ei yritysnimeä koko tekstissä | 657 |
| yritysnimi mutta ei hankintakieltä | 290 |
| **epäilty puute** | **17** |

Ne 17 luettiin läpi. Kahdeksan oli oikein tyhjiä (kilpailutus kesken,
valvoja, ei hankintapäätös) ja yhdeksän jakautui kahteen muotoon:

- **Partisiippi + genetiiviobjekti**, ei roolisanaa lainkaan: "valita …
  edullisimman tarjouksen **tehneen** Lakeuden Maanrakennus **Oy:n**".
  Ankkurina on partisiippi, koska genetiivimuotoinen yritysnimi esiintyy
  tekstissä jatkuvasti muutenkin ("X Oy:n tarjous hylätään"). Valintaverbi
  vaaditaan edeltä, muuten juuri tuo hylkäyslause kelpaisi.
- **Liian pitkä väli**: "urakoitsijaksi kelpoisuusehdot täyttävien
  tarjousten joukosta suurimmat kokonaispisteet saaneen Louhintahiekka
  Oy:n" — seitsemän välisanaa, kun raja oli viisi. Raja nostettiin
  kahdeksaan; väärentymisriski pysyy pienenä, koska välisanat saavat alkaa
  vain pienellä eikä kuvio siksi voi ohittaa yritysnimeä matkalla.

Tulos: 8 uutta voittajaa, 0 muuttunutta, 0 poistunutta. Voittaja on nyt
60 rivillä.

**VÄITE "SÄÄNTÖPOHJA ON VALMIS" OSOITTAUTUI VÄÄRÄKSI.** Yhdeksän muodon
jälkeen arvioin että poimittavaa ei enää ole. LLM-kartoitus
(`scripts/survey-missed-winners.ts`, 273 riviä, 0,5 $) löysi kahdeksan
lisää yhdellä ajolla:

| löydös | rivejä | mitä se on |
|---|---|---|
| **nimi ennen roolia** | 2 | "hyväksyä **Louhintahiekka Oy:n** urakoitsijaksi", "**SRV Rakennus Oy** on valittu päätoteuttajaksi" — aidosti uusi muoto |
| välisanoissa keskeytys | 2 | "(95,25 pistettä) Recset Oy", "tammikuussa **2023** järjestetyn" — tuttu muoto, mutta sulkeet ja luku katkaisevat `FILLER`-kuvion |
| **ruotsinkielinen päätös** | 2 | "beslutade … utse Hoivatilat Oyj:s erbjudande" — koko kieli puuttuu säännöistä |
| kaupungin oma tuotanto | 2 | "Purkutyön suorittaa **Stara**" — ei yhtiömuotoa, ei kilpailutusta |

**Korjatut muodot (10. ja 11.).** Kartoituksen löydöistä neljä
toteutettiin:

- **Nimi ennen roolia**: "hyväksyä Louhintahiekka Oy:n urakoitsijaksi",
  "SRV Rakennus Oy on valittu päätoteuttajaksi". Kaikki aiemmat muodot
  olettivat roolin tulevan ensin. Väli on enintään kolme sanaa, koska
  pidempi sallisi poiminnan tarjoajaluettelosta.
- **Keskeytys välisanoissa**: sulkulause ja luku kelpaavat nyt väliin
  ("(95,25 pistettä) Recset Oy", "tammikuussa 2023 järjestetyn"). Isolla
  alkava sana ei edelleenkään kelpaa - se on koko rajauksen ydin.

**Uusi sääntö toi yhden väärän osuman, ja se vaati oman vartijansa.**
Tukkutorin päätös kertaa hankkeen historian: "Tärkeät Tekijät Oy
valittiin kokonaisurakoitsijaksi" on kielellisesti moitteeton, mutta sama
teksti kertoo että kaupunki purki urakkasopimuksen ja otti työmaan
haltuun. Purettu urakkasopimus kumoaa nyt voittajan kokonaan. Vartija
paljasti myös aiemmin tiedossa olleen vanhentuneen arvon (Siklatilat Oy /
Päiväkoti Perhonen), joka poistui.

Lopputulos: 4 uutta voittajaa, 1 poistunut vanhentunut. Voittaja 63
rivillä.

**AVOINNA (11.8.2026).** Kartoituksen kahta löydöstä ei toteutettu:

- **Kunnalliset liikelaitokset, erityisesti Stara.** `NAME` vaatii
  yhtiömuodon, joten "Stara" ei voi koskaan osua. Aineistossa 2 riviä
  ("Purkutyön suorittaa Stara"), ja lisäksi Tukkutorin päätöksessä Stara
  valittiin korvaavaksi urakoitsijaksi työmaan haltuunoton jälkeen.
  Helsingin kilpailutussääntöjen muutoksen jälkeen Stara on hävinnyt
  kilpailutuksia, eli se on aito kilpailija eikä automaattinen sisäinen
  toimittaja — ratkaisu olisi nimilista, mutta päätös on tekemättä.
- **Ruotsinkieliset päätökset.** Säännöt ovat suomenkielisiä; kartoitus
  löysi 2 riviä. Vaatisi oman roolisanaston ja verbit.

Molemmat jäivät löytymättä sääntöjä mittaamalla, koska ehdokasjoukko
rajattiin yhtiömuotoa vaativalla kuviolla.

**Miksi oma mittaukseni ei löytänyt näitä:** rajasin ehdokasjoukon omilla
säännöillä. "Epäillyt puutteet" haettiin regexillä joka vaati
hankintakieltä, ja ehdokasjoukko vaati yhtiömuodon (`Oy|Ab|Ky`) — mikä
sulki Staran kokonaan pois ja ruotsin osittain. **Käytin sääntöjä
päättämään missä säännöt voivat epäonnistua.**

Oikea johtopäätös on kapeampi kuin aiempi: sääntöpohja kattaa *tunnetut*
muodot täydellisesti ja halvalla, mutta **uusien muotojen löytäminen ei
onnistu säännöillä**. Siihen LLM on oikea työkalu, ja se maksoi 0,5 $
kertaluontoisesti. Työnjako on siis: LLM etsii muodot, säännöt ajavat ne.

Tämä ei muuta kustannusvertailua — 273 rivin kartoitus kerran ei ole sama
asia kuin LLM jokaisessa ajossa — mutta se kumoaa oletuksen että
sääntöpohjan kattavuutta voisi arvioida sääntöpohjan sisältä.

**Allatiivi (seitsemäs muoto).** Työ voidaan myös *antaa* yritykselle:
"…suunnittelu **annetaan** … tarjouksen jättäneelle **Insinööritoimisto
Lepistö Oy:lle**". Ablatiivin peilikuva.

Sääntö on tarkoituksella kapea, koska `Oy:lle` esiintyy aineistossa 50
kertaa mutta lähes aina muussa roolissa:

| konteksti | kpl |
|---|---|
| vuokraus, tonttivaraus, omistus | ~35 |
| kustannusten korvaus | 10 |
| **urakan/suunnittelun antaminen** | **2** (sama rivi kahdesti) |

Siksi vaaditaan sekä luovutusverbi (`annetaan`) että kilpailutuskonteksti
(`tarjous`, `urakka`, `hankinta`). Kumpikaan yksin ei riitä: verbi yksin
osuisi lausunnon antamiseen, kilpailutussana yksin vuokraukseen samassa
päätöksessä. Vuokralainen, korvauksen saaja ja lausunnon saaja on kukin
testattu erikseen.

**Roolisanasto tarkistetaan aineistosta (lisätty myöhemmin).** Rooli
"toteuttajaksi" puuttui, joten "…valitsee urakan toteuttajaksi
VM-Suomalainen Oy:n" jäi ilman voittajaa. Koska sama puute oli osunut
kohdalle jo kahdesti, sanastoa ei täydennetty yhdellä sanalla vaan
haettiin **kaikki** translatiivimuodot joita seuraa yritysnimi:

| rooli | kpl | tila |
|---|---|---|
| urakoitsijaksi (+ purku-, KVR-, ilmanvaihto-, putki-, sähkö-, rakennus-) | 14 | toimi jo |
| palveluntuottajaksi | 3 | toimi jo |
| toimittajaksi | 2 | toimi jo |
| **toteuttajaksi** | 1 | **puuttui** |

Muut osumat (`siirrettäväksi`, `luovutuksensaajaksi`, `maksettavaksi`,
`pysäköintialueeksi`) eivät ole voittajarooleja.

**"Valvojaksi" jätettiin pois tietoisesti.** Valvoja on rakennuttajan
konsultti, ei urakoitsija, ja koska yhden voittajan sääntö täyttää
`builder`-kentän, Granlund Oy olisi päätynyt hankkeen rakentajaksi.
Säännöstä on oma testi, ettei sitä lisätä myöhemmin vahingossa.

**RYHMITTYMÄSTÄ POIMITAAN JOHTAVA YRITYS.** Sääntö on nyt osunut kahdesti:

> "KVR-urakoitsijaksi valitaan Varte Lahti Oy **käyttäen** Varte
> Lappeenranta Oy:n ja Varte Oy:n **voimavaroja**"
> "toteuttajaksi on valittu **ryhmittymä** YIT Business Premises Oy **ja**
> YIT Infra Oy"

Molempien poiminta tyhjentäisi urakoitsijakentän usean voittajan
säännöllä, vaikka toteuttajia on yksi. Ensimmäisenä nimetty on
ryhmittymän vetäjä, ja se on se yritys joka työn tekee.

**Ostoverbin passiivi (lisätty myöhemmin).** Ablatiivin vartija tunsi vain
aktiivin `hankkii`, mutta aineistossa passiivi `hankitaan` on lähes yhtä
yleinen — ks. [D-039](#d-039--kuvion-muodot-luetaan-aineistosta-ei-muistista).
11 lisävoittajaa.

Ks. `lib/agent/decisionWinners.ts`. Sama ilmiö kuin
[D-035](#d-035--ingressi-kertoo-hankkeen-loppuosa-kertoo-ympäristön):
täsmällinen merkki ei ole sama asia kuin oikea merkki.

### D-035 – Ingressi kertoo hankkeen, loppuosa kertoo ympäristön
Yrityslähteiden täydennys luki aluksi koko tiedotesivun. Se tuotti kaksi
virhettä, jotka näkyivät vasta kun 50 rivin otos katsottiin ennen kirjoitusta:

```
tilaaja "Garmin"      <- Skanskan koulu-urakka Iin kunnalle
tilaaja "Robonic"     <- Hartelan hoivahanke Attendolle
tyyppi  "Päiväkoti"   <- asuntokohde, teksti mainitsi lähipalvelut
```

Yritysten nimet tulivat sivun lopun tiedotelistasta, kohdetyyppi lauseesta
"lähellä on päiväkoti ja koulu". Kummassakaan tapauksessa lähde ei ollut
rikki — luin väärää osaa sivusta.

Sääntö: **tiedotteen kärki kertoo mistä hankkeessa on kyse ja kuka sen
tilasi; loppuosa kuvaa ympäristöä, siteeraa johtajia ja luettelee muita
tiedotteita.** Osapuolet ja kohdetyyppi luetaan ensimmäisestä 700 merkistä
(`LEAD_LENGTH`), kuvaukseksi jää koko teksti.

Yleisempi opetus: **kun täydennysajo koskee satoja rivejä, katso otos ennen
kuin kirjoitat.** Otos maksoi yhden ajon ja esti väärän tiedon 745 riville.

**Sama sääntö taulun järjestyksessä (lisätty 9.8.2026).** Ingressin
rajaaminen ei riitä, kun sana esiintyy kahdessa eri roolissa. Ulkoalueet
ovat kunnan päätöksessä hankkeen kohde ("Leikkipuisto Trumpetin
puistosuunnitelma") mutta yrityksen tiedotteessa naapuruston palvelu ("76
asunnon kohde … lähellä on leikkipuisto"). Kun ne olivat `BUILDING_TYPES`-
taulun alkupäässä, kaksi asuntokohdetta muuttui leikkipuistoiksi.

Ratkaisu on järjestys, ei uusi sanalista: **hankkeen oma rakennustyyppi
ratkaistaan ennen ympäristön palvelua.** Liikuntapaikka ja Leikkipuisto
ovat siksi taulun lopussa, heti infran edellä. Väärät osumat putosivat
kuudesta kolmeen ilman että yksikään oikea osuma katosi.

### D-034 – Julkaisijan rooli on osa lähteen määrittelyä
Yrityslähteiden jaettu täydennys (`lib/agent/companyRelease.ts`) merkitsi
ensin julkaisijan aina **urakoitsijaksi**, koska valtaosa lähteistä on
rakennusliikkeitä. Se olisi kirjannut Y-Säätiön ja Asuntosäätiön
urakoitsijoiksi, vaikka ne ovat rakennuttajia: ne tiedottavat omista
hankkeistaan, eivät saamistaan urakoista.

Rooli on siksi lähteen ominaisuus (`role: "builder" | "developer"`), ei
pääteltävä asia. Neljä lähdettä on rakennuttajarooleja: asuntosaatio,
ysaatio, espoon_asunnot, kas_asunnot.

**Rakennuttaja jää tyhjäksi kun tilaajaa ei saada tekstistä.** Julkaisijan
kirjaaminen molempiin väittäisi hanketta omaperusteiseksi, ja se on väärä
tieto silloin kun tilaaja vain jäi jäsentämättä. Poikkeus on aito
omaperusteinen tuotanto, jonka teksti kertoo ("omaperusteinen",
"vapaarahoitteinen"). Tästä seuraa että rakennuttaja on täytetty vain 20 %
riveistä — se on tavoiteltu tulos, ei puute. Sama periaate kuin
viranomaisjulkaisijan hylkäämisessä ja allatiivin kääntämisessä: **tyhjä on
parempi kuin väärä.**

### D-033 – Tarkista onko työkalu jo olemassa ennen kuin rakennat sen uudelleen
RPT-täsmäytys ajettiin uudelleen sen selvittämiseksi, sulkiko kuntien
päätöslähteiden rakentaminen aukon.

**Menetelmä rakennettiin uudelleen turhaan.** Oletin että alkuperäinen skripti
oli väliaikaistiedosto joka oli kadonnut, enkä tarkistanut asiaa. Se oli koko
ajan versionhallinnassa nimellä `scripts/match-rpt-list.ts` — samassa kansiossa
kuin kaksitoista muuta samaa konventiota noudattavaa huoltoskriptiä. Uusi
`scripts/rpt-rematch.mjs` on siis päällekkäinen toteutus, ja **juuri sen
erilaisuus tuotti alla kuvatun menetelmäharhan.** Harha oli itse aiheutettu ja
kokonaan vältettävissä.

Sääntö: **ennen kuin rakennat mittausvälineen uudelleen, listaa `scripts/`.**
Puuttuvaksi oletettu työkalu on halpa tarkistaa ja kallis rakentaa väärin.

Tulos näytti hyvältä — 165 osumaa 552:sta, kun ensimmäinen ajo löysi nolla —
kunnes osumat jaettiin sen mukaan **milloin vastapuolen rivi oli luotu**.
Kaikki 70 hanke-osumaa osuivat riveihin jotka olivat olleet kannassa jo
alkuperäisen mittauksen aikaan. Sama data, eri vastaus: ero tuli menetelmästä,
ei uudesta tiedosta. Pistokoe vahvisti että uusi menetelmä oli löyhempi — eri
hotelli eri kunnassa, eri katuosoite, ja yksi geneerinen "Kerrostalo Ouluun"
kolmen eri RPT-hankkeen osumana.

Sääntö: **ennen/jälkeen-vertailu vaatii että menetelmä on bittiä myöten sama.**
Eri skripti mittaa skriptin muutosta, ei maailman muutosta. Oikea tapa ajaa
tämä uudelleen on `npx tsx scripts/match-rpt-list.ts`, sama väline jolla
lähtötaso mitattiin — `scripts/rpt-rematch.mjs` jää käyttämättä.

Toinen sääntö samasta ajosta: **kun luku yllättää positiivisesti, etsi ensin
selitys joka ei ole edistystä.** Luontiaikajako oli halpa tarkistus ja se kumosi
otsikkoluvun kokonaan. Vertailukelpoiseksi jäi 21 osumaa, jotka pystyttiin
osoittamaan kuntien päätöslähteistä tulleiksi.

### D-032 – Alustaa ei pääteltä yhdestä osoitteesta
Jyväskylä oli kirjattu Tweb-kunnaksi ja **viidenneksi alustaperheeksi**, koska
kaupungilta löytyi Tweb-asennus (`julkinen.jkl.fi`). Päätelmä oli väärä: samat
päätökset ovat myös CaseM:ssä (`jyvaskyla.cloudnc.fi`), jota jo jäsennämme.
Uutta jäsentäjää ei tarvittu, ja Tweb-reitti olisi ollut sitäkin turhempi
koska sen `robots.txt` kieltää haun kokonaan.

Sama kartoitus toi mukanaan Rovaniemen ja Porin, jotka olivat CaseM:ssä ilman
että sitä osattiin epäillä — ja Joensuun, joka on Dynasty mutta
**maakunnallisessa asennuksessa** jossa kunta on polussa
(`dynastyjulkaisu.pohjoiskarjala.net/joensuu/`) eikä aliverkkotunnuksessa.
Se oli jäänyt löytymättä, koska aiempi 40 kunnan testi haki vain
`<kunta>.oncloudos.com`-muotoa. Palvelimen juuri vastaa lisäksi 403:lla.

Sääntö: **kunnan alusta selvitetään kaikilta tunnetuilta alustoilta, ei
ensimmäisestä löytyneestä osoitteesta.** Yksi löydetty järjestelmä ei ole
todiste siitä että se on ainoa tai edes se käytetyin. Nimeämiskaava on
heuristiikka löytämiseen, ei kartta: neljä kuudesta uudesta kunnasta oli
osoitteessa jota kaavasta ei olisi arvannut.

### D-031 – robots.txt ratkaisee, ei alustan tekninen soveltuvuus
Tweb-alusta on teknisesti helpoin kaikista viidestä: palvelinpuolen HTML,
ei JS-vaatimusta, vakiopolut `/ktwebbin/dbisa.dll/ktwebscr/`. Sitä ei silti
kerätä, koska **neljä viidestä mitatusta Tweb-asennuksesta julkaisee
`robots.txt`-tiedoston jossa lukee `Disallow: /`**: Oulu
(`asiakirjat.ouka.fi`), Vaasa (`tweb.vaasa.fi`), Hyvinkää
(`asianhallintavhp.hyvinkaa.fi`) ja Jyväskylä (`julkinen.jkl.fi`). Kielto
tulee tuotteen mukana eikä kunnan päätöksestä, mutta se on silti kielto.

**Kielto on toimittajan vakio, ei kunnan kanta.** Kolmen kunnan
`robots.txt` on tavulleen sama tiedosto (26 tavua, sha1 `7b17ed8d`), ja
Oulun ja Hyvinkään `Last-Modified` on sama sekunnilleen — *Thu, 11 Nov 2021
08:16:41 GMT*. Sama tiedosto on siis kopioitu asennuspaketista, ei kirjoitettu
kunnassa. Jyväskylän versio eroaa yhdellä välilyönnillä ja on vuodelta 2019,
eli se on saman mallin vanhempi sukupolvi.

**Vantaa ei ole poikkeus, vaikka ensin siltä näytti.** `paatokset.vantaa.fi`
ei tarjoa `robots.txt`-tiedostoa (404), mutta **jokainen viiden asennuksen
sivu — Vantaa mukaan lukien — sisältää `<meta name="robots" content="noindex,
nofollow" />`.** Sama ohje siis annetaan, vain eri tasolla. Vantaan
palvelimelta puuttuu tiedosto, ei tahtotila.

Miksi toimittaja tekee näin: kunnan pöytäkirjat ovat julkisia, mutta ne
sisältävät henkilötietoja — nimiä, osoitteita ja yksittäistä ihmistä koskevia
asioita. Vakiintunut suomalainen käytäntö on että ne ovat luettavissa mutta
eivät hakukoneella löydettävissä eivätkä massana haravoitavissa. Lisäksi Tweb
on `dbisa.dll`-CGI jossa jokainen sivu on id-parametrilla generoitu: se on
sekä hakurobotin ansa että kallis palvelimelle.

Vertailu muihin: Helsingin `paatokset.hel.fi` sallii asiasivut nimenomaisesti
ja tarjoaa avoimen Elasticsearch-rajapinnan, CaseM kieltää vain RSS:n ja
ASP.NET-resurssit, Dynastylla ei ole `robots.txt`-tiedostoa eikä
meta-ohjetta. Ero ei siis ole laissa vaan toimittajan valinnassa.

Sääntö: **lähteen tekninen helppous ei ohita robots-ohjetta, oli se
`robots.txt`:ssä tai sivun metatiedossa.** Jos kielto halutaan ohittaa, se on
ihmisen päätös ja se kirjataan tänne — ei jotain minkä kerääjä ratkaisee
hiljaa. Kuudelle kunnalle haetaan mieluummin lupa tai vaihtoehtoinen lähde:
Vantaa, Oulu, Vaasa, Hyvinkää ja Seinäjoki (Tweb) sekä Lappeenranta, joka on
**M-Files**-dokumenttienhallinnassa ja kieltää samalla tavalla. Vantaa on
niistä tärkein: 46 puuttuvaa RPT:n hanketta, eniten koko listalla.

Huomionarvoista on että kielto seuraa **tuotetta, ei kuntaa**. Kaikki neljä
kerättävää alustaa (Ahjo, Dynasty, CaseM, Turun oma) sallivat, ja molemmat
kieltävät (Tweb, M-Files) kieltävät joka ainoalla asennuksella. Kunnan koko,
sijainti tai avoimuuslinjaus ei ennusta mitään — toimittajan valinta ennustaa
kaiken.

### D-030 – Vakio silmukan sisällä lasketaan kerran
`findProjectMatchDetailed` vertaa **yhtä** ehdokasta kaikkiin 4412
hankkeeseen. `descriptionSimilarity` saa ehdokkaan kuvauksen ensimmäisenä
argumenttina, eli se on sama merkkijono koko silmukan ajan — mutta se
tokenisoitiin uudelleen jokaiselle hankkeelle. 4412 turhaa laskentaa yhtä
ehdokasta kohden.

Korjaus on yhden alkion muisti. Häviötön: sama merkkijono tuottaa saman
trigrammijoukon, ja osumapisteet ovat identtiset ennen ja jälkeen.

**Mittaus on tehtävä eristetysti.** Ensin päättelin syyksi kuvausten
pituuden, koska mittasin kolme varianttia peräkkäin samassa prosessissa:
7657 ms täydellä, 2234 ms tuhannella merkillä, 777 ms ilman kuvausta.
Rajasin vertailun 1500 merkkiin — ja se ei nopeuttanut lainkaan. Ero oli
tullut V8:n JIT-lämmittelystä, ei kuvauksen pituudesta.

Omissa prosesseissaan ajettuna kuva oli toinen:

| variantti | ms / ehdokas |
|---|---|
| täysi | 14674 |
| hankkeen kuvaus pois | 14159 (ei vaikutusta) |
| **ehdokkaan kuvaus pois** | **1924** |

Kaksi sääntöä tästä:

1. **Varianttien vertailu samassa prosessissa peräkkäin ei kelpaa.** Järjestys
   pitää satunnaistaa tai jokainen variantti ajaa omassa prosessissaan.
2. **Yhden ajon kellotukseen ei voi luottaa.** Samalle variantille mitattiin
   7657, 8888, 14674 ja 8733 ms eli hajonta ±2×. Siksi tämä muutos
   perustellaan algoritmisesti — turha työ jää tekemättä kuormasta
   riippumatta — eikä kellolla.

Peruttu rajaus oli lisäksi häviöllinen: 16 000 parin verifiointi osoitti että
2,23 % vaihtaisi pisteytystasoa, aina alaspäin. Häviöllinen muutos ilman
mitattua hyötyä ei kuulu koodiin.

### D-029 – Löyhää hakua vastaan tarvitaan positiivinen sisältövaatimus
STT:n hakurajapinta on **kokotekstihaku eikä fraasihaku**, ja se on
relevanssijärjestetty. Hakusana `koulurakennus` palauttaa 181 osumaa joiden
otsikoissa lukee vain "koulu"; `päiväkoti` antaa 2269 osumaa joissa on
koiraturvallisuutta ja Ukrainan uutisia.

Kun sivutus korjattiin (ks. alla), tulos kasvoi 82 → 1855 mutta otoksesta
mitattuna **65 % oli kohinaa**. Tutkin ensin hypoteesin että aiempi katkaisu
olisi vahingossa toiminut relevanssisuodattimena — **mittaus ei tukenut sitä**:
kohina oli suunnilleen sama sijoilla 0–9, 10–29 ja 30–99. Ongelma ei ole
syvyys vaan haun löysyys.

Sääntö: **kun lähteen haku on löyhä, poissulkulista ei riitä.** Poissuljettavia
aiheita on ääretön määrä, toimialan sanastoa ei. Vaaditaan positiivinen osuma
rakentamiseen viittaavaan sanaan. Tulos 1855 → 780, kohina 65 % → 40 %.

Positiivinen lista on myös vaarallinen jos se on vajaa: ensimmäinen versio
pudotti Töölön kisahallin, koska listalla oli `peruskorja` muttei
`perusparann` — kuntien vakiotermi. Vika löytyi vain koska kisahallia
käytettiin nimettynä testitapauksena.

**Hakusanat ja sisältösignaalit ovat eri asia.** Hakusanat määräävät mitä
lähteestä *haetaan*, signaalit mitä *säilytetään*. Signaalilistalla oleva sana
ei tuo yhtään uutta tiedotetta — tämä sekaantui kerran, kun `purkutyö` ja
`investoi` olivat vain signaaleissa ja näyttivät siltä että ne olisi katettu.

**Sivutusparametrit selvitetään kokeilemalla, ei olettamalla.** Poimija pyysi
`count=20` ja uskoi saavansa 20. Rajapinta ei tunne `count`-parametria
lainkaan, joten se ohitettiin hiljaa ja vastauksena tuli oletusmäärä 10 —
0,7 % siitä mitä `totalCount` lupasi. Toimivat parametrit ovat `size` ja
`page`. Sama vikaluokka kuin D-026:ssa: pyyntö onnistuu, vastaus näyttää
täydeltä.

### D-028 – Valmistumista ei päätellä menneestä aikamuodosta
Hankkeen valmistumista **ei voi päätellä kuvaustekstistä**. Mitattu 4412
julkisesta hankkeesta: sana "valmistui"/"valmistunut" esiintyi 69:llä, ja
tiukennuksen jälkeen (pois asiakirjat, viereiset rakennukset, vanhat
vuosiluvut molemmin puolin sanaa) jäljelle jäi 12 — joista **yksikään ei
koskenut hanketta itseään**. Ne kertoivat purettavasta vanhasta rakennuksesta,
valmistuneesta kaavaselvityksestä tai naapurirakennuksesta, tai olivat
konditionaaleja tulevaisuudesta ("valmistuisi syksyllä 2029").

Siksi `parseEstimatedCompletionDate` hyväksyy vain **tulevan aikamuodon**
(`valmistuu`, `valmistuva`, `valmistumassa`) eikä koskaan mennyttä. Rajaus on
tarkoituksellinen, ei puute — ilman tätä merkintää joku lisää `valmistui`-muodon
takaisin hyvässä uskossa.

Käyttökelpoinen signaali on siis **arvioitu valmistumisaika**, ei todettu
valmistuminen. Arvio + aika riittää, koska `auto-complete-projects`-cron
siirtää hankkeen valmistuneeksi vasta kun päivä on mennyt. Varmennettu
valmistuminen (loppukatselmus) vaatisi rakennusrekisterin, joka ei ole avointa
dataa; Lupapisteen julkipano ei kelpaa, koska se julkaisee päätöksiä eikä
katselmuksia eikä julkaise lupaa uudelleen tilan muuttuessa (mitattu: 366
lupatunnusta, 0 tilanmuutosta).

Vuodenaika arvioidaan aina kauden **viimeiseen** kuukauteen. Liian aikainen
arvio piilottaisi käynnissä olevan hankkeen asiakkailta, koska valmistuneet
suodatetaan listasta ja kartalta.

### D-027 – Kuvaukseton ehdokas on hylätty ehdokas
Mitattu koko kannasta, ja korrelaatio on jyrkkä:

| lähde | ehdokkaita | ilman kuvausta | hylätty |
|---|---|---|---|
| srv | 291 | 100 % | **96 %** |
| mangrove | 91 | 100 % | 100 % |
| lujatalo | 72 | 100 % | 93 % |
| pohjola_rakennus | 75 | 100 % | 73 % |
| stt_haku | 240 | **0 %** | 61 % |
| yva | 123 | **0 %** | 2 % |

Pelkän otsikon perusteella korttia ei voi arvioida, joten se hylätään. Lähteen
"laatu" ei siis ollut se mitä hylkäysaste mittasi — se mittasi poimijan
puutetta. Tämä on syytä muistaa ennen kuin jokin lähde suljetaan huonona:
**tarkista ensin tuottaako se kuvauksen.**

Käytännön sääntö poimijoille: jos runko tai ote lasketaan avainsanasuodatusta
varten, se on myös palautettava. Neljässä poimijassa se oli laskettu ja
heitetty pois — data oli jo haettu, joten kuvaus ei maksanut yhtään
lisäpyyntöä. Sama vika oli aiemmin mangrovessa (ks. 7.8.).

### D-026 – Sivutettu haku, kun aineisto on lähteen päätettävissä
YVA-haku pyysi 150 uusinta osumaa ja luotti siihen että se kattaa 18 kuukauden
tuoreusikkunan. Aineistossa on **1337 hanketta**, joten 150 riitti vain kolmeen
kuukauteen: `RECENCY_MONTHS = 18` oli kuollutta koodia ja 3–18 kuukauden
ikäiset hankkeet jäivät kokonaan hakematta. Juuri se ikkuna on lähteen koko
arvo — YVA on varhaisin signaali, vuosia ennen kilpailutusta.

Vika oli näkymätön, koska haku onnistui joka kerta ja palautti täydeltä
näyttävän tuloksen. Sääntö: **kun aineiston koko on lähteen päätettävissä,
kiinteä `size` on hiljainen katkaisu.** Sivutetaan kunnes sivun vanhin osuma
ylittää tuoreusrajan, ja pidetään yläraja turvaventtiilinä.

Sama pätee PostgRESTin 1000 rivin kattoon, joka on tässä koodikannassa
toistunut vika: molemmissa kysely onnistuu ja vastaus näyttää oikealta.

### D-025 – Ajastetun työn ikkuna on pidempi kuin ajoväli
Duplikaattiskannauksen inkrementaalinen ajo vertasi viimeisen **7 päivän**
aikana luotuja tai päivitettyjä hankkeita, ja cron ajoi **7 päivän** välein.
Ikkuna ja ajoväli olivat identtiset, eli päällekkäisyyttä ei ollut lainkaan:
yksi väliin jäänyt ajo — deploy, aikaraja, cron-häiriö — jätti sen viikon
hankkeet (169 uutta + 212 päivittynyttä) pysyvästi skannaamatta, koska mikään
ei palaa taaksepäin.

Sama vikaluokka kuin D-022:ssa, eri paikassa. Sääntö: **ajastetun työn ikkuna
mitoitetaan niin että peräkkäiset ajot menevät päällekkäin.** Päivittäisellä
ajolla sama 7 päivän ikkuna antaa seitsenkertaisen redundanssin, ja hinta on
olematon — kaupunkiryhmittelyn jälkeen ajo kestää 5,9 s.

Perustelu asuu reitin kommentissa, koska `vercel.json` ei salli kommentteja.

### D-024 – Eri numero nimessä rajoittaa, ei estä
Kaavoituksessa ja katuosoitteissa numero on identiteetti: "Vellamonkatu 11" ja
"Vellamonkatu 8" ovat eri tontti, "295 Pereen asemakaavan muutos" ja "289
Pereen asemakaavan muutos" eri kaava. Täsmäytys ei nähnyt tätä lainkaan, koska
`titleWords` pudottaa alle neljän merkin sanat — "11", "8", "295" ja "XVI"
katosivat ennen vertailua ja nimistä jäi jäljelle täsmälleen sama sanajoukko.
Mitattu täydestä skannauksesta: 65 katselmoitavasta parista 48 oli kaavapareja
ja **34:llä numero erosi**.

Vaikutus on **rajoittava, ei estävä** — tässä poiketaan tarkoituksella
[contractTrade](../lib/projects/contractTrade.ts):n vetosta, joka nollaa
osuman. Varmuus painetaan 65:een eli yhdistämiskynnyksen alle, jolloin pari
jää ihmisen katsottavaksi. Numero ei nimittäin aina ole tunniste:
uutisotsikossa voi lukea "48 asuntoa" ja toisessa lähteessä "50 asuntoa"
samasta hankkeesta. Lupanumero ja kiinteistötunnus voittavat säännön, koska ne
ovat suoraa todistetta samasta kohteesta.

Kolme yksityiskohtaa jotka ratkaisivat mitatut tapaukset:

- **Vertailu koko joukkona, ei leikkauksena.** "Asemakaava 853 14/2021" ja
  "853 5/2021" jakavat numerot 853 ja 2021 mutta ovat eri kaava.
- **Molemmilla on oltava numeroita.** Vain toisessa oleva on yleensä
  tarkennus: "Oulun elämysareena ja ympäristö, Rata-aukio 2" vs "Oulun
  elämysareena".
- **Sanan sisäistä numeroa ei poimita**, jottei "FIN04A" tai "Ph2" pilkkoudu.

### D-023 – Taivutusvertailu suhteellisena, ei kiinteänä merkkimääränä
`nameWithinText` salli taivutuksen kuuden merkin yhteisellä alulla. Lyhyille
sanoille se on tiukka, pitkille yhdyssanoille aivan liian löyhä:
`kansallismuseolle` ja `kansallisarkiston` jakavat alun "kansal" ja kelpasivat
toisikseen. Mitattu tuotannosta — Kansallismuseon uutisen paras osuma koko
kannasta oli Kansallisarkiston peruskorjaus.

Yhteisen alun on nyt katettava **70 % pidemmästä sanasta**. Suhteellinen mitta
on oikea, koska taivutuspääte on lyhyt suhteessa vartaloon: aito pari ylittää
rajan helposti (`kansallismuseon`/`kansallismuseolle` = 14/17), eri sanat
jäävät alle (`kansallis` = 9/17). Sama raja pudottaa myös D-019:ssä mitatun
vuodon `tuulivoimahanke`/`tuulivoimapuisto` = 10/16.

Hinta on kirjattava: kolme jonon paria putosi automaattiyhdistämisestä
ehdotukseksi, koska ne nojasivat juuri tuohon vuotoon. Ne näkyvät yhä 45 %:n
ehdotuksina, eli ihminen päättää.

**Yksi erottuva sana riittää, jos se on pitkä ja loput nimestä löytyvät.**
Geneeristen sanojen karsinta (`titleWords`) jätti nimestä "Kansallismuseon
peruskorjaus ja laajennus" vain yhden sanan, jolloin `NAME_IN_TEXT_MIN_WORDS`
= 2 kieltäytyi katsomasta tekstiä lainkaan — vaikka kuvauksessa esiintyivät
nimen kaikki kolme sanaa. Nyt yhden sanan nimi kelpaa kun sana on ≥ 12
merkkiä, nimessä on muutakin, ja tekstistä löytyy nimen jokainen sana myös
geneeriset mukaan lukien. Karsittu sana on huono todiste yksin mutta hyvä
vahvistus sille joka kantaa merkityksen. Pituusraja erottaa
`kansallismuseon` (15) sanasta `koulun` (6).

### D-022 – Jokaisella putken vaiheella on oma jono, ei vain edeltäjän paluuarvo
Tunnistus (`runIdentityWorker`) ajettiin vain heti faktapoiminnan perässä
samassa silmukkakierroksessa: `if (result.ok && result.documentId)`. Se toimii
niin kauan kuin kierros menee loppuun, mutta **vaihe ilman omaa jonoa ei voi
toipua mistään**. Kun kierros katkesi väliin — aikaraja, faktatyöläisen virhe,
uudelleendeploy — dokumentille jäi `facts_extracted_at` mutta ei
`identity_resolved_at`, eikä mikään palannut siihen koskaan.

Mitattu: 31 dokumenttia jumissa, vanhin 35 vuorokautta, ja kahdella niistä oli
oikeaa sisältöä joka ei päätynyt minnekään.

Sääntö: **vaiheen kelpoisuusehto luetaan kannasta, ei edellisen vaiheen
paluuarvosta.** Kiinniotto ajetaan ennen uutta työtä (vanhin ensin), jotta jono
purkautuu eikä kasva ohi, ja jonon pituus palautetaan mittarina — muuten sama
vika on taas näkymätön, koska dokumentin `status` pysyy `downloaded` kuten
kaikilla muillakin.

Kaatuva dokumentti merkitään käsitellyksi ja virheviesti jää talteen. Muuten
yksi rikkinäinen rivi jumittaisi jonon ikuiseen silmukkaan — vanhin ensin
-järjestys takaisi että se valitaan joka kierroksella uudelleen.

### D-021 – AI-relevanssiportti kytketään ehdokkaan luontiin, ei signaaliin
Portti (`llmRelevanceScorer`) oli rakennettu mutta ei kytkettynä: ainoa kutsuja
oli `lib/agent/pipeline/runSource.ts`, jota kutsui vain `/api/agent/run-source`
— reitti jolla ei ollut yhtään kutsujaa (ei cronissa, ei käyttöliittymässä) ja
joka luki vanhaa `agent_sources`-taulua. `llm_relevance_log` oli siksi tyhjä ja
TIC:in AI-suodatus-sivu näytti nollaa koko olemassaolonsa ajan.

Portti kytkettiin sinne missä ehdokkaat oikeasti syntyvät:
`resolvePotentialProject`, luontihaaraan. **Vain uusille ehdokkaille ja vain
kun sääntö ei sanonut mitään** (`recommended_action` puuttuu) — olemassa
olevalle ehdokkaalle päätös on tehty kertaalleen, eikä samaa otsikkoa kannata
kysyä uudelleen jokaisella lähdesignaalilla.

Portti voi vain **suodattaa jonon ulkopuolelle, ei koskaan hyväksyä
julkiseksi**. Suunta on tarkoituksellinen: väärä suodatus piilottaa yhden
liidin, väärä hyväksyntä veisi roskaa käyttäjille asti. Fail-open kauttaaltaan.

### D-020 – Maantiede pisteytetään kerran, tarkimmalla tasollaan
`same_location` (45) + `same_city` (20) + `same_region` (8) laskettiin yhteen,
jolloin yksi ja sama todiste laskettiin kolmesti: sijainti sisältää kaupungin,
kaupunki sisältää maakunnan. Summa 73 ylitti 70:n yhdistämiskynnyksen **ilman
minkäänlaista todistetta samasta hankkeesta**. Mitattu: 16 väärää yhdistymistä
sai täsmälleen 73 pistettä.

Nyt pisteitä annetaan vain tarkimmalta osuneelta tasolta. Katuosoite (60) ja
aluenimi (30) erotetaan toisistaan talonumeron perusteella: "Mannerheimintie
14" osoittaa yhden rakennuksen, "Kruunuvuorenranta" on kaupunginosa jossa on
kymmeniä hankkeita. Kumpikaan ei yksin riitä 70:een, joten sijainti tarvitsee
aina tuekseen otsikko-, rakennuttaja- tai kuvaustodisteen.

Syyt (`reasons`) kirjataan edelleen kaikilta tasoilta, koska todisteportti ja
duplikaattiskannerin laatuvaatimus lukevat niitä.

### D-019 – Tekstivertailu sanoina, ei trigrammeina, kun kyse on nimestä
Nimen etsiminen kuvauksesta (`name_in_description`) toteutettiin ensin
merkkitrigrammien sisältyvyydellä, koska trigrammit kestävät suomen taivutusta
ja `descriptionSimilarity` käyttää niitä. **Se ei toimi nimille.**

Suomen yhdyssanat vuotavat toisiinsa: "tuulivoimahanke" sisältyy lähes
kokonaan tekstiin jossa lukee "tuulivoimapuisto", ja "datakeskus" mihin tahansa
datakeskusuutiseen. Mitattuna tuotantoa vasten 37 osumasta selvästi yli puolet
oli vääriä — "Kotaselän tuulivoimahanke" osui hankkeeseen "Asemakeskus" — ja
yksi väärä ylitti 70:n eli olisi yhdistynyt automaattisesti.

**Päätös:** nimivertailu tehdään kokonaisina sanoina. Taivutus sallitaan vain
vartalon alusta (6 merkin yhteinen alku molempiin suuntiin), geneeriset sanat
pudotetaan ja vaaditaan vähintään kaksi erottelevaa sanaa joista 70 % löytyy
tekstistä. Trigrammit jäävät sinne minne ne sopivat: kahden pitkän
kuvaustekstin vertailuun, jossa yksittäisen sanan vuoto ei ratkaise.

Mitattu korjatusta versiosta: 42 osumaa, väärät jäävät 58 pisteeseen eli alle
70:n kynnyksen — ne näkyvät ehdotuksina mutta eivät yhdisty automaattisesti.

**Uusi todistesyy on lisättävä kaikkiin listoihin jotka luettelevat syitä
nimeltä**: `hasTextEvidence`, `onlyWeakText`, duplikaattiskannerin laatuportti
ja käyttöliittymän kaksi `REASON_LABELS`-listaa. Tämä on unohtunut kahdesti
(`exact_distinctive_title`), ja molemmilla kerroilla seuraus oli että
täsmäytys lakkasi toimimasta hiljaisesti. `name_in_description` jätettiin
tarkoituksella pois skannerin portista — perustelu on kirjattu koodiin.

### D-018 – Yhdistetty hanke piilotetaan, ei poisteta
Duplikaattien yhdistämisessä poistuva rivi voisi houkutella poistettavaksi,
mutta siihen viittaa käyttäjädataa (suosikit, vastuutukset), tuontitapahtumia
ja vaihehistoriaa. **Päätös:** poistuva rivi merkitään `is_public = false` ja
saa `metadata.merged_into_project_id`-osoittimen säilyvään; säilyvä saa
`merged_from_project_ids`. Sama tapa kuin duplikaattinäkymän "Piilota tämä",
joten päätös on peruttavissa eikä historia katoa.

Kolme sääntöä yhdistämisessä:
- **Säilyvän arvot voittavat aina**, poistuvalta täydennetään vain tyhjät.
  Nimeä, kaupunkia, maakuntaa ja vaihetta ei kosketa — ne ovat säilyvän
  identiteetti, ja vaiheen siirtäminen ohittaisi D-013:n.
- **Poistuvan nimi tallennetaan `also_known_as`-kenttään**, jota matcher lukee.
  Ilman sitä saman uutisen toinen otsikkomuoto synnyttäisi duplikaatin
  uudelleen — juuri niin Espoonlahden pari syntyi.
- **Vastuutusta ei siirretä jos säilyvällä on jo omistaja.** Hankkeella on yksi
  vastuullinen, eikä skripti valitse ihmisten välillä; se on esihenkilön päätös.
  Poistuvan vastuutus poistetaan ja tieto jää metadataan.

Yhdistetty rivi rajataan pois täsmäytyksestä (`loadProjectsForMatching`),
muuten rikastus kirjautuisi näkymättömälle hankkeelle.

### D-017 – Rakennuttajaa verrataan organisaationimenä, ei merkkijonona
Sama organisaatio kirjoitetaan lähteissä eri tavoin: genetiivi, sulkeissa oleva
lyhenne, yhtiömuoto, y-tunnus. Merkkijonovertailu piti niitä eri toimijoina, ja
koska rakennuttaja+kaupunki on yksi neljästä hyväksytystä todisteesta, osuma
saattoi jäädä kokonaan syntymättä. Mitattu tapaus: "Pohjois-Pohjanmaan
hyvinvointialue Pohde" vs "Pohjois-Pohjanmaan hyvinvointialueen (Pohde)" —
ehdokas ei saanut yhtään pistettä.

**Päätös:** vertailu sanajoukkona (`lib/projects/organizationName.ts`).
Y-tunnus ja yhtiömuoto pudotetaan, genetiivi puretaan, sanat järjestetään.
Sanajärjestys ei siis vaikuta eikä sulkeissa olevan lyhenteen tarvitse olla
suluissa.

**-nen-loppuisia ei typistetä.** "Virtanen" ei ole genetiivi, ja sen purkaminen
sekoittaisi eri yritykset. Sama periaate kuin muualla täsmäytyksessä: väärä
yhdistäminen on pahempi kuin osumatta jäänyt, koska ihminen näkee osumattoman
ehdokkaan jonossa mutta ei väärin yhdistettyä.

### D-016 – Vanhat lähteet ajetaan discovery-putken kautta adapterilla
`lib/agent/sources.ts`:n 34 fetcheriä ajettiin omalla mekanismillaan, jossa
kierron aloituskohtia oli vain kaksi ja ajo kuoli aikaan ennen listan loppua:
viisi viimeistä lähdettä ei ollut päässyt kertaakaan vuoroon. Vaihtoehdot
olivat (A) kirjoittaa fetcherit discovery-kerääjiksi tai (B) adapteri joka
kutsuu niitä sellaisenaan. **Päätös: B.** Fetcherit toimivat, ja niiden
uudelleenkirjoitus olisi ollut riski ilman hyötyä — ongelma oli ajastuksessa,
ei poiminnassa. Ne ovat nyt `discovery_sources`-taulussa
(`collector = legacyFetchCollector`), saavat per-lähde ajastuksen ja
virheseurannan kuten muutkin. **`lib/agent/sources.ts` ei ole vanhentunut
eikä sitä saa poistaa** — adapteri käyttää sitä; vanhentunut oli vain putki
sen ympärillä, ja se on poistettu.

### D-015 – Duplikaattivertailu rajataan laatuportin omilla avaimilla
Skannaus vertasi jokaista muuttunutta hanketta koko julkiseen joukkoon:
1,57 miljoonaa vertailua ja 358 sekuntia, kun reitin `maxDuration` on 60 —
viikkocron ei ehtinyt kertaakaan loppuun, eikä sitä huomattu koska tyhjä
tulos näytti samalta kuin kaatunut ajo. Laatuportti hyväksyy parin vain jos
sillä on sama lupanumero tai kiinteistötunnus, TAI nimitodiste JA sama
kaupunki. Eri kaupungeissa olevien, tunnisteettomien hankkeiden vertailu ei
siis voi koskaan tuottaa ehdokasta. **Päätös:** vertailujoukko rajataan
näiden kolmen avaimen ryhmiin (`comparisonBuckets.ts`) → 37 598 vertailua,
7 s. Ryhmittely käyttää samoja normalisointifunktioita kuin `calculateMatch`,
jottei se voi ajautua matcherista erilleen. Todennettu 79 kirjattua paria
vastaan: 78 säilyy, ja se yksi joka putoaa ei tuota nykydatalla osumaa
muutenkaan. Jos laatuporttia joskus löysätään, tämä rajaus on päivitettävä
samalla.

### D-014 – Vanhentunut kilpailutus palaa aktiiviseksi kun voittaja selviää
Kilpailutus vanhenee vuosi tarjousten määräajasta (`status = expired`), mikä
piilottaa sen kartalta, /today-näkymästä ja tiimilistalta. Jos voittaja
selvisi vasta sen jälkeen, hanke rikastui oikein mutta jäi piiloon — eli
piiloon jäi juuri se hetki joka on myyjälle arvokkain. **Päätös:** voittajan
ratkeaminen palauttaa hankkeen aktiiviseksi (`shouldUnexpire`), koska se on
tuore tapahtuma riippumatta siitä milloin tarjouspyyntö julkaistiin.
Vastakkainen kanta (kaksi vuotta vanha kilpailutus on vanhaa uutista) on
puolustettavissa, mutta hankkeen vaihe kertoo lukijalle loput.

### D-013 – Vaihe saa vain edetä, ei peruuttaa
`syncApprovedProject` on aina estänyt vaiheen peruuttamisen, mutta agentin
tuonti kirjoitti saman kentän ehdoitta. Vanha uutinen tai suunnitteluvaiheesta
kertova tiedote siirsi käynnissä olevan työmaan takaisin suunnitteluun:
mitattuna 4 vrk:n ikkunassa 29 kertaa 32 aidosta vaihesiirtymästä, ja
agentti kumosi kaikkien kolmen muun päätöslähteen tuloksen (ihmisen
hyväksyntä, auto_sync, käsin tehty korjaus). **Päätös:** yksi sääntö
(`phaseAdvances` tiedostossa `lib/projects/phases.ts`) molemmille reiteille.
Tuntematon tai järjestyksetön vaihe (esim. "Peruttu") ei ohita nykyistä,
koska emme voi tietää onko se edistys.

**Sivuhavainto:** kannassa on kaksi vaiheen esitystapaa — `projects.phase` on
otsikko ("Rakenteilla"), `project_phase_history.phase` on avain
("construction"). `normalizeLegacyPhase` hyväksyy nyt molemmat; aiemmin
avaimella kutsuttu vertailu palautti hiljaa nullin.

### D-012 – Tontinluovutukset jätetty väliin (ei siistiä lähdettä)
Selvitetty kilpailija-aukkona: ei kansallista eikä siistiä kaupunkikohtaista
rajapintaa. Helsingin `tontit.hel.fi` on poistettu, ja tonttiasiat ovat nyt
yleisissä päätösjärjestelmissä (`paatokset.hel.fi` ym.) yksittäisinä
pöytäkirjoina kaiken muun seassa — signaali/kohina huono, rakennuttajan/tontin
louhinta epäluotettavaa, ja tieto hajallaan joka kaupungissa erikseen. Menee
myös päällekkäin kaavan (jo poimitaan) ja rakennuslupien kanssa. **Päätös:**
kohiseva päätös-scraperi haittaisi TIC-jonoa enemmän kuin hyödyttäisi → ei
rakenneta ennen kuin löytyy siisti, korkean signaalin lähde.

### D-011 – Varhaisen vaiheen lähteet kilpailija-aukon sulkemiseen
Metroc/RPT Smart poimivat isot hankkeet aikaisin. Aukon sulkevat lähteet jotka
osuvat hankkeen KAIKKEIN aikaisimpaan julkiseen signaaliin, ennen rakennuslupaa
ja urakkakilpailutusta: **YVA** (ympäristövaikutusten arviointi — suurimmat
energia-/teollisuus-/infrahankkeet), **ympäristölupa** (isot yksityiset
laitokset ilman julkista kilpailutusta, esim. datakeskukset) ja
**suunnittelukilpailu** (SAFA — merkittävät julkiset rakennukset konseptivaiheessa,
myös Hilman ulkopuoliset kutsukilpailut). Kriteeri uudelle lähteelle: korkea
signaali/kohina ja aikaisempi vaihe kuin nykylähteet — ei volyymi volyymin
vuoksi (vrt. [D-012]).

### D-010 – Duplikaatteja yhdistettäessä säilytä hanke jolla on käyttäjädataa
Suosikit (`user_project_favorites`) ja omistajuus viittaavat `project_id`:hen.
Jos yhdistettäessä poistetaan väärä hanke, käyttäjien suosikit eivät seuraa
uuteen kopioon (eri id) — ne katoavat/roikkuvat. **Sääntö:** säilytä se hanke
johon käyttäjät ovat koskeneet; jos suunta on toinen, siirrä `user_project_favorites`
(ja muu project_id-viitteinen data) säilyvälle ennen poistoa.

### D-009 – Tarkoituksella pois kytketty lähde ei ole "ongelma"
Discovery Sources -taulussa "ongelma" = oikeasti rikki (virheitä). Pois
kytketty (`enabled=false`) lähde on eri tila (⚪ pois), ei punainen ongelma.
Esim. vanha Helsingin WFS jätettiin pois-tilaan SUKKAn varalle — se ei saa
näyttää ongelmalta.

### D-008 – Vanhat uutiset kahdella riippumattomalla mekanismilla
Uutispohjaiset lähteet tuovat vanhoja, jo valmistuneita hankkeita. Suodatus:
(1) **teksti** — mennyt valmistumispäivä kuvauksessa → `recommended_action=ignore`
(keskitetty `resolvePotentialProject`iin); (2) **julkaisupäivä** — yli 24 kk
vanha artikkeli (esim. Puolustuskiinteistöt) käsitellään kuin valmistunut.
Kahta tarvitaan, koska osa uutisista ei mainitse päivää tekstissä ja osalla ei
ole luotettavaa julkaisupäivää.

### D-007 – Discovery-cron 6 h välein (4×/vrk)
Kerran/yö -ajolla yksittäisen lähteen häntäkierto oli ~35 pv (250 lähdettä ÷
~7 paikkaa). 6 h -välein (4 ajoa/vrk) se on ~9 pv. Ajon kesto mitattu (~187 s),
selvästi alle 500 s turvarajan / 800 s Fluid Compute -katon.
Ks. `lib/agent/pipeline/cronConfig.ts` (`DISCOVERY_RUNS_PER_DAY`).

### D-006 – Deterministinen ensin, LLM fail-open
Kaikki poiminta yritetään ensin sääntöpohjaisesti; LLM (Haiku) vain kun sääntö
ei riitä, ja aina fail-open (ilman API-avainta ohitetaan). Putki toimii aina
ilman AI:ta. Ks. [`05_AI.md`](05_AI.md).

### D-005 – Rikas lähde deterministisen jäsennyksen sijaan kun rajapinta antaa sen
Helsingin WFS antoi vain geometrian + kaavatunnuksen; SUKKA-rajapinta antaa
kuvauksen, yhteystiedon, vaiheen ja liitteet. Kun kunnalla on rikkaampi
(Sitowise/Oskari) rajapinta, käytä sitä — vähemmän jälkirikastusta.

### D-004 – Manuaalinen "aseta vanhenemaan" pienten hankkeiden suodatukseen
LLM-luokittelun sijaan hyväksyjä voi merkitä pienen hankkeen vanhenemaan
vuoden päästä (tick box). Yksinkertaisempi ja käyttäjän hallinnassa.

### D-003 – Testit `*.spec.ts` (Vitest), ei `*.test.ts`
Repossa oli jo `*.test.ts`-tiedostoja jotka ovat console.log-skriptejä, eivät
framework-testejä. Vitest-testit nimetään siksi `*.spec.ts`. CI ajaa
`npm install` (ei `npm ci`) cross-platform-lockin vuoksi.

### D-002 – Kaksi ehdokasjärjestelmää (siirtymävaihe)
`potential_projects` (pääpolku, uudet resolverit) ja legacy
`candidate_projects` (saveSignal/classifySignal). Uusi työ menee
`potential_projects`iin.

### D-001 – Lähde rekisteröitävä Supabaseen, ei pelkkä koodi
Pelkkä collectorin committaaminen ei riitä — lähde tarvitsee rivin
`discovery_sources`-tauluun. Ks. [`07_ZONING_SOURCES.md`](07_ZONING_SOURCES.md)
(luotettavuushuomio + 8-tiedosto-kaava).
