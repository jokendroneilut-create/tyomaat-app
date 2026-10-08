/*
 * Hankkeen pinta-ala vapaasta tekstistä.
 *
 * `floor_area` on ollut olemassa kenttänä ja näkyy asiakkaalle, mutta
 * mikään ei ole kirjoittanut siihen mitään tekstistä — sama tilanne kuin
 * kustannusarviossa ennen D-161:tä. Mitattu 5.9.2026: näkyvistä 5 871
 * hankkeesta **601 mainitsee pinta-alan kuvauksessaan ja vain 138:lla
 * kenttä on täytetty**.
 *
 * YKSIKKÖ ON VAHVIN ANKKURI. `brm²` (bruttoneliömetri) tarkoittaa
 * määritelmällisesti rakennuksen bruttoalaa, joten sitä ei tarvitse
 * ankkuroida lauseeseen lainkaan — luku sen edessä on hankkeen ala.
 * Mitattu: 110 riviä, ja luettuna kaikki olivat rakennuksia
 * ("yksikerroksinen palvelukeskus on noin 1 700 brm²").
 *
 * PALJAS "PINTA-ALA" ON MAA-ALAA. Se on aineiston yleisin muoto (124
 * riviä) mutta valtaosin väärä: "Suunnittelualueen pinta-ala on 10 300
 * m²", "Puiston pinta-ala on 24 400 m²", "ranta-alueen pinta-ala on
 * 58 000 m²". Sitä ei poimita.
 *
 * MYÖSKÄÄN NÄITÄ EI POIMITA, ja jokainen on luettu aineistosta:
 *
 *   rakennusoikeus 155 000 k-m2      kaavan sallima, ei rakennettava
 *   pohjapinta-ala 191 m²            kerroksen ala, ei koko rakennuksen
 *   kattoalueen kokonaispinta-ala    korjattava katto, ei rakennus
 *   asuntojen keskipinta-ala 54,5 m2 asunnon koko
 *   kooltaan noin 6 300 m² (puisto)  maa-ala
 *
 * "kooltaan" jätettiin kokonaan pois, vaikka siinä on myös oikeita
 * osumia ("jakelukeskus on kooltaan noin 30 000 neliömetriä"): 17
 * rivistä noin puolet oli maa-alaa, eikä sanasta itsestään voi päätellä
 * kummasta on kyse.
 */

/* Luku ryhmittelijöineen: "6 921", "10 300", "3212". */
const LUKU = String.raw`(\d{1,3}(?:[\s .]\d{3})+|\d+)(?:[.,]\d+)?`

/* Yksiköt joissa ala voi olla. */
const YKSIKKO = String.raw`(?:m2|m²|neliömetri\w*|neliötä)`

/* Pehmentimet luvun edessä. */
const HEDGE = String.raw`(?:noin\s*|n\.\s*|arviolta\s+|cirka\s+|ca\.?\s*)?`

/*
 * RAKENNUSSANA TEKEE "KOOLTAAN"-MUODOSTA LUETTAVAN (D-250).
 *
 * Yllä oleva kommentti kertoo miksi "kooltaan" jätettiin pois: 17
 * rivistä noin puolet oli maa-alaa. Uusi mittaus 8.10.2026 koko
 * aineistosta (41 uniikkia osumaa) nayttaa etta yleisin vaara osuma ei
 * olekaan maa-ala vaan ASUNTOJEN KOOT, ja ne erottaa kahdesta asiasta:
 *
 *   vali­viiva   "kooltaan 42–160,5 neliömetriä"   = asuntojen vaihteluvali
 *   pieni luku  "kooltaan 105 m²"              = yksi asunto tai mökki
 *
 * Rakennusten alat aineistossa ovat 1 100–34 996 m², asuntojen
 * 24–160 m². Siksi tama ankkuri vaatii kolme asiaa yhdessa:
 * rakennusta tarkoittava sana, ei vaihteluvalia, ja vahintaan 300 m².
 *
 * Mitattu tapaus: "Kooltaan noin 2 600 neliömetrin koti" (Attendon
 * hoivakoti Oulussa) ja "Kooltaan hoivakoti on noin 2 600 m²" — sama
 * hanke kahdessa muodossa, kumpikaan ei osunut.
 */
const RAKENNUS = String.raw`(?:uudisrakennu\w*|rakennu(?:s|kse)\w*|hoivakoti\w*|koti|kodin|talo\w*|halli\w*|keskus\w*|koulu\w*|päiväkoti\w*|varasto\w*|navetta\w*|navetan|terminaali\w*|toimitila\w*|myymälä\w*|laitos\w*|hotelli\w*|sairaala\w*|tuotantotila\w*)`

/* Vaihteluvali kertoo asunnoista, ei rakennuksesta. */
const VAIHTELUVALI = /\d\s*[–—-]\s*\d/

const KOOLTAAN_MIN_M2 = 300

/*
 * Ankkurit järjestyksessä. Ensimmäinen osuma voittaa, joten vahvin
 * (yksikkö itse) on ensimmäisenä.
 */
