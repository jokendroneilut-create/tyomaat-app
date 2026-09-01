import { readFileSync } from "node:fs"

/*
 * PALAUTTAA HANKKEET JOTKA PIILOTETTIIN LIIAN OHUELLA TODISTEELLA.
 *
 * `auto-complete-projects` siirsi hankkeen tilaan "completed" heti kun
 * tekstista poimittu arvio meni. Mitattu 2.9.2026: 114 piilotettua,
 * joista vain kuusi kestaa tarkastelun (`lib/projects/autoCompleteGate.ts`).
 *
 * PERIAATE: kesken oleva hanke piilotettuna on pahempi kuin
 * valmistunut hanke listalla. Vaara piilotus vie asiakkaalta liidin
 * jota han ei voi tietaa menettaneensa.
 *
 * Palauttaa vaiheen historiasta (`project_phase_history.previous_phase`)
 * ja tilan aktiiviseksi. EI koske hankkeisiin jotka joku on merkinnyt
 * valmiiksi kasin tai joita jokin muu lahde kertoo valmiiksi.
 *
 *   npx tsx scripts/restore-auto-completed.ts
 *   npx tsx scripts/restore-auto-completed.ts --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { evaluateAutoComplete } = await import("../lib/projects/autoCompleteGate")
  const { PHASE_LABELS } = await import("../lib/projects/phases")

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const historia: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("project_phase_history")
      .select("project_id,phase,previous_phase,created_at")
      .eq("source_name", "estimated-completion-cron")
      .range(f, f + 999)
    if (error) throw error
    historia.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  /* Viimeisin siirto per hanke kertoo mista se siirrettiin. */
  const edellinen = new Map<string, string>()
  for (const h of [...historia].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
    if (h.previous_phase) edellinen.set(String(h.project_id), String(h.previous_phase))
  }

  const ids = [...edellinen.keys()]
  const hankkeet: any[] = []
  for (let i = 0; i < ids.length; i += 90) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,phase,status,is_public,estimated_completion,created_at,metadata")
      .in("id", ids.slice(i, i + 90))
    if (error) throw error
    hankkeet.push(...(data ?? []))
  }

  const palautettavat: any[] = []
  const jaa: string[] = []
  let pysyy = 0
  for (const h of hankkeet) {
    if (h.status !== "completed" && h.phase !== PHASE_LABELS.completed) continue
    /* Kasin merkittyyn ei kosketa. */
    const kasin = Array.isArray(h.metadata?.edited_fields) && h.metadata.edited_fields.includes("phase")
    if (kasin) { pysyy++; continue }

    const paatos = evaluateAutoComplete({
      estimatedCompletion: h.estimated_completion,
      createdAt: h.created_at,
      phase: null,
    })
    if (paatos === "complete") {
      pysyy++
      jaa.push(`  ${String(h.estimated_completion ?? "-").padEnd(11)} loydetty ${String(h.created_at).slice(0, 10)}  ${String(h.name).slice(0, 46)}`)
      continue
    }

    const avain = edellinen.get(h.id)!
    const label = (PHASE_LABELS as any)[avain] ?? avain
    palautettavat.push({ h, label, paatos })
  }

  console.log(
    `${APPLY ? "AJO" : "KUIVAHARJOITUS"}: auto-completen piilottamia ${hankkeet.length}\n` +
      `  palautetaan  ${palautettavat.length}\n` +
      `  jaa piiloon  ${pysyy}\n`
  )

  const per = new Map<string, number>()
  for (const p of palautettavat) per.set(`${p.paatos} -> ${p.label}`, (per.get(`${p.paatos} -> ${p.label}`) ?? 0) + 1)
  for (const [k, n] of [...per].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${k}`)

  console.log("\nRIVIT:")
  for (const { h, label, paatos } of palautettavat) {
    console.log(
      `  ${String(h.estimated_completion ?? "-").padEnd(11)} ${paatos.padEnd(5)} -> ${String(label).padEnd(22)} ${String(h.name).slice(0, 44)}`
    )
  }

  if (!APPLY) { console.log("\nKuivaharjoitus: mitaan ei kirjoitettu."); return }

  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")
  let ok = 0
  for (const { h, label, paatos } of palautettavat) {
    const { error } = await admin
      .from("projects")
      .update({ phase: label, status: "active", completed_at: null })
      .eq("id", h.id)
    if (error) { console.log(`  VIRHE ${h.name}: ${error.message}`); continue }
    await recordPhaseChange({
      supabase: admin as any,
      projectId: h.id,
      newPhase: label,
      previousPhase: PHASE_LABELS.completed,
      source: "auto_sync",
      sourceName: "restore-auto-completed",
      reason:
        paatos === "skip"
          ? `Valmistumispäivä (${h.estimated_completion}) on vanhempi kuin hankkeen löytöhetki — ei todiste valmistumisesta`
          : `Valmistumispäivä (${h.estimated_completion}) meni alle 90 vrk sitten — arvio ei yksin riitä piilottamiseen`,
    })
    ok++
  }
  console.log(`\npalautettu ${ok} / ${palautettavat.length}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
