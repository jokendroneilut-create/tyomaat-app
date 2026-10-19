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
 * KAKSI AURINKOPUISTOA OMIKSI HANKKEIKSEEN (D-320).
 *
 * Johannes 19.10.2026 jonorivista `538a6c88`: *"tama hanke pitaisi
 * jakaa erillisiksi hankkeiksi ja lisata lahde kuten ennen."*
 *
 * Rakennuslehden juttu kertoo kahdesta puistosta kahdessa maakunnassa:
 * Lamminneva Lappajarvella ja Isoneva Suonenjoella. Yhtena rivina
 * kumpikaan ei loydy haulla, ja rivin kunta oli tyhja.
 *
 * TARKISTETTU ENSIN (6 980 hanketta sivuttaen): kumpaakaan ei ole
 * kannassa, ei myoskaan jonossa.
 *
 * NIMI OSUU TOISEEN HANKKEESEEN. Kannassa on "Lamminnevan
 * tuulivoimahanke, Seinajoki ja Lapua" -- sama nimi, ERI TYO, eri
 * kunnat, eri energiamuoto. Siksi rivit kirjoitetaan SUORAAN jonoon
 * eika `importCandidate`-tasmayksen kautta, joka osaisi tasmata
 * nimen alun perusteella vaaraan hankkeeseen (muisti:
 * matched-overwrites-fields).
 *
 * LUVUT OMISTAJAN OMALTA SIVULTA. Juttu kertoo vain yhteenlasketun
 * tuotannon (98 GWh). Rabbalshede Kraftin hankesivut antavat
 * puistokohtaiset luvut, ja ne tasmaavat jutun summaan:
 *
 *   Lamminneva  36,7 MWp, 33,8 GWh/v, Lappajarvi
 *   Isoneva     71,5 MWp, 64,8 GWh/v, Suonenjoki
 *                         -------
 *                         98,6 GWh  (juttu: "noin 98 gigawattituntia")
 *
 * RAKENTAJAA EI KIRJATA. Juttu nimeaa vain omistajan; rivin
 * `builder` oli "Ruotsalaisyhtio", joka on otsikosta poimittu eika
 * yrityksen nimi. Kentta jatetaan tyhjaksi.
 *
 *   npx tsx scripts/pura-rabbalsheden-aurinkopuistot.ts
 *   npx tsx scripts/pura-rabbalsheden-aurinkopuistot.ts --apply
 */

const LAHDERIVI = "538a6c88-05c1-453f-8fe4-92439f895f87"
const JUTTU =
  "https://www.rakennuslehti.fi/2026/10/ruotsalaisyhtio-rakentaa-kaksi-aurinkopuistoa-suomeen-uusia-hankkeita-valmisteilla/"

const YHTEINEN =
  "Lamminneva ja Isoneva ovat ruotsalaisen Rabbalshede Kraftin ensimmäiset rakentamat aurinkopuistot, " +
  "ja niiden yhteenlaskettu arvioitu vuosituotanto on noin 98 gigawattituntia. Molemmat rakennetaan " +
  "entisille turvetuotantoalueille. Hankkeet on kehittänyt Neova, ja Rabbalshede Kraft otti ne kokonaan " +
  "omistukseensa sijoituspäätöksen yhteydessä. Hankkeille on myönnetty yhteensä 9,1 miljoonaa euroa " +
  "EU:n uusiutuvan energian RENEWFM-rahoitusmekanismista kilpailullisessa menettelyssä.\n\n" +
  "Lähteet: Rakennuslehti 19.10.2026 ja Rabbalshede Kraftin hankesivu."

