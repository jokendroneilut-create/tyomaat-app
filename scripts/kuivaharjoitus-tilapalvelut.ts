/*
 * TAMPEREEN TILAPALVELUIDEN SUODATUS JA EHDOKKAAT KUIVANA (D-339).
 *
 * Kayttaa samoja funktioita kuin keraaja, mutta ei kirjoita kantaan.
 *
 *   npx tsx scripts/kuivaharjoitus-tilapalvelut.ts
 */

import {
  haeTilapalveluidenJulkaisut,
  julkaisunAikaraja,
  lapaiseeSuodatuksen,
  tilapalvelutEhdokkaat,
} from "../lib/agent/fetchTilapalvelutSource"

async function main() {
  const kaikki = await haeTilapalveluidenJulkaisut()
  const raja = julkaisunAikaraja()
  console.log(`Juttuja yhteensä ${kaikki.length}, ikkunan raja ${raja.toISOString().slice(0, 10)}\n`)
  const mukana = kaikki.filter((j) => lapaiseeSuodatuksen(j, raja))
  console.log(`Läpi ${mukana.length}`)

  for (const j of mukana) {
    for (const e of tilapalvelutEhdokkaat(j)) {
      const m = e.metadata as any
      console.log(`\n   ${e.name}  [${j.luokat.join(",")}] ${j.pvm?.toISOString().slice(0, 10)}`)
      console.log(`      kunta ${e.city} | osoite ${e.location ?? "-"} | vaihe ${e.phase} | tyyppi ${e.property_type ?? "-"}`)
      console.log(`      alku ${e.construction_start ?? "-"} | valmistuu ${e.estimated_completion ?? "-"} | hinta ${(e as any).estimated_cost ?? "-"} | urakoitsija ${e.builder ?? "-"}`)
      console.log(`      aikataulu: ${m.rakentamisen_aikataulu ?? "-"}`)
      console.log(`      suunnittelu: ${["architectural_design", "structural_design", "hvac_design", "electrical_design", "geotechnical_design"].map((k) => m[k]).filter(Boolean).join(" / ") || "-"}`)
      console.log(`      aliurakat: ${(m.aliurakoitsijat ?? []).map((a: any) => `${a.tyo}=${a.yritys}`).join("; ") || "-"}`)
      console.log(`      yhteys: ${(m.contact_persons ?? []).map((c: any) => `${c.name} | ${c.title} | ${c.phone} | ${c.email}`).join("; ") || "-"}`)
      console.log(`      ${String(e.description ?? "").slice(0, 200)}... (${String(e.description ?? "").length} merkkiä)`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
