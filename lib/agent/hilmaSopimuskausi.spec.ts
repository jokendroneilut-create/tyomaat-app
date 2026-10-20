import { describe, it, expect } from "vitest"
import { poimiSopimuskausi, kelpaaAloitukseksi } from "./hilmaSopimuskausi"

/*
 * Jokainen tapaus on otettu oikeasta ilmoituksesta, jonka tunniste on
 * kommentissa: niin muoto on tarkistettavissa jos rajapinta muuttuu.
 */
const lohko = (projekti: any, tenderingProcess?: any) => ({
  procurementProjectLot: [{ procurementProject: projekti, ...(tenderingProcess ? { tenderingProcess } : {}) }],
})

const luonne = (value: string) => ({ listName: "contract-nature", value })
const jakso = (alku: string, loppu?: string) => ({
  startDate: { value: alku },
  ...(loppu ? { endDate: { value: loppu } } : {}),
})

describe("poimiSopimuskausi", () => {
  /* 33143/57631 "Ahveniston koulurakennusten purku" */
  it("poimii jakson, luonteen ja cpv-pääluokan", () => {
    expect(
      poimiSopimuskausi(
        lohko({
          plannedPeriod: jakso("2026-08-03Z", "2026-12-30Z"),
          procurementTypeCode: luonne("works"),
          mainCommodityClassification: [{ itemClassificationCode: { listName: "cpv", value: "45111300" } }],
        })
      )
    ).toEqual({ alku: "2026-08-03", loppu: "2026-12-30", luonne: "works", puitesopimus: false, cpv: "45" })
  })

  /*
   * 37073/56861 "Sähkötöiden tuntityötarjous": päivässä on
   * aikavyöhyke muodossa +02:00, ei Z. Molemmat on luettava.
   */
  it("lukee päivän myös aikavyöhykesiirtymällä", () => {
    const k = poimiSopimuskausi(
      lohko({ plannedPeriod: jakso("2026-12-01+02:00", "2028-05-31+03:00"), procurementTypeCode: luonne("works") })
    )
    expect(k.alku).toBe("2026-12-01")
    expect(k.loppu).toBe("2028-05-31")
  })

  /*
   * Jaettu urakka on monessa osa-alueessa. Hanke alkaa kun sen
   * ensimmäinen osa alkaa, ei kun lista sattuu alkamaan.
   */
  it("ottaa aikaisimman alun ja viimeisimmän lopun osa-alueista", () => {
    const k = poimiSopimuskausi({
      procurementProjectLot: [
        { procurementProject: { plannedPeriod: jakso("2026-09-01", "2026-12-31"), procurementTypeCode: luonne("works") } },
        { procurementProject: { plannedPeriod: jakso("2026-05-01", "2027-04-30"), procurementTypeCode: luonne("works") } },
      ],
    })
    expect(k.alku).toBe("2026-05-01")
    expect(k.loppu).toBe("2027-04-30")
  })

  it("ei väitä luonnetta jos osa-alueilla on eri luonne", () => {
    const k = poimiSopimuskausi({
      procurementProjectLot: [
        { procurementProject: { plannedPeriod: jakso("2026-05-01"), procurementTypeCode: luonne("works") } },
        { procurementProject: { plannedPeriod: jakso("2026-05-01"), procurementTypeCode: luonne("services") } },
      ],
    })
    expect(k.luonne).toBeNull()
  })

  /* Arvo "none" tarkoittaa ettei kyse ole puitesopimuksesta. */
  it("ei pidä none-arvoa puitesopimuksena", () => {
    const k = poimiSopimuskausi(
      lohko(
        { plannedPeriod: jakso("2026-12-01"), procurementTypeCode: luonne("works") },
        { contractingSystem: [{ contractingSystemTypeCode: { listName: "framework-agreement", value: "none" } }] }
      )
    )
    expect(k.puitesopimus).toBe(false)
  })

  it("tunnistaa ilmoitetun puitesopimuksen ja dynaamisen järjestelmän", () => {
    for (const listName of ["framework-agreement", "dps-usage"]) {
      const k = poimiSopimuskausi(
        lohko(
          { plannedPeriod: jakso("2027-01-01"), procurementTypeCode: luonne("works") },
          { contractingSystem: [{ contractingSystemTypeCode: { listName, value: "fa-wo-rc" } }] }
        )
      )
      expect(k.puitesopimus).toBe(true)
    }
  })

  it("palauttaa tyhjän kun ilmoituksessa ei ole osa-alueita", () => {
    expect(poimiSopimuskausi({}).alku).toBeNull()
    expect(poimiSopimuskausi(null).alku).toBeNull()
  })
})

