import { describe, it, expect } from "vitest"
import {
  developerFromYvaTitle,
  extractYvaCompanies,
  extractYvaDeveloper,
  cleanYvaContent,
  readYvaStatus,
  yvaStatusIsConcluded,
} from "./fetchYvaSource"

describe("readYvaStatus", () => {
  /*
   * Kenttä tulee ES-vastauksessa taulukkona, mutta yhden alkion mittaisena
   * (mitattu 900 hankkeen otoksessa).
   */
  it("lukee tilan taulukosta", () => {
    expect(readYvaStatus(["Vireillä"])).toBe("Vireillä")
    expect(readYvaStatus(["Päättynyt / perusteltu päätelmä annettu"])).toBe(
      "Päättynyt / perusteltu päätelmä annettu"
    )
  })

  it("lukee tilan myös merkkijonona", () => {
    expect(readYvaStatus("Vireillä")).toBe("Vireillä")
  })

  it("palauttaa null tyhjästä", () => {
    expect(readYvaStatus([])).toBeNull()
    expect(readYvaStatus(null)).toBeNull()
    expect(readYvaStatus([""])).toBeNull()
    expect(readYvaStatus(["   "])).toBeNull()
  })
})

describe("yvaStatusIsConcluded", () => {
  /*
   * PÄÄTTYNYT YVA EI OLE VALMIS HANKE. Tunnistus on olemassa jotta tila
   * voidaan näyttää sellaisenaan - ei jotta hanke merkittäisiin valmiiksi.
   * Jos tämä joskus kytketään vaiheeseen, 644 elävää hanketta katoaisi
   * jonosta valmistuneina.
   */
  it("tunnistaa päättyneen menettelyn", () => {
    expect(yvaStatusIsConcluded("Päättynyt / perusteltu päätelmä annettu")).toBe(true)
  })

  it("ei pidä vireillä olevaa päättyneenä", () => {
    expect(yvaStatusIsConcluded("Vireillä")).toBe(false)
    expect(yvaStatusIsConcluded(null)).toBe(false)
  })
})

describe("extractYvaDeveloper", () => {
  /*
   * `organization` on YVA-aineistossa viranomainen (ELY / Lupa- ja
   * valvontavirasto), ei rakennuttaja. Rakennuttaja lukee leipätekstissä, ja
   * mitatussa 25 hankkeen otoksessa kuvio "X suunnittelee" esiintyi 22:ssa.
   */
  it("poimii hankkeesta vastaavan suunnittelee-kuviosta", () => {
    expect(
      extractYvaDeveloper(
        "Infinergies Finland Oy suunnittelee enintään 68 tuulivoimalan " +
          "suuruisen tuulivoima-alueen rakentamista Kärsämäen Halmemäen alueelle."
      )
    ).toBe("Infinergies Finland Oy")
  })

  it("poimii hankkeesta vastaava -kuviosta", () => {
    expect(
      extractYvaDeveloper(
        "Hankkeesta vastaavana toimiva Eolus Energy Oy suunnittelee " +
          "Myllykankaan tuulivoimapuistoa Sonkajärven kuntaan."
      )
    ).toBe("Eolus Energy Oy")
  })

  /*
   * Sivun lyhytosoite on leipätekstin seassa ja päättyy usein isoihin
   * kirjaimiin, jolloin se liittyi heti perässä olevaan nimeen. Mitattu:
   * "...rikastushiekka-YVA Dragon Mining Oy suunnittelee" tuotti nimen
   * "YVA Dragon Mining Oy".
   */
  it("ei kaappaa sivun osoitetta nimeen", () => {
    expect(
      extractYvaDeveloper(
        "Tämän sivun lyhytosoite on www.ymparisto.fi/vammalan-rikastamo-" +
          "rikastushiekka-YVA Dragon Mining Oy suunnittelee Vammalan rikastamon " +
          "rikastushiekka-alueen laajentamista."
      )
    ).toBe("Dragon Mining Oy")
  })

  /*
   * Pienellä alkava nimi ("wpd Suomi Oy") ei mahdu NAME-kuvioon, jolloin
   * kaappaus alkoi keskeltä ja tuotti nimen "Suomi Oy". Mieluummin tyhjä kuin
   * väärä rakennuttaja.
   */
  it("hylkää katkenneen nimen ennemmin kuin arvaa", () => {
    expect(
      extractYvaDeveloper("Hankkeen kuvaus wpd Suomi Oy suunnittelee tuulipuistoa Kainuuseen.")
    ).toBeNull()
  })

  /*
   * Yhtiömuotoa vaaditaan, koska kuvio on löyhä: ilman sitä yleissana
   * poimittaisiin nimeksi.
   */
  it("ei poimi yleissanaa nimeksi", () => {
    expect(
      extractYvaDeveloper("Yhtiö suunnittelee alueelle uutta tuotantolaitosta.")
    ).toBeNull()
  })

  it("sietää tyhjän", () => {
    expect(extractYvaDeveloper(null)).toBeNull()
  })
})

