import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: kuinka usein ehdokkaan kaupunki eroaa siita hankkeesta johon
 * se yhdistettiin?
 *
 * Yhdistyminen on riippumaton todiste: hanke on tunnistettu samaksi
 * muilla perusteilla (otsikko, osoite, tunnukset), joten sen kaupunki
 * on eri lahteesta kuin ehdokkaan.
 *
 * Osuus "montako prosenttia on Helsinkia" ei kelpaa virheasteeksi -
 * SRV rakentaa aidosti paljon Helsinkiin. Tama mittaa erimielisyytta,
 * ei jakaumaa.
 *
 * Ei kirjoita mitaan.
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const imp: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("project_imports")
      .select("source_name,potential_project_id,project_id")
      .eq("action", "matched_existing_project")
      .range(f, f + 999)
    if (error) throw error
    imp.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const hae = async (taulu: string, sarakkeet: string, ids: string[]) => {
    const out = new Map<string, any>()
    for (let i = 0; i < ids.length; i += 50) {
      const { data, error } = await supabase.from(taulu).select(sarakkeet).in("id", ids.slice(i, i + 50))
      if (error) { console.log(`  VIRHE ${taulu}: ${error.message}`); return out }
      for (const r of data ?? []) out.set((r as any).id, r)
    }
    return out
  }

  const pot = await hae("potential_projects", "id,title,municipality", [...new Set(imp.map((x) => x.potential_project_id).filter(Boolean))])
  const pro = await hae("projects", "id,name,city", [...new Set(imp.map((x) => x.project_id).filter(Boolean))])

  const per = new Map<string, { yht: number; eri: number; naytteet: string[] }>()

  for (const x of imp) {
    const a = pot.get(x.potential_project_id), b = pro.get(x.project_id)
    if (!a || !b) continue
    const ka = String(a.municipality ?? "").trim().toLowerCase()
    const kb = String(b.city ?? "").trim().toLowerCase()
    if (!ka || !kb) continue

    const s = String(x.source_name ?? "?")
    if (!per.has(s)) per.set(s, { yht: 0, eri: 0, naytteet: [] })
    const o = per.get(s)!
    o.yht++
    if (ka !== kb) {
      o.eri++
      if (o.naytteet.length < 4) o.naytteet.push(`      ${String(a.title).slice(0, 42).padEnd(44)} ${a.municipality} -> ${b.city}`)
    }
  }

  console.log(`yhdistymisia joissa molemmilla kaupunki: ${[...per.values()].reduce((s, o) => s + o.yht, 0)}\n`)
  console.log("  lahde                          vertailtu   eri mielta")
  for (const [s, o] of [...per].sort((a, b) => b[1].eri - a[1].eri)) {
    if (o.yht < 3) continue
    const pros = Math.round((o.eri / o.yht) * 100)
    console.log(`  ${s.slice(0, 28).padEnd(30)} ${String(o.yht).padStart(6)}   ${String(o.eri).padStart(6)}  (${pros} %)`)
    for (const n of o.naytteet) console.log(n)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
