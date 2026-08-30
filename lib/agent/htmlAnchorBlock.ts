/*
 * YHDEN KAAVAN LOHKO YHTEISELTÄ SIVULTA.
 *
 * Osa kunnista listaa kaikki kaavansa YHDELLE sivulle, ja dokumentin
 * osoite on silloin `.../asemakaavat/#kartanorinne-asemakaava`. Koko
 * sivun lukeminen antaa jokaiselle kaavalle saman vastauksen.
 *
 * Juuri niin kävi voimaantulopäivien takautuvassa ajossa 29.8.2026:
 * kuivaharjoitus antoi Pornaisten viidelle eri kaavalle saman päivän
 * 28.5.2018 ja Kustavin kolmelle saman päivän 6.6.2022 — se oli sivun
 * VIIMEINEN voimaantulo, ei kunkin kaavan oma. Luvut näyttivät
 * uskottavilta taulukossa ja paljastuivat vasta riveittäin luettuna.
 *
 * Tämä moduuli rajaa tekstin siihen otsikkoon jonka ankkuri osoittaa,
 * ja seuraavaan samantasoiseen otsikkoon asti. Jos ankkuria vastaavaa
 * otsikkoa ei löydy, palautetaan null: mieluummin tyhjä kuin väärä.
 */

export function anchorSlug(value: string): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/*
 * Ankkuri voi olla otsikon slug sellaisenaan tai numeroliitteellä, kun
 * samanniminen otsikko esiintyy sivulla useasti ("...-muutos-3").
 */
export function anchorMatches(headingSlug: string, anchor: string): boolean {
  if (!headingSlug || !anchor) return false
  if (headingSlug === anchor) return true
  if (!anchor.startsWith(`${headingSlug}-`)) return false
  return /^\d+$/.test(anchor.slice(headingSlug.length + 1))
}

const OTSIKOT = ["h1", "h2", "h3", "h4", "h5", "h6"]

/*
 * LIHAVOITU KAPPALE ON MYOS OTSIKKO. Osa kunnista ei kayta
 * otsikkoelementteja lainkaan vaan erottaa kaavat lihavoidulla
 * kappaleella (`<p><strong>Kartanorinne, asemakaava</strong></p>`).
 * Pornaisten ja Kustavin kerääjät lukevat sivua juuri niin, joten
 * ankkuritkin on muodostettu niista.
 *
 * Ehto on tiukka: kappaleen KOKO teksti on lihavoitu. Muuten lause jossa
 * on yksi korostettu sana katkaisisi lohkon kesken.
 */
function lihavoituOtsikko($: any, el: any): boolean {
  const nimi = String(el.name ?? el.tagName ?? "").toLowerCase()
  if (nimi !== "p") return false
  const teksti = $(el).text().replace(/\s+/g, " ").trim()
  if (!teksti) return false
  const lihava = $(el).find("strong, b").first()
  if (!lihava.length) return false
  return lihava.text().replace(/\s+/g, " ").trim() === teksti
}

/* Otsikon taso: lihavoitu kappale on alin, joten se paattyy mihin tahansa. */
function otsikkoTaso($: any, el: any): number | null {
  const nimi = String(el.name ?? el.tagName ?? "").toLowerCase()
  if (OTSIKOT.includes(nimi)) return Number(nimi.slice(1))
  if (lihavoituOtsikko($, el)) return 9
  return null
}

/*
 * $ on cheerio-instanssi. Pidetään tyypitys löysänä, koska kerääjät
 * käyttävät samaa kirjastoa eri versioina.
 */
