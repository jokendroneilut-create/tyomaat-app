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
 * JATKASAAREN KORTTELI 20079: KAKSI HANKETTA YHDELLA RIVILLA (D-360).
 *
 * Johannes 30.10.2026: *"duplikaatti tarkastuksessa on tama kohde. siina
 * on minusta kaksi kohdetta. ehdottaa duplikaattia mutta en pysty
 * paattamaan jos on kaksi kohdetta samassa."*
 *
 * Rivi f2915026 tuli Jalonin tyomaaluettelosta otsikolla "As Oy
 * Helsingin Aruba ja HEKA Kiribatinkatu 1" -- julkaisija listaa
 * molemmat tontit YHTENA tyomaana, koska sama urakoitsija rakentaa ne.
 * Meille ne ovat kaksi hanketta, ja rakennuttajan oma myyntiesite
 * sanoo sen suoraan:
 *
 *   "Kortteliin sijoittuu kaksi tonttia. Tontille numero 2 sijoittuu
 *    Asunto Oy Helsingin Aruba ja tontille 4 Heka Jatkasaari
 *    Kiribatinkatu 1. Rakennusten valiin jaa yhteiskayttoinen
 *    piha-alue."
 *
 * Eri tontti, eri osoite, eri hallintamuoto, eri koko:
 *
 *   Aruba  tontti 2  Barbadoksenkatu 4 / Kanariankatu 10  Hitas-omistus   46 as.
 *   Heka   tontti 4  Kiribatinkatu 1                      vuokra         128 as.
 *
 * Rivi f2915026 nimetaan Arubaksi ja saa oman osoitteensa; Hekan rivi
 * c29ea9d9 on jo olemassa ja saa Jalonin tuoman rakentajan ja tyomaan
 * numeron. Katselmointipari on siis EI duplikaatti ([[multi-project-rows]]:
 * monihankkeinen rivi on loydettava ennen skannausta, ei sen avulla).
 *
 * Lahde: asuntotuotanto.hel.fi:n myyntiesite (12/2025) ja
 * jalon.fi/tyomaatiedot/helsingin_aruba/.
 *
 *   npx tsx scripts/pura-kiribatinkatu-kortteli.ts
 *   npx tsx scripts/pura-kiribatinkatu-kortteli.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const ARUBA = "f2915026-91b7-4b1b-9ea5-0e4d2678900e"
const HEKA = "c29ea9d9-7517-4d33-b2e7-948d9dc29fa4"
const ESITE =
  "https://asuntotuotanto.hel.fi/sites/default/files/2025-12/asunto-oy-helsingin-aruba-myyntiesite.pdf"

/*
 * Esite antaa jakson "8/2027-10/2027". Jakson LOPPU on valmistuminen
 * ([[period-end-is-completion]]), eli viimeinen asunto valmistuu 10/2027.
 * Jalonin oma luettelo sanoo 9/2027 koko tyomaalle; rakennuttajan oma
 * esite on tarkempi ja koskee nimenomaan tata yhtiota.
 */
const ARUBAN_VALMISTUMINEN = "2027-10-31"

