# Hankekuvausten kattavuus

Hankkeen kuvaus on tuote, ei tiiviste: käyttäjä avaa alkuperäisen lähteen
vain **2,6 %:ssa** hankkeen avauksista, joten kannassa oleva teksti on
käytännössä ainoa mitä hän lukee (D-269). Tavoite on **useita satoja
merkkejä jokaiselle hankkeelle**; alle 200 on puute, alle 40 on tyhjä.

Tämä tiedosto pitää kirjaa siitä, mitkä lähteet on käyty läpi ja mitkä
eivät — jottei samaa kuntaa tutkita uudelleen joka istunnossa.

## Mittari

```bash
npx tsx scripts/mittaa-kuvausten-pituus.ts              # hankkeet (additional_info)
npx tsx scripts/mittaa-kuvausten-pituus.ts --ehdokkaat  # ehdokkaat (metadata.description)
```

Mittaa **sen kentän jonka asiakas lukee**. Hanke näyttää sarakkeen
`additional_info` ("Lisätietoja"); `metadata.description` ei näy
hankenäkymässä lainkaan (D-270). Jakauma, ei keskiarvo — keskiarvo
piilottaa juuri sen hännän joka näkyy.

## Tilanne 11.10.2026 (illalla)

6 785 hanketta, mediaani **706** merkkiä (lähtötaso 597), alle 200
merkin **1 115** (16 %), alle 40 merkin 210.

| merkkiä | hankkeita | osuus |
|---|---|---|
| 0–40 | 210 | 3 % |
| 40–100 | 304 | 4 % |
| 100–200 | 601 | 9 % |
| 200–400 | 1 208 | 18 % |
| 400–800 | 1 273 | 19 % |
| 800– | 3 189 | 47 % |

**Asiakkaan osuma ohueen hankkeeseen: 19,9 % → 13,9 %** (490 → 343
avausta 2 467:stä). Tämä on se luku jota seurataan, ei rivien määrä.

## Käyty läpi

| lähde | tulos | miten |
|---|---|---|
| Euran kaavoitus ja maapolitiikka | 7 kuvausta (12 kaavasta 9 saa pääselostuksen) | keräin hakee selostuksen, D-268 |
| Helsingin asemakaavat (SUKKA) | 60 riviä 65:stä; hankkeista 198/201 yli 200 merkin | kynnys 200 merkkiä, OAS + selostus, D-270 |
| Kouvolan ajankohtaiset asemakaavat | 14 / 26 | yleinen täydentäjä, D-271 |
| Mustasaaren vireillä olevat asemakaavat | 7 / 21 | yleinen täydentäjä |
| Kangasalan vireillä olevat asemakaavat | 7 / 19 | yleinen täydentäjä |
| Kauniaisten vireillä olevat asemakaavat | 3 / 15 | yleinen täydentäjä |
| Inkoon ajankohtainen kaavoitus | 1 / 10 | yleinen täydentäjä |
| käsin lisätyt (ei lähdettä) | **140 / 165** | oma osoite + `extractReleaseBody`, D-272 |

Yleinen täydentäjä (kuivaharjoitus oletuksena):

```bash
npx tsx scripts/taydenna-kaavakuvaukset.ts "<source_name>"
npx tsx scripts/taydenna-kaavakuvaukset.ts "<source_name>" --apply
npx tsx scripts/synkronoi-kuvaus-nakyviin.ts --apply   # hankkeen näkyvä kenttä
```

**Keräin on kytkettävä erikseen.** Takautuva täydennys korjaa olemassa
olevat rivit; uudet rivit jäävät ohuiksi kunnes kunnan oma keräin hakee
selostuksen (Eura ja Helsinki on kytketty, muut eivät). Jäsennin ja
liitevalitsija ovat jaettuja, vain sivurakenne vaihtelee — ks.
[muisti: kaava-parser-vs-page].

