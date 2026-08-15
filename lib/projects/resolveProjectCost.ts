import { extractCostFromText } from "./extractCostFromText"

/*
 * Hankkeen euromääräinen arvo ja SEN ALKUPERÄ — yksi ratkaisupaikka.
 *
 * Arvo voi tulla kolmella eri tarkkuudella, eivätkä ne saa näyttää samalta:
 *
 *   manual    Ihmisen käsin syöttämä arvo. Vahvin, koska se on nimenomaan
 *             korjaus koneen erehdykseen (D-076).
 *   contract  Hilman ilmoituksen sopimusarvo. Eksakti, toteutunut hinta.
 *   text      Kuvaustekstistä ankkuroituna poimittu kustannusarvio. Hankkeen
 *             oma arvio, usein pyöristetty ja hankkeen alkuvaiheesta.
 *   derived   Meidän oma arviomme (esim. kohdetyypin mediaani). EI TÄSSÄ —
 *             ks. alla.
 *
 * MIKSI ALKUPERÄ TALLENNETAAN. Ilman sitä 60 000 000 € sopimusarvo ja
 * kohdetyypistä arvattu mediaani ovat kannassa erottamattomat, ja asiakas
 * lukee molemmat yhtä varmoina. Sama periaate kuin muuallakin: tyhjä kenttä
 * ei valehtele, mutta varmalta näyttävä arvaus valehtelee.
 *
 * "derived" ei ole tässä funktiossa tarkoituksella. Oma arvio on
 * tuotepäätös (näytetäänkö asiakkaalle arvattu luku ja millä merkinnällä),
 * ei poimintapäätös, joten se pidetään erillään kunnes siitä on päätetty.
 */

export type CostSource = "manual" | "contract" | "text"

export type ResolvedCost = {
  estimated_cost: number
  cost_source: CostSource
}

/*
 * Suurempi voittaa. Eksakti sopimusarvo ei saa korvautua tekstistä poimitulla
 * arviolla, vaikka arvio tulisi myöhemmästä lähdesignaalista.
 */
const PRECEDENCE: Record<CostSource, number> = {
  manual: 3,
  contract: 2,
  text: 1,
}

function toPositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function isCostSource(value: unknown): value is CostSource {
  return value === "manual" || value === "contract" || value === "text"
}

/*
 * Palauttaa parhaan tiedossa olevan arvon alkuperineen, tai null jos arvoa ei
 * ole. Olemassa oleva arvo annetaan mukaan, jotta huonompi alkuperä ei
 * ylikirjoita parempaa — kutsuja voi verrata tulosta nykytilaan ja kirjoittaa
 * vain jos se muuttuu.
 */
export function resolveProjectCost(input: {
  contractValue?: unknown
  text?: string | null
  existingCost?: unknown
  existingSource?: unknown
}): ResolvedCost | null {
  const candidates: ResolvedCost[] = []

  const existing = toPositiveNumber(input.existingCost)
  if (existing !== null) {
    candidates.push({
      estimated_cost: existing,
      /*
       * Tuntematon alkuperä tulkitaan "text"-tasoksi: ennen 15.8.2026
       * kirjoitetuilla riveillä ei ole merkintää, ja niiden kohtelu
       * sopimusarvona estäisi aidon sopimusarvon kirjoittumisen päälle.
       */
      cost_source: isCostSource(input.existingSource)
        ? input.existingSource
        : "text",
    })
  }

  const contract = toPositiveNumber(input.contractValue)
  if (contract !== null) {
    candidates.push({ estimated_cost: contract, cost_source: "contract" })
  }

  const fromText = extractCostFromText(input.text)
  if (fromText !== null) {
    candidates.push({ estimated_cost: fromText, cost_source: "text" })
  }

  if (!candidates.length) return null

  return candidates.reduce((best, c) =>
    PRECEDENCE[c.cost_source] > PRECEDENCE[best.cost_source] ? c : best
  )
}
