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
 * TURUN RAITIOTIE KAHTENA JULKISENA HANKKEENA -> JONOON (D-306).
 *
 * Johannes 18.10.2026: *"turun raitio tie on nyt useana hankkeena."*
 *
 * EI YHDISTETA TASSA. Yhdistaminen on katselmoijan paatos; tama vie
 * parin jonoon kuten muutkin kaksoiskappale-ehdokkaat.
 *
 * Todisteet (luettu molemmilta riveilta):
 *
 *   85a116f7  "Turun raitiotie"           26.5.2026, Rakenteilla, julkinen
 *             tilaaja Turun kaupunki, rakentaja "GRK, NRC Group"
 *             kuvaus: kaupunginvaltuusto paatti 18.5. etta Turun
 *             Raitiotieallianssi rakentaa raitiotien
 *
 *   09d73bd8  "Turun Raitiotieallianssi"  17.10.2026, Rakenteilla, julkinen
 *             tilaaja Turun Raitiotie Oy ja Turun kaupunki,
 *             rakentaja NRC Group Finland Oy
 *             kuvaus: sama valtuuston paatos toukokuulta 2026
 *
 * Kolmas rivi 1fc5e7e7 ("Raitiotien rakentaminen Turussa") on JO
 * kasitelty: pari 85a116f7 <-> 1fc5e7e7 vahvistettiin
 * kaksoiskappaleeksi 17.10. klo 19:45 ja rivi on ei-julkinen.
 *
 * Nimi ei muutu yhdistamisessa: vanhempi voittaa ja tuleva otsikko
 * menee `also_known_as`-listaan.
 *
 *   npx tsx scripts/lisaa-turun-raitiotie-pari.ts
 *   npx tsx scripts/lisaa-turun-raitiotie-pari.ts --apply
 */

const VANHA = "85a116f7-2e91-4d1a-b2b7-cfb6794c3ff5"
const UUSI = "09d73bd8-69fe-444f-a42c-ca61557a2c34"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* Varmistus: molemmat ovat yha olemassa ja julkisia. */
  const { data: hankkeet, error } = await db
    .from("projects")
    .select("id, name, phase, is_public, city, developer, builder")
    .in("id", [VANHA, UUSI])
  if (error) {
    console.error("VIRHE:", error.message)
    process.exit(1)
  }
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  for (const p of hankkeet ?? []) {
    console.log(`  ${p.id}  jul=${p.is_public}  ${String(p.phase).padEnd(14)} ${p.name}`)
  }
  if ((hankkeet ?? []).length !== 2) {
    console.error("VIRHE: molempia hankkeita ei loydy, ei jatketa")
    process.exit(1)
  }

  /* Onko pari jo jonossa tai jo katselmoitu? */
  const { data: olemassa, error: e2 } = await db
    .from("project_duplicate_candidates")
    .select("id, status, reviewed_at")
    .or(
      `and(project_id_a.eq.${VANHA},project_id_b.eq.${UUSI}),and(project_id_a.eq.${UUSI},project_id_b.eq.${VANHA})`
    )
  if (e2) {
    console.error("VIRHE parihaku:", e2.message)
    process.exit(1)
  }
  if ((olemassa ?? []).length) {
    console.log(`\nPari on jo kannassa: ${JSON.stringify(olemassa)}`)
    console.log("Ei lisata uudelleen.")
    return
  }
  console.log("\nParia ei ole jonossa.")

  const rivi = {
    project_id_a: VANHA,
    project_id_b: UUSI,
    confidence: 95,
    reasons: [
      "sama hanke: Turun raitiotie",
      "molemmat viittaavat valtuuston paatokseen toukokuulta 2026",
      "vanhemman rakentajakentassa lukee jo NRC Group",
      "lisatty kasin 18.10.2026 Johanneksen havainnosta",
    ],
  }
  console.log(`\nLISATAAN:\n${JSON.stringify(rivi, null, 1)}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e3 } = await db.from("project_duplicate_candidates").insert(rivi)
  if (e3) {
    console.error(`VIRHE lisayksessa: ${e3.message}`)
    process.exit(1)
  }
  console.log("\nLISATTY jonoon katselmoitavaksi.")
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
