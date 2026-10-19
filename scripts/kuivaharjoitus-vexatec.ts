/*
 * VEXATECIN SUODATUS JA EHDOKKAAT KUIVANA (D-322).
 *
 * Kayttaa samoja funktioita kuin keraaja, mutta ei kirjoita kantaan:
 * nain suodatussaannon voi lukea riveittain ennen kuin lahde
 * rekisteroidaan.
 *
 *   npx tsx scripts/kuivaharjoitus-vexatec.ts
 */

import {
  haeVexatecinJulkaisut,
  jasennaJulkaisut,
  lapaiseeSuodatuksen,
  tiedotteenAikaraja,
  vexatecEhdokkaat,
} from "../lib/agent/fetchVexatecSource"

async function main() {
  /* Koko lista ilman ikkunaa, jotta nakee mita ikkuna rajaa pois. */
  const res = await fetch("https://vexatec.fi/wp-json/wp/v2/tiedotteet?per_page=100", {
    cache: "no-store",
    headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
  })
  const kaikki = jasennaJulkaisut(await res.json())
  const raja = tiedotteenAikaraja()

  console.log(`Tiedotteita yhteensä ${kaikki.length}, ikkunan raja ${raja.toISOString().slice(0, 10)}\n`)
  console.log("pvm         ikkuna  suodatus  otsikko")
  for (const j of kaikki) {
    const ikkunassa = !j.pvm || j.pvm >= raja
    const lapi = lapaiseeSuodatuksen(j)
    console.log(
      `${(j.pvm?.toISOString().slice(0, 10) ?? "?").padEnd(11)} ${ikkunassa ? "mukana" : "vanha "}  ${lapi ? "LÄPI    " : "pois    "}  ${j.otsikko.slice(0, 62)}`
    )
  }

  const ehdokkaat = (await haeVexatecinJulkaisut()).filter(lapaiseeSuodatuksen).flatMap(vexatecEhdokkaat)
  console.log(`\n=== EHDOKKAAT (${ehdokkaat.length})`)
  for (const e of ehdokkaat) {
    console.log(`\n   ${e.name}`)
    console.log(`      kunta ${e.city ?? "-"} | vaihe ${e.phase} | tyyppi ${e.property_type ?? "-"} | valmistuu ${e.estimated_completion ?? "-"}`)
    console.log(`      ${String(e.description ?? "").slice(0, 170)}...`)
    console.log(`      ${e.source_url}`)
    const yh = ((e.metadata as any)?.contact_persons ?? []) as any[]
    console.log(
      `      yhteyshenkilöt: ${yh.length ? yh.map((c) => `${c.name} ${c.phone ?? ""} ${c.email ?? ""}`.trim()).join("; ") : "-"}`
    )
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
