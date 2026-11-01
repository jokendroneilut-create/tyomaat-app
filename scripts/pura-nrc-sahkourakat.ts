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
 * YKSI TIEDOTE, KOLME SAHKOURAKKAA.
 *
 * NRC:n uutinen "Erikoisosaamisemme nakyy uusissa sahkorakentamisen
 * urakoissa" kertoo kolmesta eri kohteesta kolmessa eri paikassa
 * ([[multi-project-rows]]):
 *
 *   1. Roihupellon metrovarikon kiinteistosahkot, Helsinki  -> UUSI
 *   2. Kukkolan sahkoaseman uudistaminen, Hameenlinna       -> ON JO
 *   3. Rantaradan asetinlaitteen virransyotto ja akusto     -> UUSI
 *
 * Alkuperainen jonorivi liitetaan Kukkolaan, ja kaksi muuta luodaan
 * omiksi riveikseen.
 *
 * KUSTANNUS JATETAAN POIS JA TYHJENNETAAN JALKEEN PAIN. 4,5 M€ on
 * kolmen sopimuksen YHTEISARVO. Pelkka tyhja kentta ei riita: luku on
 * tiedotteen tekstissa, ja hyvaksyntareitti poimii sen sielta
 * (`cost_source: "text"`) -- niin kavi NRC:n silloille 1.11.2026
 * ([[alliance-split]]).
 *
 * TILAAJAA EI ARVATA. Tiedote ei kerro kuka urakat tilasi. Roihupellon
 * varikko on Paakaupunkiseudun Kaupunkiliikenteen, mutta "yllapitaa"
 * ei ole sama kuin "tilasi" -- kentta jaa tyhjaksi
 * ([[party-role-fields]]).
 *
 *   npx tsx scripts/pura-nrc-sahkourakat.ts
 *   npx tsx scripts/pura-nrc-sahkourakat.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const JONORIVI = "aeab6373-f35f-4c3a-8648-bd7c20b7539a"
const KUKKOLA = "2cfca384-70bb-442a-af81-eee828423ff1"
const LAHDE =
  "https://www.nrcgroup.fi/uutiset/erikoisosaamisemme-nakyy-uusissa-sahkorakentamisen-urakoissa"

const YHTEINEN =
  "NRC Group voitti kilpailutukset kolmessa sähkörakentamisen urakassa " +
  "Etelä-Suomessa. Sama sopimuskokonaisuus kattaa kaikki kolme kohdetta: " +
  "Roihupellon metrovarikon kiinteistösähköt, Kukkolan sähköaseman " +
  "uudistamisen ja Rantaradan asetinlaitetyöt."

const URAKAT = [
  {
    title: "Roihupellon metrovarikon kiinteistösähköjen uusiminen",
    municipality: "Helsinki",
    address: "Roihupelto, Helsinki",
    kuvaus:
      "Roihupellon metrovarikolla toteutetaan sekä vanhan että uuden " +
      "metrojunien säilytyshallin sähkösaneeraus, jossa varikon sähköt " +
      "uusitaan vaiheittain. Varikko on töiden aikana käytössä " +
      "ympärivuorokautisesti, ja käyttöönotto tapahtuu vaiheittain: uuden " +
      "asennuksen käyttöönoton jälkeen vanha järjestelmä puretaan. " +
      "Työnsuunnittelu ja työmaan perustaminen ovat käynnissä, ja " +
      `valmistelevat työt säilytyshalleissa alkavat joulukuussa. ${YHTEINEN}`,
    yhteyshenkilot: [
      { name: "Jere Lappalainen", role: "Projektipäällikkö", company: "NRC Group" },
    ],
  },
  {
    title: "Rantaradan asetinlaitteen virransyöttö- ja akustouusinnat",
    municipality: null,
    address: "Rantarata",
    kuvaus:
      "Rantaradalla uusitaan asetinlaitteen virransyöttö ja akustot. Työt " +
      "parantavat raideliikenteen sähköjärjestelmien luotettavuutta ja " +
      `kunnossapidettävyyttä. ${YHTEINEN}`,
    yhteyshenkilot: [],
  },
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { PHASE_LABELS } = await import("../lib/projects/phases")

  const { data: lahto, error } = await db
    .from("potential_projects")
    .select("id,title,status")
    .eq("id", JONORIVI)
    .maybeSingle()
  if (error) throw error
  if (!lahto) throw new Error("lahtorivia ei loydy")
  console.log(`Lahtorivi: [${lahto.status}] ${lahto.title}\n`)

  const olemassa: string[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e } = await db
      .from("potential_projects")
      .select("title")
      .range(a, a + 999)
    if (e) throw e
    olemassa.push(...(data ?? []).map((r: any) => String(r.title)))
    if ((data ?? []).length < 1000) break
  }

  for (const u of URAKAT) {
    if (olemassa.includes(u.title)) {
      console.log(`OHITETAAN (on jo jonossa): ${u.title}`)
      continue
    }
    console.log(`LUODAAN: ${u.title}`)
    console.log(`   ${u.municipality ?? "(ei kuntaa)"} | ${u.address}`)
    console.log(`   yhteyshenkilöitä ${u.yhteyshenkilot.length}, kustannus tyhjä\n`)

    if (!APPLY) continue
    const { error: e } = await db.from("potential_projects").insert({
      status: "new",
      title: u.title,
      municipality: u.municipality,
      address: u.address,
      confidence: 80,
      source_count: 1,
      evidence_count: 1,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      metadata: {
        source_name: "nrc_uutiset",
        source_url: LAHDE,
        source: "NRC Group",
        description: u.kuvaus,
        operation: u.title,
        builder: "NRC Group Finland Oy",
        related_companies: ["NRC Group Finland Oy"],
        contact_persons: u.yhteyshenkilot,
        building_type: "Infrahanke",
        phase_hint: PHASE_LABELS.contract_awarded,
        field_sources: { builder: "NRC Groupin tiedote" },
        purettu_rivista: JONORIVI,
      },
    })
    if (e) console.error(`   VIRHE: ${e.message}`)
  }

  console.log(
    `${APPLY ? "LUOTU" : "KUIVAHARJOITUS"}. Lahtorivi ${JONORIVI} liitetaan ` +
      `Kukkolaan (${KUKKOLA}) erikseen hyvaksyntareitin kautta.`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