describe("kelpaaAloitukseksi", () => {
  const works = (alku: string, loppu?: string) =>
    poimiSopimuskausi(lohko({ plannedPeriod: jakso(alku, loppu), procurementTypeCode: luonne("works") }))

  it("hyväksyy works-urakan", () => {
    expect(kelpaaAloitukseksi(works("2026-09-01", "2026-12-31")).kelpaa).toBe(true)
  })

  /* 35888/55766 "Urheilupuiston uimahallin irtokalustehankinta" */
  it("hylkää tavarahankinnan: jakso on toimitusaika", () => {
    const k = poimiSopimuskausi(
      lohko({ plannedPeriod: jakso("2026-10-01", "2027-04-15"), procurementTypeCode: luonne("supplies") })
    )
    expect(kelpaaAloitukseksi(k)).toEqual({ kelpaa: false, syy: "luonne supplies" })
  })

  it("hylkää kun luonnetta ei ole ilmoitettu", () => {
    const k = poimiSopimuskausi(lohko({ plannedPeriod: jakso("2026-10-01") }))
    expect(kelpaaAloitukseksi(k).kelpaa).toBe(false)
  })

  /*
   * Otoksen kaksi läpipäässyttä: ilmoitettu works ja ei puitesopimus,
   * mutta nelivuotinen ja otsikko kertoo mistä on kyse.
   */
  it("hylkää nelivuotisen puitejärjestelyn", () => {
    const v = kelpaaAloitukseksi(works("2027-06-01", "2031-05-31"), "TIETOPYYNTÖ: Asfaltointitöiden puitejärjestely")
    expect(v.kelpaa).toBe(false)
    expect(v.syy).toMatch(/otsikko kertoo puitesopimukseksi/)
  })

  /*
   * Heikko sana + pitkä jakso. "Tuntityötarjous 2026-2028" oli
   * ilmoitettu works-urakaksi, mutta 18 kuukautta tuntitöitä ei ole
   * yhden rakennuksen urakka.
   */
  it("hylkää heikon puitesanan kun jakso on yli kaksi vuotta", () => {
    const v = kelpaaAloitukseksi(works("2026-12-01", "2029-05-31"), "Sähkötöiden tuntityötarjous 2026-2028")
    expect(v.kelpaa).toBe(false)
    expect(v.syy).toMatch(/^puitesana ja \d+ vrk$/)
    expect(kelpaaAloitukseksi(works("2027-01-01", "2029-12-31"), "Työkonepalveluiden hankinta 2027-2029").kelpaa).toBe(
      false
    )
  })

  it("hylkää vuosikorjaustyöt pitkällä jaksolla", () => {
    expect(
      kelpaaAloitukseksi(works("2027-01-01", "2030-12-31"), "Lapin yliopisto, Lapin AMK ja REDU Vuosikorjaustyöt")
        .kelpaa
    ).toBe(false)
  })

  /*
   * Kesto yksin ei riitä: suurhanke voi aidosti kestää neljä vuotta.
   * Ilman puitesanaa pitkä jakso kelpaa.
   */
  it("hyväksyy pitkän jakson kun otsikko on yksittäinen urakka", () => {
    expect(kelpaaAloitukseksi(works("2026-10-19", "2030-12-31"), "Kuhmon terveysaseman uudisrakennus").kelpaa).toBe(
      true
    )
  })

  /* Heikko puitesana lyhyessä urakassa ei ole peruste: sana voi olla sivulause. */
  it("hyväksyy lyhyen urakan vaikka otsikossa on heikko puitesana", () => {
    expect(kelpaaAloitukseksi(works("2026-05-01", "2026-11-30"), "Tuntityöt, Kiuruveden kaupunki").kelpaa).toBe(true)
  })

  /*
   * "KAUKOLÄMPÖVERKON RAKENTAMISEN VUOSIURAKKA 2026" ei ilmoittanut
   * loppua, joten kestosääntö ei olisi osunut. Vahva puitesana hylkää
   * ilman kestoa.
   */
  it("hylkää vahvan puitesanan ilman loppupäivää", () => {
    const v = kelpaaAloitukseksi(works("2026-01-01"), "KAUKOLÄMPÖVERKON RAKENTAMISEN VUOSIURAKKA 2026")
    expect(v.kelpaa).toBe(false)
    expect(v.syy).toMatch(/otsikko kertoo puitesopimukseksi/)
  })

  /*
   * Vuokramallissa jakso on vuokrakausi: alku on luovutus, ei aloitus.
   * Virhe menisi väärään suuntaan, joten päivää ei oteta.
   */
  it("hylkää vuokramallin vaikka jakso olisi lyhyt", () => {
    const v = kelpaaAloitukseksi(works("2028-01-01", "2047-12-31"), "Ylämyllyn päiväkoti vuokramallilla, Liperin kunta")
    expect(v.kelpaa).toBe(false)
    expect(v.syy).toMatch(/vuokrakausi/)
    expect(kelpaaAloitukseksi(works("2028-01-01"), "Ruoveden pelastusaseman hankinta vuokramallilla").kelpaa).toBe(
      false
    )
  })

  /* Pisin osuma: 2026-09-01 -> 2053-12-31 = 27 vuotta. */
  it("hylkää yli kahdeksan vuoden jakson ilman otsikkosanoja", () => {
    const v = kelpaaAloitukseksi(works("2026-09-01", "2053-12-31"), "Mikroelektroniikan pilotointiekosysteemitilat")
    expect(v.kelpaa).toBe(false)
    expect(v.syy).toMatch(/^jakso \d+ vrk$/)
  })

  it("hyväksyy kahdeksaa vuotta lyhyemmän suurhankkeen", () => {
    expect(kelpaaAloitukseksi(works("2027-02-01", "2034-12-31"), "Osallistumispyyntö: Malmin uusi sairaala").kelpaa).toBe(
      true
    )
  })

  it("hylkää kun jaksoa ei ole", () => {
    expect(kelpaaAloitukseksi(poimiSopimuskausi({})).syy).toBe("ei jaksoa")
  })
})
