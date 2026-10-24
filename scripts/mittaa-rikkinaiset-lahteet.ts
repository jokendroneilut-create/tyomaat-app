import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MIKA LAHTEISSA ON RIKKI JA MIKSI?
 *
 * Johannes 24.10.2026: *"katso lahteiden tila, nayttaa 13 viallista."*
 *
 * Tila luetaan SAMALLA saannolla kuin nakyma (`lahteenTila`), jottei
 * tama anna eri lukua kuin sivu -- juuri sita varten saanto on
 * keskitetty (D-185). Virheviesti ja ika ryhmitellaan, koska 13
 * punaista voi olla yksi vika kolmessatoista rivissa tai kolmetoista
 * eri vikaa.
 *
 *   npx tsx scripts/mittaa-rikkinaiset-lahteet.ts
 *   npx tsx scripts/mittaa-rikkinaiset-lahteet.ts --kaikki  (myos vanhat)
 */

import { lahteenTila, type LahteenTila } from "../lib/agent/discovery/lahteenTila"

async function main() {
  const kaikki = process.argv.includes("--kaikki")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let a = 0; ; a += 500) {
    const { data, error } = await db
      .from("discovery_sources")
      .select(
        "id, name, parser, collector, url, enabled, last_run_at, last_success_at, last_error_at, last_error_message, run_count, success_count, error_count"
      )
      .range(a, a + 499)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 500) break
  }

  const tilat = new Map<LahteenTila, any[]>()
  for (const r of rivit) {
    const t = lahteenTila(r)
    tilat.set(t, [...(tilat.get(t) ?? []), r])
  }

  console.log(`=== ${rivit.length} lähdettä ===`)
  for (const t of ["failing", "stale", "disabled", "ok"] as LahteenTila[]) {
    console.log(`${String((tilat.get(t) ?? []).length).padStart(4)}  ${t}`)
  }

  const kohteet = kaikki
    ? [...(tilat.get("failing") ?? []), ...(tilat.get("stale") ?? [])]
    : tilat.get("failing") ?? []

  /* Ryhmittely virheviestin alun mukaan: sama vika vai eri vikoja? */
  const ryhmat = new Map<string, any[]>()
  for (const r of kohteet) {
    const viesti = String(r.last_error_message ?? "(ei viestiä)")
    const avain = viesti.replace(/\d+/g, "N").slice(0, 60)
    ryhmat.set(avain, [...(ryhmat.get(avain) ?? []), r])
  }

  console.log(`\n=== ${kohteet.length} riviä, ${ryhmat.size} eri virhettä ===`)

  for (const [avain, lista] of [...ryhmat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n--- ${lista.length} kpl: ${avain}`)
    for (const r of lista) {
      const vrk = r.last_error_at
        ? Math.floor((Date.now() - new Date(r.last_error_at).getTime()) / 86_400_000)
        : null
      const onnistui = r.last_success_at
        ? Math.floor((Date.now() - new Date(r.last_success_at).getTime()) / 86_400_000)
        : null
      console.log(
        `   ${String(r.name).slice(0, 44).padEnd(46)} virhe ${vrk} vrk sitten | onnistui ${onnistui == null ? "ei koskaan" : `${onnistui} vrk sitten`} | ${r.success_count}/${r.run_count} ajoa`
      )
      console.log(`      ${String(r.last_error_message ?? "").slice(0, 180)}`)
      console.log(`      ${r.url}`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
