/*
 * Ehdottaa osapuolia hankkeille joilla ei ole lähdetekstiä (D-078).
 *
 * KOHDEJOUKKO. Asiakkaalle näkyvät suunnittelu- tai rakentamisvaiheen hankkeet
 * joilta puuttuu SEKÄ rakennuttaja ETTÄ pääurakoitsija, ja joilla ei ole
 * kuvausta josta poimia. Näille deterministinen poiminta on mahdoton — ei ole
 * tekstiä — joten tieto haetaan verkosta.
 *
 * EI KIRJOITA ASIAKKAALLE NÄKYVIÄ KENTTIÄ. Tulos menee
 * `metadata.ai_suggestion`iin ehdotuksena, jonka ihminen hyväksyy TIC:ssä
 * (/tic/hanke/[id]). Väärä yritysnimi on asiakkaalle pahempi kuin tyhjä kenttä
 * (D-057, D-072, D-073), joten malli ehdottaa ja ihminen päättää.
 *
 *   npx tsx scripts/suggest-missing-parties.ts
 *   npx tsx scripts/suggest-missing-parties.ts --apply --limit=50
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 5
)

/* Rinnakkaisuus: yksi hanke vie n. 70 s, joten sarjassa 46 kestäisi tunnin. */
const CONCURRENCY = 3

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
  const { normalizeLegacyPhase } = await import("../lib/projects/phases")
  const { suggestProjectParties, isSuggestionEnabled } = await import(
    "../lib/agent/enrichment/suggestProjectParties"
  )

  if (!isSuggestionEnabled()) {
    console.log("ANTHROPIC_API_KEY puuttuu — ei tehdä mitään.")
    return
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select(
        "id, name, city, region, phase, property_type, developer, builder, additional_info, metadata, is_public"
      )
      .eq("status", "active")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const filled = (v: any) =>
    v !== null && v !== undefined && String(v).trim() !== ""

  const targets = rows
    .filter((r: any) => r.is_public !== false)
    .filter((r: any) => {
      const key = normalizeLegacyPhase(r.phase)
      return key === "planning" || key === "construction"
    })
    .filter((r: any) => !filled(r.developer) && !filled(r.builder))
    /* Ilman kuvausta = ei mitään mistä poimia; juuri nämä tarvitsevat haun. */
    .filter(
      (r: any) =>
        String(r.additional_info ?? r.metadata?.description ?? "").length < 200
    )
    /* Ei ehdoteta uudelleen samalle hankkeelle. */
    .filter((r: any) => !r.metadata?.ai_suggestion)
    .slice(0, LIMIT)

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}  |  kohteita ${targets.length}\n`
  )

  let suggested = 0
  let empty = 0
  let index = 0

  async function worker() {
    while (true) {
      const row = targets[index++]
      if (!row) return

      const suggestion = await suggestProjectParties({
        name: row.name,
        city: row.city,
        region: row.region,
        phase: row.phase,
        propertyType: row.property_type,
      })

      if (!suggestion) {
        empty++
        console.log(`  —                    ${String(row.name).slice(0, 52)}`)
        continue
      }

      suggested++
      const cost = suggestion.estimatedCost
        ? ` | ${(suggestion.estimatedCost / 1_000_000).toFixed(1)} M€`
        : ""
      console.log(
        `  [${suggestion.confidence}] ${String(row.name).slice(0, 40).padEnd(42)} ` +
          `${suggestion.developer ?? "-"} / ${suggestion.builder ?? "-"}${cost} ` +
          `(${suggestion.sources.length} lähdettä)`
      )

      if (!APPLY) continue

      const { error } = await supabase
        .from("projects")
        .update({
          metadata: {
            ...(row.metadata ?? {}),
            ai_suggestion: {
              developer: suggestion.developer,
              builder: suggestion.builder,
              estimated_cost: suggestion.estimatedCost,
              confidence: suggestion.confidence,
              sources: suggestion.sources,
              reason: suggestion.reason,
              model: suggestion.model,
              own_development: suggestion.ownDevelopment,
              created_at: new Date().toISOString(),
            },
          },
        })
        .eq("id", row.id)

      if (error) console.log(`     VIRHE: ${error.message}`)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker)
  )

  console.log(`\nehdotus löytyi ${suggested}, ei löytynyt ${empty}`)
  console.log(
    APPLY
      ? "Ehdotukset odottavat hyväksyntää: /tic/hanke?puutteelliset=1"
      : "(kuivaharjoittelu — mitään ei kirjoitettu)"
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
