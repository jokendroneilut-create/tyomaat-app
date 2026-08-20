import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: paljonko otsikkokattavuus tuo UUSIA ehdotuksia jonoon, ja
 * nayttavatko ne mielekkailta? Vertaa samaa logiikkaa kuin reitti:
 * sama kaupunki, vahintaan kaksi yhteista sanaa, kattavuus >= kynnys.
 *
 * Ei kirjoita mitaan.
 */

const THRESHOLD = Number(process.argv.find((a) => a.startsWith("--kynnys="))?.slice(8) ?? 0.6)

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { calculateMatch, titleCoverage } = await import("../lib/agent/projectMatcher")
  const { streetKey } = await import("../lib/projects/streetKey")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("projects")
      .select("id,name,city,region,location,phase,status,completed_at,developer,builder,property_type,metadata")
      .range(from, from + 999)
    projects.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const cands: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from("potential_projects")
      .select("id,title,address,municipality,permit_number,property_id,metadata,status")
      .eq("status", "new").range(from, from + 999)
    cands.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  console.log(`jonossa: ${cands.length} ehdokasta,  hankkeita: ${projects.length}`)
  console.log(`kattavuuden kynnys: ${THRESHOLD}\n`)

  let withNew = 0
  const counts = new Map<number, number>()
  const rows: string[] = []

  for (const c of cands) {
    const meta: any = c.metadata ?? {}
    const normalized = {
      name: meta.operation ?? c.title ?? null,
      sourceTitle: meta.source_title ?? null,
      city: c.municipality ?? null,
      region: meta.region ?? null,
      location: c.address ?? meta.project_address ?? null,
      permitNumber: c.permit_number ?? null,
      propertyId: c.property_id ?? null,
      developer: meta.developer ?? null,
      buildingType: meta.building_type ?? null,
      description: meta.description ?? null,
    }

    const cityKey = String(normalized.city ?? "").trim().toLowerCase()
    if (!cityKey || !normalized.name) continue

    const sameCity = projects.filter(
      (p) => String(p.city ?? "").trim().toLowerCase() === cityKey
    )

    const alreadyIds = new Set<string>()
    for (const p of sameCity) {
      if ((calculateMatch(p, normalized as any)?.confidence ?? 0) >= 30) alreadyIds.add(p.id)
    }
    const ck = streetKey(normalized.location)
    if (ck) for (const p of sameCity) if (streetKey(p.location) === ck) alreadyIds.add(p.id)

    const hits = sameCity.filter((p) => {
      if (alreadyIds.has(p.id)) return false
      const { coverage, sharedWords } = titleCoverage(normalized.name, p.name)
      return sharedWords.length >= 2 && coverage >= THRESHOLD
    })

    if (!hits.length) continue
    withNew++
    counts.set(hits.length, (counts.get(hits.length) ?? 0) + 1)

    for (const p of hits.slice(0, 3)) {
      const { coverage, sharedWords } = titleCoverage(normalized.name, p.name)
      rows.push(
        `  ${coverage.toFixed(2)}  ${String(c.title).slice(0, 52).padEnd(54)}\n         ${String(p.name).slice(0, 70)}\n         yhteiset: ${sharedWords.join(" ")}`
      )
    }
  }

  console.log(`ehdokkaita joille tulee UUSI otsikkoehdotus: ${withNew}`)
  console.log("osumien maara per ehdokas:")
  for (const [n, count] of [...counts].sort((a, b) => a[0] - b[0])) {
    console.log(`  ${n}: ${count} ehdokasta`)
  }
  console.log(`\nkaikki uudet ehdotukset (${rows.length}):`)
  for (const r of rows) console.log(r)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
