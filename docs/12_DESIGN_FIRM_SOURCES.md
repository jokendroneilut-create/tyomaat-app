# Suunnittelu-, insinööri- ja arkkitehtitoimistot lähteinä

> **TILA: HARKINNASSA, ei toteuteta 28.8.2026.** Kartoitus on tehty ja
> tulokset alla, mutta yhtäkään lähdettä ei lisätä toistaiseksi. Tämä on
> tietoinen päätös eikä unohdus: älä ala toteuttaa näitä ilman että asia
> otetaan uudelleen esiin.

Kartoitettu 28.8.2026. Lähtökohta on D-131: **suunnittelija on hankkeessa
vuosia ennen urakoitsijaa** ja tietää tilaajan. Granlundilla tilaaja
löytyi 99 %:sta hankkeista — juuri se kenttä joka meiltä useimmiten
puuttuu.

Kysymys oli, onko toimialalla muita yhtä hyviä lähteitä. Vastaus on
kyllä, mutta ei niin montaa kuin toivoi.

Mittausskriptit: `scripts/probe-design-firms.ts` (ehdokkaiden seulonta)
ja `scripts/measure-design-firm-yield.ts` (kesken olevien määrä).

---

## Yhteenveto: 40 tutkittua, 5 käyttökelpoista

| Lähde | Hankkeita | Kesken | Tilaaja | Sijainti | Aika | Laajuus | Rakenne |
|---|---|---|---|---|---|---|---|
| **JKMM** | 236 | ~8 | ✔ | ✔ | ✔ | ✔ | taksonomia |
| **SARC Sigge** | 226 | ~5 | 97 % | 100 % | 93 % | 83 % | proosa |
| **Ideastructura** | 119 | 8 | 100 % | 77 % | 57 % | 57 % | nimiöity |
| **Maaskola** | 93 | 6 | 23 % | 17 % | 73 % | 57 % | nimiöity |
| **Indepro** | 128 | 0 | ✔ | otsikossa | ✔ | – | nimiöity |
| *(Granlund, D-131)* | *211* | *6* | *99 %* | *100 %* | *98 %* | *73 %* | *nimiöity* |

