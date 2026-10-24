/*
 * LOHKARE INFRA: SUODATUS JA EHDOKKAAT KUIVANA (D-341).
 *
 * Nayttaa kolme asiaa ennen kuin lahde lisataan: kieli jakautuu
 * oikein, suodatus paastaa lapi vain hankkeet, ja ehdokkaan kentat
 * ovat luettavissa riveittain ([[dry-run-before-backfill]]).
 *
 *   npx tsx scripts/kuivaharjoitus-lohkare.ts
 *   npx tsx scripts/kuivaharjoitus-lohkare.ts --kaikki   (ohita 12 kk ikkuna)
 */

import {
  fetchLohkareSource,
  haeLohkareenJutut,
  lohkareEhdokas,
  onSuomeksi,
  onHankejuttu,
} from "../lib/agent/fetchLohkareSource"

async function main() {
  const kaikki = process.argv.includes("--kaikki")
  const aikaraja = kaikki ? new Date("2000-01-01") : undefined

  const jutut = await haeLohkareenJutut(aikaraja as any)
  const fi = jutut.filter((j) => onSuomeksi(j.osoite))

  console.log(`Juttuja: ${jutut.length} (suomeksi ${fi.length}, englanniksi ${jutut.length - fi.length})`)
  console.log(`Ikkuna: ${kaikki ? "kaikki" : "12 kk"}\n`)

  console.log("=== SUODATUS (vain suomenkieliset) ===")
  for (const j of fi) {
    const hanke = onHankejuttu(j.otsikko)
    console.log(`${hanke ? "HANKE " : "  ohi "} ${j.pvm?.toISOString().slice(0, 10)}  ${j.otsikko.slice(0, 82)}`)
  }

  const hankkeet = fi.filter((j) => onHankejuttu(j.otsikko))
  console.log(`\n=== EHDOKKAAT (${hankkeet.length}) ===`)

  for (const j of hankkeet) {
    const e = lohkareEhdokas(j)
    console.log(`\n${e.name}`)
    console.log(`   kaupunki      ${e.city ?? "-"} (${e.region ?? "-"})`)
    console.log(`   rakentaja     ${e.builder ?? "-"}`)
    console.log(`   rakennuttaja  ${e.developer ?? "-"}`)
    console.log(`   vaihe         ${e.phase}`)
    console.log(`   tyyppi        ${e.property_type ?? "-"}`)
    console.log(`   valmistuu     ${e.estimated_completion ?? "-"}`)
    console.log(`   liittyvat     ${(e.metadata.related_companies ?? []).join(" | ")}`)
    console.log(`   lahde         ${e.source_url}`)
    const henkilot = (e.metadata as any).contact_persons ?? []
    console.log(`   yhteyshenkilot (${henkilot.length}):`)
    for (const h of henkilot) {
      console.log(`      ${h.name} | ${h.title ?? "-"} | ${h.organization ?? "-"} | ${h.phone ?? "-"} | ${h.email ?? "-"}`)
    }
    console.log(`   kuvaus (${(e.description ?? "").length} merkkia):`)
    console.log(`      ${(e.description ?? "").slice(0, 400)}`)
  }

  /* Varmistus: tuotantopolku antaa saman maaran. */
  const tuotanto = await fetchLohkareSource()
  console.log(`\nfetchLohkareSource() palauttaa ${tuotanto.length} ehdokasta.`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
