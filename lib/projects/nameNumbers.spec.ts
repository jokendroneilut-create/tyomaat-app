import { describe, it, expect } from "vitest"
import { extractNameNumbers, haveDifferentNameNumbers } from "./nameNumbers"

describe("extractNameNumbers", () => {
  it("poimii omana sanana olevat numerot", () => {
    expect(extractNameNumbers("Levin kortteleiden 207 ja 208 asemakaavamuutos")).toEqual([
      "207",
      "208",
    ])
  })

  /*
   * Kaupunginosat kirjoitetaan roomalaisilla, ja "Kyyhkylä I" / "Kyyhkylä II"
   * ovat eri kaava. Vain isot kirjaimet kelpaavat: pieni "i" tai "x" on
   * lähes aina osa sanaa.
   */
  it("poimii roomalaiset numerot mutta ei pieniä kirjaimia", () => {
    expect(extractNameNumbers("XVI (Tammela), Vellamonkatu 11")).toEqual(["11", "xvi"])
    expect(extractNameNumbers("Kyyhkylä II asemakaava")).toEqual(["ii"])
    expect(extractNameNumbers("Vanhan sillan korjaus")).toEqual([])
  })

  /*
   * Sanan sisällä oleva numero on osa tunnistetta eikä erottava luku:
   * "FIN04A" ja "Ph2" ovat kokonaisia niminä.
   */
  it("ei pilko sanan sisäistä numeroa", () => {
    expect(extractNameNumbers("FIN04A Ph2 Datakeskus")).toEqual([])
  })
})

describe("haveDifferentNameNumbers", () => {
  /*
   * Mitattu täydestä skannauksesta: 65 katselmoitavasta parista 48 oli
   * kaavapareja ja 34:llä numero erosi. titleWords pudottaa alle neljän
   * merkin sanat, joten numerot katosivat ennen vertailua ja nimistä jäi
   * täsmälleen sama sanajoukko.
   */
  it("tunnistaa eri kaavanumeron", () => {
    expect(
      haveDifferentNameNumbers(
        "295 Pereen asemakaavan muutos",
        "289 Pereen asemakaavan muutos"
      )
    ).toBe(true)
  })

  it("tunnistaa eri talonumeron", () => {
    expect(
      haveDifferentNameNumbers(
        "XVI (Tammela), Vellamonkatu 11, täydennysrakentaminen",
        "XVI (Tammela), Vellamonkatu 8, täydennysrakentaminen"
      )
    ).toBe(true)
  })

  /*
   * Vertailu koko joukkona, ei leikkauksena: nämä jakavat numerot 853 ja
   * 2021 mutta ovat eri kaava. Yksikin ero riittää.
   */
  it("ei vaadi joukkojen olevan erilliset", () => {
    expect(
      haveDifferentNameNumbers("Asemakaava 853 14/2021", "Asemakaava 853 5/2021")
    ).toBe(true)
  })

  /*
   * Vain toisessa oleva numero on yleensä tarkennus, ei ero.
   */
  it("ei rajoita kun vain toisella on numero", () => {
    expect(
      haveDifferentNameNumbers(
        "Oulun elämysareena ja ympäristö, Rata-aukio 2",
        "Oulun elämysareena"
      )
    ).toBe(false)
  })

  it("ei rajoita kun numerot ovat samat", () => {
    expect(
      haveDifferentNameNumbers(
        "Valtatien 4 parantaminen välillä Hirvas-Apukka",
        "Valtatien 4 parantaminen välillä Hirvas–Apukka, YVA"
      )
    ).toBe(false)
  })

  it("ei rajoita kun numeroita ei ole", () => {
    expect(
      haveDifferentNameNumbers(
        "Pyhäaamu asemakaavan muutos",
        "Asemakaavan muutos Pyhäaamu"
      )
    ).toBe(false)
  })
})
