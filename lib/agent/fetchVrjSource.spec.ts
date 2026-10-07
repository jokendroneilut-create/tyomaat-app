import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  ilmanTienNimia,
  jasennaJuttu,
  jasennaLista,
  lapaiseeSuodatuksen,
  vrjEhdokas,
} from "./fetchVrjSource"

/*
 * Naytteet ovat VRJ:n oikeita sivuja 8.10.2026 (D-250), tallennettuna
 * lyhennettyina: `__fixtures__/sivuurakoitsijat/vrj-*.html`.
 */
const lue = (nimi: string) =>
  readFileSync(join(__dirname, "__fixtures__", "sivuurakoitsijat", nimi), "utf8")

describe("VRJ:n suodatin", () => {
  /* 12 kk ikkunan neljä hanketta ja vanhempia, vaihtelevia otsikoita. */
  const lapaisee = [
    "VRJ toteuttaa Holiday Club Saariselän kylpylän peruskorjausurakan",
    "Uuden harjoitusjäähallin rakentaminen käynnistyi Elmon urheilupuistoon – VRJ toimii hankkeen urakoitsijana",
    "VRJ Pohjois-Suomi Oy toteutti Valtatie 20 Kuusamontien liikennejärjestelyt Kiimingissä Purontien kohdalla.",
    "Kiimingin Koitelin alueella käynnistyy virkistys- ja pysäköintialueen peruskorjaus",
    "VRJ Rakennuksella on meneillään kaksi merkittävää rakennushanketta Jyväskylässä",
    "Kuvakollaasi VRJ:n työmaalta Katajanokanlaiturilta",
    "Espoon Hatsinanpuisto on Vuoden Ympäristörakenne 2024 -kilpailun voittaja",
    "VRJ mukana TRIWA-LIFE -hankkeessa ennallistamassa Tornionjokilaakson vesiluontoa",
  ]
  for (const otsikko of lapaisee) {
    it(`paastaa lapi: ${otsikko.slice(0, 50)}`, () => {
      expect(lapaiseeSuodatuksen(otsikko)).toBe(true)
    })
  }

  const hylataan = [
    "Omistusjärjestely VRJ Länsi-Suomi Oy:ssä – Tuomas Saarinen yhtiön osakkaaksi ja toimitusjohtajaksi",
    "VRJ Suomi Oy:n linjasaneeraus- eli putkiremonttipalvelut Avainlippu-merkkiyritysten joukkoon",
    "VRJ Etelä-Suomi Oy vaihtaa nimeä",
    "VRJ Group 45 vuotta! 🎉",
    "VRJ toivottaa rauhallista joulua ja onnellista uutta vuotta kaikille!",
    "VRJ Etelä-Suomi Oy vastuullisuusraportti 2024 julkaistu",
    "Juhan Auto Oy toimitti 51 uutta Toyotan höytyajoneuvoa VRJ Etelä-Suomi Oy:n käyttöön",
    "Maa-ainesmyymälän hinnastot kaudelle 2025",
    "RALAn arviointilautakunta vahvisti VRJ:lle R2-siltaluokituksen",
    "Koneet käyntiin -logistiikka-alan työelämätapahtuma pidettiin Oulun seudulla",
  ]
  for (const otsikko of hylataan) {
    it(`hylkaa: ${otsikko.slice(0, 50)}`, () => {
      expect(lapaiseeSuodatuksen(otsikko)).toBe(false)
    })
  }
})

describe("jasennaLista", () => {
  const linkit = jasennaLista(lue("vrj-lista.html"))

  it("lukee listaussivun viisi juttua", () => {
    expect(linkit).toHaveLength(5)
    expect(linkit[1].title).toBe(
      "VRJ Suomi Oy:n linjasaneeraus- eli putkiremonttipalvelut Avainlippu-merkkiyritysten joukkoon"
    )
    expect(linkit[1].link).toMatch(/^https:\/\/www\.vrj\.fi\/ajankohtaista\/.+\.html$/)
  })
})

describe("jasennaJuttu + vrjEhdokas (Elmo Areena)", () => {
  const { date, teksti } = jasennaJuttu(lue("vrj-elmo.html"))
  const otsikko =
    "Uuden harjoitusjäähallin rakentaminen käynnistyi Elmon urheilupuistoon – VRJ toimii hankkeen urakoitsijana"
  const ehdokas = vrjEhdokas({ title: otsikko, link: "https://www.vrj.fi/x.html", date, teksti })

  it("lukee julkaisupaivan metatagista", () => {
    expect(date?.toISOString().slice(0, 10)).toBe("2026-04-30")
  })

  /*
   * Kuvaus alkaa leipatekstilla eika sivun kalusteilla ("Ajankohtaista
   * <otsikko> Rakennusala Tiedote VRJ"), joita createCompanyEnricher olisi
   * tuonut.
   */
  it("kuvaus alkaa leipatekstista", () => {
    expect(teksti).toMatch(/^Vantaalle Asolan kaupunginosaan/)
    expect(teksti).not.toMatch(/Takaisin$/)
  })

  it("nimeaa yhteyshenkilon puhelinnumeron tekstissa", () => {
    expect(teksti).toMatch(/Henri Ala-Kotila/)
    expect(teksti).toMatch(/040 825 6352/)
  })

  /* Ingressi mainitsee myohemmin Helsingin jaahallit; sijainti on Vantaa. */
  it("kaupunki ensimmaisesta virkkeesta, ei myohemmasta vertailusta", () => {
    expect(ehdokas.city).toBe("Vantaa")
  })

  it("rakennuttaja VRJ:n sanamuodosta 'hankkeesta vastaa'", () => {
    expect(ehdokas.developer).toBe("Elmon Urheilukeskus Kiinteistöosakeyhtiö")
    expect(ehdokas.builder).toBe("VRJ")
  })

  it("vaihe rakenteilla otsikon 'rakentaminen kaynnistyi' perusteella", () => {
    expect(ehdokas.phase).toBe("Rakenteilla")
    expect(ehdokas.completed).toBe(false)
  })
})

describe("ilmanTienNimia", () => {
  /* Kuivaharjoitus: "Kuusamontien" ja "Kuusamon suuntaan" antoivat Kuusamon. */
  it("poistaa tien nimen ja suunnan", () => {
    const t = ilmanTienNimia(
      "valtatie 20 kuusamontien liikennejärjestelyt. siirtämällä liittymää kuusamon suuntaan."
    )
    expect(t).not.toMatch(/kuusamo/)
  })
})
