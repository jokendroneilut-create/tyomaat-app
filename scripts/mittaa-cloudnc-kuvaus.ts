/*
 * CLOUDNC-KUVAUKSEN MITTAUS: VANHA VS. UUSI (D-311).
 *
 * Kajaani luki kuvaukseksi vain `.kuulutus-info`-lohkon (AJANKOHTAISTA-
 * tilapaivitys), Hollola vain `.basic-content`-lohkon kolme ensimmaista
 * kappaletta. `cloudncKuvaus` lukee molemmat ja pudottaa asiointiohjeen.
 *
 * Tama ajo hakee KAIKKI molempien kaavasivut ja tulostaa vanhan ja uuden
 * kuvauksen rinnakkain, jotta rivit voi lukea yksitellen ennen kuin
 * keraajan muutos jaa voimaan tai mitaan taydennetaan kantaan.
 *
 *   npx tsx scripts/mittaa-cloudnc-kuvaus.ts
 *   npx tsx scripts/mittaa-cloudnc-kuvaus.ts --pitka   (koko teksti)
 */

import * as cheerio from "cheerio"
import { cloudncKuvaus, onCloudncRoska, siisti } from "../lib/agent/discovery/collectors/sivunKuvaus"

const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"

const SIVUSTOT = [
  {
    nimi: "Kajaani",
    lista: "https://kajaani.cloudnc.fi/fi-FI/Kaavat",
    juuri: "https://kajaani.cloudnc.fi",
    linkki: /^\/fi-FI\/content\/\d+\/\d+$/,
  },
  {
    nimi: "Hollola",
    lista: "https://hollola.cloudnc.fi/fi-FI/Kaavat/Aktiiviset",
    juuri: "https://hollola.cloudnc.fi",
    linkki: /^\/fi-FI\/content\/\d+\/12722$/,
  },
] as const

async function hae(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  }
}

/* Keraajien vanhat valinnat sellaisina kuin ne olivat ennen D-311:ta. */
function vanhaKajaani($: cheerio.CheerioAPI): string | null {
  return $(".kuulutus-info").first().text().replace(/\s+/g, " ").trim() || null
}
function vanhaHollola($: cheerio.CheerioAPI): string | null {
  return (
    $(".basic-content p")
      .map((_, p) => $(p).text().replace(/\s+/g, " ").trim())
      .get()
      .filter(Boolean)
      .slice(0, 3)
      .join(" ") || null
  )
}

async function main() {
  const pitka = process.argv.includes("--pitka")
  const katkaise = (s: string | null, n: number) =>
    s == null ? "(tyhjä)" : pitka ? s : s.length > n ? `${s.slice(0, n)}…` : s

  for (const sivusto of SIVUSTOT) {
    const lista = await hae(sivusto.lista)
    if (!lista) {
      console.log(`\n### ${sivusto.nimi}: LISTASIVUA EI SAATU`)
      continue
    }
    const $l = cheerio.load(lista)
    const urlit = new Set<string>()
    $l("a[href*='content/']").each((_, el) => {
      const href = $l(el).attr("href")
      if (href && sivusto.linkki.test(href)) urlit.add(sivusto.juuri + href)
    })

    console.log(`\n${"=".repeat(74)}`)
    console.log(`### ${sivusto.nimi}: ${urlit.size} kaavasivua`)
    console.log("=".repeat(74))

    let kasvoi = 0
    let kutistui = 0
    let samana = 0
    let tyhjia = 0

    for (const url of urlit) {
      const html = await hae(url)
      if (!html) {
        console.log(`\n!! sivua ei saatu: ${url}`)
        continue
      }
      const $ = cheerio.load(html)
      const otsikko = siisti($("h1").first().text())
      const vanha = sivusto.nimi === "Kajaani" ? vanhaKajaani($) : vanhaHollola($)
      const uusi = cloudncKuvaus($)

      if (uusi == null) tyhjia += 1
      else if (vanha == null || uusi.length > (vanha?.length ?? 0)) kasvoi += 1
      else if (uusi.length < vanha.length) kutistui += 1
      else samana += 1

      /* Pudotetut kappaleet nakyviin: jos saanto pudottaa liikaa, se nakyy tassa. */
      const pudotetut = $(".basic-content p")
        .toArray()
        .map((p) => siisti($(p).text()))
        .filter((p) => p && onCloudncRoska(p))

      console.log(`\n${"-".repeat(74)}`)
      console.log(`${otsikko.slice(0, 70)}`)
      console.log(`  ${url}`)
      console.log(`  VANHA (${vanha?.length ?? 0}): ${katkaise(vanha, 200)}`)
      console.log(`  UUSI  (${uusi?.length ?? 0}): ${katkaise(uusi, 400)}`)
      if (pudotetut.length) {
        console.log(`  pudotettu ${pudotetut.length} kappale(tta):`)
        for (const p of pudotetut) console.log(`    - ${p.slice(0, 110)}`)
      }
      await new Promise((r) => setTimeout(r, 400))
    }

    console.log(`\n  ${sivusto.nimi}: kasvoi ${kasvoi}, kutistui ${kutistui}, samana ${samana}, tyhjä ${tyhjia}`)
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
