/*
 * Oteranin kuivaharjoitus (D-310): mika lapaisee suodatuksen ja mita
 * ehdokkaasta tulee. Ei kirjoita mitaan.
 *
 *   npx tsx scripts/kuivaharjoitus-oteran.ts
 *
 * Tulos on luettava riveittain: aiemmissa kuivaharjoituksissa virhe
 * loytyi vain otosta lukemalla, ei lukumaarista.
 */
import { haeOteraninJulkaisut, lapaiseeSuodatuksen, oteranEhdokkaat } from "../lib/agent/fetchOteranSource"

const pvm = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "??????????")

async function main() {
  const julkaisut = await haeOteraninJulkaisut()
  const lapi = julkaisut.filter(lapaiseeSuodatuksen)
  const hylatyt = julkaisut.filter((j) => !lapaiseeSuodatuksen(j))
  const ehdokkaita = lapi.flatMap(oteranEhdokkaat).length
  console.log(
    `Oteran: 12 kk ikkunassa ${julkaisut.length} julkaisua. Lapi ${lapi.length}, hylatty ${hylatyt.length}. Ehdokkaita ${ehdokkaita}.\n`
  )

  console.log("=== LAPI PAASSEET ===")
  for (const j of lapi) {
    console.log(` + ${pvm(j.pvm)} ${j.otsikko}  [${j.kategoriat.join(", ")}]`)
    for (const k of oteranEhdokkaat(j)) {
      console.log(`   * ${k.name}`)
      console.log(`     kaupunki=${k.city ?? "-"}  maakunta=${k.region ?? "-"}  vaihe=${k.phase}  valmis=${k.completed}`)
      console.log(`     rakennuttaja=${k.developer ?? "-"}  paaurakoitsija=${k.builder ?? "-"}`)
      console.log(`     liittyvat=${JSON.stringify(k.metadata.related_companies)}`)
      if (k.estimated_completion) console.log(`     valmistuu=${k.estimated_completion}`)
      if (k.property_type) console.log(`     tyyppi=${k.property_type}`)
      console.log(`     osoite=${k.source_url}`)
      const d = String(k.description ?? "")
      console.log(`     kuvaus(${d.length}): ${d.slice(0, 300)}`)
    }
  }
  console.log("\n=== HYLATYT ===")
  for (const j of hylatyt) console.log(` - ${pvm(j.pvm)} ${j.otsikko}  [${j.kategoriat.join(", ")}]`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
