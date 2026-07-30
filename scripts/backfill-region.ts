/*
 * backfill-region.ts — täydentää potential_projects-riveiltä puuttuvan
 * metadata.region-kentän samoilla säännöillä kuin hilmaResolver.
 *
 * Taustaa: maakunta johdetaan aina kunnasta, ja jos kunta jäi tunnistamatta
 * hanketta luotaessa, region jäi pysyvästi tyhjäksi — vanhat rivit eivät
 * korjaannu itsestään vaikka tunnistuslogiikkaa parannetaan.
 *
 * Aja projektin juuresta:
 *   npx tsx scripts/backfill-region.ts             (kuiva-ajo, ei muutoksia)
 *   npx tsx scripts/backfill-region.ts --apply     (kirjoittaa muutokset)
 *
 * Ympäristömuuttujat luetaan .env.localista projektin juuresta;
 * DOTENV_PATH=<polku> ohittaa sijainnin (esim. ajettaessa worktreestä).
 *
 * Kirjoittaa VAIN metadata.region-kentän riveille joilla se puuttuu.
 * Ei kosketa riveihin joilla region on jo olemassa.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createClient } from "@supabase/supabase-js"
import {
  getMunicipalityByPlaceName,
  municipalityFromBuyerName,
  isCityCorroboratedByText,
  extractCityFromBuyerAddress,
} from "../lib/geo/municipalityFromName"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const ENV_FILE = process.env.DOTENV_PATH ?? join(ROOT, ".env.local")

try {
  for (const line of readFileSync(ENV_FILE, "utf8").replace(/\r/g, "").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
} catch {
  console.error(`Ympäristötiedostoa ei löytynyt: ${ENV_FILE}`)
  process.exit(1)
}

const APPLY = process.argv.includes("--apply")

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type Row = {
  id: string
  title: string | null
  municipality: string | null
  metadata: Record<string, any> | null
}

/*
 * Sama päättelyjärjestys kuin hilmaResolverissa, vahvimmasta heikoimpaan.
 * LLM-poimintaa ei ajeta: backfill käyttää vain sitä mitä riville on jo
 * tallennettu, jolloin ajo on deterministinen ja ilmainen.
 */
function resolveRegion(row: Row): { region: string; rule: string } | null {
  const md = row.metadata ?? {}

  // 1. Kunta on jo tiedossa - vain maakunta puuttuu.
  const fromColumn = getMunicipalityByPlaceName(row.municipality)
  if (fromColumn) return { region: fromColumn.region, rule: "municipality-sarake" }

  // 2. Tilaajan nimi kertoo kunnan ("Janakkalan kunta").
  const fromBuyerName = municipalityFromBuyerName(md.developer)
  if (fromBuyerName) return { region: fromBuyerName.region, rule: "tilaajan nimi" }

  // 3. Tilaajan osoitteen kaupunki, mutta vain jos ilmoituksen oma teksti
  //    tukee samaa kaupunkia (valtakunnallinen toimija voi kilpailuttaa
  //    hankkeen missä tahansa - sen kotiosoite ei kerro työmaan sijaintia).
  const buyerCity = extractCityFromBuyerAddress(md.buyer_address)
  const fromBuyerAddress = getMunicipalityByPlaceName(buyerCity)
  if (
    fromBuyerAddress &&
    isCityCorroboratedByText(fromBuyerAddress.name, md.description, md.developer)
  ) {
    return { region: fromBuyerAddress.region, rule: "tilaajan osoite + teksti" }
  }

  return null
}

async function main() {
  console.log(APPLY ? "TILA: kirjoitetaan muutokset" : "TILA: kuiva-ajo, ei muutoksia")

  const rows: Row[] = []
  const PAGE = 1000

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, municipality, metadata")
      .is("metadata->>region", null)
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    rows.push(...(data as Row[]))
    if (data.length < PAGE) break
  }

  console.log(`rivejä joilta region puuttuu: ${rows.length}\n`)

  const byRule: Record<string, number> = {}
  const byRegion: Record<string, number> = {}
  const updates: { id: string; metadata: Record<string, any> }[] = []
  const unresolved: Row[] = []

  for (const row of rows) {
    const resolved = resolveRegion(row)

    if (!resolved) {
      unresolved.push(row)
      continue
    }

    byRule[resolved.rule] = (byRule[resolved.rule] ?? 0) + 1
    byRegion[resolved.region] = (byRegion[resolved.region] ?? 0) + 1
    updates.push({
      id: row.id,
      metadata: { ...(row.metadata ?? {}), region: resolved.region },
    })
  }

  console.log(`ratkeaa:      ${updates.length}`)
  console.log(`jää auki:     ${unresolved.length}\n`)
  console.log("säännöittäin:", JSON.stringify(byRule, null, 1))
  console.log(
    "\nmaakunnittain:",
    JSON.stringify(
      Object.fromEntries(Object.entries(byRegion).sort((a, b) => b[1] - a[1])),
      null,
      1
    )
  )

  console.log("\n--- otos ratkeavista (10) ---")
  for (const u of updates.slice(0, 10)) {
    const row = rows.find((r) => r.id === u.id)!
    console.log(
      `${u.metadata.region.padEnd(20)} | ${String(row.title).slice(0, 45).padEnd(45)} | ` +
        `muni=${JSON.stringify(row.municipality)} dev=${JSON.stringify(
          (row.metadata ?? {}).developer
        )}`
    )
  }

  console.log("\n--- otos auki jäävistä (10) ---")
  for (const row of unresolved.slice(0, 10)) {
    const md = row.metadata ?? {}
    console.log(
      `${String(row.title).slice(0, 45).padEnd(45)} | muni=${JSON.stringify(
        row.municipality
      )} dev=${JSON.stringify(md.developer)} buyer=${JSON.stringify(md.buyer_address)}`
    )
  }

  if (!APPLY) {
    console.log("\nKuiva-ajo valmis. Aja --apply kirjoittaaksesi muutokset.")
    return
  }

  let written = 0
  let failed = 0

  for (const u of updates) {
    /*
     * Ehto region is null on tahallinen: jos putki on ehtinyt täyttää
     * maakunnan lukemisen jälkeen, sitä ei ylikirjoiteta tällä vanhalla
     * metadata-kopiolla.
     */
    const { error } = await supabase
      .from("potential_projects")
      .update({ metadata: u.metadata })
      .eq("id", u.id)
      .is("metadata->>region", null)

    if (error) {
      failed++
      console.error(`VIRHE ${u.id}: ${error.message}`)
      continue
    }

    written++
    if (written % 100 === 0) console.log(`kirjoitettu ${written}/${updates.length}…`)
  }

  console.log(`\nvalmis: kirjoitettu ${written}, virheitä ${failed}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
