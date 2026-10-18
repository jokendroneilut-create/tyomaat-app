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
 * KAHDEN JOENSUUN RIVIN PUUTTEET (D-308).
 *
 * Johannes 18.10.2026: *"tasta puuttuu liiteen kustannusarvio ja
 * kohdetyyppi on koulu, sekin kerrotaan"* ja *"katso myos muut
 * vastaavat jonossa mita purettiin."*
 *
 * Kaikki kymmenen eroteltua riviä kaytiin lapi. Kaksi vaatii
 * korjauksen; muilla tyyppi on paikallaan eika lahde kerro
 * kustannusta (purkukohteille ei ole omaa summaa investointiosassa).
 *
 * 1) TIKKARINNE 9: tyyppi ja kustannus tyhjia.
 *    Oma liite (Hankesuunnitelma, 16 s.) kertoo molemmat:
 *      "kustannusarvio on 2 250 000 euroa (alv 0 %)"
 *      kohde on Karelia-ammattikorkeakoulun Tikkarinne-kampus
 *    Tyyppiarvo on `Koulu` (kannassa 315 kertaa; "koulu" pienella 9).
 *
 * 2) NOLJAKAN PAIVAKOTI: kustannukseksi tuli 7 100 000, mika on
 *    VANHENTUNUT luku. Liite sanoo: "Hankesuunnitelman mukainen
 *    kustannusarvio OLI 7,1 milj. euroa. Hankkeen kustannusennuste on
 *    paivittynyt urakkatarjousten saamisten jalkeen 6,5 milj. euroon."
 *
 *    Virhe on omani: kirjoitin kuvaukseen molemmat luvut, ja poimija
 *    otti ensimmaisen. Korjataan seka arvo etta kuvauksen jarjestys,
 *    jotta voimassa oleva luku on ensin.
 *
 *   npx tsx scripts/korjaa-joensuun-puutteet.ts
 *   npx tsx scripts/korjaa-joensuun-puutteet.ts --apply
 */

const TIKKARINNE = "5dfef42e-6dc5-4715-ba9d-46d6d0ce8677"
const TIKKARINNE_LIITE =
  "https://dynastyjulkaisu.pohjoiskarjala.net:443/joensuu/kokous/20261378-6-104241.PDF"

const NOLJAKKA_KUVAUS =
  "Noljakan uusi päiväkoti (TL1) korvaa Tarpojan ja Äkkiväärän päiväkodit. " +
  "Erkinpellontien varteen kaavoittuvalle tontille rakennetaan 6-osastoinen uusi päiväkoti. " +
  "Päiväkoti toteutetaan KVR-urakkana, jossa päätoteuttaja vastaa kohteen toteutussuunnittelusta ja toteutuksesta. " +
  "Rakentaminen ajoittuu elokuusta 2026 vuoden 2027 loppuun saakka, ja kohteen käyttö alkaa vuoden 2028 alussa. " +
  "Kustannusennuste on urakkatarjousten jälkeen 6,5 milj. euroa (hankesuunnitelman mukainen arvio oli 7,1 milj. euroa). " +
  "Kaupunginvaltuusto päätti hankkeen toteuttamisesta 10.11.2025 §120. Hanke on Euroopan unionin osarahoittama."

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Tikkarinne --- */
  const { data: tik, error } = await db
    .from("potential_projects")
    .select("id, title, metadata")
    .eq("id", TIKKARINNE)
    .maybeSingle()
  if (error || !tik) {
    console.error(`VIRHE: Tikkarinne-riviä ei loytynyt (${error?.message ?? "ei rivia"})`)
    process.exit(1)
  }
  const tm: any = tik.metadata ?? {}
  console.log(`\n1) ${String(tik.title).slice(0, 56)}`)
  console.log(`   tyyppi    ${tm.building_type ?? "-"}  ->  Koulu`)
  console.log(`   kustannus ${tm.estimated_cost ?? "-"}  ->  2250000`)
  console.log(`   lahde     liite "Hankesuunnitelma": "kustannusarvio on 2 250 000 euroa (alv 0 %)"`)
  console.log(`             kohde on Karelia-ammattikorkeakoulun Tikkarinne-kampus`)

  /* --- 2. Noljakka --- */
  const { data: nol, error: e2 } = await db
    .from("potential_projects")
    .select("id, title, metadata")
    .eq("title", "Noljakan uusi päiväkoti")
    .maybeSingle()
  if (e2 || !nol) {
    console.error(`VIRHE: Noljakka-riviä ei loytynyt (${e2?.message ?? "ei rivia"})`)
    process.exit(1)
  }
  const nm: any = nol.metadata ?? {}
  console.log(`\n2) ${String(nol.title).slice(0, 56)}`)
  console.log(`   kustannus ${nm.estimated_cost ?? "-"}  ->  6500000  (vanhentunut luku korvataan)`)
  console.log(`   kuvaus    voimassa oleva luku siirretaan ensimmaiseksi`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const { error: e3 } = await db
    .from("potential_projects")
    .update({
      metadata: {
        ...tm,
        building_type: "Koulu",
        building_type_source: "liite",
        estimated_cost: 2_250_000,
        cost_source: "text",
        cost_source_url: TIKKARINNE_LIITE,
      },
    })
    .eq("id", TIKKARINNE)
  if (e3) {
    console.error(`VIRHE Tikkarinne: ${e3.message}`)
    process.exit(1)
  }
  console.log(`\n   Tikkarinne kirjoitettu`)

  const { error: e4 } = await db
    .from("potential_projects")
    .update({
      metadata: {
        ...nm,
        estimated_cost: 6_500_000,
        description: NOLJAKKA_KUVAUS,
        cost_source: "text",
      },
    })
    .eq("id", nol.id)
  if (e4) {
    console.error(`VIRHE Noljakka: ${e4.message}`)
    process.exit(1)
  }
  console.log(`   Noljakka kirjoitettu`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
