import { describe, expect, it } from "vitest"
import { fcdcEhdokas, fcdcVaihe, jasennaFcdcUutinen, onHankeuutinen, yhtenaistaSahkopostit } from "./fetchFcdcSource"

/* Framer-sivun rakenne: h1, <time>-päivä, kappaleet, Lisätietoja, "lisää uutisia" -päivät. */
const sivu = (otsikko: string, runko: string[], yhteys: string[]) => `
<html><body>
<nav><p>Why Finland</p><p>News</p></nav>
<h1>${otsikko}</h1>
<p><time datetime="2026-11-18T00:00:00.000Z">18.11.2026</time></p>
${runko.map((r) => `<p>${r}</p>`).join("\n")}
<p><strong>Lisätietoja:</strong></p>
${yhteys.join("\n")}
<p><time datetime="2026-11-12T00:00:00.000Z">12.11.2026</time></p>
<p>FCDC Corp Oy maksoi 10,6 miljoonaa euroa yhteisöveroa</p>
<p>Helsinki</p>
</body></html>`

const KERAVA = sivu(
  "FCDC:n Keravan datakeskushanke sai rakentamisluvan",
  ["Keravalle suunniteltu datakeskushanke on ottanut merkittävän askeleen eteenpäin, kun hankkeelle myönnettiin rakentamislupa 16. marraskuuta 2026.", "Rakennustyöt on tavoitteena käynnistää vuoden 2027 aikana."],
  ['<p><strong>Jaakko Leinonen</strong><br>maanhankinta- ja kehitysjohtaja, partneri<br>FCDC Corp Oy<br>p. <a href="tel:+358505187826">050 518 7826</a></p>']
)

const AKAA = sivu(
  "Akaan kaupunki on myöntänyt rakennusluvan FCDC:n datakeskushankkeelle",
  ["Akaan kaupunki on myöntänyt rakennusluvan FCDC Corp Oy:n datakeskushankkeelle Akaa Point -yritysalueella."],
  [
    '<p>Akaan kaupunki<br><strong>Lasse Silván</strong><br>Kaupunkikehitysjohtaja<br><a href="tel:+35840">040 335 3207</a><br><a href="mailto:lasse.silvan@akaa.fi">lasse.silvan@akaa.fi</a></p>',
    "<p><br></p>",
    '<p>FCDC Corp Oy<br><strong>Joonas Viita-aho</strong><br><a href="mailto:joonas@fcdc.fi">joonas@fcdc.fi</a></p>',
  ]
)

describe("jasennaFcdcUutinen", () => {
  it("otsikko, päivä, runko ja yhteyshenkilö; lisää uutisia -lista ei vuoda", () => {
    const u = jasennaFcdcUutinen(KERAVA, "https://www.fcdc.fi/news/kerava")!
    expect(u.otsikko).toBe("FCDC:n Keravan datakeskushanke sai rakentamisluvan")
    expect(u.julkaistu).toBe("2026-11-18")
    expect(u.runko).toContain("Rakennustyöt on tavoitteena käynnistää vuoden 2027 aikana.")
    expect(u.runko).not.toContain("yhteisöveroa")
    expect(u.yhteyshenkilot).toEqual([
      { kind: "person", name: "Jaakko Leinonen", title: "Maanhankinta- ja kehitysjohtaja, partneri", organization: "FCDC Corp Oy", phone: "050 518 7826", email: null, role: null },
    ])
  })

  it("organisaatio nimeä edeltävällä rivillä, kaksi henkilöä", () => {
    const u = jasennaFcdcUutinen(AKAA, "https://www.fcdc.fi/news/akaa")!
    expect(u.yhteyshenkilot.map((h) => [h.name, h.title, h.organization, h.phone, h.email])).toEqual([
      ["Lasse Silván", "Kaupunkikehitysjohtaja", "Akaan kaupunki", "040 335 3207", "lasse.silvan@akaa.fi"],
      ["Joonas Viita-aho", null, "FCDC Corp Oy", null, "joonas@fcdc.fi"],
    ])
  })
})

describe("yhtenaistaSahkopostit", () => {
  it("julkaisijan verkkotunnus voittaa tasapelin ja täydentää puuttuvan", () => {
    const h = (email: string | null) => ({ kind: "person" as const, name: "Jaakko Leinonen", title: null, organization: null, phone: null, email, role: null })
    const uutiset = [
      { url: "a", otsikko: "a", julkaistu: null, runko: "", yhteyshenkilot: [h("jaakko.leinonen@fcd.fi")] },
      { url: "b", otsikko: "b", julkaistu: null, runko: "", yhteyshenkilot: [h("jaakko.leinonen@fcdc.fi")] },
      { url: "c", otsikko: "c", julkaistu: null, runko: "", yhteyshenkilot: [h(null)] },
    ]
    yhtenaistaSahkopostit(uutiset)
    expect(uutiset.map((u) => u.yhteyshenkilot[0].email)).toEqual(["jaakko.leinonen@fcdc.fi", "jaakko.leinonen@fcdc.fi", "jaakko.leinonen@fcdc.fi"])
    expect(uutiset[1].yhteyshenkilot[0].organization).toBe("FCDC Corp Oy")
  })
})

describe("onHankeuutinen ja ehdokas", () => {
  it("yhtiötiedote ilman hanketta ohitetaan", () => {
    expect(onHankeuutinen({ url: "x", otsikko: "FCDC Corp Oy maksoi 10,6 miljoonaa euroa yhteisöveroa", julkaistu: null, runko: "Datakeskuksia Keravalla.", yhteyshenkilot: [] })).toBe(false)
  })

  it("taivutettu kunta tunnistetaan (Huittisiin)", () => {
    const u = { url: "x", otsikko: "FCDC Corp Oy suunnittelee datakeskushanketta Huittisiin", julkaistu: null, runko: "Hanke sijoittuisi Raumantien läheisyyteen.", yhteyshenkilot: [] }
    expect(onHankeuutinen(u)).toBe(true)
    expect(fcdcEhdokas(u).city).toBe("Huittinen")
  })

  it("Kerava: datakeskus, FCDC rakennuttajana", () => {
    const e = fcdcEhdokas(jasennaFcdcUutinen(KERAVA, "https://www.fcdc.fi/news/kerava")!)
    expect([e.city, e.developer, e.property_type, e.phase]).toEqual(["Kerava", "FCDC Corp Oy", "Datakeskus", "Rakennuslupa"])
  })
})

describe("fcdcVaihe", () => {
  it("myönnetty lupa on Rakennuslupa, haettu ei", () => {
    expect(fcdcVaihe("Akaan kaupunki on myöntänyt rakennusluvan FCDC:n datakeskushankkeelle", "")).toBe("Rakennuslupa")
    expect(fcdcVaihe("Vaasan datakeskushankkeelle rakentamislupa", "")).toBe("Rakennuslupa")
    expect(fcdcVaihe("Vaasan datakeskushankkeelle haetaan rakentamislupaa", "")).not.toBe("Rakennuslupa")
  })
})
