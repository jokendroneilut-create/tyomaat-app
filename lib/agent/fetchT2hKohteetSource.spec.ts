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
 * robots.txt asettaa Crawl-delay 15, joten 62 sivua kertaajolla olisi
 * 15,5 minuuttia. Lista kierretaan vuorokauden mukaan.
 */
describe("ajonViipale", () => {
  const paiva = 24 * 60 * 60 * 1000
  const lista = ["a", "b", "c", "d", "e", "f"]

  it("antaa saman viipaleen samana paivana", () => {
    const aamu = 10 * paiva + 3_600_000
    const ilta = 10 * paiva + 80_000_000 - 79_000_000
    expect(ajonViipale(lista, aamu, 2)).toEqual(ajonViipale(lista, ilta, 2))
  })

  /* Paiva 10 x 2 = 20, 20 % 6 = 2, eli viipale alkaa kolmannesta. */
  it("siirtyy seuraavaan viipaleeseen seuraavana paivana", () => {
    expect(ajonViipale(lista, 10 * paiva, 2)).toEqual(["c", "d"])
    expect(ajonViipale(lista, 11 * paiva, 2)).toEqual(["e", "f"])
  })

  /* Kolmessa paivassa kuuden listan kierros on tasan taynna. */
  it("kiertaa listan ympari", () => {
    expect(ajonViipale(lista, 12 * paiva, 2)).toEqual(["a", "b"])
  })

  /* Viipale ei saa jattaa yhtaan sivua kayttamatta kierroksella. */
  it("kayy koko listan lapi kierroksessa", () => {
    const kaydyt = new Set<string>()
    for (let paivaa = 10; paivaa < 13; paivaa++) {
      for (const x of ajonViipale(lista, paivaa * paiva, 2)) kaydyt.add(x)
    }
    expect([...kaydyt].sort()).toEqual(lista)
  })

  it("sietaa tyhjan listan ja lyhyen listan", () => {
    expect(ajonViipale([], 10 * paiva, 4)).toEqual([])
    expect(ajonViipale(["a"], 10 * paiva, 4)).toEqual(["a"])
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
