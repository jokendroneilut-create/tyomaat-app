/*
 * TARKISTAA KUNTIEN MAAKUNNAT TILASTOKESKUSTA VASTAAN.
 *
 * `lib/geo/municipalities.ts` sisältää kuntanumerot ja nimet suoraan
 * Tilastokeskuksen API:sta, mutta MAAKUNTA oli aikanaan päätelty
 * kuntanumeroista. Päättely koodaa vuotta 2021 edeltävän jaon, ja viisi
 * kuntaa siirtyi maakunnasta toiseen 1.1.2021:
 *
 *   Iitti Kymenlaakso -> Päijät-Häme        Joroinen  Etelä-Savo -> Pohjois-Savo
 *   Kuhmoinen Keski-Suomi -> Pirkanmaa      Laihia    Etelä-Pohjanmaa -> Pohjanmaa
 *   Heinävesi Etelä-Savo -> Pohjois-Karjala
 *
 * Virhe ei näy koodissa vaan asiakkaan suodattimessa: hanke on väärän
 * maakunnan alla eikä löydy sieltä mistä sitä haetaan.
 *
 * Aja tämä kun kuntajako muuttuu (vuodenvaihde) tai kun maakunta
 * näyttää väärältä. Skripti EI kirjoita mitään — se kertoo erot.
 *
 *   npx tsx scripts/check-municipality-regions.ts
 */

const VUOSI = new Date().getFullYear()

async function haeTaulukko(vuosi: number): Promise<any[] | null> {
  const id = `kunta_1_${vuosi}0101#maakunta_1_${vuosi}0101`
  const url = `https://data.stat.fi/api/classifications/v2/correspondenceTables/${encodeURIComponent(id)}/maps?content=data&meta=min&lang=fi`
  const res = await fetch(url, { cache: "no-store", headers: { accept: "application/json" } })
  if (!res.ok) return null
  return res.json()
}

async function main() {
  /* Uusin saatavilla oleva vuosi: kuluva tai edellinen. */
  let vuosi = VUOSI
  let maps = await haeTaulukko(vuosi)
  if (!maps) {
    vuosi = VUOSI - 1
    maps = await haeTaulukko(vuosi)
  }
  if (!maps) {
    console.error("Tilastokeskuksen vastaavuustaulua ei saatu.")
    process.exit(1)
  }

  const items: any[] = await (
    await fetch(
      `https://data.stat.fi/api/classifications/v2/classifications/maakunta_1_${vuosi}0101/classificationItems?content=data&meta=min&lang=fi`,
      { cache: "no-store", headers: { accept: "application/json" } }
    )
  ).json()

  const maakunnat = new Map<string, string>()
  for (const m of items) {
    maakunnat.set(String(m.code), String(m.classificationItemNames?.[0]?.name ?? m.name ?? ""))
  }

  const virallinen = new Map<string, string>()
  for (const r of maps) {
    const kunta = String(r.sourceLocalId).split("/")[1]
    const maak = String(r.targetLocalId).split("/")[1]
    virallinen.set(kunta, maakunnat.get(maak) ?? maak)
  }

  const { MUNICIPALITIES } = await import("../lib/geo/municipalities")

  let sama = 0
  const erot: string[] = []
  const tuntemattomat: string[] = []

  for (const [koodi, kunta] of Object.entries(MUNICIPALITIES as Record<string, any>)) {
    const oikea = virallinen.get(String(koodi))
    if (!oikea) {
      tuntemattomat.push(`${koodi} ${kunta.name}`)
      continue
    }
    if (oikea === kunta.region) sama++
    else erot.push(`  ${koodi.padEnd(5)} ${String(kunta.name).padEnd(22)} meillä ${String(kunta.region).padEnd(20)} virallinen ${oikea}`)
  }

  const puuttuvat = [...virallinen.keys()].filter(
    (k) => !(k in (MUNICIPALITIES as Record<string, any>))
  )

  console.log(`Tilastokeskus ${vuosi}: ${virallinen.size} kuntaa, ${maakunnat.size} maakuntaa`)
  console.log(`  täsmää        ${sama}`)
  console.log(`  eroaa         ${erot.length}`)
  console.log(`  meillä mutta ei virallisessa  ${tuntemattomat.length}`)
  console.log(`  virallisessa mutta ei meillä  ${puuttuvat.length}`)

  if (erot.length) {
    console.log("\nEROT:")
    for (const e of erot) console.log(e)
  }
  if (tuntemattomat.length) console.log("\nEI VIRALLISESSA:\n  " + tuntemattomat.join("\n  "))
  if (puuttuvat.length) console.log("\nPUUTTUU MEILTÄ:\n  " + puuttuvat.join(", "))

  if (erot.length || puuttuvat.length) process.exit(1)
}

main().catch((e) => {
  console.error("VIRHE:", e?.message ?? e)
  process.exit(1)
})
export {}
