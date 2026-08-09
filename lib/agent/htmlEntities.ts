/*
 * HTML-entiteettien purku vapaasta tekstistä.
 *
 * Jaettu moduuli, koska sama vika toistui kolmessa eri lähteessä:
 * Dynastyn RSS-otsikoissa (&ndash;), Kuopion kaavalähteessä (&#x2F;) ja
 * CaseM:n asiasivuilla (&auml;). Jokainen jäsentäjä purki vain ne
 * entiteetit jotka sen omassa aineistossa oli sattumalta nähty, joten uusi
 * entiteetti jäi aina purkamatta ja päätyi otsikkoon sellaisenaan:
 *
 *   "...kohteessa Soukankuja 10&ndash;12"
 *
 * Numeeriset muodot ovat tärkeimmät: niitä ei voi luetella etukäteen.
 */

const NAMED: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…",
  laquo: "«", raquo: "»", sect: "§", deg: "°",
  auml: "ä", Auml: "Ä", ouml: "ö", Ouml: "Ö", aring: "å", Aring: "Å",
  eacute: "é", uuml: "ü", szlig: "ß", frasl: "/",
  copy: "©", reg: "®", trade: "™", middot: "·", bull: "•",
  times: "×", euro: "€", lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"',
}

export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return ""

  return (
    text
      .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED[name] ?? m)
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
      /* Puretut sitkeät välilyönnit tavallisiksi. */
      .replace(/ /g, " ")
  )
}
