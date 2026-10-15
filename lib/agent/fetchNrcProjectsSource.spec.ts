import { describe, expect, it } from "vitest"

import {
  jasennaHankesivu,
  jasennaListaus,
  onKaynnissa,
} from "./fetchNrcProjectsSource"

/*
 * Katkelmat ovat aidosta rakenteesta (nrcgroup.fi 15.10.2026), riisuttuna
 * olennaiseen. Sivu on Craft CMS + Next.js, joten hankkeet ovat
 * `__NEXT_DATA__`-JSONissa eivätkä HTML:ssä.
 */
function sivu(apolloState: Record<string, unknown>): string {
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    { props: { pageProps: { apolloState } } }
  )}</script></body></html>`
}

const LISTAUS = sivu({
  'hero_hero_BlockType:{"id":"1"}': { __typename: "hero_hero_BlockType", moduleTitle: "Turun Raitiotieallianssi" },
  'hero_hero_BlockType:{"id":"2"}': { __typename: "hero_hero_BlockType", moduleTitle: "Vanha siltaurakka" },
  'projectItems_default_Entry:{"id":"10"}': {
    __typename: "projectItems_default_Entry",
    slug: "turun-raitiotieallianssi",
    url: "https://www.nrcgroup.fi/projektit/turun-raitiotieallianssi",
    plainText: "Turku",
    plainText2: "Käynnissä",
    hero: [{ __ref: 'hero_hero_BlockType:{"id":"1"}' }],
  },
  'projectItems_default_Entry:{"id":"11"}': {
    __typename: "projectItems_default_Entry",
    slug: "vanha-siltaurakka",
    url: "https://www.nrcgroup.fi/projektit/vanha-siltaurakka",
    plainText: "Kouvola",
    plainText2: "Valmis",
    hero: [{ __ref: 'hero_hero_BlockType:{"id":"2"}' }],
  },
})

describe("jasennaListaus", () => {
  it("lukee hankkeet upotetusta JSONista", () => {
    const hankkeet = jasennaListaus(LISTAUS)
    expect(hankkeet).toHaveLength(2)
  })

  it("ottaa otsikon hero-viitteen takaa", () => {
    const [eka] = jasennaListaus(LISTAUS)
    expect(eka.otsikko).toBe("Turun Raitiotieallianssi")
    expect(eka.kaupunki).toBe("Turku")
    expect(eka.tila).toBe("Käynnissä")
  })

  it("ei kaadu kun sivu ei ole NRC:n", () => {
    expect(jasennaListaus("<html><body>ei dataa</body></html>")).toEqual([])
  })
})

describe("onKaynnissa", () => {
  it("hyvaksyy kaynnissa olevat ja alkavat", () => {
    expect(onKaynnissa("Käynnissä")).toBe(true)
    expect(onKaynnissa("Alkava")).toBe(true)
    expect(onKaynnissa("käynnissä ")).toBe(true)
  })

  it("hylkaa valmiit", () => {
    /* Valmistunut referenssi ei ole mahdollisuus — sama kuin GRK:lla. */
    expect(onKaynnissa("Valmis")).toBe(false)
    expect(onKaynnissa("Valmistunut")).toBe(false)
    expect(onKaynnissa(null)).toBe(false)
  })
})

/*
 * Tämä on sen virheen testi joka jäi kiinni vasta kuivaharjoituksessa:
 * jokaisen hankesivun JSON sisältää MYÖS muiden hankkeiden tekstit
 * ("Tutustu myös näihin"), ja kaikki lukemalla Turun raitiotie sai
 * kuvaukseksi Mäkelänkadun ajojohtojärjestelmän. Näytti uskottavalta,
 * oli väärä hanke.
 */
const HANKESIVU = sivu({
  'modules_text_BlockType:{"id":"20"}': {
    __typename: "modules_text_BlockType",
    moduleTitle: "Mitä teemme",
    text: "<p>Olemme mukana Turun Raitiotieallianssissa, jossa rakennamme raitiotietä satamasta Varissuolle.</p>",
  },
  'modules_projects_BlockType:{"id":"21"}': {
    __typename: "modules_projects_BlockType",
    moduleTitle: "Tutustu myös näihin",
    text: "<p>Mäkelänkadun ajojohtojärjestelmän uusiminen Helsingissä.</p>",
  },
  'projectItems_default_Entry:{"id":"10"}': {
    __typename: "projectItems_default_Entry",
    slug: "turun-raitiotieallianssi",
    url: "https://www.nrcgroup.fi/projektit/turun-raitiotieallianssi",
    'modules({"level":1})': [
      { __ref: 'modules_text_BlockType:{"id":"20"}' },
      { __ref: 'modules_projects_BlockType:{"id":"21"}' },
    ],
  },
  /* Toisen hankkeen teksti samassa välimuistissa — ei saa vuotaa. */
  'modules_text_BlockType:{"id":"99"}': {
    __typename: "modules_text_BlockType",
    text: "<p>Kokonaan toisen hankkeen teksti Oulusta.</p>",
  },
})

describe("jasennaHankesivu", () => {
  it("lukee vain sivun oman merkinnan tekstit", () => {
    const teksti = jasennaHankesivu(
      HANKESIVU,
      "https://www.nrcgroup.fi/projektit/turun-raitiotieallianssi"
    )
    expect(teksti).toContain("Turun Raitiotieallianssissa")
    expect(teksti).not.toContain("toisen hankkeen teksti")
  })

  it("jattaa 'Tutustu myos naihin' -nostot pois", () => {
    const teksti = jasennaHankesivu(
      HANKESIVU,
      "https://www.nrcgroup.fi/projektit/turun-raitiotieallianssi"
    )
    expect(teksti).not.toContain("Mäkelänkadun")
  })

  it("riisuu HTML-tagit", () => {
    const teksti = jasennaHankesivu(
      HANKESIVU,
      "https://www.nrcgroup.fi/projektit/turun-raitiotieallianssi"
    )
    expect(teksti).not.toContain("<p>")
  })

  it("lukee slugin osoitteesta oikein", () => {
    /*
     * Tama oli vika: merkkiluokka [/?#] katkaisi osoitteen ensimmaiseen
     * kauttaviivaan ja slugiksi tuli "https:", jolloin yhtaan hanketta
     * ei loytynyt.
     */
    const teksti = jasennaHankesivu(
      HANKESIVU,
      "https://www.nrcgroup.fi/projektit/turun-raitiotieallianssi?utm=1#kohta"
    )
    expect(teksti).toContain("Turun Raitiotieallianssissa")
  })

  it("palauttaa tyhjan kun sivua ei tunnisteta", () => {
    expect(jasennaHankesivu(HANKESIVU, "https://www.nrcgroup.fi/projektit/joku-muu")).toBe("")
    expect(jasennaHankesivu("<html></html>", "https://x/y/z")).toBe("")
  })
})
