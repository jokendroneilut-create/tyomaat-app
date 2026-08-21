import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: paljonko maakunta- tai kaupunkirajaus saastaisi, ja
 * MENETETAANKO SILLA OIKEITA OSUMIA?
 *
 * Hyvaksynta kayttaa findProjectMatchDetailed-funktiota koko hankejoukkoa
 * vastaan. Tama ajaa saman kaikille jonon ehdokkaille kolmella tavalla -
 * koko joukko, sama maakunta, sama kaupunki - ja vertaa tuloksia.
 *
 * Ratkaiseva luku ei ole saasto vaan menetetyt osumat. Ei kirjoita mitaan.
 */

const COLUMNS =
  "id,name,city,region,location,phase,completed_at,status,developer,property_type,metadata"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const projects: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await s.from("projects").select(COLUMNS).order("id", { ascending: true }).range(f, f + 999)
    if (error) throw error
    projects.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const cands: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("potential_projects")
      .select("id,title,municipality,permit_number,property_id,metadata")
      .eq("status", "new").range(f, f + 999)
    cands.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  /* 1. Joukkojen koot. */
  const maakunnat = new Map<string, number>()
  const kaupungit = new Map<string, number>()
  for (const p of projects) {
    maakunnat.set(String(p.region ?? "-"), (maakunnat.get(String(p.region ?? "-")) ?? 0) + 1)
    kaupungit.set(String(p.city ?? "-"), (kaupungit.get(String(p.city ?? "-")) ?? 0) + 1)
  }
  console.log(`hankkeita ${projects.length}, maakuntia ${maakunnat.size}, kaupunkeja ${kaupungit.size}\n`)
  console.log("suurimmat maakunnat:")
  for (const [k, v] of [...maakunnat].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
    console.log(`  ${String(v).padStart(5)}  ${k}`)
  }
  const mkArvot = [...maakunnat.values()].sort((a, b) => a - b)
  console.log(`  mediaani ${mkArvot[Math.floor(mkArvot.length / 2)]} hanketta/maakunta`)

  const norm = (c: any) => {
    const m: any = c.metadata ?? {}
    return {
      name: m.operation ?? c.title ?? null, sourceTitle: m.source_title ?? null,
      city: c.municipality ?? null, region: m.region ?? null, location: c.address ?? null,
      permitNumber: c.permit_number ?? null, propertyId: c.property_id ?? null,
      developer: m.developer ?? null, buildingType: m.building_type ?? null, description: m.description ?? null,
    }
  }

  /* 2. Sama tasmaytys kolmella joukolla. */
  let ilmanMaakuntaa = 0, ilmanKaupunkia = 0
  let osumiaKaikki = 0, osumiaMaakunta = 0, osumiaKaupunki = 0
  let menetettyMaakunta = 0, menetettyKaupunki = 0
  let mkJoukko = 0, kpJoukko = 0
  const menetykset: string[] = []

  for (const c of cands) {
    const n = norm(c)
    if (!n.region) ilmanMaakuntaa++
    if (!n.city) ilmanKaupunkia++

    const kaikki = findProjectMatchDetailed(projects as any, n as any)

    const mkSet = n.region
      ? projects.filter((p) => String(p.region ?? "") === String(n.region))
      : projects
    const kpSet = n.city
      ? projects.filter((p) => String(p.city ?? "").toLowerCase() === String(n.city).toLowerCase())
      : projects
    mkJoukko += mkSet.length
    kpJoukko += kpSet.length

    const mk = findProjectMatchDetailed(mkSet as any, n as any)
    const kp = findProjectMatchDetailed(kpSet as any, n as any)

    if (kaikki) osumiaKaikki++
    if (mk) osumiaMaakunta++
    if (kp) osumiaKaupunki++

    /* Menetys = koko joukolla loytyi osuma, rajatulla ei (tai heikompi). */
    if (kaikki && (!mk || mk.project.id !== kaikki.project.id)) {
      menetettyMaakunta++
      if (menetykset.length < 10) {
        menetykset.push(
          `  MAAKUNTA  ${String(c.title).slice(0, 40).padEnd(42)} ${kaikki.confidence} -> ${mk?.confidence ?? "ei osumaa"}\n            koko joukko loysi: ${String(kaikki.project.name).slice(0, 56)}`
        )
      }
    }
    if (kaikki && (!kp || kp.project.id !== kaikki.project.id)) menetettyKaupunki++
  }

  const ka = (x: number) => Math.round(x / cands.length)
  console.log(`\nJONO: ${cands.length} ehdokasta`)
  console.log(`  ilman maakuntaa: ${ilmanMaakuntaa}   ilman kaupunkia: ${ilmanKaupunkia}`)
  console.log(`\nSKANNATTAVA JOUKKO keskimaarin:`)
  console.log(`  koko kanta        ${projects.length}`)
  console.log(`  maakuntarajaus    ${ka(mkJoukko)}   (${Math.round(ka(mkJoukko) / projects.length * 100)} %)`)
  console.log(`  kaupunkirajaus    ${ka(kpJoukko)}   (${Math.round(ka(kpJoukko) / projects.length * 100)} %)`)
  console.log(`\nOSUMAT (paras osuma, kuten hyvaksynta tekee):`)
  console.log(`  koko kanta        ${osumiaKaikki}`)
  console.log(`  maakuntarajaus    ${osumiaMaakunta}   menetetty/muuttunut: ${menetettyMaakunta}`)
  console.log(`  kaupunkirajaus    ${osumiaKaupunki}   menetetty/muuttunut: ${menetettyKaupunki}`)
  if (menetykset.length) { console.log("\nmenetykset:"); for (const m of menetykset) console.log(m) }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
