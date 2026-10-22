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
 * LAUTAKUNNAN PAATOSTIEDOTE KATTAA MONTA ASIAA (D-332).
 *
 * Johannes 22.10.2026: *"tassa on olennaista tiivistaa kuvaukseen vaan
 * tuo uusi skeitti ja harrastushalli. muokkaatko kuvausta vai miten se
 * kannattaisi tehda? Vai kokonaan uusi hanke ja tuo lahteeksi?"*
 *
 * MUOKATAAN, EI TEHDA UUTTA. Rivilla on jo oikea otsikko (Johannes
 * korjasi sen), kunta Helsinki, osoite Malmi, rakennuttaja Helsingin
 * kaupunki ja oikea lahde-URL. Uusi rivi tarkoittaisi taman
 * hylkaamista, ja hylatty rivi on helppo tapa kadottaa hanke
 * ([[right-rejections-lose-projects]]). Tarkistettu ettei Malmin
 * hallista ole toista rivia kummassakaan taulussa.
 *
 * KAKSI VUOTOA SAMASTA TIEDOTTEESTA. Kulttuuri- ja vapaa-aikalautakunnan
 * tiedote 20.10.2026 kasitteli kolmea asiaa: skeittihalli, uimahallien
 * perhelippu ja paihdetyon suunnitelma. Molemmat vuosivat riville:
 *
 *   1. KUVAUS (4 000 merkkia) sisalsi perhelippukokeilun, lautakunnan
 *      kokoonpanon, avainsanat ja viestintapaallikon esittelyn.
 *   2. YHTEYSHENKILOT sisaltavat Anu Jokelan (alueliikuntapaallikko),
 *      joka on PERHELIPUN yhteyshenkilo -- ei tama hanke. Teemu Kosunen
 *      (projektipaallikko) on oikea ja jaa.
 *
 * Perhelippu ei ole rakennushanke eika siita jateta omaa rivia.
 *
 * VALMISTUMINEN: *"Tavoitteena on avata tilat ainakin osittain
 * joulukuussa 2026 ja kokonaisuudessaan tammikuussa 2027."* Otetaan
 * kokonaisuudessaan-paiva, koska se on hankkeen valmistuminen.
 *
 * Hyvaksynnassa `additional_info = metadata.description` (tarkistettu
 * approve-reitilta), joten tama muokkaus menee asiakkaan lukemaan
 * kenttaan.
 *
 *   npx tsx scripts/tiivista-malmin-skeittihalli.ts
 *   npx tsx scripts/tiivista-malmin-skeittihalli.ts --apply
 */

const RIVI = "9fbd7b06-ee72-468a-bfc6-a02ec1ce2a08"
const VALMISTUMINEN = "2027-01-31"

/* Vain skeitti- ja harrastushallia koskeva osa tiedotteesta. */
const KUVAUS = [
  "Malmin jäähalliin suunnitellaan väliaikaista skeitti- ja harrastushallia, joka palvelisi skeittauksen " +
    "lisäksi scoottausta, BMX-pyöräilyä ja muita urbaaneja temppulajeja. Skeittihallin yhteyteen tulee " +
    "harrastushalli, joka mahdollistaa matalan kynnyksen omaehtoisen harrastamisen sekä liikunnan että " +
    "katukulttuurien parissa.",
  "Jääkenttäsäätiön hallinnassa oleva halli soveltuu sijaintinsa ja olosuhteidensa puolesta väliaikaiseksi " +
    "skeitti- ja harrastushalliksi arviolta kahden vuoden ajaksi, sinä aikana kun pysyvän skeittihallin " +
    "sijaintia selvitetään. Halli voidaan ottaa skeitti- ja harrastuskäyttöön vähäisin muutostöin ja nopealla " +
    "aikataululla. Tavoitteena on avata tilat ainakin osittain joulukuussa 2026 ja kokonaisuudessaan " +
    "tammikuussa 2027.",
  "Uusi halli vastaa erityisesti Koillis-Helsingin lasten ja nuorten harrastustilojen tarpeeseen. Helsingin " +
    "nykyinen sisäskeittihalli Luuppi sijaitsee Kontulassa ja sen käyttöaste on korkea, joten uusi halli " +
    "täydentää kaupungin harrastusmahdollisuuksia ja parantaa erityisesti talvikauden olosuhteita. " +
    "Harrastushallin toiminnassa tehdään yhteistyötä liikuntapalvelujen ja alueella toimivien järjestöjen " +
    "kanssa.",
  "Helsingin kulttuuri- ja vapaa-aikalautakunta käsitteli hallin tarveselvitystä kokouksessaan 20.10.2026.",
].join("\n\n")

/* Perhelipun yhteyshenkilo ei kuulu tahan hankkeeseen. */
const POISTA_HENKILO = "Anu Jokela"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .eq("id", RIVI)
    .maybeSingle()
  if (error || !data) {
    console.error(`VIRHE: ${error?.message ?? "ei rivia"}`)
    process.exit(1)
  }
  const p = data as any
  const vanha = String(p.metadata?.description ?? "")
  const henkilot = Array.isArray(p.metadata?.contact_persons) ? (p.metadata.contact_persons as any[]) : []
  const jaa = henkilot.filter((c) => String(c?.name ?? "").trim() !== POISTA_HENKILO)
  const poistuu = henkilot.filter((c) => String(c?.name ?? "").trim() === POISTA_HENKILO)

  console.log(`\n${p.title}  [${p.status}]`)
  console.log(`\n--- KUVAUS NYT: ${vanha.length} merkkia ---`)
  console.log(`alku:  ${vanha.slice(0, 180)}…`)
  console.log(`loppu: …${vanha.slice(-180)}`)

  console.log(`\n--- UUSI KUVAUS: ${KUVAUS.length} merkkia ---\n${KUVAUS}`)

  console.log(`\n--- YHTEYSHENKILOT ---`)
  for (const c of jaa) console.log(`   JAA     ${c.name} | ${c.title} | ${c.phone} | ${c.email}`)
  for (const c of poistuu) console.log(`   POISTUU ${c.name} | ${c.title} | ${c.phone} | ${c.email}   (perhelipun yhteyshenkilo)`)

  console.log(
    `\n--- VALMISTUMINEN: ${JSON.stringify(p.metadata?.estimated_completion)} -> ${VALMISTUMINEN} ---`
  )

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun teksti on luettu.")
    return
  }

  const md: Record<string, any> = { ...(p.metadata ?? {}) }
  md.description = KUVAUS
  md.contact_persons = jaa
  md.estimated_completion = VALMISTUMINEN
  md.kuvaus_tiivistetty = {
    syy: "Lautakunnan paatostiedote kasitteli kolmea asiaa; vain skeitti- ja harrastushalli on tama hanke",
    poistettu_henkilo: poistuu.map((c) => c.name),
    alkuperainen_pituus: vanha.length,
    alkuperainen: vanha,
    milloin: new Date().toISOString().slice(0, 10),
  }

  const { error: kirjoitus } = await db.from("potential_projects").update({ metadata: md }).eq("id", RIVI)
  if (kirjoitus) {
    console.error(`VIRHE: ${kirjoitus.message}`)
    process.exit(1)
  }
  console.log(
    `\nKirjoitettu: kuvaus ${vanha.length} -> ${KUVAUS.length} merkkia, yhteyshenkiloita ${henkilot.length} -> ${jaa.length}, valmistuminen ${VALMISTUMINEN}.`
  )
  console.log("Alkuperainen teksti talteen metadata.kuvaus_tiivistetty-kenttaan.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
