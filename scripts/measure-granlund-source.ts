/*
 * MITTAUS: mita Granlundin projektirajapinnasta saa?
 *
 * Granlund on suunnittelutoimisto, joten se on hankkeessa aikaisemmin
 * kuin urakoitsija. Lahde loytyi kun Lujatalon referenssisivulta ei
 * saatu Prisma Hyllykalliosta juuri mitaan.
 *
 * Ei kirjoita mitaan.
 */

const API = "https://www.granlund.fi/wp-json/wp/v2/projects"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const PER_PAGE = 100
const MAX_PAGES = 3

async function main() {
  const { parseGranlundFields, parseGranlundDescription } = await import("../lib/agent/granlundProject")

  const posts: any[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await fetch(`${API}?per_page=${PER_PAGE}&page=${page}`, { headers: { "User-Agent": UA } })
    if (!r.ok) break
    const sivu = await r.json()
    if (!Array.isArray(sivu) || !sivu.length) break
    posts.push(...sivu)
    if (sivu.length < PER_PAGE) break
  }

  console.log(`hankkeita haettu: ${posts.length}\n`)

  const on = { city: 0, developer: 0, type: 0, start: 0, completion: 0, area: 0, others: 0, services: 0, kuvaus: 0 }
  const pituudet: number[] = []
  const vuodet = new Map<number, number>()
  const naytteet: string[] = []

  for (const p of posts) {
    const html = p?.content?.rendered ?? ""
    const f = parseGranlundFields(html)
    const k = parseGranlundDescription(html)

    if (f.city) on.city++
    if (f.developer) on.developer++
    if (f.projectType) on.type++
    if (f.startYear) on.start++
    if (f.completionYear) { on.completion++; vuodet.set(f.completionYear, (vuodet.get(f.completionYear) ?? 0) + 1) }
    if (f.area) on.area++
    if (f.otherCompanies.length) on.others++
    if (f.granlundServices.length) on.services++
    if (k) { on.kuvaus++; pituudet.push(k.length) }

    if (naytteet.length < 10 && f.developer) {
      naytteet.push(
        `  ${String(p.title?.rendered ?? "").slice(0, 34).padEnd(36)} ${String(f.city ?? "-").slice(0,12).padEnd(13)} ${String(f.developer).slice(0, 24).padEnd(26)} ${f.startYear ?? "-"}-${f.completionYear ?? "-"}  ${String(f.area ?? "-").slice(0,12)}`
      )
    }
  }

  const n = posts.length
  const p = (x: number) => `${String(x).padStart(4)}  (${Math.round((x / Math.max(1, n)) * 100)} %)`
  console.log("  kenttien kattavuus:")
  console.log(`    Paikkakunta        ${p(on.city)}`)
  console.log(`    Tilaaja            ${p(on.developer)}`)
  console.log(`    Tyyppi             ${p(on.type)}`)
  console.log(`    Aloitus            ${p(on.start)}`)
  console.log(`    Valmistuminen      ${p(on.completion)}`)
  console.log(`    Pinta-ala          ${p(on.area)}`)
  console.log(`    Muut toimijat      ${p(on.others)}`)
  console.log(`    Granlundin roolit  ${p(on.services)}`)
  console.log(`    kuvaus             ${p(on.kuvaus)}`)

  pituudet.sort((a, b) => a - b)
  if (pituudet.length) {
    console.log(`\n  kuvauksen pituus: mediaani ${pituudet[Math.floor(pituudet.length / 2)]}, lyhin ${pituudet[0]}, pisin ${pituudet[pituudet.length - 1]}`)
  }

  const nyt = new Date().getUTCFullYear()
  const tulevat = [...vuodet].filter(([v]) => v >= nyt).reduce((s, [, m]) => s + m, 0)
  console.log(`\n  valmistumisvuosi ${nyt} tai myohemmin: ${tulevat} / ${on.completion}  <- naista on hyotya`)
  console.log("  vuosijakauma:")
  for (const [v, m] of [...vuodet].sort((a, b) => a[0] - b[0])) console.log(`    ${v}  ${m}`)

  console.log("\n  naytteita:")
  for (const s of naytteet) console.log(s)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })

/* Moduuliksi, jottei ylatason main() tormaa muiden skriptien kanssa. */
export {}
