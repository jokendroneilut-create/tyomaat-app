import { describe, expect, it } from "vitest"

import {
  hankeslugit,
  jasennaHankesivu,
  jasennaYhteyshenkilot,
  lueKentta,
  vaiheTilasta,
} from "./fetchFingridProjectsSource"

/* Katkelmat vastaavat fingrid.fi:n rakennetta 15.10.2026. */

const LISTAUS = `
<html><body>
  <a href="/kantaverkko/rakentaminen/">Rakentaminen</a>
  <a href="/kantaverkko/rakentaminen/hankkeet/">Hankkeet</a>
  <a href="/kantaverkko/rakentaminen/hankkeet/aurora-line/">Aurora Line</a>
  <a href="/kantaverkko/rakentaminen/hankkeet/espoo-framnas/">Espoo-Framnäs</a>
  <a href="/kantaverkko/rakentaminen/hankkeet/aurora-line/">Aurora Line uudelleen</a>
</body></html>`

const HANKESIVU = `
<html><body>
  <nav><a href="/kantaverkko/rakentaminen/hankkeet/toinen-hanke/">Toinen hanke</a></nav>
  <div class="content">
    <div class="sidebar">Aurora Line Anttila-Länsisalmi Espoo-Framnäs Harjulinja</div>
    <div class="content-text">
      <h1>Espoo-Framnäs</h1>
      <p>Hankkeen tiedot Hankkeen tyyppi: Voimajohto Hankkeen tila: Suunnittelu
      Sijainti: Espoo, Uusimaa Pituus: noin 12 km</p>
      <p>Fingrid rakentaa uuden 400 kilovoltin voimajohdon Espoon ja Framnäsin välille.</p>
    </div>
  </div>
</body></html>`

describe("hankeslugit", () => {
  it("poimii hankkeiden tunnukset listauksesta", () => {
    expect(hankeslugit(LISTAUS)).toEqual(["aurora-line", "espoo-framnas"])
  })

  it("ei ota listaussivua itseaan eika ylatason linkkeja", () => {
    const slugit = hankeslugit(LISTAUS)
    expect(slugit).not.toContain("hankkeet")
    expect(slugit).not.toContain("rakentaminen")
  })
})

describe("lueKentta", () => {
  const teksti =
    "Hankkeen tiedot Hankkeen tyyppi: Voimajohto Hankkeen tila: Hanke on valmistunut " +
    "Sijainti: Norrbotten, Lappi, Pohjois-Pohjanmaa Pituus: noin 380 km Fingrid ja Ruotsin..."

  it("lukee arvon seuraavaan kenttaan asti", () => {
    /*
     * Tama oli vika ensimmaisessa versiossa: lookahead-regex palautti
     * 51 tapauksessa 52:sta tyhjan, koska kenttien valissa ei ole
     * valimerkkia vaan pelkka valilyonti.
     */
    expect(lueKentta(teksti, "Hankkeen tyyppi")).toBe("Voimajohto")
    expect(lueKentta(teksti, "Hankkeen tila")).toBe("Hanke on valmistunut")
    expect(lueKentta(teksti, "Sijainti")).toBe("Norrbotten, Lappi, Pohjois-Pohjanmaa")
  })

  it("palauttaa null kun kenttaa ei ole", () => {
    expect(lueKentta(teksti, "Urakoitsija")).toBeNull()
  })
})