const ANKKURIT: RegExp[] = [
  /* "1 700 brm²" — yksikkö kertoo jo että kyse on rakennuksesta. */
  new RegExp(String.raw`${LUKU}\s*(?:brm2|brm²|br-m2|brm\b)`, "i"),

  /*
   * "noin 5 600 bruttoneliömetriä" — sama todiste kuin brm², vain auki
   * kirjoitettuna. Tämä puuttui: mitattu 12.9.2026, sana esiintyy 97
   * jonorivillä eikä YHDELLÄKÄÄN niistä ollut alaa, ja 47 hankkeesta
   * 26:lta se puuttui.
   *
   * Osittainen osuus ("Tullin käyttöön tulee noin 650 bruttoneliömetrin
   * suuruinen osuus") menisi tästä läpi, mutta ankkureista voittaa
   * ensimmäinen osuma ja koko hankkeen ala mainitaan tekstissä ensin.
   * Sama riski on ollut brm²-muodossa alusta asti.
   */
  new RegExp(String.raw`${LUKU}\s*brutto-?neliö\w*`, "i"),

  /* "Koko hankkeen bruttoala on 4 604 m²", ruotsiksi "bruttoyta". */
  new RegExp(String.raw`bruttoala\w*\s+(?:on\s+)?${HEDGE}${LUKU}\s*${YKSIKKO}`, "i"),
  new RegExp(String.raw`omfattar\s+${HEDGE}${LUKU}\s*${YKSIKKO}\s*bruttoyta`, "i"),

  /* "hankkeen laajuus on 3 745 m²" */
  new RegExp(String.raw`laajuus\w*\s+(?:on\s+)?${HEDGE}${LUKU}\s*${YKSIKKO}`, "i"),

  /* "Rakennusten kokonaiskerrosala on 3 600 m²" */
  new RegExp(String.raw`kerrosala\w*\s+(?:on\s+)?${HEDGE}${LUKU}\s*${YKSIKKO}`, "i"),

  /* "Laitoksen kokonaispinta-ala on noin 600 neliömetriä" */
  new RegExp(String.raw`kokonaispinta-ala\w*\s+(?:on\s+)?${HEDGE}${LUKU}\s*${YKSIKKO}`, "i"),

  /*
   * "Kooltaan hoivakoti on noin 2 600 m²" ja
   * "Kooltaan noin 2 600 neliömetrin koti" — rakennussana voi olla
   * luvun kummalla puolella tahansa, ja toinen niistä riittää.
   * Ehdot tarkistetaan erikseen (ks. KOOLTAAN_MIN_M2, VAIHTELUVALI).
   */
  new RegExp(
    String.raw`kooltaan\s+(?:[\w\s]{0,40}?${RAKENNUS}\s+(?:on\s+)?)?${HEDGE}${LUKU}\s*${YKSIKKO}n?(?:\s+(?:suuruinen\s+)?${RAKENNUS})?`,
    "i"
  ),
]


/*
 * Esteet luetaan osuman EDESTÄ. Kaikki torjuttavat muodot ovat luvun
 * edellä ("suunnittelualueen pinta-ala on ..."), joten ikkuna päättyy
 * osumaan — sama ratkaisu kuin kustannuspoimijassa, jossa jälkeenpäin
 * katsominen torjui kelvollisia rivejä.
 */
const EI_RAKENNUS =
  /suunnittelualue|kaava-alue|asemakaava-alue|tonti[nt]|puiston|puistoalue|ranta-alue|viheralue|katualue|kattoalue|pohjapinta-ala|keskipinta-ala|rakennusoikeu|asunto\w*\s+keski|huoneistoala/i

/* Rakennushanke ei ole neliömetrin kokoinen eikä sadan hehtaarin. */
const MIN_M2 = 20
const MAX_M2 = 500_000

export function extractFloorAreaFromText(
  text: string | null | undefined
): number | null {
  if (!text) return null

  for (const ankkuri of ANKKURIT) {
    const match = text.match(ankkuri)
    if (!match) continue

    const at = match.index ?? 0
    const ennen = text.slice(Math.max(0, at - 60), at + match[0].length)
    if (EI_RAKENNUS.test(ennen)) continue

    /* "kooltaan" on sallittu vain tiukoin ehdoin, ks. kommentti ylla. */
    const kooltaan = /^kooltaan/i.test(match[0])
    if (kooltaan && VAIHTELUVALI.test(match[0])) continue
    if (kooltaan && !new RegExp(RAKENNUS, "i").test(match[0])) continue

    /* Ryhmittelijät pois; desimaalit eivät kiinnosta neliöissä. */
    const raaka = String(match[1] ?? "").replace(/[\s .]/g, "")
    const arvo = Number(raaka)
    if (!Number.isFinite(arvo)) continue
    if (arvo < MIN_M2 || arvo > MAX_M2) continue
    if (kooltaan && arvo < KOOLTAAN_MIN_M2) continue

    return Math.round(arvo)
  }

  return null
}

/*
 * LOMAKEKENTAN ARVO NUMEROKSI.
 *
 * Lupapisteen kuulutus-PDF:ssa ala on omana kenttanaan ("Kerrosala",
 * "Kokonaisala"), ja arvo tallentuu merkkijonona sellaisena kuin se
 * PDF:sta luettiin. Yksikko on erillaan vaihtelevasti, koska
 * PDF-jasennys rikkoo valilyonnit: "96 m 2", "182 m²", "91m 2",
 * "1471 m 2".
 *
 * Tama EI ole tekstipoiminta vaan kentan lukeminen: lause-ankkureita ei
 * tarvita, koska lomake on jo kertonut mika luku on kyseessa.
 */
export function parseAlaTeksti(arvo: string | null | undefined): number | null {
  const teksti = String(arvo ?? "").trim()
  if (!teksti) return null

  /* Luku ennen yksikkoa; ryhmittelija voi olla vali tai piste. */
  const osuma = teksti.match(/(\d{1,3}(?:[\s .]\d{3})+|\d+)(?:[.,]\d+)?\s*m\s*[²2]/i)
  if (!osuma) return null

  const luku = Number(String(osuma[1]).replace(/[\s .]/g, ""))
  if (!Number.isFinite(luku)) return null
  if (luku < MIN_M2 || luku > MAX_M2) return null

  return Math.round(luku)
}
