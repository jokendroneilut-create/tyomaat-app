import { readFileSync } from "node:fs"

/*
 * KOHDENNETTU DUPLIKAATTISKANNAUS TALOYHTIÖILLE (D-171).
 *
 * Viikkocron ajaa inkrementaalisen skannauksen vain viimeksi
 * muuttuneille hankkeille, joten vanhat taloyhtiöparit eivät tule
 * mukaan vaikka sääntö on nyt olemassa. Täysi skannaus kestää
 * kymmeniä minuutteja; tämä rajaa ajon niihin hankkeisiin joilla
 * taloyhtiö ylipäätään on.
 *
 *   npx tsx scripts/scan-housing-duplicates.ts
 *   npx tsx scripts/scan-housing-duplicates.ts --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { projectHousingKey } = await import("../lib/projects/housingCompanyKey")

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,additional_info,metadata")
      .eq("is_public", true)
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const idt = rivit.filter((r) => projectHousingKey(r)).map((r) => r.id)
  console.log(`${rivit.length} julkista hanketta, taloyhtio ${idt.length}:lla`)

  if (!APPLY) {
    console.log("\nKuivaharjoitus: skannausta ei ajettu.")
    return
  }

  const { scanForDuplicates } = await import("../lib/agent/duplicates/scanForDuplicates")
  const tulos = await scanForDuplicates({ projectIds: idt })
  console.log("\n", tulos)
}

main().catch((e) => {
  console.error("VIRHE:", e?.message ?? e)
  process.exit(1)
})
export {}
