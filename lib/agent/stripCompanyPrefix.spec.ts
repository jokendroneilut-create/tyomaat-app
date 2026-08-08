import { describe, it, expect } from "vitest"
import { stripCompanyPrefixFromHeadline } from "./stripCompanyPrefix"

/*
 * Kaikki tapaukset ovat Peabin tiedotteiden oikeita otsikoita, jotka olivat
 * TIC-jonossa rikkinäisinä. Alkuperäiset haettiin tiedotesivuilta, koska
 * kantaan tallennetaan vain katkaistu muoto.
 */
describe("stripCompanyPrefixFromHeadline", () => {
  it("katkaisee kun jäljelle jää kelvollinen nimi", () => {
    expect(
      stripCompanyPrefixFromHeadline(
        "Peab peruskorjaa Vanhan Vaasan sairaalan F- ja T-rakennukset"
      )
    ).toBe("Vanhan Vaasan sairaalan F- ja T-rakennukset")
  })

  /*
   * Rinnasteinen predikaatti jätti aiemmin konjunktion otsikon alkuun:
   * "Ja uudistaa Iisalmen kulttuurikeskuksen". Nyt molemmat verbit
   * kuuluvat etuliitteeseen ja pääsana palautetaan perusmuotoon.
   */
  it("poistaa rinnasteisen predikaatin kokonaan", () => {
    expect(
      stripCompanyPrefixFromHeadline("Peab peruskorjaa ja uudistaa Iisalmen kulttuurikeskuksen")
    ).toBe("Iisalmen kulttuurikeskus")
  })

  it("ei koskaan aloita otsikkoa konjunktiolla", () => {
    expect(stripCompanyPrefixFromHeadline("Peab laajentaa ja uudistaa jotain")).not.toMatch(
      /^(Ja|Sekä|Tai)\b/
    )
  })

  /*
   * Genetiiviobjekti jää roikkumaan jos verbi poistetaan. Näissä koko
   * uutisotsikko on parempi hankenimi kuin katkelma.
   */
  it("säilyttää otsikon kun objekti jäisi genetiiviin", () => {
    expect(
      stripCompanyPrefixFromHeadline("Peab rakentaa koulun ja kirjaston Evijärvelle")
    ).toBe("Peab rakentaa koulun ja kirjaston Evijärvelle")

    expect(
      stripCompanyPrefixFromHeadline(
        "Peab käynnistää uuden omaperusteisen asuntohankkeen Tampereella"
      )
    ).toBe("Peab käynnistää uuden omaperusteisen asuntohankkeen Tampereella")
  })

  /*
   * Saaja allatiivissa kertoo että objekti tulee vasta sen jälkeen
   * genetiivissä - myös silloin kun saajan nimi on kaksiosainen.
   */
  it("säilyttää otsikon kun alussa on saaja", () => {
    expect(
      stripCompanyPrefixFromHeadline("Peab rakentaa atNorthille FIN04A-datakeskuksen Kouvolaan")
    ).toBe("Peab rakentaa atNorthille FIN04A-datakeskuksen Kouvolaan")

    expect(
      stripCompanyPrefixFromHeadline("Peab rakentaa YH Kodeille kolme kerrostaloa Tampereelle")
    ).toBe("Peab rakentaa YH Kodeille kolme kerrostaloa Tampereelle")
  })

  it("ei muuta illatiivia pääsanan perusmuodoksi", () => {
    // "Kouvolaan" on pitkä vokaali + n, ei genetiivi
    expect(stripCompanyPrefixFromHeadline("SRV toteuttaa Ratapihankorttelin Kouvolaan")).toBe(
      "Ratapihankorttelin Kouvolaan"
    )
  })

  it("jättää rauhaan otsikon jossa ei ole yritysetuliitettä", () => {
    expect(stripCompanyPrefixFromHeadline("Espoonkartanoon valmistuu uusi koulu")).toBe(
      "Espoonkartanoon valmistuu uusi koulu"
    )
  })

  it("sietää tyhjän ja puuttuvan otsikon", () => {
    expect(stripCompanyPrefixFromHeadline(null)).toBe("")
    expect(stripCompanyPrefixFromHeadline("   ")).toBe("")
  })
})
