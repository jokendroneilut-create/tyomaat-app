# Hyvinvointialueet lähteenä — kartoitus

Kartoitettu 1.8.2026. Tarkoitus: arvioida kannattaako 21 hyvinvointialueen
päätöksenteko lisätä discovery-putkeen, ja mitä se maksaisi. **Ei vielä
toteutettu** — tämä on päätöksen tausta-aineisto.

Sama tarkoitus kuin [`07_ZONING_SOURCES.md`](07_ZONING_SOURCES.md):lla: estää
saman selvityksen tekeminen uudelleen.

## Miksi kiinnostava

Hyvinvointialueet rakennuttavat sairaaloita, terveysasemia, hyvinvointikeskuksia
ja erityisryhmien asumisyksiköitä. Investointipäätös ja hankesuunnitelma
käsitellään aluehallituksessa **vuosia ennen** Hilman urakkakilpailutusta, eli
kriteeri [D-011](03_DECISIONS.md) (korkea signaali/kohina + aikaisempi vaihe kuin
nykylähteet) täyttyy.

Vastapaino: [`04_ROADMAP.md`](04_ROADMAP.md) asettaa lisälähteet tietoisesti P1:n
(Opportunity Engine) taakse. Tämä kartoitus ei muuta sitä päätöstä, se vain
poistaa epävarmuuden työmäärästä jos/kun asia otetaan käsittelyyn.

## Keskeinen havainto: 3 parseria kattaa 19/21

Alueet eivät ole 21 erillistä integraatiota. Ne käyttävät kolmea valmisalustaa,
joilla on jokaisella oma vakiomuotoinen URL-kielioppi — sama työmäärä kuin
kolmella kaupunkilähteellä, ei kahdellakymmenelläyhdellä.

| Alusta | Alueita | URL-kielioppi |
|---|---|---|
| **CaseM / CloudNC** | 7 | `<slug>.cloudnc.fi/fi-FI/Toimielimet/<Toimielin>/Kokous_<ddmmyyyy>` |
| **Dynasty (oncloudos)** | 7 | `<slug>.oncloudos.com/cgi/DREQUEST.PHP?page=meeting&id=<id>` |
| **Tweb / Triplan** | 5 | `<slug>-julkaisu.tweb.fi/ktwebscr/epj_tek_tweb.htm` |
| M-Files | 1 | `mfiles.ekhva.fi/kokoukset/ekhva/` |
| Ei portaalia, PDF:t omalla sivulla | 1 | `hyvaks.fi/aluehallitus` |

### CaseM / CloudNC (7)

| Alue | Osoite |
|---|---|
| Pirkanmaa | `pirha.cloudnc.fi` |
| Vantaa ja Kerava | `vakehyva.cloudnc.fi` |
| Kainuu | `kainuunhyvinvointialue.cloudnc.fi` |
| Pohjois-Pohjanmaa (Pohde) | `pohde.cloudnc.fi` (1.6.2025 alkaen; vanhat `tweb.ppshp.fi`) |
| Satakunta | `sata.cloudnc.fi` (1.1.2024 alkaen; vanhat Tweb) |
| Itä-Uusimaa | `itauusimaa.cloudnc.fi` |
| Keski-Uusimaa (Keusote) | `keuh.cloudnc.fi` |

### Dynasty / oncloudos (7)

| Alue | Osoite |
|---|---|
| Kanta-Häme (Oma Häme) | `kantahameenhva.oncloudos.com` |
| Länsi-Uusimaa | `luhva-d10julk.oncloudos.com` |
| Pohjois-Savo | `pshva.oncloudos.com` |
| Keski-Pohjanmaa (Soite) | `kpshp-hva.oncloudos.com` |
| Etelä-Savo (Eloisa) | `etala-savonhva.oncloudos.com` |
| Pohjois-Karjala (Siun sote) | `dynastyjulkaisu.pohjoiskarjala.net/vatejulk` |
| Pohjanmaa | Dynasty — tarkkaa osoitetta ei varmistettu |

### Tweb / Triplan (5)

| Alue | Osoite |
|---|---|
| Etelä-Pohjanmaa | `hyvaep-julkaisu.tweb.fi` |
| Lappi | `lapinhva-julkaisu.triplancloud.fi` (vanhat `lapha-julkaisu.tweb.fi`) |
| Kymenlaakso | `julkaisut.kymenhva.fi:8443` — huom. epästandardi portti |
| Varsinais-Suomi (Varha) | `varha-julkaisu.triplancloud.fi` |
| Päijät-Häme | `phhyky-julkaisu.tweb.fi` |

### Poikkeukset (2)

- **Etelä-Karjala** — M-Files (`mfiles.ekhva.fi/kokoukset/ekhva/`). Oma parseri
  tai jätetään pois.
- **Keski-Suomi** — ei julkaisuportaalia; esityslistat ja pöytäkirjat PDF-liitteinä
  omalla verkkosivulla (`hyvaks.fi/aluehallitus`). Vaihtoi asianhallintaa
  4.3.2024, joten sitä vanhemmat ovat eri paikassa.

## Koneluettavuus

Varmistettu Pirkanmaalta (CaseM) päästä päähän:

- Toimielinsivu listaa kaikki kokoukset vuosittain ryhmiteltynä, palvelinpuolen
  HTML:nä — ei JavaScript-riippuvuutta, ei erillistä JSON-rajapintaa.
  (`/api/opennc/v1/Meetings` → 404, eli CaseM ei tarjoa avointa APIa.)
