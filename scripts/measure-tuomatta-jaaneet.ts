import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const kaikki = async (t: string, cols: string, f?: (q: any) => any) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      let q = db.from(t).select(cols).order("id", { ascending: true }).range(from, from + 999)
      if (f) q = f(q)
      const { data, error } = await q
      if (error) throw error
      out.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return out
  }
  /* Koko tapahtumataulu kerralla - .in()-paloittelu osui 1000 rivin kattoon. */
  const tapahtumat: any[] = await kaikki("project_import_events", "id, source_url")
  const tuodut = new Set(tapahtumat.map((t) => t.source_url).filter(Boolean))
  console.log(`tuontitapahtumia ${tapahtumat.length}, eri osoitetta ${tuodut.size}`)

  const srcs: any[] = await kaikki("discovery_sources", "id, name, priority", (q) => q.eq("collector", "legacyFetchCollector"))
  const docs: any[] = await kaikki("source_documents", "id, source_id, document_url, created_at", (q) => q.in("source_id", srcs.map((s) => s.id)))
  console.log(`legacy-lähteitä ${srcs.length}, dokumentteja ${docs.length}`)

  const nimi = new Map(srcs.map((s) => [s.id, s.name]))
  const rivit = new Map<string, { kaikki: number; vuoto: number; syyskuu: number }>()
  for (const d of docs) {
    const k = String(nimi.get(d.source_id))
    const r = rivit.get(k) ?? { kaikki: 0, vuoto: 0, syyskuu: 0 }
    r.kaikki++
    if (!tuodut.has(d.document_url)) { r.vuoto++; if (d.created_at >= "2026-09-01") r.syyskuu++ }
    rivit.set(k, r)
  }
  const kokoVuoto = [...rivit.values()].reduce((s, r) => s + r.vuoto, 0)
  console.log(`\ntuomatta yhteensä: ${kokoVuoto} / ${docs.length}`)
  console.log("\nvuoto   syysk.  kaikki  lähde")
  for (const [k, r] of [...rivit].sort((a, b) => b[1].vuoto - a[1].vuoto).slice(0, 12)) {
    console.log(String(r.vuoto).padStart(5), String(r.syyskuu).padStart(7), String(r.kaikki).padStart(7), " ", k)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
