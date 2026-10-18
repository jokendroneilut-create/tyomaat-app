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
 * DESTIAN KOLME SAHKOASEMAURAKKAA OMIKSI HANKKEIKSEEN (D-310).
 *
 * Johannes 18.10.2026 jonorivista `f523183a`: *"tasta pitaisi purkaa
 * nuo hankkeet myos omiksi hankkeikseen ja lisata tama lahteeksi."*
 *
 * Yksi tiedote, kolme urakkaa KOLMESSA ERI KUNNASSA. Yhtena rivina ne
 * ovat Hameenlinnassa, eivatka Isojoen ja Mikkelin urakat loydy
 * sielta haulla eivatka osu hakuvahtiin.
 *
 * TARKISTETTU ENSIN MITA KANNASSA JO ON:
 *
 *   Visulahti  ON JO KAHDESTI: `45d33b38` (Hilman ilmoitus VT21,
 *              Fingrid/Destia) ja `a846a62b` ("Visulahden sahkoasema",
 *              jonka kuvaus on tasta samasta tiedotteesta).
 *              EI LUODA KOLMATTA. Pari viedaan katselmoitavaksi.
 *   Harviala   kannassa on vain samanniminen VOIMAJOHTO
 *              (Harviala-Hangasmaki), ei sahkoasemaa. Luodaan.
 *   Lahteenkyla  ei ole kannassa lainkaan. Luodaan.
 *
 *   npx tsx scripts/pura-destian-sahkoasemaurakat.ts
 *   npx tsx scripts/pura-destian-sahkoasemaurakat.ts --apply
 */

const LAHDE = "f523183a-e141-4e1e-a1d3-5021c8553973"
const TIEDOTE =
  "https://destia.fi/tiedote/destia-toteuttaa-kolme-keskeista-sahkoasemaurakkaa-fingridille/"

const VISULAHTI_HILMA = "45d33b38-8e4d-4b24-86ed-af38499357ea"
const VISULAHTI_TIEDOTE = "a846a62b-82dc-4c51-858d-f4e624bc2da8"

const YHTEINEN =
  "Urakka on osa Fingridin kantaverkon kehittämisohjelmaa, jolla vastataan uusiutuvan energian " +
  "hankkeiden voimakkaasti kasvavaan liityntäkysyntään. Destia toteuttaa Fingridille samalla " +
  "kertaa kolme sähköasemaurakkaa: Harvialan Hämeenlinnaan, Lähteenkylän Isojoelle ja " +
  "Visulahden laajennuksen Mikkeliin. Kaikki urakat valmistuvat vuoden 2028 aikana. " +
  "Yhteyshenkilö: Tommi Härkönen, projektipäällikkö, Destia, +358 41 732 2290."

