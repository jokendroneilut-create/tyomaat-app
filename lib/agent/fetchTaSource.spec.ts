import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  jasennaTaTiedotteet,
  lapaiseeSuodatuksen,
  taEhdokas,
  taNimi,
  taUrakoitsija,
  taValmistumispaiva,
  taVaihe,
} from "./fetchTaSource"
import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * Nayte on TA:n oikea REST-vastaus 9.10.2026 (D-254): 19 tiedotetta
 * viimeisen 12 kuukauden ikkunasta, tallennettuna kokonaisina.
 * `__fixtures__/ta/announcement.json`.
 */
const posts = JSON.parse(readFileSync(join(__dirname, "__fixtures__", "ta", "announcement.json"), "utf8"))
const tiedotteet = jasennaTaTiedotteet(posts)
const hae = (osa: string) => {
  const t = tiedotteet.find((x) => x.osoite.includes(osa))
  if (!t) throw new Error(`ei naytteessa: ${osa}`)
  return t
}

describe("jasennaTaTiedotteet", () => {
  it("lukee otsikon, osoitteen, tekstin ja paivan", () => {
    expect(tiedotteet).toHaveLength(19)
    const t = hae("estellen")
    expect(t.otsikko).toBe(
      "Naantalin keskustakorttelin rakentaminen jatkuu – Asunto Oy Naantalin Estellen rakentaminen alkaa"
    )
    expect(t.pvm?.toISOString().slice(0, 10)).toBe("2026-09-08")
    expect(t.teksti).toContain("Pohjola Rakennus Oy Suomen kanssa")
  })

  it("ei-taulukko on tyhja", () => {
    expect(jasennaTaTiedotteet({ code: "rest_no_route" })).toEqual([])
  })
})

describe("suodatus", () => {
  const hylatyt = tiedotteet.filter((t) => !lapaiseeSuodatuksen(t.otsikko, t.teksti)).map((t) => t.otsikko)

  it("hylkaa asukasviestinnan ja rajatapaukset, ei yhtaan hanketta", () => {
    expect(hylatyt).toEqual([
      "Vuokrakohteistamme tulee savuttomia 1.10.2026 alkaen",
      "TA-Yhtiöiden maltilliset hinnantarkistukset pitävät asumisen kustannukset vakaana vuonna 2026",
      "Malminkentän asuntorakentaminen alkaa",
      "Luonnonläheistä arkea Espoon Sepänkalliossa",
      "141 uutta asumisoikeusasuntoa Espoon Sepänkallioon – tutustu vapaisiin torstaisin ilman ajanvarausta",
    ])
  })

  /* Ennakko-oletus oli etta asukashaku = valmis kohde; mittaus kumosi sen. */
  it("asukashaku paasee lapi ja on rakenteilla", () => {
    const t = hae("haukiputaalle")
    expect(lapaiseeSuodatuksen(t.otsikko, t.teksti)).toBe(true)
    expect(taVaihe(t.otsikko, t.teksti)).toBe(PHASE_LABELS.construction)
  })

  it("me-muoto on TA itse (vuoden 2024 ingressi)", () => {
    expect(
      lapaiseeSuodatuksen(
        "Uusia asumisoikeusasuntoja rakenteilla Keravalle – asukkaaksi voi nyt hakea",
        "Rakennutamme uusia asumisoikeusasuntoja Keravan Kivisillan alueelle osoitteeseen Pianonsoittajankatu 3. Kahteen taloon tulee 48 asuntoa."
      )
    ).toBe(true)
  })
})