## Mihin asiakkaan osumat oikeasti kohdistuvat (11.10.2026)

Kannassa olevien ohuiden rivien **määrä** ei kerro kannattaako työtä
jatkaa — vasta se, mihin asiakkaan avaukset osuvat.

```bash
npx tsx scripts/mittaa-ohuiden-osumat.ts
```

490 avausta 2 467:stä osui ohueen hankkeeseen = **19,9 %**, eli tasan
samassa suhteessa kuin ohuita on kannassa (19,7 %). Asiakkaat eivät siis
väistä niitä: joka viides avaus näyttää lähes tyhjän hankkeen.

Mutta osumat jakautuvat aivan eri tavalla kuin lähdetyö:

| lähde | ohuita avauksia | osuus | korjattavissa lähteestä? |
|---|---|---|---|
| (ei lähdettä) — käsin lisätyt | 245 | 50 % | **kyllä**, 166:lla on elävä osoite |
| Hilma | 120 | 24 % | **ei** — ilmoituksessa on vain yksi virke |
| rakennuslehti | 59 | 12 % | ei — artikkeli maksumuurin takana |
| Lupapiste + Espoon kuulutukset | 22 | 4 % | osin |
| **kaikki kaavalähteet yhteensä** | **~12** | **2 %** | kyllä, mutta vähän |

**Kaavalähteiden läpikäynti kattaa 2 % asiakkaan ohuista osumista.**
Se tehtiin loppuun siellä missä se maksaa itsensä takaisin, mutta
jatkaminen lähde kerrallaan ei enää kannata.

### Hilma: lyhyys ei ole poimintavirhe

Tarkistettu 11.10.2026 eForms-ilmoituksesta (procedure 29821, enotice
55039): ilmoituksen `procurementProject/description` on **täsmälleen
sama 144 merkkiä** kuin kannassa. Tilaaja on kirjoittanut yhden
virkkeen. Lisäteksti olisi tarjouspyyntöasiakirjoissa, ei
ilmoituksessa. Hilman ohuita rivejä ei siis korjata poimintaa
parantamalla — eikä niitä pidä pidentää tekstiä keksimällä.

### Käsin lisätyt: suurin yksittäinen vipu

166 käsin lisätyllä ohuella hankkeella on `source_url`. Otos 12
(tasavälein, ei ensimmäiset): **12/12 osoitetta vastasi ja kaikilla oli
1 455–6 876 merkkiä tekstiä** — Atrian tehdas, Senaatin virastotalo,
Firan logistiikkakeskus, OX2:n tuulipuisto.

**Tehty 11.10.2026 (D-272): 140 / 165 täydennetty.**

```bash
npx tsx scripts/taydenna-kasin-lisatyt.ts
npx tsx scripts/taydenna-kasin-lisatyt.ts --apply
```

25 jäi täydentämättä perustellusti: 9 navigaatiosivua, 9 sivua joiden
teksti olisi mennyt 3–6 eri hankkeelle (brändisivu), 4 ilman tekstiä,
3 jotka eivät liity kyseiseen hankkeeseen.

**Osoitteettomille haettiin lähde verkosta 12.10.2026 (D-273).**
DuckDuckGon html-päätepiste on ilmainen ja skriptattavissa; Claude
Coden oma WebSearch ei kelvannut (US-painotteinen, 0/2 suomalaisesta
hankkeesta).

```bash
npx tsx scripts/etsi-lahde-verkosta.ts
npx tsx scripts/etsi-lahde-verkosta.ts --apply   # kirjoittaa vain VARMAT
```

167 hankkeesta **95 osumaa, joista 42 varmaa** (hakutuloksen otsikko
kattaa ≥ 75 % hankkeen nimen sisältösanoista, vähintään kaksi sanaa).
Varmat kirjoitettiin; **53 meni tarkistuslistalle**, koska mitattu
tarkkuus ilman otsikkotodistetta on vain 60–70 %. 70:llä yksikään
kolmesta osumasta ei vastannut hanketta.

