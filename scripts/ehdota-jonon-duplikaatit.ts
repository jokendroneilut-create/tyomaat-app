import { readFileSync } from "node:fs"

import type { Vihjehanke } from "../lib/agent/jononDuplikaattivihje"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * JONORIVIN DUPLIKAATTIVIHJE (D-365).
 *
 * Kirjoittaa jonoriville `metadata.duplikaattiehdotus`in, jonka
 * katselmointisivu nayttaa. Logiikka on `lib/agent/jononDuplikaattivihje`
 * -- tassa on vain haku, kuivaharjoitus ja kirjoitus.
 *
 * Koordinaatti luetaan rivin `metadata.lahteen_koordinaatit`ista. Jos se
 * puuttuu ja lahde on datakeskusrekisteri, se haetaan rekisterista ja
 * tallennetaan samalla -- 24 ensimmaista rivia luotiin ennen kuin
 * keraaja alkoi tallentaa pisteen.
 *
 *   npx tsx scripts/ehdota-jonon-duplikaatit.ts --lahde=datakeskusrekisteri
 *   npx tsx scripts/ehdota-jonon-duplikaatit.ts --lahde=datakeskusrekisteri --apply
 */
const APPLY = process.argv.includes("--apply")
const lahdeArg = process.argv.find((a) => a.startsWith("--lahde="))
const LAHDE = lahdeArg ? lahdeArg.slice("--lahde=".length) : null

/* Rivi joka on jo kasitelty ei kaipaa vihjetta. */
const KASITELTY = new Set(["approved", "rejected", "ignored", "merged"])

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { etsiVihjeet, duplikaattiehdotus } = await import(
    "../lib/agent/jononDuplikaattivihje"
  )

  /* 1. Jonorivit. */
  let kysely = db
    .from("potential_projects")
    /* Jonotaulussa kunta on `municipality` ja laji metadatassa. */
    .select("id,title,municipality,address,status,metadata")
  if (LAHDE) kysely = kysely.eq("metadata->>source_name", LAHDE)
  const { data: jono, error } = await kysely
  if (error) throw error

  const avoimet = (jono ?? []).filter((r: any) => !KASITELTY.has(String(r.status)))
  console.log(`Jonorivit: ${(jono ?? []).length}, niista avoimia ${avoimet.length}`)

  /*
   * 2. Kannan hankkeet. EI `metadata`a eika `additional_info`a: 7 000
   * rivin tekstisarakkeet kaatavat kyselyn kannan aikakatkaisuun
   * ([[backfill-run-limits]]).
   */
  const hankkeet: Vihjehanke[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e } = await db
      .from("projects")
      .select("id,name,city,phase,developer,property_type,latitude,longitude")
      .range(a, a + 999)
    if (e) throw e
    hankkeet.push(...((data ?? []) as any[]))
    if ((data ?? []).length < 1000) break
  }
  console.log(`Kannassa ${hankkeet.length} hanketta\n`)

  let vihjeita = 0
  let ilmanKoordinaattia = 0
  let haettu = 0

  for (const r of avoimet as any[]) {
    const metadata = r.metadata ?? {}
    let piste = metadata.lahteen_koordinaatit ?? null

    /*
     * Vanhat rivit: piste haetaan lahteesta kerran ja tallennetaan.
     * Vain datakeskusrekisterille, koska vain se antaa pisteen valmiina.
     */
    if (
      (piste?.lat == null || piste?.lon == null) &&
      metadata.source_name === "datakeskusrekisteri"
    ) {
      const id = String(metadata.source_url ?? "").split("/").pop()
      if (id) {
        const { haeHankkeenTiedot } = await import("../lib/agent/fetchDatakeskusrekisteriSource")
        const tiedot = await haeHankkeenTiedot(id)
        haettu++
        if (tiedot?.sijainti_lat != null && tiedot?.sijainti_lon != null) {
          piste = { lat: tiedot.sijainti_lat, lon: tiedot.sijainti_lon, lahde: "datakeskusrekisteri" }
        }
      }
    }

    if (piste?.lat == null || piste?.lon == null) {
      ilmanKoordinaattia++
      continue
    }

    const osumat = etsiVihjeet(
      {
        kunta: r.municipality ?? null,
        /*
         * Laji on metadatassa: jonotaulussa ei ole `property_type`
         * -saraketta lainkaan, ja tuonti kirjoittaa arvon
         * `building_type`iin.
         */
        property_type: metadata.building_type ?? metadata.property_type ?? null,
        lat: piste.lat,
        lon: piste.lon,
      },
      hankkeet
    )
    const ehdotus = duplikaattiehdotus(osumat)
    if (!ehdotus) continue
    vihjeita++

    console.log(`${r.title}`)
    console.log(`   ${r.municipality ?? "?"} | ${metadata.building_type ?? "-"}`)
    for (const o of ehdotus.osumat) {
      console.log(`   ${o.etaisyys_km} km: ${o.nimi} [${o.vaihe ?? "-"}] tilaaja ${o.tilaaja ?? "-"}`)
    }
    console.log()

    if (!APPLY) continue
    const { error: e } = await db
      .from("potential_projects")
      .update({
        metadata: {
          ...metadata,
          lahteen_koordinaatit: piste,
          duplikaattiehdotus: ehdotus,
        },
      })
      .eq("id", r.id)
    if (e) console.error(`   VIRHE: ${e.message}`)
  }

  console.log("=== YHTEENVETO ===")
  console.log(`${APPLY ? "KIRJOITETTU" : "KUIVAHARJOITUS"}`)
  console.log(`  vihje kirjoitetaan          ${vihjeita}`)
  console.log(`  ilman koordinaattia         ${ilmanKoordinaattia}`)
  console.log(`  pistetta haettu lahteesta   ${haettu}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
