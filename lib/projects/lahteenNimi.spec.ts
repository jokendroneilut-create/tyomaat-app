import { describe, expect, it } from "vitest"

import { lahteenNimi } from "./lahteenNimi"

describe("lahteenNimi", () => {
  it("kaantaa tunnisteen nimeksi", () => {
    expect(lahteenNimi("helsinki_paatokset")).toBe("Helsingin kaupungin päätökset")
    expect(lahteenNimi("ysaatio")).toBe("Y-Säätiö")
    expect(lahteenNimi("datakeskusrekisteri")).toBe(
      "Datakeskushankkeiden kansallinen rekisteri"
    )
  })

  /*
   * Kuntien kaavakeraajat kirjaavat jo valmiin nimen. Jos tama menisi
   * siistimisen lapi, "(SUKKA)" ja isot alkukirjaimet rikkoutuisivat.
   */
  it("palauttaa valmiin nimen sellaisenaan", () => {
    const valmis = "Helsingin vireillä olevat asemakaavat (SUKKA)"
    expect(lahteenNimi(valmis)).toBe(valmis)
    expect(lahteenNimi("Lupapiste kuulutukset")).toBe("Lupapiste kuulutukset")
    expect(lahteenNimi("Hilma")).toBe("Hilma")
  })

  /*
   * TARKEIN TESTI: tuntematon tunniste ei saa paasta lapi raakana.
   * Unohtunut kartan rivi nakyisi muuten asiakkaalle alaviivoineen.
   */
  it("siistii tuntemattoman tunnisteen eika jata sita raakana", () => {
    expect(lahteenNimi("rajukivi")).toBe("Rajukivi")
    expect(lahteenNimi("uusi_yritys_oy")).toBe("Uusi yritys oy")
    expect(lahteenNimi("uusi_yritys_oy")).not.toContain("_")
  })

  it("antaa saman nimen kerääjän eri muunnelmille", () => {
    expect(lahteenNimi("skanska")).toBe(lahteenNimi("skanska_projektit"))
    expect(lahteenNimi("bonava")).toBe(lahteenNimi("bonava_kohteet"))
    expect(lahteenNimi("lapti")).toBe(lahteenNimi("lapti_kohteet"))
    expect(lahteenNimi("stt_haku")).toBe(lahteenNimi("stt_julkaisijat"))
  })

  /* Lyhenteet eivat synny siistimisella. */
  it("kirjoittaa lyhenteet oikein", () => {
    expect(lahteenNimi("srv")).toBe("SRV")
    expect(lahteenNimi("yit")).toBe("YIT")
    expect(lahteenNimi("grk_projektit")).toBe("GRK")
    expect(lahteenNimi("yva")).toBe("Ympäristövaikutusten arviointi (YVA)")
  })

  /* Tyotapa on meidan sisainen asia, ei asiakkaan. */
  it("ei kerro omaa tyotapaa asiakkaalle", () => {
    expect(lahteenNimi("kasin_kuvakaappaus")).toBe("Työmaat.fi:n oma tiedonkeruu")
    expect(lahteenNimi("kasin_kuvakaappaus")).not.toMatch(/kuvakaappaus/i)
  })

  /*
   * Nama oli ensin arvattu siistimalla ja menivat vaarin: tunniste on
   * tappanut aantiomerkit ja lyhentanyt nimen. Oikeat nimet luettiin
   * `discovery_sources.name`-sarakkeesta.
   */
  it("kayttaa rekisterin kirjoittamaa nimea, ei siistittya tunnistetta", () => {
    expect(lahteenNimi("pelti_assat")).toBe("Pelti-Ässät")
    expect(lahteenNimi("marttilan")).toBe("Marttilan Rakennus")
    expect(lahteenNimi("aura")).toBe("Aura Rakennus")
    expect(lahteenNimi("hc_hoivakodit")).toBe("HC Hoivakodit")
  })

  it("kestaa tyhjan", () => {
    expect(lahteenNimi(null)).toBeNull()
    expect(lahteenNimi(undefined)).toBeNull()
    expect(lahteenNimi("")).toBeNull()
    expect(lahteenNimi("   ")).toBeNull()
  })

  it("ei valita kirjainkoosta tunnisteessa", () => {
    expect(lahteenNimi("SRV")).toBe("SRV")
    expect(lahteenNimi("Datakeskusrekisteri")).toBe(
      "Datakeskushankkeiden kansallinen rekisteri"
    )
  })
})