describe("vaiheTilasta", () => {
  it("kaantaa Fingridin tilan omaksi vaiheeksi", () => {
    expect(vaiheTilasta("Rakentaminen")).toBe("Rakenteilla")
    expect(vaiheTilasta("Suunnittelu")).toBe("Suunnittelu")
    /*
     * YVA ja ymparistoselvitys -> Suunnittelu, ei Ideointi (18.10.2026).
     * Mitattu: Ideointi on kanoninen vaihe mutta 0 / 6 896 hankkeessa,
     * ja jonon 5 Ideointi-rivia tulivat kaikki tasta kuviosta.
     */
    expect(vaiheTilasta("YVA-menettely")).toBe("Suunnittelu")
    expect(vaiheTilasta("Ympäristöselvitys")).toBe("Suunnittelu")
  })

  it("hylkaa valmistuneen", () => {
    /* Valmis voimajohto ei ole mahdollisuus — sama kuin GRK ja NRC. */
    expect(vaiheTilasta("Hanke on valmistunut")).toBeNull()
  })

  it("tuntematon tila ei ole valmistunut, joten se otetaan mukaan", () => {
    expect(vaiheTilasta("Jokin muu vaihe")).toBe("Suunnittelu")
    expect(vaiheTilasta(null)).toBeNull()
  })
})

describe("jasennaHankesivu", () => {
  it("lukee otsikon ja kentat", () => {
    const sivu = jasennaHankesivu(HANKESIVU)
    expect(sivu?.otsikko).toBe("Espoo-Framnäs")
    expect(sivu?.tyyppi).toBe("Voimajohto")
    expect(sivu?.tila).toBe("Suunnittelu")
    expect(sivu?.sijainti).toBe("Espoo, Uusimaa")
  })

  it("ei ota sivupalkin hankelistaa mukaan kuvaukseen", () => {
    /*
     * Koko `.content` sisaltaa sivupalkin, jossa on kaikkien 52
     * hankkeen nimet. Ne vuotaisivat jokaisen hankkeen kuvaukseen.
     */
    const sivu = jasennaHankesivu(HANKESIVU)
    expect(sivu?.teksti).toContain("Espoon ja Framnäsin")
    expect(sivu?.teksti).not.toContain("Anttila-Länsisalmi")
    expect(sivu?.teksti).not.toContain("Harjulinja")
  })

  it("palauttaa null kun sivu ei ole hankesivu", () => {
    expect(jasennaHankesivu("<html><body>ei mitaan</body></html>")).toBeNull()
  })
})

/*
 * YHTEYSHENKILOT (18.10.2026).
 *
 * Johannes Anttila-Lansisalmi-hankkeesta: "ei ole poimittu
 * yhteyshenkiloita vaikka ne ovat saatavilla". Mitattu 52 sivun yli:
 * 151 henkiloa, 69 eri nimea, ja vain 3 sivua ilman yhtaan.
 */
