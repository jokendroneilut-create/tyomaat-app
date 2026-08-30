import { describe, expect, it } from "vitest"

import { kiellettyOsoite } from "./kielletytLahteet"

describe("kiellettyOsoite", () => {
  it("estaa kolmen kaupungin paatosjarjestelmat", () => {
    expect(kiellettyOsoite("https://asianhallintavhp.hyvinkaa.fi/ktwebscr/epj_tek.htm")?.kaupunki).toBe("Hyvinkää")
    expect(kiellettyOsoite("https://nokia.tweb.fi/ktwebscr/pk_asil.htm")?.jarjestelma).toBe("Tweb")
    expect(kiellettyOsoite("https://mfiles.lappeenranta.fi/asiakirja/123")?.kaupunki).toBe("Lappeenranta")
  })

  /*
   * KIELTO KOSKEE PAATOSJARJESTELMAA, EI KAUPUNKIA. Lappeenrannan
   * kaavoitussivu on eri jarjestelma ja se on kaytossa.
   */
  it("ei estä kaupungin muita sivustoja", () => {
    expect(
      kiellettyOsoite("https://www.lappeenranta.fi/fi/asuminen-ja-rakentaminen/kaavoitus/asemakaavoitus/")
    ).toBeNull()
    expect(kiellettyOsoite("https://gis.vantaa.fi/geoserver/wfs")).toBeNull()
    expect(kiellettyOsoite("https://www.hyvinkaa.fi/kaavoitus/")).toBeNull()
  })

  /*
   * Hyvinkaa suositteli RSS-syotetta itse kirjallisesti kahdesti, mutta
   * lupa koskee vain syotetta - ei sen linkkien takana olevia
   * asiakirjoja, eika muuta samalta isannalta.
   */
  it("sallii Hyvinkaan syotteen vain nimenomaisesti pyydettaessa", () => {
    const syote = "https://asianhallintavhp.hyvinkaa.fi/ktwebscr/pk_rssfeed.htm?toimielin="
    expect(kiellettyOsoite(syote)).not.toBeNull()
    expect(kiellettyOsoite(syote, { salliRssSyote: true })).toBeNull()
  })

  it("ei salli asiakirjaa vaikka syote sallittaisiin", () => {
    expect(
      kiellettyOsoite("https://asianhallintavhp.hyvinkaa.fi/dokumentit/pk.pdf", { salliRssSyote: true })
    ).not.toBeNull()
  })

  /* Viallinen osoite ei saa livahtaa lapi. */
  it("ei paasta viallista osoitetta lapi", () => {
    expect(kiellettyOsoite("mfiles.lappeenranta.fi/jotain")).not.toBeNull()
    expect(kiellettyOsoite("")).toBeNull()
  })
})
