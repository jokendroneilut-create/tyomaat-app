import { describe, expect, it } from "vitest"

import {
  asianTunnus,
  kuvausAsiakirjasta,
  valitseAsiakirja,
} from "./ymparistolupaAsiakirja"

/*
 * Katkelmat ovat aitoja, ladattu ytietopalvelu.lvv.fi:stä 13.10.2026
 * (LVV-U/86058/2026 ja 235/2026). Keksitty katkelma testaisi vain
 * omaa regexiäni, ei sitä muotoa jossa asiakirjat oikeasti ovat.
 */
const KUULUTUS = `
1 (3)
Kuulutus
19.08.2026
LVV-U/86058/2026
Julkinen
Kuulutus
Vesilain mukainen asia
1 Kuulutuksen julkaisupäivä
19.08.2026
2 Asian tiedoksisaantipäivä
Tiedoksisaannin katsotaan tapahtuneen seitsemäntenä päivänä kuulutuksen
julkaisemisajankohdasta eli 26.08.2026.
3 Vireillepanija
Helen Aurinkopuisto Kalanti Oy
4 Asia
Kalannin aurinkopuiston vesitalouslupa, Uusikaupunki
5 Asiatunnus
LVV-U/86058/2026
6 Asian pääasiallinen sisältö
Helen Aurinkopuisto Kalanti Oy hakee vesilain mukaista lupaa Kalannin aurinkopuiston
rakentamisen yhteydessä tehdyille ojituksille sekä suunnitellulle vesienhallinnalle
Uudenkaupungin Kalannissa.
Aurinkovoimala-alueen pinta-ala on noin 200 ha. Voimala-alue on rakennettu pääosin
metsätalousmaalle.
7 Kuulutuksen ja hakemusasiakirjojen nähtävilläpito
Kuulutus on nähtävillä 19.08.2026 - 25.09.2026.
`

const PAATOS = `
1 (65)
Päätös
19.5.2026
235/2026
LVV-U/24868/2026
Asia
Nestesäiliöterminaalin ympäristölupa sekä toiminnan aloittamislupa, Kokkola
Hakija
Berner Oy
Hitsaajankatu 24
00810 Helsinki
Y-tunnus: 0107011-5
Toiminta
Hakemus koskee nestesäiliöterminaalia ja terminaalitoimintaa osoitteessa
Syväsatamantie, 67900 Kokkola. Terminaali sijoittuu Kokkolan Satama Oy:n Syväsataman
alueelle kiinteistölle 272-401-1-232. Toimintaan liittyvä laivaputkilinja sijoittuu osin Boliden
Kokkolan Oy:n omistamalle kiinteistölle 272-401-1-24.
Lupa- ja valvontavirasto, ympäristöosasto
PL 20, 13035 LVV
Sähköposti: kirjaamo@lvv.fi
lvv.fi
Puhelin: 0295 254 000
Y-tunnus 3543248-7
2 (65)
235/2026
Sisällysluettelo
`

/* Oikea sisältö, mutta 287 merkkiä pelkkää diaarinumeroa. */
const VIREILLETULOTIEDOT = `
1 (1)
Vireilletulotiedot
03/07/2026
LVV-U/103706/2026
Ympäristöluvat
1 Vireilletulotiedot / Uppgifter av anhängighet
Vireilletulopvm / 03/07/2026
Diaarinumero / Diarienummer LVV-U/103706/2026
`

