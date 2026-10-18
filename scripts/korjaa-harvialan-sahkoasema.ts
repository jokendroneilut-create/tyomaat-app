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
 * HARVIALAN SAHKOASEMA OMAKSI RIVIKSEEN JA VOIMAJOHTO ENNALLEEN (D-310).
 *
 * `importCandidate` tasmasi "Harvialan 110 kV sahkoasema" -ehdokkaan
 * olemassa olevaan hankkeeseen `215c8088` **"Harviala-Hangasmaki,
 * Hameenlinna"**, joka on 14 kilometrin VOIMAJOHTO -- ei sahkoasema.
 * Nimet alkavat samalla sanalla ja molemmat ovat Fingridin hankkeita
 * Hameenlinnassa, mutta kyseessa on eri tyo ja eri sopimus.
 *
 * Tasmays ehti ylikirjoittaa kolme kenttaa voimajohdon rivilla:
 *
 *   phase                 Suunnittelu     -> Sopimus myonnetty
 *   builder               (tyhja)         -> Destia Oy
 *   estimated_completion  2030-12-31      -> 2028-03-31
 *
 * Viimeinen on pahin: 2030 oli juuri tanaan korjattu arvo (D-303),
 * jossa jasennin oli poiminut ymparistoselvityksen valmistumisen
 * hankkeen valmistumiseksi. Sahkoaseman 2028 ei ole voimajohdon
 * valmistumispaiva.
 *
 * Alkuperaiset arvot luetaan rivin omasta metadatasta
 * (`phase_hint`) ja Fingridin lahdesivun tekstista, ei muistista.
 *
 *   npx tsx scripts/korjaa-harvialan-sahkoasema.ts
 *   npx tsx scripts/korjaa-harvialan-sahkoasema.ts --apply
 */

const VOIMAJOHTO = "215c8088-ed6f-47da-a430-fa904e4b85c9"
const LAHDE = "f523183a-e141-4e1e-a1d3-5021c8553973"
const TIEDOTE =
  "https://destia.fi/tiedote/destia-toteuttaa-kolme-keskeista-sahkoasemaurakkaa-fingridille/"
const FINGRID_SIVU =
  "https://www.fingrid.fi/kantaverkko/rakentaminen/hankkeet/harviala-hangasmaki/"

const VOIMAJOHDON_ARVOT = {
  phase: "Suunnittelu",
  builder: null,
  estimated_completion: "2030-12-31",
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Voimajohto ennalleen --- */
  const { data: vj, error } = await db
    .from("projects")
    .select("id, name, phase, builder, estimated_cost, estimated_completion, metadata")
    .eq("id", VOIMAJOHTO)
    .maybeSingle()
  if (error || !vj) {
    console.error(`VIRHE: voimajohtoa ei loytynyt (${error?.message ?? "ei rivia"})`)
    process.exit(1)
  }
  const vm: any = vj.metadata ?? {}
  console.log(`\n1) ${vj.name}`)
  console.log(`   phase                ${vj.phase} -> ${VOIMAJOHDON_ARVOT.phase}   (metadata.phase_hint = ${vm.phase_hint})`)
  console.log(`   builder              ${vj.builder ?? "-"} -> (tyhja)`)
  console.log(`   estimated_completion ${vj.estimated_completion} -> ${VOIMAJOHDON_ARVOT.estimated_completion}`)

  /* --- 2. Sahkoasema omaksi jonoriviksi --- */
  const { data: jo } = await db
    .from("potential_projects")
    .select("id")
    .eq("title", "Harvialan 110 kV sähköasema")
  console.log(`\n2) Harvialan 110 kV sähköasema: ${(jo ?? []).length ? "on jo jonossa" : "lisataan jonoon"}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e1 } = await db
    .from("projects")
    .update({
      ...VOIMAJOHDON_ARVOT,
      metadata: { ...vm, last_source_url: FINGRID_SIVU },
    })
    .eq("id", VOIMAJOHTO)
  if (e1) {
    console.error(`VIRHE voimajohto: ${e1.message}`)
    process.exit(1)
  }
  console.log(`   voimajohto palautettu`)

  if (!(jo ?? []).length) {
    const kuvaus =
      "Destia rakentaa Fingridille Harvialaan uuden 110 kV:n viiden kentän kytkinlaitoksen. " +
      "Sopimus sisältää option kahden lisäkentän toteutuksesta, mikä mahdollistaa kapasiteetin " +
      "joustavan kasvattamisen tulevaisuuden energiatarpeisiin. " +
      "Urakan odotetaan valmistuvan alkuvuonna 2028. " +
      "Urakka on osa Fingridin kantaverkon kehittämisohjelmaa. Destia toteuttaa Fingridille samalla " +
      "kertaa kolme sähköasemaurakkaa: Harvialan Hämeenlinnaan, Lähteenkylän Isojoelle ja " +
      "Visulahden laajennuksen Mikkeliin. " +
      "HUOM: samalla alueella on erillinen hanke Harviala–Hangasmäki, joka on 14 km:n voimajohto " +
      "ja eri urakka — tämä rivi koskee sähköasemaa."

    const { error: e2 } = await db.from("potential_projects").insert({
      title: "Harvialan 110 kV sähköasema",
      municipality: "Hämeenlinna",
      status: "new",
      confidence: 85,
      source_count: 1,
      metadata: {
        region: "Kanta-Häme",
        source: "destia_tiedotteet",
        source_name: "destia_tiedotteet",
        source_url: `${TIEDOTE}#harvialan-sahkoasema`,
        paatos_url: TIEDOTE,
        operation: "Harvialan 110 kV sähköasema",
        description: kuvaus,
        developer: "Fingrid Oyj",
        builder: "Destia Oy",
        phase_hint: "Sopimus myönnetty",
        building_type: "Sähköverkko",
        estimated_completion: "2028-03-31",
        eroteltu_rivista: LAHDE,
        eroteltu_lahteen_sanamuoto: "Harvialan uuden 110 kV:n sähköaseman Hämeenlinnaan",
        /* Naapurihanke, jotta katselmoija nakee eron heti. */
        liittyva_hanke: VOIMAJOHTO,
      },
    })
    if (e2) {
      console.error(`VIRHE sahkoasema: ${e2.message}`)
      process.exit(1)
    }
    console.log(`   sähköasema lisatty jonoon`)
  }
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
