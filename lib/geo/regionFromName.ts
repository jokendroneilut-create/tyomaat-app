import { MUNICIPALITIES } from "@/lib/geo/municipalities"

/*
 * MAAKUNTA ORGANISAATION NIMESTÄ.
 *
 * Osa tilaajista on maakunnallisia: "Pohjois-Karjalan hankintatoimi",
 * "Varsinais-Suomen ELY-keskus", "Pirkanmaan sairaanhoitopiiri". Niillä
 * ei ole kuntaa, joten kunnasta päättely ei auta — mutta nimi kertoo
 * maakunnan suoraan.
 *
 * Mitattu 2.9.2026: näkyvistä 5 836 hankkeesta 12:lta puuttui maakunta
 * ja jonossa yksi. Aukko on kapea, mutta juuri se yksi jonorivi
 * ("Kiteen alueen työkone- ja kuljetuspalvelut", tilaaja Pohjois-Karjalan
 * hankintatoimi) on tämän säännön tapaus.
 *
 * TAIVUTUS ON TAULUKOITU, EI PÄÄTELTY. Suomen maakuntanimien genetiivi
 * on osin säännötön (Uusimaa → Uudenmaan, Lappi → Lapin, Satakunta →
 * Satakunnan), ja arvaava sääntö osuisi väärin juuri niissä. Lista on 19
 * riviä pitkä eikä kasva.
 */

/* Nominatiivi -> genetiivin vartalo, josta kuvio rakennetaan. */
const GENETIIVIT: Record<string, string> = {
  Uusimaa: "Uudenmaa",
  Lappi: "Lapi",
  Satakunta: "Satakunna",
  "Varsinais-Suomi": "Varsinais-Suome",
  "Keski-Suomi": "Keski-Suome",
  "Kanta-Häme": "Kanta-Hämee",
  "Päijät-Häme": "Päijät-Hämee",
}

function muodot(maakunta: string): string[] {
  const vartalo = GENETIIVIT[maakunta] ?? maakunta
  /* Nominatiivi ja genetiivi (vartalo + n). */
  return [...new Set([maakunta, `${vartalo}n`])].map((x) => x.toLowerCase())
}

const REGIONS: [string, string[]][] = [
  ...new Set(Object.values(MUNICIPALITIES).map((m) => m.region)),
]
  .sort((a, b) => b.length - a.length)
  .map((r) => [r, muodot(r)])

/*
 * Palauttaa maakunnan jos organisaation nimi mainitsee sen.
 *
 * Pisin nimi ensin, jottei "Pohjanmaa" osu ennen "Pohjois-Pohjanmaata".
 */
export function regionFromOrganisationName(name: string | null | undefined): string | null {
  const teksti = String(name ?? "").toLowerCase()
  if (!teksti.trim()) return null

  for (const [maakunta, kuviot] of REGIONS) {
    for (const kuvio of kuviot) {
      /*
       * Sananraja alussa: "Pohjanmaan" ei saa osua sanaan
       * "Etelä-Pohjanmaan" väärällä maakunnalla — pisin ensin hoitaa
       * järjestyksen, mutta raja estää osuman keskeltä sanaa.
       */
      const i = teksti.indexOf(kuvio)
      if (i < 0) continue
      const edellinen = i === 0 ? "" : teksti[i - 1]
      if (edellinen && /[a-zäöå-]/.test(edellinen)) continue
      return maakunta
    }
  }
  return null
}
