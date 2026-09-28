import * as cheerio from "cheerio"

/*
 * SAVONLINNAN KAAVASELOSTUKSET KUULUTUKSEN LIITTEEKSI (D-217).
 *
 * Kuulutuspostauksessa ei ole yhtään liitelinkkiä - tarkistettu
 * 29.9.2026: sivulla on 554 linkkiä, kaikki navigaatiota. Kuulutus itse
 * ohjaa kaavoitussivulle, ja siellä liitteet ovat.
 *
 * Kaavoitussivun rakenne on suoraviivainen: jokainen vireillä oleva kaava
 * on `<h3>`-otsikko, ja sen jälkeen tulevat liitteet `wp-block-file`
 * -laatikoissa seuraavaan otsikkoon asti.
 *
 *   <h3>Asemakaavan muutos, Teknologiapuisto</h3>
 *   ...
 *   <div class="wp-block-file"><a href="...liite_a-asemakaava.pdf">Kaavakartta (pdf)</a></div>
 *   <div class="wp-block-file"><a href="...liite_b-selostus.pdf">Kaavaselostus (pdf)</a></div>
 *
 * OTSIKKO ON AVAIN. Kaavoitussivun `<h3>` on sanasta sanaan sama kuin
 * kuulutuksen otsikko, joten liitteet löytyvät ilman arvailua.
 * Normalisointi on silti tarpeen: välilyönnit ja kirjainkoko vaihtelevat.
 */

/* Liitteen nimi tai osoite kertoo kumpi se on. Kartassa ei ole tekstiä. */
const SELOSTUS = /selostus/i

function normalisoi(otsikko: string): string {
  return otsikko
    .toLowerCase()
    .replace(/ /g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * Otsikko -> kaavaselostuksen osoite. Kaavat joilla ei ole selostusta
 * jätetään pois: tyhjä arvo ei kerro mitään.
 */
export function savonlinnaSelostusLinkit(html: string): Map<string, string> {
  const $ = cheerio.load(html)
  const linkit = new Map<string, string>()

  $("h2, h3").each((_, otsikkoEl) => {
    const otsikko = normalisoi($(otsikkoEl).text())
    if (!otsikko) return

    /*
     * Liitteet ovat otsikon SISARUKSIA, eivät lapsia: kerätään eteenpäin
     * kunnes vastaan tulee seuraava otsikko.
     */
    let solmu = $(otsikkoEl).next()

    while (solmu.length && !/^h[123]$/i.test(solmu.get(0)?.tagName ?? "")) {
      solmu.find("a[href]").each((__, linkkiEl) => {
        const href = $(linkkiEl).attr("href") ?? ""
        const teksti = $(linkkiEl).text()

        if (!/\.pdf(\?|$)/i.test(href)) return
        if (!SELOSTUS.test(`${href} ${teksti}`)) return
        if (!linkit.has(otsikko)) linkit.set(otsikko, href)
      })

      solmu = solmu.next()
    }
  })

  return linkit
}

export function savonlinnaSelostusOtsikolle(
  linkit: Map<string, string>,
  otsikko: string | null | undefined
): string | null {
  if (!otsikko) return null
  return linkit.get(normalisoi(otsikko)) ?? null
}
