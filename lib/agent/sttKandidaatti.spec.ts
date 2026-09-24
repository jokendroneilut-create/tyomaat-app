import { describe, expect, it } from "vitest"

import { sttKandidaatti } from "./fetchSttHakuSource"

/*
 * Muunnos on jaettu kahden STT-lahteen kesken (hakusanahaku ja
 * julkaisijasyote, D-211). Testit kohdistuvat siihen eivatka hakuun:
 * juuri suodattimet ovat se osa jota ei saa kahdentaa.
 */
const tiedote = (yli: any = {}) => ({
  id: "72327509",
  date: "2026-09-17T08:15:00Z",
  publisher: { name: "Kreate Group Oyj", id: "69818424" },
  versions: {
    fi: {
      title: "Kreate voitti Ouluntien tasoristeysten poistourakan Kemissa",
      url: "/tiedote/72327509/kreate-voitti-ouluntien",
      metadescription:
        "Kreate on allekirjoittanut sopimuksen Kemissa sijaitsevasta urakasta.",
      ...yli,
    },
  },
})

const perus = { cutoffDate: null, sourceName: "stt_julkaisijat" }

describe("sttKandidaatti", () => {
  it("poimii otsikon, kuvauksen ja kaupungin", () => {
    const k = sttKandidaatti(tiedote(), perus)
    expect(k?.name).toContain("Ouluntien tasoristeysten")
    expect(k?.city).toBe("Kemi")
    expect(k?.source_url).toBe(
      "https://www.sttinfo.fi/tiedote/72327509/kreate-voitti-ouluntien"
    )
    expect(k?.source_name).toBe("stt_julkaisijat")
  })

  /* Lahteen nimi tulee kutsujalta, jotta sama muunnos kelpaa molemmille. */
  it("merkitsee lahteen kutsujan mukaan", () => {
    expect(sttKandidaatti(tiedote(), { ...perus, sourceName: "stt_haku" })?.source_name).toBe(
      "stt_haku"
    )
  })

  it("hylkaa tiedotteen jossa ei ole rakentamissignaalia", () => {
    const k = sttKandidaatti(
      tiedote({
        title: "Kreatelle uusi talousjohtaja",
        metadescription: "Tehtava alkaa lokakuussa.",
      }),
      perus
    )
    expect(k).toBeNull()
  })

  it("hylkaa talousviestinnan", () => {
    const k = sttKandidaatti(
      tiedote({
        title: "Kreate Group Oyj:n osavuosikatsaus tammi-kesakuu",
        metadescription: "Liikevaihto kasvoi rakennusurakoiden ansiosta.",
      }),
      perus
    )
    expect(k).toBeNull()
  })

  it("noudattaa tuoreusrajaa kun se on annettu", () => {
    const raja = new Date("2026-09-18T00:00:00Z")
    expect(sttKandidaatti(tiedote(), { ...perus, cutoffDate: raja })).toBeNull()
    expect(sttKandidaatti(tiedote(), { ...perus, cutoffDate: null })).not.toBeNull()
  })

  it("hylkaa tiedotteen jolta puuttuu otsikko tai osoite", () => {
    expect(sttKandidaatti(tiedote({ title: "" }), perus)).toBeNull()
    expect(sttKandidaatti(tiedote({ url: "" }), perus)).toBeNull()
  })

  /* Valmistumisesta kertova tiedote on paivitys, ei uusi hanke. */
  it("tunnistaa valmistuneen", () => {
    const k = sttKandidaatti(
      tiedote({
        title: "Jatkeen urakoima Keilaniemen Portti on nyt valmis Espoossa",
        metadescription: "Toimitilarakennus valmistui aikataulussa.",
      }),
      perus
    )
    expect(k?.completed).toBe(true)
    expect(k?.phase).toBe("Valmistunut")
  })
})
