/*
 * Yritysten lehdistötiedotteiden otsikot alkavat lähes aina yrityksen
 * nimellä ja rakentamiseen viittaavalla verbillä ("Marvea rakentaa...",
 * "SRV toteuttaa..."), mikä tekee TIC-katselmuslistasta ja hankesivun
 * otsikosta identtisen itse uutisotsikon kanssa. Tunnistetaan ja
 * poistetaan tämä alkuosa, jotta otsikko kuvaa vain hanketta.
 *
 * SUOMEN OBJEKTI ON GENETIIVISSÄ, ja se rajaa milloin poisto on turvallista.
 * Verbin poistaminen jättää objektin taivutettuun muotoon, jolloin jäljelle
 * jää lauseenpätkä eikä otsikko. Mitatut tapaukset Peabin jonosta:
 *
 *   "Peab rakentaa koulun ja kirjaston Evijärvelle"
 *     -> "Koulun ja kirjaston Evijärvelle"
 *   "Peab käynnistää uuden omaperusteisen asuntohankkeen Tampereella"
 *     -> "Uuden omaperusteisen asuntohankkeen Tampereella"
 *   "Peab peruskorjaa ja uudistaa Iisalmen kulttuurikeskuksen"
 *     -> "Ja uudistaa Iisalmen kulttuurikeskuksen"
 *
 * Viimeinen on erillinen vika: kuvio tunnisti vain ensimmäisen verbin
 * rinnasteisesta predikaatista ja jätti konjunktion otsikon alkuun.
 *
 * Periaate on sama kuin rakennuttajan poiminnassa: kun tulos ei ole varmasti
 * kelvollinen, säilytetään alkuperäinen otsikko. Kokonainen uutisotsikko on
 * huonompi hankenimenä kuin siisti katkelma, mutta parempi kuin rikkinäinen.
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
  "uudistaa",
  "uudisti",
]

const VERB_PATTERN = PROJECT_VERBS.join("|")

/*
 * Rinnasteinen predikaatti ("peruskorjaa ja uudistaa") on osa etuliitettä,
 * ei osa hankkeen nimeä.
 */
const PREFIX_PATTERN = new RegExp(
  `^([\\p{Lu}][\\p{L}0-9&.-]*(?:\\s+[\\p{Lu}][\\p{L}0-9&.-]*){0,2})\\s+(?:${VERB_PATTERN})` +
    `(?:\\s+(?:ja|sekä)\\s+(?:${VERB_PATTERN}))?\\s+(.+)$`,
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

/** Konjunktio otsikon alussa on aina merkki katkenneesta lauseesta. */
const LEADING_CONJUNCTION = /^(ja|sekä|tai|myös)\b/iu

/*
 * Pieni alkukirjain ja n-loppu = genetiiviobjekti ("koulun", "uuden").
 * Iso alkukirjain samassa asemassa on erisnimen määrite ("Vanhan Vaasan
 * sairaalan..."), jolloin pääsana on yleensä perusmuodossa ja katkelma
 * kelpaa otsikoksi.
 */
const DANGLING_OBJECT = /^\p{Ll}[\p{L}0-9-]*n$/u

/*
 * Saaja allatiivissa ("atNorthille", "YH Kodeille") kertoo että varsinainen
 * objekti tulee vasta sen jälkeen ja on genetiivissä. Tarkistetaan kaksi
 * ensimmäistä sanaa, koska saajan nimi voi olla kaksiosainen.
 */
const RECIPIENT_ENDING = /(lle|lla|llä)$/iu

/*
 * Pääsanan genetiivi perusmuotoon. Vain yksikäsitteiset päätteet; pitkä
 * vokaali ennen n:ää on illatiivi ("Kouvolaan") eikä genetiivi, joten se
 * jätetään rauhaan.
 */
function nominativeHead(word: string): string {
  if (/ksen$/u.test(word)) return word.replace(/ksen$/u, "s")
  if (/kkeen$/u.test(word)) return word.replace(/kkeen$/u, "ke")
  if (/tteen$/u.test(word)) return word.replace(/tteen$/u, "te")
  if (/[^aeiouyäöåAEIOUYÄÖÅ][aeiouyäöåAEIOUYÄÖÅ]n$/u.test(word)) return word.slice(0, -1)
  return word
}

export function stripCompanyPrefixFromHeadline(headline: string | null | undefined): string {
  const trimmed = (headline ?? "").trim()
  if (!trimmed) return trimmed

  const match = trimmed.match(PREFIX_PATTERN)
  if (!match) return trimmed

  if (INFLECTED_ENDING_PATTERN.test(match[1])) return trimmed

  const remainder = match[2].trim()
  if (remainder.length < MIN_REMAINDER_LENGTH) return trimmed

  const words = remainder.split(/\s+/)

  if (LEADING_CONJUNCTION.test(remainder)) return trimmed
  if (DANGLING_OBJECT.test(words[0])) return trimmed
  if (words.slice(0, 2).some((w) => RECIPIENT_ENDING.test(w))) return trimmed

  words[words.length - 1] = nominativeHead(words[words.length - 1])
  const cleaned = words.join(" ")

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}
