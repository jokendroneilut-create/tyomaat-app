/*
 * Erottaa TAVOITTEEN aikataulusta valmistumiskentässä.
 *
 * MIKSI. `estimated_completion` ei ole lisätieto vaan väite: kun päivä
 * menee, auto-complete-cron merkitsee hankkeen valmistuneeksi ja se
 * katoaa asiakkaan listalta.
 *
 * Mitattu tapaus: Helsingin tarveselvitys (8/2021) lupasi Abraham
 * Wetterin tien päiväkodin käyttöön 8/2023. Urakoitsijan mukaan
 * rakentaminen kesti 1/2024-5/2025 ja kohde luovutettiin 8/2025 - kaksi
 * vuotta myöhemmin. Kentässä oleva tavoite olisi merkinnyt hankkeen
 * valmiiksi silloin kun työmaa oli vasta alkamassa.
 *
 * MITÄ TEHDÄÄN:
 *   tavoite     -> siirretään `metadata.planned_completion`-kenttään.
 *                  Tieto säilyy näytettäväksi, mutta ei merkitse
 *                  hanketta valmiiksi.
 *   mahdoton    -> poistetaan. Valmistuminen ennen päätöstä on
 *                  poimintavirhe, ei aikataulu.
 *   aikataulu   -> jätetään ennalleen.
 *
 *   npx tsx scripts/separate-target-from-schedule.ts
 *   npx tsx scripts/separate-target-from-schedule.ts --apply
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
  const { completionEvidence } = await import("../lib/projects/completionEvidence")

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

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`)

  for (const [table, titleKey] of [
    ["potential_projects", "title"],
    ["projects", "name"],
  ] as const) {
    const rows = await page(table, "*")

    const dateOf = (r: any) =>
      table === "projects"
        ? r.estimated_completion ?? r.metadata?.estimated_completion
        : r.metadata?.estimated_completion

    const dated = rows.filter((r: any) => dateOf(r))

    const classified = dated.map((r: any) => ({
      r,
      date: String(dateOf(r)),
      verdict: completionEvidence({
        title: r[titleKey],
        decisionDate: r.metadata?.decision_date,
        completionDate: String(dateOf(r)),
      }),
    }))

    const targets = classified.filter((c) => c.verdict === "target")
    const impossible = classified.filter((c) => c.verdict === "impossible")
    const schedules = classified.filter((c) => c.verdict === "schedule")

    console.log(`${table}: ${dated.length} riviä joilla valmistumisaika`)
    console.log(`  aikataulu (jätetään):        ${schedules.length}`)
    console.log(`  tavoite (siirretään):        ${targets.length}`)
    console.log(`  mahdoton (poistetaan):       ${impossible.length}`)

    const today = new Date().toISOString().slice(0, 10)
    console.log(
      `  ...tavoitteista jo menneita: ${targets.filter((c) => c.date < today).length}` +
        `  <- nama olisivat merkinneet hankkeen valmiiksi`
    )

    for (const c of impossible.slice(0, 5)) {
      console.log(
        `    MAHDOTON ${c.date} (paatos ${c.r.metadata?.decision_date})  ${String(c.r[titleKey]).slice(0, 44)}`
      )
    }

    if (!APPLY) continue

    let moved = 0
    for (const c of targets) {
      const metadata = { ...c.r.metadata }
      delete metadata.estimated_completion
      metadata.planned_completion = c.date

      const patch: Record<string, any> =
        table === "projects" ? { estimated_completion: null, metadata } : { metadata }

      const { error } = await supabase.from(table).update(patch).eq("id", c.r.id)
      if (error) console.log(`  VIRHE ${c.r.id}: ${error.message}`)
      else moved++
    }

    let dropped = 0
    for (const c of impossible) {
      const metadata = { ...c.r.metadata }
      delete metadata.estimated_completion

      const patch: Record<string, any> =
        table === "projects" ? { estimated_completion: null, metadata } : { metadata }

      const { error } = await supabase.from(table).update(patch).eq("id", c.r.id)
      if (error) console.log(`  VIRHE ${c.r.id}: ${error.message}`)
      else dropped++
    }

    console.log(`  siirretty tavoitteeksi: ${moved}, poistettu: ${dropped}\n`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
