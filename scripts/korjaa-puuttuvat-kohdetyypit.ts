import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KOHDETYYPPI OTSIKOSTA TAKAUTUVASTI (D-389).
 *
 * Johannes 8.11.2026: *"ei saanut kohdetyyppia = datakeskus. Miksi katso
 * viela tama ja korjataan."*
 *
 * Kerain on korjattu (`resolvePotentialProject` kokeilee nyt sanakuviota
 * ennen mallia), mutta korjaus ei kosketa olemassa olevia rivejä. Tama
 * ajo kirjoittaa tyypin niille joille SAMA saanto sen antaa:
 *
 *   otsikko (ei kuvaus) + ei moniselitteista asuntosanaa
 *
 * MITATTU 8.11.2026, ja rajaus on mittauksen tulos:
 *
 *   kuvaus mukaan          13 jonoriviä, joista 3 vaarin (Paivakoti
 *                          sivulauseesta) -> hylatty
 *   otsikko, asuntosana    8 riviä, joista 6 lupapaatoksia muodossa
 *                          "Asuinrakennuksen rakentaminen: X" -> arvaus
 *   otsikko, rajattu       2 jonoriviä + 9 hanketta, kaikki luettu
 *                          erikseen ja oikein
 *
 * KOLMAS KORJAUS: OMA VIRHE ESPOON JAKORIVEISSA. Kirjoitin 8.11.2026
 * jakoskriptissa (D-313:n jalkeen) tyypin avaimella
 * `metadata.property_type`, mutta hyvaksyntareitti lukee
 * `metadata.building_type` -- eika `metadata.property_type`ia lue
 * MIKAAN koodi. Rivit olisivat menneet hankkeeksi ilman tyyppia.
 *
 *   npx tsx scripts/korjaa-puuttuvat-kohdetyypit.ts
 *   npx tsx scripts/korjaa-puuttuvat-kohdetyypit.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const MONISELITTEINEN_ASUNTOSANA = /asuinrakennu/i

/* Espoon jaostotiedotteesta jaetut rivit, joilla tyyppi on vaaralla avaimella. */
const VAARA_AVAIN = [
  "fddf505f-ae14-48d1-a17f-670f6312da70",
  "9c69ba19-bbc1-4279-8b3f-03d43794a581",
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { inferBuildingType } = await import("../lib/agent/buildingType")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const tyyppi = (otsikko: string): string | null =>
    MONISELITTEINEN_ASUNTOSANA.test(otsikko) ? null : inferBuildingType(otsikko, null)

  /* 1. Jonossa odottavat ilman tyyppia. */
  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,metadata")
      .eq("status", "new")
      .range(a, a + 999)
    if (error) throw error
    jono.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const jonoKorjaukset = jono
    .filter((r: any) => !String((r.metadata ?? {}).building_type ?? "").trim())
    .map((r: any) => ({ rivi: r, uusi: tyyppi(String(r.title ?? "")) }))
    .filter((x: any) => x.uusi)

  console.log(`JONO: ${jonoKorjaukset.length} riviä saa tyypin otsikosta`)
  for (const { rivi, uusi } of jonoKorjaukset) {
    console.log(`  ${String(uusi).padEnd(14)} | ${rivi.id} | ${String(rivi.title).slice(0, 72)}`)
  }

  /* 2. Oma vaara avain: property_type -> building_type. */
  const { data: vaarat } = await db
    .from("potential_projects")
    .select("id,title,metadata")
    .in("id", VAARA_AVAIN)
  const avainKorjaukset = (vaarat ?? []).filter(
    (r: any) =>
      String((r.metadata ?? {}).property_type ?? "").trim() &&
      !String((r.metadata ?? {}).building_type ?? "").trim()
  )
  console.log(`\nVAARA AVAIN: ${avainKorjaukset.length} riviä (property_type -> building_type)`)
  for (const r of avainKorjaukset as any[]) {
    console.log(`  ${String((r.metadata ?? {}).property_type).padEnd(14)} | ${r.id} | ${String(r.title).slice(0, 72)}`)
  }

  /* 3. Julkiset hankkeet ilman tyyppia. */
  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,property_type,is_public,status,phase,metadata")
      .range(a, a + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const hankeKorjaukset = hankkeet
    .filter((r: any) => r.is_public && r.status === "active" && !String(r.property_type ?? "").trim())
    .map((r: any) => ({ rivi: r, uusi: tyyppi(String(r.name ?? "")) }))
    .filter((x: any) => x.uusi)

  console.log(`\nHANKKEET: ${hankeKorjaukset.length} riviä saa tyypin otsikosta`)
  for (const { rivi, uusi } of hankeKorjaukset) {
    console.log(`  ${String(uusi).padEnd(14)} | ${String(rivi.phase).padEnd(20)} | ${String(rivi.name).slice(0, 66)}`)
  }

  if (!APPLY) {
    console.log("\n=== KUIVAHARJOITUS ===")
    return
  }

  let n = 0
  for (const { rivi, uusi } of jonoKorjaukset) {
    const md = rivi.metadata ?? {}
    const { error } = await db
      .from("potential_projects")
      .update({ metadata: { ...md, building_type: uusi, building_type_source: "sana" } })
      .eq("id", rivi.id)
    if (error) throw error
    n++
  }
  for (const r of avainKorjaukset as any[]) {
    const md = r.metadata ?? {}
    const { error } = await db
      .from("potential_projects")
      .update({ metadata: { ...md, building_type: md.property_type } })
      .eq("id", r.id)
    if (error) throw error
    n++
  }
  let h = 0
  for (const { rivi, uusi } of hankeKorjaukset) {
    const md = rivi.metadata ?? {}
    const { error } = await db
      .from("projects")
      .update({
        property_type: uusi,
        metadata: { ...md, building_type: uusi, building_type_source: "sana" },
      })
      .eq("id", rivi.id)
    if (error) throw error
    h++
  }

  console.log(`\n=== AJETTU ===`)
  console.log(`  jonoriviä ${n}, hanketta ${h}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
