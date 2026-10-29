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
 * OYS C-RAKENNUKSEN KORJAUS JA KUURAPARKKI JONOON (D-361).
 *
 * OMA VIRHE, JOKA ON SYYTA KIRJATA TARKASTI. `pura-oys-2030.ts`
 * taydensi ensin C-rakennuksen osoitteeksi "Kajaanintie 50, 90220 Oulu"
 * ja vei vasta sitten Kuuraparkin `importCandidate`iin. Kuuraparkki on
 * SAMASSA osoitteessa, joten se osui juuri taydennettyyn C-riviin **90
 * pisteella** (`same_location` + `name_in_description`) ja kirjoitti
 * siihen tyypin "Pysakointilaitos".
 *
 * Tasmays oli tarkistettu etukateen ja se naytti 60 -- mutta tarkistus
 * tehtiin ENNEN omaa taydennysta, eli vanhentuneella aineistolla. Juuri
 * se taydennys loi osuman ([[matched-overwrites-fields]]).
 *
 * Kuuraparkki luodaan nyt SUORAAN jonoon ilman tasmaytinta: se ja
 * C-rakennus ovat pysyvasti samassa osoitteessa (sairaala-alueen
 * katuosoite), joten tasmaytin osuu niihin aina. Ihminen erottaa ne.
 *
 *   npx tsx scripts/korjaa-oys-c-rakennus.ts
 *   npx tsx scripts/korjaa-oys-c-rakennus.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const C_RAKENNUS = "a495c984-54d3-494c-a232-9b32f56d10a0"
const LAHDE = "https://www.ncc.fi/projektit/oys-2030-oulu2/"

