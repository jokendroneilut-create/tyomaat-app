/*
 * Täydentää vanhat stt_haku-ehdokkaat tiedotteen leipätekstillä.
 *
 * Lähde poimi aiemmin vain hakutuloksen metadescriptionin (150-250 merkkiä),
 * joten osoite, tilaaja, laajuus, kustannusarvio ja aikataulu jäivät
 * hakematta. Uudet ajot hakevat tiedotesivun itse (enrich-koukku), mutta
 * vanhat rivit eivät täydenny: niiden osoitteet ovat jo "nähtyjen" joukossa,
 * joten kerääjä ohittaa ne.
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-stt-details.ts
 *   npx tsx scripts/backfill-stt-details.ts --apply
 *   npx tsx scripts/backfill-stt-details.ts --apply --limit=25
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0
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

/*
 * Maltillinen rinnakkaisuus: jokainen rivi on yksi pyyntö sttinfo.fi:hin.
 */
const CONCURRENCY = 4

const isEmpty = (value: unknown) =>
  value == null || String(value).trim() === ""

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { enrichSttCandidate } = await import("../lib/agent/fetchSttHakuSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, status, address, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  let targets = rows.filter((r: any) => {
    const md = r.metadata ?? {}
    if ((md.source_name ?? md.source) !== "stt_haku") return false
    if (!md.source_url) return false
    // Jo täydennetyt ohitetaan.
    return !md.enriched_at
  })

  if (LIMIT > 0) targets = targets.slice(0, LIMIT)

  console.log(`stt_haku-ehdokkaita täydennettävänä: ${targets.length}\n`)
  if (targets.length === 0) return

  const results: any[] = []

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    const batch = targets.slice(i, i + CONCURRENCY)
    const done = await Promise.all(
      batch.map(async (row: any) => {
        const md = row.metadata ?? {}
        try {
          const enriched = await enrichSttCandidate({
            name: md.source_title ?? row.title,
            description: md.description ?? null,
            developer: md.developer ?? null,
            builder: md.builder ?? null,
            location: row.address ?? null,
            source_url: md.source_url,
          })
          return { row, enriched }
        } catch (error: any) {
          return { row, enriched: null, error: error?.message ?? String(error) }
        }
      })
    )
    results.push(...done)
    process.stdout.write(`\rhaettu ${results.length}/${targets.length}`)
  }
  console.log("\n")

  /*
   * Muutossäännöt, tarkoituksella varovaiset:
   *  - kuvaus korvataan vain jos uusi on pidempi (enemmän tietoa)
   *  - rakennuttaja korvataan vain jos teksti nimesi tilaajan JA nykyinen
   *    arvo on juuri se julkaisija joka siirtyy urakoitsijaksi
   *  - urakoitsija ja osoite täytetään vain tyhjään
   *
   * Käsin muokattua arvoa ei siis ylikirjoiteta muuten kuin tunnetusti
   * väärän rakennuttajan osalta.
   */
  const plan: any[] = []

  for (const { row, enriched, error } of results) {
    if (error || !enriched) continue

    const md = row.metadata ?? {}
    const changes: Record<string, any> = {}

    const oldDescription = String(md.description ?? "")
    const newDescription = String(enriched.description ?? "")
    if (newDescription.length > oldDescription.length) {
      changes.description = enriched.description
    }

    const publisherMovedToBuilder =
      enriched.builder && md.developer && enriched.builder === md.developer

    if (enriched.developer && (isEmpty(md.developer) || publisherMovedToBuilder)) {
      if (enriched.developer !== md.developer) changes.developer = enriched.developer
    }

    if (enriched.builder && isEmpty(md.builder)) changes.builder = enriched.builder
    if (enriched.location && isEmpty(row.address)) changes.address = enriched.location

    if (Object.keys(changes).length > 0) plan.push({ row, changes })
  }

  const failed = results.filter((r) => r.error || !r.enriched)

  console.log(`muuttuu: ${plan.length}, ei muutosta: ${results.length - plan.length - failed.length}, haku epäonnistui: ${failed.length}\n`)

  for (const p of plan.slice(0, 20)) {
    console.log(`  "${String(p.row.title).slice(0, 50)}"`)
    for (const [key, value] of Object.entries(p.changes)) {
      const before = key === "address" ? p.row.address : (p.row.metadata ?? {})[key]
      const show = (v: any) =>
        key === "description" ? `${String(v ?? "").length} merkkiä` : JSON.stringify(v)
      console.log(`     ${key.padEnd(12)} ${show(before)} -> ${show(value)}`)
    }
  }
  if (plan.length > 20) console.log(`  ... ja ${plan.length - 20} muuta`)

  if (!APPLY) {
    console.log("\nkuivaharjoitus — aja --apply kirjoittaaksesi")
    return
  }

  let done = 0
  for (const { row, changes } of plan) {
    const md = row.metadata ?? {}
    const { address, ...metadataChanges } = changes

    const { error } = await supabase
      .from("potential_projects")
      .update({
        ...(address ? { address } : {}),
        updated_at: new Date().toISOString(),
        metadata: {
          ...md,
          ...metadataChanges,
          enriched_at: new Date().toISOString(),
        },
      })
      .eq("id", row.id)

    if (error) throw error
    done += 1
    if (done % 20 === 0) process.stdout.write(`\rpäivitetty ${done}/${plan.length}`)
  }

  console.log(`\nvalmis: ${done} ehdokasta täydennetty`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
