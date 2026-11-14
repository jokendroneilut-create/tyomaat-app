import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * NCC:N JA PEABIN ROSKAKUVAUKSET (D-419).
 *
 * Loytyi 14.11.2026 valmistuneiden verkkohaun tarkistuksessa:
 *
 *   - NCC: kuvaukseksi oli tallentunut koko sivu ("Siirry sisaltoon ...
 *     tiedotetilaus, Map data, palautelomake"). Nyt `nccKuvaus`.
 *   - Peab: evastedialogi voitti tiedotteen pituusvertailussa, kuvaus oli
 *     evasteseloste. Nyt `extractReleaseBody` poistaa dialogit.
 *   - Akaan Toijalan alakoulu: nakyvan hankkeen kuvaus oli TOISEN hankkeen
 *     (yhtenaiskoulun markkinakartoitus, Hilma). Korvataan NCC-sivun
 *     kuvauksella.
 *
 * Sivu haetaan kerran (sama haku jonka keraaja tekee). Kuvaus vaihdetaan
 * vain jos nykyinen on tunnistettavasti roskaa; muuten ennallaan.
 *
 *   npx tsx scripts/korjaa-ncc-peab-kuvaukset.ts          kuiva
 *   npx tsx scripts/korjaa-ncc-peab-kuvaukset.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const UA = { "User-Agent": "Mozilla/5.0 (compatible; TyomaatBot/1.0; +https://www.tyomaat.fi)" }
const AJO = "ncc_peab_kuvaukset_2026_11"

/* Tunnistettava roska: NCC-sivudumppi, evasteseloste tai Toijalan vieras teksti. */
const ROSKA = /^(?:Siirry sisältöön|Sivusto sisältää evästeitä|Markkinakartoitus: Akaan Toijalan yhtenäiskoulu)/

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { nccKuvaus } = await import("../lib/agent/fetchNccProjectsSource")
  const { extractReleaseBody } = await import("../lib/agent/companyRelease")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const sivut = new Map<string, string | null>()
  const uusiKuvaus = async (lahde: string, url: string | null): Promise<string | null> => {
    if (!url) return null
    if (sivut.has(url)) return sivut.get(url)!
    let k: string | null = null
    const r = await fetch(url, { headers: UA })
    if (r.ok) {
      const html = await r.text()
      k = lahde === "ncc_projektit" ? nccKuvaus(cheerio.load(html)) : extractReleaseBody(html)
    } else console.log(`  sivu ${r.status}: ${url}`)
    sivut.set(url, k)
    await new Promise((ok) => setTimeout(ok, 1000))
    return k
  }

  let rivit = 0
  for (const lahde of ["ncc_projektit", "peab"]) {
    console.log(`\n=== ${lahde} ===`)

    const { data: hankkeet, error } = await db
      .from("projects")
      .select("id,name,status,is_public,additional_info,metadata")
      .eq("metadata->>source_name", lahde)
    if (error) throw error
    for (const p of (hankkeet ?? []) as any[]) {
      const md = p.metadata ?? {}
      const ai = String(p.additional_info ?? "")
      const mdk = String(md.description ?? "")
      if (!ROSKA.test(ai) && !ROSKA.test(mdk)) continue
      const uusi = await uusiKuvaus(lahde, md.source_url)
      if (!uusi || ROSKA.test(uusi)) {
        console.log(`HANKE ${p.name.slice(0, 60)}: ei uutta kuvausta, ennallaan`)
        continue
      }
      rivit++
      console.log(`HANKE [${p.status}${p.is_public ? "" : " piilo"}] ${p.name.slice(0, 60)}\n   vanha: ${ai.slice(0, 90)}\n   uusi:  ${uusi.slice(0, 160)}`)
      if (APPLY) {
        const ajot = [...new Set([...(md.takautuvat_ajot ?? []), AJO])]
        const { error: e } = await db
          .from("projects")
          .update({
            ...(ROSKA.test(ai) || !ai ? { additional_info: uusi } : {}),
            metadata: { ...md, ...(ROSKA.test(mdk) || !mdk ? { description: uusi } : {}), takautuvat_ajot: ajot },
          })
          .eq("id", p.id)
        if (e) throw e
      }
    }

    const { data: jono } = await db
      .from("potential_projects")
      .select("id,title,status,metadata")
      .eq("metadata->>source_name", lahde)
    for (const r of (jono ?? []) as any[]) {
      const md = r.metadata ?? {}
      if (!ROSKA.test(String(md.description ?? ""))) continue
      const uusi = await uusiKuvaus(lahde, md.source_url)
      if (!uusi || ROSKA.test(uusi)) {
        console.log(`JONO  [${r.status}] ${String(r.title).slice(0, 60)}: ei uutta kuvausta, ennallaan`)
        continue
      }
      rivit++
      console.log(`JONO  [${r.status}] ${String(r.title).slice(0, 60)}: ${String(md.description).length} -> ${uusi.length} merkkiä | ...${uusi.slice(-110)}`)
      if (APPLY) {
        const ajot = [...new Set([...(md.takautuvat_ajot ?? []), AJO])]
        const { error: e } = await db
          .from("potential_projects")
          .update({ metadata: { ...md, description: uusi, takautuvat_ajot: ajot }, updated_at: new Date().toISOString() })
          .eq("id", r.id)
        if (e) throw e
      }
    }

    const { data: dokut } = await db
      .from("source_documents")
      .select("id,title,document_url,raw_payload")
      .eq("source_name", lahde)
      .ilike("raw_payload->>description", lahde === "peab" ? "Sivusto sisältää evästeitä*" : "Siirry sisältöön*")
    for (const d of (dokut ?? []) as any[]) {
      const raw = d.raw_payload ?? {}
      const uusi = await uusiKuvaus(lahde, raw.source_url ?? d.document_url)
      if (!uusi || ROSKA.test(uusi)) continue
      rivit++
      console.log(`DOKU  ${String(d.title).slice(0, 60)}: ${String(raw.description).length} -> ${uusi.length} merkkiä`)
      if (APPLY) {
        const { error: e } = await db
          .from("source_documents")
          .update({ raw_payload: { ...raw, description: uusi }, updated_at: new Date().toISOString() })
          .eq("id", d.id)
        if (e) throw e
      }
    }
  }

  console.log(`\n${APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS ==="}  rivejä ${rivit}`)
}
main()