describe("taEhdokas (oikeat tiedotteet)", () => {
  it("Naantalin Estelle: kayttajan esimerkki", () => {
    const e = taEhdokas(hae("estellen"))
    expect(e.developer).toBe("TA-Yhtiöt")
    expect(e.builder).toBe("Pohjola Rakennus Oy Suomi")
    expect(e.city).toBe("Naantali")
    expect(e.location).toBe("Tuulensuunkatu 25")
    expect(e.metadata.apartments).toBe(40)
    expect(e.estimated_completion).toBe("2028-06-30")
    /* "rakennustyot kaynnistyvat syksylla 2026" on tulevaa; urakka on sovittu. */
    expect(e.phase).toBe(PHASE_LABELS.contract_awarded)
  })

  it("asukashaku: urakoitsija, arkkitehti, tarkka paiva, asunnot", () => {
    const e = taEhdokas(hae("haukiputaalle"))
    expect(e.name).toBe("Uusia vuokra-asuntoja Haukiputaalle, Frosteruksentie 2 A")
    expect(e.developer).toBe("TA-Yhtymä Oy")
    expect(e.builder).toBe("Temotek Oy")
    expect(e.city).toBe("Oulu")
    expect(e.location).toBe("Frosteruksentie 2 A")
    expect(e.estimated_completion).toBe("2026-11-27")
    expect(e.metadata.apartments).toBe(25)
    expect(e.metadata.related_companies).toEqual(["Arkkitehtitoimisto Järvinen & Kuorelahti Oy"])
    expect(e.source_url).toBe("https://ta.fi/tiedotteet/uusia-vuokra-asuntoja-haukiputaalle-asukashaku-on-alkanut/")
    expect("completed" in e).toBe(false)
  })

  /* Nimi ei saa jatkua virkkeen yli: "Lujatalo Oy. Arkkitehtisuunnittelusta". */
  it("urakoitsijan nimi paattyy virkkeeseen", () => {
    expect(taEhdokas(hae("tattariharjuntie-48")).builder).toBe("Lujatalo Oy")
  })

  it("urakoitsija otsikosta ja kaupan myyjasta", () => {
    expect(taEhdokas(hae("on-aloittanut-uuden")).builder).toBe("Aura Rakennus Länsi-Suomi Oy")
    expect(taEhdokas(hae("pajala-etela")).builder).toBe("Pajala Etelä-Suomi")
    expect(taEhdokas(hae("kartanonrannassa")).builder).toBe("JM Suomi")
  })

  it("TA ei ole oma urakoitsijansa", () => {
    expect(taUrakoitsija("TA-Asumisoikeus rakentaa asumisoikeusasuntoja Tampereen Hiedanrantaan", "")).toBeNull()
  })

  /*
   * Kaksi eri hanketta samassa osoitteessa: porraskirjain erottaa ne.
   * Ilman sita molemmat olisivat "Kangastie 13" ja yhdistyisivat.
   */
  it("porraskirjain sailyy: Kangastie 13 A ja 13 B, Hovivaenkatu 2 A ja B ja 2C", () => {
    expect(taEhdokas(hae("ouluun-haku")).location).toBe("Kangastie 13 A")
    expect(taEhdokas(hae("tuiran-ikaantyneille")).location).toBe("Kangastie 13 B")
    expect(taEhdokas(hae("asumisoikeusasuntoja-turkuun")).location).toBe("Hoviväenkatu 2 A ja B")
    expect(taEhdokas(hae("on-aloittanut-uuden")).location).toBe("Hoviväenkatu 2C")
  })

  it("kaupunki: TA:n toimisto voittaa jarven nimen, otsikon kunta voittaa toimiston", () => {
    /* "Pyhajarven ja Hatanpaan arboretumin laheisyyteen" ei ole Pyhajarven kunta. */
    expect(taEhdokas(hae("hatanpaalle")).city).toBe("Tampere")
    /* Riihimaen kohteesta kertoo Hameenlinnan toimisto. */
    expect(taEhdokas(hae("riihimaelle")).city).toBe("Riihimäki")
  })

  it("kahden talon kohde valmistuu kun viimeinen valmistuu", () => {
    const e = taEhdokas(hae("helsingin-malminkartanoon"))
    expect(e.estimated_completion).toBe("2027-08-30")
    expect(e.metadata.apartments).toBe(128)
  })

  it("naapurikohteen valmistuminen ei tule tama kohteen paivaksi", () => {
    /* "Alueen ensimmainen kohde ... Kuunlilja, valmistuu syksylla 2026" */
    expect(taEhdokas(hae("kartanonrannassa")).estimated_completion).toBe("2027-01-31")
  })

  it("aloitettu rakentaminen on rakenteilla, ei sopimus", () => {
    expect(taEhdokas(hae("on-aloittanut-uuden")).phase).toBe(PHASE_LABELS.construction)
    expect(taEhdokas(hae("kartanonrannassa")).phase).toBe(PHASE_LABELS.construction)
    expect(taEhdokas(hae("70-asunnon")).phase).toBe(PHASE_LABELS.contract_awarded)
  })

  it("yksikaan 12 kk:n hanke ei ole valmistunut", () => {
    const lapi = tiedotteet.filter((t) => lapaiseeSuodatuksen(t.otsikko, t.teksti)).map(taEhdokas)
    expect(lapi).toHaveLength(14)
    expect(lapi.every((e) => e.phase !== PHASE_LABELS.completed)).toBe(true)
  })
})

describe("valmistuminen vaatii vahvan nayton", () => {
  it("'on valmistunut 141 uutta' kahdessa ensimmaisessa virkkeessa", () => {
    expect(
      taVaihe(
        "Uusia asumisoikeusasuntoja Espooseen",
        "TA-Asumisoikeus Oy:n kohde Espoon Sepänkalliossa. Osoitteeseen Hehkutie 1 on valmistunut 141 uutta asumisoikeusasuntoa."
      )
    ).toBe(PHASE_LABELS.completed)
  })

  /* [[hiding-threshold]]: arvio voi venya. */
  it("mennyt arviopaiva ei merkitse valmiiksi", () => {
    const e = taEhdokas(hae("riihimaelle"))
    expect(e.estimated_completion).toBe("2026-08-27")
    expect(e.phase).toBe(PHASE_LABELS.construction)
  })

  it("aiemmin valmistunut naapuritalo ei merkitse valmiiksi", () => {
    /* Estelle "rakennetaan aiemmin valmistuneen Asunto Oy Naantalin Victorian viereen" */
    expect(taEhdokas(hae("estellen")).phase).not.toBe(PHASE_LABELS.completed)
  })
})

describe("apufunktiot", () => {
  it("nimi: asukashaun paate pois ja osoite peraan", () => {
    expect(taNimi("Uusia vuokra-asuntoja Riihimäelle – asukashaku on alkanut", "Paloheimonkatu 40")).toBe(
      "Uusia vuokra-asuntoja Riihimäelle, Paloheimonkatu 40"
    )
    expect(taNimi("Lujatalo rakentaa TA-Yhtiöille kerrostalon Helsingin Tattariharjuun", "Tattariharjuntie 48")).toBe(
      "Lujatalo rakentaa TA-Yhtiöille kerrostalon Helsingin Tattariharjuun"
    )
  })

  it("valmistumispaiva ilman valilyontia", () => {
    expect(taValmistumispaiva("Asuntojen arvioitu valmistumisaika on30.3.2027. Havainnekuva.", null)).toBe("2027-03-30")
  })
})
