/*
 * Täydentää kuvauksen yrityslähteiden vanhoille ehdokkaille.
 *
 * srv, pohjola_rakennus, kas_asunnot ja lujatalo laskivat rungon tai otteen
 * avainsanasuodatusta varten mutta jättivät sen palauttamatta, joten kaikki
 * niiden ehdokkaat syntyivät ilman kuvausta - ja hylkäysaste oli 73-96 %,
 * koska pelkän otsikon perusteella korttia ei voi arvioida.
 *
 * Poimijat on korjattu, mutta korjaus ei koske takautuvasti. Toisin kuin
 * YVA:ssa, runko ei tule listaushaussa: se on artikkelisivulla, joten tämä
 * hakee jokaisen ehdokkaan source_urlin erikseen. Siksi pyyntöjen välissä on
 * tauko - lähteet ovat pieniä yrityssivustoja.
 *
 * Vain TYHJIÄ kenttiä täydennetään; käsin korjattua tietoa ei ylikirjoiteta.
 *
 *   npx tsx scripts/backfill-company-descriptions.ts             # kuiva-ajo
 *   npx tsx scripts/backfill-company-descriptions.ts --apply
 *   npx tsx scripts/backfill-company-descriptions.ts --apply --source=srv
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const ONLY = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1]
const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0
)

const SOURCES = ["srv", "pohjola_rakennus", "kas_asunnot", "lujatalo"]
const DELAY_MS = 250
const MIN_LENGTH = 40

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { fetchArticleBody } = await import("../lib/agent/fetchArticleBody")
  const { extractStreetAddress } = await import("../lib/agent/extractStreetAddress")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log(APPLY ? "PÄIVITETÄÄN\n" : "KUIVA-AJO\n")

  const sources = ONLY ? [ONLY] : SOURCES
  let totalFilled = 0
  let totalAddress = 0
  let totalFailed = 0
  let totalSkipped = 0

  for (const source of sources) {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("potential_projects")
        .select("id, title, status, address, metadata")
        .eq("metadata->>source_name", source)
        .range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    const empty = rows.filter((row) => {
      const description = row.metadata?.description
      return !description || String(description).trim().length < MIN_LENGTH
    })

    const work = LIMIT ? empty.slice(0, LIMIT) : empty
    console.log(`=== ${source} === ${rows.length} ehdokasta, ilman kuvausta ${empty.length}${LIMIT ? ` (käsitellään ${work.length})` : ""}`)

    let filled = 0
    let failed = 0
    let skipped = 0

    for (const row of work) {
      const url = row.metadata?.source_url
      if (!url) {
        skipped++
        continue
      }

      const body = await fetchArticleBody(url)
      await sleep(DELAY_MS)

      if (!body || body.length < MIN_LENGTH) {
        failed++
        continue
      }

      filled++

      const address = row.address ?? extractStreetAddress(body)
      if (!row.address && address) totalAddress++

      if (!APPLY) continue

      const { error } = await supabase
        .from("potential_projects")
        .update({
          address,
          metadata: { ...(row.metadata ?? {}), description: body },
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)

      if (error) throw error
    }

    console.log(`   kuvaus saatiin: ${filled}   ei rungoa: ${failed}   ei osoitetta: ${skipped}\n`)
    totalFilled += filled
    totalFailed += failed
    totalSkipped += skipped
  }

  console.log(`YHTEENSÄ kuvaus: ${totalFilled}, katuosoite: ${totalAddress}, epäonnistui: ${totalFailed}, ohitettu: ${totalSkipped}`)
  if (!APPLY) console.log("\nAja --apply kun tulos näyttää oikealta.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
