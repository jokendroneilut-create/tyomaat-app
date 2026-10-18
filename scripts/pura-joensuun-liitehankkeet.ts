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
 * JOENSUUN LIITTEEN HANKKEET OMIKSI RIVEIKSEEN (D-308).
 *
 * Johannes 18.10.2026: *"tee numero 1 ja lisaa naihin irroitettuihin ja
 * purettuihin tuo linkki lahteeksi etta voin hylata tuon hankkeen jossa
 * kaikki ovat samassa."*
 *
 * Paatosasian `9beb523a` liite 2 "Talousarvio 2027 Toimitilahankkeiden
 * kuvaukset 2027-2029" sisaltaa kymmenen nimettya hanketta
 * kustannusarvioineen ja urakkamuotoineen. Tiedot on LUETTU PDF:sta,
 * ei paatelty: jokaisen kuvauksessa on liitteen oma sanamuoto.
 *
 * NELJA PUUTTUU KANNASTA kokonaan, ja yksi (Tikkarinne) on
 * LLM-portin automaattisesti ohittama. Loput kuusi ovat jo hankkeina.
 *
 * LAHDELINKIT kaikille eroteltuihin riveihin, jotta lahderivin voi
 * hylata ilman etta ketju katkeaa:
 *   source_url     paatossivu + oma fragmentti
 *   liite_urlt     molemmat liitteet
 *   eroteltu_rivista  lahderivin tunnus
 *
 *   npx tsx scripts/pura-joensuun-liitehankkeet.ts
 *   npx tsx scripts/pura-joensuun-liitehankkeet.ts --apply
 */

const LAHDE = "9beb523a-28eb-4755-a511-99ef37bb5368"
const PAATOS =
  "https://dynastyjulkaisu.pohjoiskarjala.net:443/joensuu/cgi/DREQUEST.PHP?page=meetingitem&id=20261518-3"
const LIITTEET = [
  "https://dynastyjulkaisu.pohjoiskarjala.net:443/joensuu/kokous/20261518-3-126165.PDF",
  "https://dynastyjulkaisu.pohjoiskarjala.net:443/joensuu/kokous/20261518-3-126166.PDF",
]