export function anchorBlockText($: any, anchor: string): string | null {
  const kohde = String(anchor ?? "").replace(/^#/, "")
  if (!kohde) return null

  const otsikot = $([...OTSIKOT, "p"].join(",")).toArray()
    .filter((el: any) => otsikkoTaso($, el) !== null)

  const osuma = otsikot.find((el: any) => {
    const id = String($(el).attr("id") ?? "")
    if (id && anchorMatches(anchorSlug(id), kohde)) return true
    return anchorMatches(anchorSlug($(el).text()), kohde)
  })

  if (!osuma) return null

  const taso = otsikkoTaso($, osuma) ?? 2

  const palat: string[] = []
  let solmu: any = $(osuma).next()

  while (solmu && solmu.length) {
    const seuraavaTaso = otsikkoTaso($, solmu.get(0))
    /* Samantasoinen tai ylempi otsikko aloittaa seuraavan kaavan. */
    if (seuraavaTaso !== null && seuraavaTaso <= taso) break
    palat.push(solmu.text())
    solmu = solmu.next()
  }

  const teksti = palat.join(" ").replace(/\s+/g, " ").trim()
  return teksti || null
}

/*
 * Sivun lohko-otsikot samalla saannolla kuin ankkurin haku: otsikot
 * h1-h6 ja kokonaan lihavoidut kappaleet. Tata kaytetaan sen
 * tarkistamiseen, tuottaako sivu kaksi samannimista lohkoa — silloin
 * niista muodostuu sama tunniste ja toinen katoaa (D-145).
 */
export function blockHeadings($: any): string[] {
  return $([...OTSIKOT, "p"].join(","))
    .toArray()
    .filter((el: any) => otsikkoTaso($, el) !== null)
    .map((el: any) => $(el).text().replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

/*
 * Kaikkien samannimisten lohkojen SISALLOT.
 *
 * Toistuva otsikko ei viela tarkoita kahta kaavaa: kuntien sivuilla sama
 * nimi esiintyy usein kahdella tasolla (h3 ja h4), otsikkona ja
 * linkkilistassa, tai kerran per asiakirjaryhma. Vasta se, etta lohkojen
 * SISALLOT eroavat, kertoo kahdesta eri kaavasta.
 *
 * Palauttaa yhden merkkijonon per esiintyma, tyhjat mukaan lukien.
 */
export function blockTextsForSlug($: any, slug: string): string[] {
  const ulos: string[] = []

  for (const el of $([...OTSIKOT, "p"].join(",")).toArray()) {
    const taso = otsikkoTaso($, el)
    if (taso === null) continue
    if (anchorSlug($(el).text()) !== slug) continue

    const palat: string[] = []
    let solmu: any = $(el).next()
    while (solmu && solmu.length) {
      const seuraava = otsikkoTaso($, solmu.get(0))
      if (seuraava !== null && seuraava <= taso) break
      palat.push(solmu.text())
      solmu = solmu.next()
    }
    ulos.push(palat.join(" ").replace(/\s+/g, " ").trim())
  }

  return ulos
}

/*
 * Ovatko samannimiset lohkot SAMA kaava?
 *
 * Toistuva otsikko on kuntien sivuilla useimmiten sama kaava. Mitattu
 * 30.8.2026: 143 listaussivusta kahdeksalla otsikko toistui, ja jokainen
 * niista osoittautui kasin luettuna samaksi kaavaksi — paitsi
 * Pietarsaaren Keskusta, joka oli aito (D-145).
 *
 * Kolme tavallista tapaa jolla sama kaava esiintyy kahdesti:
 *
 *   h3 ja sen alla h4 samalla nimella   ylempi lohko sisaltaa alemman
 *   otsikko ja linkkilistan rivi        toinen on tyhja
 *   otsikko per asiakirjaryhma          "Kuulutus... Kaavakartta..."
 *
 * Erottelu tehdaan kahdella ehdolla, jotka molempien on toteuduttava
 * jotta kyse olisi KAHDESTA kaavasta:
 *
 *   1. molemmissa on oikeaa kuvaustekstia (>= KUVAUS_MIN merkkia) —
 *      asiakirjalista ja paivamaarahuomautus jaavat alle
 *   2. sanastot eroavat — sama kaava kirjoittaa samat sanat, vaikka
 *      lohkojen pituus vaihtelisi
 */
const KUVAUS_MIN = 120
const SANASTO_RAJA = 0.6

function sanat(teksti: string): Set<string> {
  return new Set(
    teksti
      .toLowerCase()
      .split(/[^a-zäöå0-9]+/)
      .filter((w) => w.length > 3)
  )
}

function sanastoOsuus(a: string, b: string): number {
  const sa = sanat(a)
  const sb = sanat(b)
  if (!sa.size || !sb.size) return 1
  let yhteisia = 0
  for (const w of sa) if (sb.has(w)) yhteisia++
  return yhteisia / Math.min(sa.size, sb.size)
}

export function blocksLookIdentical(tekstit: string[]): boolean {
  const siistit = tekstit.map((t) => String(t ?? "").replace(/\s+/g, " ").trim())
  const kuvaukset = siistit.filter((t) => t.length >= KUVAUS_MIN)
  if (kuvaukset.length < 2) return true

  for (let i = 0; i < kuvaukset.length; i++) {
    for (let j = i + 1; j < kuvaukset.length; j++) {
      const a = kuvaukset[i]
      const b = kuvaukset[j]
      if (a.includes(b) || b.includes(a)) continue
      if (sanastoOsuus(a, b) < SANASTO_RAJA) return false
    }
  }

  return true
}
