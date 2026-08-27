import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: kuinka moni Granlundin 211 hankkeesta osuu jo tuntemaamme?
 *
 * Granlund on suunnittelija ja siksi hankkeessa vuosia ennen
 * urakoitsijaa. Loytolahteena se antoi vain 6 hanketta (D-131), mutta
 * rikastuslahteena se kattaa koko aineiston - myos ne 152 valmistunutta,
 * koska hanke on voinut olla meilla jo suunnitteluvaiheessa.
 *
 * Kaytetaan SAMAA vertailijaa kuin tuotanto (calculateMatch), jottei
 * synny toista tasmaytysta joka erkaantuu.
 *
 * Ei kirjoita mitaan.
 */

const API = "https://www.granlund.fi/wp-json/wp/v2/projects"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseGranlundFields, parseGranlundDescription } = await import("../lib/agent/granlundProject")
  const { calculateMatch } = await import("../lib/agent/projectMatcher")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const posts: any[] = []
  for (let page = 1; page <= 3; page++) {
    const r = await fetch(`${API}?per_page=100&page=${page}&lang=fi`, { headers: { "User-Agent": UA } })
    if (!r.ok) break
    const sivu = await r.json()
    if (!Array.isArray(sivu) || !sivu.length) break
    posts.push(...sivu)
    if (sivu.length < 100) break
  }

  const lataa = async (t: string, s: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select(s).range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  const projects = (await lataa("projects", "id,name,city,region,location,phase,status,developer,builder,metadata"))
    .map((p: any) => ({ ...p, taulu: "projects" }))
  const potential = (await lataa("potential_projects", "id,title,municipality,address,status,metadata"))
    .map((p: any) => ({ ...p, name: p.title, city: p.municipality, location: p.address, taulu: "potential_projects" }))

  const kaikki = [...projects, ...potential]
  console.log(`Granlund-hankkeita: ${posts.length}`)
  console.log(`vertailtavia: ${projects.length} hanketta + ${potential.length} ehdokasta\n`)

  const asProject = (p: any) => ({
    id: p.id, name: p.name, city: p.city, region: p.region ?? p.metadata?.region ?? null,
    location: p.location ?? null, phase: p.phase ?? p.metadata?.phase_hint ?? null,
    status: p.status, developer: p.developer ?? p.metadata?.developer ?? null,
    builder: p.builder ?? p.metadata?.builder ?? null,
  })

  let osumia = 0
  const kynnykset = [70, 60, 50]
  const laskurit = new Map<number, number>(kynnykset.map((k) => [k, 0]))
  const naytteet: string[] = []
  const heikot: string[] = []

  for (const post of posts) {
    const html = post?.content?.rendered ?? ""
    const f = parseGranlundFields(html)
    const title = String(post?.title?.rendered ?? "").replace(/&#8211;/g, "–").replace(/&amp;/g, "&")
    if (!f.city) continue

    /* Vertailu vain saman kaupungin sisalla, kuten tuotannossa. */
    const ehdokkaat = kaikki.filter(
      (p) => String(p.city ?? "").trim().toLowerCase() === f.city!.trim().toLowerCase()
    )
    if (!ehdokkaat.length) continue

    let paras: any = null
    let parasPisteet = 0
    for (const p of ehdokkaat) {
      const r = calculateMatch(asProject(p), {
        name: title, sourceTitle: title, city: f.city, region: null,
        location: null, propertyId: null, developer: f.developer ?? null,
        buildingType: f.projectType ?? null,
        description: parseGranlundDescription(html) ?? null,
      })
      const c = r?.confidence ?? 0
      if (c > parasPisteet) { parasPisteet = c; paras = p }
    }

    for (const k of kynnykset) if (parasPisteet >= k) laskurit.set(k, (laskurit.get(k) ?? 0) + 1)

    if (parasPisteet >= 70) {
      osumia++
      if (naytteet.length < 16) {
        naytteet.push(`  ${String(parasPisteet).padStart(3)}  ${title.slice(0, 40).padEnd(42)} -> ${String(paras.name).slice(0, 40).padEnd(42)} ${paras.taulu === "projects" ? "hanke" : "jono"}`)
      }
    } else if (parasPisteet >= 50 && heikot.length < 10) {
      heikot.push(`  ${String(parasPisteet).padStart(3)}  ${title.slice(0, 40).padEnd(42)} -> ${String(paras.name).slice(0, 40)}`)
    }
  }

  console.log("  osumia kynnyksittain:")
  for (const k of kynnykset) console.log(`    >= ${k}:  ${laskurit.get(k)}`)
  console.log(`\n  tasmaytettavia (>= 70): ${osumia} / ${posts.length}\n`)
  console.log("  naytteita (>= 70):")
  for (const n of naytteet) console.log(n)
  console.log("\n  harmaa vyohyke (50-69, EI tasmayteta):")
  for (const h of heikot) console.log(h)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
