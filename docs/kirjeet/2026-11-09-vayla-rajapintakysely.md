# Sähköpostiluonnos Väylävirastolle 9.11.2026

**Vastaanottaja:** paikkatieto@vayla.fi
*(Väylän oma osoite "tiedustelut paikkatietoaineistoista"; sivulla
vayla.fi/vaylista/aineistot/avoindata/rajapinnat)*

**Kopio (valinnainen):** minna.huovinen@vayla.fi
*(sivulla nimetty avoimen datan asiantuntija; sivu ilmoittaa
osoitemuodoksi etunimi.sukunimi@vayla.fi, eli tämä on pääteltu — jätä
pois jos et halua arvata)*

**Aihe:** Hankesivujen haku estynyt + kaksi kysymystä avoimen datan hankeaineistosta

---

Hei,

olen Johannes Sippola ja ylläpidän Työmaat.fi-palvelua, joka kokoaa
julkisista lähteistä tiedon Suomessa käynnissä ja suunnitteilla
olevista rakennushankkeista. Palvelu näyttää hankkeen tiedot ja linkin
aina alkuperäiseen lähteeseen. Väyläviraston hankkeet ovat olleet
mukana vuodesta 2026, ja niitä on tietokannassamme noin 270.

Kolme lyhyttä kysymystä.

**1. Hankesivujen haku alkoi palauttaa 403 Forbidden lokakuussa.**

Palvelimemme hakee osoitteen
`vayla.fi/suunnittelu-rakentaminen/-/project/c/35402106-35402107` ja
sen alta muutaman hankesivun. Haku on toiminut noin vuoden, mutta
17.10.2026 alkaen vastaus on ollut 403 Forbidden. Sama pyyntö onnistuu
normaalisti suomalaisesta kotiliittymästä, joten kyse vaikuttaa olevan
ulkomaisiin pilvipalvelinosoitteisiin kohdistuvasta suodatuksesta —
palvelumme toimii Vercelin konesalissa Ruotsissa.

Onko esto tarkoituksellinen? Jos se on yleinen suojaussääntö eikä
koske meitä erikseen, voisiko palvelimemme pyynnöt sallia? Haemme
korkeintaan muutaman sivun vuorokaudessa, emmekä kuormita sivustoa.
Jos esto on tarkoituksellinen, kerrothan sen — lopetamme hakemisen
välittömästi.

**2. Avoimesta rajapinnasta puuttuu kaksi tietoa, joita käyttäjämme
kysyvät eniten.**

Löysimme avoimen WFS-rajapinnan
(`avoinapi.vaylapilvi.fi/vaylatiedot/ows`, tasot `hanketiedot:*`), ja
se on meille erinomainen: se kattaa selvästi enemmän hankkeita kuin
verkkosivujen listaus, ja kuvaus, vaihe sekä suunnitteluaikataulu ovat
mukana.

Kaksi puutetta:

- **Kustannusarvio** on kenttänä olemassa (`kustannusarvio`,
  `kust_arvio`) mutta tyhjä kaikilla riveillä — tarkistimme 9.11.2026
  tasot `tiehankkeet` (369), `ratahankkeet` (167), `tiesuunnitelmat`
  (573), `ratasuunnitelmat` (272) ja `paattyneet_hankkeet` (632), eli
  yhteensä 2 013 riviä, joista täytettyjä 0.
- **Yhteyshenkilöä** ei ole missään tasossa, vaikka se löytyy
  hankesivuilta.

Onko näitä tietoja saatavissa jotakin muuta kautta, vai voisiko ne
sisällyttää aineistoon? Molemmat ovat juuri sitä tietoa, jota
rakennusalan yritykset kysyvät eniten.

**3. Onko avoin rajapinta tarkoitettu myös palvelinkäyttöön?**

Haluamme varmistaa, että automaattinen haku `avoinapi.vaylapilvi.fi`-
osoitteesta on toivottua käyttöä, ja millaista hakutahtia pidätte
sopivana. Aineisto päivittyy sivunne mukaan viikoittain, joten
suunnittelimme hakevamme kerran vuorokaudessa.

Kiitos jo etukäteen. Vastaan mielelläni tarkentaviin kysymyksiin
siitä, miten käytämme aineistoa.

Ystävällisin terveisin

Johannes Sippola
Työmaat.fi
[puhelin]
[sähköposti]
https://www.tyomaat.fi

---

## Muistiinpanot (ei lähetetä)

- Osoitteet on purettu sivun Cloudflare-suojauksen takaa; ne ovat
  Väylän itsensä julkaisemia yhteysosoitteita.
- Kysymys 1 on muotoiltu niin, ettei se pyydä poikkeusta sääntöihin
  vaan selvitystä siitä onko esto tarkoitettu. Jos vastaus on "älkää
  hakeko", `lib/agent/kielletytLahteet.ts` saa uuden rivin.
- Kysymys 2 on se arvokkain: kustannusarvio ja yhteyshenkilö ovat
  kentät, joita ei saa mistään rajapinnasta — myöskään kilpailijat
  eivät saa niitä koneellisesti, vaan soittamalla.
- Kysymys 3 ratkaisee tuotannon eston rajapinnan osalta: jos
  `avoinapi.vaylapilvi.fi` toimii Vercelistä, hankelistaa ei tarvitse
  hakea verkkosivulta lainkaan.
