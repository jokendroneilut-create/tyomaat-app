import * as cheerio from "cheerio"

/*
 * Artikkelin leipäteksti osoitteesta.
 *
 * Jaettu moduuli, koska sama tarve toistuu: yrityslähteiden listaussivu antaa
 * vain otsikon, ja kuvaus on artikkelisivulla. Aiemmin tämä oli yhden
 * poimijan sisällä, ja siellä se luki koko <body>:n - mikä kelpasi kaupungin
 * päättelyyn mutta ei näytettäväksi kuvaukseksi. Mitattu Lujatalon sivulta:
 * teksti alkoi "<iframe src=googletagmanager...>Toggle nav".
 */

/*
 * Artikkelin runko järjestyksessä tarkimmasta yleisimpään. Ensimmäinen osuma
 * voittaa, ja koko <body> on vasta viimeinen keino.
 */
const CONTENT_SELECTORS = [
  "article",
  "main",
  ".article__content",
  ".release__body",
  ".content__main",
  ".entry-content",
]

/*
 * Leipätekstin jälkeen tuleva vakiosisältö. Katkaisu tähän estää sen että
 * "Sinua saattaisi kiinnostaa" -nostot ja yhteystietoboilerplate päätyisivät
 * kuvaukseen - ja samalla siihen että toisen hankkeen nimi vuotaisi tähän
 * kuvaukseen ja sotkisi täsmäytyksen.
 */
/*
 * Ennen leipätekstiä tuleva alustan oma tunniste. Cision-tiedotteissa se on
 * julkaisuaika ja "Report this content" -linkki, jotka eivät kerro hankkeesta
 * mitään mutta olivat mitatusti kuvauksen ensimmäiset 60 merkkiä.
 */
const LEAD_MARKERS = [/report this content/i, /jaa sivu sosiaalisessa mediassa/i]

const CUT_MARKERS = [
  /sinua saattaisi kiinnostaa/i,
  /lue myös/i,
  /muita uutisia/i,
  /jaa artikkeli/i,
  /tilaa uutiskirje/i,
]

export function extractArticleBody(html: string): string | null {
  const $ = cheerio.load(html)
  $("script, style, noscript, nav, header, footer, iframe, form, aside").remove()

  let text = ""
  for (const selector of CONTENT_SELECTORS) {
    const found = $(selector).first().text()
    if (found && found.trim().length > text.length) {
      text = found
      break
    }
  }

  let cleaned = (text || $("body").text()).replace(/\s+/g, " ").trim()

  cleaned = stripLeadIn(cleaned)

  for (const marker of CUT_MARKERS) {
    cleaned = cleaned.split(marker)[0]?.trim() ?? cleaned
  }

  return cleaned || null
}

/*
 * Pudottaa alustan tunnisteen ja kaiken sitä ennen. Rajaus alkuun on
 * tarkoituksellinen: jos merkki esiintyy vasta myöhemmin, se on osa
 * leipätekstiä eikä sitä ennen olevaa saa hukata.
 */
export function stripLeadIn(text: string): string {
  let result = text

  for (const marker of LEAD_MARKERS) {
    const match = result.match(marker)
    if (!match || match.index === undefined) continue
    if (match.index > 400) continue

    result = result.slice(match.index + match[0].length).trim()
  }

  return result
}

export async function fetchArticleBody(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
    })
    if (!response.ok) return null

    return extractArticleBody(await response.text())
  } catch {
    return null
  }
}
