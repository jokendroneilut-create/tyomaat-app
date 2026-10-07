/*
 * Torpparin, Pelti-Assien ja VRJ:n kuivaharjoitus (D-250): mika lapaisee
 * suodatuksen ja mita ehdokkaasta tulee. Ei kirjoita mitaan.
 *
 *   npx tsx scripts/kuivaharjoitus-sivuurakoitsijat.ts torppari
 *   npx tsx scripts/kuivaharjoitus-sivuurakoitsijat.ts pelti_assat
 *   npx tsx scripts/kuivaharjoitus-sivuurakoitsijat.ts vrj
 *
 * Tulos on luettava riveittain: aiemmissa kuivaharjoituksissa virhe
 * loytyi vain otosta lukemalla, ei lukumaarista.
 */
import {
  haeTorpparinJulkaisut,
  lapaiseeSuodatuksen as torppariSuodatin,
  TORPPARI,
} from "../lib/agent/fetchTorppariSource"
import {
  haePeltiAssienJulkaisut,
  lapaiseeSuodatuksen as peltiSuodatin,
  PELTI_ASSAT,
} from "../lib/agent/fetchPeltiAssatSource"
import { haeVrjJutut, lapaiseeSuodatuksen as vrjSuodatin, fetchVrjSource } from "../lib/agent/fetchVrjSource"
import { sivuurakoitsijanEhdokas } from "../lib/agent/sivuurakoitsijaRss"

const pvm = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "??????????")

function tulostaEhdokas(k: any) {
  console.log(`   kaupunki=${k.city ?? "-"}  vaihe=${k.phase}  valmis=${k.completed}`)
  console.log(`   rakennuttaja=${k.developer ?? "-"}  paaurakoitsija=${k.builder ?? "-"}`)
  if (k.metadata?.related_companies) console.log(`   liittyvat=${JSON.stringify(k.metadata.related_companies)}`)
  if (k.estimated_completion) console.log(`   valmistuu=${k.estimated_completion}`)
  if (k.location) console.log(`   osoite=${k.location}`)
  if (k.property_type) console.log(`   tyyppi=${k.property_type}`)
  console.log(`   kuvaus(${String(k.description ?? "").length}): ${String(k.description ?? "").slice(0, 260)}`)
}

async function rss(nimi: string, hae: () => Promise<any[]>, suodatin: (o: string) => boolean, yritys: any) {
  const julkaisut = await hae()
  const lapi = julkaisut.filter((j) => suodatin(j.otsikko))
  const hylatyt = julkaisut.filter((j) => !suodatin(j.otsikko))
  console.log(`${nimi}: 12 kk ikkunassa ${julkaisut.length} julkaisua. Lapi ${lapi.length}, hylatty ${hylatyt.length}.\n`)
  console.log("=== LAPI PAASSEET ===")
  for (const j of lapi) {
    console.log(` + ${pvm(j.pvm)} ${j.otsikko}`)
    tulostaEhdokas(sivuurakoitsijanEhdokas(j, yritys))
  }
  console.log("\n=== HYLATYT ===")
  for (const j of hylatyt) console.log(` - ${pvm(j.pvm)} ${j.otsikko}`)
}

async function vrj() {
  const jutut = await haeVrjJutut()
  const hylatyt = jutut.filter((j) => !vrjSuodatin(j.title))
  const ehdokkaat = await fetchVrjSource()
  console.log(`VRJ: 12 kk ikkunassa ${jutut.length} juttua. Lapi ${ehdokkaat.length}, hylatty ${hylatyt.length}.\n`)

  console.log("=== LAPI PAASSEET ===")
  for (const k of ehdokkaat) {
    const j = jutut.find((x) => x.link === k.source_url)
    console.log(` + ${pvm(j?.date ?? null)} ${k.name}`)
    tulostaEhdokas(k)
  }
  console.log("\n=== HYLATYT ===")
  for (const j of hylatyt) console.log(` - ${pvm(j.date)} ${j.title}`)
}

async function main() {
  const lahde = process.argv[2]
  if (lahde === "torppari") return rss("Torppari", haeTorpparinJulkaisut, torppariSuodatin, TORPPARI)
  if (lahde === "pelti_assat") return rss("Pelti-Assat", haePeltiAssienJulkaisut, peltiSuodatin, PELTI_ASSAT)
  if (lahde === "vrj") return vrj()
  console.log("anna lahde: torppari, pelti_assat, vrj")
}
main().catch((e) => { console.error(e); process.exit(1) })
