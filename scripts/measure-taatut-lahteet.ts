import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TAATTUJEN PAIKKOJEN TUOTTO. Taattu lahde (priority > 10) varaa paikan
 * joka ajossa (4 kertaa/vrk) ja lyhentaa perustason kiertoa.
 *
 *   npx tsx scripts/measure-taatut-lahteet.ts
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const kaikki = async (t: string, cols: string, f?: (q: any) => any) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      let q = db.from(t).select(cols).range(from, from + 999)
      if (f) q = f(q)
      const { data, error } = await q
      if (error) throw error
      out.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return out
  }
  const srcs: any[] = await kaikki("discovery_sources", "id, name, parser, priority, enabled")
  const pp: any[] = await kaikki("potential_projects", "id, title, status, created_at, metadata")
  const ajot: any[] = await kaikki("discovery_runs", "source_name, created_at, finished_at", (q) => q.gte("created_at", "2026-08-25"))

  const ajoja = new Map<string, { n: number; sek: number }>()
  for (const r of ajot) {
    const k = String(r.source_name)
    const v = ajoja.get(k) ?? { n: 0, sek: 0 }
    v.n++
    if (r.finished_at) v.sek += (Date.parse(r.finished_at) - Date.parse(r.created_at)) / 1000
    ajoja.set(k, v)
  }

  /* Ehdokkaiden lahdenimi on joko lahteen nimi tai parserin nimi. */
  const ehdokkaita = (s: any, alkaen?: string) =>
    pp.filter(
      (p) =>
        [s.name, s.parser].includes(String(p.metadata?.source_name ?? "")) &&
        (!alkaen || p.created_at >= alkaen)
    ).length

  console.log("ajoja  s/ajo  ehdokkaita  30vrk  lähde")
  for (const s of srcs.filter((x) => x.enabled && x.priority > 10).sort((a, b) => a.name.localeCompare(b.name))) {
    const a = ajoja.get(s.name) ?? { n: 0, sek: 0 }
    console.log(
      String(a.n).padStart(5),
      String(a.n ? (a.sek / a.n).toFixed(1) : "-").padStart(6),
      String(ehdokkaita(s)).padStart(11),
      String(ehdokkaita(s, "2026-08-25")).padStart(6),
      " " + s.name
    )
  }
  const stt = srcs.find((s) => s.parser === "stt_haku")!
  const a = ajoja.get(stt.name) ?? { n: 0, sek: 0 }
  console.log("\nvertailu (perustaso):")
  console.log(
    String(a.n).padStart(5),
    String(a.n ? (a.sek / a.n).toFixed(1) : "-").padStart(6),
    String(ehdokkaita(stt)).padStart(11),
    String(ehdokkaita(stt, "2026-08-25")).padStart(6),
    " " + stt.name
  )
}
main().catch((e) => { console.error(e); process.exit(1) })
