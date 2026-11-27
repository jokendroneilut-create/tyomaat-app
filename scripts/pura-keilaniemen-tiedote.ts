import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue; let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"'))) v = v.slice(1, -1); if (!(m[1] in process.env)) process.env[m[1]] = v }

/*
 * ESPOON KEILANIEMI-TIEDOTE OMIKSI EHDOKKAIKSI (27.11.2026, D-460).
 *
 * Tiedote "Keilaniemen hankkeet etenevät – uusimpina alueen ensimmäinen
 * hotelli ja KONEen uusi toimistorakennus" (STT, Espoon kaupunki) kertoo
 * neljästä hankkeesta. Kannassa jo / ei tehdä:
 *   - Keilaniemen rampit Länsiväylälle: on (c4975822 Väylävirasto ja
 *     e0a7d09a GRK:n urakka).
 *   - Metrokorttelin pysäköintilaitos (SRV + Espoo): Johannes hylkäsi
 *     8/2026 rivin "selvitetään kahta vaihtoehtoista"; ei uutta päätöstä.
 *   - YIT:n 15-kerroksinen asuinkerrostalo: valmistuu joulukuussa 2026.
 * Puuttuu ja luodaan: AB Investin hotelli-, kongressi- ja
 * toimistokokonaisuus (KONE + Clarion), yksi hanke koska rakennukset
 * ovat samaa kehityshanketta ja kongressikeskus yhdistää ne.
 *
 * Alkuperäinen rivi jätetään jonoon, Johannes päättää siitä. Uusi rivi saa
 * oman fragmentin lähdeosoitteeseen (multi-project-rows).
 *
 *   npx tsx scripts/pura-keilaniemen-tiedote.ts [--apply]
 */
import { createClient } from "@supabase/supabase-js"
const APPLY = process.argv.includes("--apply")
const LAHDE = "fa33e1e4-925b-4bfb-80c2-c8f9fdda0136"

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data } = await db.from("potential_projects").select("*").eq("id", LAHDE).single()
  const md: any = (data as any).metadata
  const url = `${String(md.source_url)}#ab-invest-hotelli-ja-toimisto`
  const uusi = {
    status: "new",
    title: "Keilaniemen hotelli- ja toimistokokonaisuus (KONE ja Clarion), AB Invest",
    municipality: "Espoo",
    address: "Kortteli 10051, Keilaniemi, Espoo",
    confidence: 80,
    source_count: 1,
    metadata: {
      region: "Uusimaa",
      city: "Espoo",
      source: md.source,
      source_name: md.source_name,
      firstSourceName: md.firstSourceName ?? md.source_name,
      source_url: url,
      resolver: "manual-split",
      phase_hint: "Suunnittelu",
      building_type: "Hotelli",
      property_type: "Hotelli",
      construction_type: "Uudisrakennus",
      developer: "AB Invest AS",
      related_companies: ["AB Invest AS", "KONE Oyj", "Strawberry (Clarion Hotel)", "Davidsson Tarkela Siren Arkkitehdit", "SRV", "Espoon kaupunki"],
      location: "Kortteli 10051, Keilarannan kadun eteläpuoli, Keilaniemi, Espoo",
      lupapiste_coordinates_wgs84: { lat: 60.17579585, lon: 24.83028145 },
      geocode_source: "pks_osoiteluettelo_2026-11-27 Keilaniementie 9 (likimääräinen; Keilarannan katu meritäytöllä, ei vielä osoitteita)",
      construction_start: "2027-01-01",
      estimated_completion: "2029-12-31",
      floor_area: 42300,
      description: [
        "Norjalainen AB Invest rakentaa Keilaniemeen hotelli-, kongressi- ja toimistokokonaisuuden. Vuokralaisiksi tulevat hissiyhtiö KONE (uusi konsernihallinnon toimistotalo) ja Strawberry-ketjun Clarion-hotelli. 23-kerroksiseen hotelliin on suunnitteilla noin 400 huonetta, ja kongressikeskus yhdistää toimisto- ja hotellirakennuksen. Arkkitehti Davidsson Tarkela Siren.",
        "AB Investin tontin meritäyttö on käynnissä ja valmistuu vuoden 2026 aikana. Toimistotalon ja hotellin rakentaminen alkaa 2027 ja valmista olisi alustavan aikataulun mukaan loppuvuodesta 2029. Pysäköinti tulee metrokortteliin rakennettavaan pysäköintilaitokseen (SRV ja Espoon kaupunki).",
        "Espoo vuokrasi korttelin 10051 (Keilarannan kadun eteläpuoli, metroaseman ja pikaraitiotien päätepysäkin vieressä) AB Invest AS:lle 30 vuodeksi osto-oikeudella vuonna 2024; kokonaisrakennusoikeus 42 300 k-m², josta puurakenteisen toimistotalon osuus noin 15 000 k-m². Asemakaava on lainvoimainen. Vuoden 2024 suunnitelmassa hotelli oli 34-kerroksinen ja noin 500-huoneinen.",
        "Lähteet: Espoon kaupunki 24.11.2026 (STT) ja Espoon kaupungin tiedote 11/2024 korttelin vuokraamisesta.",
      ].join("\n\n"),
      field_sources: {
        developer: "Tiedote: \"osa norjalaisen AB Investin kehityshanketta\"; vuokrapäätös 2024: \"AB Invest AS:lle\"",
        construction_start: "Tiedote: \"rakentaminen alkaa 2027\" (vuoden alku)",
        estimated_completion: "Tiedote: \"valmista olisi alustavan aikataulun mukaan loppuvuodesta 2029\"",
        floor_area: "Espoon vuokrapäätös 2024: kokonaisrakennusoikeus 42 300 k-m²",
      },
      contact_persons: (md.contact_persons ?? []).map((c: any) => ({ ...c, role: "authority", organization: "Espoon kaupunki" })),
      tiedon_lahteet: { verkko: { tiedote: md.source_url, vuokrapaatos: "https://www.sttinfo.fi/tiedote/70716304/espoo-vuokraa-korttelin-keilaniemesta-ab-investille-alueelle-rakentuu-toimistotiloja-seka-hotelli-ja-kongressikeskus?lang=fi", tarkistettu: "27.11.2026" } },
      jaettu_lahteesta: LAHDE,
      eroteltu_rivista: LAHDE,
    },
  }
  console.log(JSON.stringify({ ...uusi, metadata: { ...uusi.metadata, description: uusi.metadata.description.slice(0, 200) + "…" } }, null, 1))
  if (!APPLY) return console.log("\nKUIVAHARJOITUS")
  const { data: luotu, error } = await db.from("potential_projects").insert(uusi).select("id").single()
  if (error) throw error
  await db.from("potential_projects").update({ metadata: { ...md, jaettu_ehdokkaiksi: [(luotu as any).id] } }).eq("id", LAHDE)
  console.log(`\nLUOTU https://app.tyomaat.fi/tic/projects/${(luotu as any).id}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