describe("kuvausAsiakirjasta", () => {
  it("poimii kuulutuksen pääasiallisen sisällön", () => {
    const kuvaus = kuvausAsiakirjasta(KUULUTUS)
    expect(kuvaus).toContain("hakee vesilain mukaista lupaa Kalannin aurinkopuiston")
    expect(kuvaus).toContain("pinta-ala on noin 200 ha")
  })

  it("ei ota kuulutuksesta seuraavaa lukua mukaan", () => {
    /* Nähtävilläpito on menettelytekstiä, ei hanketta. */
    expect(kuvausAsiakirjasta(KUULUTUS)).not.toContain("nähtävillä 19.08.2026")
  })

  it("poimii päätöksestä Toiminta-luvun", () => {
    const kuvaus = kuvausAsiakirjasta(PAATOS)
    expect(kuvaus).toContain("Hakemus koskee nestesäiliöterminaalia")
    expect(kuvaus).toContain("Syväsatamantie, 67900 Kokkola")
  })

  it("jättää viraston yhteystiedot ja sivunumerot pois", () => {
    const kuvaus = kuvausAsiakirjasta(PAATOS) ?? ""
    expect(kuvaus).not.toContain("kirjaamo@lvv.fi")
    expect(kuvaus).not.toContain("Y-tunnus 3543248-7")
    expect(kuvaus).not.toContain("(65)")
  })

  it("palauttaa yhden kappaleen, ei rivinvaihtoja", () => {
    expect(kuvausAsiakirjasta(PAATOS)).not.toContain("\n")
  })

  it("ei palauta mitään vireilletulotiedoista", () => {
    expect(kuvausAsiakirjasta(VIREILLETULOTIEDOT)).toBeNull()
  })

  it("ei palauta liian lyhyttä pätkää", () => {
    const lyhyt = "\nToiminta\nHakemus koskee laitosta.\nRatkaisu\n"
    expect(kuvausAsiakirjasta(lyhyt)).toBeNull()
  })

  it("kestää tyhjän syötteen", () => {
    expect(kuvausAsiakirjasta("")).toBeNull()
  })
})

describe("valitseAsiakirja", () => {
  const kuulutus = { attachmentId: 1, name: "Kuulutus_LVV-U-86058-2026.pdf", contentLengthKB: 105 }
  const paatos = { attachmentId: 2, name: "Päätös_235_2026.pdf", contentLengthKB: 2030 }
  const vireille = { attachmentId: 3, name: "Vireilletulotiedot", contentLengthKB: 71 }
  const kartta = { attachmentId: 4, name: "S1_Suunnitelmakartta.pdf", contentLengthKB: 5094 }

  it("valitsee kuulutuksen päätöksen sijaan", () => {
    expect(valitseAsiakirja([paatos, kuulutus])?.attachmentId).toBe(1)
  })

  it("ottaa päätöksen kun kuulutusta ei ole", () => {
    expect(valitseAsiakirja([vireille, paatos])?.attachmentId).toBe(2)
  })

  it("ei valitse vireilletulotietoja eikä karttoja", () => {
    expect(valitseAsiakirja([vireille, kartta])).toBeNull()
  })

  it("valitsee saman tyypin pienimmän", () => {
    const iso = { attachmentId: 9, name: "Päätös iso.pdf", contentLengthKB: 5654 }
    expect(valitseAsiakirja([iso, paatos])?.attachmentId).toBe(2)
  })

  it("kestää tyhjän listan", () => {
    expect(valitseAsiakirja([])).toBeNull()
  })
})

describe("asianTunnus", () => {
  it("lukee tunnuksen osoitteesta", () => {
    expect(asianTunnus("https://ytietopalvelu.lvv.fi/fi-FI/asia/3283067")).toBe("3283067")
  })

  it("palauttaa null muusta osoitteesta", () => {
    expect(asianTunnus("https://example.com/x")).toBeNull()
    expect(asianTunnus(null)).toBeNull()
  })
})

/*
 * Ennen 1.1.2026 asiat olivat aluehallintovirastossa. Muoto on eri:
 * luku on numeroimaton "Päätöksen pääasiallinen sisältö" ja päätöksessä
 * versaali "TOIMINTA JA SEN SIJAINTI", joka osuu ensin sisällys-
 * luetteloon. Katkelmat ESAVI/26384/2025 ja PSAVI/8704/2024.
 */
