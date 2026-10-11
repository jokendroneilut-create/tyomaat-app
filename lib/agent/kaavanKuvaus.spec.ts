import { describe, expect, it } from "vitest"

import {
  kaavanKuvausTekstista,
  normalisoiLiiteUrl,
  valitseKaavaselostus,
} from "./kaavanKuvaus"

/*
 * Otos Savonlinnan teknologiapuiston selostuksesta (LUONNOS 25.8.2026),
 * mukana sivutunnisteet ja tavutus sellaisina kuin pdf-parse ne antaa.
 */
const SELOSTUS = [
  "Savonlinnan kaupunkiLUONNOS 25.8.2026",
  "Kaavoituspalvelut",
  "sivu 2 / 42",
  "1.1 Kaava-alue",
  "Teknologiapuisto Noheva sijaitsee Savonlinnan taajama-alueella, noin",
  "kaksi kilometria Kauppatorilta itaan, kaupunginosassa 10.",
  "Kaavamuutosalueen pinta-ala on noin 9,6 ha.",
  "1.2 Kaavan tarkoitus",
  "Tavoitteena on tehostaa maankayttoa ja mahdollistaa nopeasti kasvaneen",
  "teknologiakeskittyman kehittyminen ja laajentuminen.",
  "Kaupunki on ostanut noin hehtaarin laajuisen maaraalan Andritzilta joulu-",
  "kuussa 2023.",
  "1.3 Suunnittelutyo",
  "Asemakaavan muutos on laadittu Savonlinnan kaupungin kaavoituspalveluissa.",
].join("\n")

describe("kaavanKuvausTekstista", () => {
  it("poimii kaava-alueen ja kaavan tarkoituksen", () => {
    const kuvaus = kaavanKuvausTekstista(SELOSTUS)!

    expect(kuvaus).toContain("Teknologiapuisto Noheva sijaitsee")
    expect(kuvaus).toContain("Tavoitteena on tehostaa maankayttoa")
  })

  /* Suunnittelutyo on eri kysymys eika kuulu kuvaukseen. */
  it("ei ota mukaan muita lukuja", () => {
    expect(kaavanKuvausTekstista(SELOSTUS)).not.toContain("laadittu Savonlinnan")
  })

  /* "joulu-\nkuussa" on yksi sana, ei kaksi. */
  it("yhdistaa rivin lopun tavutuksen", () => {
    expect(kaavanKuvausTekstista(SELOSTUS)).toContain("joulukuussa 2023")
  })

  it("pudottaa toistuvat sivutunnisteet", () => {
    const kuvaus = kaavanKuvausTekstista(SELOSTUS)!
    expect(kuvaus).not.toContain("sivu 2 / 42")
  })

  it("palauttaa null kun lukuja ei ole", () => {
    expect(kaavanKuvausTekstista("Kaavakartta 1:2000")).toBeNull()
    expect(kaavanKuvausTekstista("")).toBeNull()
    expect(kaavanKuvausTekstista(null)).toBeNull()
  })

  /* Otsikko ilman sisaltoa ei ole kuvaus. */
  it("ohittaa liian lyhyen luvun", () => {
    const lyhyt = ["1.2 Kaavan tarkoitus", "Ks. liite 1.", "1.3 Muuta"].join("\n")
    expect(kaavanKuvausTekstista(lyhyt)).toBeNull()
  })

  it("katkaisee pitkan kuvauksen virkkeen rajalta", () => {
    const pitka = [
      "1.2 Kaavan tarkoitus",
      ("Tavoitteena on rakentaa alueelle uusi asuinkortteli palveluineen. " as string).repeat(40),
    ].join("\n")

    const kuvaus = kaavanKuvausTekstista(pitka)!
    expect(kuvaus.length).toBeLessThanOrEqual(1200)
    expect(kuvaus.endsWith(".")).toBe(true)
  })
})

/*
 * Linkkijoukot ovat Euran kaavoitussivulta 11.10.2026, lyhennettyina.
 * Sivulla on 5-11 liitetta per kaava ja niista 10/11 alkaa sanalla
 * "Selostus" (D-268).
 */
