import { describe, expect, it } from "vitest"

import { katkaiseArvo, senaatinOsapuolet, senaatinTekijat } from "./senaattiTekijat"
import { looksLikeCompany } from "./companyName"

/* Senaatin oma muoto, GTK Mintecin sivulta 27.10.2026. */
const SIVU = `
<p>[vc_column_text]</p>
<h2>Hankkeen aikataulu</h2>
<p><strong>Kustannukset: </strong>Noin 23 milj. euroa</p>
<h2>Tekijät</h2>
<p><strong>Käyttäjä: </strong>Geologian tutkimuskeskus, GTK Mintec</p>
<p><strong>Rakennuttaja: </strong>Senaatti-kiinteistöt</p>
<p><strong>Rakennuttajapäällikkö: </strong>Outi Hiltunen</p>
<p><strong>Rakennuttajakonsultti: </strong>A-insinöörit Rakennuttaminen Oy</p>
<p><strong>Pääurakoitsija / Päätoteuttaja: </strong>Rakennustyö Salminen Oy</p>
<p><strong>Pää- ja arkkitehtisuunnittelu: </strong>Uki Arkkitehdit Oy</p>
<p><strong>Rakennesuunnittelu: </strong>Ramboll Finland Oy</p>
<p><strong>LVIA-suunnittelu</strong>: Ramboll Finland Oy</p>
<p><strong>Sähkösuunnittelu: </strong>Ramboll Finland Oy[/vc_column_text][project_news category=&#8221;15454&#8243;]</p>
<h2>Lue myös</h2>
<p><strong>Linkki: </strong>Ei kuulu tekijöihin</p>
`

describe("senaatinTekijat", () => {
  const tekijat = senaatinTekijat(SIVU)

  it("lukee jokaisen rivin roolin ja nimen", () => {
    expect(tekijat).toHaveLength(9)
    expect(tekijat[0]).toEqual({ rooli: "Käyttäjä", nimi: "Geologian tutkimuskeskus, GTK Mintec" })
  })

  it("kestää kaksoispisteen <strong>:in ulkopuolella", () => {
    expect(tekijat.find((t) => t.rooli === "LVIA-suunnittelu")?.nimi).toBe("Ramboll Finland Oy")
  })

  it("katkaisee shortcoden viimeisestä rivistä", () => {
    expect(tekijat.at(-1)).toEqual({ rooli: "Sähkösuunnittelu", nimi: "Ramboll Finland Oy" })
  })

  it("ei lue seuraavan otsikon alta eikä edeltä", () => {
    expect(tekijat.some((t) => t.rooli === "Linkki")).toBe(false)
    expect(tekijat.some((t) => t.rooli === "Kustannukset")).toBe(false)
  })

  it("kestää sivun ilman tekijälohkoa", () => {
    expect(senaatinTekijat("<p>Ei lohkoa</p>")).toEqual([])
    expect(senaatinTekijat(null)).toEqual([])
  })
})

describe("senaatinOsapuolet", () => {
  const { kentat, liittyvat, henkilot } = senaatinOsapuolet(senaatinTekijat(SIVU), looksLikeCompany)

  it("vie roolit omiin sarakkeisiinsa", () => {
    expect(kentat).toEqual({
      developer: "Senaatti-kiinteistöt",
      builder: "Rakennustyö Salminen Oy",
      architectural_design: "Uki Arkkitehdit Oy",
      structural_design: "Ramboll Finland Oy",
      hvac_design: "Ramboll Finland Oy",
      electrical_design: "Ramboll Finland Oy",
    })
  })

  it("ei toista sarakkeen arvoa liittyvissä yrityksissä", () => {
    expect(liittyvat).not.toContain("Ramboll Finland Oy")
    expect(liittyvat).not.toContain("Rakennustyö Salminen Oy")
  })

  it("vie sarakkeettoman roolin liittyviin yrityksiin", () => {
    expect(liittyvat).toContain("A-insinöörit Rakennuttaminen Oy")
    expect(liittyvat).toContain("Geologian tutkimuskeskus, GTK Mintec")
  })

  it("erottaa henkilön yrityksestä", () => {
    expect(henkilot).toEqual([{ rooli: "Rakennuttajapäällikkö", nimi: "Outi Hiltunen" }])
  })

  it("ei vie henkilönimeä yrityskenttään", () => {
    const { liittyvat: l, henkilot: h } = senaatinOsapuolet(
      [{ rooli: "Rakennuttajakonsultti", nimi: "Kimmo Puttonen" }],
      looksLikeCompany
    )
    expect(l).toEqual([])
    expect(h).toEqual([{ rooli: "Rakennuttajakonsultti", nimi: "Kimmo Puttonen" }])
  })

  it("lukee lähteen oman kirjoitusvirheen", () => {
    const { kentat: k } = senaatinOsapuolet(
      [{ rooli: "Rakennesuunittelu", nimi: "Sweco Finland Oy" }],
      looksLikeCompany
    )
    expect(k.structural_design).toBe("Sweco Finland Oy")
  })
})

describe("monta osahanketta samalla sivulla (D-355)", () => {
  /* Immolan kasarmialue: kolme osahanketta, kolme pääurakoitsijaa. */
  const tekijat = [
    { rooli: "Pääurakoitsija", nimi: "Kuormaus ja kuljetusliike Jurvanen Ky" },
    { rooli: "Pääurakoitsija", nimi: "Pallas Rakennus Kaakkois-Suomi Oy" },
    { rooli: "Pääurakoitsija", nimi: "Rakennusliike Evälahti Oy" },
    { rooli: "Pääsuunnittelu", nimi: "Arkkitehtitoimisto Arkviiri Oy" },
    { rooli: "Pääsuunnittelu", nimi: "Arkkitehtitoimisto Arkviiri Oy" },
  ]
  const { kentat, liittyvat, monta } = senaatinOsapuolet(tekijat, looksLikeCompany)

  it("ei arvaa kumpi monesta on hankkeen rakentaja", () => {
    expect(kentat.builder).toBeUndefined()
    expect(monta).toContain("builder")
  })

  it("vie kaikki vaihtoehdot liittyviin yrityksiin", () => {
    expect(liittyvat).toContain("Kuormaus ja kuljetusliike Jurvanen Ky")
    expect(liittyvat).toContain("Rakennusliike Evälahti Oy")
  })

  it("sama arvo kahdesti ei ole monta", () => {
    expect(kentat.architectural_design).toBe("Arkkitehtitoimisto Arkviiri Oy")
    expect(monta).not.toContain("architectural_design")
  })

  it("katkaisee sulkulausekkeen", () => {
    const { kentat: k } = senaatinOsapuolet(
      [{ rooli: "Pääurakoitsija", nimi: katkaiseArvo("YIT Business Premises Oy (ent. YIT Suomi Oy)") }],
      looksLikeCompany
    )
    expect(k.builder).toBe("YIT Business Premises Oy")
  })
})
