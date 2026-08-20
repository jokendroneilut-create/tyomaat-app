import { describe, it, expect } from "vitest"
import { cleanBulletinPdfText, extractApplicationDescription, bulletinPdfUrl } from "./lupapisteBulletinPdf"

describe("cleanBulletinPdfText", () => {
  /* Henkilotiedot on peitetty paatosasiakirjassa mustilla palkeilla. */
  it("poistaa peitetyt henkilotiedot", () => {
    expect(cleanBulletinPdfText("Hankkeeseen ryhtyva████████ Toimenpide")).toBe(
      "Hankkeeseen ryhtyva Toimenpide"
    )
  })

  it("siistii valilyonnit mutta sailyttaa kappaleet", () => {
    expect(cleanBulletinPdfText("a   b\n\n\n\nc")).toBe("a b\n\nc")
  })
})

describe("extractApplicationDescription", () => {
  /*
   * Mitattu tapaus 21.8.2026: Vantaan LP-092-2026-02341. Rajapinta antoi
   * "Rakentamista valmistelevat tyot", PDF kertoi datakeskuksesta.
   */
  it("poimii lainatun kuvauksen otsikon perasta", () => {
    const pdf =
      'LisaselvityksetHankkeen kuvaus hakemuksella\n"Tulevien datakeskusrakennusten ja lammontalteenottorakennuksen rakentamista valmistelevat pohjatyot, kuten maankaivuu ja louhinta."\nHankkeen vaativuusVaativa'
    expect(extractApplicationDescription(pdf)).toBe(
      "Tulevien datakeskusrakennusten ja lammontalteenottorakennuksen rakentamista valmistelevat pohjatyot, kuten maankaivuu ja louhinta."
    )
  })

  it("poimii kappaleen kun lainausmerkkeja ei ole", () => {
    const pdf = "Rakennushankkeen kuvaus:\nUudisrakennus jossa on kolme kerrosta ja autohalli.\n\nSeuraava osio"
    expect(extractApplicationDescription(pdf)).toBe(
      "Uudisrakennus jossa on kolme kerrosta ja autohalli."
    )
  })

  /*
   * Ensimmainen versio otti pisimman lainauksen pituuden perusteella. Se osui
   * 15 paatoksesta yhteen ja sekin oli vaara kohta: poikkeamispaatoksen
   * perustelu, ei hankkeen kuvaus. Siksi poiminta on sidottu otsikkoon.
   */
  it("ei poimi lainausta ilman otsikkoa", () => {
    const pdf =
      'Perustelut paatokselle\n"Autosuojan nykyinen sijainti ei muutu nykytilanteesta, eika rakennusalan ylitys kasva nykytilanteesta."'
    expect(extractApplicationDescription(pdf)).toBeNull()
  })

  /* Otsikon loppuosa vaihtelee kunnittain. */
  it("tunnistaa myos muodon hakemuksessa", () => {
    const pdf = 'Hankkeen kuvaus hakemuksessa: "Olemassa olevan rakennuksen laajennus terassialueelle ja uusi sisaankaynti."'
    expect(extractApplicationDescription(pdf)).toBe(
      "Olemassa olevan rakennuksen laajennus terassialueelle ja uusi sisaankaynti."
    )
  })

  it("ei poimi liian lyhytta", () => {
    expect(extractApplicationDescription('Hankkeen kuvaus\n"Sauna."')).toBeNull()
  })

  it("kestaa tyhjan", () => {
    expect(extractApplicationDescription(null)).toBeNull()
    expect(extractApplicationDescription("")).toBeNull()
  })
})

describe("bulletinPdfUrl", () => {
  it("koodaa tunnisteen", () => {
    expect(bulletinPdfUrl("LP-092-2026-02341_abc")).toContain("bulletinId=LP-092-2026-02341_abc")
  })
})
