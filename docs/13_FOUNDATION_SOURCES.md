# Opiskelija-asuntosäätiöt lähteinä

Kartoitettu 29.8.2026. Heräte oli hyväksytty hanke Rakennuslehdestä:
HOAS rakentaa Helsinkiin 402 uutta opiskelija-asuntoa, lähes 60 M€.
**Tieto tuli meille kiertotietä lehden kautta, vaikka rakennuttaja itse
tiedotti sen** — ja tiedote löytyy HOASin omasta rajapinnasta.

Nämä ovat rakennuttajia, eivät urakoitsijoita eivätkä suunnittelijoita.
Ne tiedottavat kun investointipäätös on tehty, siis ennen
urakkakilpailua, ja rakennuttaja on tiedossa määritelmän nojalla.

Mittausskriptit: `scripts/probe-foundation-sources.ts` (seulonta) ja
`scripts/measure-foundation-yield.ts` (hanketiedotteiden tuotto).

---

## Lista on lähteestä, ei muistista

Jäsenluettelo haettiin **SOA ry:n (Suomen opiskelija-asunnot) sivulta**,
joka listaa jäsentensä verkkotunnukset. Näin kartoitus on täydellinen
eikä sen varassa mitä sattui muistamaan — sama periaate kuin
RPT-listalla: puuttuvasta toimijasta päätellään puuttuva lähde.

27 asuntotoimijaa. **Yksikään robots.txt ei kiellä lukemista.**

---

## Seulonnan tulos: 16 / 27 tarjoaa koneluettavan tiedotevirran

| Toimija | Seutu | Tiedotteita | Huom |
|---|---|---|---|
| Soihtu (JYY) | Jyväskylä | 734 | |
| TYS | Turku | 501 | ks. sivutusvika alla |
| HOAS | Helsinki | 362 | |
| PSOAS | Oulu | 306 | |
| POAS | Kuopio | 142 | |
| KOAS | Jyväskylä | 127 | tyyppi on `news`, ei `posts` |
| Lahden Talot | Lahti | 88 | |
| Sevas | Seinäjoki | 84 | |
| Savonlinnan Asuntopalvelu | Savonlinna | 73 | = SAO, sama sivusto |
| AYY Asunnot | Espoo | 47 | |
| Kajaanin Pietari | Kajaani | 44 | |
| Kuopas | Kuopio | 40 | |
| JYY | Jyväskylä | 31 | edunvalvontaa, ei hankkeita |
| VOAS | Vaasa | 11 | |
| Joensuun Elli | Joensuu | 9 | |

**SAO ja Savonlinnan Asuntopalvelu ovat sama sivusto.** Paljastui
identtisistä luvuista ja varmistui julkaisutunnisteista — sama ansa
kuin SARC/Sigge suunnittelutoimistoissa (`12_DESIGN_FIRM_SOURCES.md`).
Kummankin lisääminen tuottaisi jokaisesta hankkeesta kaksoiskappaleen.

**Ei koneluettavaa tiedotevirtaa:** LOAS, DAS, Porin YH-Asunnot, HOPS,
AYY Domo (ei WP-rajapintaa) · TOAS, Otokylä (WP löytyi, ei
tiedotetyyppiä) · MOAS, Kotopas, Oppilastalo (ei vastannut) ·
Marttilan Kortteeri (rajapinta ei palauta JSONia).

TOAS on näistä tuntuvin menetys: Tampere on iso opiskelijakaupunki.

---

## Todellinen tuotto: noin 3–6 hanketiedotetta vuodessa toimijaa kohti

