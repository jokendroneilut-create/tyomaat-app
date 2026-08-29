import { describe, expect, it } from "vitest"

import {
  pietarsaariKaavaQualifier,
  pietarsaariKaavaSlugs,
  pietarsaariKaavaTitles,
  pietarsaariSlug,
} from "./pietarsaariKaavaSlug"

/* Sivun tilanne 29.8.2026: kaksi eri kaavaa samalla otsikolla. */
const KESKUSTA_KIRKKO = {
  title: "Asemakaavan muutos Keskustassa",
  description: "Suunnittelualue sijaitsee keskustan pohjoisosassa. Kortteli 15, jossa on Pietarsaaren kirkko vuodelta 1731.",
}
const KESKUSTA_MARIA_MALM = {
  title: "Asemakaavan muutos Keskustassa",
  description: "Alue käsittää ns. Maria Malm korttelin ja viereiset kadut. Virastotalo purettiin 2008.",
}
const VARVET = { title: "Asemakaava Varvetissa", description: "Suunnittelualue sijaitsee noin 3 km torilta." }

describe("pietarsaariKaavaSlugs", () => {
  it("jattaa ainutkertaisen otsikon slugin ennalleen", () => {
    expect(pietarsaariKaavaSlugs([VARVET])).toEqual(["asemakaava-varvetissa"])
  })

  /* Tama oli vika: sama slug ylikirjoitti toisen kaavan joka ajolla. */
  it("erottaa kaksi samannimista kaavaa toisistaan", () => {
    const [a, b] = pietarsaariKaavaSlugs([KESKUSTA_KIRKKO, KESKUSTA_MARIA_MALM])
    expect(a).not.toBe(b)
    expect(a.startsWith("asemakaavan-muutos-keskustassa-")).toBe(true)
    expect(b.startsWith("asemakaavan-muutos-keskustassa-")).toBe(true)
  })

  /*
   * Tunniste ei saa riippua lohkon paikasta: jarjestysnumero vaihtaisi
   * kahden hankkeen sisallot keskenaan kun kaupunki jarjestaa sivun
   * uudelleen.
   */
  it("antaa saman tunnisteen jarjestyksesta riippumatta", () => {
    const eteen = pietarsaariKaavaSlugs([KESKUSTA_KIRKKO, VARVET, KESKUSTA_MARIA_MALM])
    const takaperin = pietarsaariKaavaSlugs([KESKUSTA_MARIA_MALM, VARVET, KESKUSTA_KIRKKO])
    expect(eteen[0]).toBe(takaperin[2])
    expect(eteen[2]).toBe(takaperin[0])
    expect(eteen[1]).toBe(takaperin[1])
  })

  /* Muiden kaavojen tunnisteet eivat saa muuttua korjauksen takia. */
  it("ei muuta muiden kaavojen tunnisteita", () => {
    const slugit = pietarsaariKaavaSlugs([KESKUSTA_KIRKKO, VARVET, KESKUSTA_MARIA_MALM])
    expect(slugit[1]).toBe(pietarsaariSlug(VARVET.title))
  })

  it("kestaa tyhjan kuvauksen", () => {
    const [a, b] = pietarsaariKaavaSlugs([
      { title: "Asemakaava X", description: null },
      { title: "Asemakaava X", description: "Jotain sisaltoa." },
    ])
    expect(a).not.toBe(b)
  })
})

describe("pietarsaariKaavaTitles", () => {
  const KIRKKO = {
    title: "Asemakaavan muutos Keskustassa",
    description: "Kortteli 15, jossa on Pietarsaaren kirkko vuodelta 1731.",
    documents: ["/uploads/2026/03/OAS-kirkko-ja-sen-ymparisto-kaava-041.pdf", "/uploads/Detaljplan_27.3.2026.pdf"],
  }
  const MARIA_MALM = {
    title: "Asemakaavan muutos Keskustassa",
    description: "Alue käsittää ns. Maria Malm korttelin.",
    documents: ["/uploads/2021/10/Maria-Malm-PDB.pdf"],
  }
  const VARVET = { title: "Asemakaava Varvetissa", description: "Kolme km torilta.", documents: ["/uploads/pdb_varvet_uppdatering_709714.pdf"] }

  /* Ainutkertaista nimeä ei saa muuttaa: se on jo hankkeen tunnus. */
  it("jattaa ainutkertaisen nimen ennalleen", () => {
    expect(pietarsaariKaavaTitles([VARVET, KIRKKO, MARIA_MALM])[0]).toBe("Asemakaava Varvetissa")
  })

  /*
   * Tama oli vika: kaksi samannimista kaavaa sulautui yhdeksi, koska
   * ehdokkaiden yhdistaminen putoaa lopulta osoitteen ja kunnan vertailuun
   * ja "osoite" on tassa lahteessa kaavan nimi.
   */
  it("erottaa samannimiset kaupungin oman asiakirjan nimella", () => {
    const [a, b] = pietarsaariKaavaTitles([KIRKKO, MARIA_MALM])
    expect(a).toBe("Asemakaavan muutos Keskustassa (kirkko ja sen ymparisto)")
    expect(b).toBe("Asemakaavan muutos Keskustassa (Maria Malm)")
  })

  /* Ilman kayttokelpoista asiakirjan nimea nimet on silti erotettava. */
  it("kayttaa viimeisena keinona tunnisteen tiivistetta", () => {
    const nimet = pietarsaariKaavaTitles([
      { title: "Asemakaava X", description: "Yksi", documents: ["/OAS.pdf"] },
      { title: "Asemakaava X", description: "Kaksi", documents: ["/PDB.pdf"] },
    ])
    expect(nimet[0]).not.toBe(nimet[1])
    expect(nimet[0].startsWith("Asemakaava X (")).toBe(true)
  })
})

describe("pietarsaariKaavaQualifier", () => {
  it("karsii asiakirjatyypin, kaavanumeron ja paivamaaran", () => {
    expect(pietarsaariKaavaQualifier(["/x/OAS-kirkko-ja-sen-ymparisto-kaava-041.pdf"])).toBe("kirkko ja sen ymparisto")
    expect(pietarsaariKaavaQualifier(["/x/Maria-Malm-PDB.pdf"])).toBe("Maria Malm")
  })

  it("ohittaa nimen josta ei jaa mitaan", () => {
    expect(pietarsaariKaavaQualifier(["/x/OAS.pdf", "/x/Maria-Malm-PDB.pdf"])).toBe("Maria Malm")
    expect(pietarsaariKaavaQualifier(["/x/OAS.pdf"])).toBeNull()
  })
})
