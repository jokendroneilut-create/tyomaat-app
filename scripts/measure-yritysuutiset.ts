import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TUOKO YRITYKSEN OMA UUTISVIRTA MITAAN STT:N PAALLE?
 *
 * Kreaten hankeportfolio (/wp/v2/project) on seurannassa, uutiset
 * (/wp/v2/posts) eivat. Kysymys on onko uutisissa hankkeita joita STT ei
 * kerro - Kreate julkaisee tiedotteensa myos STT Infossa.
 *
 *   npx tsx scripts/measure-yritysuutiset.ts
 */

/* Sanat jotka erottavat hankeuutisen henkilo- ja mielipidejutuista. */
const HANKESANA =
  /\b(voitti|urakan|urakka|urakoi|rakentaa|rakentamisen|rakennusty|toteutusvaihe|sopimuk|tilauskanta|hanke|hankkeen|allekirjoitt|valmistui|harjannostaj|peruskorja|saneeraa|mukaan)/i

function siivoa(t: string) {
  return t
    .toLowerCase()
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/[^a-zåäö0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/* Karkea sanapohjainen paallekkaisyys: otsikot eivat ole identtisia. */
function osuu(a: string, b: string) {
  const sa = new Set(siivoa(a).split(" ").filter((w) => w.length > 4))
  const sb = new Set(siivoa(b).split(" ").filter((w) => w.length > 4))
  if (sa.size === 0) return 0
  let yhteisia = 0
  for (const w of sa) if (sb.has(w)) yhteisia++
  return yhteisia / Math.min(sa.size, sb.size)
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const vastaus = await fetch(
    "https://kreate.fi/wp-json/wp/v2/posts?per_page=100&after=2025-09-24T00:00:00&orderby=date&order=desc&_fields=id,date,slug,title,link",
    { headers: { "User-Agent": "tyomaat-diag" } }
  )
  const postaukset: any[] = await vastaus.json()

  /* Englanninkieliset ovat saman tiedotteen kaannoksia. */
  const suomeksi = postaukset.filter((p) => !/-en\/?$/.test(p.slug) && /[äö]|\b(ja|on|uusi|urakka|hanke)\b/i.test(p.title.rendered))
  const hanke = suomeksi.filter((p) => HANKESANA.test(p.title.rendered))

  console.log(`kreate.fi/posts 12 kk: ${postaukset.length}`)
  console.log(`  suomenkielisia:     ${suomeksi.length}`)
  console.log(`  hankeuutisia:       ${hanke.length}`)

  /* Kaikki kannan dokumentit joissa Kreate mainitaan. */
  const docs: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("source_documents")
      .select("source_name, title, document_url, created_at")
      .ilike("title", "%kreate%")
      .range(from, from + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  console.log(`\nkannassa Kreate-otsikoita: ${docs.length}`)

  console.log("\npvm         kannassa?  otsikko")
  let puuttuu = 0
  for (const p of hanke) {
    const paras = docs
      .map((d) => ({ d, pisteet: osuu(p.title.rendered, String(d.title)) }))
      .sort((a, b) => b.pisteet - a.pisteet)[0]
    const on = paras && paras.pisteet >= 0.5
    if (!on) puuttuu++
    console.log(
      `${p.date.slice(0, 10)}  ${(on ? paras.d.source_name : "EI").padEnd(9).slice(0, 9)}  ${p.title.rendered.replace(/&#8217;/g, "'").slice(0, 62)}`
    )
  }
  console.log(`\nhankeuutisia joita kannassa EI ole: ${puuttuu} / ${hanke.length}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
