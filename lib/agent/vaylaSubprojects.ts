import type { CheerioAPI } from "cheerio"

/*
 * VÄYLÄN KATTOHANKKEEN OSAHANKKEET (D-199).
 *
 * Kattohankkeen sivulla lukee "Kts. osahankkeiden yhteystiedot", eikä
 * sillä ole omaa yhteystietolaatikkoa. Projektipäälliköt ovat
 * osahankkeiden sivuilla, joihin kattosivu linkittää (Vt 9
 * Kanavuori-Hankasalmi -> Kanavuori-Lievestuore, Lievestuore-Hankasalmi).
 *
 * Vain vayla.fi:n omat sivupolut; ei sivua itseään, ankkureita eikä
 * hankehakua. Enintään VAYLA_MAX_SUBPAGES, jotta yksi kattosivu ei
 * laukaise kymmeniä pyyntöjä.
 */
export const VAYLA_MAX_SUBPAGES = 5

export function vaylaSubprojectLinks($: CheerioAPI, projectUrl: string): string[] {
  const itse = new URL(projectUrl).pathname.replace(/\/$/, "")
  const linkit: string[] = []
  $("body a[href]").each((_, a) => {
    /* Navigaatio, ylä- ja alatunniste eivät ole osahankkeita (/haku, /sv, /vaylista). */
    if ($(a).closest("nav, header, footer").length > 0) return
    const href = String($(a).attr("href") ?? "")
    if (href.startsWith("#")) return
    let url: URL
    try {
      url = new URL(href, "https://vayla.fi")
    } catch {
      return
    }
    if (url.hostname !== "vayla.fi") return
    const polku = url.pathname.replace(/\/$/, "")
    if (!polku || polku === itse || polku === "/suunnittelu-rakentaminen") return
    if (!/^\/[a-z0-9-]+(?:\/[a-z0-9-]+)?$/.test(polku)) return
    const osoite = `https://vayla.fi${polku}`
    if (!linkit.includes(osoite)) linkit.push(osoite)
  })
  return linkit.slice(0, VAYLA_MAX_SUBPAGES)
}