describe("cleanYvaContent", () => {
  it("siivoaa entiteetit ja pudottaa toistuvan otsikon", () => {
    expect(
      cleanYvaContent(
        "Halmemäen tuulivoimahanke, Kärsämäki Hankkeen kuvaus&nbsp;Infinergies " +
          "Finland   Oy suunnittelee.",
        "Halmemäen tuulivoimahanke, Kärsämäki"
      )
    ).toBe("Hankkeen kuvaus Infinergies Finland Oy suunnittelee.")
  })

  it("sietää tyhjän", () => {
    expect(cleanYvaContent(null, "Otsikko")).toBeNull()
  })
})

/*
 * Sulkulauseke nimen ja verbin valissa katkaisi poiminnan (D-190).
 * Mitattu Pyhajoen datakeskuskaavasta.
 */
describe("extractYvaDeveloper - sulkulauseke", () => {
  it("lukee nimen vaikka valissa on lyhennemerkinta", () => {
    expect(
      extractYvaDeveloper(
        "Verda Cloud Oy (”Verda”) suunnittelee datakeskushanketta Pyhäjoen kunnan pohjoisosaan."
      )
    ).toBe("Verda Cloud Oy")
  })

  it("ei muuta aiempaa kayttaytymista", () => {
    expect(extractYvaDeveloper("Infinergies Finland Oy suunnittelee tuulipuistoa.")).toBe(
      "Infinergies Finland Oy"
    )
    expect(extractYvaDeveloper("Hankealueelle on tarkoitus laatia asemakaava.")).toBeNull()
  })
})

/*
 * Otsikko nimeaa hankevastaavan usein suoraan (D-191). Mitattu: 136
 * rakennuttajattomasta rivista 16:lla yhtiomuoto on otsikossa.
 */
describe("developerFromYvaTitle", () => {
  it.each([
    ["Endomines Oy, Eteläisen kultalinjan kaivoshanke", "Endomines Oy"],
    ["Fingrid Oyj, Alajärvi-Hikiä 400+110 kilovoltin voimajohtohanke YVA", "Fingrid Oyj"],
    ["Rudus Oy:n kiviaineksen, betonin ja asfaltin kierrätysalueet Tampereella", "Rudus Oy"],
    ["ATP Palloneva Oy:n Pallonevan pohjoisen aurinko- ja tuulivoimahanke, Kauhajoki", "ATP Palloneva Oy"],
    ["Yara Suomi Oy, Siilinjärven kipsin läjitys", "Yara Suomi Oy"],
  ])("lukee otsikosta: %s", (otsikko, odotettu) => {
    expect(developerFromYvaTitle(otsikko)).toBe(odotettu)
  })

  /* Ilman yhtiomuotoa ei arvata: "Vaalan datakeskus" ei ole yritys. */
  it.each([
    "Vaalan datakeskus, Vaala",
    "Klaukkalan Sudentullin datakeskus, Nurmijärvi",
    "Uudenmaan ELY-keskus, tiehanke",
    "Nivalan vihreän vedyn tuotantolaitos",
  ])("ei arvaa nimea ilman yhtiomuotoa: %s", (otsikko) => {
    expect(developerFromYvaTitle(otsikko)).toBeNull()
  })
})

/*
 * Hankkeen muut yritykset liittyviksi, ei rakennuttajaksi (D-192).
 * Siivoussaannot on mitattu aineistosta.
 */