/* Tyhja merkkijono ei ole "puuttuva" ??-operaattorille – siksi erikseen. */
const tyhja = (v: unknown) => v === null || v === undefined || String(v).trim() === ""

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data, error } = await db.from("projects").select("*").eq("id", C_RAKENNUS).single()
  if (error) throw error
  const c: any = data

  const md = { ...(c.metadata ?? {}) }
  md.building_type = "Sairaala"
  md.korjattu_2026_10_30 = {
    syy: "Kuuraparkin tuonti osui tahan riviin 90 pisteella ja kirjoitti tyypin Pysakointilaitos",
    palautettu: { property_type: "Sairaala" },
  }
  /*
   * Aikatauluristiriita nakyviin, ei piiloon. Rivin oma kuvaus (Pohteen
   * sopimusuutinen, Q4/2025) sanoo "luovutetaan elokuun 2029 loppuun
   * mennessa"; NCC:n hankesivu sanoo nyt "2025-2030" ja "luovutetaan
   * tilaajalle syksylla 2030". Kentassa on NCC:n luku, koska se on
   * urakoitsijan oma ja tuoreempi, mutta kuvaus on yha vanha.
   */
  md.field_sources = {
    ...(md.field_sources ?? {}),
    estimated_completion: "NCC:n hankesivu 30.10.2026 (syksy 2030); rivin kuvauksessa yha vanha 8/2029",
  }

  const muutos: Record<string, unknown> = {
    property_type: "Sairaala",
    metadata: md,
  }
  /* NCC:n hankesivun suunnittelijat: kentissa on tyhja merkkijono. */
  if (tyhja(c.architectural_design))
    muutos.architectural_design = "Lukkaroinen Oy // Tähti-Set Oy // Uki Arkkitehdit Oy"
  if (tyhja(c.structural_design)) muutos.structural_design = "A-insinöörit Suunnittelu Oy"
  if (tyhja(c.hvac_design)) muutos.hvac_design = "Ramboll Finland Oy"

  console.log("=== C-RAKENNUS ===")
  for (const [k, v] of Object.entries(muutos)) {
    if (k === "metadata") continue
    console.log(`   ${k}: ${JSON.stringify(c[k])} -> ${JSON.stringify(v)}`)
  }
  console.log(`   (developer jaa arvoon ${JSON.stringify(c.developer)} – Kuuraparkin tuoma muoto on`)
  console.log(`    tasmallisempi kuin aiempi "Pohde", joten sita ei palauteta)`)

  /* ---- Kuuraparkki suoraan jonoon ---- */
  const { data: onJo } = await db
    .from("potential_projects")
    .select("id,status")
    .ilike("title", "%kuuraparkki%")
    .maybeSingle()

  const jonorivi = {
    title: "OYS 2030 Kuuraparkki 1C, Oulu",
    municipality: "Oulu",
    address: "Kajaanintie 50, 90220 Oulu",
    confidence: 80,
    source_count: 1,
    evidence_count: 0,
    status: "new",
    metadata: {
      source: "ncc_projektit",
      source_name: "ncc_projektit",
      source_url: LAHDE,
      resolver: "kasin_purettu",
      operation: "OYS 2030 Kuuraparkki 1C",
      city: "Oulu",
      region: "Pohjois-Pohjanmaa",
      location: "Kajaanintie 50, 90220 Oulu",
      developer: "Pohjois-Pohjanmaan hyvinvointialue (Pohde)",
      builder: "NCC",
      building_type: "Pysäköintilaitos",
      phase_hint: "Rakenteilla",
      construction_starts_at: "2025-10-01",
      estimated_completion: "2030-11-30",
      laajuus: "18 610 brm2",
      architectural_design: "Lukkaroinen Oy // Tähti-Set Oy // Uki Arkkitehdit Oy",
      structural_design: "A-insinöörit Suunnittelu Oy",
      hvac_design: "Ramboll Finland Oy",
      related_companies: ["Lukkaroinen Oy", "Tähti-Set Oy", "Uki Arkkitehdit Oy", "A-insinöörit Suunnittelu Oy", "Ramboll Finland Oy"],
      tyonumero: "13820",
      description:
        "Kuuraparkki 1C on Oulun yliopistollisen sairaalan OYS 2030 -uudistamisohjelmaan " +
        "kuuluva pysäköintilaitos osoitteessa Kajaanintie 50. Laajuus on 18 610 brm² ja " +
        "rakennusaika 10/2025–syksy 2030. NCC toteuttaa kohteen allianssimallilla yhdessä " +
        "Pohjois-Pohjanmaan hyvinvointialueen kanssa. NCC:n työnumero on 13820.",
      purettu_ohjelmasivulta: {
        jonorivi: "bb6d981e-9c8e-46b9-8901-a70c8dd3e247",
        peruste: "NCC:n ohjelmasivun oma Tiedot-lohko",
      },
      /*
       * Luotu suoraan jonoon ilman tasmaytinta: sairaala-alueen
       * katuosoite on sama kuin C-rakennuksella, joten tasmaytin osuu
       * niihin aina (mitattu: 90 pistetta).
       */
      ohitettu_tasmaytin: "sama katuosoite kuin C-rakennuksella",
    },
  }

  console.log("\n=== KUURAPARKKI 1C ===")
  if (onJo) {
    console.log(`   On jo jonossa: ${onJo.id} [${onJo.status}] – ei luoda uudelleen.`)
  } else {
    console.log(`   ${jonorivi.title}`)
    console.log(`   ${jonorivi.address} | ${jonorivi.metadata.phase_hint} | valmistuu ${jonorivi.metadata.estimated_completion}`)
    console.log(`   laajuus ${jonorivi.metadata.laajuus} | rakentaja ${jonorivi.metadata.builder}`)
    console.log(`   luodaan SUORAAN jonoon (ei tasmaytinta)`)
  }

  if (!APPLY) {
    console.log("\nKuivaharjoitus, ei kirjoitettu.")
    return
  }

  const a1 = await db.from("projects").update(muutos).eq("id", C_RAKENNUS)
  if (a1.error) throw a1.error
  if (!onJo) {
    const a2 = await db.from("potential_projects").insert(jonorivi)
    if (a2.error) throw a2.error
  }
  console.log("\n=== AJETTU ===")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
