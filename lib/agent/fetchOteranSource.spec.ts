import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  jasennaSyote,
  lapaiseeSuodatuksen,
  oteranEhdokkaat,
  oteraninTilaaja,
  urakkaAjanLoppu,
  type OteranJulkaisu,
} from "./fetchOteranSource"
import { detectCityFromText } from "./detectCityFromText"

/*
 * Nayte on Oteranin oikea RSS-syote 18.10.2026 (D-310), kymmenen
 * julkaisua, kuvien srcset- ja tyyliattribuutit poistettuina:
 * `__fixtures__/oteran/feed.xml`.
 */
const julkaisut = jasennaSyote(
  readFileSync(join(__dirname, "__fixtures__", "oteran", "feed.xml"), "utf8")
)
const julkaisu = (osa: string): OteranJulkaisu => {
  const j = julkaisut.find((x) => x.osoite.includes(osa))
  if (!j) throw new Error(`ei naytteessa: ${osa}`)
  return j
}

describe("jasennaSyote", () => {
  it("lukee kymmenen julkaisua kategorioineen", () => {
    expect(julkaisut).toHaveLength(10)
    const kurikka = julkaisu("kurikassa")
    expect(kurikka.otsikko).toBe(
      "Työmaalla: Vt 3:n ja Vt 19:n liittymäjärjestelyiden parantaminen Kurikassa"
    )
    expect(kurikka.kategoriat).toEqual(["Ajankohtaista"])
    expect(kurikka.pvm?.toISOString().slice(0, 10)).toBe("2026-10-15")
  })
})

describe("Oteranin suodatin", () => {
  /* Kategoriat ovat epajohdonmukaisia: hankejuttu voi olla vain "Ajankohtaista". */
  it("paastaa hankeotsikon ilman hankekategoriaa", () => {
    expect(lapaiseeSuodatuksen(julkaisu("kurikassa"))).toBe(true)
    expect(lapaiseeSuodatuksen(julkaisu("puutossalmen"))).toBe(true)
  })

  it("paastaa hankekategorian", () => {
    expect(lapaiseeSuodatuksen(julkaisu("laskentakauden-kuulumisia-4"))).toBe(true)
    expect(lapaiseeSuodatuksen(julkaisu("bogskarin"))).toBe(true)
  })

  it("hylkaa Tyomaalla-kategorian ei-hankkeet", () => {
    /* Tyomaalla + Vastuullisuus */
    expect(lapaiseeSuodatuksen(julkaisu("turvallisuusviikko"))).toBe(false)
    /* Tyomaalla, otsikko kertoo */
    expect(lapaiseeSuodatuksen(julkaisu("tettalk"))).toBe(false)
  })

  it("hylkaa henkilo- ja yleisjutut", () => {
    expect(lapaiseeSuodatuksen(julkaisu("sarri-toiviainen"))).toBe(false)
    expect(lapaiseeSuodatuksen(julkaisu("rakentamisen-syksy"))).toBe(false)
  })

  const hylataan = [
    { otsikko: "HAEMME NYT: TYÖNJOHTAJA, TYÖMAAPÄÄLLIKKÖ / VARSINAIS-SUOMI", kategoriat: ["Ajankohtaista"] },
    { otsikko: "Oteran Oy on ostanut InfraMykrä Oy:n liiketoiminnan", kategoriat: ["Ajankohtaista"] },
    { otsikko: "Olemme osa Lohkare Infra -konsernia", kategoriat: ["Ajankohtaista"] },
    { otsikko: "2024 Mitä tehtiin, missä mentiin?", kategoriat: ["Ajankohtaista", "Työmaalla"] },
  ]
  for (const j of hylataan) {
    it(`hylkaa: ${j.otsikko.slice(0, 45)}`, () => {
      expect(lapaiseeSuodatuksen(j)).toBe(false)
    })
  }
})