const UUDET = [
  {
    nimi: "Harvialan 110 kV sähköasema",
    tunnus: "harvialan-sahkoasema",
    kaupunki: "Hämeenlinna",
    maakunta: "Kanta-Häme",
    kuvaus:
      "Destia rakentaa Fingridille Harvialaan uuden 110 kV:n viiden kentän kytkinlaitoksen. " +
      "Sopimus sisältää option kahden lisäkentän toteutuksesta, mikä mahdollistaa kapasiteetin " +
      "joustavan kasvattamisen tulevaisuuden energiatarpeisiin. " +
      "Urakan odotetaan valmistuvan alkuvuonna 2028. " +
      YHTEINEN,
    valmistuu: "2028-03-31",
  },
  {
    nimi: "Lähteenkylän 400 kV ulkokytkinlaitos",
    tunnus: "lahteenkylan-ulkokytkinlaitos",
    kaupunki: "Isojoki",
    maakunta: "Etelä-Pohjanmaa",
    kuvaus:
      "Destia toimii kokonaisvastuullisena toteuttajana avaimet käteen -periaatteella. " +
      "Hanke kattaa sähköasemasuunnittelun, sähköasema-alueen rakentamisen lopulliseen korkoon, " +
      "uuden 400 kV ilmaeristeisen ulkokytkinlaitoksen rakentamisen sekä uuden valvomorakennuksen " +
      "toteutuksen järjestelmineen. Käyttöönotettu uusi sähköasema luovutetaan Fingridille " +
      "marraskuussa 2028. Kyseessä on Destian ensimmäinen kokonaan uusi 400 kV:n ulkokytkinlaitos. " +
      YHTEINEN,
    valmistuu: "2028-11-30",
  },
] as const

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { importCandidate } = await import("../lib/agent/importCandidate")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Kaksi uutta urakkaa --- */
  const projektit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, region, location, status, developer, builder, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE projects: ${error.message}`)
      process.exit(1)
    }
    projektit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  console.log(`\n1) Uudet urakat (${UUDET.length})`)
  for (const u of UUDET) {
    console.log(`\n   ${u.nimi}  [${u.kaupunki}, valmistuu ${u.valmistuu}]`)
    console.log(`   ${u.kuvaus.slice(0, 130)}...`)
    if (!apply) continue

    const tulos = await importCandidate(
      {
        name: u.nimi,
        city: u.kaupunki,
        region: u.maakunta,
        location: null,
        phase: "Sopimus myönnetty",
        description: u.kuvaus,
        developer: "Fingrid Oyj",
        builder: "Destia Oy",
        property_type: "Sähköverkko",
        source_url: `${TIEDOTE}#${u.tunnus}`,
        confidence: 0.85,
        completed: false,
        source_name: "destia_tiedotteet",
        estimatedCompletion: u.valmistuu,
        metadata: {
          paatos_url: TIEDOTE,
          eroteltu_rivista: LAHDE,
          eroteltu_lahteen_sanamuoto: u.nimi,
          estimated_completion: u.valmistuu,
        },
      },
      { projects: projektit }
    )
    console.log(`   -> ${JSON.stringify(tulos).slice(0, 170)}`)
  }

  /* --- 2. Visulahti: lahde olemassa olevalle, pari jonoon --- */
  console.log(`\n2) Visulahti on jo kannassa kahdesti, ei luoda kolmatta`)
  const { data: vis, error: e2 } = await db
    .from("projects")
    .select("id, name, metadata")
    .in("id", [VISULAHTI_HILMA, VISULAHTI_TIEDOTE])
  if (e2) {
    console.error(`VIRHE: ${e2.message}`)
    process.exit(1)
  }
  for (const p of vis ?? []) {
    const m: any = p.metadata ?? {}
    const puuttuu = !m.source_url
    console.log(`   ${String(p.name).slice(0, 50).padEnd(52)} lahde=${m.source_url ? "on" : "PUUTTUU"}`)
    if (!apply || !puuttuu) continue
    const { error: e3 } = await db
      .from("projects")
      .update({ metadata: { ...m, source_url: TIEDOTE, eroteltu_rivista: LAHDE } })
      .eq("id", p.id)
    if (e3) console.error(`      VIRHE: ${e3.message}`)
    else console.log(`      lahde lisatty`)
  }

  const { data: pari } = await db
    .from("project_duplicate_candidates")
    .select("id, status")
    .or(
      `and(project_id_a.eq.${VISULAHTI_HILMA},project_id_b.eq.${VISULAHTI_TIEDOTE}),and(project_id_a.eq.${VISULAHTI_TIEDOTE},project_id_b.eq.${VISULAHTI_HILMA})`
    )
  if ((pari ?? []).length) {
    console.log(`   pari on jo kannassa: ${JSON.stringify(pari)}`)
  } else {
    console.log(`   pari viedaan katselmoitavaksi (EI yhdisteta itse)`)
    if (apply) {
      const { error: e4 } = await db.from("project_duplicate_candidates").insert({
        project_id_a: VISULAHTI_HILMA,
        project_id_b: VISULAHTI_TIEDOTE,
        confidence: 90,
        reasons: [
          "sama urakka: Visulahden 110 kV laajennus",
          "molemmilla Fingrid tilaajana ja Destia rakentajana",
          "toinen Hilman ilmoituksesta, toinen Destian tiedotteesta",
          "havaittu 18.10.2026 tiedotteen erottelussa",
        ],
      })
      if (e4) console.error(`      VIRHE parin lisayksessa: ${e4.message}`)
      else console.log(`      pari lisatty`)
    }
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
  }
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
