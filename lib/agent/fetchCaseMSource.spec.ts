import { describe, it, expect } from "vitest"
import { decodeEntities, extractItemText, parseSearchResults } from "./fetchCaseMSource"

describe("decodeEntities", () => {
  /*
   * CaseM palauttaa entiteetit koodattuina. Ilman purkua ääkköset jäisivät
   * muotoon "P&ouml;yt&auml;kirja" sekä kuvaukseen että täsmäytykseen.
   */
  it("purkaa suomalaiset ääkköset", () => {
    expect(decodeEntities("P&ouml;yt&auml;kirja &amp; esityslista")).toBe(
      "Pöytäkirja & esityslista"
    )
  })

  it("jättää tuntemattoman entiteetin rauhaan", () => {
    expect(decodeEntities("a &tuntematon; b")).toBe("a &tuntematon; b")
  })
})

describe("extractItemText", () => {
  /*
   * Murupolku antaa kokouspäivän, jota käytetään tuoreusrajaan. Ensimmäinen
   * versio katkaisi tekstin merkkijonosta "Toimielimet >", jota asiasivulla
   * ei ole - kuvaus alkoi silloin murupolulla.
   */
  it("poimii kokouspäivän murupolusta", () => {
    const html =
      "<p>Asunto- ja kiinteist&ouml;lautakunta &gt; Kokous 7.9.2022 &gt; " +
      "Nekalan koulun sis&auml;ilmakorjaus. " +
      "Hankkeen tavoitteena on korjata koulun sis&auml;ilmaongelmat ja muuttaa tilat kulttuurikäyttöön.</p>"
    const r = extractItemText(html)
    expect(r.meetingDate?.getFullYear()).toBe(2022)
    expect(r.meetingDate?.getMonth()).toBe(8)
    expect(r.text).not.toMatch(/Kokous 7\.9\.2022/)
  })

  it("palauttaa null liian lyhyestä tekstistä", () => {
    expect(extractItemText("<p>Lyhyt</p>").text).toBeNull()
  })
})

describe("parseSearchResults", () => {
  it("poimii polun ja otsikon samasta linkistä", () => {
    const html =
      '<a href="/fi-FI/content/278564/23">Nekalan koulun sis&auml;ilmakorjaus</a>'
    expect(parseSearchResults(html)).toEqual([
      { path: "/fi-FI/content/278564/23", title: "Nekalan koulun sisäilmakorjaus" },
    ])
  })
})