describe("koostejutun erittely (Laskentakauden kuulumisia)", () => {
  const ehdokkaat = oteranEhdokkaat(julkaisu("laskentakauden-kuulumisia-4"))
  const nimella = (osa: string) => ehdokkaat.find((e) => e.name.includes(osa))!

  it("viisi osiota, joista siltaurakat neljaksi sopimukseksi", () => {
    expect(ehdokkaat.map((e) => e.name)).toEqual([
      "Luikonlahden puuterminaalin parantaminen",
      "Rauman Lähdepellon pysäköintialueen rakennusurakka",
      "Snackön louhinta ja ruoppausurakka Ahvenanmaalla",
      "Härkämäen vesihuolto",
      "LOU Siltaurakka 3/2026",
      "ITA Sillankorjausurakka 2026",
      "Siltaurakka UUD1 2026-2027",
      "EPO Melsorkanavan silta V-64, 2026, KU",
    ])
  })

  /* Sama source_url hylkaisi kaikki paitsi ensimmaisen (duplicate_source). */
  it("jokaisella oma fragmentti-osoite", () => {
    const urlit = ehdokkaat.map((e) => e.source_url)
    expect(new Set(urlit).size).toBe(urlit.length)
    expect(urlit[0]).toBe(
      "https://oteran.fi/laskentakauden-kuulumisia-4/#luikonlahden-puuterminaalin-parantaminen"
    )
  })

  it("tilaaja osion otsikosta ja elinvoimakeskuksen tunnuksesta", () => {
    expect(nimella("Luikonlahden").developer).toBe("Väylävirasto")
    expect(nimella("Rauman").developer).toBe("Rauman kaupunki")
    expect(nimella("UUD1").developer).toBe("Uudenmaan elinvoimakeskus")
    expect(nimella("Melsorkanavan").developer).toBe("Etelä-Pohjanmaan elinvoimakeskus")
  })

  /* Erikkson rakentaa laiturin, Oteran louhii. */
  it("rakennusliike tilaajana -> se on paaurakoitsija, Oteran liittyva", () => {
    const snacko = nimella("Snackön")
    expect(snacko.builder).toBe("Erikkson Bygg Ab")
    expect(snacko.developer).toBeNull()
    expect(snacko.metadata.related_companies).toContain("Oteran Oy")
  })

  it("kuvaus on osion oma, ei naapurin", () => {
    expect(nimella("Rauman").description).toMatch(/^Ylivuotinen Lähdepellon/)
    expect(nimella("Rauman").description).not.toMatch(/Luikonlahden/)
    expect(nimella("Melsorkanavan").description).toMatch(/^Yksittäisistä siltakohteista/)
    expect(nimella("Melsorkanavan").description).not.toMatch(/LOU Siltaurakka/)
  })

  /* Yhteinen johdanto mainitsee Porin ja Huittisten; sopimus kattaa useita. */
  it("luettelon sopimukselle ei kaupunkia johdannosta", () => {
    expect(nimella("LOU").city).toBeNull()
    expect(nimella("ITA").city).toBeNull()
  })

  it("urakka-aika -> valmistuminen", () => {
    expect(nimella("Luikonlahden").estimated_completion).toBe("2026-09-30")
    expect(nimella("Härkämäen").estimated_completion).toBe("2027-10-31")
  })

  /* Rauma sai tyypin Koulu sanasta "lähikoulun", kun tyyppi luettiin tekstista. */
  it("tyyppi vain nimesta", () => {
    expect(nimella("Rauman").property_type).not.toBe("Koulu")
  })

  it("kaupunki nimesta tai ensimmaisesta virkkeesta", () => {
    expect(nimella("Luikonlahden").city).toBe("Kaavi")
    expect(nimella("Härkämäen").city).toBe("Turku")
  })
})

