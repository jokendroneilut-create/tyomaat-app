import { mkdirSync, writeFileSync, existsSync } from "node:fs"

/*
 * Hakee rekisterin kaikki hankkeet kerran levylle MITTAUSTA varten
 * (D-365). Keraaja ei kayta tata: se tulee toimeen kahdella haulla.
 * Tama on paallekkaisyyden mittaamista varten, jossa tarvitaan
 * jokaisen hankkeen koordinaatti.
 *
 *   npx tsx scripts/hae-datakeskusrekisterin-hankkeet.ts <kansio>
 */
const KANSIO = process.argv[2]
const PERUSTA = "https://www.datakeskusrekisteri.fi"

async function main() {
  mkdirSync(KANSIO, { recursive: true })
  const { jasennaMuutosloki, jasennaSivukartta } = await import(
    "../lib/agent/fetchDatakeskusrekisteriSource"
  )
  const ua = { "User-Agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" }

  const muutokset = await (await fetch(`${PERUSTA}/muutokset/json`, { headers: ua })).json()
  const hankkeet = jasennaMuutosloki(muutokset)
  const kartta = jasennaSivukartta(await (await fetch(`${PERUSTA}/sitemap.xml`, { headers: ua })).text())
  const tunnetut = new Set(hankkeet.map((h) => h.id))
  const kaikki = [...tunnetut, ...kartta.filter((id) => !tunnetut.has(id))]
  console.log(`Muutoslokissa ${tunnetut.size}, sivukartassa ${kartta.length}, yhteensa ${kaikki.length}`)

  let haettu = 0
  for (const id of kaikki) {
    const polku = `${KANSIO}/${id}.json`
    if (existsSync(polku)) continue
    const vastaus = await fetch(`${PERUSTA}/hankkeet/${id}/json`, { headers: ua })
    if (vastaus.ok) {
      writeFileSync(polku, await vastaus.text())
      haettu++
    }
    await new Promise((r) => setTimeout(r, 300))
    if (haettu % 25 === 0 && haettu) console.log(`   ${haettu} haettu…`)
  }
  console.log(`Valmis: ${haettu} uutta tiedostoa kansiossa ${KANSIO}`)
}
main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