/* Tiedot luettu liitteesta 2 sanatarkasti. */
const UUDET = [
  {
    nimi: "Noljakan uusi päiväkoti",
    tunnus: "noljakan-uusi-paivakoti",
    tyyppi: "Päiväkoti",
    vaihe: "Rakenteilla",
    kustannus: 6_500_000,
    kuvaus:
      "Noljakan uusi päiväkoti (TL1) korvaa Tarpojan ja Äkkiväärän päiväkodit. " +
      "Erkinpellontien varteen kaavoittuvalle tontille rakennetaan 6-osastoinen uusi päiväkoti. " +
      "Päiväkoti toteutetaan KVR-urakkana, jossa päätoteuttaja vastaa kohteen toteutussuunnittelusta ja toteutuksesta. " +
      "Rakentaminen ajoittuu elokuusta 2026 vuoden 2027 loppuun saakka, ja kohteen käyttö alkaa vuoden 2028 alussa. " +
      "Hankesuunnitelman mukainen kustannusarvio oli 7,1 milj. euroa; kustannusennuste on päivittynyt urakkatarjousten jälkeen 6,5 milj. euroon. " +
      "Kaupunginvaltuusto päätti hankkeen toteuttamisesta 10.11.2025 §120. Hanke on Euroopan unionin osarahoittama.",
  },
  {
    nimi: "Mehtimäen jalkapallostadion",
    tunnus: "mehtimaen-jalkapallostadion",
    tyyppi: "Liikuntapaikka",
    vaihe: "Suunnittelussa",
    kustannus: null,
    kuvaus:
      "Kaupunginhallitus päätti 25.5.2026 §190 Mehtimäen jalkapallostadionin hankesuunnitelman teettämisestä. " +
      "Hankesuunnitelmassa määritellään katsomo-, selostus- ja kuvausrakenteet, tarvittava aluerakentaminen ja muut rakentamistarpeet. " +
      "Tavoitteena on täyttää Suomessa pelattavien jalkapallosarjojen vaatimukset kaikki sarjatasot huomioiden sekä UEFA:n stadionkategoria 2–3 -tason vaatimukset. " +
      "Hankesuunnitelmaa on tehty yhteistyössä Joensuun Edustusjalkapallo Oy:n ja Suomen Palloliiton kanssa. " +
      "Hankesuunnitelma valmistuu loppuvuodesta 2026, ja hankkeen sisällyttäminen suunnitelmakauden ohjelmaan ratkaistaan strategian puolivälitarkastelussa.",
  },
  {
    nimi: "Utran uusi koulu ja päiväkoti",
    tunnus: "utran-koulu-ja-paivakoti",
    tyyppi: "Koulu",
    vaihe: "Suunnittelussa",
    kustannus: null,
    kuvaus:
      "Kaupunginvaltuusto päätti 15.6.2026 §58 Mutalan, Rantakylän ja Utran alueen palveluverkkoselvityksessä, " +
      "että Utran alueelle rakennetaan uusi 3-sarjainen koulu ja 3-ryhmäinen päiväkoti. " +
      "Hankesuunnittelu käynnistetään päätöksen pohjalta ja hankesuunnitelma tuodaan käsiteltäväksi vuoden 2027 aikana. " +
      "Hanke on Euroopan unionin osarahoittama.",
  },
  {
    nimi: "Joensuun pääkirjaston peruskorjaus",
    tunnus: "paakirjaston-peruskorjaus",
    tyyppi: "Kirjasto",
    vaihe: "Suunnittelussa",
    kustannus: null,
    kuvaus:
      "Pääkirjasto on valmistunut vuonna 1992, eikä rakennukseen ole sen jälkeen kohdistunut merkittäviä korjaustoimenpiteitä " +
      "lukuun ottamatta lasten ja nuorten osaston uudistamista. " +
      "Selvityksissä on todettu rakennuksessa ja sen talotekniikassa ikääntymisestä johtuvia korjaus- ja kunnostustarpeita; " +
      "lisäksi toiminnallisuudessa ja esteettömyydessä on parannettavaa. " +
      "Hankesuunnittelu käynnistyy tammikuussa, ja hankesuunnitelma tuodaan arvion mukaan käsiteltäväksi vuonna 2028. " +
      "Hanke on Euroopan unionin osarahoittama.",
  },
] as const

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { importCandidate } = await import("../lib/agent/importCandidate")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Lahdelinkit jo eroteltuihin riveihin --- */
  const { data: eroteltu, error } = await db
    .from("potential_projects")
    .select("id, title, metadata")
    .eq("metadata->>eroteltu_rivista", LAHDE)
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }
  console.log(`\n1) Lahdelinkit ${(eroteltu ?? []).length} jo eroteltuun riviin`)
  for (const r of eroteltu ?? []) {
    const m: any = r.metadata ?? {}
    const puuttuu = !m.liite_urlt || !m.paatos_url
    console.log(`   ${puuttuu ? "LISATAAN" : "on jo  "}  ${String(r.title).slice(0, 52)}`)
    if (!apply || !puuttuu) continue
    const { error: e2 } = await db
      .from("potential_projects")
      .update({ metadata: { ...m, paatos_url: PAATOS, liite_urlt: LIITTEET } })
      .eq("id", r.id)
    if (e2) console.error(`      VIRHE: ${e2.message}`)
  }

  /* --- 2. Tikkarinne takaisin jonoon --- */
  const { data: tik } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .ilike("title", "%Tikkarinne 9%")
  const ohitettu = (tik ?? []).filter((r: any) => r.status === "ignored")
  console.log(`\n2) Tikkarinne 9: ${ohitettu.length} automaattisesti ohitettua riviä`)
  for (const r of ohitettu) {
    const m: any = { ...(r.metadata ?? {}) }
    console.log(`   ${String(r.title).slice(0, 60)}`)
    console.log(`      LLM sanoi: ${String(m.llm_relevance?.reason ?? "-").slice(0, 100)}`)
    console.log(`      liite kertoo: 2,25 milj. euroa, jaettu urakka, KH paatti 12.1.2026 §6`)
    if (!apply) continue
    delete m.recommended_action
    delete m.auto_ignored_reason
    m.paatos_url = PAATOS
    m.liite_urlt = LIITTEET
    m.palautettu_jonoon = {
      milloin: new Date().toISOString(),
      syy: "Liite 2 kertoo kustannusarvion 2,25 M EUR, jaetun urakan ja KH:n paatoksen 12.1.2026 §6 -- LLM piti sita hallinnollisena ilmoituksena",
    }
    const { error: e3 } = await db
      .from("potential_projects")
      .update({ status: "new", metadata: m })
      .eq("id", r.id)
    if (e3) console.error(`      VIRHE: ${e3.message}`)
  }

  /* --- 3. Uudet hankkeet liitteesta --- */
  const projektit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e4 } = await db
      .from("projects")
      .select("id, name, city, region, location, status, developer, builder, metadata")
      .range(a, a + 999)
    if (e4) {
      console.error(`VIRHE projects: ${e4.message}`)
      process.exit(1)
    }
    projektit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  console.log(`\n3) Uudet hankkeet liitteesta (${UUDET.length})`)
  for (const u of UUDET) {
    console.log(`\n   ${u.nimi}  [${u.tyyppi}, ${u.vaihe}${u.kustannus ? `, ${(u.kustannus / 1e6).toFixed(2).replace(".", ",")} M EUR` : ""}]`)
    console.log(`   ${u.kuvaus.slice(0, 140)}...`)
    if (!apply) continue

    const tulos = await importCandidate(
      {
        name: u.nimi,
        city: "Joensuu",
        region: "Pohjois-Karjala",
        location: null,
        phase: u.vaihe,
        description: u.kuvaus,
        developer: "Joensuun kaupunki",
        builder: null,
        property_type: u.tyyppi,
        source_url: `${PAATOS}#${u.tunnus}`,
        confidence: 0.8,
        completed: false,
        source_name: "joensuu_paatokset",
        metadata: {
          paatos_url: PAATOS,
          liite_urlt: LIITTEET,
          eroteltu_rivista: LAHDE,
          eroteltu_liitteesta: "Liite 2 Talousarvio 2027 Toimitilahankkeiden kuvaukset 2027-2029",
          ...(u.kustannus ? { estimated_cost: u.kustannus } : {}),
        },
      },
      { projects: projektit }
    )
    console.log(`   -> ${JSON.stringify(tulos).slice(0, 170)}`)
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
  }
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
