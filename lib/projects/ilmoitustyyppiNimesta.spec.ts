import { describe, expect, it } from "vitest"
import { poistaIlmoitustyyppi } from "./ilmoitustyyppiNimesta"

describe("poistaIlmoitustyyppi (D-448)", () => {
  it("poistaa ilmoitustyypit alusta, myös useita peräkkäin", () => {
    expect(poistaIlmoitustyyppi("JÄLKI-ILMOITUS: Osallistumispyyntö: Malmin uusi sairaala, perhekeskus")).toBe("Malmin uusi sairaala, perhekeskus")
    expect(poistaIlmoitustyyppi("Kutsu markkinavuoropuheluun - Karhunaukion kaava-alueen rakennusurakka")).toBe("Karhunaukion kaava-alueen rakennusurakka")
    expect(poistaIlmoitustyyppi("TIETOPYYNTÖ MARKKINAKARTOITUSTA JA -VUOROPUHELUA VARTEN / Porin kauppatorin uudistaminen")).toBe("Porin kauppatorin uudistaminen")
    expect(poistaIlmoitustyyppi("JÄLKI-ILMOITUS KILPAILUTUKSEEN 272/02.06.00/2026 / Mäntsälän kunta, aurinkovoimalat")).toBe("Mäntsälän kunta, aurinkovoimalat")
    expect(poistaIlmoitustyyppi("Ennakkoilmoitus (2. julkaisu), Talin jalkapallohallin perusparannus")).toBe("Talin jalkapallohallin perusparannus")
  })

  it("poistaa ilmoitustyypin lopusta erottimen jälkeen", () => {
    expect(poistaIlmoitustyyppi("HERI2 Nuppulinna-Jokela RU2 ja Hyvinkää-Riihimäki esikuormitukset, osallistumispyyntö")).toBe("HERI2 Nuppulinna-Jokela RU2 ja Hyvinkää-Riihimäki esikuormitukset")
    expect(poistaIlmoitustyyppi("Nakkilan kirkon perusparannus, sisätilojen korjaustyöt - ennakkoilmoitus tarjouspyynnöstä")).toBe("Nakkilan kirkon perusparannus, sisätilojen korjaustyöt")
    expect(poistaIlmoitustyyppi("Ennakkoilmoitus, Siltateeman toteutuskohteet 2027, markkinavuoropuhelu")).toBe("Siltateeman toteutuskohteet 2027")
  })

  it("isontaa alkukirjaimen ja yhdistää välilyönnit", () => {
    expect(poistaIlmoitustyyppi("Urakkatarjouspyyntö uusi päiväkoti Nurmes")).toBe("Uusi päiväkoti Nurmes")
    expect(poistaIlmoitustyyppi("JÄLKI-ILMOITUS / EE-Rakennus, talotekniikka ja  energiatehokkuus")).toBe("EE-Rakennus, talotekniikka ja energiatehokkuus")
  })

  it("ei koske sanaan keskellä nimeä eikä keskeytykseen", () => {
    expect(poistaIlmoitustyyppi("Tarkk’ampujankuja 1B, Julkisivun maalauksen jälki-ilmoitus")).toBe("Tarkk’ampujankuja 1B, Julkisivun maalauksen jälki-ilmoitus")
    expect(poistaIlmoitustyyppi("KESKEYTYS: Vuosaaren Urheilutalo, allashallin korjaustyöt")).toBe("KESKEYTYS: Vuosaaren Urheilutalo, allashallin korjaustyöt")
    expect(poistaIlmoitustyyppi("Kutsuntatalon peruskorjaus")).toBe("Kutsuntatalon peruskorjaus")
  })

  it("palauttaa alkuperäisen, jos kohteen nimeä ei jää", () => {
    expect(poistaIlmoitustyyppi("Tarjouspyyntö")).toBe("Tarjouspyyntö")
    expect(poistaIlmoitustyyppi(null)).toBe("")
  })
})

describe("poistaIlmoitustyyppi ei koske nimiin ilman ilmoitustyyppiä", () => {
  it("jättää pienen alkukirjaimen ja reunojen välimerkit ennalleen", () => {
    expect(poistaIlmoitustyyppi("atNorth FIN04, Myllykoski")).toBe("atNorth FIN04, Myllykoski")
    expect(poistaIlmoitustyyppi("wpd investoi ensimmäiseen akkuvarastohankkeeseensa Suomessa")).toBe("wpd investoi ensimmäiseen akkuvarastohankkeeseensa Suomessa")
    expect(poistaIlmoitustyyppi("KAUKOLÄMPÖVERKON RAKENTAMISEN VUOSIURAKKA 2026 -")).toBe("KAUKOLÄMPÖVERKON RAKENTAMISEN VUOSIURAKKA 2026 -")
  })
})