describe("jasennaYhteyshenkilot", () => {
  const lohko = (sisalto: string) =>
    `<html><body><div class="well"><h3 class="title">Lisätietoja</h3>${sisalto}</div></body></html>`

  it("lukee nimen, nimikkeen ja puhelimen", () => {
    const html = lohko(
      "<p><strong>Maria Arola</strong><br />Asiantuntija, ympäristö<br />puh. 030 395 5562</p>"
    )
    expect(jasennaYhteyshenkilot(html)).toEqual([
      {
        nimi: "Maria Arola",
        nimike: "Asiantuntija, ympäristö",
        puhelin: "030 395 5562",
        sahkoposti: null,
        organisaatio: "Fingrid Oyj",
      },
    ])
  })

  /*
   * `<br>` ON KORVATTAVA RIVINVAIHDOLLA. `.text()` liittaa rivit ilman
   * valimerkkia, jolloin tuloksena on "Maria ArolaAsiantuntija,
   * ympäristöpuh. 030 395 5562" eika nimea voi erottaa nimikkeesta.
   */
  it("ei liimaa nimea ja nimiketta yhteen", () => {
    const html = lohko(
      "<p><strong>Pasi Saari</strong><br />Vanhempi asiantuntija<br />puh. 030 395 5178</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h[0].nimi).toBe("Pasi Saari")
    expect(h[0].nimike).toBe("Vanhempi asiantuntija")
  })

  /* Valiotsikot ovat omia p-elementteja eivatka ole nimia. */
  it("ohittaa valiotsikot", () => {
    const html = lohko(
      "<p><strong>YVA-menettely</strong></p>" +
        "<p><strong>Tommi Raussi</strong><br />Projektipäällikkö<br />puh. 040 350 7500</p>" +
        "<p><strong>Yleissuunnittelu</strong></p>"
    )
    expect(jasennaYhteyshenkilot(html).map((h) => h.nimi)).toEqual(["Tommi Raussi"])
  })

  /*
   * Mittaus 52 sivun yli loysi kolme yritysta henkiloiden seassa:
   * "Destia Oy", "Eltel Networks Oy", "Rakennuttaja Fingrid Oyj".
   */
  it("ei ota yritysta henkiloksi", () => {
    const html = lohko(
      "<p><strong>Destia Oy</strong><br />puh. 020 444 11</p>" +
        "<p><strong>Rakennuttaja Fingrid Oyj</strong><br />puh. 030 395 5000</p>" +
        "<p><strong>Eero Kujanen</strong><br />Päällikkö<br />puh. 030 395 5190</p>"
    )
    expect(jasennaYhteyshenkilot(html).map((h) => h.nimi)).toEqual(["Eero Kujanen"])
  })

  it("ei toista samaa nimea", () => {
    const html = lohko(
      "<p><strong>Eero Kujanen</strong><br />Päällikkö<br />puh. 030 395 5190</p>" +
        "<p><strong>Eero Kujanen</strong><br />Päällikkö<br />puh. 030 395 5190</p>"
    )
    expect(jasennaYhteyshenkilot(html)).toHaveLength(1)
  })

  /*
   * Lohko rajataan otsikkoon: sivulla on muita `div.well`-lohkoja
   * (Liitteet, uutiset) joissa on nimia ilman yhteystietoja.
   */
  it("lukee vain Lisatietoja-lohkon", () => {
    const html =
      '<html><body><div class="well"><h3 class="title">Liitteet</h3>' +
      "<p><strong>Jussi Kirjoittaja</strong><br />raportin laatija</p></div></body></html>"
    expect(jasennaYhteyshenkilot(html)).toEqual([])
  })

  /*
   * YKSI <p> VOI SISALTAA MONTA HENKILOA. Aiempi versio luki nimen
   * kappaleen ensimmaiselta rivilta ja liitti KAIKEN muun hanen
   * nimikkeekseen, joten jalkimmaiset nimet ja numerot katosivat
   * nimikkeen sisaan. Mitattu 2.11.2026: 6 henkiloa 169:sta.
   */
  it("lukee monta henkiloa samasta kappaleesta", () => {
    const html = lohko(
      "<p><strong>Mikko Kuoppala</strong><br />Vanhempi asiantuntija<br />" +
        "puh. 030 395 5220<br /><strong>Eero Kujanen</strong><br />" +
        "Asiantuntija, puustonpoisto<br />puh. 030 395 5190</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h.map((x) => x.nimi)).toEqual(["Mikko Kuoppala", "Eero Kujanen"])
    expect(h[0].nimike).toBe("Vanhempi asiantuntija")
    expect(h[0].puhelin).toBe("030 395 5220")
    expect(h[1].puhelin).toBe("030 395 5190")
  })

  /*
   * NIMI EI OLE AINA RIVILLA 0. Siikajoki-Raahen sivulla kappale alkaa
   * tyonantajalla, ja juuri se jatti sivun ainoan yhteyshenkilon
   * poimimatta.
   */
  it("lukee tyonantajan nimea edeltavalta rivilta", () => {
    const html = lohko(
      "<p><strong>Rakennuttaja Fingrid Oyj</strong></p>" +
        "<p><strong>TLT Building Oy</strong><br /><strong>Erkka Salmi</strong>" +
        "<br />Sijoitussuunnittelu<br />puh. 040 713 1803</p>"
    )
    expect(jasennaYhteyshenkilot(html)).toEqual([
      {
        nimi: "Erkka Salmi",
        nimike: "Sijoitussuunnittelu",
        puhelin: "040 713 1803",
        sahkoposti: null,
        organisaatio: "TLT Building Oy",
      },
    ])
  })

  /* Saateteksti nimen edella ei ole tyonantaja eika saa estaa poimintaa. */
  it("lukee nimen myos saatetekstin jalkeen", () => {
    const html = lohko(
      "<p>Fingrid Oyj:ssä lisätietoja hankkeesta antaa:<br />" +
        "<strong>Antti Linna</strong><br />Projektipäällikkö<br />puh. 040 522 7124</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h.map((x) => x.nimi)).toEqual(["Antti Linna"])
    expect(h[0].organisaatio).toBe("Fingrid Oyj")
  })

  /*
   * ILMOITETTU OSOITE OTETAAN, PAATELTYA EI. Sivu kertoo myos saannon
   * "etunimi.sukunimi@fingrid.fi", mutta sita ei sovelleta: saanto ei
   * kerro miten a ja o kirjoitetaan osoitteessa.
   */
  it("purkaa [at]-muodossa ilmoitetun osoitteen", () => {
    const html = lohko(
      "<p><strong>Urakoitsija ENP Power Oy:</strong></p>" +
        "<p><strong>Lauri Tolpanniemi</strong><br />Työmaapäällikkö<br />" +
        "puh. 050 366 1566<br />lauri.tolpanniemi[at]enp.fi</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h[0].sahkoposti).toBe("lauri.tolpanniemi@enp.fi")
    expect(h[0].nimike).toBe("Työmaapäällikkö")
    expect(h[0].organisaatio).toBe("ENP Power Oy")
  })

  it("ei paattele osoitetta sivun kertomasta saannosta", () => {
    const html = lohko(
      "<p><strong>Maria Arola</strong><br />Asiantuntija<br />puh. 030 395 5562</p>" +
        "<p>Sähköpostiosoitteemme ovat muotoa etunimi.sukunimi@fingrid.fi.</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h).toHaveLength(1)
    expect(h[0].sahkoposti).toBeNull()
  })

  /*
   * VIERAS VERKKOTUNNUS KUMOAA OLETUSTYONANTAJAN. Isohaaran sivulla
   * urakoitsijan vaki on omassa kappaleessaan ilman yritysotsikkoa, ja
   * oletus olisi kirjannut heidat Fingridille. Yrityksen nimea ei
   * arvata verkkotunnuksesta.
   */
  it("ei kirjaa Fingridia tyonantajaksi kun osoite on toisen yhtion", () => {
    const html = lohko(
      "<p><strong>Ümit Menekse</strong><br />Maanomistajien yhdyshenkilö<br />" +
        "puh. 046 841 26 97<br />umit.menekse[at]tecnolines.it</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h.map((x) => x.nimi)).toEqual(["Ümit Menekse"])
    expect(h[0].organisaatio).toBeNull()
  })

  /*
   * YHDYSNIMEN ISO KIRJAIN JA Ü. Kirjainluokka `[A-ZÅÄÖ][a-zåäö-]+`
   * hylkasi molemmat, ja kumpikaan mittari ei nahnyt sita koska ne
   * kayttivat samaa kuviota kuin jasennin.
   */
  it("hyvaksyy yhdysnimen ja muut kuin suomalaiset kirjaimet", () => {
    const html = lohko(
      "<p><strong>Erkka-Pekka Impivaara</strong><br />Asiantuntija<br />puh. 030 395 5606</p>"
    )
    expect(jasennaYhteyshenkilot(html).map((x) => x.nimi)).toEqual([
      "Erkka-Pekka Impivaara",
    ])
  })

  /* "Simo Keskisaari (Konrap Oy)" -- sulkeet estivat nimikuvion osumisen. */
  it("lukee tyonantajan nimen perassa olevista sulkeista", () => {
    const html = lohko(
      "<p><strong>Simo Keskisaari (Konrap Oy)</strong><br />Työmaavalvonta<br />" +
        "puh. 050 326 5782</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h[0].nimi).toBe("Simo Keskisaari")
    expect(h[0].organisaatio).toBe("Konrap Oy")
  })

  /*
   * "Infratek Finland Oy (OMEXOM)" on urakkaosuuden otsikko, ei
   * henkilo. Ilman tata kolme Infratekin henkiloa kirjautui
   * Fingridille.
   */
  it("tunnistaa yrityksen myos aputunnuksen suluissa", () => {
    const html = lohko(
      "<p><strong>Infratek Finland Oy (OMEXOM)</strong></p>" +
        "<p><strong>Charles Cocuelle</strong><br />Project manager<br />puh. 040 111 2222</p>"
    )
    expect(jasennaYhteyshenkilot(html)[0].organisaatio).toBe("Infratek Finland Oy")
  })

  /* Virolainen Oü puuttui yritysmuotojen listasta. */
  it("tunnistaa virolaisen yritysmuodon", () => {
    const html = lohko(
      "<p><strong>Pääurakoitsija Leonhard Weiss Oü:</strong></p>" +
        "<p><strong>Janis Perzins</strong><br />Työmaapäällikkö<br />puh. 040 111 3333</p>"
    )
    expect(jasennaYhteyshenkilot(html)[0].organisaatio).toBe("Leonhard Weiss Oü")
  })

  /* Ulkomaisilla urakoitsijoilla numerosta puuttuu "puh."-etuliite. */
  it("lukee puhelimen myos ilman etuliitetta", () => {
    const html = lohko(
      "<p><strong>Deniss Vinokurovs</strong><br />Projektipäällikkö<br />+371 286 57428</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h[0].puhelin).toBe("+371 286 57428")
    expect(h[0].nimike).toBe("Projektipäällikkö")
  })

  /* Nimikkeen oma luku ei ole puhelinnumero. */
  it("ei lue nimikkeen lukua puhelimeksi", () => {
    const html = lohko(
      "<p><strong>Mika Kuivalainen</strong><br />Työmaavalvoja (osat 2-4)</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h[0].puhelin).toBeNull()
    expect(h[0].nimike).toBe("Työmaavalvoja (osat 2-4)")
  })

  it("kestaa tyhjan", () => {
    expect(jasennaYhteyshenkilot("")).toEqual([])
  })
})

/*
 * NAMA KOLME LOYTYIVAT VASTA KUN KUIVAHARJOITUKSEN 7 RIVIA LUETTIIN
 * YKSITELLEN. Yhden sivun testi nautti kaikki kolme lapi.
 */
describe("jasennaYhteyshenkilot - kuivaharjoituksen loydot", () => {
  const lohko = (sisalto: string) =>
    `<html><body><div class="well"><h3 class="title">Lisätietoja</h3>${sisalto}</div></body></html>`

  /*
   * Numero jai NIMIKKEESEEN kolmella rivilla seitsemasta, koska kuvio
   * vaati numeron heti "puh."-sanan jalkeen eika hyvaksynyt maatunnusta.
   */
  it("lukee puhelimen myos maatunnuksella", () => {
    const html = lohko(
      "<p><strong>Hannu Kuikka</strong><br />Vanhempi projektipäällikkö<br />puh. +358 30 395 5216</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h[0].puhelin).toBe("+358 30 395 5216")
    expect(h[0].nimike).toBe("Vanhempi projektipäällikkö")
  })

  /*
   * Huittinen-Forssa-sivulla on urakoitsijan projektipaallikko. Hanen
   * organisaatioksi ei saa kirjata Fingridia.
   */
  it("ei kirjaa toisen yhtion vakea Fingridille", () => {
    const html = lohko(
      "<p><strong>Jaakko Marttila</strong><br />Electromontaj S.A. projektipäällikkö<br />puh. +358 44 4253772</p>" +
        "<p><strong>Eero Kujanen</strong><br />Päällikkö<br />puh. 030 395 5190</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h.find((x) => x.nimi === "Jaakko Marttila")?.organisaatio).toBeNull()
    expect(h.find((x) => x.nimi === "Eero Kujanen")?.organisaatio).toBe("Fingrid Oyj")
  })

  /* Pelkka nimi ilman nimiketta ja numeroa ei ole yhteystieto. */
  it("ei ota pelkkaa nimea", () => {
    expect(jasennaYhteyshenkilot(lohko("<p><strong>Jari Heikkilä</strong></p>"))).toEqual([])
  })
})

/*
 * KOLME MUOTOA SAMASSA LOHKOSSA (D-329).
 *
 * Katkelmat ovat oikeilta sivuilta, jotta muodot ovat tarkistettavissa
 * jos Fingrid muuttaa sivujaan.
 */
describe("jasennaYhteyshenkilot - muodot B ja C", () => {
  const lohko = (sisalto: string) =>
    `<html><body><div class="well"><h3 class="title">Lisätietoja</h3>${sisalto}</div></body></html>`

  /*
   * MUOTO B, murtopera-pysayspera: yksi <p>, henkilot <br>-eroteltuina,
   * organisaatio ja nimike kaksoispisteen edella, puhelin "p.".
   */
  it("lukee muodon B: organisaatio, nimike: Nimi, p. numero", () => {
    const html = lohko(
      "<p>Fingrid Oyj, asiantuntija, maankäyttö ja ympäristö: Maria Arola, p. 030&nbsp;395 5562<br>" +
        "Fingrid Oyj, erikoisasiantuntija, voimajohtojen reittisuunnittelu: Pasi Saari, p. 030 395 5178<br><br></p>"
    )
    expect(jasennaYhteyshenkilot(html)).toEqual([
      {
        nimi: "Maria Arola",
        nimike: "asiantuntija, maankäyttö ja ympäristö",
        puhelin: "030 395 5562",
        sahkoposti: null,
        organisaatio: "Fingrid Oyj",
      },
      {
        nimi: "Pasi Saari",
        nimike: "erikoisasiantuntija, voimajohtojen reittisuunnittelu",
        puhelin: "030 395 5178",
        sahkoposti: null,
        organisaatio: "Fingrid Oyj",
      },
    ])
  })

  /*
   * MUOTO C, helsingin-kaapeli: nimi omassa <h4>:ssa, nimike ja
   * puhelin seuraavassa <p>:ssa. Tama jatti 14 rivia poimimatta.
   */
  it("lukee muodon C: nimi otsikossa, nimike ja puhelin seuraavassa kappaleessa", () => {
    const html = lohko(
      "<h4>Rakennuttaja Fingrid Oyj</h4>" +
        "<h4>Risto Ryynänen</h4><p>Projektijohtaja<br>puh. 030 395 5219</p>" +
        "<h4>Jussi Rantanen</h4><p>Projektipäällikkö (kaapeliyhteys)<br>puh. 030 395 5274</p>"
    )
    expect(jasennaYhteyshenkilot(html).map((h) => [h.nimi, h.nimike, h.puhelin])).toEqual([
      ["Risto Ryynänen", "Projektijohtaja", "030 395 5219"],
      ["Jussi Rantanen", "Projektipäällikkö (kaapeliyhteys)", "030 395 5274"],
    ])
  })

  /*
   * VALIOTSIKKO KERTOO TYONANTAJAN. Konsultti ei ole Fingridin vakea,
   * ja otsikosta tiedamme oikean yrityksen -- se on parempi kuin null.
   */
  it("lukee tyonantajan valiotsikosta", () => {
    const html = lohko(
      "<h4>Rakennuttaja Fingrid Oyj</h4>" +
        "<h4>Risto Ryynänen</h4><p>Projektijohtaja<br>puh. 030 395 5219</p>" +
        "<h4><strong>Kaapeliyhteyden yleissuunnittelu ja rakennuttajakonsultti Ramboll Finland Oy</strong></h4>" +
        "<p>&nbsp;</p><p><strong>Jari Heikkilä</strong></p>" +
        "<p>Rakennuttajakonsultti<br>puh. 040 725 2673&nbsp;</p>"
    )
    const h = jasennaYhteyshenkilot(html)
    expect(h.find((x) => x.nimi === "Risto Ryynänen")?.organisaatio).toBe("Fingrid Oyj")
    const jari = h.find((x) => x.nimi === "Jari Heikkilä")
    expect(jari?.organisaatio).toBe("Ramboll Finland Oy")
    expect(jari?.nimike).toBe("Rakennuttajakonsultti")
    expect(jari?.puhelin).toBe("040 725 2673")
  })

  /* "p." vaatii pisteen: `\bp\b` osui aiemmin nimikkeeseen. */
  it("ei lue p-kirjainta nimikkeesta puhelimeksi", () => {
    const html = lohko("<p><strong>Lotta Hakanpää</strong><br>viestintä päällikkö<br>puh. 030 395 5365</p>")
    const h = jasennaYhteyshenkilot(html)
    expect(h[0].nimike).toBe("viestintä päällikkö")
    expect(h[0].puhelin).toBe("030 395 5365")
  })
})

describe("jasennaYhteyshenkilot - muoto E: nimi nimikkeen jaljessa (D-391)", () => {
  /*
   * Harjulinjan jatkon sivu 8.11.2026. Yritys ja nimike ovat ENNEN
   * nimea, puhelin perassa, ja molemmat henkilot ovat samassa <p>:ssa
   * <br>-eroteltuina. Entiteetit ovat numeerisia, kuten sivulla.
   */
  const HTML = [
    '<div class="well">',
    '<h3 class="title">Lis&#228;tietoja</h3>',
    "<p>Fingrid Oyj, vanhempi asiantuntija, ymp&#228;rist&#246; Marja Nuottaj&#228;rvi p. 030 395 5301<br />",
    "Fingrid Oyj, vanhempi asiantuntija, voimajohtojen reittisuunnittelu Pasi Saari, puh. 030&nbsp;395 5178</p>",
    "</div>",
  ].join("")

  it("poimii molemmat henkilot nimikkeineen ja numeroineen", () => {
    expect(jasennaYhteyshenkilot(HTML)).toEqual([
      {
        nimi: "Marja Nuottajärvi",
        nimike: "vanhempi asiantuntija, ympäristö",
        puhelin: "030 395 5301",
        sahkoposti: null,
        organisaatio: "Fingrid Oyj",
      },
      {
        nimi: "Pasi Saari",
        nimike: "vanhempi asiantuntija, voimajohtojen reittisuunnittelu",
        puhelin: "030 395 5178",
        sahkoposti: null,
        organisaatio: "Fingrid Oyj",
      },
    ])
  })

  it("ei ota yritysnimea henkiloksi", () => {
    /*
     * "Fingrid Oyj" on kaksi isolla alkavaa sanaa, joten ilman
     * `EI_HENKILO`-estetta se kelpaisi nimeksi.
     */
    const html =
      '<div class="well"><h3 class="title">Lisätietoja</h3>' +
      "<p>Fingrid Oyj puh. 030 395 5000</p></div>"
    expect(jasennaYhteyshenkilot(html)).toEqual([])
  })

  it("purkaa heksamuotoisen entiteetin", () => {
    /* Kasin yllapidetty lista ei tuntenut heksamuotoa lainkaan. */
    const html =
      '<div class="well"><h3 class="title">Lis&#xE4;tietoja</h3>' +
      "<p>Fingrid Oyj, asiantuntija Marja Nuottaj&#xE4;rvi p. 030 395 5301</p></div>"
    expect(jasennaYhteyshenkilot(html)[0]?.nimi).toBe("Marja Nuottajärvi")
  })
})
