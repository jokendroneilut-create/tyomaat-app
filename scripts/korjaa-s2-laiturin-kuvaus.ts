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
 * S2-LAITURIN KUVAUS KERTOI HANKINNAN KESKEYTYNEEKSI (D-331).
 *
 * Johannes 22.10.2026: *"vaihda tuo kuvaus."*
 *
 * Rivilla on kaksi Hilma-ilmoitusta samasta hankinnasta. Rakentaja tuli
 * ratkaisuilmoituksesta, mutta `additional_info` jai
 * KESKEYTYSILMOITUKSESTA, joka saapui myohemmin -- ja se paattyi
 * sanoihin "Hankinta on keskeytetty." Asiakas luki siis rakenteilla
 * olevasta hankkeesta etta hankinta peruttiin.
 *
 * Uusi teksti on Lohkare Infran tiedotteesta 21.10.2026.
 *
 * KAKSI KENTTAA. Asiakkaan hankekortti lukee `additional_info`
 * -sarakkeen ([[measure-the-field-the-user-reads]]), mutta
 * `metadata.description` on sama teksti ja se paatyy muun muassa
 * duplikaattivertailuun -- molemmat paivitetaan, jottei niihin jaa eri
 * totuutta.
 *
 * 172 MILJOONAA EI OLE TAMAN URAKAN ARVO vaan koko Ferry Terminal
 * Turku -hankkeen satama-alueinvestointi. Se mainitaan tekstissa
 * nimenomaan hankkeen lukuna eika kirjoiteta `estimated_cost`-kenttaan,
 * jossa on jo Hilman antama 67,39 M euroa
 * ([[combined-figure-split-by-owner-page]]).
 *
 * Vanha teksti talteen `additional_info_edellinen`-kenttaan.
 *
 *   npx tsx scripts/korjaa-s2-laiturin-kuvaus.ts
 *   npx tsx scripts/korjaa-s2-laiturin-kuvaus.ts --apply
 */

const HANKE = "e367dc88-b350-4684-b4c5-2e8a66aa7729"
const TIEDOTE =
  "https://lohkare.fi/lohkare-infraan-kuuluva-oteran-toteuttaa-turun-sataman-mittavan-s2-laituriurakan/"

const KUVAUS = [
  "Turun Satama Oy ja Oteran Oy ovat allekirjoittaneet sopimuksen Ferry Terminal Turku (FTT) -hankkeen " +
    "S2-laituriurakasta. Urakka sisältää laiturin perusparannuksen ja matkustajakäytävän rakentamisen, ja se " +
    "käynnistyi syys–lokakuun vaihteessa 2026. Oteran toimii pääurakoitsijana Fregatti-terminaalin toisen " +
    "laiturin uudistamisessa.",
  "Viking Linen käyttöön tulevaa laituria perusparannetaan 220 metrin matkalta. Uusi laiturirakenne perustetaan " +
    "teräsputkipaaluille ja toteutetaan paikallavalettuna betonirakenteena, ja laituriin siirretään alusten " +
    "kiinnittymistä automatisoivat automooring-laitteet. Paalutuksia tehdään lähes 40 kilometriä sekä kuivalla " +
    "maalla että lautalta mereen paaluttaen, yksittäiset paalut ovat 45–50 metriä pitkiä, ja laiturirakenteisiin " +
    "valetaan noin 15 000 kuutiometriä betonia. Urakkaan kuuluvat lisäksi matkustajakäytävän, kolmen " +
    "maihinnoususillakkeen sekä pääkansi- ja sivurampin suunnittelu ja toteutus.",
  "S2-laiturin on määrä valmistua vuonna 2028. Urakka on osa Ferry Terminal Turku -hanketta, jonka " +
    "satama-alueinvestointi on 172 miljoonaa euroa; lisäksi Turun kaupunki investoi liikennejärjestelyihin. " +
    "Turun Satama kilpailutti urakan ensin Hilmassa ja se hankinta keskeytettiin.",
].join("\n\n")

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("projects")
    .select("id, name, additional_info, metadata")
    .eq("id", HANKE)
    .maybeSingle()
  if (error || !data) {
    console.error(`VIRHE: ${error?.message ?? "ei rivia"}`)
    process.exit(1)
  }
  const p = data as any
  const vanha = String(p.additional_info ?? "")
  const vanhaMeta = String(p.metadata?.description ?? "")

  console.log(`\n${p.name}`)
  console.log(`\n--- VANHA additional_info (${vanha.length} merkkia) ---\n${vanha}`)
  console.log(
    `\n--- metadata.description (${vanhaMeta.length} merkkia) ${vanhaMeta === vanha ? "= sama teksti" : "= ERI teksti"} ---`
  )
  if (vanhaMeta !== vanha) console.log(vanhaMeta.slice(0, 400))
  console.log(`\n--- UUSI (${KUVAUS.length} merkkia) ---\n${KUVAUS}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun teksti on luettu.")
    return
  }

  const md: Record<string, any> = { ...(p.metadata ?? {}) }
  md.description = KUVAUS
  md.additional_info_edellinen = {
    teksti: vanha,
    syy: "KESKEYTYSILMOITUKSEN teksti rakenteilla olevalla hankkeella",
    korvattu: TIEDOTE,
    milloin: new Date().toISOString().slice(0, 10),
  }

  const { error: kirjoitus } = await db
    .from("projects")
    .update({ additional_info: KUVAUS, metadata: md })
    .eq("id", HANKE)
  if (kirjoitus) {
    console.error(`VIRHE: ${kirjoitus.message}`)
    process.exit(1)
  }
  console.log(`\nKirjoitettu. Vanha teksti talteen metadata.additional_info_edellinen-kenttaan.`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
