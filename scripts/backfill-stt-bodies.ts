/*
 * Hakee STT-tiedotteiden leipätekstin riveille jotka jäivät pelkän
 * hakurajapinnan metadescriptionin varaan.
 *
 * MIKSI NIITÄ ON. Täydennysbudjetti on 40 kandidaattia ajossa, ja
 * kandidaatit käsiteltiin lähteen omassa järjestyksessä joka on ajosta
 * toiseen sama. Budjetti kului siis aina samoihin ensimmäisiin, eikä
 * häntä täydentynyt koskaan. Mitattu 12.8.2026: 186 jonoriviä ja 66
 * hyväksyttyä hanketta oli alle 400 merkin kuvauksella.
 *
 * MITÄ LEIPÄTEKSTISSÄ ON. Mitattu esimerkki (Huutoniemen sairaala-alue):
 * kustannusarvio 45 M€ vuosille 2025-2032, suunnittelun aloitus 3/2026,
 * työmaavaihe 2027-2028 ja kolme yritystä rooleineen. Kannassa oli
 * 194 merkkiä, joissa ei ollut näistä yhtäkään.
 *
 * Kunta ja maakunta päätellään vasta leipätekstistä, koska tiivistelmässä
 * ei useinkaan lue paikkakuntaa lainkaan.
 *
 *   npx tsx scripts/backfill-stt-bodies.ts
 *   npx tsx scripts/backfill-stt-bodies.ts --apply
 *   npx tsx scripts/backfill-stt-bodies.ts --apply --limit=50
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "1000"
)

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

const SHORT_DESCRIPTION = 400
const CONCURRENCY = 4

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { fetchSttReleaseBody } = await import("../lib/agent/fetchSttHakuSource")
  const { detectCityFromText } = await import("../lib/agent/detectCityFromText")
  const { getMunicipalityByName } = await import("../lib/geo/municipalities")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string, cols: string) => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  const targets: { table: string; cityCol: string; row: any }[] = []

  for (const [table, cityCol] of [
    ["potential_projects", "municipality"],
    ["projects", "city"],
  ] as const) {
    const rows = await page(table, `id, ${cityCol}, metadata`)
    for (const r of rows) {
      if (r.metadata?.source !== "stt_haku") continue
      if (String(r.metadata?.description ?? "").length >= SHORT_DESCRIPTION) continue
      if (!r.metadata?.source_url) continue
      targets.push({ table, cityCol, row: r })
    }
  }

  const work = targets.slice(0, LIMIT)
  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n` +
      `  taydennettavia: ${targets.length}, kasitellaan ${work.length}\n`
  )

  let fetched = 0
  let failed = 0
  let cityFound = 0
  let updated = 0
  const samples: string[] = []

  let cursor = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < work.length) {
      const item = work[cursor++]
      const { table, cityCol, row } = item

      const body = await fetchSttReleaseBody(row.metadata.source_url)
      if (!body) {
        failed++
        continue
      }
      fetched++

      const city = row[cityCol] ?? detectCityFromText(body)
      const region = city ? (getMunicipalityByName(city)?.region ?? null) : null
      if (!row[cityCol] && city) cityFound++

      if (samples.length < 6) {
        samples.push(
          `  ${String(row.metadata.operation ?? "").slice(0, 44).padEnd(46)} ` +
            `${String(row.metadata.description ?? "").length} -> ${body.length} mrk` +
            (city && !row[cityCol] ? `  kunta=${city}` : "")
        )
      }

      if (!APPLY) continue

      const patch: Record<string, any> = {
        metadata: {
          ...row.metadata,
          description: body.slice(0, 4000),
          ...(region ? { region } : {}),
        },
      }
      if (!row[cityCol] && city) patch[cityCol] = city
      if (table === "projects") {
        patch.additional_info = body.slice(0, 4000)
        if (region) patch.region = region
      }

      const { error } = await supabase.from(table).update(patch).eq("id", row.id)
      if (error) console.log(`  VIRHE ${row.id}: ${error.message}`)
      else updated++
    }
  })

  await Promise.all(workers)

  console.log(`  leipateksti haettu: ${fetched}`)
  console.log(`  haku epaonnistui:   ${failed}`)
  console.log(`  kunta loytyi:       ${cityFound}`)
  if (APPLY) console.log(`  paivitetty:         ${updated}`)
  console.log("\nesimerkkeja:")
  for (const s of samples) console.log(s)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
