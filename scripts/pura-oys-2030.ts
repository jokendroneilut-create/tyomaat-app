import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * OYS 2030 -OHJELMA OSAHANKKEIKSI (D-361).
 *
 * Johannes 30.10.2026: *"tassa ehdokkaassa on monta osahanketta: c, h,
 * kuuraparkki, f ja a. pura tama osahankkeiksi ja kerro mita tuolle
 * hankkeelle tehdaan sen jalkeen."*
 *
 * Jonorivi `bb6d981e` on NCC:n OHJELMASIVU, ei hanke. Sivun "Tiedot"-
 * osiossa on viisi omaa lohkoa, jokaisella oma tyonumero, rakennusaika,
 * katuosoite, laajuus ja suunnittelijat:
 *
 *   C-rakennus     13819  10/2025-syksy 2030  Kajaanintie 50     35 538 brm2
 *   H-rakennus     13847  2/2026-12/2030      Kiviharjuntie 19   26 500 brm2
 *   Kuuraparkki 1C 13820  10/2025-syksy 2030  Kajaanintie 50     18 610 brm2
 *   F-rakennus     13542  1/2022-6/2025       Kiviharjuntie 7    33 000 brm2  VALMIS
 *   A-rakennus     13414  1/2019-5/2023       Kajaanintie 50     58 700 brm2  VALMIS
 *
 * MITA RIVILLE OLI EHTINYT TAPAHTUA. Resolveri poimi ENSIMMAISEN lohkon
 * kentat ja kirjasi ne koko ohjelman nimiin: laajuudeksi tuli 35 538 brm2
 * ja suunnittelijoiksi C-rakennuksen suunnittelijat, vaikka otsikko on
 * "OYS 2030, Oulu". Osoitetta ei ollut lainkaan, vaikka jokaisella
 * lohkolla on oma. Juuri tata tarkoittaa [[multi-project-rows]]:
 * monihankkeinen rivi on loydettava ennen skannausta, ei sen avulla.
 *
 * MITA TEHDAAN:
 *   C ja H ovat jo kannassa omina riveinaan toisista lahteista, mutta
 *     ilman osoitetta, laajuutta ja aikataulua -> taydennetaan.
 *   Kuuraparkki 1C ei ole kannassa -> jonoon katselmoitavaksi.
 *   F ja A ovat valmiita (6/2025 ja 5/2023) -> EI luoda. Valmis
 *     rakennus ei ole liidi, ja sama linja on `importCandidate`issa.
 *   Ohjelmasivun rivi -> hylataan: se ei voi koskaan olla yksi hanke
 *     ([[reject-is-not-final]]: hylkaa vain se mika ei koskaan ole hanke).
 *
 *   npx tsx scripts/pura-oys-2030.ts
 *   npx tsx scripts/pura-oys-2030.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const JONORIVI = "bb6d981e-9c8e-46b9-8901-a70c8dd3e247"
const LAHDE = "https://www.ncc.fi/projektit/oys-2030-oulu2/"

/* Kannassa jo olevat osahankkeet. */
const C_RAKENNUS = "a495c984-54d3-494c-a232-9b32f56d10a0"
const H_RAKENNUS = "2af51a02-3870-4de2-b58b-bc568f3adcf1"
/* Sama C-rakennus toisesta lahteesta; pari katselmointiin, ei yhdisteta. */
const C_TOINEN = "e39120fe-168e-480a-b928-8ef65767dd85"

/*
 * "syksy 2030" luetaan kauden VIIMEISEKSI kuukaudeksi, kuten
 * `parseFinnishCompletionDate` tekee (D-348: kevat/kesa/syksy ->
 * touko/elo/marraskuu). Sivu sanoo saman proosassa: "Kohde luovutetaan
 * tilaajalle syksylla 2030."
 */
const SYKSY_2030 = "2030-11-30"

