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
 * GTK MINTEC: NAAPURIN VALMISTUMINEN POIS KOETEHTAAN RIVILTA (D-354).
 *
 * Johannes 26.10.2026: *"selvita kohta 1 senaatin sivuilta"* -- onko
 * "GTK Mintecin uudisrakennus" sama hanke kuin "uusi koetehdas".
 *
 * EI OLE, ja Senaatin oma teksti sanoo sen: *"Koetehdas rakennetaan
 * vuonna 2024 valmistuneen toimisto- ja laboratoriorakennuksen
 * viereen."* Kaksi eri rakennusta samalla tontilla:
 *
 *   9f899384  toimisto- ja laboratoriorakennus  3 300 brm2, valmistui 2024
 *   fe8c9611  koetehdas                         5 300 brm2, 8/2026-2028
 *
 * Rivit kuuluvat siis erilleen. Kaksoiskappale on fe8c9611 <-> f8f7eb97
 * (sama koetehdas kahdesta lahteesta).
 *
 * KOETEHTAAN RIVILLE OLI KIRJATTU NAAPURIN VALMISTUMINEN
 * (2024-12-31). Rivi on kaynnissa olevasta tyomaasta, joten mennyt
 * paiva olisi siirtanyt sen Valmistuneeksi ja piilottanut asiakkaalta
 * 90 vuorokaudessa (D-298, [[hiding-threshold]]). Senaatin sivu antaa
 * oikean: vaihe 1 kayttoon 6/2028, vaihe 2 1/2029 -- koko hanke on
 * valmis jalkimmaisessa.
 *
 * MUUTA EI KIRJOITETA TALLA AJOLLA. Kustannus (23 M EUR), aikataulun
 * alku ja suunnittelijat kuuluvat SILLE riville joka jaa jaljelle, ja
 * se ratkeaa vasta katselmoinnissa -- niita ei kannata kirjoittaa
 * kahteen ([[check-duplicate-reviews]]).
 *
 *   npx tsx scripts/korjaa-gtk-mintec.ts
 *   npx tsx scripts/korjaa-gtk-mintec.ts --apply
 */

const KOETEHDAS = "fe8c9611-cc80-400f-881e-cd8a75f7967a"
const RAKENNUSLEHTI = "f8f7eb97-8637-4da5-8ab6-f1fb113f284a"
const VALMIS = "2029-01-31"
const SIVU = "https://www.senaatti.fi/hankkeet/gtk-mintec-geologian-tutkimuskeskus/"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("projects")
    .select("id,name,phase,estimated_completion,metadata")
    .eq("id", KOETEHDAS)
    .single()
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }

  console.log(`\n${data.name} (${data.phase})`)
  console.log(`   valmistuu ${data.estimated_completion ?? "tyhjä"} -> ${VALMIS}`)
  console.log(`   (naapurin 2024 pois; Senaatti: vaihe 1 käyttöön 6/2028, vaihe 2 1/2029)`)

  /* Pari katselmointiin, ei yhdisteta itse. */
  const { data: pari } = await db
    .from("project_duplicate_candidates")
    .select("id,status")
    .or(
      `and(project_id_a.eq.${KOETEHDAS},project_id_b.eq.${RAKENNUSLEHTI}),and(project_id_a.eq.${RAKENNUSLEHTI},project_id_b.eq.${KOETEHDAS})`
    )
  console.log(`\n   kaksoispari: ${pari?.length ? "on jo kannassa" : "viedään katselmoitavaksi"}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const md = {
    ...(data.metadata ?? {}),
    estimated_completion: VALMIS,
    estimated_completion_lahde: {
      paiva: VALMIS,
      lause: "vaihe 1 käyttöönotto 6/2028, vaihe 2 käyttöönotto 1/2029",
      jasennin: "Senaatin hankesivu (naapurin 2024 oli väärin)",
      lahde: SIVU,
      milloin: "2026-10-26",
    },
  }
  const { error: e1 } = await db
    .from("projects")
    .update({ estimated_completion: VALMIS, metadata: md })
    .eq("id", KOETEHDAS)
  if (e1) console.error(`   VIRHE: ${e1.message}`)
  else console.log("   valmistuminen korjattu")

  if (!pari?.length) {
    const { error: e2 } = await db.from("project_duplicate_candidates").insert({
      project_id_a: KOETEHDAS,
      project_id_b: RAKENNUSLEHTI,
      confidence: 95,
      reasons: [
        "sama kohde: GTK Mintecin uusi koetehdas Outokummussa, 5 300 brm2",
        "molemmilla tilaaja Senaatti-kiinteistöt",
        "toinen Senaatin hankesivulta, toinen Rakennuslehden jutusta",
        "EI sama kuin 9f899384: se on viereinen 3 300 brm2 toimistorakennus, valmistui 2024",
      ],
    })
    if (e2) console.error(`   VIRHE parin lisäyksessä: ${e2.message}`)
    else console.log("   pari lisätty katselmointiin")
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
