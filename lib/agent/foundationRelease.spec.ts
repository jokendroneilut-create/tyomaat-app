import { describe, expect, it } from "vitest"

import {
  parseApartments,
  parseFoundationRelease,
  parseBuilder,
  parseCompletion,
  parseFloorArea,
  parsePhase,
  parseProjectName,
  parseSites,
  streetStem,
} from "./foundationRelease"

/*
 * Tekstit ovat AYY:n oikeista tiedotteista 29.8.2026, lyhennettyina.
 * Nain testit kertovat mita lahde oikeasti sisaltaa eivatka sita mita
 * kuvittelin sen sisaltavan.
 */

const VALMISTUI =
  "AYY:n uusi opiskelijatalo Otakaari 15 valmistui 31.7.2026 Otaniemeen. " +
  "Rakennus tuo paakaupunkiseudulle 153 uutta opiskelija-asuntoa, jotka " +
  "tarjoavat kodin noin 200 Aalto-yliopiston opiskelijalle. " +
  "Rakennuksen huoneistoala on yhteensä 4 465 neliömetriä."

const HARJANNOSTAJAISET =
  "Otaniemen Teekkarikylassa vietettiin torstaina 5.3.2026 Otakaari 15 -kohteen " +
  "harjannostajaisia. Kohteeseen valmistuu elokuussa 2026 153 modernia " +
  "opiskelija-asuntoa kuusikerroksiseen asuinrakennukseen. Varte Oy toteuttaa " +
  "hankkeen AYY:lle Otaniemen kampusalueelle. Rakentaminen on edennyt " +
  "suunnitellussa aikataulussa."

const ENSIHAKU =
  "Ensihaku Otakaari 15:n uusiin, rakenteilla oleviin opiskelija-asuntoihin " +
  "alkaa 16. maaliskuuta. Kohteeseen valmistuu 153 modernia asuntoa. " +
  "Arvioitu muutto ajoittuu elokuulle 2026."

describe("parseFoundationRelease — hylkaykset", () => {
  it("hylkaa asuntohaun", () => {
    const r = parseFoundationRelease("Kesäasuntojen haku on avattu", "Hae kesäasuntoa nyt!")
    expect(r.isProject).toBe(false)
    expect(r.reason).toContain("asukasviestintä")
  })

  it("hylkaa vapautuvat asunnot", () => {
    expect(parseFoundationRelease("Vapautuvia asuntoja", "Listaus vapautuvista asunnoista").isProject).toBe(false)
  })

  it("hylkaa jarjestyssaannot ja palovaroittimet", () => {
    expect(parseFoundationRelease("Uudet järjestyssäännöt astuneet voimaan AYY:n asuinkiinteistöissä", "").isProject).toBe(false)
    expect(parseFoundationRelease("Kiinteistöjen palovaroitinmuutokset kesällä 2025", "").isProject).toBe(false)
  })

  /*
   * Kiinteistokauppa kertoo omistajanvaihdoksesta. Ostaja voi remontoida,
   * mutta sita ei tiedeta eika keksita.
   */
  it("hylkaa kiinteistokaupan", () => {
    const r = parseFoundationRelease(
      "AYY on myynyt Tuhkimontie 2 -kiinteistön HKA kiinteistöt Oy:lle",
      "Kauppa toteutui toukokuussa."
    )
    expect(r.isProject).toBe(false)
    expect(r.reason).toContain("kiinteistökauppa")
  })

  it("hylkaa tiedotteen jossa ei ole rakentamisen tekoa", () => {
    const r = parseFoundationRelease("AYY:n asuntotarjonta laajenee", "Meillä on paljon asuntoja.")
    expect(r.isProject).toBe(false)
  })

  /*
   * HOAS julkaisee haastattelusarjaa "Etunimi Sukunimi - sitaatti".
   * Leipatekstissa mainitaan kiinteistoja ohimennen. Mitattu 29.8.2026:
   * 4 osumaa 11:sta oli naita.
   */
  it("hylkaa haastattelun", () => {
    const r = parseFoundationRelease(
      "Timo Jaatinen – Katsomalla eteenpäin on aina pärjätty",
      "Välimerenkatu 5 valmistui 2005 ja siinä on 214 asuntoa."
    )
    expect(r.isProject).toBe(false)
    expect(r.reason).toContain("haastattelu")
  })

  it("hylkaa haastattelun myos tavuviivalla", () => {
    expect(parseFoundationRelease("Tuula Saari - Kaiken takana on nainen", "Fredrikinkatu 48 peruskorjaus valmistui").isProject).toBe(false)
  })

  /* Kaksiosainen hankeotsikko ei saa mennä haastatteluksi. */
  it("ei luule hankeotsikkoa haastatteluksi", () => {
    const r = parseFoundationRelease(
      "Siltakujan perusparannus valmistuu – hae kotia nyt!",
      "Siltakuja 2 perusparannus valmistuu kesäkuussa 2025."
    )
    expect(r.isProject).toBe(true)
  })

  /* Ilman osoitetta hanketta ei voi tasmayttaa - mieluummin tyhja. */
  it("hylkaa hanketiedotteen ilman kohdetta", () => {
    const r = parseFoundationRelease("Uusi opiskelijatalo valmistui", "Talo valmistui kesällä.")
    expect(r.isProject).toBe(false)
    expect(r.reason).toContain("kohdetta")
  })
})

