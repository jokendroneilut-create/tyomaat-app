import { describe, expect, it } from "vitest"

import {
  kaavanKuvausLauseesta,
  kaavanKuvausTekstista,
  onPaljasOtsikko,
  normalisoiLiiteUrl,
  valitseKaavaselostus,
  valitseKaavanAsiakirja,
  yhdistaKuvaukset,
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
  /*
   * LIFERAY-OSOITE: tiedostonimi polun keskella, perassa UUID (D-335).
   * Paraisten sivuilla kaikki liitteet ovat tassa muodossa, ja osoite
   * palvelee aidon PDF:n (tarkistettu: application/pdf, "%PDF-1.7").
   * Loppuun sidottu tarkistus hylkasi ne kaikki.
   */
  it("hyvaksyy .pdf:n polun keskella kun perassa on tunniste", () => {
    const url =
      "https://www.pargas.fi/documents/41921/181653/" +
      "Selostus__Pappilanmalmin_korttelin_3_AKM_Luonnos_10.9.2026_FIN.pdf/" +
      "c7859695-2c37-0775-42ff-a11958666114?t=1792521826600"
    expect(normalisoiLiiteUrl(url)).toBe(url)
  })

  it("ei hyvaksy osoitetta jossa ei ole pdf-paatetta lainkaan", () => {
    expect(normalisoiLiiteUrl("https://www.pargas.fi/documents/41921/181653/kuvaus")).toBeNull()
    expect(normalisoiLiiteUrl("https://kunta.fi/liite.pdfx/123")).toBeNull()
  })

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

/* Kangasalan kaavan 711 ja 876 selostuksista 11.10.2026 (D-271). */
describe("kaavanKuvausLauseesta", () => {
  it("loytaa tavoitteen kun koko teksti on yhdella rivilla", () => {
    const yksiRivi =
      "Kaavaselostus, kaava 711 Kangasalan kaupunki Kaavoitus 1 Perus- ja tunnistetiedot " +
      "Asemakaavamuutoksen tavoitteena on tarkistaa asumiselle osoitetun asemakaavakorttelin " +
      "tehokkuutta ja kaupunkikuvaa maaritteleviä kaavamaarayksia. Nykyista kaavaa tehokkaampi " +
      "rakentaminen mahdollistaa hyvalla sijainnilla joukkoliikenteen tukemisen."
    const kuvaus = kaavanKuvausLauseesta(yksiRivi)!
    expect(kuvaus).toContain("tarkistaa asumiselle")
  })

  it("ottaa ankkurilauseen mukaan eika aloita kesken virkkeen", () => {
    const teksti =
      "1 Perus- ja tunnistetiedot Kaavamuutoksen tavoitteena on mahdollistaa nykyisin " +
      "asumisen ja toimitilarakennusten korttelialueiksi kaavoitetun alueen muuttaminen " +
      "kaupan ja asumisen alueeksi Lahdentien tuntumassa."
    expect(kaavanKuvausLauseesta(teksti)!.startsWith("Kaavamuutoksen tavoitteena on")).toBe(true)
  })

  it("ohittaa sisallysluettelon", () => {
    const sisallys =
      "Asemakaavan tavoitteet ......................................................... 32 " +
      "4.5. Asemakaavaratkaisun vaihtoehdot ja niiden vaikutukset ..................... 33"
    expect(kaavanKuvausLauseesta(sisallys)).toBeNull()
  })

  it("ohittaa liiteluettelon", () => {
    const liitteet =
      "Kaavan tavoitteet Kaavaselostuksen liitteet Liite 1 Osallistumis- ja " +
      "arviointisuunnitelma Liite 2 Viranomaisneuvottelun muistio Liite 3 Havainnekuva " +
      "asemakaavasta Liite 4 Asemakaavan seurantalomake Liite 5 Kaavakartta"
    expect(kaavanKuvausLauseesta(liitteet)).toBeNull()
  })
})

/*
 * OAS:N PALJAAT OTSIKOT (D-317). Otos Salon Helenankatu 12:n
 * osallistumis- ja arviointisuunnitelmasta (päivitetty 8.10.2026)
 * sellaisena kuin pdf-parse sen antaa: otsikot ovat paljaita sanoja,
 * mukana kuvateksti ja sivun alatunniste.
 */
const OAS = [
  "Osallistumis- ja arviointisuunnitelma (oas)",
  "Asemakaavan muutos Helenankatu 12",
  "Suunnittelualue",
  "Asemakaavan muutosalue koskee Armfeltin kaupunginosan korttelin 9 tontteja 16,15 ja 14.",
  "Alue rajautuu koillisesta Helenankatuun ja lounaasta Turuntiehen.",
  "Aloite",
  "Asemakaavamuutostyö on lähtenyt maanomistajan toiveesta.",
  "Tavoitteet",
  "Kaupungin tavoitteena on tutkia asemakaavamuutoksella edellytykset toteuttamiskelpoisen",
  "asuinkerrostalon rakentamiselle Helenankadulle ja palveluasumiselle tarkoitetun kerrostalon",
  "rakentaminen Turuntien varteen.",
  "Kuva 2 Kaava-alueen sijaintikartta. @Salon kaupunki",
  "Salon kaupunki  4",
  "Lähtötiedot",
  "Suunnittelualue sijoittuu Salon ydinkeskustaan. Alueella on nelikerroksinen rakennus.",
].join("\n")

describe("kaavanKuvausTekstista: OAS", () => {
  it("poimii tavoiteluvun vaikka otsikot eivät ole numeroituja", () => {
    const kuvaus = kaavanKuvausTekstista(OAS) ?? ""
    expect(kuvaus).toContain("edellytykset toteuttamiskelpoisen asuinkerrostalon rakentamiselle")
    expect(kuvaus).toContain("palveluasumiselle tarkoitetun kerrostalon")
  })

  it("jättää kuvatekstin ja sivun alatunnisteen pois", () => {
    const kuvaus = kaavanKuvausTekstista(OAS) ?? ""
    expect(kuvaus).not.toContain("Kuva 2")
    expect(kuvaus).not.toContain("Salon kaupunki 4")
  })

  it("ei pidä sivunumerorivia eikä virkettä otsikkona", () => {
    expect(onPaljasOtsikko("Tavoitteet")).toBe(true)
    expect(onPaljasOtsikko("Suunnittelualue")).toBe(true)
    expect(onPaljasOtsikko("Salon kaupunki  4")).toBe(false)
    expect(onPaljasOtsikko("Kuva 2 Kaava-alueen sijaintikartta.")).toBe(false)
    expect(onPaljasOtsikko("Alue rajautuu koillisesta Helenankatuun ja lounaasta Turuntiehen.")).toBe(false)
  })

  it("roskaksi purkautuva pdf ei tuota kuvausta paljailla otsikoillakaan", () => {
    const roska = ["AABCCDE", "FFGHIJ KLMNOP", "QRSTU VWXYZ ABCDEFGH IJKLMNOPQRS"].join("\n")
    expect(kaavanKuvausTekstista(roska)).toBeNull()
  })
})

describe("valitseKaavanAsiakirja", () => {
  it("valitsee selostuksen kun se on olemassa", () => {
    const linkit = [
      { href: "https://salo.fi/OAS-Helenankatu-12.pdf", teksti: "OAS" },
      { href: "https://salo.fi/Kaavaselostus.pdf", teksti: "Selostus" },
    ]
    expect(valitseKaavanAsiakirja(linkit)).toBe("https://salo.fi/Kaavaselostus.pdf")
  })

  it("ottaa OAS:n vasta kun selostusta ei ole", () => {
    const linkit = [
      { href: "https://salo.fi/kaavakartta.pdf", teksti: "Kaavakartta" },
      { href: "https://salo.fi/OAS-Helenankatu-12.pdf", teksti: "Osallistumis- ja arviointisuunnitelma" },
    ]
    expect(valitseKaavanAsiakirja(linkit)).toBe("https://salo.fi/OAS-Helenankatu-12.pdf")
  })

  it("ei valitse liitekarttaa eikä selvitystä", () => {
    expect(valitseKaavanAsiakirja([{ href: "https://salo.fi/meluselvitys.pdf", teksti: "Meluselvitys" }])).toBeNull()
    expect(valitseKaavanAsiakirja([{ href: "https://salo.fi/havainnekuva.pdf", teksti: "Havainnekuva" }])).toBeNull()
  })
})

describe("yhdistaKuvaukset", () => {
  it("lisää vain ne lauseet joita sivulla ei ole", () => {
    const sivu = "Alue rajautuu koillisesta Helenankatuun. Muutoshakemus on saapunut 3.3.2017."
    const asiakirja = "Alue rajautuu koillisesta Helenankatuun. Kaupungin tavoitteena on tutkia edellytykset."
    expect(yhdistaKuvaukset(sivu, asiakirja)).toBe(
      "Alue rajautuu koillisesta Helenankatuun. Muutoshakemus on saapunut 3.3.2017. Kaupungin tavoitteena on tutkia edellytykset."
    )
  })

  it("ei välitä kirjainkoosta eikä välimerkeistä vertailussa", () => {
    const sivu = "Kaava-alue on kooltaan noin 4 189 neliömetriä."
    const asiakirja = "Kaava-alue on kooltaan noin 4 189 neliömetriä!"
    expect(yhdistaKuvaukset(sivu, asiakirja)).toBe(sivu)
  })

  it("palauttaa toisen kun toinen puuttuu", () => {
    expect(yhdistaKuvaukset(null, "Tavoitteena on rakentaa.")).toBe("Tavoitteena on rakentaa.")
    expect(yhdistaKuvaukset("Sivun teksti.", null)).toBe("Sivun teksti.")
    expect(yhdistaKuvaukset(null, null)).toBeNull()
  })
})

describe("yhdistaKuvaukset: sulautunut virke", () => {
  it("ei lisää lausetta joka on sulautunut sivun virkkeen sisään", () => {
    const sivu =
      "Elinvoimajaosto käsitteli kaavaluonnosta 16.4.2024 § 46 Hankkeen tarkoituksena on laatia rantaasemakaava."
    const asiakirja = "Hankkeen tarkoituksena on laatia rantaasemakaava. Kaavassa määritetään rakennuspaikat."
    expect(yhdistaKuvaukset(sivu, asiakirja)).toBe(`${sivu} Kaavassa määritetään rakennuspaikat.`)
  })
})

describe("lauseankkurin on aloitettava virke (D-351)", () => {
  it("ei poimi MRL:n yleisiä tavoitteita keskeltä virkettä", () => {
    const oas =
      "Maankäyttö- ja rakennuslain mukaan valtakunnallisten alueidenkäyttötavoitteiden tehtävänä on " +
      "varmistaa alueiden käytön suunnittelun tavoitteet, joista tärkeimmät ovat hyvä elinympäristö ja " +
      "kestävä kehitys, 4 - toimia kaavoituksen ennakoivan ja vuorovaikutteisen viranomaistyön välineenä " +
      "valtakunnallisesti merkittävissä alueidenkäytön kysymyksissä sekä edistää kansainvälisten " +
      "sopimusten täytäntöönpanoa Suomessa. Alueidenkäyttötavoitteet jakautuvat viiteen kokonaisuuteen."
    expect(kaavanKuvausLauseesta(oas)).toBeNull()
  })

  it("poimii yhä virkkeen alusta alkavan tavoiteluvun", () => {
    const selostus =
      "Kaavamuutoksen tavoitteena on tutkia mahdollisuus laajentaa tonttia rakentamattoman katualueen " +
      "puolelle. Tontilla toimiva varaosamyyntiä harjoittava yritys suunnittelee toimitilan laajentamista " +
      "autokorjaamoa varten. Kokonaistilantarve on noin 1500 neliömetriä ja rakennusoikeutta osoitetaan lisää."
    expect(kaavanKuvausLauseesta(selostus)).toContain("varaosamyyntiä")
  })
})

/*
 * Ankkuri ei saa alkaa keskelta sanaa, ja uusin vaihe voittaa (D-362).
 */
describe("Asemakaavan tarkoitus ja vaihejarjestys", () => {
  it("lukee luvun vaikka otsikko on muotoa 'Asemakaavan tarkoitus'", () => {
    const teksti =
      "Asemakaavalla muodostuu: Korttelit 448-454 sekä katu- ja virkistysalueita. " +
      "Asemakaavan tarkoitus: Osoitetaan 60 rakennettua kiinteistöä toteutuneiden " +
      "käyttötarkoitustensa mukaisilla korttelialueilla sijaitseviksi ohjeellisiksi " +
      "tonteiksi sekä muodostetaan 5 uutta ohjeellista asuintonttia kiinteistöstä " +
      "886-401-3-510 Hiidenmäki."
    const tulos = kaavanKuvausLauseesta(teksti)
    expect(tulos).toContain("Asemakaavan tarkoitus")
    expect(tulos).toContain("Osoitetaan 60 rakennettua kiinteistöä")
  })

  it("valitsee ehdotuksen luonnoksen sijaan myos kun luonnos on listassa ensin", () => {
    const perus = "https://www.ulvila.fi/wp-content/uploads/2026/03/"
    const valinta = valitseKaavaselostus([
      { href: perus + "SELOSTUS_LUONNOS_Palovainio.pdf", teksti: "" },
      { href: perus + "SELOSTUS_EHDOTUS_Palovainio.pdf", teksti: "" },
    ])
    expect(valinta).toContain("EHDOTUS")
  })

  it("pitaa merkitsemattoman selostuksen kun muuta ei ole", () => {
    const perus = "https://www.ulvila.fi/wp-content/uploads/2026/03/"
    expect(valitseKaavaselostus([{ href: perus + "SELOSTUS_Palovainio.pdf", teksti: "" }])).toContain(
      "SELOSTUS_Palovainio"
    )
  })
})
