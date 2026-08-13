/*
 * Mittaa LLM-kohdetyyppiluokittimen tarkkuuden ENNEN kuin sillä
 * kirjoitetaan mitään.
 *
 * MIKSI KONTROLLIAJO. Tässä projektissa on maksettu oppi siitä mitä
 * tapahtuu ilman: voittajakysely löysi otteilla 0/20 ja näytti
 * todistavan että säännöt ovat valmiit, kunnes kontrolliajo tunnetuilla
 * voittajilla paljasti että vika oli otteissa. Luokitin kirjoittaisi
 * suodattimeen, joten väärä tarkkuus näkyisi asiakkaalle suoraan.
 *
 * KONTROLLIAINEISTO. Rivit joilla sääntöpoimija sai tyypin OTSIKOSTA -
 * ne on mitattu lähes virheettömiksi (193 riviä, silmämääräinen
 * tarkistus). LLM saa vain otsikon ja kuvauksen, ei tallennettua arvoa.
 *
 *   npx tsx scripts/measure-llm-building-type.ts
 *   npx tsx scripts/measure-llm-building-type.ts --n=120
 */
import { readFileSync } from "node:fs"

const N = Number(process.argv.find((a) => a.startsWith("--n="))?.split("=")[1] ?? "100")

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

const CONCURRENCY = 5

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { inferBuildingType } = await import("../lib/agent/buildingType")
  const { scoreBuildingType, isBuildingTypeScorerEnabled } = await import(
    "../lib/agent/quality/scorers/llmBuildingTypeScorer"
  )

  if (!isBuildingTypeScorerEnabled()) {
    console.log("ANTHROPIC_API_KEY puuttuu")
    return
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("projects").select("*").range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const live = rows.filter((r: any) => r.status === "active" && r.is_public !== false)

  /*
   * Kontrolli: sääntöpoimija saa tyypin OTSIKOSTA ja se on sama kuin
   * tallennettu arvo. Nämä ovat ne joihin voi luottaa.
   */
  const control = live
    .map((r: any) => ({ r, expected: inferBuildingType(String(r.name ?? ""), null) }))
    .filter((x) => x.expected && x.r.property_type === x.expected)
    .slice(0, N)

  console.log(`kontrolliaineisto: ${control.length} riviä\n`)

  let cursor = 0
  const results: { name: string; expected: string; got: string | null; conf: number }[] = []

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < control.length) {
        const { r, expected } = control[cursor++]
        const verdict = await scoreBuildingType({
          title: String(r.name ?? ""),
          description: String(r.additional_info ?? r.metadata?.description ?? ""),
        })
        results.push({
          name: String(r.name),
          expected: expected!,
          got: verdict?.type ?? null,
          conf: verdict?.confidence ?? 0,
        })
      }
    })
  )

  const agree = results.filter((x) => x.got === x.expected)
  const blank = results.filter((x) => x.got === null)
  const differ = results.filter((x) => x.got !== null && x.got !== x.expected)

  console.log(`  samaa mieltä: ${agree.length}  (${((agree.length / results.length) * 100).toFixed(0)} %)`)
  console.log(`  jätti tyhjäksi: ${blank.length}`)
  console.log(`  eri mieltä:   ${differ.length}\n`)

  console.log("=== ERI MIELTÄ (nämä ratkaisevat kelpaako) ===")
  for (const d of differ.slice(0, 25)) {
    console.log(`  saanto=${d.expected.padEnd(18)} llm=${String(d.got).padEnd(18)} ${d.name.slice(0, 46)}`)
  }

  console.log("\n=== TYHJAKSI JATETYT ===")
  for (const b of blank.slice(0, 10)) {
    console.log(`  saanto=${b.expected.padEnd(18)} ${b.name.slice(0, 56)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
