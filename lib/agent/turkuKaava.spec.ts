import { describe, expect, it } from "vitest"
import { turunKaavasivunOsoite, turunKaupunginosaJaOsoite } from "./turkuKaava"

describe("turunKaavasivunOsoite (D-449)", () => {
  it("korvaa polun välilyönnin väliviivalla", () => {
    expect(turunKaavasivunOsoite("https://www.turku.fi/rakentaminen/kaavoitus/tuureporinkatu 6b-12-3858-2022")).toBe(
      "https://www.turku.fi/rakentaminen/kaavoitus/tuureporinkatu-6b-12-3858-2022"
    )
  })

  it("poistaa välin kauttaviivan jälkeen ja reunoilta", () => {
    expect(turunKaavasivunOsoite("  https://www.turku.fi/rakentaminen/kaavoitus/ vilhonkatu12a-1637-2021 ")).toBe(
      "https://www.turku.fi/rakentaminen/kaavoitus/vilhonkatu12a-1637-2021"
    )
  })

  it("jättää kunnollisen osoitteen ennalleen", () => {
    const ok = "https://www.turku.fi/kaavoitus/kaharin-puistotie-2019-2019"
    expect(turunKaavasivunOsoite(ok)).toBe(ok)
    expect(turunKaavasivunOsoite(null)).toBeNull()
  })
})

describe("turunKaupunginosaJaOsoite (D-449)", () => {
  it("ottaa osoitteen os.-merkinnän jälkeen, vaikka kiinteistöluettelossa on pilkkuja", () => {
    expect(turunKaupunginosaJaOsoite("VI 006-23-3., -8., -1002., -2002, os. Tuureporinkatu 6b-12").address).toBe("Tuureporinkatu 6b-12")
    expect(turunKaupunginosaJaOsoite("Perno 065-40-3, os. Heinikonkatu 2")).toEqual({ district: "Perno", address: "Heinikonkatu 2" })
  })

  it("ei ota numeroa osoitteeksi, mutta kelpuuttaa sanallisen toisen osan", () => {
    expect(turunKaupunginosaJaOsoite("Lauste 026-10.-3, -8.").address).toBeNull()
    expect(turunKaupunginosaJaOsoite("Uittamo 046, Uittamon uimahallin tontti").address).toBe("Uittamon uimahallin tontti")
  })
})
