import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

/*
 * BRÄNDI KIRJOITETAAN ILMAN Ö:TÄ.
 *
 * Koodipohja kirjoittaa nimen "Tyomaat.fi" — 49 osumaa, ei yhtään
 * ö:llistä. Sääntö oli olemassa ja jopa testattu, mutta vain yhdessä
 * tiedostossa (`lib/users/trialMuistutukset.spec.ts`, kokeilumuistutusten
 * sähköpostit). Se ei kattanut muuta koodia, ja 31.10.2026 kirjoitin
 * lähteen näyttönimeksi "Työmaat.fi:n oma tiedonkeruu" — asiakkaalle
 * näkyvä teksti, väärällä kirjoitusasulla.
 *
 * Tämä vahti kattaa koko lähdekoodin. Se on sama kuvio kuin
 * `lib/ohjausmerkit.spec.ts`: sääntö jota ei aja mikään, unohtuu.
 *
 * Testitiedostot ovat poikkeus, koska niissä väärä muoto esiintyy
 * väistämättä juuri sen kieltävässä väitteessä
 * (`expect(...).not.toContain("Työmaat")`).
 */
const JUURET = ["lib", "app", "scripts"]
const PAATTEET = [".ts", ".tsx"]
const VAARA_MUOTO = "Työmaat"

function tiedostot(polku: string): string[] {
  let tila
  try {
    tila = statSync(polku)
  } catch {
    return []
  }

  if (tila.isFile()) {
    if (polku.endsWith(".spec.ts") || polku.endsWith(".spec.tsx")) return []
    return PAATTEET.some((p) => polku.endsWith(p)) ? [polku] : []
  }

  const ulos: string[] = []
  for (const nimi of readdirSync(polku)) {
    if (nimi === "node_modules" || nimi === ".next" || nimi.startsWith(".")) continue
    ulos.push(...tiedostot(join(polku, nimi)))
  }
  return ulos
}

describe("brändin kirjoitusasu", () => {
  it("ei kirjoita nimeä ö:llä missään lähdekoodissa", () => {
    const osumat: string[] = []

    for (const juuri of JUURET) {
      for (const polku of tiedostot(juuri)) {
        const sisalto = readFileSync(polku, "utf8")
        if (!sisalto.includes(VAARA_MUOTO)) continue
        sisalto.split("\n").forEach((rivi, i) => {
          if (rivi.includes(VAARA_MUOTO)) osumat.push(`${polku}:${i + 1}  ${rivi.trim()}`)
        })
      }
    }

    expect(osumat).toEqual([])
  })
})