describe("Urakkakuulumisia", () => {
  const [sarkilahti, aspo] = oteranEhdokkaat(julkaisu("/urakkakuulumisia/"))

  it("kaksi hanketta", () => {
    expect(sarkilahti.name).toBe("Särkilahden kaava-alueen rakentaminen")
    expect(aspo.name).toBe("Aspön yhteyslaiturin saneeraus")
  })

  it("Särkilahti: Turku, Turun kaupunki, valmis 12/2027", () => {
    expect(sarkilahti.city).toBe("Turku")
    expect(sarkilahti.developer).toBe("Turun kaupunki")
    expect(sarkilahti.estimated_completion).toBe("2027-12-31")
  })

  /* "parhaillaan kaynnistymassa ... rakennustyot kaynnistyvat kevaalla" */
  it("Aspö on sopimusvaiheessa, ei rakenteilla", () => {
    expect(aspo.phase).toBe("Sopimus myönnetty")
    expect(aspo.city).toBe("Parainen")
  })
})

describe("yksittaiset hankejutut", () => {
  it("Kurikka: ⚒-luettelo ei pilko juttua, TYL-kumppani liittyvaksi", () => {
    const ehdokkaat = oteranEhdokkaat(julkaisu("kurikassa"))
    expect(ehdokkaat).toHaveLength(1)
    const [k] = ehdokkaat
    expect(k.name).toBe("Vt 3:n ja Vt 19:n liittymäjärjestelyiden parantaminen Kurikassa")
    expect(k.city).toBe("Kurikka")
    expect(k.builder).toBe("Oteran Oy")
    expect(k.metadata.related_companies).toEqual(["Oteran Oy", "Kuortaneen Kaivin"])
    expect(k.phase).toBe("Rakenteilla")
    expect(k.source_url).not.toMatch(/#/)
    expect(k.description).not.toMatch(/#rakennetaanyhdessä|appeared first/)
  })

  /* Sulkematon <div> kaari kappaleet sisaansa ja avausvirkkeet katosivat. */
  it("Porvoo: rikkinainen HTML ei pudota avausvirkkeita, tagirivi tilaajaksi", () => {
    const [k] = oteranEhdokkaat(julkaisu("aleksanterinkadun-silta/"))
    expect(k.description).toMatch(
      /^Porvoon Aleksanterinkadun sillan peruskorjaus käynnistyi tänään Urakan ensimmäinen päivä/
    )
    expect(k.description).not.toMatch(/<span|Borgå stad/)
    expect(k.developer).toBe("Porvoon kaupunki")
  })

  it("Puutossalmi: ELY-keskus allatiivista, loppusuoralla = rakenteilla", () => {
    const [k] = oteranEhdokkaat(julkaisu("puutossalmen"))
    expect(k.developer).toBe("Varsinais-Suomen ELY-keskus")
    expect(k.phase).toBe("Rakenteilla")
    expect(k.completed).toBe(false)
    expect(k.description).toMatch(/^Varsinais-Suomen ELY-keskukselle urakoimamme/)
  })

  it("Bogskär: tilaaja kirjoitusvirheellisesta allatiivista", () => {
    const [k] = oteranEhdokkaat(julkaisu("bogskarin"))
    expect(k.name).toBe("Bogskärin majakkaluoto")
    expect(k.developer).toBe("Väylävirasto")
  })
})

describe("apufunktiot", () => {
  it("urakkaAjanLoppu", () => {
    expect(urakkaAjanLoppu("Hanke urakoidaan ajanjaksolla 09/2026-12/2027.")).toBe("2027-12-31")
    expect(urakkaAjanLoppu("Hanke urakoidaan ajanjaksolla 04-09/2026.")).toBe("2026-09-30")
    expect(urakkaAjanLoppu("Hanke valmistuu kesällä 2027.")).toBeNull()
  })

  it("oteraninTilaaja", () => {
    expect(oteraninTilaaja("Väylävirastolle urakoimamme hanke")).toBe("Väylävirasto")
    expect(oteraninTilaaja("ilman tilaajaa urakoimme")).toBeNull()
  })

  it("Kurikka astevaihtelulla ja Jalasjärvi", () => {
    expect(detectCityFromText("parantaminen kurikassa")).toBe("Kurikka")
    expect(detectCityFromText("liikennettä jalasjärvelle")).toBe("Kurikka")
  })
})
