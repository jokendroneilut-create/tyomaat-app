import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: mitkä paikannimet eivät tunnistu kunnaksi?
 *
 * getMunicipalityByPlaceName on jaettu kaikkien lähteiden kesken, joten
 * puuttuva nimi kaataa sijainnin myös muualla kuin Hilmassa. Tämä skripti
 * listaa aineistossa oikeasti esiintyvät tuntemattomat nimet, jotta
 * laajennus tehdään mitatusta datasta eikä arvaamalla.
 *
 * Ei kirjoita mitään.
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { getMunicipalityByAnyForm } = await import("../lib/geo/municipalityFromName")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const counts = new Map<string, { n: number; where: Set<string>; sample: string }>()

  const note = (value: unknown, where: string, sample: string) => {
    const name = String(value ?? "").trim()
    if (!name) return
    if (getMunicipalityByAnyForm(name)) return
    const entry = counts.get(name) ?? { n: 0, where: new Set<string>(), sample }
    entry.n++
    entry.where.add(where)
    counts.set(name, entry)
  }

  /* Maakunta on se mikä oikeasti rikkoutuu: ilman sitä hanke ei osu
   * alueittain suodatettuihin näkymiin. */
  let projectsMissingRegion = 0
  const fixableNow: string[] = []

  /* 1. Ehdokkaiden kuntakenttä. */
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("title, municipality")
      .not("municipality", "is", null)
      .range(from, from + 999)
    if (error) throw error
    for (const r of data ?? []) note(r.municipality, "ehdokas", String(r.title ?? ""))
    if (!data || data.length < 1000) break
  }

  /* 2. Hyväksyttyjen hankkeiden kaupunki ja maakunta. */
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("name, city, region")
      .not("city", "is", null)
      .range(from, from + 999)
    if (error) throw error
    for (const r of data ?? []) {
      note(r.city, "hanke", String(r.name ?? ""))
      const resolved = getMunicipalityByAnyForm(r.city)
      if (!(r as any).region) {
        projectsMissingRegion++
        if (resolved) {
          fixableNow.push(`  ${String(r.city).padEnd(24)} -> ${resolved.region.padEnd(20)} ${String(r.name).slice(0, 40)}`)
        }
      }
    }
    if (!data || data.length < 1000) break
  }

  const rows = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)

  console.log(`hankkeita ilman maakuntaa:            ${projectsMissingRegion}`)
  console.log(`  niistä ratkeaisi kuntanimen kautta:  ${fixableNow.length}`)
  for (const r of fixableNow.slice(0, 40)) console.log(r)

  console.log(`\ntuntemattomia paikannimiä: ${rows.length} eri nimeä\n`)
  for (const [name, entry] of rows) {
    console.log(
      `  ${String(entry.n).padStart(4)}x  ${name.padEnd(28)} ${[...entry.where].join("+").padEnd(14)} ${entry.sample.slice(0, 44)}`
    )
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
