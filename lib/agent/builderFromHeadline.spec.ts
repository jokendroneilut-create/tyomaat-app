import { describe, it, expect } from "vitest"
import { builderFromHeadline } from "./builderFromHeadline"

describe("builderFromHeadline", () => {
  /*
   * Uutislahteilla julkaisija on toimitus, joten urakoitsija on
   * poimittava otsikon rakenteesta. Mitatut muodot Rakennuslehdesta ja
   * kaupunkien uutisista 14.8.2026.
   */
  it("poimii urakoitsijan kun tilaaja on allatiivissa", () => {
    expect(builderFromHeadline("Hartela toteuttaa A-Kruunulle vähähiilisen asuinkerrostalon")).toBe("Hartela")
    expect(builderFromHeadline("Jatke rakentaa jälleen TVT Asunnoille – Turun Pernoon")).toBe("Jatke")
    expect(builderFromHeadline("Hartela rakentaa TA:lle kerrostalon Oulun Mäntylään")).toBe("Hartela")
  })

  /*
   * OMAPERUSTEINEN TUOTANTO EI TEE TEKIJASTA URAKOITSIJAA. Mitatut
   * tapaukset: naissa tekija rakentaa itselleen ja on rakennuttaja.
   */
  it("ei poimi omaperusteista tuotantoa", () => {
    expect(builderFromHeadline("Espoon Asunnot rakentaa 82 energiatehokasta vuokra-asuntoa")).toBeNull()
    expect(builderFromHeadline("PeeÄssä rakentaa S-marketin Neulamäkeen")).toBeNull()
  })

  /* Kunta on tilaaja vaikka lause olisi muodollisesti sama. */
  it("ei poimi kuntaa", () => {
    expect(builderFromHeadline("Espoo rakentaa Kojamolle koulun")).toBeNull()
  })

  it("ei poimi rakennuttamista eika suunnittelua", () => {
    expect(builderFromHeadline("Kojamo rakennuttaa Hartelalle kerrostalon")).toBeNull()
    expect(builderFromHeadline("Arkkitehdit suunnittelee Kojamolle kerrostalon")).toBeNull()
  })

  /*
   * ALLATIIVI ON MYOS MAARANPAA. "Hyvinkäälle" ei nimea tilaajaa vaan
   * sijainnin - mitattu tapaus 14.8.2026.
   */
  it("ei kelpuuta paikannimen allatiivia tilaajaksi", () => {
    expect(
      builderFromHeadline("Fira rakentaa lähes 200 metriä pitkän pysäköintitalon Hyvinkäälle")
    ).toBeNull()
  })

  /*
   * TILAAJA LOYTYY INGRESSISTA VAIKKA OTSIKKO EI SITA NIMEA. Tama on se
   * rivi josta koko saanto sai alkunsa.
   */
  it("poimii urakoitsijan kun tilaaja on vain ingressissa", () => {
    expect(
      builderFromHeadline(
        "Nyab rakentaa sähköaseman Forssaan",
        "Infrarakentaja Nyab on sopinut kantaverkkoyhtiö Fingridin kanssa Pikkumuolaan 400 kilovoltin sähköaseman rakentamisesta Forssassa."
      )
    ).toBe("Nyab")

    expect(
      builderFromHeadline(
        "Lujatalo rakentaa koulun Ouluun",
        "Hankkeen tilaajana on Oulun Tilapalvelut Oy."
      )
    ).toBe("Lujatalo")
  })

  /* Kumppanuus ei kerro kumpi on urakoitsija. */
  it("ei kelpuuta yhteistyokumppania tilaajaksi", () => {
    expect(
      builderFromHeadline(
        "Nyab rakentaa sähköaseman Forssaan",
        "Nyab on sopinut yhteistyöstä Fingridin kanssa sähköaseman rakentamisesta."
      )
    ).toBeNull()
  })

  /* Ilman tilaajaa ingressi ei riita, vaikka se olisi pitka. */
  it("ei poimi kun ingressi ei nimea tilaajaa", () => {
    expect(
      builderFromHeadline(
        "Nyab rakentaa sähköaseman Forssaan",
        "Rakentaminen alkaa elokuussa ja valmista on vuonna 2028."
      )
    ).toBeNull()
  })

  it("sietaa tyhjan", () => {
    expect(builderFromHeadline(null)).toBeNull()
    expect(builderFromHeadline("")).toBeNull()
  })
})
