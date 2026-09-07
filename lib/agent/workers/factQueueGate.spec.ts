import { describe, expect, it } from "vitest"

import { isProcessable, isTerminal, onJsonLahde } from "./factQueueGate"

/*
 * JONO SEISOI TASAN 70:SSA VIIDEN PERAKKAISEN AJON AJAN (7.9.2026).
 *
 * Kaikilla 70:lla oli sisalto ja kaikki olisivat tuottaneet faktoja,
 * mutta niiden lahteet eivat olleet kasin yllapidetylla
 * JSON_ONLY_SOURCES-listalla. Ne eivat siis olleet kasiteltavia eivatka
 * terminaalisia -> ikuinen jono. Tama testi lukitsee sen etta
 * tunnistus nojaa `document_type`-sarakkeeseen eika nimilistaan.
 */
describe("faktatyontekijan portti", () => {
  const apiDokumentti = {
    source_name: "Lahden Talot tiedotteet",
    document_type: "api",
    extracted_text: null,
    raw_text: '{"id":905806,"title":"Pohjoinen Liipolankatu 14"}',
    raw_payload: { original: { id: 905806 }, parser: "foundationReleaseParser" },
  }

  it("tunnistaa api-dokumentin json-lahteeksi ilman nimilistaa", () => {
    expect(onJsonLahde(apiDokumentti)).toBe(true)
    expect(isProcessable(apiDokumentti)).toBe(true)
    expect(isTerminal(apiDokumentti)).toBe(false)
  })

  it("tunnistaa listatun json-lahteen edelleen", () => {
    const hilma = {
      source_name: "Hilma",
      document_type: "json",
      extracted_text: null,
      raw_payload: { original: { id: 1 } },
    }
    expect(onJsonLahde(hilma)).toBe(true)
    expect(isProcessable(hilma)).toBe(true)
  })

  /* Sisallon puute on eri asia kuin vaara haara. */
  it("merkitsee sisallottoman api-dokumentin terminaaliksi", () => {
    const tyhja = { ...apiDokumentti, raw_text: null, raw_payload: {} }
    expect(isProcessable(tyhja)).toBe(false)
    expect(isTerminal(tyhja)).toBe(true)
  })

  it("kayttaa html-lahteella extracted_textia", () => {
    const html = {
      source_name: "Rakennuslehti",
      document_type: "html",
      extracted_text: "Hanke etenee Tampereella.",
      raw_text: "<html>roskaa</html>",
    }
    expect(onJsonLahde(html)).toBe(false)
    expect(isProcessable(html)).toBe(true)
  })

  /* Haettu html-sivu ilman tekstia on terminaali, ei ikuinen jono. */
  it("merkitsee haetun tyhjan html-sivun terminaaliksi", () => {
    const html = {
      source_name: "Rakennuslehti",
      document_type: "html",
      extracted_text: null,
      raw_payload: { articleFetchedAt: "2026-09-01T00:00:00Z" },
    }
    expect(isTerminal(html)).toBe(true)
  })

  it("ei merkitse viela hakematonta pdf:aa terminaaliksi", () => {
    expect(isTerminal({ source_name: "X", document_type: "pdf", extracted_text: null })).toBe(false)
    expect(isTerminal({ source_name: "X", document_type: "pdf", extracted_text: "" })).toBe(true)
  })
})
