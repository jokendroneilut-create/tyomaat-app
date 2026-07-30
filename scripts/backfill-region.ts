/*
 * backfill-region.ts — täydentää potential_projects-riveiltä puuttuvan
 * metadata.region-kentän samoilla säännöillä kuin hilmaResolver.
 *
 * Taustaa: maakunta johdetaan aina kunnasta, ja jos kunta jäi tunnistamatta
 * hanketta luotaessa, region jäi pysyvästi tyhjäksi — vanhat rivit eivät
 * korjaannu itsestään vaikka tunnistuslogiikkaa parannetaan.
 *
 * Aja projektin juuresta:
 *   npx tsx scripts/backfill-region.ts                        (kuiva-ajo)
 *   npx tsx scripts/backfill-region.ts --apply                (kirjoittaa)
 *   npx tsx scripts/backfill-region.ts --table=projects       (hyväksytyt)
 *   npx tsx scripts/backfill-region.ts --llm                  (+ mallipäättely)
 *
 * --llm ajaa deterministisiltä säännöiltä auki jääneet rivit mallille
 * (extractProjectMunicipality). Vaatii ANTHROPIC_API_KEY:n. Ilman lippua
 * ajo on täysin deterministinen eikä tee yhtään API-kutsua.
 *
 * Taulut: potential_projects (oletus, TIC:n kandidaatit, metadata.region)
 * ja projects (hyväksytyt hankkeet, region-sarake - tämä näkyy kartalla).
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
  getMunicipalityByAnyForm,
  municipalityFromBuyerName,
  isCityCorroboratedByText,
  extractCityFromBuyerAddress,
} from "../lib/geo/municipalityFromName"
import { extractProjectMunicipality } from "../lib/agent/identity/extractProjectMunicipality"

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
const USE_LLM = process.argv.includes("--llm")
const LLM_MODEL = process.argv
  .find((a) => a.startsWith("--llm-model="))
  ?.split("=")[1]

/*
 * Malliajo rinnakkain muutamalla pyynnöllä: 300 riviä peräkkäin kestäisi
 * turhaan minuutteja, mutta korkea rinnakkaisuus törmäisi rate limitteihin.
 */
const LLM_CONCURRENCY = 4

/*
 * Jokainen rivi kysytään kahdesti ja vain yksimielinen vastaus kelpaa.
 * Erimielisyys paljastaa rivit joilla mallilla ei ole tarpeeksi tietoa ja se
 * käytännössä arvaa: esim. "Kesäterveiset Runosta" (pelkkä otsikko, ei
 * kuvausta) tuotti sekä Vaasan että Vantaan. Kaksinkertainen kysely maksaa
 * senttejä, väärä maakunta maksaa käyttäjän luottamuksen.
 */
async function agreedGuess(
  ask: () => Promise<Awaited<ReturnType<typeof extractProjectMunicipality>>>
) {
  const [a, b] = await Promise.all([ask(), ask()])

  const agree =
    a.municipality != null && a.municipality.code === b.municipality?.code

  return { guess: agree ? a : null, a, b }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = next++
        if (i >= items.length) return
        results[i] = await fn(items[i], i)
      }
    })
  )

  return results
}

const TABLE =
  process.argv.find((a) => a.startsWith("--table="))?.split("=")[1] ??
  "potential_projects"

if (TABLE !== "potential_projects" && TABLE !== "projects") {
  console.error(`Tuntematon taulu: ${TABLE}`)
  process.exit(1)
}

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