const AVI_KUULUTUS = `
Etelä-Suomen aluehallintovirasto, ympäristölupavastuualue
Postiosoite: PL 1, 13035 AVI
Puhelinvaihde: 0295 016 000
ymparistoluvat.etela@avi.fi | www.avi.fi
Kuulutus 1 (2)
Vireillepanija
Olmar HaminaKotka Oy
Asia
Kemikaaliterminaalin ympäristölupa ja toiminnan aloittamislupa, Hamina
Päätöksen pääasiallinen sisältö
Aluehallintovirasto myöntää ympäristöluvan Olmar HaminaKotka Oy:n
kemikaaliterminaalin toiminnalle. Lupa koskee ferrosulfaatin vastaanottoa
ja välivarastointia Haminan satama-alueella varastohallissa.
Nähtävilläpito
Tämä kuulutus ja päätös pidetään nähtävillä 11.12.2025 - 19.01.2026
`

const AVI_PAATOS = `
1
LUPAPÄÄTÖS
Nro 136/2025
Dnro PSAVI/8704/2024
ASIA Biokaasulaitoskokonaisuuden ympäristölupa, Nivala
2
SISÄLLYSLUETTELO
HAKEMUS JA ASIAN VIREILLETULO ........................................................................................... 6
TOIMINTA JA SEN SIJAINTI .......................................................................................................... 6
LUVAN HAKEMISEN PERUSTE .................................................................................................... 6
6
TOIMINTA JA SEN SIJAINTI
Hakemus koskee biokaasulaitoskokonaisuuden rakentamista Nivalan kaupunkiin.
Laitos käsittelee vuosittain noin 300 000 tonnia biomassaa ja tuottaa biometaania
liikennekäyttöön. Laitosalue sijaitsee Nivalan teollisuusalueella.
LUVAN HAKEMISEN PERUSTE
Ympäristönsuojelulain 27 §
`

describe("vanha AVI-muoto", () => {
  it("poimii numeroimattoman luvun kuulutuksesta", () => {
    const kuvaus = kuvausAsiakirjasta(AVI_KUULUTUS)
    expect(kuvaus).toContain("myöntää ympäristöluvan Olmar HaminaKotka Oy:n")
    expect(kuvaus).toContain("varastohallissa")
    expect(kuvaus).not.toContain("nähtävillä")
  })

  it("jättää AVI:n alatunnisteen pois", () => {
    const kuvaus = kuvausAsiakirjasta(AVI_KUULUTUS) ?? ""
    expect(kuvaus).not.toContain("aluehallintovirasto, ympäristölupavastuualue")
    expect(kuvaus).not.toContain("13035 AVI")
  })

  it("ohittaa sisällysluettelon ja poimii rungon luvun", () => {
    const kuvaus = kuvausAsiakirjasta(AVI_PAATOS)
    expect(kuvaus).toContain("biokaasulaitoskokonaisuuden rakentamista Nivalan")
    expect(kuvaus).toContain("300 000 tonnia biomassaa")
    /* Sisällysluettelon pisterivi ei saa päätyä kuvaukseen. */
    expect(kuvaus).not.toContain("....")
    expect(kuvaus).not.toContain("Ympäristönsuojelulain 27")
  })
})

describe("hännän karsinta", () => {
  it("poistaa sivunvaihdon ylätunnisteen lopusta", () => {
    const teksti = `
Kuulutus
Päätöksen pääasiallinen sisältö
Ilmoitus koskee Stora Enso Oyj:n Heinolan flutingtehtaan yhteydessä toimivan
HTC-laitoksen toimintaa ja sen jatkamista entisellään.
343/2026
LVV-U/104899/2026
`
    const kuvaus = kuvausAsiakirjasta(teksti) ?? ""
    expect(kuvaus.endsWith("entisellään.")).toBe(true)
    expect(kuvaus).not.toContain("LVV-U")
  })

  it("ei karsi leipätekstin lukuja", () => {
    const teksti = `
Kuulutus
Päätöksen pääasiallinen sisältö
Laitos käsittelee vuosittain noin 300 000 tonnia biomassaa ja sijaitsee
noin 3-4 kilometriä keskustasta kaakkoon osoitteessa Vierikuja 1.
`
    const kuvaus = kuvausAsiakirjasta(teksti) ?? ""
    expect(kuvaus).toContain("300 000 tonnia")
    expect(kuvaus).toContain("Vierikuja 1")
  })
})
