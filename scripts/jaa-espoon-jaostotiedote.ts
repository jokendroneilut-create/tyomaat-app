import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAHDEN HANKKEEN TIEDOTE KAHDEKSI EHDOKKAAKSI (D-255).
 *
 * Espoon elinkeino- ja kilpailukykyjaoston tiedote sisaltaa KAKSI eri
 * hanketta ja yhden hallinnollisen paatoksen joka ei ole hanke
 * (varausmaksuperiaatteet). Yhtena rivina sita ei voi hyvaksya: hanke
 * saisi vaaran nimen, vaaran sijainnin ja vaarat osapuolet.
 *
 * Alkuperainen rivi EI poisteta vaan merkitaan ignored (ks.
 * [[queue-removal-ignored]]) ja siihen kirjataan mihin se jakautui.
 *
 *   npx tsx scripts/jaa-espoon-jaostotiedote.ts
 *   npx tsx scripts/jaa-espoon-jaostotiedote.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const LAHDE = "63356c1e-f03d-4305-91c3-6dcfef671995"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data } = await db.from("potential_projects").select("*").eq("id", LAHDE).maybeSingle()
  const alku: any = data
  if (!alku) { console.log("lahderivia ei loydy"); return }
  if (alku.status !== "new") { console.log("lahderivi ei ole enaa jonossa:", alku.status); return }
  const md = alku.metadata ?? {}

  /*
   * Yhteyshenkilo on jaoston PUHEENJOHTAJA eli luottamushenkilo, ei
   * hankkeen yhteyshenkilo. Merkitaan viranomaiseksi, jolloin han ei
   * laske yhteystietokattavuuteen (D-207:n periaate) muttei myoskaan
   * katoa.
   */
  const yhteys = (md.contact_persons ?? []).map((c: any) => ({ ...c, role: "authority" }))

  const pohja = {
    status: "new",
    municipality: "Espoo",
    source_count: 1,
    metadata: {
      region: "Uusimaa",
      city: "Espoo",
      source: md.source,
      source_name: md.source_name,
      source_url: md.source_url,
      source_history: md.source_history ?? null,
      resolver: "manual-split",
      phase_hint: "Suunnittelussa",
      contact_persons: yhteys,
      jaettu_lahteesta: LAHDE,
    },
  }

  const uudet = [
    {
      ...pohja,
      title: "Westendin asemanseudun kehittäminen",
      address: "Westend, Espoo",
      /* Suunnitteluvaraus on varhainen mutta paatetty; lahde on yksiselitteinen. */
      confidence: 70,
      metadata: {
        ...pohja.metadata,
        location: "Westend, Espoo",
        /*
         * Varauksensaajat ovat ne jotka hanketta kehittavat, eli myyjan
         * kannalta oikeat osapuolet. Espoon kaupunki on maanomistaja ja
         * varauksen myontaja — se jaa liittyvaksi yritykseksi.
         */
        developer: "Urbanizator Oy, JM Suomi Oy, JATS Property Development Oy",
        related_companies: ["Espoon kaupunki"],
        description: [
          "Espoon kaupungin elinkeino- ja kilpailukykyjaosto myönsi 5.10.2026 Westendin asemanseudun alueelle suunnitteluvarauksen Urbanizator Oy:lle, JM Suomi Oy:lle ja JATS Property Development Oy:lle.",
          "Yritykset ovat selvittäneet aseman seudun kehittämismahdollisuuksia yhteistyössä kaupungin kanssa; työssä on tarkasteltu alueen liikennettä, ympäristöä sekä asukkaiden ja sidosryhmien näkemyksiä.",
          "Maankäyttövision mukaan alueella on merkittävää kehittämispotentiaalia. Tavoitteena on kehittää nykyisestä liikenneympäristöstä kaupunkiympäristö, jossa yhdistyvät asuminen, palvelut, työpaikat ja joukkoliikenne, ja vahvistaa yhteyksiä Tapiolaan.",
          "Hanke edellyttää asemakaavamuutosta.",
        ].join(" "),
      },
    },
    {
      ...pohja,
      title: "Kivenlahden metrokeskuksen liikekeskus",
      address: "Kivenlahti, Espoo",
      confidence: 75,
      metadata: {
        ...pohja.metadata,
        location: "Kivenlahti, Espoo",
        developer: "SRV Yhtiöt Oyj",
        related_companies: ["Espoon kaupunki"],
        property_type: "Liikerakennus",
        description: [
          "Espoon kaupungin elinkeino- ja kilpailukykyjaosto päätti 5.10.2026 myydä Kivenlahden metrokeskuksen liikekeskustontin SRV Yhtiöt Oyj:lle.",
          "Tontille on tarkoitus rakentaa liikekeskus, pysäköintilaitos sekä Kivenlahden metroaseman läntinen sisäänkäynti.",
          "Tontin kauppahinta on 2,4 miljoonaa euroa; luku on tontin hinta eikä rakentamisen kustannusarvio.",
          "Suunniteltu liikekeskus hyödyntäisi noin kolmanneksen tontin rakennusoikeudesta, joten tontille jää mahdollisuus myöhempään lisärakentamiseen.",
          "Huom: tiedotteen ingressissä ostaja on kirjoitettu muotoon \u201dSVR\u201d, mutta leipätekstissä yksiselitteisesti SRV Yhtiöt Oyj.",
        ].join(" "),
      },
    },
  ]

  console.log("LAHDE:", alku.title)
  console.log("  -> jaetaan", uudet.length, "ehdokkaaseen, alkuperainen merkitaan ignored\n")
  for (const u of uudet) {
    console.log("=== " + u.title)
    console.log("   sijainti   ", u.address)
    console.log("   rakennuttaja", u.metadata.developer)
    console.log("   liittyvat  ", JSON.stringify(u.metadata.related_companies))
    console.log("   vaihe      ", u.metadata.phase_hint, "| varmuus", u.confidence)
    console.log("   yhteyshlo  ", (u.metadata.contact_persons ?? []).map((c: any) => `${c.name} [${c.role}]`).join(", ") || "-")
    console.log("   kuvaus     ", String(u.metadata.description).slice(0, 150) + "...")
    console.log()
  }
  console.log("EI oteta hankkeeksi: varausmaksuperiaatteet (hallinnollinen paatos) ja Otaniemen katsaus.")

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const idt: string[] = []
  for (const u of uudet) {
    const { data: luotu, error } = await db.from("potential_projects").insert(u).select("id").single()
    if (error) throw error
    idt.push(luotu.id)
  }

  const { error: e2 } = await db.from("potential_projects").update({
    status: "ignored",
    metadata: {
      ...md,
      recommended_action: "ignore",
      ignore_reason: "Tiedote sisalsi kaksi eri hanketta; jaettu erillisiksi ehdokkaiksi",
      jaettu_ehdokkaiksi: idt,
    },
  }).eq("id", LAHDE)
  if (e2) throw e2

  console.log("\n=== LUOTU ===")
  for (const id of idt) console.log("  ", id)
  console.log("  alkuperainen merkitty ignored")
}
main().catch(e => { console.error(e); process.exit(1) })
