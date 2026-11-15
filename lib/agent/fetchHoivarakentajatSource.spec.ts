import { describe, expect, it } from "vitest"
import {
  RAKENTEILLA_URL,
  createHoivarakentajatEnricher,
  hoivaKohdeEhdokas,
  hoivaTyyppi,
  jasennaRakenteilla,
  jasennaTiedotteet,
  jasennaYhteystiedot,
  kayttajaOtsikosta,
  yhdistaKohteetJaTiedotteet,
} from "./fetchHoivarakentajatSource"

const kortti = (tyyppi: string, tilaaja: string, katu: string, posti: string, alkaa: string, pp: string) => `
  <li class="card"><div class="card__body">
    <span class="subheading">${tyyppi}</span>
    <h3 class="h4">${tilaaja}</h3>
    <p class="street"><span>${katu}</span><span>${posti}</span></p>
    <p><span>Toiminta alkaa ${alkaa}</span><span>Projektipäällikkö: ${pp}</span></p>
  </div></li>`

const LUETTELO = `<ul>
  ${kortti("Päiväkoti", "Norlandia", "Alustalaisentie 1", "02780 Espoo", "8/2026", "Aleksi Salmi")}
  ${kortti("Palvelukoti", "Humana", "Radiotie 9", "65370 Vaasa", "4/2027", "Mauri Heinonen")}
  ${kortti("Hoivakoti", "Norlandia Hoiva", "Äijälänkuja 4", "40640 Jyväskylä", "5/2027", "Janne Pihlajamäki")}
  ${kortti("Palvelukoti", "Aberia", "Äijälänkuja 4", "40640 Jyväskylä", "5/2027", "Janne Pihlajamäki")}
</ul>`

const YHTEYS = `
  <li class="team-member" itemscope itemtype="https://schema.org/Person">
    <span class="h5" itemprop="name"> Janne Pihlajamäki </span>
    <span itemprop="jobTitle"> Projektipäällikkö </span>
    <a itemprop="telephone" href="tel:0400847717">0400 847 717</a>
    <a itemprop="email" href="mailto:janne.pihlajamaki@hoivarakentajat.fi">janne</a>
  </li>`

const NYT = new Date("2026-11-16T12:00:00Z")

describe("jasennaRakenteilla", () => {
  it("lukee kortin kentät", () => {
    const [k] = jasennaRakenteilla(LUETTELO)
    expect(k).toEqual({
      tyyppi: "Päiväkoti",
      tilaaja: "Norlandia",
      katu: "Alustalaisentie 1",
      postinumero: "02780",
      kunta: "Espoo",
      toimintaAlkaa: "2026-08",
      projektipaallikko: "Aleksi Salmi",
    })
  })
})

describe("jasennaYhteystiedot", () => {
  it("lukee schema.org Person -merkinnän", () => {
    expect(jasennaYhteystiedot(YHTEYS).get("janne pihlajamäki")).toEqual({
      title: "Projektipäällikkö",
      phone: "0400847717",
      email: "janne.pihlajamaki@hoivarakentajat.fi",
    })
  })
})

describe("hoivaKohdeEhdokas", () => {
  const kohteet = jasennaRakenteilla(LUETTELO)
  const yhteys = jasennaYhteystiedot(YHTEYS)

  it("tuleva kohde on julkaisijan varmasti rakenteilla, projektipäällikkö yhteyshenkilöksi", () => {
    const e = hoivaKohdeEhdokas(kohteet[2], yhteys, NYT)
    expect(e.phase).toBe("Rakenteilla")
    expect(e.phase_authoritative).toBe(true)
    expect(e.estimated_completion).toBe("2027-05-01")
    expect(e.location).toBe("Äijälänkuja 4, 40640 Jyväskylä")
    expect(e.metadata.contact_persons[0]).toMatchObject({ name: "Janne Pihlajamäki", phone: "0400847717" })
  })

  /*
   * Norlandian Kurttilan päiväkoti (Espoo, 8/2026) avautui elokuussa,
   * mutta oli yhä luettelossa.
   */
  it("jo alkanutta toimintaa ei väitetä rakenteilla olevaksi", () => {
    expect(hoivaKohdeEhdokas(kohteet[0], yhteys, NYT).phase_authoritative).toBe(false)
  })
})

describe("kayttajaOtsikosta ja hoivaTyyppi", () => {
  it("lukee käyttäjän allatiivista", () => {
    expect(kayttajaOtsikosta("Tavanalle hirsirakenteinen ikäihmisten asumisyksikkö Hämeenlinnaan")).toBe("Tavana")
    expect(kayttajaOtsikosta("Hoivarakentajilta Humanalle uusi vammaispalveluyksikkö Vaasaan")).toBe("Humana")
    expect(kayttajaOtsikosta("Hoivarakentajat rakentaa Jyväskylään palvelukodit Norlandia Hoivalle ja Aberialle")).toBe(
      "Norlandia Hoiva"
    )
    expect(kayttajaOtsikosta("asumisyksikkö sairaalan lähelle")).toBeNull()
  })
  it("tyyppi otsikon kohteesta, ei sivulauseesta", () => {
    expect(hoivaTyyppi("Tavanalle asumisyksikkö Ahveniston sairaalan lähelle", "")).toBe("Hoivakoti")
    expect(hoivaTyyppi("Kurikan kaupungille uusi hirsipäiväkoti", "")).toBe("Päiväkoti")
  })
})

