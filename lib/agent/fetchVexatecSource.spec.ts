import { describe, expect, it } from "vitest"

import {
  aloituskuukausi,
  hankkeenNimi,
  jasennaJulkaisut,
  lapaiseeSuodatuksen,
  vexatecEhdokkaat,
  vexatecinVaihe,
} from "./fetchVexatecSource"

/*
 * VEXATEC (D-322). Otsikot ovat Vexatecin oikeita tiedotteita
 * 19.10.2026; teksti lyhennetty.
 */

describe("lapaiseeSuodatuksen", () => {
  it("päästää läpi kohdejutut", () => {
    for (const otsikko of [
      "Palveluasumisyksikkö Joensuuhun KVR-urakkana",
      "Odotettu monitoimitalo Karesuvannolle",
      "Kouvolaan koti 58 ikäihmiselle",
      "Lappeenrantaan uusi hoivakoti",
      "Rakennamme päiväkodin Lahteen",
      "Vexatec toteuttaa 32 asunnon rivitalokohteen Espoon Perusmäkeen",
    ]) {
      expect(lapaiseeSuodatuksen({ otsikko }), otsikko).toBe(true)
    }
  })

  it("pudottaa yrityksen oman asian", () => {
    for (const otsikko of [
      "Tiedote: Pohjolan Kiinteistörakenne Oy:n sulautuminen Vexatec Oy:öön",
      "Tilauskanta jo 45 miljoonaa euroa",
      "Vexatec mukana Admicomin AI-pilotin testauksessa",
      "Vexatecille hankekehitysjohtaja – Teemu Auvinen aloitti tehtävässä",
      "Vexatecin kulttuurin juurilla",
      "Uudistimme brändiä hillitysti",
      "Vastuun takana: Mika Riekki – Kasvu ei saa viedä hallintaa",
      "Rakenna kauppa, joka kannattaa",
      "Kustannustehokas ympäristöluokitus diplomityön aiheena",
    ]) {
      expect(lapaiseeSuodatuksen({ otsikko }), otsikko).toBe(false)
    }
  })
})

describe("vexatecinVaihe", () => {
  it("lukee vaiheen tekstin sanamuodosta", () => {
    expect(vexatecinVaihe("Kiinteistötahkolan toimitilat jo pitkällä", "harjakaisia vietettiin")).toBe(
      "Rakenteilla"
    )
    expect(vexatecinVaihe("Norlandia Valo -päiväkoti sai rakennusluvan Kokkolassa", "")).toBe("Rakennuslupa")
    expect(vexatecinVaihe("Nollavirheluovutus – Onnikoti Valo", "kohde luovutettiin asiakkaalle")).toBe(
      "Valmistunut"
    )
    expect(vexatecinVaihe("Lappeenrantaan uusi hoivakoti", "Vexatec rakentaa palvelukodin")).toBe(
      "Sopimus myönnetty"
    )
  })
})

describe("jasennaJulkaisut ja vexatecEhdokkaat", () => {
  const data = [
    {
      title: { rendered: "Palveluasumisyksikk&#246; Joensuuhun KVR-urakkana" },
      content: {
        rendered:
          "<p>Rakennamme Joensuuhun 60-paikkaisen palveluasumisyksikön. Rakennustyöt Penttilänkadun tontilla ovat jo käynnissä.</p>",
      },
      date: "2026-04-24T10:00:00",
      link: "https://vexatec.fi/tiedotteet/palveluasumisyksikko-joensuuhun-kvr-urakkana/",
    },
  ]

  it("purkaa html-entiteetit otsikosta ja tekstin kappaleista", () => {
    const [j] = jasennaJulkaisut(data)
    expect(j.otsikko).toBe("Palveluasumisyksikkö Joensuuhun KVR-urakkana")
    expect(j.teksti).toContain("Rakennamme Joensuuhun 60-paikkaisen")
    expect(j.pvm?.toISOString().slice(0, 10)).toBe("2026-04-24")
  })

  it("lukee kunnan tekstistä kun otsikko ei kerro sitä kannan muodossa", () => {
    const [ehdokas] = vexatecEhdokkaat(jasennaJulkaisut(data)[0])
    expect(ehdokas.city).toBe("Joensuu")
    expect(ehdokas.builder).toBe("Vexatec Oy")
    expect(ehdokas.source_url).toContain("palveluasumisyksikko-joensuuhun")
  })

  it("ei keksi tilaajaa", () => {
    const [ehdokas] = vexatecEhdokkaat(jasennaJulkaisut(data)[0])
    expect(ehdokas.developer).toBeNull()
  })
})

describe("hankkeenNimi", () => {
  it("poistaa Tiedote-etuliitteen mutta ei keksi nimeä", () => {
    expect(hankkeenNimi("Tiedote: Jokin asia")).toBe("Jokin asia")
    expect(hankkeenNimi("Kouvolaan koti 58 ikäihmiselle")).toBe("Kouvolaan koti 58 ikäihmiselle")
  })
})

describe("aloituskuukausi ja vaihe (D-323)", () => {
  const karesuvanto =
    "Monitoimitalon rakennustyöt alkavat toukokuussa 2026 ja uusiin tiloihin päästään muuttamaan kesäkuussa 2027."

  it("lukee ilmoitetun aloituskuukauden", () => {
    expect(aloituskuukausi(karesuvanto)?.toISOString().slice(0, 10)).toBe("2026-05-31")
    expect(aloituskuukausi("Hanke on suunnitteluvaiheessa.")).toBeNull()
  })

  it("on Rakenteilla vasta kun ilmoitettu aloitus on mennyt", () => {
    expect(vexatecinVaihe("Monitoimitalo", karesuvanto, new Date("2026-03-15"))).toBe("Sopimus myönnetty")
    expect(vexatecinVaihe("Monitoimitalo", karesuvanto, new Date("2026-10-20"))).toBe("Rakenteilla")
  })
})
