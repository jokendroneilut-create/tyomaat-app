import { describe, expect, it } from "vitest"

import { daysLeft, daysSince, trialState, TRIAL_DAYS } from "./trial"

/* Kiinteä hetki, jotta testit eivät riipu kellonajasta. */
const NYT = new Date("2026-08-23T12:00:00Z").getTime()
const paivaaSitten = (n: number) => new Date(NYT - n * 86400000).toISOString()

describe("daysSince", () => {
  it("laskee taydet paivat", () => {
    expect(daysSince(paivaaSitten(0), NYT)).toBe(0)
    expect(daysSince(paivaaSitten(1), NYT)).toBe(1)
    expect(daysSince(paivaaSitten(30), NYT)).toBe(30)
  })

  it("ei pyorista ylospain kesken paivan", () => {
    /* 29 paivaa ja 23 tuntia ei ole viela 30. */
    expect(daysSince(new Date(NYT - 29 * 86400000 - 23 * 3600000).toISOString(), NYT)).toBe(29)
  })

  it("palauttaa nullin kun aikaleimaa ei ole", () => {
    expect(daysSince(null, NYT)).toBeNull()
    expect(daysSince("", NYT)).toBeNull()
    expect(daysSince("roskaa", NYT)).toBeNull()
  })

  it("tulevaisuuden aikaleima ei tuota negatiivista ikaa", () => {
    expect(daysSince(new Date(NYT + 86400000).toISOString(), NYT)).toBe(0)
  })
})

describe("trialState", () => {
  it("30 paivaa tayttyessa kokeilu on ohi", () => {
    expect(trialState(29)).toBe("pian")
    expect(trialState(TRIAL_DAYS)).toBe("ohi")
    expect(trialState(45)).toBe("ohi")
  })

  it("varoittaa viikkoa ennen", () => {
    expect(trialState(22)).toBe("kesken")
    expect(trialState(23)).toBe("pian")
  })

  it("tuntematon ika ei ole ohi", () => {
    /* Puuttuva aikaleima ei saa nayttaa paattyneelta kokeilulta. */
    expect(trialState(null)).toBe("kesken")
  })
})

describe("daysLeft", () => {
  it("kertoo jaljella olevat paivat", () => {
    expect(daysLeft(23)).toBe(7)
    expect(daysLeft(29)).toBe(1)
  })

  it("ei mene negatiiviseksi", () => {
    expect(daysLeft(45)).toBe(0)
  })
})
