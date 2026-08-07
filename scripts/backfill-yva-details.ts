/*
 * Täydentää jo luodut YVA-ehdokkaat.
 *
 * fetchYvaSource pyysi hakuvastaukselta kentät `content` ja `projectType`
 * mutta ei käyttänyt kumpaakaan, ja `developer`/`property_type` oli
 * kovakoodattu nulliksi. Ehdokas syntyi siis pelkän tiivistelmän varassa:
 * mitattu "Halmemäen tuulivoimahanke" sai 78 merkkiä, vaikka samassa
 * vastauksessa oli 8 639 merkin hankekuvaus jossa lukee voimaloiden määrä,
 * teho, korkeus, hankealueen pinta-ala ja rakennuttaja.
 *
 * Poimija on korjattu, mutta korjaus ei koske takautuvasti jonossa olevia
 * ehdokkaita. Tämä hakee YVA-aineiston uudelleen ja täydentää olemassa olevat
 * rivit source_url:n perusteella.
 *
 * Vain TYHJIÄ kenttiä täydennetään. Käsin korjattua tietoa ei ylikirjoiteta,
 * ja kuvaus korvataan vain jos uusi on pidempi - lyhyempi olisi askel
 * taaksepäin.
 *
 *   npx tsx scripts/backfill-yva-details.ts          # kuiva-ajo
 *   npx tsx scripts/backfill-yva-details.ts --apply
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
  const { fetchYvaSource } = await import("../lib/agent/fetchYvaSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const fresh: any[] = await fetchYvaSource()
  const byUrl = new Map<string, any>()
  for (const row of fresh) {
    if (row.source_url) byUrl.set(row.source_url, row)
  }
  console.log(`${APPLY ? "PÄIVITETÄÄN" : "KUIVA-AJO"} — lähteestä ${fresh.length} hanketta\n`)

  const candidates: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, status, metadata")
      .eq("metadata->>source_name", "yva")
      .range(from, from + 999)
    if (error) throw error
    candidates.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  console.log(`kannassa yva-ehdokkaita: ${candidates.length}`)

  let matched = 0
  let gotDescription = 0
  let gotDeveloper = 0
  let gotType = 0
  let unchanged = 0

  for (const candidate of candidates) {
    const metadata = { ...(candidate.metadata ?? {}) }
    const row = byUrl.get(metadata.source_url)

    if (!row) continue
    matched++

    const changes: Record<string, unknown> = {}

    const currentDescription = String(metadata.description ?? "")
    if (row.description && row.description.length > currentDescription.length) {
      changes.description = row.description
      gotDescription++
    }

    if (!metadata.developer && row.developer) {
      changes.developer = row.developer
      gotDeveloper++
    }

    if (!metadata.building_type && row.property_type) {
      changes.building_type = row.property_type
      gotType++
    }

    if (Object.keys(changes).length === 0) {
      unchanged++
      continue
    }

    if (!APPLY) continue

    const { error } = await supabase
      .from("potential_projects")
      .update({
        metadata: { ...metadata, ...changes },
        updated_at: new Date().toISOString(),
      })
      .eq("id", candidate.id)

    if (error) throw error
  }

  console.log(`\nosui lähteeseen:        ${matched}`)
  console.log(`  kuvaus täydentyi:     ${gotDescription}`)
  console.log(`  rakennuttaja lisätty: ${gotDeveloper}`)
  console.log(`  kohdetyyppi lisätty:  ${gotType}`)
  console.log(`  ei muutosta:          ${unchanged}`)
  console.log(`  ei enää lähteessä:    ${candidates.length - matched}`)

  if (!APPLY) console.log("\nAja --apply kun tulos näyttää oikealta.")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
