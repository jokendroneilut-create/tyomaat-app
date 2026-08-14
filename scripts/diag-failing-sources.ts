/*
 * Listaa lähteet jotka TIC näyttää rikkinäisinä, ja mitä ne oikeasti
 * kertovat.
 *
 * TIC:n "ongelmia N" tarkoittaa: lähde on käytössä ja sen VIIMEISIN
 * tapahtuma oli virhe (last_error_at uudempi kuin last_success_at).
 * Se ei erottele koskaan toiminutta lähdettä sellaisesta joka on
 * onnistunut aiemmin, eikä kerro onko virhe tuore vai kuukausien
 * takainen.
 *
 *   npx tsx scripts/diag-failing-sources.ts
 */
import { readFileSync } from "node:fs"

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

const days = (iso: string | null) =>
  iso ? Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000) : null

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabase.from("discovery_sources").select("*")
  if (error) throw error
  const sources = data ?? []

  const enabled = sources.filter((s: any) => s.enabled)
  const failing = enabled.filter(
    (s: any) =>
      s.last_error_at &&
      (!s.last_success_at || new Date(s.last_error_at) > new Date(s.last_success_at))
  )

  /*
   * Sama raja kuin TIC:n taulukossa: yli viikon vanha korjaamaton virhe
   * ei ole enää "ongelma" vaan vanha virhe.
   */
  const STALE_DAYS = 7
  const fresh = failing.filter((s: any) => (days(s.last_error_at) ?? 0) <= STALE_DAYS)
  const stale = failing.filter((s: any) => (days(s.last_error_at) ?? 0) > STALE_DAYS)

  console.log(`lähteitä yhteensä: ${sources.length}`)
  console.log(`käytössä:          ${enabled.length}`)
  console.log(`viimeisin tapahtuma virhe: ${failing.length}`)
  console.log(`  joista tuoreita (ongelmia):     ${fresh.length}`)
  console.log(`  joista yli ${STALE_DAYS} vrk vanhoja:     ${stale.length}\n`)

  const sorted = [...failing].sort(
    (a: any, b: any) => (days(a.last_error_at) ?? 0) - (days(b.last_error_at) ?? 0)
  )

  for (const s of sorted) {
    const errAge = days(s.last_error_at)
    const okAge = days(s.last_success_at)
    const everOk = (s.success_count ?? 0) > 0

    console.log(`${s.name}`)
    console.log(`  tyyppi/keräin : ${s.type} / ${s.collector}`)
    console.log(`  virhe         : ${errAge} vrk sitten`)
    console.log(
      `  onnistuminen  : ${everOk ? `${okAge} vrk sitten` : "EI KOSKAAN"}` +
        `   (ajot ${s.run_count ?? 0}, onnistui ${s.success_count ?? 0}, virheitä ${s.error_count ?? 0})`
    )
    console.log(`  viesti        : ${String(s.last_error_message ?? "").slice(0, 200)}`)
    console.log(`  url           : ${String(s.url ?? "").slice(0, 120)}`)
    console.log("")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
