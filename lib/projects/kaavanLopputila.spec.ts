import { describe, expect, it } from "vitest"

import { kaavanLopputila } from "./kaavanLopputila"

/* Jokainen merkkijono on luettu kannasta 8.11.2026 (D-396). */
describe("kaavanLopputila", () => {
  it("tunnistaa paljaan tilasanan", () => {
    expect(kaavanLopputila("Voimaantulo")?.tila).toBe("lainvoimainen")
    expect(kaavanLopputila("Lainvoimaisuus")?.tila).toBe("lainvoimainen")
  })

  it("lukee lainvoiman paivan lauseesta", () => {
    expect(kaavanLopputila("Kaava on saanut lainvoiman 20.10.2026")).toEqual({
      tila: "lainvoimainen",
      paiva: "2026-10-20",
      todiste: "Kaava on saanut lainvoiman 20.10.2026",
    })
    expect(kaavanLopputila("Asemakaavamuutos kuulutetaan voimaan 17.8.2026.")?.paiva).toBe(
      "2026-08-17"
    )
  })

  it("ei pida hyvaksymista lainvoimana", () => {
    /* Hyvaksyminen aloittaa valitusajan, ei paata kaavaa. */
    expect(kaavanLopputila("Hyväksyminen")).toBeNull()
    expect(kaavanLopputila("Hyväksymiskäsittely")).toBeNull()
    expect(
      kaavanLopputila(
        "Asemakaava on hyväksytty kaupunginvaltuustossa 30.9.2026, mutta se ei ole vielä lainvoimainen."
      )
    ).toBeNull()
  })

  it("ei pida kesken olevaa vaihetta lopputilana", () => {
    for (const teksti of [
      "Ehdotusvaihe",
      "Luonnos",
      "Vireilletulo",
      "Asemakaavan muutosehdotus pidetään julkisesti nähtävillä 12.10.-10.11.2026.",
      "Kaavaehdotus oli julkisesti nähtävillä (AKL 65 §) 20.8. – 21.9.2026 välisen ajan.",
    ]) {
      expect(kaavanLopputila(teksti), teksti).toBeNull()
    }
  })

  it("tunnistaa keskeytetyn kaavan omana lopputilanaan", () => {
    expect(kaavanLopputila("Kaavaprosessin keskeyttäminen")?.tila).toBe("keskeytetty")
    expect(kaavanLopputila("Kaava on kumottu")?.tila).toBe("keskeytetty")
  })

  it("ei lue tulevaisuuden paivaa lainvoimaksi", () => {
    const tuleva = `Kaava on saanut lainvoiman 1.1.${new Date().getUTCFullYear() + 2}`
    expect(kaavanLopputila(tuleva)?.paiva).toBeNull()
    /* Tila tunnistuu yha, vain paiva jaa pois. */
    expect(kaavanLopputila(tuleva)?.tila).toBe("lainvoimainen")
  })
})