describe("parseFoundationRelease — aidot hanketiedotteet", () => {
  it("lukee valmistumistiedotteen", () => {
    const r = parseFoundationRelease("Uusi opiskelijatalo valmistui Otaniemeen – 153 uutta opiskelija-asuntoa", VALMISTUI)
    expect(r.isProject).toBe(true)
    expect(r.projectName).toBe("Otakaari 15")
    expect(r.apartments).toBe(153)
    expect(r.floorArea).toBe(4465)
    expect(r.estimatedCompletion).toBe("2026-07-31")
    expect(r.phaseHint).toBe("completed")
  })

  /* Taman lahteen arvokkain kentta: urakoitsija. */
  it("lukee urakoitsijan harjannostajaistiedotteesta", () => {
    const r = parseFoundationRelease("Otakaari 15 -opiskelija-asuntohankkeen harjannostajaisia juhlistettiin", HARJANNOSTAJAISET)
    expect(r.isProject).toBe(true)
    expect(r.builder).toBe("Varte Oy")
    expect(r.projectName).toBe("Otakaari 15")
    expect(r.apartments).toBe(153)
    expect(r.estimatedCompletion).toBe("2026-08-31")
    expect(r.phaseHint).toBe("construction")
  })

  it("lukee ensihakutiedotteen rakenteilla olevaksi", () => {
    const r = parseFoundationRelease("Otakaari 15 ensihaku alkaa maaliskuussa", ENSIHAKU)
    expect(r.isProject).toBe(true)
    expect(r.projectName).toBe("Otakaari 15")
    expect(r.phaseHint).toBe("construction")
  })

  /* Sama hanke kolmessa tiedotteessa -> sama nimi, jotta ne yhdistyvat. */
  it("antaa samalle hankkeelle saman nimen eri tiedotteissa", () => {
    const nimet = [VALMISTUI, HARJANNOSTAJAISET, ENSIHAKU].map(
      (t) => parseFoundationRelease("Otakaari 15", t).projectName
    )
    expect(new Set(nimet).size).toBe(1)
    expect(nimet[0]).toBe("Otakaari 15")
  })
})