describe("extractYvaCompanies", () => {
  it("poimii konsultit ja verkkoyhtiot", () => {
    const teksti =
      "Hankkeesta vastaa Myrsky Energia Oy. YVA-konsulttina toimii Sitowise Oy ja sahkonsiirrosta vastaa Fingrid Oyj."
    expect(extractYvaCompanies(teksti, "Myrsky Energia Oy")).toEqual([
      "Sitowise Oy",
      "Fingrid Oyj",
    ])
  })

  it("karsii sivun avainsanan nimen edesta", () => {
    expect(extractYvaCompanies("Tuulivoimalahankkeet Tuulipuisto Pontema Oy")).toEqual([
      "Tuulipuisto Pontema Oy",
    ])
  })

  it("karsii tiedostonimen", () => {
    expect(
      extractYvaCompanies("Perusteltu-paatelma_2024-06-14.pdf Semecon Oy")
    ).toEqual(["Semecon Oy"])
  })

  it("ei poimi katkennutta nimea", () => {
    expect(extractYvaCompanies("Hanketta suunnittelee wpd Suomi Oy")).toEqual([])
  })

  /*
   * Muunnelmia ei yhdisteta: nimesta ei voi paatella onko kyse samasta
   * yrityksesta (AA Sakatti) vai konsernin eri yhtioista (FCG).
   */
  it("sailyttaa muunnelmat erillisina", () => {
    const teksti = "AA Sakatti Oy hakee lupaa. AA Sakatti Mining Oy vastaa hankkeesta."
    expect(extractYvaCompanies(teksti)).toEqual(["AA Sakatti Oy", "AA Sakatti Mining Oy"])
  })

  it("ei palauta rakennuttajaa liittyvissa", () => {
    expect(extractYvaCompanies("Endomines Oy suunnittelee kaivosta.", "Endomines Oy")).toEqual([])
  })
})

/* Kuivaharjoituksen paljastamat rajatapaukset (D-192). */
describe("extractYvaCompanies - rajatapaukset", () => {
  it("sailyttaa &-merkin osana nimea", () => {
    expect(extractYvaCompanies("YVA-konsulttina toimii Sweco Infra & Rail Oy.")).toEqual([
      "Sweco Infra & Rail Oy",
    ])
  })

  it("ei kaappaa sivun osoitetta nimeen", () => {
    expect(
      extractYvaCompanies(
        "Tämän sivun lyhytosoite on www.ymparisto.fi/Kangaslammin-tuuli-ja-aurinkovoimahanke-YVA Pohjan Voima Oy omistaa hankeyhtiön."
      )
    ).toEqual(["Pohjan Voima Oy"])
  })
})

/*
 * KAAVAKUVAUKSISTA MITATUT (D-195, 19.9.2026).
 */
describe("extractYvaDeveloper - kaavatekstit", () => {
  it("ei paasta pienia sanoja nimeen (ei i-lippua)", () => {
    expect(
      extractYvaDeveloper(
        "Hankkeesta vastaa Lapin ELY-keskus ja konsulttina on Finnmap Infra Oy. Napapiirin asemakaavassa ei ole varauduttu."
      )
    ).toBeNull()
  })

  it("lukee etumuotoisen taloyhtion koko nimen", () => {
    expect(
      extractYvaDeveloper("As. Oy Piikkiön Kirkonkulma hakee omistamalleen tontille kaavamuutosta.")
    ).toBe("As. Oy Piikkiön Kirkonkulma")
  })

  it("lukee kaavan hakijan", () => {
    expect(extractYvaDeveloper("YH-Kodit Oy hakee kaavamuutosta omistamilleen kiinteistöille.")).toBe("YH-Kodit Oy")
  })
})

describe("extractYvaCompanies - kaavatekstien etuliiteroska", () => {
  it("pudottaa virkkeen lopun ja allatiivin nimen edesta", () => {
    expect(
      extractYvaCompanies("aluetta Jämsän Kerkkolaan. Neoen Renewables Finland Oy perustaa hankeyhtiön.")
    ).toEqual(["Neoen Renewables Finland Oy"])
    expect(
      extractYvaCompanies("Rakennukset toimitti Puolustuskiinteistöille Adapteo Finland Oy.")
    ).toEqual(["Adapteo Finland Oy"])
  })

  it("ei palauta paljasta etumuotoa", () => {
    expect(extractYvaCompanies("As. Oy Piikkiön Kirkonkulma hakee kaavamuutosta.")).toEqual([])
  })
})
