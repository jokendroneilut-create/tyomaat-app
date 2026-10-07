import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { lapaiseeSuodatuksen, PELTI_ASSAT } from "./fetchPeltiAssatSource"
import { jasennaRss, sivuurakoitsijanEhdokas } from "./sivuurakoitsijaRss"

/*
 * Otsikot ovat Pelti-Assien oikeita julkaisuja 8.10.2026 mitatusta 40
 * julkaisun joukosta (D-250). Blogi on paaosin markkinointia, joten
 * hankesignaali vaaditaan otsikosta.
 */
describe("Pelti-Assien suodatin", () => {
  /* Kaikki kuusi 12 kk ikkunan hanketta. */
  const lapaisee = [
    "Pelti-Ässät toteuttaa yli 6 000 neliön vesikattotyöt Vantaan uuteen Elmo Areenaan",
    "Hankeuutisia - Ässien Bitumikateurakointi toteuttaa Hinthaaran sivistyskeskuksen perusmuurien kosteuseristykset sekä vesikattotyöt yhteistyössä Varte Lahden kanssa",
    "Hankeuutisia: Ässien bitumikateurakoiniti mukaan Porvoon Careeria hankkeeseen",
    "Hankeuutisia: Skanska valitsi Pelti-Ässien bitumikateurakoinnin vesikattourakoitsijaksi Firdo hankkeeseen: Vastuullinen kattourakointi ja tekninen kestävyys Pasilan Firdo-hankkeessa keskiössä",
    "Hankeuutisia: Ässien Bitumikateurakointi toteuttaa vesikattotyöt Lauttasaaren yhteiskoulun julkisivuremontissa",
    "Fashion Centerin uusi laajennus 2025 -2026, Pelti-Ässät kattourakoitsijaksi.",
  ]
  for (const otsikko of lapaisee) {
    it(`paastaa lapi: ${otsikko.slice(0, 50)}`, () => {
      expect(lapaiseeSuodatuksen(otsikko)).toBe(true)
    })
  }

  const hylataan = [
    /* Puitesopimus "Hankeuutisia"-otsikolla: ei yksittainen hanke. */
    "Hankeuutisia: Pelti-Ässät Oy ja Toivo Group solmivat vuosisopimuksen",
    "BITUMIERISTÄJÄ | ÄSSÄT HAKEE LISÄÄ TEKIJÖITÄ TALOON!",
    "Haku käynnissä - Työnjohtaja tai nokkamiehestä kasvava työnjohtaja, kermikattourakointi — Pelti-Ässät Oy",
    "Bitumieristäjäksi Ässille? Haemme tekijöitä vakituiseen työsuhteeseen tai aliurakoitsijaksi",
    "Pelti-Ässät - Kattokorjaamo valittiin Hoasin kattokumppaniksi — vastuullisuus ja laatu ratkaisi kilpailutuksessa",
    "Asuntosäätiö ja Pelti-Ässien Kattokorjaamo laajentavat kattopalvelukumppanuuden valtakunnalliseksi",
    "Pelti-Ässät Oy:lle myönnettiin Ekokompassi-sertifikaatti",
    "Kattoremontti vai korjaus — miten taloyhtiö tekee oikean päätöksen?",
    "Isät ja pojat",
    "Willa Virtasen katto sai huipputason huolenpitoa – pitkäaikainen yhteistyö jatkuu Pelti-Ässät Kattokorjaamon kanssa",
    "Mikä tekee Pelti‑Ässien peltikattourakoinnista alan kärkeä?",
    "Katon kuntotarkastus kampanjahintaan!",
    "Aurinkovoimala katolle - Kampanja - Tilaa ilmainen kartoitus",
  ]
  for (const otsikko of hylataan) {
    it(`hylkaa: ${otsikko.slice(0, 50)}`, () => {
      expect(lapaiseeSuodatuksen(otsikko)).toBe(false)
    })
  }
})

describe("Pelti-Assien ehdokas tallennetusta syotteesta", () => {
  const XML = readFileSync(
    join(__dirname, "__fixtures__", "sivuurakoitsijat", "peltiassat.rss.xml"),
    "utf8"
  )
  const [firdo] = jasennaRss(XML)
  const ehdokas = sivuurakoitsijanEhdokas(firdo, PELTI_ASSAT)

  it("lukee Firdo-julkaisun", () => {
    expect(firdo.otsikko).toMatch(/Skanska valitsi Pelti-Ässien bitumikateurakoinnin/)
    expect(firdo.teksti.length).toBeGreaterThan(500)
  })

  /*
   * Julkaisija omilla nimimuodoillaan ("Assien bitumikateurakointi") ei
   * saa paatya paaurakoitsijaksi eika rakennuttajaksi.
   */
  it("ei kirjaa Pelti-Assia osapuoleksi", () => {
    expect(String(ehdokas.builder ?? "")).not.toMatch(/ässi|ässä|pelti/i)
    expect(String(ehdokas.developer ?? "")).not.toMatch(/ässi|ässä|pelti/i)
    expect(ehdokas.metadata.related_companies).toEqual(["Pelti-Ässät"])
  })

  it("ei pida valintaa valmistumisena", () => {
    expect(ehdokas.completed).toBe(false)
  })
})

describe("kaupunki ei tule kumppanin yhtionimesta", () => {
  /*
   * Kuivaharjoitus 8.10.2026: "yhteistyossa Varte Lahden kanssa" antoi
   * kaupungiksi Lahden. Hinthaaran sivistyskeskus on Porvoossa.
   */
  it("Hinthaara on Porvoossa, ei Lahdessa", () => {
    const ehdokas = sivuurakoitsijanEhdokas(
      {
        otsikko:
          "Hankeuutisia - Ässien Bitumikateurakointi toteuttaa Hinthaaran sivistyskeskuksen perusmuurien kosteuseristykset sekä vesikattotyöt yhteistyössä Varte Lahden kanssa",
        osoite: "https://www.peltiassat.fi/blogit-ja-jutut/hankeuutisia-assine-bitumikateurakointi-hinthaara-varte",
        teksti:
          "Hinthaaran sivistyskeskus - Porvoo Vastuullinen vesikattourakointi osana Porvoon kaupungin koulurakentamista.",
        pvm: new Date("2026-01-20"),
      },
      PELTI_ASSAT
    )
    expect(ehdokas.city).toBe("Porvoo")
  })
})
