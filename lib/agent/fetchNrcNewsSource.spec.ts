import { describe, expect, it } from "vitest"

import {
  jasennaNrcUutiset,
  kelpaakoNrcUutinen,
  nrcUutisEhdokas,
  type NrcUutinen,
} from "./fetchNrcNewsSource"

/* Sivun oma rakenne, lyhennettyna (mitattu 31.10.2026). */
function sivu(uutiset: any[]): string {
  const apolloState: Record<string, any> = {}
  uutiset.forEach((u, i) => {
    apolloState[`newsItems_default_Entry:${i}`] = {
      __typename: "newsItems_default_Entry",
      siteId: u.siteId ?? 8,
      title: u.title,
      url: u.url,
      postDate: u.postDate,
    }
  })
  apolloState["news_Entry:1"] = { __typename: "news_Entry", title: "Uutiset" }
  const data = { props: { pageProps: { apolloState } } }
  return `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`
}

const SILLAT: NrcUutinen = {
  otsikko: "Toteutamme kaksi uutta ylikulkusiltaa Itä-Suomessa",
  url: "https://www.nrcgroup.fi/uutiset/toteutamme-kaksi-uutta-ylikulkusiltaa-ita-suomessa",
  julkaistu: "2026-10-27",
}

const TUORE = new Date("2025-10-31")

describe("jasennaNrcUutiset", () => {
  it("poimii uutiset upotetusta JSONista", () => {
    const html = sivu([
      { title: "Rakennamme Länsiratikoita Helsinkiin", url: "https://x/1", postDate: "2026-06-04T09:00:00+03:00" },
    ])
    expect(jasennaNrcUutiset(html)).toEqual([
      { otsikko: "Rakennamme Länsiratikoita Helsinkiin", url: "https://x/1", julkaistu: "2026-06-04" },
    ])
  })

  /* Sivu palauttaa vain suomenkielisen rivistön; muu kieli ei kelpaa. */
  it("ottaa vain suomenkieliset", () => {
    const html = sivu([
      { title: "Suomeksi rakennamme", url: "https://x/1", postDate: "2026-06-04", siteId: 8 },
      { title: "In English we build", url: "https://x/2", postDate: "2026-06-04", siteId: 1 },
    ])
    expect(jasennaNrcUutiset(html).map((u) => u.otsikko)).toEqual(["Suomeksi rakennamme"])
  })

  it("kestaa puuttuvan ja rikkinaisen JSONin", () => {
    expect(jasennaNrcUutiset("<html></html>")).toEqual([])
    expect(
      jasennaNrcUutiset('<script id="__NEXT_DATA__" type="application/json">ei json</script>')
    ).toEqual([])
  })
})

describe("kelpaakoNrcUutinen", () => {
  it("paastaa urakkauutisen lapi", () => {
    expect(kelpaakoNrcUutinen(SILLAT, TUORE)).toBe(true)
  })

  /*
   * Mitattu 12 kuukauden otsikoista: nama 13 ovat kohinaa ja kaikki
   * suodattuvat oikein.
   */
  it("pudottaa kohinan", () => {
    const kohina = [
      "Kruunusillat-allianssin vastuullisuustyölle rakentamisen BREEAM-sertifikaatti parhaalla tuloksella",
      "ISO/IEC 27001 -sertifiointi osoittaa tietoturvan keskeisen merkityksen",
      "Ostamme Arctian kanavaliiketoiminnan",
      "Jyrki Riekki NRC Groupin sähkö- ja energiarakentamisen kehityspäälliköksi",
      "Tulevaisuuden johtajat aloittivat jälleen matkansa sisäisessä Navigator-ohjelmassa",
      "Erilainen uratarina: Johtajasta harjoittelijaksi",
    ]
    for (const otsikko of kohina) {
      expect(
        kelpaakoNrcUutinen({ otsikko, url: "https://x", julkaistu: "2026-06-01" }, TUORE),
        otsikko
      ).toBe(false)
    }
  })

  /*
   * TAMA ON RAJAUKSEN VAIKEIN KOHTA. Otsikko nayttaa markkinoinnilta
   * mutta kertoo uusista urakoista; sanasto ei saa pudottaa sita.
   */
  it("ei pudota urakkauutista joka alkaa osaamispuheella", () => {
    const otsikko = "Erikoisosaamisemme näkyy uusissa sähkörakentamisen urakoissa"
    expect(kelpaakoNrcUutinen({ otsikko, url: "https://x", julkaistu: "2026-06-01" }, TUORE)).toBe(true)
  })

  it("pudottaa ikkunaa vanhemman", () => {
    expect(
      kelpaakoNrcUutinen({ ...SILLAT, julkaistu: "2024-01-01" }, TUORE)
    ).toBe(false)
  })

  /* Tuntematonta ikaa ei suodateta ([[never-hide-on-missing-data]]). */
  it("paastaa paivattoman lapi", () => {
    expect(kelpaakoNrcUutinen({ ...SILLAT, julkaistu: null }, TUORE)).toBe(true)
  })
})

describe("nrcUutisEhdokas", () => {
  it("merkitsee rakentajaksi NRC:n ja ottaa paivan lahteesta", () => {
    const e = nrcUutisEhdokas(SILLAT)
    expect(e.builder).toBe("NRC Group Finland Oy")
    expect(e.source_name).toBe("nrc_uutiset")
    expect(e.date_published).toBe("2026-10-27")
    expect(e.source_url).toBe(SILLAT.url)
  })

  /* Kuvaus taytetaan `enrich`issa leipatekstista, ei otsikosta. */
  it("jattaa kuvauksen tyhjaksi", () => {
    expect(nrcUutisEhdokas(SILLAT).description).toBeNull()
  })

  it("tunnistaa valmistuneen otsikosta", () => {
    const e = nrcUutisEhdokas({ ...SILLAT, otsikko: "Siltamme valmistui Ouluun" })
    expect(e.completed).toBe(true)
    expect(nrcUutisEhdokas(SILLAT).completed).toBe(false)
  })
})
