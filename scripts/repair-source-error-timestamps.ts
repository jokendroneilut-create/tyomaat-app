/*
 * Korjaa lähteiden virheaikaleimat ajolokista.
 *
 * MIKSI. Vahtikoira merkitsi jumiin jääneen ajon virheeksi SIIVOUSHETKEEN,
 * joka voi olla viikkoja ajon jälkeen. Siksi 11.-14.8.2026 jumiajalta
 * peräisin olevat ajot leimasivat lähteet rikkinäisiksi vasta jälkikäteen,
 * ja kolmella niistä TUOREIN ajo oli onnistunut. Samalla kestoiksi
 * kirjautui jopa 24 vuorokautta, mikä pilaa kestotilastot.
 *
 * MITA TEHDAAN.
 *   1. Jumiajojen finished_at -> alku + tunti (hetki jolloin ajo tiedettiin
 *      kuolleeksi). Se on ainoa puolustettava arvio - tarkkaa kuolinhetkeä
 *      ei ole kirjattu mihinkään.
 *   2. Lähteen last_error_at lasketaan uudelleen virheajojen mukaan.
 *
 * last_success_at jätetään rauhaan: sen kirjoittaa onnistunut ajo oikeaan
 * hetkeen.
 *
 *   npx tsx scripts/repair-source-error-timestamps.ts
 *   npx tsx scripts/repair-source-error-timestamps.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const STUCK_MESSAGE = "Ajo jäi kesken"
const STUCK_RUN_AGE_MS = 60 * 60 * 1000

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

  const runs: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("discovery_runs")
      .select("*")
      .range(from, from + 999)
    if (error) throw error
    runs.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}`)
  console.log(`ajoja lokissa: ${runs.length}\n`)

  /* 1. Jumiajojen kesto takaisin järkeväksi. */
  const stuck = runs.filter(
    (r) => r.status === "error" && String(r.error_message ?? "").startsWith(STUCK_MESSAGE)
  )

  let fixedRuns = 0
  for (const r of stuck) {
    if (!r.created_at) continue
    const deadAt = new Date(new Date(r.created_at).getTime() + STUCK_RUN_AGE_MS).toISOString()
    if (r.finished_at && new Date(r.finished_at) <= new Date(deadAt)) continue

    fixedRuns++
    if (!APPLY) continue
    const { error } = await supabase
      .from("discovery_runs")
      .update({ finished_at: deadAt })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ajo ${r.id}: ${error.message}`)
  }
  console.log(`jumiajoja joiden kesto korjataan: ${fixedRuns} / ${stuck.length}\n`)

  /* 2. Lähteen virheaika virheajojen mukaan. */
  const errorAt = (r: any): string => {
    if (String(r.error_message ?? "").startsWith(STUCK_MESSAGE) && r.created_at) {
      return new Date(new Date(r.created_at).getTime() + STUCK_RUN_AGE_MS).toISOString()
    }
    return r.finished_at ?? r.created_at
  }

  const latestError = new Map<string, string>()
  for (const r of runs) {
    if (r.status !== "error" || !r.source_id) continue
    const at = errorAt(r)
    if (!at) continue
    const known = latestError.get(r.source_id)
    if (!known || new Date(at) > new Date(known)) latestError.set(r.source_id, at)
  }

  const { data: sources, error: sourceError } = await supabase
    .from("discovery_sources")
    .select("id, name, enabled, last_error_at, last_success_at")
  if (sourceError) throw sourceError

  const wasFailing = (s: any) =>
    Boolean(
      s.enabled &&
        s.last_error_at &&
        (!s.last_success_at || new Date(s.last_error_at) > new Date(s.last_success_at))
    )

  let changed = 0
  let recovered = 0

  for (const s of sources ?? []) {
    const computed = latestError.get(s.id) ?? null
    if (!computed && !s.last_error_at) continue
    if (computed && s.last_error_at && computed === s.last_error_at) continue
    if (!computed) continue

    const before = wasFailing(s)
    const after = Boolean(
      s.enabled &&
        (!s.last_success_at || new Date(computed) > new Date(s.last_success_at))
    )

    if (new Date(computed).getTime() === new Date(s.last_error_at ?? 0).getTime()) continue

    changed++
    if (before && !after) {
      recovered++
      console.log(`  ${s.name}`)
      console.log(`    ${s.last_error_at} -> ${computed}  (onnistunut ${s.last_success_at} jälkeen)`)
    }

    if (!APPLY) continue
    const { error } = await supabase
      .from("discovery_sources")
      .update({ last_error_at: computed })
      .eq("id", s.id)
    if (error) console.log(`  VIRHE lähde ${s.name}: ${error.message}`)
  }

  console.log(`\nvirheaikaleimoja korjataan: ${changed}`)
  console.log(`niistä lähteitä jotka lakkaavat näkymästä rikkinäisinä: ${recovered}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
