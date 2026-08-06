/*
 * Täydentää katselmointijonossa olevien ehdokkaiden puuttuvan kunnan.
 *
 * Kaupungiton ehdokas ei voi osua olemassa olevaan hankkeeseen: täsmäytyksen
 * todisteportti vaatii tarkan osoitteen, nimitodisteen, vahvan tunnisteen tai
 * rakennuttaja+kaupunki -parin. Ilman kuntaa yksikään ei voi täyttyä, joten
 * ehdokas ei saa yhtään pistettä eikä ehdotuksia näy. Hyväksyttynä se ei
 * myöskään päädy kenenkään aluesyötteeseen, koska maakuntasuodatus on
 * SQL-vertailu eikä NULL täsmää siihen koskaan.
 *
 * Sama kahden äänen sääntö kuin scripts/backfill-region.ts:ssä: malli kysytään
 * kahdesti ja vain yksimielinen vastaus hyväksytään. Erimielisyys paljastaa
 * rivit joilla malli arvaa.
 *
 *   npx tsx scripts/backfill-candidate-city.ts
 *   npx tsx scripts/backfill-candidate-city.ts --apply
 *   npx tsx scripts/backfill-candidate-city.ts --status=new
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const STATUS =
  process.argv.find((a) => a.startsWith("--status="))?.split("=")[1] ?? "new"

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

const CONCURRENCY = 4

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractProjectMunicipality } = await import(
    "../lib/agent/identity/extractProjectMunicipality"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabase
    .from("potential_projects")
    .select("id, title, municipality, metadata")
    .eq("status", STATUS)

  if (error) throw error

  const targets = (data ?? []).filter((c: any) => !c.municipality)

  console.log(`status = ${STATUS}: ${data?.length ?? 0} ehdokasta, ${targets.length} ilman kuntaa\n`)
  if (targets.length === 0) return

  /*
   * Kaksi ääntä: hyväksytään vain jos molemmat kyselyt päätyvät samaan
   * kuntaan. Malli validoi vastauksen kuntarekisteriä vasten, joten
   * olematonta kuntaa ei voi syntyä - tämä suojaa arvaukselta.
   */
  async function agreedGuess(candidate: any) {
    const input = {
      title: candidate.title,
      description: candidate.metadata?.description ?? null,
      developer: candidate.metadata?.developer ?? null,
    }

    const [first, second] = await Promise.all([
      extractProjectMunicipality(input),
      extractProjectMunicipality(input),
    ])

    if (!first.municipality || !second.municipality) {
      return { municipality: null, evidence: first.evidence ?? second.evidence, disagreed: false }
    }

    if (first.municipality.name !== second.municipality.name) {
      return {
        municipality: null,
        evidence: `${first.municipality.name} vs ${second.municipality.name}`,
        disagreed: true,
      }
    }

    return { municipality: first.municipality, evidence: first.evidence, disagreed: false }
  }

  const results: any[] = []
  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const guesses = await Promise.all(
      batch.map(async (c: any) => ({ candidate: c, guess: await agreedGuess(c) }))
    )
    results.push(...guesses)
    process.stdout.write(`\rkysytty ${results.length}/${targets.length}`)
  }
  console.log("\n")

  const resolved = results.filter((r) => r.guess.municipality)
  const disagreed = results.filter((r) => r.guess.disagreed)
  const empty = results.filter((r) => !r.guess.municipality && !r.guess.disagreed)

  for (const r of results) {
    const label = r.guess.municipality
      ? `${r.guess.municipality.name} (${r.guess.municipality.region})`
      : r.guess.disagreed
        ? `ERIMIELISYYS: ${r.guess.evidence}`
        : "ei sijaintia"
    console.log(`  ${String(r.candidate.title).slice(0, 52).padEnd(54)} -> ${label}`)
    if (r.guess.municipality && r.guess.evidence) {
      console.log(`     peruste: ${String(r.guess.evidence).slice(0, 90)}`)
    }
  }

  console.log(
    `\nratkesi ${resolved.length}, erimielisyys ${disagreed.length}, ei sijaintia ${empty.length}`
  )

  if (!APPLY) {
    console.log("\nkuivaharjoitus — aja --apply kirjoittaaksesi")
    return
  }

  let done = 0
  for (const r of resolved) {
    const { error: updateError } = await supabase
      .from("potential_projects")
      .update({
        municipality: r.guess.municipality.name,
        updated_at: new Date().toISOString(),
        metadata: {
          ...(r.candidate.metadata ?? {}),
          region: r.guess.municipality.region,
          municipality_source: "llm_backfill",
          municipality_evidence: r.guess.evidence ?? null,
        },
      })
      .eq("id", r.candidate.id)
      .is("municipality", null)

    if (updateError) throw updateError
    done += 1
  }

  console.log(`\nvalmis: ${done} ehdokkaalle asetettu kunta`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
