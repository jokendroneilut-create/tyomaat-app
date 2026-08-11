# Työmaat.fi – Päätökset (ADR-tyyliin)

Merkittäviä suunnittelupäätöksiä ja niiden perustelut, jottei niitä käydä
uudelleen läpi joka sessiossa. Ylin = uusin.

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
