/*
 * Merkitsee lyhyet, itsestään päättyvät työt valmistuneiksi kun
 * päätöksestä on kulunut yli kaksi vuotta.
 *
 * SÄÄNTÖ ON TYYPPIKOHTAINEN, EI YLEINEN IKÄRAJA. Ks. perustelu
 * `lib/projects/selfCompletingWork.ts`. Lyhyesti: purkupäätös tehdään ja
 * työ tehdään kuukausissa, kun taas peruskorjaus saa aidosti kestää
 * vuosia. Yleinen ikäraja sulkisi eläviä suurhankkeita - Finlandia-talon
 * perusparannus oli vuosia kesken ja koko ajan elossa.
 *
 * KAHDESSA TAULUSSA ERI TOIMENPIDE:
 *   jono     -> status "ignored", vaihe Valmistunut. Ei näy asiakkaalle,
 *               historia säilyy (sama käytäntö kuin muissa poistoissa).
 *   hankkeet -> vaihe ja status kuten auto-complete-cronissa, jotta
 *               valmistuneet käyttäytyvät samoin riippumatta siitä mikä
 *               ne sinne merkitsi.
 *
 *   npx tsx scripts/complete-short-works.ts
 *   npx tsx scripts/complete-short-works.ts --apply
 *   npx tsx scripts/complete-short-works.ts --apply --years=3
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const YEARS = Number(
  process.argv.find((a) => a.startsWith("--years="))?.split("=")[1] ?? "2"
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

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { isFinishedShortWork, selfCompletingKind } = await import(
    "../lib/projects/selfCompletingWork"
  )
  const { PHASE_LABELS } = await import("../lib/projects/phases")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string, cols: string) => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — raja ${YEARS} v\n`
  )

  /* --- jono --- */
  const queue = (await page("potential_projects", "id, title, status, metadata")).filter(
    (r: any) => r.status === "new"
  )
  const queueShort = queue.filter((r: any) => selfCompletingKind(r.title))
  const queueHits = queueShort.filter((r: any) =>
    isFinishedShortWork({
      title: r.title,
      decisionDate: r.metadata?.decision_date,
      years: YEARS,
    })
  )

  console.log(`potential_projects: ${queue.length} riviä jonossa`)
  console.log(`  lyhyita toita:        ${queueShort.length}`)
  console.log(`  yli ${YEARS} v vanhoja:      ${queueHits.length}`)
  for (const r of queueHits.slice(0, 10)) {
    console.log(`    ${r.metadata.decision_date}  ${String(r.title).slice(0, 62)}`)
  }

  /* --- asiakkaille näkyvät --- */
  const live = (
    await page("projects", "id, name, phase, status, is_public, metadata")
  ).filter((r: any) => r.status === "active" && r.is_public !== false)
  const liveShort = live.filter((r: any) => selfCompletingKind(r.name))
  const liveHits = liveShort.filter(
    (r: any) =>
      r.phase !== PHASE_LABELS.completed &&
      isFinishedShortWork({
        title: r.name,
        decisionDate: r.metadata?.decision_date,
        years: YEARS,
      })
  )

  console.log(`\nprojects: ${live.length} näkyvää hanketta`)
  console.log(`  lyhyita toita:        ${liveShort.length}`)
  console.log(`  yli ${YEARS} v vanhoja:      ${liveHits.length}`)
  for (const r of liveHits.slice(0, 10)) {
    console.log(
      `    ${r.metadata.decision_date}  [${r.phase}] ${String(r.name).slice(0, 54)}`
    )
  }

  if (!APPLY) return

  let done = 0
  for (const r of queueHits) {
    const { error } = await supabase
      .from("potential_projects")
      .update({
        status: "ignored",
        metadata: {
          ...r.metadata,
          phase_hint: PHASE_LABELS.completed,
          completed_reason: `lyhyt_tyo_yli_${YEARS}v:${r.metadata.decision_date}`,
        },
      })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
    else done++
  }
  console.log(`\njonosta siirretty: ${done}`)

  let done2 = 0
  for (const r of liveHits) {
    const { error } = await supabase
      .from("projects")
      .update({
        phase: PHASE_LABELS.completed,
        status: "completed",
        completed_at: new Date().toISOString(),
        metadata: {
          ...r.metadata,
          completed_reason: `lyhyt_tyo_yli_${YEARS}v:${r.metadata.decision_date}`,
        },
      })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
    else done2++
  }
  console.log(`hankkeita merkitty valmistuneeksi: ${done2}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
