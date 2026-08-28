/*
 * HAKUVAHDIN SUODATTIMEN ARVO ON JOKO MERKKIJONO TAI LISTA.
 *
 * Monivalintaan siirryttiin ensin vaiheessa ja 28.8.2026 maakunnassa.
 * Vanhat tallennetut hakuvahdit jäävät kantaan sellaisenaan yksittäisenä
 * merkkijonona, joten lukijoiden on kestettävä molemmat muodot. Sääntö
 * oli kolmessa paikassa kopioituna, ja siksi se on tässä.
 *
 * Ansa: **tyhjä lista on JavaScriptissä tosi**, joten pelkkä
 * `if (filters.region)` päästäisi läpi tyhjän monivalinnan ja tuottaisi
 * joko rajauksen ilman arvoja tai otsikon "Maakunta: " ilman maakuntaa.
 */

export function filterValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0)
  }
  return typeof value === "string" && value ? [value] : []
}

/*
 * Yhteenvetorivin pala, esim. "Maakunta: Uusimaa, Pirkanmaa".
 * Palauttaa null kun rajausta ei ole, jotta kutsuja voi suodattaa.
 */
export function describeFilter(label: string, value: unknown): string | null {
  const values = filterValues(value)
  return values.length > 0 ? `${label}: ${values.join(", ")}` : null
}