describe("valitseKaavaselostus", () => {
  it("ohittaa liitteet ja valitsee paaselostuksen", () => {
    const linkit = [
      { teksti: "Eura_pv_vaikutusarviointi_164", href: "https://www.eura.fi/x/eura_pv_vaikutusarviointi_164.pdf" },
      { teksti: "Kaavakartta_Kortteli_164", href: "https://www.eura.fi/x/kaavakartta_kortteli_164.pdf" },
      { teksti: "Kortteli 164 Asemakaavan seurantalomake", href: "https://www.eura.fi/x/kortteli-164-seurantalomake.pdf" },
      { teksti: "Selostus__Kortteli_164_AKM_Ehdotus", href: "https://www.eura.fi/x/selostus__kortteli_164_akm_ehdotus.pdf" },
      { teksti: "Selostus_Liite_2_OAS", href: "https://www.eura.fi/x/selostus_liite_2_oas.pdf" },
    ]
    expect(valitseKaavaselostus(linkit)).toBe(
      "https://www.eura.fi/x/selostus__kortteli_164_akm_ehdotus.pdf"
    )
  })

  it("ei valitse seurantalomaketta vaikka nimessa on selostus", () => {
    const linkit = [
      { teksti: "seurantalomake", href: "https://www.eura.fi/x/selostus_liite_1_asemakaavan_seurantalomake.pdf" },
      { teksti: "osallistumis- ja arviointisuunnitelma", href: "https://www.eura.fi/x/selostus_liite_2_oas.pdf" },
    ]
    expect(valitseKaavaselostus(linkit)).toBeNull()
  })

  it("hyvaksyy kaavaselostus-alkuisen nimen", () => {
    const linkit = [
      { teksti: "kaavaselostus (PDF)", href: "https://www.eura.fi/x/kaavaselostus__pyhajarven_rakm4-honka.pdf" },
    ]
    expect(valitseKaavaselostus(linkit)).toContain("kaavaselostus__pyhajarven")
  })
})

describe("normalisoiLiiteUrl", () => {
  /* Euran sivulla oli "http://Selostus__Korttelin_353_AKM_ehdotus_17.6.2026". */
  it("hylkaa osoitteen jonka isantanimi on tiedostonimi", () => {
    expect(normalisoiLiiteUrl("http://Selostus__Korttelin_353_AKM_ehdotus_17.6.2026")).toBeNull()
  })

  it("taydentaa puuttuvan protokollan", () => {
    expect(normalisoiLiiteUrl("//www.eura.fi/x/selostus.pdf")).toBe(
      "https://www.eura.fi/x/selostus.pdf"
    )
  })

  it("hylkaa muun kuin pdf-liitteen", () => {
    expect(normalisoiLiiteUrl("https://www.eura.fi/x/kaavakartta.dwg")).toBeNull()
  })
})

/* Euran Fankkee II:n selostuksesta 11.10.2026 (D-268). */
describe("kaavanKuvausTekstista: luvun valinta", () => {
  it("lukee otsikon 'Kaavamuutoksen tavoitteet'", () => {
    const teksti = [
      "1.1.3 Kaavamuutoksen tavoitteet",
      "Euran kunnan tavoitteena on kehittää Fankkee 2 -aluetta osayleiskaavan mukaisesti teollisuusalueena.",
      "2 SELOSTUKSEN LIITEASIAKIRJAT",
    ].join("\n")
    expect(kaavanKuvausTekstista(teksti)).toContain("teollisuusalueena")
  })

  it("ohittaa kaavaprosessin aikataululuvun", () => {
    const teksti = [
      "3 TIIVISTELMÄ KAAVAPROSESSIN VAIHEISTA",
      "Vaihe Ajankohta Kaavoituksen käynnistäminen ja valmisteluvaihe: kesä 2025 Selvitykset laadittiin maastokaudella 2025.",
      "4 SUUNNITTELUALUEEN LÄHTÖKOHDAT",
    ].join("\n")
    expect(kaavanKuvausTekstista(teksti)).toBeNull()
  })
})
