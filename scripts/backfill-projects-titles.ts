/*
 * Siivoaa päätöslähteistä hyväksyttyjen hankkeiden nimet.
 *
 * `potential_projects` korjataan backfill-decision-sources.ts:llä, mutta
 * hyväksytty hanke on kopioitu `projects`-tauluun eikä se enää päivity
 * lähteestä. Asiakas näkee siis yhä päätöksen nimen hankkeen nimen sijaan:
 *
 *   "Laurinlahden koulun ja uuden päiväkodin hankesuunnitelman hyväksyminen"
 *   -> "Laurinlahden koulun ja uuden päiväkodin hankesuunnitelma"
 *
 * Siivous on sama funktio kuin jäsentäjissä (genericizeDecisionTitle), joten
 * sääntö on yhdessä paikassa.
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-projects-titles.ts
 *   npx tsx scripts/backfill-projects-titles.ts --apply
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

/* Kuntien päätösjärjestelmät: Dynasty, CaseM, Ahjo, Turku. */
const DECISION_SOURCE = /DREQUEST\.PHP|cloudnc\.fi|paatokset\.hel\.fi|paatokset\.turku\.fi/

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { genericizeDecisionTitle } = await import("../lib/agent/decisionTitle")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = rows.filter((r) =>
    DECISION_SOURCE.test(String(r.metadata?.source_url ?? ""))
  )

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${targets.length} päätöslähteistä hanketta\n`
  )

  const stats = { nimi: 0, operation: 0, epaonnistui: 0 }

  for (const row of targets) {
    const md = row.metadata ?? {}
    const name = genericizeDecisionTitle(row.name)
    if (!name || name === row.name) continue

    /*
     * Operation päivitetään vain jos se on vanhentunut kopio nimestä.
     * Muualla se kantaa aidosti eri tekstiä - ks. D-044.
     */
    const operationIsStaleTitle =
      typeof md.operation === "string" &&
      md.operation !== name &&
      genericizeDecisionTitle(md.operation) === name

    stats.nimi++
    if (operationIsStaleTitle) stats.operation++

    console.log(`  ${String(row.name).slice(0, 82)}`)
    console.log(`   -> ${name.slice(0, 82)}`)

    if (!APPLY) continue

    const { error } = await supabase
      .from("projects")
      .update({
        name,
        metadata: operationIsStaleTitle ? { ...md, operation: name } : md,
      })
      .eq("id", row.id)

    if (error) {
      stats.epaonnistui++
      console.log(`     VIRHE: ${error.message}`)
    }
  }

  console.log("")
  console.log(`nimi siistitty:     ${stats.nimi}`)
  console.log(`operation synkattu: ${stats.operation}`)
  console.log(`epäonnistui:        ${stats.epaonnistui}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
