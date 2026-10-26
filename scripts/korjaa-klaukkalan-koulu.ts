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
 * KLAUKKALAN URHEILUPUISTON KOULU: AJAT AAMUPOSTIN JUTUSTA (D-354).
 *
 * Johannes 26.10.2026: *"laita arvioiduksi valmistumisajankohdaksi
 * urheilupuiston kouluun 1.1.2029"*.
 *
 * VALMISTUMINEN ON JOHANNEKSEN PAATOS, EI JASENTIMEN. Juttu sanoo
 * *"valmistuvan kevatlukukaudeksi 2029"*, ja se on monitulkintainen:
 * jasennin lukisi kevaan kauden viimeiseksi kuukaudeksi (31.5.), mutta
 * lukukaudeksi valmistuminen tarkoittaa valmista kauden ALKUUN.
 * Johannes ratkaisi sen: 1.1.2029.
 *
 * ALOITUS ON YKSISELITTEINEN: *"rakennustyot kaynnistyvat helmikuussa
 * 2027"* -> 2027-02-01, sama kuukauden ensimmainen paiva kuin
 * `parseFinnishStartDate` antaa.
 *
 * LAHDE ON MAKSUMUURIN TAKANA. Tiedot ovat sivun julkisesta
 * metakuvauksesta; itse juttua ei luettu eika maksumuuria kierretty.
 * Rivin oma lahde (Rakennuslehti) sailyy, ja Aamupostin osoite menee
 * metadataan lisalahteeksi.
 *
 * VAIHE EI MUUTU: helmikuu 2027 on tulevaisuudessa, eika vaihetta
 * johdeta paivasta ([[start-date-open-items]]).
 *
 *   npx tsx scripts/korjaa-klaukkalan-koulu.ts
 *   npx tsx scripts/korjaa-klaukkalan-koulu.ts --apply
 */

const HANKE = "b6cf3f9d-0f31-4d17-a837-db0af712551e"
const JUTTU = "https://www.aamuposti.fi/paikalliset/9893437"
const VALMIS = "2029-01-01"
const ALOITUS = "2027-02-01"
/*
 * KUVAUKSESSA ON VAARA VUOSILUKU, JA SE SELITTAA TYHJAN ALOITUKSEN.
 *
 * Rivilla lukee *"rakennustoiden on tarkoitus alkaa helmikuussa
 * **2007**"* -- kaksikymmenta vuotta vaarin. Siksi
 * `parseFinnishStartDate` hylkasi sen (yli viisi vuotta vanha aloitus
 * kertoo historiasta, D-326) ja kentta jai tyhjaksi. Aamupostin juttu
 * vahvistaa oikean vuoden: helmikuu 2027.
 *
 * Korjataan vuosiluku paikallaan. Toistavaa virketta EI lisata: kuvaus
 * kertoo molemmat asiat jo, vain vuosi oli vaarin.
 */
const VAARA_VUOSI = /alkaa\s+helmikuussa\s+2007/i
const OIKEA = "alkaa helmikuussa 2027"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("projects")
    .select("id,name,city,phase,developer,builder,construction_start,estimated_completion,additional_info,metadata")
    .eq("id", HANKE)
    .single()
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }

  console.log(`\n${data.name} (${data.city}, ${data.phase})`)
  console.log(`   tilaaja ${data.developer ?? "-"} | rakentaja ${data.builder ?? "-"}`)
  console.log(`   valmistuu ${data.estimated_completion ?? "tyhjä"} -> ${VALMIS}`)
  console.log(`   alkaa    ${data.construction_start ?? "tyhjä"} -> ${ALOITUS}`)

  const kuvaus = String(data.additional_info ?? "").trim()
  const uusiKuvaus = kuvaus.replace(VAARA_VUOSI, OIKEA)
  console.log(`   kuvaus: ${uusiKuvaus === kuvaus ? "ei muutosta" : "vuosiluku 2007 -> 2027"}`)
  console.log(`      ...${uusiKuvaus.slice(-160)}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const md = {
    ...(data.metadata ?? {}),
    description: uusiKuvaus,
    lisalahteet: [
      ...((data.metadata?.lisalahteet ?? []) as any[]),
      { url: JUTTU, julkaisija: "Aamuposti", mita: "aloitus ja valmistuminen", milloin: "2026-10-26" },
    ],
    estimated_completion_lahde: {
      paiva: VALMIS,
      jasennin: "Johanneksen päätös (kevätlukukausi = kauden alku)",
      milloin: "2026-10-26",
    },
    construction_start_lahde: {
      paiva: ALOITUS,
      lause: "rakennustyöt käynnistyvät helmikuussa 2027",
      jasennin: "Aamupostin metakuvaus (kuvauksen vuosiluku 2007 oli väärin)",
      milloin: "2026-10-26",
    },
  }

  const { error: e } = await db
    .from("projects")
    .update({
      estimated_completion: VALMIS,
      construction_start: ALOITUS,
      additional_info: uusiKuvaus,
      metadata: md,
    })
    .eq("id", HANKE)
  if (e) console.error(`VIRHE: ${e.message}`)
  else console.log("\nKirjoitettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
