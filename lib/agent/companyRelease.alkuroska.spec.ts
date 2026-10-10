import { describe, it, expect } from "vitest"
import { stripReleaseHead } from "./companyRelease"

/* Naytteet ovat tuotannon kuvauksista 11.10.2026. */
describe("stripReleaseHead", () => {
  it("poistaa otsikon, aikaleiman ja Tiedote/Jaa-palkin", () => {
    const raw =
      "Hartela rakentaa YES-EU:n uuden pääkonttorin Aviapolikseen6.10.2026 07:59:43 EEST | Hartela | TiedoteJaaHartela rakentaa Julius Tallberg-Kiinteistöt Oyj:lle toimitilat Aviapolikseen. Kohteen käyttäjäksi tulee YES-EU Oy."
    expect(stripReleaseHead(raw)).toBe(
      "Hartela rakentaa Julius Tallberg-Kiinteistöt Oyj:lle toimitilat Aviapolikseen. Kohteen käyttäjäksi tulee YES-EU Oy."
    )
  })

  it("toimii myos EET-vyohykkeella ja Skanskan muodolla", () => {
    const raw =
      "Skanska rakentaa Iin kunnalle uuden koulun Valtariin15.12.2025 09:05:00 EET | Skanska Oy | TiedoteJaaSkanska ja Iin kunta ovat allekirjoittaneet urakkasopimuksen Valtarin uuden ylakoulun rakentamisesta."
    expect(stripReleaseHead(raw)).toBe(
      "Skanska ja Iin kunta ovat allekirjoittaneet urakkasopimuksen Valtarin uuden ylakoulun rakentamisesta."
    )
  })

  /* Siisti teksti ei saa muuttua. */
  it("ei koske tekstiin jossa ei ole aikaleimaa", () => {
    const puhdas = "Hartela rakentaa Kirkkonummen Sarvvikiin rivitalokohteen Novus Family Homesille. Kohde valmistuu 2027."
    expect(stripReleaseHead(puhdas)).toBe(puhdas)
  })

  /*
   * Jos hahmo soisi koko tekstin, alkuperainen sailytetaan: roskainen
   * kuvaus on parempi kuin tyhja.
   */
  it("ei tyhjenna kuvausta", () => {
    const lyhyt = "Jotain1.1.2026 10:00:00 EET | X | TiedoteJaalyhyt"
    expect(stripReleaseHead(lyhyt)).toBe(lyhyt)
  })

  /* Kaksi julkaisijaa putkeen — loytyi kuivaharjoituksesta. */
  it("poistaa myos kahden julkaisijan palkin", () => {
    const raw =
      "Puolustuskiinteistöt kuuluu kokonaisuuteen Senaatti-kiinteistöt Säkylän varuskunnan kuntotalo peruskorjataan 27.11.2025 08:30:00 EET | Senaatti-kiinteistöt | Puolustuskiinteistöt | Tiedote Jaa Puolustuskiinteistöt valmistelee Säkylän varuskunnan kuntotalon peruskorjausta vuodelle 2027."
    expect(stripReleaseHead(raw)).toBe(
      "Puolustuskiinteistöt valmistelee Säkylän varuskunnan kuntotalon peruskorjausta vuodelle 2027."
    )
  })
})