const PUISTOT = [
  {
    nimi: "Lamminnevan aurinkopuisto",
    tunnus: "lamminnevan-aurinkopuisto",
    kunta: "Lappajärvi",
    maakunta: "Etelä-Pohjanmaa",
    sivu: "https://www.rabbalshedekraft.se/fi/lamminneva",
    teho: "36,7 MWp",
    tuotanto: "33,8 GWh",
    kuvaus:
      "Rabbalshede Kraft rakentaa Lappajärvelle Lamminnevan aurinkopuiston. Puiston kokonaisteho on " +
      "36,7 MWp ja arvioitu vuosituotanto 33,8 gigawattituntia. Hanke on rakentamisen valmisteluvaiheessa, " +
      "ja puisto on tarkoitus ottaa käyttöön keväällä 2027.\n\n" +
      YHTEINEN,
  },
  {
    nimi: "Isonevan aurinkopuisto",
    tunnus: "isonevan-aurinkopuisto",
    kunta: "Suonenjoki",
    maakunta: "Pohjois-Savo",
    sivu: "https://www.rabbalshedekraft.se/fi/isoneva",
    teho: "71,5 MWp",
    tuotanto: "64,8 GWh",
    kuvaus:
      "Rabbalshede Kraft rakentaa Suonenjoelle Isonevan aurinkopuiston. Puiston kokonaisteho on " +
      "71,5 MWp ja arvioitu vuosituotanto 64,8 gigawattituntia. Hanke on rakentamisen valmisteluvaiheessa, " +
      "ja puisto on tarkoitus ottaa käyttöön keväällä 2027.\n\n" +
      YHTEINEN,
  },
] as const

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  for (const p of PUISTOT) {
    const { data: onko, error } = await db
      .from("potential_projects")
      .select("id, status")
      .eq("title", p.nimi)
    if (error) {
      console.error(`VIRHE haku: ${error.message}`)
      process.exit(1)
    }

    console.log(`\n${p.nimi}  [${p.kunta}, ${p.maakunta}]`)
    console.log(`   teho ${p.teho}, vuosituotanto ${p.tuotanto}, valmistuu keväällä 2027`)
    console.log(`   tilaaja Rabbalshede Kraft, rakentaja tyhjä (lähde ei kerro)`)
    console.log(`   lähde   ${JUTTU.slice(8, 70)}…#${p.tunnus}`)
    console.log(`   ${p.kuvaus.slice(0, 150).replace(/\n/g, " ")}...`)

    if ((onko ?? []).length) {
      console.log(`   ON JO JONOSSA: ${JSON.stringify(onko)} -- ei lisätä`)
      continue
    }
    if (!apply) {
      console.log(`   lisätään jonoon`)
      continue
    }

    const { error: e1 } = await db.from("potential_projects").insert({
      title: p.nimi,
      municipality: p.kunta,
      status: "new",
      confidence: 85,
      source_count: 1,
      metadata: {
        city: p.kunta,
        region: p.maakunta,
        source: "rakennuslehti",
        source_name: "rakennuslehti",
        source_url: `${JUTTU}#${p.tunnus}`,
        operation: p.nimi,
        description: p.kuvaus,
        developer: "Rabbalshede Kraft",
        phase_hint: "Suunnittelu",
        building_type: "Energiantuotanto",
        estimated_completion: "2027-05-31",
        teho: p.teho,
        vuosituotanto: p.tuotanto,
        related_companies: ["Rabbalshede Kraft", "Neova Oy"],
        eroteltu_rivista: LAHDERIVI,
        eroteltu_lahteen_sanamuoto:
          "Lamminneva rakennetaan Lappajärvelle Etelä-Pohjanmaalle ja Isoneva Suonenjoelle Pohjois-Savoon",
        source_history: [
          {
            seen_at: new Date().toISOString(),
            source_name: "rakennuslehti",
            source_url: `${JUTTU}#${p.tunnus}`,
            document_url: JUTTU,
          },
          {
            seen_at: new Date().toISOString(),
            source_name: "rabbalshede_kraft",
            source_url: p.sivu,
            document_url: p.sivu,
          },
        ],
      },
    })
    if (e1) console.error(`   VIRHE: ${e1.message}`)
    else console.log(`   lisätty jonoon`)
  }

  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
