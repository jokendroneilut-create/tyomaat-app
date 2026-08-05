/*
 * Palauttaa hankkeet, jotka agentin tuonti siirsi vaiheessa taaksepäin.
 *
 * Tausta: importCandidate kirjoitti vaiheen ehdoitta, joten vanha uutinen
 * siirsi käynnissä olevan työmaan takaisin suunnitteluun. Suojaus lisätty
 * (lib/projects/phases.ts phaseAdvances), tämä korjaa jo tapahtuneet.
 *
 * Palautus tehdään VAIN kun project_phase_history todistaa peruutuksen ja
 * hankkeen nykyinen vaihe on yhä se johon peruutettiin - jos vaihe on
 * muuttunut sen jälkeen, riviin ei kosketa.
 *
 *   npx tsx scripts/restore-regressed-phases.ts            # kuivaharjoitus
 *   npx tsx scripts/restore-regressed-phases.ts --apply
 *   npx tsx scripts/restore-regressed-phases.ts --days=30
 */
import { readFileSync } from "node:fs"
import { createClient } from "@supabase/supabase-js"

const APPLY = process.argv.includes("--apply")
const DAYS = Number(
  process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 30
)

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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  const { phaseOrder, PHASE_LABELS, normalizeLegacyPhase } = await import(
    "../lib/projects/phases"
  )

  const since = new Date(Date.now() - DAYS * 86400000).toISOString()

  const history: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("project_phase_history")
      .select("id, project_id, phase, previous_phase, source, source_name, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + 999)

    if (error) throw error
    history.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  // Peruutukset: agentin tuonti, vaihe laski.
  const regressions = history.filter((h) => {
    if (h.source !== "agent_import") return false
    if (!h.previous_phase || !h.phase) return false
    const before = phaseOrder(h.previous_phase)
    const after = phaseOrder(h.phase)
    return before != null && after != null && after < before
  })

  console.log(
    `${DAYS} vrk: ${history.length} historiariviä, ${regressions.length} agentin peruuttamaa`
  )
  if (regressions.length === 0) return

  // Uusin peruutus per hanke ratkaisee mihin palautetaan.
  const latest = new Map<string, any>()
  for (const r of regressions) latest.set(r.project_id, r)

  const ids = [...latest.keys()]
  const projects = new Map<string, any>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, city, phase, status")
      .in("id", ids.slice(i, i + 100))
    if (error) throw error
    for (const p of data ?? []) projects.set(p.id, p)
  }

  const plan: { project: any; from: string; to: string }[] = []
  const skipped: string[] = []

  for (const [projectId, row] of latest) {
    const project = projects.get(projectId)
    if (!project) {
      skipped.push(`${projectId.slice(0, 8)} hanketta ei löydy`)
      continue
    }

    // Vaihe on muuttunut peruutuksen jälkeen -> ei kosketa.
    if (normalizeLegacyPhase(project.phase) !== normalizeLegacyPhase(row.phase)) {
      skipped.push(
        `${String(project.name).slice(0, 40)} — vaihe on jo ${project.phase}, ei ${row.phase}`
      )
      continue
    }

    const key = normalizeLegacyPhase(row.previous_phase)
    if (!key) {
      skipped.push(`${String(project.name).slice(0, 40)} — tuntematon aiempi vaihe`)
      continue
    }

    plan.push({ project, from: project.phase, to: PHASE_LABELS[key] })
  }

  console.log(`\npalautetaan ${plan.length}, ohitetaan ${skipped.length}\n`)
  for (const p of plan) {
    console.log(
      `  ${String(p.project.name).slice(0, 46).padEnd(48)} ${String(p.project.city ?? "-").padEnd(14)} ${p.from} -> ${p.to}`
    )
  }
  for (const s of skipped) console.log(`  OHITETAAN ${s}`)

  if (!APPLY) {
    console.log("\nkuivaharjoitus — aja --apply kirjoittaaksesi")
    return
  }

  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")

  let done = 0
  for (const p of plan) {
    const { error } = await supabase
      .from("projects")
      .update({ phase: p.to })
      .eq("id", p.project.id)

    if (error) throw error

    await recordPhaseChange({
      supabase,
      projectId: p.project.id,
      newPhase: p.to,
      previousPhase: p.from,
      source: "manual_correction",
      sourceName: "restore-regressed-phases",
      reason:
        "Palautus: agentin tuonti siirsi vaiheen taaksepäin ennen kuin " +
        "phaseAdvances-suojaus oli käytössä",
    })

    done += 1
  }

  console.log(`\nvalmis: ${done} hanketta palautettu`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