**Hakusanalaskenta yliarvioi 3–5-kertaisesti.** Ensimmäinen mittaus
antoi HOASille 14,7 osumaa vuodessa, mutta osumat luettuna rivi riviltä
suurin osa oli henkilöstöesittelyjä ("Anna Lassus – Hoasilla on saanut
tehdä kaikenlaisia töitä") ja vuokramarkkinointia ("Unelmakämppä
kaverin kanssa?"). Sana "rakenta" esiintyy niissä sivulauseessa.

Aidot hanketiedotteet luettuna otoksesta:

**AYY Asunnot (Espoo) — paras tarkkuus.** Otakaari 15 kulkee koko
elinkaaren läpi omina tiedotteinaan: ensihaku → taidekilpailu →
harjannostajaiset → valmistui. Lisäksi kiinteistökaupat ("AYY on
myynyt Tuhkimontie 2 -kiinteistön HKA kiinteistöt Oy:lle"), jotka ovat
oma signaalinsa.

**Lahden Talot (Lahti).** Katuosoitteet mukana, mikä helpottaa
täsmäytystä: "Pohjoinen Liipolankatu 14:n uudistaminen alkaa",
"Svinhufvudinkadun korttelin kolmaskin talo alkaa rakentumaan",
"Laatikkotehtaankadun opiskelijatalot ovat valmiina".

**TYS (Turku).** "Kylänkulman rakennustyöt ovat alkaneet" (27.8.2026),
"Yo-kylä 1 A ja B-talojen remontti on valmistunut".

**KOAS (Jyväskylä) — varhaisin signaali.** "Koas on solminut
aiesopimuksen uuden kohteen rakentamisesta Kukkulan alueelle". Tämä on
aiesopimusvaihe, eli kaukana ennen urakkakilpailua.

**HOAS (Helsinki).** Volyymi on suurin mutta osuma-aste huonoin.
Aidot: 402 asunnon investointi, "Pääkaupunkiseudun suurin
opiskelijatalo avasi ovensa".

**PSOAS, POAS, Kuopas, Sevas, VOAS** tuottavat kukin muutaman
vuodessa. **JYY, Kajaanin Pietari ja Joensuun Elli** eivät käytännössä
tuota hankkeita — JYY:n sisältö on edunvalvontaa.

---

## Toteutuksen yksityiskohtia

- **KOAS käyttää tyyppiä `news`**, ei `posts`. Yhden lähteen kohdalla
  oletus `posts` olisi tuottanut tyhjän.
- **TYS kaatuu isoon sivukokoon.** `per_page=100` ja `50` palauttavat
  vajaan JSONin; `20` toimii. Kerääjä on rajattava.
- Tiedotteista on tunnistettava hanke ilman että henkilöstöesittelyt
  menevät läpi. Pelkkä sana "rakenta" ei riitä — vaaditaan teko
  (rakennustyöt alkavat, valmistui, aiesopimus, harjannostajaiset).

---

## Johtopäätös

Yksi säätiö tuottaa vähän, mutta **virta on jatkuvaa ja aikaista**, ja
siinä ne eroavat suunnittelutoimistoista (D-132): Granlund antoi kuusi
kesken olevaa hanketta kertaluontoisesti, nämä antavat muutaman
vuodessa mutta joka vuosi, ja rakennuttaja on aina tiedossa.

Yhteensä noin **40–60 aitoa hanketiedotetta vuodessa** koko joukosta.

Hankkeet ovat pieniä yhden talon kohteita, mutta niissä on kolme
poikkeuksellista piirrettä: rakennuttaja on tiedossa, aikataulu
kerrotaan, ja moni tiedote sisältää katuosoitteen — joka on paras
täsmäytysavain mitä meillä on.

**Suositeltu järjestys:**

1. **AYY Asunnot** — paras osuma-aste ja koko hankkeen elinkaari.
2. **Lahden Talot** — katuosoitteet mukana.
3. **TYS** — nimesit itse; sivutusrajoitus huomioitava.
4. **KOAS** — aiesopimusvaihe on varhaisin signaali mitä olemme nähneet.
5. **HOAS** — suurin volyymi, mutta vaatii tiukimman suodatuksen.

Ennen toteutusta on ratkaistava sama asia kuin suunnittelutoimistoilla:
**täsmäytys olemassa oleviin** (D-132). Katuosoite tekee siitä täällä
helpompaa kuin Granlundilla, jolla oli vain kaupunki.

---

## Ylioppilaskunnat ja niiden kiinteistöyhtiöt: EI kelpaa lähteeksi

Kartoitettu erikseen 29.8.2026, koska ne eivät ole SOA ry:n jäseniä ja
omistavat kiinteistöjä suoraan tai yhtiönsä kautta. 13 toimijaa.

**Tulos on kielteinen, ja syy on rakenteellinen.** Ylioppilaskunnan
verkkoviestintä on edunvalvontaa ja opiskelijaelämää, ei
rakennuttamista — vaikka kiinteistöomistus olisi merkittävä.

| Toimija | Tiedotteita | Hankeosumia |
|---|---|---|
| YTHS | 1038 | 0 / 20 |
| Åbo Akademis Studentkår | 607 | 0 / 20 |
| TREY | 1482 | 5 / 20, kaikki uutiskirjeitä ja apurahoja |
| LTKY | 514 | 4 / 20, tilannekatsauksia |
| LYY | 271 | 10 / 20, kaikki lausuntoja ja jäsenkirjeitä |

Osumat luettuna rivi riviltä **yksikään ei ollut hanketiedote.**

**HYY Yhtymän oma sivusto on lakannut olemasta.** Se oli näistä
ylivoimaisesti suurin kiinteistönomistaja (mm. Kaivopiha, Uusi
ylioppilastalo). `hyy-yhtyma.fi` ohjaa nykyään `hyy.fi`:hin, jolla on
vain 139 sivua eikä tiedotetyyppiä lainkaan. Tätä ei siis voi lukea
koneellisesti millään tavalla.

Ilman WP-rajapintaa jäivät myös AYY, TYY, ISYY, VYY, OYY ja
Teknologföreningen.

**RSS ei pelasta ketään.** Tarkistettu erikseen molemmista ryhmistä,
koska rajapinnan puuttuminen ei sulje syötettä pois: TOASin `/feed` on
tyhjä, LOASin viimeisin merkintä on vuodelta **2019** ja TYY:n
**2022**. Vanhentunut syöte on huonompi kuin ei syötettä lainkaan,
koska se näyttää toimivalta.

**Johtopäätös: ylioppilaskuntia ei oteta lähteiksi.** Ainoa poikkeus on
jo mukana asuntopuolella: AYY Asunnot ja Soihtu (JYY) julkaisevat
hanketiedotteita, koska ne hoitavat nimenomaan asuntokantaa.
