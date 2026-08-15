/*
 * Korjaa keskeytysilmoitusten vaiheen.
 *
 * MIKSI. Hilma julkaisee hankinnan keskeyttämisen samalla
 * ilmoitustyypillä kuin sopimuksen myöntämisen, joten peruttu
 * kilpailutus sai vaiheen "Sopimus myönnetty". Mitattu 15.8.2026:
 * 11 riviä, joista kolme oli asiakkaille näkyvissä.
 *
 * Hanketta EI hylätä eikä piiloteta. Keskeytetty kilpailutus
 * kilpailutetaan yleensä uudelleen, joten liidi on yhä aito - vain
 * vaihe on väärä. Hanke palautetaan kilpailutusvaiheeseen.
 *
 *   npx tsx scripts/backfill-cancelled-procurements.ts
 *   npx tsx scripts/backfill-cancelled-procurements.ts --apply
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
  const { isCancellationNotice } = await import("../lib/agent/hilmaCancellation")
  const { PHASE_LABELS } = await import("../lib/projects/phases")

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

  for (const [table, titleKey, hasPhaseColumn] of [
    ["projects", "name", true],
    ["potential_projects", "title", false],
  ] as const) {
    const rows = await page(table)

    const hits = rows.filter((r: any) =>
      isCancellationNotice({
        title: r[titleKey],
        winners: r.metadata?.winners,
        winnerOrganisations: r.metadata?.winner_organisations,
      })
    )

    console.log(`${table}: ${hits.length} keskeytysilmoitusta`)

    let changed = 0
    for (const r of hits) {
      const currentPhase = hasPhaseColumn ? r.phase : r.metadata?.phase_hint
      const visible =
        table === "projects" ? r.status === "active" && r.is_public !== false : r.status === "new"

      const needsFix = currentPhase === PHASE_LABELS.contract_awarded
      console.log(
        `  ${needsFix ? "KORJATAAN" : "ok       "} [${currentPhase ?? "-"}] ` +
          `${visible ? "näkyvissä" : r.status.padEnd(9)} ${String(r[titleKey]).slice(0, 58)}`
      )
      if (!needsFix) continue
      changed++

      if (!APPLY) continue

      const metadata = {
        ...r.metadata,
        phase_hint: PHASE_LABELS.tender,
        is_cancelled_procurement: true,
      }
      const patch: Record<string, any> = hasPhaseColumn
        ? { phase: PHASE_LABELS.tender, metadata }
        : { metadata }

      const { error } = await supabase.from(table).update(patch).eq("id", r.id)
      if (error) console.log(`    VIRHE ${r.id}: ${error.message}`)
    }

    console.log(`  korjattavia: ${changed}\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