const ARUBAN_KUVAUS = [
  "Asunto Oy Helsingin Aruba on Jätkäsaaren Melkinlaiturin kaava-alueelle",
  "korttelin 20079 tontille 2 rakentuva kaksiportainen 5–6-kerroksinen",
  "Hitas-asuinkerrostalo Kanariankadun ja Barbadoksenkadun kulmassa.",
  "Yhtiössä on 46 asuntoa kooltaan 36–115 m², yksiöistä viiden huoneen",
  "perheasuntoihin, ja katutasoon osoitetaan liiketila. Rakennuksessa on",
  "pääosin viisi kerrosta ja tontin kulmassa 6-kerroksinen osa.",
  "Pääsuunnittelija on arkkitehti Rainer Mahlamäki (Lahdelma & Mahlamäki Oy).",
  "Kohde rakennetaan kaupungin vuokratontille. Asuntojen arvioitu",
  "valmistumisaika on 8/2027–10/2027.",
  "Samaan kortteliin tontille 4 rakentuu erillinen hanke, Heka Jätkäsaari",
  "Kiribatinkatu 1, ja rakennusten väliin jää yhteiskäyttöinen piha-alue.",
].join(" ")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: rivit, error } = await db.from("projects").select("*").in("id", [ARUBA, HEKA])
  if (error) throw error
  const aruba: any = (rivit ?? []).find((r: any) => r.id === ARUBA)
  const heka: any = (rivit ?? []).find((r: any) => r.id === HEKA)
  if (!aruba || !heka) {
    console.log("Rivia ei loydy – ei tehda mitaan.")
    return
  }

  const nayta = (h: any, otsikko: string) => {
    console.log(`${otsikko}`)
    console.log(`   nimi      ${h.name}`)
    console.log(`   osoite    ${h.location ?? "-"}`)
    console.log(`   tilaaja   ${h.developer ?? "-"}`)
    console.log(`   rakentaja ${h.builder ?? "-"}`)
    console.log(`   asuntoja  ${h.apartments ?? "-"} | arkkitehti ${h.architectural_design ?? "-"}`)
    console.log(`   valmistuu ${h.estimated_completion ?? "-"}`)
    console.log(`   kontaktit ${(h.metadata?.contact_persons ?? []).map((c: any) => `${c.name ?? "(nimetön)"}/${c.title ?? "-"}/${c.phone ?? c.email ?? "-"}`).join(" ; ") || "-"}`)
    console.log(`   kuvaus    (${String(h.additional_info ?? "").length}) ${String(h.additional_info ?? "").replace(/\s+/g, " ").slice(0, 90)}`)
  }

  /* --- Aruban rivi: oma identiteetti --- */
  const vanhaNimi = String(aruba.name)
  const arubaMeta = { ...(aruba.metadata ?? {}) }
  const aiemmat: string[] = Array.isArray(arubaMeta.also_known_as) ? arubaMeta.also_known_as : []
  arubaMeta.also_known_as = [...new Set([...aiemmat, vanhaNimi])]
  arubaMeta.jaettu_2026_10_30 = {
    peruste: "Jalonin työmaaluettelo listasi korttelin 20079 molemmat tontit yhtenä työmaana",
    toinen_hanke: HEKA,
    lahde: ESITE,
  }
  arubaMeta.field_sources = {
    ...(arubaMeta.field_sources ?? {}),
    location: "rakennuttajan myyntiesite",
    developer: "rakennuttajan myyntiesite",
    estimated_completion: "rakennuttajan myyntiesite (8/2027–10/2027, jakson loppu)",
    apartments: "rakennuttajan myyntiesite",
    architectural_design: "rakennuttajan myyntiesite",
  }

  const arubaMuutos = {
    name: "Asunto Oy Helsingin Aruba",
    location: "Barbadoksenkatu 4, Kanariankatu 10, 00220 Helsinki",
    developer: "Helsingin kaupunki, kaupunkiympäristön toimiala, asuntotuotanto",
    apartments: 46,
    architectural_design: "Lahdelma & Mahlamäki Oy",
    estimated_completion: ARUBAN_VALMISTUMINEN,
    additional_info: ARUBAN_KUVAUS,
    metadata: arubaMeta,
  }

  /* --- Hekan rivi: Jalonin tuoma rakentaja ja tyomaan numero --- */
  const { mergeContacts } = await import("../lib/projects/contacts")
  const tyomaanNumero = (aruba.metadata?.contact_persons ?? []).find((c: any) => c.phone)
  const hekaMeta = { ...(heka.metadata ?? {}) }
  if (tyomaanNumero) {
    hekaMeta.contact_persons = mergeContacts(heka.metadata?.contact_persons ?? [], [
      {
        ...tyomaanNumero,
        title: "työmaa (kortteli 20079)",
      },
    ] as any)
  }
  hekaMeta.field_sources = {
    ...(hekaMeta.field_sources ?? {}),
    builder: "Jalonin työmaaluettelo",
    apartments: "Hekan uudiskohdeluettelo",
  }

  const hekaMuutos: Record<string, unknown> = {
    /* Jalon listaa molemmat tontit omana tyomaanaan, eli se rakentaa myos taman. */
    builder: heka.builder || "Jalon Group Oy",
    apartments: heka.apartments ?? 128,
    metadata: hekaMeta,
  }

  console.log("=== ENNEN ===")
  nayta(aruba, "\nf2915026 (Jalonin rivi):")
  nayta(heka, "\nc29ea9d9 (Hekan rivi):")

  console.log("\n=== JALKEEN ===")
  nayta({ ...aruba, ...arubaMuutos }, "\nf2915026 -> Aruba:")
  nayta({ ...heka, ...hekaMuutos }, "\nc29ea9d9 -> Heka:")

  const { data: pari } = await db
    .from("project_duplicate_candidates")
    .select("id,status")
    .or(`and(project_id_a.eq.${ARUBA},project_id_b.eq.${HEKA}),and(project_id_a.eq.${HEKA},project_id_b.eq.${ARUBA})`)
    .maybeSingle()
  console.log(`\nKATSELMOINTIPARI: ${pari ? `${pari.id} [${pari.status}] -> not_duplicate` : "ei loytynyt"}`)

  if (!APPLY) {
    console.log("\nKuivaharjoitus, ei kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  const a = await db.from("projects").update(arubaMuutos).eq("id", ARUBA)
  if (a.error) throw a.error
  const h = await db.from("projects").update(hekaMuutos).eq("id", HEKA)
  if (h.error) throw h.error

  if (pari && pari.status === "pending") {
    const p = await db
      .from("project_duplicate_candidates")
      .update({
        status: "not_duplicate",
        reviewed_at: new Date().toISOString(),
        reasons: [
          "eri tontti samassa korttelissa 20079",
          "Aruba tontti 2 (Barbadoksenkatu 4), Heka tontti 4 (Kiribatinkatu 1)",
          "rakennuttajan myyntiesite erittelee molemmat",
        ],
      })
      .eq("id", pari.id)
    if (p.error) throw p.error
  }

  console.log("\n=== AJETTU ===")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
