import { describe, expect, it } from "vitest"
import { parseYhteystietolohko } from "./yhteystietolohko"

/*
 * Jokainen lohko on kopioitu oikealta sivulta tai kannassa olleesta
 * rikkinäisestä merkinnästä 13.11.2026 — yhtäkään ei ole kirjoitettu
 * tätä testiä varten. Nimet ovat virkanimiä julkisilta kaavasivuilta.
 */

describe("Vesilahti: koko kappale meni ennen nimi-kenttään", () => {
  const LOHKO =
    "Kunnanjohtaja Mikko Latvala p. 044 431 4340 etunimi.sukunimi@vesilahti.fi " +
    "tai kaavan suunnittelija Arkkitehtitoimisto Helena Väisänen p. 040 557 6086, " +
    "helena.vaisanen@arkkitehtihv.fi"

  it("erottaa kaksi henkilöä", () => {
    expect(parseYhteystietolohko(LOHKO).map((c) => c.name)).toEqual([
      "Mikko Latvala",
      "Helena Väisänen",
    ])
  })

  it("antaa kullekin oman numeronsa", () => {
    expect(parseYhteystietolohko(LOHKO).map((c) => c.phone)).toEqual([
      "044 431 4340",
      "040 557 6086",
    ])
  })

  it("ei tallenna malliosoitetta mutta säilyttää oikean", () => {
    expect(parseYhteystietolohko(LOHKO).map((c) => c.email)).toEqual([
      null,
      "helena.vaisanen@arkkitehtihv.fi",
    ])
  })
})

describe("Lohja: tavallinen osoite jäi nimen sisään", () => {
  it("lukee (at)-hämätyn osoitteen", () => {
    const [c] = parseYhteystietolohko(
      "kaavasuunnittelija Klaus Seppänen klaus.seppanen(at)lohja.fi p. 040 6867391"
    )
    expect(c).toMatchObject({
      name: "Klaus Seppänen",
      title: "kaavasuunnittelija",
      phone: "040 6867391",
      email: "klaus.seppanen@lohja.fi",
    })
  })

  it("lukee tavallisen osoitteen samasta muodosta", () => {
    const [c] = parseYhteystietolohko(
      "kaavoitusarkkitehti Mika Sahlström mika.sahlstrom@lohja.fi. p. 040 6867079"
    )
    expect(c).toMatchObject({
      name: "Mika Sahlström",
      email: "mika.sahlstrom@lohja.fi",
      phone: "040 6867079",
    })
  })

  /* Nimike nimen JÄLKEEN: kahden viimeisen sanan sääntö hävitti tämän. */
  it("löytää nimen kun nimike on sen jäljessä", () => {
    const [c] = parseYhteystietolohko(
      "Seppo Lamppu DI kaavakonsultti puh. 040 867 4451 seppo.lamppu@kaavoitus.fi"
    )
    expect(c).toMatchObject({
      name: "Seppo Lamppu",
      title: "DI kaavakonsultti",
      phone: "040 867 4451",
      email: "seppo.lamppu@kaavoitus.fi",
    })
  })

  /* Numero ilman "puh."- tai "p."-tunnusta. */
  it("tunnistaa numeron ilman tunnusta", () => {
    const [c] = parseYhteystietolohko("DI Jarmo Mäkelä 0400-220082 jarmo.makela@karttaako.fi")
    expect(c).toMatchObject({
      name: "Jarmo Mäkelä",
      title: "DI",
      phone: "0400-220082",
      email: "jarmo.makela@karttaako.fi",
    })
  })

  it("ohittaa rivin jossa ei ole ketään", () => {
    expect(parseYhteystietolohko("kaavaa laativalta konsultilta:")).toEqual([])
  })

  it("poimii nimen vaikka edessä on roskaa", () => {
    const [c] = parseYhteystietolohko(
      "kysymykset ja ajanvaraukset: yleiskaavasuunnittelija Kaisa Leppikangas " +
        "kaisa.leppikangas(at)lohja.fi p. 044 374 4419"
    )
    expect(c?.name).toBe("Kaisa Leppikangas")
    expect(c?.email).toBe("kaisa.leppikangas@lohja.fi")
  })

  it("ei sekoita kaavatunnusta puhelinnumeroon", () => {
    expect(parseYhteystietolohko("L125 Virkkalantien alikulkusilta")).toEqual([])
  })
})

/*
 * PILKKU EROTTAA HENKILON YRITYKSESTA. Kuivaharjoitus 13.11.2026
 * paljasti taman: nimeksi tuli "Aluerakennuttaja Oy" ja oikea nimi
 * valui nimikkeeseen, koska pilkut vaihdettiin valilyonneiksi.
 */
describe("Vesilahti: konsultti yrityksen kanssa", () => {
  const LOHKO =
    "Kunnanjohtaja Mikko Latvala p. 044 431 4340 etunimi.sukunimi@vesilahti.fi " +
    "tai kaavan laatija Juri Pelkonen, Suomen Aluerakennuttaja Oy -SARA " +
    "p. 0500 875 785 juri.pelkonen@sara.fi"

  it("poimii konsultin nimen eikä yritystä", () => {
    const tulos = parseYhteystietolohko(LOHKO)
    expect(tulos.map((c) => c.name)).toEqual(["Mikko Latvala", "Juri Pelkonen"])
  })

  it("siirtää yrityksen omaan kenttäänsä", () => {
    const [, konsultti] = parseYhteystietolohko(LOHKO)
    expect(konsultti).toMatchObject({
      title: "kaavan laatija",
      organization: "Suomen Aluerakennuttaja Oy -SARA",
      phone: "0500 875 785",
      email: "juri.pelkonen@sara.fi",
    })
  })
})

describe("nimike siistitään reunoilta", () => {
  it("osoitteen perään jäänyt piste ei jää nimikkeeksi", () => {
    const [c] = parseYhteystietolohko(
      "kaavoitusarkkitehti Mika Sahlström mika.sahlstrom@lohja.fi. p. 040 6867079"
    )
    expect(c.title).toBe("kaavoitusarkkitehti")
  })
})

/*
 * Numero ilman tunnusta, pilkuilla eroteltuna (D-411). Näin se luki
 * Rovaniemen Aittatien kaavamuutoksen vaihekentässä 13.11.2026.
 */
describe("Rovaniemi: pilkkueroteltu rivi ilman puh.-tunnusta", () => {
  it("poimii nimen, nimikkeen, numeron ja osoitteen", () => {
    const [c] = parseYhteystietolohko(
      "Lisätietoja: Kaupunginarkkitehti Sipi Hintsanen, 050 562 6314, sipi.hintsanen@rovaniemi.fi"
    )
    expect(c).toMatchObject({
      name: "Sipi Hintsanen",
      title: "Kaupunginarkkitehti",
      phone: "050 562 6314",
      email: "sipi.hintsanen@rovaniemi.fi",
    })
  })
})

/* Rovaniemen muodot: yhteystietolohko.rovaniemi.spec.ts (D-409). */

describe("tyhjä syöte", () => {
  it("ei kaadu", () => {
    expect(parseYhteystietolohko(null)).toEqual([])
    expect(parseYhteystietolohko("")).toEqual([])
    expect(parseYhteystietolohko("   ")).toEqual([])
  })
})