Johannes kävi listan läpi ja merkitsi 11 vääräksi; hyväksytyistä
kirjoitettiin **35** (`scripts/kirjoita-tarkistetut.ts`). Seitsemällä
sivu ei vastannut enää kirjoitushetkellä — ne voi yrittää uudelleen.

Yhteensä käsin lisätyistä on nyt täydennetty **140 + 42 + 35 = 217**
hanketta.

## Umpikuja: lähteessä ei ole tekstiä

Näitä ei kannata yrittää uudelleen samasta lähteestä. Tarkistettu
11.10.2026 otoksella 3 hanketta per lähde.

| lähde | ohuita | havainto |
|---|---|---|
| Lahden kaavatyökohteet | 60 | hankesivuilla **0 pdf-liitettä**, ei sanaa "selostus", "aineisto" eikä "liite"; yksi rivi ("Kaavatyön tavoitteena on…") on kaikki mitä Lahti julkaisee |
| Lappeenrannan vireillä olevat asemakaavat | 44 | 0 pdf-liitettä sivulla; `mfiles.lappeenranta.fi` on rajattu pois (ei pyyntöjä) |
| Kuopion vireillä olevat kaavat | 30 | 0 pdf-liitettä sivulla |
| Rauman vireillä olevat asemakaavat | 17 | 13 / 15:stä ilman pdf-liitettä |

## Listaussivu: liite on olemassa mutta väärän hankkeen

Näillä `document_url` osoittaa koko kaavoitussivulle, jolla on kaikkien
kaavojen liitteet. Ensimmäisen selostuksen poimiminen liittäisi toisen
hankkeen tekstin, joten täydentäjä vaatii että liitteen nimi tunnistaa
juuri sen kaavan (tunnus tai harvinainen sana otsikosta).

| lähde | ohuita | pdf-linkkejä sivulla |
|---|---|---|
| Nokian vireillä olevat asemakaavat | 25 | 300 |
| Pornaisten vireillä olevat kaavat | 23 | 85 |
| Pelkosenniemen vireillä olevat asemakaavat | 18 | 199 |
| Karkkilan vireillä olevat kaavahankkeet | 13 | 46 |

Tunnistussääntö on olemassa (`taydenna-kaavakuvaukset.ts`), mutta näitä
ei ole vielä ajettu läpi — se vaatii oman kuivaharjoituksen luvun, koska
väärä osuma on pahempi kuin tyhjä.

## Muut kuin kaavalähteet

| lähde | ohuita | huomio |
|---|---|---|
| (ei lähdettä) | 193 jäljellä (oli 333, **50 % ohuista osumista**) | **Johanneksen käsin lisäämiä** helmi–huhtikuussa 2026, ennen kuin keräimiä oli nykymuodossaan. Ei lähdeasiakirjaa josta poimia: 136:lla on `source_url`, lopuilla ei mitään. Ainoa reitti on verkkohaku (mitattu 20 senttiä/hanke) tai käsin. |
| Hilma | 91 / 814 (**24 % ohuista osumista**) | tarkistettu: eForms-ilmoituksessa on sama teksti kuin kannassa, tilaaja kirjoitti yhden virkkeen — ei korjattavissa |
| Lupapiste kuulutukset | 37 / 169 | kuulutus on menettelyteksti; liiteasiakirjat vanhenevat verkosta |
| rakennuslehti | 32 / 68 | uutisen ingressi; koko artikkeli maksumuurin takana |
| Väylävirasto hankkeet | 20 / 273 | hankesivu on lyhyt |
| yva | 19 / 270 | arviointiohjelma on liitteenä |

## Liite on pöytäkirjasivu, ei pdf (D-290, 15.10.2026)