describe("yhdistaKohteetJaTiedotteet (D-427)", () => {
  const RSS = `<rss><channel>
    <item><title>Hoivarakentajilta Humanalle uusi vammaispalveluyksikkö Vaasaan</title>
      <link>https://hoivarakentajat.fi/tiedotteet/humana-vaasa?hsLang=fi</link>
      <description>&lt;p&gt;Hoivarakentajat rakentaa Humanalle yksikön Vaasaan.&lt;/p&gt;</description>
      <pubDate>Mon, 31 Aug 2026 07:04:42 GMT</pubDate></item>
    <item><title>Hoivarakentajat rakentaa Jyväskylään palvelukodit Norlandia Hoivalle ja Aberialle</title>
      <link>https://hoivarakentajat.fi/tiedotteet/jyvaskyla</link>
      <description>&lt;p&gt;Kaksi palvelukotia.&lt;/p&gt;</description>
      <pubDate>Tue, 12 May 2026 05:34:44 GMT</pubDate></item>
  </channel></rss>`

  const tulos = yhdistaKohteetJaTiedotteet(
    jasennaTiedotteet(RSS),
    jasennaRakenteilla(LUETTELO),
    jasennaYhteystiedot(YHTEYS),
    NYT
  )

  /*
   * Espoon kortti (toiminta alkoi 8/2026) ei tule omana rivinään:
   * ensimmäinen ajo vei sen jonoon, vaikka päiväkoti oli jo auki.
   */
  it("kortti liitetään tiedotteeseen, ja jo alkanut kortti jää pois", () => {
    expect(tulos.map((t) => t.name)).toEqual([
      "Hoivarakentajilta Humanalle uusi vammaispalveluyksikkö Vaasaan",
      "Hoivarakentajat rakentaa Jyväskylään palvelukodit Norlandia Hoivalle ja Aberialle",
    ])
  })

  it("jokaisella kortilla on oma osoite", () => {
    const osoitteet = jasennaRakenteilla(LUETTELO).map((k) => hoivaKohdeEhdokas(k, new Map(), NYT).source_url)
    expect(new Set(osoitteet).size).toBe(osoitteet.length)
    expect(osoitteet[1]).toBe(`${RAKENTEILLA_URL}#radiotie-9-vaasa-humana`)
  })

  it("tiedotteen rivi saa kortilta osoitteen, vaiheen ja linkin ilman hsLang-parametria", () => {
    const vaasa = tulos[0]
    expect(vaasa.location).toBe("Radiotie 9, 65370 Vaasa")
    expect(vaasa.phase).toBe("Rakenteilla")
    expect(vaasa.source_url).toBe("https://hoivarakentajat.fi/tiedotteet/humana-vaasa")
  })

  it("kaksi korttia samasta tiedotteesta: molemmat käyttäjät, yksi yhteyshenkilö", () => {
    const jkl = tulos[1]
    expect(jkl.metadata.related_companies).toEqual(["Norlandia Hoiva", "Aberia"])
    expect(jkl.metadata.contact_persons).toHaveLength(1)
  })
})

describe("createHoivarakentajatEnricher", () => {
  it("ei rikasta luettelon korttia luettelosivulta", async () => {
    const rikastin = createHoivarakentajatEnricher(async (c) => ({ ...c, rikastettu: true }))
    expect((await rikastin({ source_url: `${RAKENTEILLA_URL}#radiotie-9-vaasa` })).rikastettu).toBeUndefined()
    expect((await rikastin({ source_url: "https://hoivarakentajat.fi/tiedotteet/x" })).rikastettu).toBe(true)
  })

  /* Ensimmäinen ajo: rikastin laski Tavanan ja Jyväskylän suunnitteluun. */
  it("rikastus ei laske kortin vaihetta eikä hukkaa osoitetta tai yhteyshenkilöä", async () => {
    const rikastin = createHoivarakentajatEnricher(async (c) => ({
      ...c,
      phase: "Suunnittelu",
      location: null,
      metadata: { contact_persons: [{ name: "Tiedotteen yhteyshenkilö" }] },
    }))
    const r = await rikastin({
      source_url: "https://hoivarakentajat.fi/tiedotteet/x",
      phase: "Rakenteilla",
      location: "Radiotie 9, 65370 Vaasa",
      metadata: { contact_persons: [{ name: "Mauri Heinonen" }], related_companies: ["Humana"] },
    })
    expect(r.phase).toBe("Rakenteilla")
    expect(r.location).toBe("Radiotie 9, 65370 Vaasa")
    expect(r.metadata.contact_persons.map((c: any) => c.name)).toEqual(["Mauri Heinonen", "Tiedotteen yhteyshenkilö"])
  })
})
