/*
 * KUNNAN TIEDOTE HANKKEEN NIMELLA (D-314).
 *
 * Paatosasiakirja kertoo investoinnin muttei toteuttajia: Joensuun
 * investointiohjelmasta erotellut rivit saivat tilaajaksi kaupungin,
 * mutta paaurakoitsija ja suunnittelijat puuttuivat kaikilta. Kunnan
 * OMA TIEDOTE kertoo ne ("paiakodin paaurakoitsijana toimii
 * joensuulainen Rakennustoimisto K. Tervo Oy. Paasuunnittelija on
 * VAAKA-ARK Oy").
 *
 * Suomalaiset kuntasivustot ovat usein WordPressia, ja
 * `wp-json/wp/v2/search` loytaa tiedotteet hankkeen nimella ilman
 * kaavinta. Joensuussa tiedotteen tyyppi on `joe_release`, kuulutus
 * `joe_notice` ja kaava `joe_zone_plan` -- tyyppinimet ovat
 * kuntakohtaisia, joten ne tulostetaan sellaisenaan.
 *
 * Tama on HAKUTYOKALU, ei kerääjä: se ei kirjoita kantaan. Loydetyt
 * tiedot viedaan riveille omalla skriptilla, jotta muutos nakyy
 * kuivaharjoituksessa rivi riviltä.
 *
 *   npx tsx scripts/etsi-kunnan-tiedote.ts www.joensuu.fi "Noljakan päiväkoti" "Utran koulu"
 *   npx tsx scripts/etsi-kunnan-tiedote.ts www.joensuu.fi --lue <url>
 */

/*
 * Ylatason import tekee tiedostosta MODUULIN. Ilman sita TypeScript
 * pitaa tiedostoa globaalina skriptina, jolloin sen `main` tormaa
 * toisen samanlaisen skriptin `main`-funktioon ja koko projektin
 * kaannos kaatuu ("Duplicate function implementation"). Vercelin
 * build ajaa tyyppitarkistuksen, joten virhe kaataa julkaisun.
 */
import * as cheerio from "cheerio"

const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"

async function lueSivu(url: string, raja: number) {
  const res = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
  console.log(`\n[${res.status}] ${url}`)
  if (!res.ok) return
  const $ = cheerio.load(await res.text())
  $("script, style, nav, footer").remove()
  const teksti = ($("main").length ? $("main") : $("body"))
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim()
  console.log(teksti.slice(0, raja))
}

async function main() {
  const [host, ...loput] = process.argv.slice(2)
  if (!host) {
    console.error('Anna sivusto ja hakusanat: npx tsx scripts/etsi-kunnan-tiedote.ts www.joensuu.fi "Noljakan päiväkoti"')
    process.exit(1)
  }
  const juuri = host.startsWith("http") ? host.replace(/\/$/, "") : `https://${host}`

  if (loput[0] === "--lue") {
    for (const url of loput.slice(1)) await lueSivu(url, 2600)
    return
  }

  for (const q of loput) {
    const res = await fetch(`${juuri}/wp-json/wp/v2/search?search=${encodeURIComponent(q)}&per_page=10`, {
      cache: "no-store",
      headers: { "user-agent": UA },
    })
    console.log(`\n${"=".repeat(74)}\n### "${q}"  [${res.status}]`)
    if (!res.ok) {
      console.log("   rajapinta ei vastannut -- sivusto ei ehka ole WordPress")
      continue
    }
    const tulos = await res.json()
    if (!Array.isArray(tulos) || !tulos.length) {
      console.log("   ei osumia")
      continue
    }
    for (const t of tulos) {
      const url = String(t.url ?? "")
      /* Kaannokset ohi: sama sisalto, huonompi lahde. */
      if (/\/(en|sv|ru)\//.test(url)) continue
      const otsikko = String(t.title ?? "")
        .replace(/&#8211;/g, "-")
        .replace(/&amp;/g, "&")
      console.log(`   [${t.subtype}] ${otsikko.slice(0, 76)}`)
      console.log(`      ${url}`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
