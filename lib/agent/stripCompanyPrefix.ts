/*
 * Yritysten lehdistötiedotteiden otsikot alkavat lähes aina yrityksen
 * nimellä ja rakentamiseen viittaavalla verbillä ("Marvea rakentaa...",
 * "SRV toteuttaa..."), mikä tekee TIC-katselmuslistasta ja hankesivun
 * otsikosta identtisen itse uutisotsikon kanssa. Tunnistetaan ja
 * poistetaan tämä alkuosa, jotta otsikko kuvaa vain hanketta.
 */
const PROJECT_VERBS = [
  "rakentaa",
  "rakensi",
  "rakennuttaa",
  "rakennutti",
  "aloittaa",
  "aloitti",
  "toteuttaa",
  "toteutti",
  "käynnistää",
  "käynnisti",
  "valmistui",
  "valmistuu",
  "valmisti",
  "myy",
  "myi",
  "osti",
  "hankki",
  "laajentaa",
  "laajensi",
  "avaa",
  "avasi",
  "investoi",
  "suunnittelee",
  "suunnitteli",
  "peruskorjaa",
  "peruskorjasi",
  "saneeraa",
  "saneerasi",
]

const PREFIX_PATTERN = new RegExp(
  `^([\\p{Lu}][\\p{L}0-9&.-]*(?:\\s+[\\p{Lu}][\\p{L}0-9&.-]*){0,2})\\s+(${PROJECT_VERBS.join("|")})\\s+(.+)$`,
  "u"
)

const MIN_REMAINDER_LENGTH = 15

/*
 * Yrityksen nimi esiintyy tässä asemassa perusmuodossa ("Marvea",
 * "SRV", "Lujatalo"). Paikannimet sen sijaan taipuvat usein
 * sisä-/ulkopaikallissijoihin samassa lauseasemassa ("Espoonkartanoon
 * valmistuu...", "Uuteen kortteliin nousee...") — nämä sijapäätteet
 * eivät koskaan esiinny lyhyiden yritysnimien lopussa, joten niillä
 * päättyvä poiminta hylätään väärän tulkinnan välttämiseksi.
 */
const INFLECTED_ENDING_PATTERN =
  /(oon|öön|aan|ään|een|iin|uun|yyn|lle|lla|llä|ssa|ssä|sta|stä|lta|ltä)$/iu

export function stripCompanyPrefixFromHeadline(headline: string | null | undefined): string {
  const trimmed = (headline ?? "").trim()
  if (!trimmed) return trimmed

  const match = trimmed.match(PREFIX_PATTERN)
  if (!match) return trimmed

  if (INFLECTED_ENDING_PATTERN.test(match[1])) return trimmed

  const remainder = match[3].trim()
  if (remainder.length < MIN_REMAINDER_LENGTH) return trimmed

  return remainder.charAt(0).toUpperCase() + remainder.slice(1)
}
