/*
 * Vie kilpailutuksen voittaja strukturoituun builder-kenttään niille
 * hankkeille joilla voittaja on tiedossa metadatassa mutta kenttä on tyhjä.
 *
 * Voittaja näkyy hankekortin "Rakennusliike"-kohdassa ja listanäkymässä vain
 * builder-sarakkeesta; pelkkä metadata.winners ei riitä, eikä hankehaku
 * löydä sitä. Tarkistaa samalla ettei kenttään ole päätynyt yhden kirjaimen
 * arvoja (ks. lib/projects/winnerName.ts).
 *
 *   npx tsx scripts/backfill-builder-from-winner.ts
 *   npx tsx scripts/backfill-builder-from-winner.ts --apply
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
  const { resolveWinnerName } = await import("../lib/projects/winnerName")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, city, phase, builder, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const suspicious = rows.filter(
    (r) => r.builder && String(r.builder).trim().length <= 2
  )
  if (suspicious.length > 0) {
    console.log(`VAROITUS: ${suspicious.length} hankkeella epäilyttävän lyhyt urakoitsija`)
    for (const r of suspicious) {
      console.log(`  ${r.id.slice(0, 8)} ${JSON.stringify(r.builder)} "${r.name}"`)
    }
    console.log()
  }

  const plan = rows
    .filter((r) => !r.builder)
    .map((r) => ({ row: r, winner: resolveWinnerName(r.metadata) }))
    .filter((p): p is { row: any; winner: string } => Boolean(p.winner))

  console.log(`hankkeita: ${rows.length}`)
  console.log(`voittaja tiedossa mutta urakoitsija tyhjä: ${plan.length}\n`)

  for (const p of plan) {
    console.log(
      `  ${String(p.row.name).slice(0, 46).padEnd(48)} ${String(p.row.city ?? "-").padEnd(14)} -> ${p.winner}`
    )
  }

  if (!APPLY) {
    console.log("\nkuivaharjoitus — aja --apply kirjoittaaksesi")
    return
  }

  let done = 0
  for (const p of plan) {
    const { error } = await supabase
      .from("projects")
      .update({
        builder: p.winner,
        last_verified_at: new Date().toISOString(),
      })
      .eq("id", p.row.id)

    if (error) throw error
    done += 1
  }

  console.log(`\nvalmis: ${done} hankkeelle asetettu urakoitsija`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
