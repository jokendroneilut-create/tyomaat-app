/*
 * METADATAN LUKU KOKONAISLUVUKSI.
 *
 * Jonorivin metadata on JSON, joten sama kenttä voi olla numero tai
 * merkkijono sen mukaan mikä lähde sen kirjoitti ("45" vs 45). Sarakkeet
 * ovat numeerisia, ja merkkijonon työntäminen niihin kaataa kirjoituksen
 * tai tallentaa hiljaa väärin.
 *
 * Palauttaa nullin kaikesta muusta kuin järkevästä kokonaisluvusta —
 * tyhjä on parempi kuin väärä. Yläraja on löysä mutta olemassa, jottei
 * ilmeinen roska (vuosiluku, postinumero) päädy asuntomääräksi.
 */
export function kokonaisluku(arvo: unknown, yparaja = 100_000): number | null {
  if (typeof arvo === "number") {
    return Number.isFinite(arvo) && arvo > 0 && arvo <= yparaja ? Math.round(arvo) : null
  }

  if (typeof arvo !== "string") return null

  /* "45 kpl" ja "1 200" ovat molemmat kelvollisia; "3-5" ei ole. */
  const siivottu = arvo.replace(/\s| /g, "")
  if (!/^\d+(kpl|as|asuntoa)?$/i.test(siivottu)) return null

  const luku = Number(siivottu.match(/^\d+/)?.[0])
  return Number.isFinite(luku) && luku > 0 && luku <= yparaja ? luku : null
}
