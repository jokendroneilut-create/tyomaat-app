/*
 * Vie vaihetta eteenpäin niillä riveillä joiden teksti kertoo
 * rakentamisen jo alkaneen.
 *
 * MIKSI NÄITÄ ON. `importCandidate` kutsui tekstipäättelyä vain kun
 * lähde EI antanut vaihetta. Noin 20 lähdettä asettaa vaiheen kiinteästi
 * muodossa `completed ? "Valmistunut" : "Suunnittelussa"`, joten ehto ei
 * täyttynyt koskaan ja päättely oli näille kuollutta koodia.
 *
 * Mitattu tapaus: Rakennuslehden "Nyab rakentaa sähköaseman Forssaan",
 * kuvaus "Rakentaminen alkaa elokuussa ja valmista on vuonna 2028."
 * Avainsana "rakentaminen alkaa" on sanastossa, mutta rivi jäi
 * vaiheeseen "Suunnittelussa".
 *
 * SAMA RAJAUS KUIN TUONNISSA: teksti saa viedä vain eteenpäin, eikä
 * koskaan päätevaiheeseen. "Valmistui" tarkoittaa tiedotteissa lähes
 * aina kohteen alkuperäistä rakennusvuotta, ja valmistuneeksi
 * merkitseminen piilottaa hankkeen asiakkaalta.
 *
 *   npx tsx scripts/backfill-phase-from-text.ts
 *   npx tsx scripts/backfill-phase-from-text.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { constructionHasStarted } = await import("../lib/projects/constructionStarted")
  const { PHASE_LABELS, phaseAdvances } = await import("../lib/projects/phases")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string) => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select("*").range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`)

  for (const [table, titleKey, phaseKey] of [
    ["potential_projects", "title", null],
    ["projects", "name", "phase"],
  ] as const) {
    const rows = await page(table)
    const live =
      table === "projects"
        ? rows.filter((r: any) => r.status === "active" && r.is_public !== false)
        : rows.filter((r: any) => r.status === "new")

    const hits: { r: any; from: string; to: string }[] = []

    for (const r of live) {
      const current = phaseKey ? r[phaseKey] : r.metadata?.phase_hint
      const text = [r[titleKey], r.metadata?.description, r.additional_info]
        .filter(Boolean)
        .join(" ")

      if (!constructionHasStarted(text)) continue

      const inferred = PHASE_LABELS.construction
      if (!phaseAdvances(current, inferred)) continue

      hits.push({ r, from: current ?? "(tyhja)", to: inferred })
    }

    console.log(`${table}: ${live.length} riviä, vaihe etenee ${hits.length}`)

    const moves: Record<string, number> = {}
    for (const h of hits) {
      const k = `${h.from} -> ${h.to}`
      moves[k] = (moves[k] ?? 0) + 1
    }
    for (const [k, n] of Object.entries(moves).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(4)}  ${k}`)
    }
    for (const h of hits.slice(0, 8)) {
      console.log(`      ${h.from} -> ${h.to}   ${String(h.r[titleKey]).slice(0, 52)}`)
    }
    console.log("")

    if (!APPLY) continue

    let done = 0
    for (const { r, to } of hits) {
      const patch: Record<string, any> = phaseKey
        ? { phase: to, metadata: { ...r.metadata, phase_hint: to } }
        : { metadata: { ...r.metadata, phase_hint: to } }

      const { error } = await supabase.from(table).update(patch).eq("id", r.id)
      if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
      else done++
    }
    console.log(`  kirjoitettu: ${done}\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
