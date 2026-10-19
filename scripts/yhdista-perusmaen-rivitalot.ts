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
 * PERUSMAEN RIVITALOT: JONORIVI HANKKEESEEN, TIEDOTE LAHTEEKSI (D-321).
 *
 * Johannes 19.10.2026: *"tama hanke loytyy tasta: <Vexatecin tiedote>
 * onko tama meilla lahteena tai olisikohan yhdistynyt kun
 * rakennuslehdesta tuli niin hatarat tiedot. vai oliko meilla jo
 * tama?"* -- ja *"yhdista jos oli ja lisaa vexatexin lahde
 * tarvittaessa."*
 *
 * VASTAUKSET:
 *   1. Vexatec EI ole lahteena: ei koodissa eika `discovery_sources`-
 *      taulussa.
 *   2. Hanke OLI jo kannassa: `f7534625` "Rivitaloja Espoon
 *      Perusmakeen, Lambertintie", rakentaja Vexatec Oy, vaihe
 *      Rakentaminen aloitettu. Johannes oli lisannyt sen itse
 *      kuvakaappauksesta (`source_name: kasin_kuvakaappaus`).
 *   3. Rakennuslehden rivi EI yhdistynyt siihen vaan jai jonoon
 *      omaksi rivikseen `b5271a4c` (155 merkkia, rakentaja tyhja).
 *
 * MITA TIEDOTE LISAA. Hankkeen kuvauksessa luki *"Tilaajaa ei mainita
 * julkaisussa"* -- Vexatecin oma tiedote nimeaa sen:
 *
 *   tilaaja   Novus Family Homes (Kuuskodit Investment Managementin
 *             ja Niamin yhteinen yhtio)
 *   osoite    Lambertintie 10, Perusmaen Pikkunevan alue
 *   asunnot   32, joista 13 kolmiota ja 19 vahintaan nelja huonetta
 *   rakenne   kuusi yksikerroksista puurakenteista rivitaloa
 *
 * LAHDE PUUTTUI KOKONAAN: kuvakaappauksesta lisatylla rivilla ei ollut
 * `source_url`-kenttaa, joten hankekortilla ei ollut yhtaan linkkia.
 * Tiedote kirjataan lahteeksi ja Rakennuslehden juttu
 * `source_history`-listaan. Alkuperainen tapa sailyy metadatassa.
 *
 * JONORIVI MERKITAAN KASITELLYKSI (`ignored`), koska se on sama hanke
 * (muisti: queue-removal-ignored -- poisto on tila, ei DELETE).
 *
 *   npx tsx scripts/yhdista-perusmaen-rivitalot.ts
 *   npx tsx scripts/yhdista-perusmaen-rivitalot.ts --apply
 */

const HANKE = "f7534625-7a78-48b7-8e0c-cfa3bf95b680"
const JONORIVI = "b5271a4c-6d77-44f8-9890-1abbe4622bff"

const TIEDOTE = "https://vexatec.fi/tiedotteet/32-rivitaloasuntoa-espoon-perusmakeen/"
const JUTTU = "https://www.rakennuslehti.fi/2026/10/vexatec-urakoi-rivitaloja-espooseen/"

const KUVAUS =
  "Vexatec Oy toteuttaa Espoon Perusmäkeen Lambertintie 10:een kuuden yksikerroksisen rivitalon " +
  "kokonaisuuden, yhteensä 32 asuntoa, KVR-urakkana suunnittelusta rakentamiseen. Tilaajana on " +
  "Novus Family Homes, joka on Kuuskodit Investment Managementin ja Niamin yhteinen yhtiö. Työmaa on " +
  "käynnissä lokakuussa 2026 ja kohteen on määrä valmistua loppuvuonna 2027.\n\n" +
  "Asunnoista 13 on kolmioita ja 19 vähintään neljän huoneen asuntoja. Kaikki asunnot ovat " +
  "yksitasoisia ja esteettömiä, ja rakennukset ovat puurakenteisia ja puupaneloituja. Asunnoissa on " +
  "suuret ikkunat ja omat saunat, ja jokaisella asunnolla on oma terassi, piha ja asuntokohtainen " +
  "varastotila. Pihapiiriin rakennetaan yhteisiä leikki- ja oleskelualueita, ulkovälinevarastoja sekä " +
  "erillinen polkupyörävarastorakennus. Kohde toteutetaan laadukkaaseen vuokra-asumiseen, ja " +
  "ratkaisuissa painottuu pientalomainen perheasuminen.\n\n" +
  "Kohde toteutetaan A-energialuokkaan, lämmitys perustuu maalämpöön ja kohteeseen rakennetaan " +
  "sähköautojen latauspisteitä. Kohde sijoittuu Perusmäen Pikkunevan alueelle, jonka lähistöllä on " +
  "golfkentät, koulu, päiväkoti ja päivittäistavarakauppoja sekä linja-autoyhteydet.\n\n" +
  "Lähteet: Vexatecin tiedote 15.10.2026 ja Rakennuslehti 19.10.2026."

