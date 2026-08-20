import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HILMAN SUORITUSPAIKKA TAKAUTUVASTI.
 *
 * Ilmoituksen rakenteista suorituspaikkaa (eForms BT-5101) ei ole luettu
 * aiemmin, joten osoite on jäänyt tyhjäksi aina kun sitä ei saatu vapaasta
 * kuvaustekstistä. Tämä skripti täydentää jo kerätyt ehdokkaat ja niistä
 * hyväksytyt hankkeet.
 *
 * EI KOSKAAN YLIKIRJOITA. Vain tyhjä kenttä täytetään. Jos ilmoituksessa on
 * useampi eri työmaa, osoite jätetään tyhjäksi (ks. parseRealizedLocation).
 *
 * KUNTA VAIN JOS SE TUNNISTUU. Kenttä voi sisältää kylän ("Sirkka"), jota
 * kuntaluettelo ei tunne. Silloin osoite otetaan mutta kunta jätetään.
 *
 * Aja ensin ilman --apply-lippua ja lue tuotos riveittäin.
 */

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0)
const CONCURRENCY = 4

const noticeIdFrom = (url: string): string | null =>
  url.match(/enotice\/(\d+)/)?.[1] ?? url.match(/procurement\/(\d+)/)?.[1] ?? null

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++
      if (index >= items.length) return
      results[index] = await fn(items[index])
    }
  })
  await Promise.all(workers)
  return results
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { fetchHilmaRealizedLocation } = await import("../lib/agent/hilmaRealizedLocation")
  const { getMunicipalityByPlaceName } = await import("../lib/geo/municipalityFromName")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* 1. Hilma-ehdokkaat, joilta puuttuu osoite tai kunta. */
  const candidates: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, status, address, municipality, metadata")
      .not("metadata->>procedure_id", "is", null)
      .range(from, from + 999)
    if (error) throw error
    candidates.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const incomplete = candidates.filter((c) => !c.address || !c.municipality)
  const targets = LIMIT > 0 ? incomplete.slice(0, LIMIT) : incomplete

  console.log(`Hilma-ehdokkaita:              ${candidates.length}`)
  console.log(`  osoite tai kunta puuttuu:    ${incomplete.length}`)
  console.log(`  haetaan nyt:                 ${targets.length}\n`)

  /* 2. Ehdokkaasta syntynyt hanke tunnisteiden kautta. */
  const projectByCandidate = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("project_identifiers")
      .select("potential_project_id, project_id")
      .eq("identifier_type", "hilma_procedure_id")
      .not("project_id", "is", null)
      .range(from, from + 999)
    if (error) throw error
    for (const row of data ?? []) {
      if (row.potential_project_id) {
        projectByCandidate.set(String(row.potential_project_id), String(row.project_id))
      }
    }
    if (!data || data.length < 1000) break
  }

  const projectIds = [...new Set([...projectByCandidate.values()])]
  const projects = new Map<string, any>()
  for (let i = 0; i < projectIds.length; i += 100) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, location, city, region, metadata")
      .in("id", projectIds.slice(i, i + 100))
    if (error) throw error
    for (const p of data ?? []) projects.set(String(p.id), p)
  }
  console.log(`kytkettyjä hankkeita:          ${projects.size}\n`)

  /* 3. Haku. */
  let fetched = 0
  const results = await mapWithConcurrency(targets, CONCURRENCY, async (c) => {
    const procedureId = String(c.metadata?.procedure_id ?? "")
    const noticeId =
      String(c.metadata?.notice_id ?? "") ||
      noticeIdFrom(String(c.metadata?.source_url ?? "")) ||
      ""
    const notice = await fetchHilmaRealizedLocation(procedureId, noticeId)
    fetched++
    if (fetched % 50 === 0) console.log(`  ...haettu ${fetched}/${targets.length}`)
    return { candidate: c, notice }
  })

  /* 4. Muutosten kokoaminen. */
  let candidateAddress = 0, candidateCity = 0, projectAddress = 0, projectCity = 0
  let unknownCity = 0, nothing = 0
  const rows: string[] = []
  /* Tunnistamattomat nimet listataan, jotta kuntaluetteloa voi laajentaa
   * mitatusta datasta eikä arvaamalla. */
  const unknownNames = new Map<string, number>()

  for (const { candidate, notice } of results) {
    const municipality = notice.city ? getMunicipalityByPlaceName(notice.city)?.name ?? null : null
    if (notice.city && !municipality) {
      unknownCity++
      unknownNames.set(notice.city, (unknownNames.get(notice.city) ?? 0) + 1)
    }

    const newAddress = !candidate.address && notice.address ? notice.address : null
    const newCity = !candidate.municipality && municipality ? municipality : null

    const project = projects.get(projectByCandidate.get(String(candidate.id)) ?? "")
    const newProjectAddress = project && !project.location && notice.address ? notice.address : null
    const newProjectCity = project && !project.city && municipality ? municipality : null

    if (!newAddress && !newCity && !newProjectAddress && !newProjectCity) { nothing++; continue }

    if (newAddress) candidateAddress++
    if (newCity) candidateCity++
    if (newProjectAddress) projectAddress++
    if (newProjectCity) projectCity++

    const marks = [
      newAddress ? "osoite" : null,
      newCity ? "kunta" : null,
      newProjectAddress || newProjectCity ? "HANKE" : null,
    ].filter(Boolean).join("+")

    rows.push(
      `  ${marks.padEnd(20)} ${String(candidate.title).slice(0, 38).padEnd(40)} ${newAddress ?? candidate.address ?? "-"} | ${newCity ?? candidate.municipality ?? "-"}`
    )

    if (!APPLY) continue

    if (newAddress || newCity) {
      await supabase
        .from("potential_projects")
        .update({
          ...(newAddress ? { address: newAddress } : {}),
          ...(newCity ? { municipality: newCity } : {}),
          metadata: {
            ...(candidate.metadata ?? {}),
            ...(newAddress ? { project_address: newAddress } : {}),
            field_sources: {
              ...(candidate.metadata?.field_sources ?? {}),
              ...(newAddress ? { location: "ilmoituksen suorituspaikka" } : {}),
            },
          },
        })
        .eq("id", candidate.id)
    }

    if (project && (newProjectAddress || newProjectCity)) {
      await supabase
        .from("projects")
        .update({
          ...(newProjectAddress ? { location: newProjectAddress } : {}),
          /*
           * Maakunta on asetettava samalla. Ilman sitä hanke saa kaupungin
           * mutta jää pois alueittain suodatetuista näkymistä — juuri niin
           * kävi ensimmäisessä ajossa 21.8.2026 (6 hanketta).
           */
          ...(newProjectCity
            ? {
                city: newProjectCity,
                ...(project.region
                  ? {}
                  : { region: getMunicipalityByPlaceName(newProjectCity)?.region ?? null }),
              }
            : {}),
          metadata: {
            ...(project.metadata ?? {}),
            location_backfilled_from: "hilma_realized_location",
            location_backfilled_at: new Date().toISOString(),
          },
        })
        .eq("id", project.id)
    }
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`ehdokkaalle osoite:            ${candidateAddress}`)
  console.log(`ehdokkaalle kunta:             ${candidateCity}`)
  console.log(`hankkeelle osoite:             ${projectAddress}`)
  console.log(`hankkeelle kunta:              ${projectCity}`)
  console.log(`kaupunki ei tunnistu kunnaksi: ${unknownCity}`)
  console.log(`ei muutosta:                   ${nothing}`)

  if (unknownNames.size) {
    console.log(`\ntunnistamattomat paikannimet (${unknownNames.size}):`)
    for (const [name, n] of [...unknownNames].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)}x  ${name}`)
    }
  }

  console.log(`\nrivit (${rows.length}):`)
  for (const r of rows) console.log(r)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
