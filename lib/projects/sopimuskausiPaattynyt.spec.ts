import { describe, expect, it } from "vitest"
import { sopimuskausiPaattynyt, suomeksi } from "./sopimuskausiPaattynyt"

const NYT = new Date("2026-11-19T12:00:00Z")

describe("sopimuskausiPaattynyt", () => {
  it("Maatullinpuisto: kausi päättyi ennen jälki-ilmoituksen julkaisua", () => {
    expect(
      sopimuskausiPaattynyt(
        {
          date_published: "2026-11-18T09:55:45.832Z",
          hilma_sopimuskausi: { alku: "2026-05-29", loppu: "2026-07-20", kelpasi: true },
        },
        NYT
      )
    ).toEqual({ alku: "2026-05-29", loppu: "2026-07-20", ennenJulkaisua: true })
  })

  it("päättyi julkaisun jälkeen mutta ennen tätä päivää", () => {
    expect(
      sopimuskausiPaattynyt(
        { date_published: "2026-11-01T00:00:00Z", hilma_sopimuskausi: { alku: "2026-08-10", loppu: "2026-11-15" } },
        NYT
      )
    ).toEqual({ alku: "2026-08-10", loppu: "2026-11-15", ennenJulkaisua: false })
  })

  it("käynnissä oleva tai tänään päättyvä kausi ei laukaise", () => {
    expect(sopimuskausiPaattynyt({ hilma_sopimuskausi: { loppu: "2027-03-31" } }, NYT)).toBeNull()
    expect(sopimuskausiPaattynyt({ hilma_sopimuskausi: { loppu: "2026-11-19" } }, NYT)).toBeNull()
  })

  it("tuntematon loppu ei laukaise", () => {
    expect(sopimuskausiPaattynyt({ hilma_sopimuskausi: { alku: "2026-05-01", loppu: null } }, NYT)).toBeNull()
    expect(sopimuskausiPaattynyt({}, NYT)).toBeNull()
    expect(sopimuskausiPaattynyt(null, NYT)).toBeNull()
    expect(sopimuskausiPaattynyt({ hilma_sopimuskausi: { loppu: "pian" } }, NYT)).toBeNull()
  })

  it("puitesopimuksenkin loppu kelpaa (kelpasi: false koskee vain aloituspäivää)", () => {
    expect(
      sopimuskausiPaattynyt({ hilma_sopimuskausi: { alku: "2025-10-31", loppu: "2026-10-30", kelpasi: false } }, NYT)?.loppu
    ).toBe("2026-10-30")
  })
})

describe("suomeksi", () => {
  it("muotoilee ISO-päivän", () => {
    expect(suomeksi("2026-07-20")).toBe("20.7.2026")
  })
})
