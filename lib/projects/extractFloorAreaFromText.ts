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
 * Ankkurit järjestyksessä. Ensimmäinen osuma voittaa, joten vahvin
 * (yksikkö itse) on ensimmäisenä.
 */
const ANKKURIT: RegExp[] = [
  /* "1 700 brm²" — yksikkö kertoo jo että kyse on rakennuksesta. */
  new RegExp(String.raw`${LUKU}\s*(?:brm2|brm²|br-m2|brm\b)`, "i"),

  /* "Koko hankkeen bruttoala on 4 604 m²", ruotsiksi "bruttoyta". */
  new RegExp(String.raw`bruttoala\w*\s+(?:on\s+)?${HEDGE}${LUKU}\s*${YKSIKKO}`, "i"),
  new RegExp(String.raw`omfattar\s+${HEDGE}${LUKU}\s*${YKSIKKO}\s*bruttoyta`, "i"),

  /* "hankkeen laajuus on 3 745 m²" */
  new RegExp(String.raw`laajuus\w*\s+(?:on\s+)?${HEDGE}${LUKU}\s*${YKSIKKO}`, "i"),

  /* "Rakennusten kokonaiskerrosala on 3 600 m²" */
  new RegExp(String.raw`kerrosala\w*\s+(?:on\s+)?${HEDGE}${LUKU}\s*${YKSIKKO}`, "i"),

  /* "Laitoksen kokonaispinta-ala on noin 600 neliömetriä" */
  new RegExp(String.raw`kokonaispinta-ala\w*\s+(?:on\s+)?${HEDGE}${LUKU}\s*${YKSIKKO}`, "i"),
]

/*
 * Esteet luetaan osuman EDESTÄ. Kaikki torjuttavat muodot ovat luvun
 * edellä ("suunnittelualueen pinta-ala on ..."), joten ikkuna päättyy
 * osumaan — sama ratkaisu kuin kustannuspoimijassa, jossa jälkeenpäin
 * katsominen torjui kelvollisia rivejä.
 */
const EI_RAKENNUS =
  /suunnittelualue|kaava-alue|asemakaava-alue|tonti[nt]|puiston|puistoalue|ranta-alue|viheralue|katualue|kattoalue|pohjapinta-ala|keskipinta-ala|rakennusoikeu|asunto\w*\s+keski|huoneistoala|kooltaan/i

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

    /* Ryhmittelijät pois; desimaalit eivät kiinnosta neliöissä. */
    const raaka = String(match[1] ?? "").replace(/[\s .]/g, "")
    const arvo = Number(raaka)
    if (!Number.isFinite(arvo)) continue
    if (arvo < MIN_M2 || arvo > MAX_M2) continue

    return Math.round(arvo)
  }

  return null
}
