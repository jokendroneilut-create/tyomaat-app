/*
 * Poimii arvioidun valmistumisajan hankkeiden jo tallennetusta tekstistä.
 *
 * parseFinnishCompletionDate on ollut olemassa ja toimii, mutta sitä ajettiin
 * vain osassa poimijoita - ei koskaan hankkeiden kuvauksia vasten. Mitattu:
 * estimated_completion oli täytetty 24 hankkeella 4412:sta (1 %), kun teksti
 * antaisi sen 109:lle.
 *
 * Yield kasvoi juuri, koska srv/pohjola_rakennus/lujatalo saivat kuvaukset
 * vasta kun niiden poimijat korjattiin - ne kolme ovat nyt suurimmat
 * yksittäiset lähteet valmistumisajoille.
 *
 * Vain TYHJIÄ kenttiä täytetään; olemassa olevaa arviota ei ylikirjoiteta.
 *
 *   npx tsx scripts/backfill-completion-dates.ts          # kuiva-ajo
 *   npx tsx scripts/backfill-completion-dates.ts --apply
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
  const { parseEstimatedCompletionDate } = await import(
    "../lib/agent/parseFinnishCompletionDate"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, phase, estimated_completion, additional_info")
      .eq("is_public", true)
      .range(from, from + 999)
    if (error) throw error
    projects.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(`${APPLY ? "PÄIVITETÄÄN" : "KUIVA-AJO"} — julkisia hankkeita ${projects.length}\n`)

  const today = new Date().toISOString().slice(0, 10)
  let filled = 0
  let past = 0

  for (const project of projects) {
    if (project.estimated_completion) continue

    const parsed = parseEstimatedCompletionDate(String(project.additional_info ?? ""))
    if (!parsed) continue

    filled++
    const isPast = String(parsed).slice(0, 10) < today
    if (isPast) past++

    if (filled <= 12) {
      console.log(
        `  ${String(parsed).slice(0, 10)}${isPast ? " MENNYT" : "       "}  [${project.phase}] ${String(project.name).slice(0, 52)}`
      )
    }

    if (!APPLY) continue

    const { error } = await supabase
      .from("projects")
      .update({ estimated_completion: parsed })
      .eq("id", project.id)

    if (error) throw error
  }

  console.log(`\nvalmistumisaika lisättiin: ${filled}`)
  console.log(`  joista määräpäivä jo mennyt: ${past}`)
  if (!APPLY) console.log("\nAja --apply kun tulos näyttää oikealta.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