describe("kenttien poiminta", () => {
  it("tunnistaa osoitteen eri kadunpaatteilla", () => {
    expect(parseProjectName("Otakaari 15", "")).toBe("Otakaari 15")
    expect(parseProjectName("Tuhkimontie 2 -kiinteistö", "")).toBe("Tuhkimontie 2")
    expect(parseProjectName("", "remontti Kirkonkyläntie 16 kohteessa")).toBe("Kirkonkyläntie 16")
  })

  it("ei keksi osoitetta tyhjasta", () => {
    expect(parseProjectName("Uusi talo", "valmistui kesällä")).toBeNull()
  })

  it("lukee asuntomaaran", () => {
    expect(parseApartments("153 uutta opiskelija-asuntoa")).toBe(153)
    expect(parseApartments("1 200 asuntoa")).toBeNull()  /* yli katon */
    expect(parseApartments("412 asuntoa")).toBe(412)
    expect(parseApartments("ei lukua")).toBeNull()
  })

  /* Yli tuhat asuntoa yhdessa kohteessa on lukuvirhe. */
  it("torjuu mahdottoman asuntomaaran", () => {
    expect(parseApartments("15 000 asuntoa")).toBeNull()
  })

  it("lukee huoneistoalan valilyonneista huolimatta", () => {
    expect(parseFloorArea("huoneistoala on yhteensä 4 465 neliömetriä")).toBe(4465)
    expect(parseFloorArea("kerrosala 12 000 m2")).toBe(12000)
    expect(parseFloorArea("ei alaa")).toBeNull()
  })

  it("lukee urakoitsijan molemmista muodoista", () => {
    expect(parseBuilder("Varte Oy toteuttaa hankkeen AYY:lle")).toBe("Varte Oy")
    expect(parseBuilder("Pääurakoitsijana toimii YIT Suomi Oy")).toBe("YIT Suomi Oy")
    /* Kuivaharjoitus 29.8.2026 tuotti tasta nimen "oli Varte Lahti Oy". */
    expect(parseBuilder("Urakoitsijana oli Varte Lahti Oy")).toBe("Varte Lahti Oy")
    expect(parseBuilder("ei urakoitsijaa mainittu")).toBeNull()
  })

  it("lukee valmistumisen kolmesta muodosta", () => {
    expect(parseCompletion("valmistui 31.7.2026")).toBe("2026-07-31")
    expect(parseCompletion("valmistuu elokuussa 2026")).toBe("2026-08-31")
    expect(parseCompletion("valmistuu vuonna 2027")).toBe("2027-12-31")
    expect(parseCompletion("ei aikataulua")).toBeNull()
  })

  /*
   * Tiedote ei kerro hankkeesta joka valmistui vuosia ennen sen
   * kirjoittamista. Ilman tata haastattelun historiaosuus tuotti
   * valmistumisvuodeksi 2005.
   */
  it("hylkaa valmistumisen joka on kaukana ennen julkaisua", () => {
    expect(parseCompletion("valmistui vuonna 2005", "2024-02-27")).toBeNull()
    expect(parseCompletion("valmistuu vuonna 2027", "2024-02-27")).toBe("2027-12-31")
    /* Hieman ennen julkaisua valmistunut on uskottava. */
    expect(parseCompletion("valmistui 31.7.2026", "2026-08-24")).toBe("2026-07-31")
  })

  /* Mahdoton paiva on virhe datassa, ei paivamaara. */
  it("torjuu mahdottoman paivan", () => {
    expect(parseCompletion("valmistui 31.2.2026")).toBeNull()
  })

  it("paattelee vaiheen teosta", () => {
    expect(parsePhase("rakennus valmistui heinäkuussa")).toBe("completed")
    expect(parsePhase("vietettiin harjannostajaisia")).toBe("construction")
    /* Monikko: HOASin 402 asunnon tiedote jai ilman vaihetta. */
    expect(parsePhase("kohteet valmistuvat alkuvuodesta 2028")).toBe("construction")
    expect(parsePhase("kohteelle haettiin rakennuslupa")).toBe("permit")
    expect(parsePhase("solmittiin aiesopimus")).toBe("planning")
    expect(parsePhase("ei mitään")).toBeNull()
  })
})

