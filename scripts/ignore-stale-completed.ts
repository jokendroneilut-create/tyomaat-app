/*
 * Siirtää katselmointijonosta pois hankkeet joiden valmistumisaika on
 * mennyt yli vuosi sitten.
 *
 * Numeromuotoisen valmistumisajan tunnistus paljasti että jonossa oli
 * vuosia sitten valmistuneita hankkeita merkinnällä "Suunnittelussa" -
 * vanhimmat vuodelta 2020. Ne eivät ole liidejä.
 *
 * VUODEN RAJA ON TARKOITUKSELLINEN. Suunniteltu valmistuminen ei ole
 * todiste toteutuneesta: hanke voi viivästyä. Kolme kuukautta myöhässä
 * oleva hanke on todennäköisesti yhä kesken, yli vuoden vanha ei.
 *
 * Status on `ignored`, ei DELETE: rivi katoaa jonosta ja asiakasnäkymästä
 * mutta historia säilyy.
 *
 *   npx tsx scripts/ignore-stale-completed.ts
 *   npx tsx scripts/ignore-stale-completed.ts --apply
 *   npx tsx scripts/ignore-stale-completed.ts --apply --years=2
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const YEARS = Number(
  process.argv.find((a) => a.startsWith("--years="))?.split("=")[1] ?? "1"
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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - YEARS)
  const cutoffIso = cutoff.toISOString().slice(0, 10)

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, status, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  /*
   * EPÄUSKOTTAVA PÄIVÄ EI KELPAA PERUSTEEKSI. Aineistossa oli yksi rivi
   * arvolla 1914-12-31, vaikka teksti sanoo "alkaa 6/2022 ja valmistua
   * 9/2022". Vuosisadan takainen valmistumisaika on jäsennysvirhe, ja
   * sen perusteella ohittaminen olisi ohittanut rivin väärästä syystä.
   */
  const PLAUSIBLE = /^20[0-4]\d-/

  const targets = rows.filter(
    (r) =>
      r.status === "new" &&
      r.metadata?.estimated_completion &&
      PLAUSIBLE.test(String(r.metadata.estimated_completion)) &&
      r.metadata.estimated_completion < cutoffIso
  )

  const implausible = rows.filter(
    (r) =>
      r.status === "new" &&
      r.metadata?.estimated_completion &&
      !PLAUSIBLE.test(String(r.metadata.estimated_completion))
  )
  if (implausible.length) {
    console.log(`  ohitettu epäuskottavan päivän vuoksi: ${implausible.length}`)
    for (const r of implausible) {
      console.log(`    ${r.metadata.estimated_completion}  ${String(r.title).slice(0, 60)}`)
    }
  }

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — raja ${cutoffIso} (${YEARS} v)`
  )
  console.log(`  jonossa ${rows.filter((r) => r.status === "new").length} riviä`)
  console.log(`  siirretään ignored-tilaan: ${targets.length}\n`)

  const perYear: Record<string, number> = {}
  for (const row of targets) {
    const year = String(row.metadata.estimated_completion).slice(0, 4)
    perYear[year] = (perYear[year] ?? 0) + 1
  }
  for (const [year, count] of Object.entries(perYear).sort()) {
    console.log(`  ${year}: ${count}`)
  }

  if (!APPLY) return

  let done = 0
  for (const row of targets) {
    /*
     * Vaihe merkitään valmistuneeksi samalla: rivi on jonossa
     * suunnitteluvaiheessa, mikä on väärin kun valmistumisaika on
     * vuosia takana.
     */
    const { error } = await supabase
      .from("potential_projects")
      .update({
        status: "ignored",
        metadata: { ...row.metadata, phase_hint: "Valmistunut" },
      })
      .eq("id", row.id)
    if (error) console.log(`  VIRHE ${row.id}: ${error.message}`)
    else done++
  }
  console.log(`\nsiirretty: ${done}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