async function backfillPotentialProjects() {
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

  const llmNotes = new Map<string, string>()

  if (USE_LLM && unresolved.length > 0) {
    console.log(`mallipäättely ${unresolved.length} riville…\n`)

    const guesses = await mapWithConcurrency(unresolved, LLM_CONCURRENCY, (row) => {
      const md = row.metadata ?? {}
      return agreedGuess(() =>
        extractProjectMunicipality({
          title: row.title,
          description: md.description,
          developer: md.developer,
          model: LLM_MODEL,
        })
      )
    })

    const stillOpen: Row[] = []
    let disagreements = 0

    unresolved.forEach((row, i) => {
      const { guess, a, b } = guesses[i]

      if (!guess?.municipality) {
        if (a.municipality?.code !== b.municipality?.code) {
          disagreements++
          console.log(
            `  erimielisyys: ${String(row.title).slice(0, 45)} — ` +
              `${a.municipality?.name ?? "-"} vs ${b.municipality?.name ?? "-"}`
          )
        }
        stillOpen.push(row)
        return
      }

      byRule["malli"] = (byRule["malli"] ?? 0) + 1
      byRegion[guess.municipality.region] =
        (byRegion[guess.municipality.region] ?? 0) + 1
      llmNotes.set(
        row.id,
        `${guess.municipality.name} — ${guess.evidence ?? "(ei perustelua)"}`
      )
      updates.push({
        id: row.id,
        metadata: {
          ...(row.metadata ?? {}),
          region: guess.municipality.region,
        },
      })
    })

    if (disagreements > 0) {
      console.log(`\n  hylätty erimielisyyden takia: ${disagreements}`)
    }

    unresolved.length = 0
    unresolved.push(...stillOpen)
  }

  console.log(`\nratkeaa:      ${updates.length}`)
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

  if (llmNotes.size > 0) {
    console.log(`\n--- mallin päättelemät (${llmNotes.size}) ---`)
    for (const [id, note] of llmNotes) {
      const row = rows.find((r) => r.id === id)!
      console.log(`${String(row.title).slice(0, 50).padEnd(52)} → ${note}`)
    }
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

type ProjectRow = {
  id: string
  name: string | null
  city: string | null
  developer: string | null
}

/*
 * Hyväksytyt hankkeet: region on oma sarakkeensa ja se ohjaa kartan
 * maakuntasuodatinta. Sijaintitietoa on vähemmän kuin kandidaateilla
 * (ei metadataa), joten säännöt ovat kaupunki-sarake ja tilaajan nimi.
 */
async function backfillProjects() {
  console.log(APPLY ? "TILA: kirjoitetaan muutokset" : "TILA: kuiva-ajo, ei muutoksia")

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, city, developer")
    .is("region", null)

  if (error) throw error

  const rows = (data ?? []) as ProjectRow[]
  console.log(`rivejä joilta region puuttuu: ${rows.length}\n`)

  const byRule: Record<string, number> = {}
  const updates: { id: string; region: string }[] = []
  const unresolved: ProjectRow[] = []

  for (const row of rows) {
    const fromCity = getMunicipalityByAnyForm(row.city)
    const fromBuyer = fromCity ? null : municipalityFromBuyerName(row.developer)
    const resolved = fromCity ?? fromBuyer

    if (!resolved) {
      unresolved.push(row)
      continue
    }

    const rule = fromCity ? "city-sarake" : "tilaajan nimi"
    byRule[rule] = (byRule[rule] ?? 0) + 1
    updates.push({ id: row.id, region: resolved.region })
  }

  const llmNotes = new Map<string, string>()

  if (USE_LLM && unresolved.length > 0) {
    console.log(`mallipäättely ${unresolved.length} riville…\n`)

    const guesses = await mapWithConcurrency(unresolved, LLM_CONCURRENCY, (row) =>
      agreedGuess(() =>
        extractProjectMunicipality({
          title: row.name,
          developer: row.developer,
          model: LLM_MODEL,
        })
      )
    )

    const stillOpen: ProjectRow[] = []

    unresolved.forEach((row, i) => {
      const { guess, a, b } = guesses[i]

      if (!guess?.municipality) {
        if (a.municipality?.code !== b.municipality?.code) {
          console.log(
            `  erimielisyys: ${String(row.name).slice(0, 45)} — ` +
              `${a.municipality?.name ?? "-"} vs ${b.municipality?.name ?? "-"}`
          )
        }
        stillOpen.push(row)
        return
      }

      byRule["malli"] = (byRule["malli"] ?? 0) + 1
      llmNotes.set(
        row.id,
        `${guess.municipality.name} — ${guess.evidence ?? "(ei perustelua)"}`
      )
      updates.push({ id: row.id, region: guess.municipality.region })
    })

    unresolved.length = 0
    unresolved.push(...stillOpen)
  }

  console.log(`ratkeaa:      ${updates.length}`)
  console.log(`jää auki:     ${unresolved.length}\n`)
  console.log("säännöittäin:", JSON.stringify(byRule, null, 1))

  console.log("\n--- ratkeavat ---")
  for (const u of updates) {
    const row = rows.find((r) => r.id === u.id)!
    const note = llmNotes.get(u.id)
    console.log(
      `${u.region.padEnd(18)} | ${note ? "malli " : "sääntö"} | ` +
        `${String(row.name).slice(0, 44).padEnd(46)}` +
        (note ? ` → ${note}` : ` city=${JSON.stringify(row.city)}`)
    )
  }

  if (!APPLY) {
    console.log("\nKuiva-ajo valmis. Aja --apply kirjoittaaksesi muutokset.")
    return
  }

  let written = 0
  let failed = 0

  for (const u of updates) {
    const { error: updateError } = await supabase
      .from("projects")
      .update({ region: u.region })
      .eq("id", u.id)
      .is("region", null)

    if (updateError) {
      failed++
      console.error(`VIRHE ${u.id}: ${updateError.message}`)
      continue
    }

    written++
  }

  console.log(`\nvalmis: kirjoitettu ${written}, virheitä ${failed}`)
}

const run = TABLE === "projects" ? backfillProjects : backfillPotentialProjects

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