describe("usea kohde samassa tiedotteessa", () => {
  /*
   * HOASin tarkein tiedote (402 asuntoa, 60 M€) koskee KAHTA kohdetta,
   * ja kadunnimet ovat taivutettuja ilman numeroa. Numeroa vaatinut
   * poimija hylkasi sen kokonaan.
   */
  const KAKSI_KOHDETTA =
    "Hoas on käynnistänyt kaksi uutta opiskelija-asuntojen rakennushanketta. " +
    "Uudet talot nousevat Ruskeasuolle Mannerheimintielle ja Itäkeskukseen " +
    "Gotlanninkadulle. Hankkeet tuovat 402 uutta asuntoa. Mannerheimintien " +
    "ja Gotlanninkadun kohteet valmistuvat alkuvuodesta 2028."

  it("poimii tiedotteen mutta ei nimea sita arvalla", () => {
    const r = parseFoundationRelease(
      "Hoas rakentaa Helsinkiin 402 uutta opiskelija-asuntoa",
      KAKSI_KOHDETTA
    )
    expect(r.isProject).toBe(true)
    expect(r.projectName).toBeNull()
    expect(r.apartments).toBe(402)
    expect(r.reason).toContain("katselmoitava")
  })

  /* Sama katu eri sijamuodoissa on yksi kohde, ei kaksi. */
  it("yhdistaa sijamuodot yhdeksi kohteeksi", () => {
    const sites = parseSites("", KAKSI_KOHDETTA)
    expect(sites).toHaveLength(2)
    expect(sites[0]).toBe("Mannerheimintielle")
    expect(sites[1]).toBe("Gotlanninkadulle")
  })

  /*
   * Ilman osoitenumeroa tiedotteen on ansaittava paikkansa kovalla
   * luvulla. Ilman tata mukaan paasivat "Sentinvenyttajan
   * asunnonhakuvinkit" ja "Hoas lanseeraa Tiedostavat tyomaat".
   */
  it("hylkaa numerottoman kohteen jos asuntomaaraa ei kerrota", () => {
    const r = parseFoundationRelease(
      "Hoas lanseeraa Tiedostavat työmaat",
      "Mannerheimintiellä rakentaminen on edennyt hyvin. Urakoitsijat sitoutuvat."
    )
    expect(r.isProject).toBe(false)
    expect(r.reason).toContain("asuntomäärää")
  })

  it("numerollinen osoite voittaa katumaininnan", () => {
    const sites = parseSites("Otakaari 15", "Otakaarelle valmistuu talo")
    expect(sites).toEqual(["Otakaari 15"])
  })

  it("streetStem karsii sijapaatteen", () => {
    expect(streetStem("Mannerheimintielle")).toBe(streetStem("Mannerheimintien"))
    expect(streetStem("Gotlanninkadulle")).toBe(streetStem("Gotlanninkadun"))
  })
})

describe("uudet hylkaykset", () => {
  /* KOASin "Asuntotilanne elokuussa 2024" luki 121 asuntoa hankkeeksi. */
  it("hylkaa vuokraustilanteen", () => {
    const r = parseFoundationRelease(
      "Asuntotilanne elokuussa 2024",
      "Koas Kauppakatu 13b:ssa on 121 asuntoa vapaana, uusia valmistuu pian."
    )
    expect(r.isProject).toBe(false)
  })

  it("hylkaa vapautuvat asunnot ja asuntonaytot", () => {
    expect(parseFoundationRelease("Kaksioita ja soluhuoneita vapautumassa", "Palstatie 4 rakennettiin 2019.").isProject).toBe(false)
    expect(parseFoundationRelease("Asuntonäyttö Taitoniekantie 18.4.", "Kohde valmistuu pian.").isProject).toBe(false)
  })

  /* POASin "Peltokatu 100 vuotta!" luki juhlavuoden katunumeroksi. */
  it("hylkaa juhlavuoden", () => {
    const r = parseFoundationRelease("Peltokatu 100 vuotta!", "Talo valmistui 1925 ja peruskorjattiin.")
    expect(r.isProject).toBe(false)
    expect(r.reason).toContain("juhlavuosi")
  })

  /* Oikea osoitteellinen hanke ei saa pudota naiden mukana. */
  it("paastaa aidon hankkeen lapi", () => {
    const r = parseFoundationRelease(
      "Koas ja Peab käynnistävät 80 opiskelija-asunnon rakentamisen",
      "Kauppakatu 13b:hen valmistuu 80 asuntoa. Rakennustyöt ovat alkaneet."
    )
    expect(r.isProject).toBe(true)
  })
})
