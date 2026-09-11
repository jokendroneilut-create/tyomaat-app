import { describe, expect, it } from "vitest"

import {
  ajonViipale,
  kohdeOsoitteet,
  onAjankohtainen,
  parseT2hPage,
  vaiheLipusta,
  type T2hKohde,
} from "./fetchT2hKohteetSource"

describe("vaiheLipusta", () => {
  it("lukee vaiheen tilalipusta", () => {
    expect(vaiheLipusta("Tulossa")).toBe("Suunnittelu")
    expect(vaiheLipusta("Ennakkomarkkinoinnissa")).toBe("Suunnittelu")
    expect(vaiheLipusta("Myynnissä")).toBe("Rakenteilla")
    expect(vaiheLipusta("Rakenteilla")).toBe("Rakenteilla")
  })

  it("ei anna vaihetta valmiille", () => {
    expect(vaiheLipusta("Muuttovalmis")).toBeNull()
    expect(vaiheLipusta(null)).toBeNull()
  })

  /* Lippu on tasan tilasana; lauseen sisalta ei poimita. */
  it("ei tunnista lausetta lipuksi", () => {
    expect(vaiheLipusta("rakentamisen vaiheet mietityttavat")).toBeNull()
  })
})

describe("kohdeOsoitteet", () => {
  /*
   * Sitemapissa on myos asuntokohtaiset alasivut, joita on
   * moninkertainen maara kohteisiin nahden.
   */
  it("ottaa vain juuritason taloyhtiosivut", () => {
    const xml = `
      <loc>https://www.t2h.fi/asunto-oy-espoon-aurum</loc>
      <loc>https://www.t2h.fi/asunto-oy-espoon-aurum/2h-s-kt-4400-m2</loc>
      <loc>https://www.t2h.fi/kiinteisto-oy-vantaan-parkki</loc>
      <loc>https://www.t2h.fi/yhteystiedot</loc>
    `
    expect(kohdeOsoitteet(xml)).toEqual([
      "https://www.t2h.fi/asunto-oy-espoon-aurum",
      "https://www.t2h.fi/kiinteisto-oy-vantaan-parkki",
    ])
  })
})

/*
 * robots.txt asettaa Crawl-delay 15, joten 63 sivua kertaajolla olisi
 * 16 minuuttia. Lista kierretaan AJOKERRAN mukaan (D-185): paivaan sidottu
 * kierto jatti viipaleet kayttamatta, koska lahde ei aja joka paiva.
 */
describe("ajonViipale", () => {
  const lista = ["a", "b", "c", "d", "e", "f"]

  it("antaa saman viipaleen samalla ajokerralla", () => {
    expect(ajonViipale(lista, 7, 2)).toEqual(ajonViipale(lista, 7, 2))
  })

  /* Ajo 1 x 2 = 2, eli viipale alkaa kolmannesta. */
  it("siirtyy seuraavaan viipaleeseen seuraavalla ajolla", () => {
    expect(ajonViipale(lista, 1, 2)).toEqual(["c", "d"])
    expect(ajonViipale(lista, 2, 2)).toEqual(["e", "f"])
  })

  it("kiertaa listan ympari", () => {
    expect(ajonViipale(lista, 3, 2)).toEqual(["a", "b"])
  })

  /*
   * Todellinen koko: 63 kohdesivua kahden viipaleina. Perakkaiset ajot
   * kayvat kaiken lapi 32 ajossa ilman ett yhtaan jaa valiin.
   */
  it("kay 63 sivua lapi 32 perakkaisessa ajossa", () => {
    const sivut = Array.from({ length: 63 }, (_, i) => `s${i}`)
    const kaydyt = new Set<string>()
    for (let ajo = 100; ajo < 132; ajo++) {
      for (const x of ajonViipale(sivut, ajo, 2)) kaydyt.add(x)
    }
    expect(kaydyt.size).toBe(63)
  })

  it("sietaa tyhjan ja lyhyen listan seka roskan", () => {
    expect(ajonViipale([], 10, 2)).toEqual([])
    expect(ajonViipale(["a"], 10, 2)).toEqual(["a"])
    expect(ajonViipale(lista, -5, 2)).toEqual(["a", "b"])
  })
})

const SIVU = `
<script type="application/ld+json">
{"@context":"https://schema.org","@graph":[
 {"@type":"ApartmentComplex","name":"Asunto Oy Espoon Aurum",
  "description":"Aurumin Ihanat kodit rakentuvat Karhusuolle.",
  "address":{"@type":"PostalAddress","streetAddress":"Ensitorppa 8","addressLocality":"Espoo","postalCode":"02740"},
  "geo":{"@type":"GeoCoordinates","latitude":60.2269609,"longitude":24.6463493},
  "numberOfAccommodationUnits":13}
]}
</script>
<div class="bg-black/[.25] p-2">Tulossa</div>
<div>Valmistuu: 10/2027</div>
<p>Rakentamisen vaiheet saattavat mietityttaa uuden kodin ostajaa.</p>
`

describe("parseT2hPage", () => {
  it("lukee schema.org-tiedot ja tilalipun", () => {
    const k = parseT2hPage(SIVU)
    expect(k?.nimi).toBe("Asunto Oy Espoon Aurum")
    expect(k?.osoite).toBe("Ensitorppa 8, 02740, Espoo")
    expect(k?.kaupunki).toBe("Espoo")
    expect(k?.tila).toBe("Tulossa")
    expect(k?.vaihe).toBe("Suunnittelu")
    expect(k?.valmistuu).toBe("2027-10-31")
    expect(k?.asuntoja).toBe(13)
    expect(k?.koordinaatit).toEqual({ lat: 60.2269609, lon: 24.6463493 })
  })

  it("palauttaa nullin ilman nimea", () => {
    expect(parseT2hPage("<div>ei mitaan</div>")).toBeNull()
  })
})

const kohde = (yli: Partial<T2hKohde> = {}): T2hKohde => ({
  nimi: "Asunto Oy Testi",
  osoite: null,
  kaupunki: null,
  tila: "Myynnissä",
  vaihe: "Rakenteilla",
  valmistuu: "2027-12-31",
  asuntoja: null,
  koordinaatit: null,
  kuvaus: "",
  ...yli,
})

describe("onAjankohtainen", () => {
  const nyt = new Date("2026-09-06T00:00:00Z")

  it("hyvaksyy paivatyn kesken olevan", () => {
    expect(onAjankohtainen(kohde(), nyt)).toBe(true)
  })

  it("hylkaa valmiin ja paivaamattoman", () => {
    expect(onAjankohtainen(kohde({ vaihe: null }), nyt)).toBe(false)
    expect(onAjankohtainen(kohde({ valmistuu: null }), nyt)).toBe(false)
    expect(onAjankohtainen(kohde({ valmistuu: "2020-12-31" }), nyt)).toBe(false)
  })
})
