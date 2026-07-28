/*
 * HTML-runko -> luettava monirivinen teksti: kappale-/rivitagit muutetaan
 * rivinvaihdoiksi, muut tagit poistetaan, yleisimmät entiteetit puretaan.
 * Jaettu STT-uutishuone- ja YIT-lähteiden kesken.
 */
export function htmlToText(value: unknown): string {
  const html = typeof value === "string" ? value : ""
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#8217;|&rsquo;|&#39;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}
