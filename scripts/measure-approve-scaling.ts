import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: milla hankemaaralla hyvaksynnan sumea tasmaytys tulee seinaan?
 *
 * Hyvaksynta lukee koko hankekannan ja ajaa calculateMatchin sita vasten
 * aina kun ehdokkaalla ei ole tarkkaa tunnistetta. Tama mittaa molempien
 * osien kustannuksen ja skaalautumisen. Ei kirjoita mitaan.
 */

const COLUMNS =
  "id,name,city,region,location,phase,completed_at,status,developer,property_type,metadata"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { calculateMatch } = await import("../lib/agent/projectMatcher")
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  /* 1. Haun skaalautuminen sivumaaran mukaan. */
  console.log("HAKU (sivu = 1000 riviä):")
  const ajat: number[] = []
  for (const sivuja of [1, 3, 6]) {
    const t0 = Date.now()
    let n = 0
    for (let i = 0; i < sivuja; i++) {
      const { data, error } = await s.from("projects").select(COLUMNS)
        .order("id", { ascending: true }).range(i * 1000, i * 1000 + 999)
      if (error) throw error
      n += data?.length ?? 0
      if (!data || data.length < 1000) break
    }
    const kesto = Date.now() - t0
    ajat.push(kesto)
    console.log(`  ${String(n).padStart(5)} riviä  ${String(kesto).padStart(6)} ms   ${Math.round(kesto / n * 1000)} ms / 1000 riviä`)
  }

  /* 2. Payloadin koko: mika haussa maksaa. */
  const { data: kaikki } = await s.from("projects").select(COLUMNS).limit(1000)
  const kokoMeta = JSON.stringify(kaikki ?? []).length
  const ilmanMeta = JSON.stringify((kaikki ?? []).map((p: any) => ({ ...p, metadata: undefined }))).length
  console.log(`\nPAYLOAD 1000 riviä: ${Math.round(kokoMeta / 1024)} kB, ilman metadataa ${Math.round(ilmanMeta / 1024)} kB (${Math.round((1 - ilmanMeta / kokoMeta) * 100)} % on metadataa)`)

  /* 3. Tasmaytyksen laskenta-aika. */
  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await s.from("projects").select(COLUMNS).order("id", { ascending: true }).range(from, from + 999)
    projects.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const { data: cand } = await s.from("potential_projects").select("*").eq("status", "new").limit(1).maybeSingle()
  const m: any = cand?.metadata ?? {}
  const normalized = {
    name: m.operation ?? cand?.title ?? null, sourceTitle: m.source_title ?? null,
    city: cand?.municipality ?? null, region: m.region ?? null, location: cand?.address ?? null,
    permitNumber: cand?.permit_number ?? null, propertyId: cand?.property_id ?? null,
    developer: m.developer ?? null, buildingType: m.building_type ?? null, description: m.description ?? null,
  }
  const t1 = Date.now()
  for (const p of projects) calculateMatch(p as any, normalized as any)
  const laskenta = Date.now() - t1
  console.log(`LASKENTA ${projects.length} hanketta: ${laskenta} ms  (${(laskenta / projects.length).toFixed(3)} ms/hanke)`)

  /* 4. Kaupunkirajauksen vaikutus. */
  const kaupungit = new Map<string, number>()
  for (const p of projects) kaupungit.set(String(p.city ?? "-"), (kaupungit.get(String(p.city ?? "-")) ?? 0) + 1)
  const isoimmat = [...kaupungit].sort((a, b) => b[1] - a[1]).slice(0, 6)
  console.log("\nKAUPUNKIRAJAUS - hankkeita per kaupunki:")
  for (const [k, v] of isoimmat) console.log(`  ${String(v).padStart(5)}  ${k}`)
  const mediaani = [...kaupungit.values()].sort((a, b) => a - b)[Math.floor(kaupungit.size / 2)]
  console.log(`  kaupunkeja ${kaupungit.size}, mediaani ${mediaani} hanketta/kaupunki`)

  /* 5. Kuinka moni jonon ehdokas ohittaisi koko skannauksen? */
  const cands: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("potential_projects").select("id,municipality,permit_number,property_id,metadata").eq("status", "new").range(f, f + 999)
    cands.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const tunnisteella = cands.filter((c) => c.metadata?.matched_existing_project_id)
  const kaupunkiTiedossa = cands.filter((c) => c.municipality)
  console.log(`\nJONO: ${cands.length} ehdokasta`)
  console.log(`  valmis osuma tallessa (matched_existing_project_id): ${tunnisteella.length}  -> ohittaa skannauksen kokonaan`)
  console.log(`  kaupunki tiedossa: ${kaupunkiTiedossa.length}  -> kaupunkirajaus mahdollinen`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
