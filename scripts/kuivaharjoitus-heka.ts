/*
 * Hekan uudiskohdeluettelon kuivaharjoitus (D-251): mita sivulta luetaan
 * ja mita ehdokkaasta tulee. Ei kirjoita mitaan.
 *
 *   npx tsx scripts/kuivaharjoitus-heka.ts
 *
 * Tulos on luettava riveittain: aiemmissa kuivaharjoituksissa virhe
 * loytyi vain otosta lukemalla, ei lukumaarista.
 */
import { fetchHekaSource, HEKA_SIVU, jasennaHekaSivu } from "../lib/agent/fetchHekaSource"

async function main() {
  const res = await fetch(HEKA_SIVU, { headers: { "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } })
  const html = await res.text()
  const rivit = jasennaHekaSivu(html)
  console.log(`Heka: HTTP ${res.status}, ${html.length} merkkia, ${rivit.length} kohderivia.\n`)

  console.log("=== SIVUN RIVIT ===")
  for (const r of rivit) console.log(` [${r.osio}] ${r.rivi}`)

  const ehdokkaat = await fetchHekaSource()
  console.log(`\n=== EHDOKKAAT (${ehdokkaat.length}) ===`)
  for (const k of ehdokkaat) {
    console.log(` + ${k.name}`)
    console.log(`   kaupunki=${k.city}  alue=${k.region}  vaihe=${k.phase}  valmis=${(k as any).completed ?? false}`)
    console.log(`   rakennuttaja=${k.developer}  tyyppi=${k.property_type}`)
    console.log(`   osoite=${k.location}  valmistuu=${k.estimated_completion}  asuntoja=${k.metadata.apartments ?? "-"}`)
    if ((k.metadata as any).lisatiedot) console.log(`   lisatiedot=${JSON.stringify((k.metadata as any).lisatiedot)}`)
    console.log(`   url=${k.source_url}`)
    console.log(`   kuvaus: ${k.description}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