"Kesken" on ainoa luku joka ratkaisee löytölähteen arvon. JKMM:n ja SARC
Siggen luvut on puolitettu, koska sivustot ovat kaksikielisiä ja sama
hanke esiintyy kahdesti (esim. "Hotel Kämp" ja "Museum of History and
the Future" molemmilla kielillä).

**Yksikään ei ole iso lähde.** Jokainen antaisi 5–8 kesken olevaa
hanketta, eli saman verran kuin Granlund. Yhteensä nämä viisi tuottaisivat
noin 25–30 uutta hanketta — ja sen lisäksi ~800 valmista hanketta
rikastusaineistoksi.

---

## Käyttökelpoiset lähteet

### JKMM Arkkitehdit — paras rakenne

`jkmm.fi/wp-json/wp/v2/work` · 236 hanketta · robots sallii

Tiedot eivät ole kuvauksessa lainkaan (`content` on tyhjä tai pelkkä
"© JKMM") vaan **taksonomioina**, mikä on paras mahdollinen muoto: HTML:ää
ei tarvitse jäsentää ollenkaan.

```
work-client     tilaaja        (esim. Aalto-yliopisto)
work-location   kaupunki       (Helsinki 62, Espoo 6, ...)
work-status     aikataulu      ("2022 – 2023" valmis, "2025 -" kesken)
work-scale      laajuus        ("12 900 m2")
work-typology   käyttötarkoitus
work-scope      suunnittelun laajuus
```

`work-status` erottelee kesken olevat suoraan: avoin muoto `"2025 -"`
tarkoittaa käynnissä olevaa. Avoimia termejä on 11 ja niissä 16
hankeviittausta, mistä kaksikielisyys puolittaa noin kahdeksaan.

Huomioitava: kaikki termit ovat kahtena (fi/en), ja `work-location`
sisältää myös ulkomaat (Dubai, Shenzhen, Göteborg), jotka on suodatettava.

### SARC Sigge Arkkitehdit — paras kenttäkattavuus

`sarcsigge.fi/wp-json/wp/v2/projects` · 226 hanketta · robots sallii

**SARC ja Sigge ovat yhdistyneet** — molemmat verkkotunnukset (`sarc.fi`,
`sigge.fi`) johtavat samaan sivustoon `sarcsigge.fi`. Kartoituksessa ne
näyttivät kahdelta lähteeltä identtisin luvuin, mikä paljasti asian.

Kuvauksen mediaani 1554 merkkiä ja kenttäkattavuus on Granlundin luokkaa:
tilaaja 97 %, sijainti 100 %, aika 93 %, laajuus 83 %. Tiedot ovat
proosassa, joten poimija on työläämpi kuin JKMM:llä.

Kesken olevia löytyi 8, joista kaksikielisyyden jälkeen noin 5 — mm.
Apollo (Eteläesplanadi 10), Hotel Kämp ja Historian ja tulevaisuuden museo.

### Ideastructura — siistein nimiöinti

`www.ideastructura.com/wp-json/wp/v2/reference` · 119 hanketta · robots sallii

**Huom: verkkotunnus on `.com`, ei `.fi`** — `.fi` ei vastaa lainkaan.

Kentät ovat nimiöityjä ja lyhyitä, mikä tekee poimijasta helpon:

```
Rakennustyyppi: Teollisuusrakennus
Palvelut : Uudisrakennesuunnittelu
Ajankohta : 2026
Asiakas: Lappeenrannan Toimitilat Oy, Lappeenrannan kaupunki
```

Tilaaja löytyy 100 %:sta. Koko aineisto on julkaistu 2025–2026, ja
ajankohta 2026 tai myöhemmin osuu 8 hankkeeseen: Danfoss (Lappeenranta),
Kaunisnurmen päiväkoti (Kouvola), Penope toimitilat (Lahti), Voiska-talo
(Lappeenranta) ja Elmo Areena (Vantaa) mukaan lukien.

**Ideastructura täydentää maantieteellisesti**: painopiste on
Kaakkois-Suomessa ja Lahden seudulla, missä muut lähteemme ovat ohuita.

### Maaskola — heikompi, mutta tuore

`www.maaskola.fi/wp-json/wp/v2/referenssi` · 93 hanketta · robots sallii
(vain `/wp-admin/` ja uploads kielletty)

Tilaaja vain 23 %:ssa ja sijainti 17 %:ssa, mutta 28/30 otoksesta on
julkaistu 2025 tai myöhemmin. Kesken olevia noin 6. Kannattaa ottaa vasta
kolmen edellisen jälkeen.

### Indepro — rakennuttajakonsultti, mutta vanhentunut

`www.indepro.fi/wp-json/wp/v2/referenssi` · 128 hanketta · ei robots.txt

REST palauttaa tyhjän kuvauksen; tiedot ovat itse sivulla nimiöityinä
(`Assignment:` / `Client:` / `Completion:`), eli poimija vaatii
kohdesivun haun kuten Taivassalossa (D-130).

**Aineisto on kuitenkin vanhaa**: otoksen julkaisuvuodet 2018–2023, ei
yhtään vuodelta 2025 tai 2026. Rakennuttajakonsulttina Indepro tietäisi
aikataulut parhaiten, mutta sivusto ei ole ajan tasalla. Ei kannata nyt.

---

## Hylätyt ja miksi

### Ei koneluettavaa hankeluetteloa (isot monialatoimistot)

Ramboll, Sitowise, AFRY, WSP, A-Insinöörit ja Sweco eivät tarjoa
hankeluetteloa rajapinnassa. Nämä ovat toimialan suurimpia, joten
menetys on tuntuva — mutta niiden sivustot ovat kansainvälisiä
julkaisualustoja, joissa Suomen hankkeet eivät ole omana tyyppinään.

Swecolla oli `showroom_cpt` (301 kpl), mutta sisältö osoittautui
markkinointiaineistoksi (esim. "Alltech Fennoaquan vastuullisuusraportti"),
ei hankeluetteloksi.

### Robots.txt kieltää

**Haahtela** kieltää `/wp-json/`-polun. Ei tutkittu pidemmälle eikä
oteta käyttöön. Sama linja kuin Hyvinkäällä ja Vantaalla.

### WordPress löytyi, hankesisältöä ei

ALA, Verstas, NRT, Lukkaroinen, Playa, Konstru, Vison ja Rejlers
julkaisevat vain sivuja ja uutisia — referenssit ovat sivupohjissa, eivät
omana sisältötyyppinään.

### Liian pieni tai liian vanha

- **K2S**: 11 hanketta, kaikki julkaistu 2020, kenttäkattavuus hyvä mutta
  aineisto pysähtynyt.
- **Ark-byroo**: 49 hanketta, hyvin nimiöity (`Sijainti / Toimeksianto /
  Tilaaja / Suoritusajankohta / Laajuus`), mutta toimeksiannot ovat
  rakennushistoriaselvityksiä ja laserkeilauksia — ei rakennushankkeita.

### Ei vastannut lainkaan

Projectus Team, Serum, Lahdelma & Mahlamäki, Parviainen, Arkkitehdit m3,
Arkkitehtiryhmä A6, Vahanen, Wise Group, Optiplan, Anttinen Oiva,
Huttunen-Lipasti, HKP, PES, Uki, HTJ, Prodeco, Hepacon.

Osalla verkkotunnus on eri kuin kokeiltu ja osa on ilman WordPressiä.
Nämä voi tarkistaa uudelleen, jos kolme kärkilähdettä osoittautuvat
arvokkaiksi.

---

## Johtopäätös

Suunnittelutoimistot **eivät ole löytölähteitä vaan rikastuslähteitä**.
Jokainen antaa vain kourallisen kesken olevia hankkeita, koska ne
julkaisevat referenssejä vasta kun työ on valmis tai pitkällä.

Arvo on kahdessa asiassa:

1. **Tilaaja.** Se on hankkeen maksaja ja meiltä useimmiten puuttuva
   kenttä. JKMM, SARC Sigge ja Ideastructura antavat sen lähes aina.
2. **Varhainen tieto.** Suunnittelija on mukana ennen urakoitsijaa, joten
   hanke näkyy näissä ennen Hilmaa ja lupapäätöksiä.

Rikastuksen este on täsmäytys, ja se on mitattu vaikeaksi (D-132):
Granlundin 204 hankkeesta vain yksi täsmäytyi turvallisesti. Sama
ongelma koskee näitä kaikkia, ja se kannattaa ratkaista ennen kuin
lähteitä lisätään.

**Suositeltu järjestys:**

1. **JKMM** — taksonomiarakenne tekee poimijasta helpoimman, ja
   `work-status` erottelee kesken olevat itse.
2. **Ideastructura** — siisti nimiöinti ja maantieteellinen täydennys
   Kaakkois-Suomeen.
3. **SARC Sigge** — paras kenttäkattavuus, mutta proosan jäsennys on työ.
4. Maaskola ja Indepro vasta, jos edelliset kannattivat.
