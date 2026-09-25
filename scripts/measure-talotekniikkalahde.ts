export {}

/*
 * TALOTEKNIIKKAYRITYKSEN UUTISVIRRAN SAALIS.
 *
 * Kuivaharjoitus ennen lahteen lisaamista: montako uutista, montako
 * lapaisee suodattimen ja mita niista luetaan. Ei kirjoita mitaan.
 *
 *   npx tsx scripts/measure-talotekniikkalahde.ts
 */
const YRITYKSET = [
  { nimi: "Are", endpoint: "https://www.are.fi/wp-json/wp/v2/news" },
]

async function main() {
  const { luoTalotekniikkaLahde } = await import("../lib/agent/talotekniikkaUutiset")

  for (const y of YRITYKSET) {
    const alkoi = Date.now()
    const kandidaatit = await luoTalotekniikkaLahde(y)()
    console.log(`\n=== ${y.nimi}: ${kandidaatit.length} kandidaattia, ${((Date.now() - alkoi) / 1000).toFixed(1)} s ===`)
    const kaupunki = kandidaatit.filter((k: any) => k.city).length
    const rakennuttaja = kandidaatit.filter((k: any) => k.developer).length
    const paaurakoitsija = kandidaatit.filter((k: any) => k.builder).length
    console.log(`kaupunki ${kaupunki}, rakennuttaja ${rakennuttaja}, paaurakoitsija ${paaurakoitsija}\n`)
    for (const k of kandidaatit as any[]) {
      console.log(`${String(k.city ?? "-").padEnd(13)} ${String(k.name).slice(0, 72)}`)
      if (k.developer || k.builder) {
        console.log(`              rakennuttaja=${k.developer ?? "-"}  paaurakoitsija=${k.builder ?? "-"}`)
      }
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