const YRITYKSET = ["Vexatec Oy", "Novus Family Homes", "Kuuskodit Investment Management", "Niam"]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { collectProjectCompanies } = await import("../lib/projects/projectCompanies")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db.from("projects").select("*").eq("id", HANKE).maybeSingle()
  if (error || !data) {
    console.error(`VIRHE: hanketta ei loytynyt (${error?.message ?? "ei rivia"})`)
    process.exit(1)
  }
  const p: any = data
  const md: Record<string, any> = { ...(p.metadata ?? {}) }

  console.log(`\n1) HANKE ${p.name}`)
  console.log(`   developer             ${p.developer ?? "(tyhjä)"} -> Novus Family Homes`)
  console.log(`   source_url            ${md.source_url ?? "(tyhjä)"} -> ${TIEDOTE.slice(8, 60)}…`)
  console.log(`   source_name           ${md.source_name} -> vexatec (alkuperä säilyy metadatassa)`)
  console.log(`   related_companies     ${JSON.stringify(md.related_companies ?? null)} -> ${JSON.stringify(YRITYKSET)}`)
  console.log(`   apartments            ${md.apartments ?? "-"} -> 32`)
  console.log(`   project_address       ${md.project_address ?? "-"} -> Lambertintie 10`)
  console.log(`   kuvaus                ${String(p.additional_info ?? "").length} -> ${KUVAUS.length} merkkiä`)
  console.log(`   POISTUU kuvauksesta:  "Tilaajaa ei mainita julkaisussa."`)

  const jalkeen = collectProjectCompanies({
    ...p,
    developer: "Novus Family Homes",
    metadata: { ...md, related_companies: YRITYKSET },
  })
  console.log(`   osapuolet jälkeen:`)
  for (const c of jalkeen) console.log(`      ${c.role.padEnd(22)} ${c.name}`)

  const { data: jono } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .eq("id", JONORIVI)
    .maybeSingle()
  console.log(`\n2) JONORIVI ${(jono as any)?.title} [${(jono as any)?.status}]`)
  console.log(`   sama hanke -> status ignored, viite hankkeeseen ${HANKE.slice(0, 8)}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  md.source_url = TIEDOTE
  md.alkuperainen_lahde = md.source_name
  md.source_name = "vexatec"
  md.related_companies = YRITYKSET
  md.apartments = 32
  md.project_address = "Lambertintie 10"
  md.alue = "Perusmäen Pikkuneva"
  md.urakkamuoto = "KVR-urakka"
  const historia: any[] = Array.isArray(md.source_history) ? md.source_history : []
  for (const [nimi, url] of [
    ["vexatec", TIEDOTE],
    ["rakennuslehti", JUTTU],
  ] as const) {
    if (historia.some((h) => h?.source_url === url)) continue
    historia.push({ seen_at: new Date().toISOString(), source_name: nimi, source_url: url, document_url: url })
  }
  md.source_history = historia

  const { error: e1 } = await db
    .from("projects")
    .update({ developer: "Novus Family Homes", additional_info: KUVAUS, metadata: md })
    .eq("id", HANKE)
  if (e1) {
    console.error(`VIRHE hanke: ${e1.message}`)
    process.exit(1)
  }
  console.log(`\n   hanke päivitetty`)

  const jm: Record<string, any> = { ...((jono as any)?.metadata ?? {}) }
  jm.matched_existing_project_id = HANKE
  jm.yhdistetty = {
    milloin: new Date().toISOString().slice(0, 10),
    syy: "sama hanke kuin f7534625; tiedot siirretty hankkeelle ja Vexatecin tiedote lisätty lähteeksi",
  }
  const { error: e2 } = await db
    .from("potential_projects")
    .update({ status: "ignored", metadata: jm })
    .eq("id", JONORIVI)
  if (e2) console.error(`VIRHE jonorivi: ${e2.message}`)
  else console.log(`   jonorivi merkitty käsitellyksi (ignored)`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
