import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LOUHINTAHIEKAN TYOPAALLIKOT YRITYSREKISTERIIN.
 *
 * Johannes 6.11.2026: *"meilla on tallessa naista tyopaallikoista vain
 * Jani Pullikka. Lisataan muutkin talteen."*
 *
 * LAHDE: louhintahiekka.fi/yhteydenotot. Nimi, nimike, sahkoposti ja
 * puhelin ovat kaikki sivun rakenteisessa `team_item`-lohkossa, eika
 * mitaan paatelty: osoite on `mailto:`-linkissa kokonaan. Jokaisen
 * osoitteen paikallisosa tarkistettiin nimea vastaan (19/19 tasmasi),
 * joten nimi ja osoite eivat ole menneet ristiin.
 *
 * PULLIKKA ON MUKANA VAIKKA HAN ON JO TIEDOSSA. Han esiintyy kahden
 * hankkeen `contact_persons`-listassa, mutta ILMAN NIMIKETTA (`title`
 * on null molemmilla). `yrityksenHenkilot` yhdistaa saman ihmisen
 * sahkopostin perusteella ja kayttaa rekisterin rivia pohjana, joten
 * tama rivi antaa hanelle nimikkeen eika kahdenna hanta.
 *
 * VAIN TYOPAALLIKOT. Sivulla on myos johto (3), liiketoimintajohtajat
 * (4) ja hallinto (4) -- yhteensa 11 muuta nimea yhteystietoineen.
 * Niita ei lisata ilman erillista pyyntoa, koska pyynto koski
 * tyopaallikoita.
 *
 *   npx tsx scripts/lisaa-louhintahiekan-tyopaallikot.ts
 *   npx tsx scripts/lisaa-louhintahiekan-tyopaallikot.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const AVAIN = "louhintahiekka"
const YRITYS = "Louhintahiekka Oy"
const LAHDE = "kasin: louhintahiekka.fi/yhteydenotot, luettu 6.11.2026"

const TYOPAALLIKOT = [
  { nimi: "Aleksi Vipusaari", nimike: "Työpäällikkö, Etelä-Suomi", email: "aleksi.vipusaari@louhintahiekka.fi", puhelin: "0400 395 690" },
  { nimi: "Joona Liukku", nimike: "Työpäällikkö, Etelä-Suomi", email: "joona.liukku@louhintahiekka.fi", puhelin: "044 765 7394" },
  { nimi: "Mikko Korhonen", nimike: "Työpäällikkö, Etelä-Suomi, Kymenlaakso", email: "mikko.korhonen@louhintahiekka.fi", puhelin: "046 923 3321" },
  { nimi: "Jani Pullikka", nimike: "Työpäällikkö, Pirkanmaa, Keski-Suomi ja Satakunta", email: "jani.pullikka@louhintahiekka.fi", puhelin: "040 418 3603" },
  { nimi: "Ville Lonka", nimike: "Työpäällikkö, Varsinais-Suomi", email: "ville.lonka@louhintahiekka.fi", puhelin: "040 829 0089" },
  { nimi: "Antti Niemi", nimike: "Työpäällikkö, Etelä-Suomi, Päijät-Häme, Kymenlaakso", email: "antti.niemi@louhintahiekka.fi", puhelin: "050 593 0456" },
  { nimi: "Onni Kilpeläinen", nimike: "Työpäällikkö, Pohjois-Suomi", email: "onni.kilpelainen@louhintahiekka.fi", puhelin: "050 340 8603" },
  { nimi: "Mikko Nyrhinen", nimike: "Työpäällikkö, datakeskukset ja teollisuus", email: "mikko.nyrhinen@louhintahiekka.fi", puhelin: "040 544 3884" },
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { yritysavain } = await import("../lib/metrics/yritysavain")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* Avain on sama normalisointi jota sivun liitos kayttaa, ei kasin kirjoitettu. */
  const avain = yritysavain(YRITYS)
  if (avain !== AVAIN) throw new Error(`avain muuttui: "${avain}" != "${AVAIN}"`)

  const { data: ennen, error } = await db
    .from("yritys_yhteyshenkilot")
    .select("nimi,nimike,email,puhelin")
    .eq("avain", avain)
  if (error) throw error
  console.log(`Rekisterissa nyt ${ennen?.length ?? 0} riviä avaimella "${avain}"`)
  for (const r of ennen ?? []) console.log(`   ${r.nimi} | ${r.nimike ?? "-"} | ${r.email ?? "-"}`)

  const olemassa = new Set((ennen ?? []).map((r) => String(r.email ?? "").toLowerCase()))
  const rivit = TYOPAALLIKOT.map((h) => ({ avain, yritys: YRITYS, ...h, lahde: LAHDE }))

  console.log(`\nKirjoitetaan ${rivit.length} riviä:`)
  for (const r of rivit) {
    const merkki = olemassa.has(r.email.toLowerCase()) ? "paivitetaan" : "UUSI       "
    console.log(`   ${merkki} ${r.nimi.padEnd(18)} | ${r.nimike.padEnd(50)} | ${r.puhelin}`)
  }

  if (!APPLY) {
    console.log("\nKUIVAHARJOITUS — ei kirjoitettu")
    return
  }

  /*
   * EI `upsert`IA. Taululla EI OLE uniikkirajoitetta `(avain, email)`,
   * joten `onConflict: "avain,email"` kaatuu ("there is no unique or
   * exclusion constraint matching the ON CONFLICT specification") ja
   * varareitti tekee suoran `insert`in -- eli uudelleenajo KAHDENTAISI
   * jokaisen rivin. Sama varareitti on `kokoa-yritysrekisteri.ts`:ssa.
   *
   * Siksi olemassaolo tarkistetaan itse: tunnettu sahkoposti
   * paivitetaan, tuntematon lisataan. Nain ajo on toistettavissa.
   */
  for (const rivi of rivit) {
    if (olemassa.has(rivi.email.toLowerCase())) {
      const { error: e3 } = await db
        .from("yritys_yhteyshenkilot")
        .update({ nimi: rivi.nimi, nimike: rivi.nimike, puhelin: rivi.puhelin, lahde: rivi.lahde })
        .eq("avain", avain)
        .eq("email", rivi.email)
      if (e3) console.log(`   VIRHE paivitys ${rivi.nimi}: ${e3.message}`)
      continue
    }
    const { error: e4 } = await db.from("yritys_yhteyshenkilot").insert(rivi)
    if (e4) console.log(`   VIRHE lisays ${rivi.nimi}: ${e4.message}`)
  }

  const { data: jalkeen } = await db
    .from("yritys_yhteyshenkilot")
    .select("nimi,nimike,puhelin,email")
    .eq("avain", avain)
    .order("nimi")
  console.log(`\n=== AJETTU === rekisterissa nyt ${jalkeen?.length ?? 0} riviä`)
  for (const r of jalkeen ?? []) console.log(`   ${String(r.nimi).padEnd(18)} | ${r.nimike ?? "-"}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