- Kokoussivu listaa pykälät otsikoineen.
- Pykäläsivu sisältää **koko päätöstekstin HTML:nä**, liitteet PDF-linkkeinä.

Esimerkki (aluehallitus 22.6.2026, § 188): Ylöjärven Perkonmäki, 7 535 m²
tontti kehitysvammaisten asumisyksikölle, suunnitteluvaraus 2029 loppuun,
"kilpailuttaa tai rakennuttaa itse". Kunta, kohde, koko, aikataulu ja
toteutustapa suoraan tekstistä — juuri sitä mitä hankekortti tarvitsee.

## Kohina

Sama kokous sisälsi 16 pykälää, joista rakentamiseen liittyi 3 (§ 187 tila-
konseptisuunnitelma, § 188–189 asemakaavoituksen yhteistyösopimukset). Loput
olivat oikaisuvaatimuksia, palkkiosääntöjä ja valtuustoaloitteita.

Karkea mitoitus: 21 aluetta × ~20 kokousta/v × ~15 pykälää ≈ **6 000 pykälää
vuodessa**, joista ehkä 10 % relevantteja ≈ **600 hanketta/v**.

Suodatus on siis pakollinen — otsikkotason avainsanaseulonta (hankesuunnitelma,
investointi, tilahanke, peruskorjaus, uudisrakennus, asemakaava, vuokrasopimus,
toimitila) ennen kuin pykälän teksti haetaan. Tämä on eri tilanne kuin
[D-012](03_DECISIONS.md) (tontinluovutukset): siellä ongelma oli ettei siistiä
lähdettä ollut lainkaan, tässä lähde on siisti mutta laimennettu.

## Kansallinen vaihtoehto

Kaksi kertaluontoista/vuosittaista lähdettä, jotka kattavat kaikki alueet ilman
21 integraatiota:

- **Maakuntien tilakeskus**, "Selvitys hyvinvointialueiden tilainvestoinneista"
  — vuosittainen PDF, esim.
  `maakuntientilakeskus.fi/wp-content/uploads/2026/06/2026-Selvitys-hyvinvointialueiden-tilainvestoinneista_...pdf`
  (3,9 MB, PDF-sisältöä ei ehditty purkaa tässä kartoituksessa).
- **VM:n lainanottovaltuuspäätökset** — valtioneuvosto päättää alueittain, mitkä
  investoinnit saavat lainanottovaltuuden. Kertoo mitkä hankkeet oikeasti
  etenevät.

Nämä ovat matalataajuisia (kerran vuodessa) mutta erittäin korkean signaalin
lähteitä: ne listaavat nimetyt hankkeet euroineen ja vuosineen. Hyvä ensiaskel
jos halutaan tulos pienellä työllä ennen kuin 21 aluetta integroidaan.

## Avoin kysymys — miksi tätä ei ole päätetty (1.8.2026)

Perustelu "aikaisempi vaihe kuin nykylähteet" ei kestä lähempää tarkastelua.
Kartoituksen oma esimerkki (Pirkanmaa § 188) oli sopimus siitä että
**asemakaavoitus aloitetaan** — sama hanke ilmestyy Ylöjärven kaavalähteeseen
joka tapauksessa muutaman kuukauden kuluttua. Etumatka on kuukausia, ei vuosia,
ja hintana on duplikaatti katselmointijonoon.

Aito aukko on kapeampi ja koskee **kattavuutta, ei aikaa**:

- **Peruskorjaukset.** Sairaalan tai terveysaseman perusparannus ei vaadi
  kaavamuutosta, joten kaavalähteet eivät näe sitä koskaan. Hyppää suoraan
  hankesuunnitelmasta Hilmaan.
- **Vuokrahankkeet.** Yli 12 kk vuokrasopimus lasketaan investoinniksi.
  Kaavoitus näkyy rakennuttajan nimissä, ei sote-hankkeena, joten emme yhdistä
  niitä hyvinvointialueeseen.

**Tätä väitettä ei ole todennettu.** Ennen kuin yhtään parseria kirjoitetaan,
mittaa se: ota yhden alueen viimeiset 12 kk aluehallituksen pykäliä, poimi
rakentamiseen liittyvät, ja laske montako **jo on** kannassa kaavan tai Hilman
kautta. Korkea päällekkäisyys = asia on ratkaistu kielteisesti, matala = aukko
on todellinen ja kokoluokka tiedossa. Parin tunnin työ, ei vaadi parseria.

## Arvio työmäärästä

1. **Kansalliset PDF:t** (Tilakeskus + VM) — pieni. Kertaluontoinen poimija,
   ajo kerran vuodessa. Antaa heti kattavuuden kaikkiin alueisiin.
2. **CaseM-parseri** (7 aluetta) — keskisuuri, sama malli kuin nykyiset
   kaupunkilähteet: listaus → kokous → pykälä. Suurin kate/työ-suhde.
3. **Dynasty-parseri** (7 aluetta) — keskisuuri, `DREQUEST.PHP`-kielioppi vakio.
4. **Tweb-parseri** (5 aluetta) — Tweb on hakulomakepohjainen (ei suoraa
   listausta), joten työläin kolmesta. Huom. Kymenlaakson portti 8443.
5. Etelä-Karjala ja Keski-Suomi erikseen tai pois.
