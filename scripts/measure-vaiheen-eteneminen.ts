import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * ETENEEKO HYVAKSYTYN HANKKEEN VAIHE JALKIKATEEN?
 *
 * Halytyksen idea on "hanke eteni sinulle sopivaan vaiheeseen", mutta
 * vaihehistoria seuraa lahes taysin hyvaksyntoja (mitattu 19.9.2026).
 * Tama mittaa:
 *   1. vaihehistorian lahteittain: uusi hanke vs. eteneminen
 *   2. ehdokkaat, jotka tiesivat hyvaksyttya hanketta MYOHEMMAN vaiheen,
 *      mutta hanke ei edennyt (katvealue)
 *
 *   npx tsx scripts/measure-vaiheen-eteneminen.ts
 */

async function kaikki(db: any, t: string, cols: string, f?: (q: any) => any) {
  const out: any[] = []
  for (let from = 0; ; from += 1000) {
    let q = db.from(t).select(cols).range(from, from + 999)
    if (f) q = f(q)
    const { data, error } = await q
    if (error) throw new Error(`${t}: ${error.message}`)
    out.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  return out
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { phaseAdvances, normalizeLegacyPhase } = await import("../lib/projects/phases")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const hist = await kaikki(db, "project_phase_history", "project_id, phase, previous_phase, source, created_at", (q) => q.gte("created_at", "2026-07-20T00:00:00Z"))
  const per = new Map<string, { uusi: number; etene: number }>()
  for (const h of hist) {
    const k = h.source ?? "?"
    if (!per.has(k)) per.set(k, { uusi: 0, etene: 0 })
    if (h.previous_phase) per.get(k)!.etene++; else per.get(k)!.uusi++
  }
  console.log(`1) VAIHEHISTORIA 20.7.– (${hist.length} riviä)`)
  for (const [k, v] of per) console.log(`   ${k.padEnd(18)} uusi hanke ${String(v.uusi).padStart(5)}   eteneminen ${String(v.etene).padStart(5)}`)

  const projektit = await kaikki(db, "projects", "id, name, phase, status, created_at, metadata")
  const pById = new Map(projektit.map((p) => [p.id, p]))
  const etenematHist = new Map<string, number>()
  for (const h of hist) if (h.previous_phase) etenematHist.set(h.project_id, (etenematHist.get(h.project_id) ?? 0) + 1)

  const ehdokkaat = await kaikki(db, "potential_projects", "id, title, status, created_at, metadata")
  type Osuma = { p: any; e: any; kautta: string }
  const osumat: Osuma[] = []
  for (const e of ehdokkaat) {
    const m = e.metadata ?? {}
    const pid = m.matched_existing_project_id ?? null
    const kautta = "matched_existing"
    if (!pid) continue
    const p = pById.get(pid)
    if (!p) continue
    if (m.approved_project_id === pid) continue // sama ehdokas josta hanke syntyi
    const hint = m.phase_hint
    if (!hint) continue
    if (phaseAdvances(p.phase, hint)) osumat.push({ p, e, kautta })
  }

  console.log(`\n2) KATVEALUE: ehdokas tietää myöhemmän vaiheen kuin hyväksytty hanke: ${osumat.length}`)
  const tila = new Map<string, number>()
  const siirtyma = new Map<string, number>()
  for (const o of osumat) {
    tila.set(o.e.status, (tila.get(o.e.status) ?? 0) + 1)
    const k = `${normalizeLegacyPhase(o.p.phase) ?? o.p.phase} -> ${normalizeLegacyPhase(o.e.metadata.phase_hint) ?? o.e.metadata.phase_hint}`
    siirtyma.set(k, (siirtyma.get(k) ?? 0) + 1)
  }
  console.log("   ehdokkaan tila:", [...tila].map(([k, v]) => `${k}:${v}`).join("  "))
  console.log("   siirtymä (hanke -> ehdokas):")
  for (const [k, v] of [...siirtyma].sort((a, b) => b[1] - a[1])) console.log(`     ${String(v).padStart(4)}  ${k}`)
  const uniq = new Set(osumat.map((o) => o.p.id))
  console.log(`   eri hankkeita: ${uniq.size}`)

  console.log("\n   otos (20):")
  for (const o of osumat.slice(0, 20)) {
    console.log(`   - [${o.p.phase}] ${String(o.p.name).slice(0, 55)}\n       <- ${o.e.status} [${o.e.metadata.phase_hint}] ${String(o.e.title).slice(0, 55)} (${o.e.metadata.source_name ?? "?"})`)
  }

  const hyv = projektit.filter((p) => p.status !== "archived")
  console.log(`\n3) hyväksyttyjä hankkeita ${hyv.length}, joista koskaan edennyt jälkikäteen: ${[...etenematHist.keys()].filter((id) => pById.has(id)).length} (20.7. alkaen)`)
}
main().catch((e) => { console.error(e); process.exit(1) })