const SUUNNITTELIJAT_C = {
  architectural_design: "Lukkaroinen Oy // Tähti-Set Oy // Uki Arkkitehdit Oy",
  structural_design: "A-insinöörit Suunnittelu Oy",
  hvac_design: "Ramboll Finland Oy",
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: rivit, error } = await db
    .from("projects")
    .select("*")
    .in("id", [C_RAKENNUS, H_RAKENNUS, C_TOINEN])
  if (error) throw error
  const c: any = (rivit ?? []).find((r: any) => r.id === C_RAKENNUS)
  const h: any = (rivit ?? []).find((r: any) => r.id === H_RAKENNUS)
  if (!c || !h) {
    console.log("C- tai H-rivia ei loydy – ei tehda mitaan.")
    return
  }

  const merkki = (nimi: string) => ({
    [`osahanke_${nimi}_2026_10_30`]: {
      lahde: LAHDE,
      peruste: "NCC:n ohjelmasivun oma Tiedot-lohko",
    },
  })

  /* ---- C-rakennus ---- */
  const cMeta = {
    ...(c.metadata ?? {}),
    ...merkki("c"),
    tyonumero: "13819",
    field_sources: {
      ...(c.metadata?.field_sources ?? {}),
      location: "NCC:n hankesivu",
      floor_area: "NCC:n hankesivu",
      construction_start: "NCC:n hankesivu",
      estimated_completion: "NCC:n hankesivu (syksy 2030)",
    },
  }
  const cMuutos = {
    location: c.location && c.location !== "Oulu" ? c.location : "Kajaanintie 50, 90220 Oulu",
    floor_area: c.floor_area ?? 35538,
    construction_start: c.construction_start ?? "2025-10-01",
    estimated_completion: c.estimated_completion ?? SYKSY_2030,
    architectural_design: c.architectural_design ?? SUUNNITTELIJAT_C.architectural_design,
    structural_design: c.structural_design ?? SUUNNITTELIJAT_C.structural_design,
    hvac_design: c.hvac_design ?? SUUNNITTELIJAT_C.hvac_design,
    metadata: cMeta,
  }

  /* ---- H-rakennus ---- */
  const hMeta = {
    ...(h.metadata ?? {}),
    ...merkki("h"),
    tyonumero: "13847",
    field_sources: {
      ...(h.metadata?.field_sources ?? {}),
      location: "NCC:n hankesivu",
      floor_area: "NCC:n hankesivu",
      construction_start: "NCC:n hankesivu",
      estimated_completion: "NCC:n hankesivu",
    },
  }
  const hMuutos = {
    location: h.location && h.location !== "Oulu" ? h.location : "Kiviharjuntie 19, 90220 Oulu",
    floor_area: h.floor_area ?? 26500,
    construction_start: h.construction_start ?? "2026-02-01",
    estimated_completion: h.estimated_completion ?? "2030-12-31",
    architectural_design: h.architectural_design ?? "Sweco Oy",
    structural_design: h.structural_design ?? "A-insinöörit Suunnittelu Oy",
    hvac_design: h.hvac_design ?? "Ramboll Finland Oy",
    geotechnical_design: h.geotechnical_design ?? "AFRY Finland Oy",
    metadata: hMeta,
  }

  /* ---- Kuuraparkki 1C: uusi, jonoon ---- */
  const kuuraparkki = {
    name: "OYS 2030 Kuuraparkki 1C, Oulu",
    city: "Oulu",
    region: "Pohjois-Pohjanmaa",
    location: "Kajaanintie 50, 90220 Oulu",
    developer: "Pohjois-Pohjanmaan hyvinvointialue (Pohde)",
    builder: "NCC",
    property_type: "Pysäköintilaitos",
    phase: "Rakenteilla",
    construction_start: "2025-10-01",
    estimated_completion: SYKSY_2030,
    description:
      "Kuuraparkki 1C on Oulun yliopistollisen sairaalan OYS 2030 -uudistamisohjelmaan " +
      "kuuluva pysäköintilaitos osoitteessa Kajaanintie 50. Laajuus on 18 610 brm² ja " +
      "rakennusaika 10/2025–syksy 2030. NCC toteuttaa kohteen allianssimallilla yhdessä " +
      "Pohteen kanssa. Arkkitehtisuunnittelu Lukkaroinen Oy, Tähti-Set Oy ja Uki Arkkitehdit Oy, " +
      "rakennesuunnittelu A-insinöörit Suunnittelu Oy, TATE-suunnittelu Ramboll Finland Oy. " +
      "NCC:n työnumero 13820.",
    source_url: LAHDE,
    source_name: "ncc_projektit",
  }

  console.log("=== 1. C-RAKENNUS (taydennetaan) ===")
  console.log(`   ${c.name}`)
  for (const [k, v] of Object.entries(cMuutos)) {
    if (k === "metadata") continue
    const ennen = (c as any)[k]
    if (String(ennen ?? "") !== String(v ?? "")) console.log(`   ${k}: ${JSON.stringify(ennen)} -> ${JSON.stringify(v)}`)
  }

  console.log("\n=== 2. H-RAKENNUS (taydennetaan) ===")
  console.log(`   ${h.name}`)
  for (const [k, v] of Object.entries(hMuutos)) {
    if (k === "metadata") continue
    const ennen = (h as any)[k]
    if (String(ennen ?? "") !== String(v ?? "")) console.log(`   ${k}: ${JSON.stringify(ennen)} -> ${JSON.stringify(v)}`)
  }

  /* Tasmays ennen kirjoitusta: ei luoda riviä joka on jo olemassa. */
  const SARAKKEET =
    "id,name,city,region,location,phase,status,developer,builder,property_type," +
    "estimated_completion,construction_start,additional_info,metadata,is_public"
  const kaikki: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e2 } = await db.from("projects").select(SARAKKEET).range(a, a + 999)
    if (e2) throw e2
    kaikki.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const osuma: any = findProjectMatchDetailed(kaikki as any, kuuraparkki as any)
  const pisteet = osuma?.confidence ?? 0
  const osuntKohde = osuma ? kaikki.find((x) => x.id === (osuma.project?.id ?? osuma.projectId)) : null

  console.log("\n=== 3. KUURAPARKKI 1C (uusi) ===")
  console.log(`   ${kuuraparkki.name}`)
  console.log(`   ${kuuraparkki.location} | ${kuuraparkki.phase} | valmistuu ${kuuraparkki.estimated_completion}`)
  console.log(`   tasmays kantaan: ${pisteet} -> ${osuntKohde?.name ?? "-"}`)
  if (pisteet >= 70) {
    console.log("   PYSAHDYTAAN: osuma yli kynnyksen, rivi on jo olemassa.")
    return
  }

  console.log("\n=== 4. F- JA A-RAKENNUS ===")
  console.log("   F valmistui 6/2025 ja A 5/2023 – valmista rakennusta ei luoda liidiksi.")

  console.log("\n=== 5. OHJELMASIVUN JONORIVI ===")
  console.log(`   ${JONORIVI} -> status rejected`)
  console.log("   Ohjelmasivu ei voi olla yksi hanke; sisalto on nyt osahankkeissa.")

  const [idA, idB] = [C_RAKENNUS, C_TOINEN].sort()
  const { data: onJo } = await db
    .from("project_duplicate_candidates")
    .select("status")
    .eq("project_id_a", idA)
    .eq("project_id_b", idB)
    .maybeSingle()
  console.log("\n=== 6. C-RAKENNUKSEN KAKSOISKAPPALE ===")
  console.log(`   ${C_RAKENNUS} (NCC:n rivi) <-> ${C_TOINEN} (STT:n uutinen samasta sopimuksesta)`)
  console.log(`   ${onJo ? `jo jonossa (${onJo.status})` : "viedaan katselmointijonoon, ei yhdisteta"}`)

  if (!APPLY) {
    console.log("\nKuivaharjoitus, ei kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const a1 = await db.from("projects").update(cMuutos).eq("id", C_RAKENNUS)
  if (a1.error) throw a1.error
  const a2 = await db.from("projects").update(hMuutos).eq("id", H_RAKENNUS)
  if (a2.error) throw a2.error

  const { importCandidate } = await import("../lib/agent/importCandidate")
  const tulos = await importCandidate(kuuraparkki as any)
  console.log(`\nKuuraparkki: ${JSON.stringify(tulos)}`)

  const { data: jonorivi } = await db
    .from("potential_projects")
    .select("metadata")
    .eq("id", JONORIVI)
    .single()
  const jmd = { ...((jonorivi as any)?.metadata ?? {}) }
  jmd.purettu_2026_10_30 = {
    peruste: "ohjelmasivu, ei yksi hanke; viisi osahanketta eriteltiin",
    osahankkeet: {
      c: C_RAKENNUS,
      h: H_RAKENNUS,
      kuuraparkki: "luotu jonoon",
      f: "valmistunut 6/2025, ei luotu",
      a: "valmistunut 5/2023, ei luotu",
    },
  }
  const a3 = await db
    .from("potential_projects")
    .update({ status: "rejected", metadata: jmd })
    .eq("id", JONORIVI)
  if (a3.error) throw a3.error

  if (!onJo) {
    const a4 = await db.from("project_duplicate_candidates").insert({
      project_id_a: idA,
      project_id_b: idB,
      confidence: 80,
      reasons: ["sama kohde: OYS C-rakennus", "toinen NCC:n hankesivulta, toinen STT:n sopimusuutisesta"],
      status: "pending",
    })
    if (a4.error) throw a4.error
  }

  console.log("\n=== AJETTU ===")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