Yleinen täydentäjä hakee **vain `.pdf`-linkkejä** `document_url`-sivulta.
Osalla kaavarivejä liite on sen sijaan Dynastyn kokousasiasivu, ja sen
linkki on tallessa `raw_payload.attachments`-kentässä — jota ei lue
yksikään myöhempi vaihe.

```bash
npx tsx scripts/taydenna-dynasty-liitteet.ts
npx tsx scripts/taydenna-dynasty-liitteet.ts --apply
```

Laajuus on kapea: **7 dokumentilla** on `page=meetingitem`-liite, ja
niistä 2 muuttui (Paltamon Ouluntie 89 → 4 000, Rantakuja 105 → 4 000).
4 ohitettiin koska niillä oli jo 1 551-4 273 merkkiä.

Isompi tulos tuli jäsentimen korjauksesta: `extractItemText` hylkäsi
osiotunnisteen hypyllä mediaanisti 59 % tekstistä, pahimmillaan 96 %.
Korjaus mitattiin 13 päätöslähteen omilla sivuilla (36 sivua 9 kunnasta):
18 pidempi, 17 sama, 0 lyhyempi.

**Umpikuja tältä erää:** Dynastyn vanhempi versio (`gVersion='7.00.030'`,
Pälkäne) antaa `extractItemText`-funktiolle `null`. Älä tutki uudelleen
ilman uutta mittausta; sivurakenne on eri kuin 7.00.034:ssä ja 10.4.x:ssä.

## Hilman tarjousasiakirjat: reitti toimii, kattavuus 1/25 (D-291)

Yllä oleva johtopäätös *"Hilman ohuita rivejä ei korjata poimintaa
parantamalla"* oli oikea, mutta syystä jota se ei tiennyt. Reitti
asiakirjoihin **on** olemassa ja julkinen:

```
GET /web/api/public/procedure/{procedureId}/enotice/{noticeId}  -> attachments
GET https://cdn.hankintailmoitukset.fi/public-attachments/{id}  -> pdf
```

```bash
npx tsx scripts/taydenna-hilma-liitteista.ts
npx tsx scripts/taydenna-hilma-liitteista.ts --apply
```

Mitattu 15.10.2026, otos 25 ohuesta rivistä tasavälein 523:sta: liite
löytyi **1:llä**, 21:llä 0 liitettä, 3:lta puuttuivat tunnisteet. Syy on
Hilman omalla sivulla: toisesta järjestelmästä lähetetyssä ilmoituksessa
Hilmassa on vain ilmoituksen PDF, ja asiakirjat ovat tilaajan omassa
kilpailutusjärjestelmässä kirjautumisen takana.

**Älä tutki uudelleen kattavuuden toivossa.** Reitti on rakennettu ja se
poimii siellä missä liite on. Loput vaatisivat kirjautumisen Cloudiaan
tai Tarjouspalveluun, mitä ei tehdä.

**Avoin, parempi vipu samasta aineistosta:** `original.estimatedValue`
on 459 Hilma-dokumentissa 1 544:stä eikä sitä lueta lainkaan
(`extractHilmaFacts` lukee vain ratkaisun summia). 244 ehdokkaalta
kustannusarvio puuttuu silti. Ei vaadi verkkohakua. Ks. D-291.

## Mitä EI lasketa kuvaukseksi

Pituus ei saa tulla täytteestä. Nämä näyttävät kuvaukselta olematta
sellaisia, ja kaikki kolme on torjuttu jäsentimessä mitattuina:

- **liitelista** — "KuulutusOsallistumis- ja arviointisuunnitelma",
  "Kaavaselostuksen liitteet Liite 1 … Liite 2 …"
- **kaavaprosessin aikataulu** — "TIIVISTELMÄ KAAVAPROSESSIN VAIHEISTA",
  "Vaihe Ajankohta Kaavoituksen käynnistäminen…"
- **sisällysluettelo** — "Asemakaavan tavoitteet …………… 32 4.5."
