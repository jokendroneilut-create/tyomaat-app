import * as cheerio from "cheerio"
import { describe, expect, it } from "vitest"

import {
  jamsaKuvaus,
  kaarinaKuvaus,
  koostaKuvaus,
  naantaliKuvaus,
  porvooKuvaus,
  puolustuskiinteistotKuvaus,
  ylojarviKuvaus,
} from "./sivunKuvaus"

/*
 * SIVUN KUVAUS ALUSTA ASTI (D-194). Katkelmat noudattavat oikeiden
 * sivujen rakennetta (haettu 18.9.2026); teksti lyhennetty.
 */

describe("puolustuskiinteistotKuvaus", () => {
  it("lisaa meta-osion ingressin rungon eteen", () => {
    const $ = cheerio.load(`
      <article>
        <section class="article__meta"><span class="article__ingres">Ilmavoimien tukikohtaan Rissalaan nousee uusi materiaaliterminaali.</span></section>
        <div class="article__body"><p>Rakentaminen on edennyt aikataulussa.</p></div>
      </article>`)
    expect(puolustuskiinteistotKuvaus($)).toBe(
      "Ilmavoimien tukikohtaan Rissalaan nousee uusi materiaaliterminaali. Rakentaminen on edennyt aikataulussa."
    )
  })

  it("ei toista ingressia joka on jo rungossa", () => {
    const $ = cheerio.load(`
      <article>
        <span class="article__ingres">Halli on harjakorkeudessa.</span>
        <p>Halli on harjakorkeudessa.</p><p>Toinen kappale.</p>
      </article>`)
    expect(puolustuskiinteistotKuvaus($)).toBe("Halli on harjakorkeudessa. Toinen kappale.")
  })

  it("vanha juttu ilman ingressielementtia pysyy ennallaan", () => {
    const $ = cheerio.load(`<article><p>F-35-hävittäjien huoltotilojen rakentaminen Linnavuoressa.</p></article>`)
    expect(puolustuskiinteistotKuvaus($)).toBe("F-35-hävittäjien huoltotilojen rakentaminen Linnavuoressa.")
  })
})

describe("kaarinaKuvaus", () => {
  it("ottaa ingressin, sijainnin ja tavoitteet muttei nykytilannetta", () => {
    const $ = cheerio.load(`
      <article>
        <h1>A2830 Lakarin katuyhteyden asemakaava</h1>
        <div class="field--name-field-description">Kaavatyössä kehitetään katuyhteyttä Krossin ja Lakarin yritysalueille.</div>
        <div class="field--name-field-heading"><h2>Sijainti</h2></div>
        <div class="text-formatted"><p>Suunnittelualue sijaitsee moottoritien koillispuolella.</p></div>
        <div class="field--name-field-heading"><h2>Suunnittelun tavoitteet</h2></div>
        <div class="text-formatted"><p>Alueelle saadaan toimiva katuyhteys.</p></div>
        <div class="field--name-field-heading"><h2>Nykytilanne</h2></div>
        <div class="text-formatted"><p>Alueella ei ole asemakaavaa.</p></div>
      </article>`)
    expect(kaarinaKuvaus($)).toBe(
      "Kaavatyössä kehitetään katuyhteyttä Krossin ja Lakarin yritysalueille.\n\n" +
        "Suunnittelualue sijaitsee moottoritien koillispuolella.\n\n" +
        "Alueelle saadaan toimiva katuyhteys."
    )
  })
})

describe("naantaliKuvaus", () => {
  const menettely = /kaupunginhallitus|kaupunginvaltuusto|valitus|muistutus/i

  it("ottaa kappaleet jarjestyksessa eika vain pisinta", () => {
    const $ = cheerio.load(`
      <div class="field--name-body">
        <h2>Suunnittelualue, kaavan tarkoitus ja tavoite</h2>
        <p>Hellemaan alueelle laaditaan nyt uutta asemakaavaa Muurilan ja Nissilän tilojen ympäristöön.</p>
        <p>Suunnittelualue rajautuu Merimaskuntiehen, Ritaniemen omakotitaloalueeseen ja Ranniitun peltoaukeaan sekä kallioihin.</p>
        <p>Kaupunginhallitus hyväksyi osallistumis- ja arviointisuunnitelman kokouksessaan.</p>
      </div>`)
    const kuvaus = naantaliKuvaus($, menettely)!
    expect(kuvaus.startsWith("Hellemaan alueelle laaditaan")).toBe(true)
    expect(kuvaus).toContain("Suunnittelualue rajautuu")
    expect(kuvaus).not.toContain("Kaupunginhallitus")
  })
})

describe("jamsaKuvaus", () => {
  it("ottaa sijainnin ja tavoitteet mutta ei vaiheita", () => {
    const $ = cheerio.load(`
      <main><div class="layout-textblock__text">
        <h4>Suunnittelualueen sijainti</h4>
        <p>Suunnittelualue sijaitsee Hallin taajamassa. Suunnittelualueen koko on n. 1,3 hehtaaria.</p>
        <h4>Kaavan tavoitteet</h4>
        <p>Asemakaavan tavoitteena on muodostaa vakituisen asumisen alue.</p>
        <h4>Kaavan vaiheet</h4>
        <ul><li>Luonnos nähtävillä 16.-30.9.2025</li></ul>
      </div></main>`)
    expect(jamsaKuvaus($)).toBe(
      "Suunnittelualue sijaitsee Hallin taajamassa. Suunnittelualueen koko on n. 1,3 hehtaaria.\n\n" +
        "Asemakaavan tavoitteena on muodostaa vakituisen asumisen alue."
    )
  })
})

describe("ylojarviKuvaus", () => {
  it("ottaa johdannon jarjestyksessa ja pudottaa linkit ja menettelyn", () => {
    const $ = cheerio.load(`
      <div class="entry-content">
        <p>Raitiotien edellyttämä asemakaavoitus on tullut vireille ympäristölautakunnan päätöksellä.</p>
        <p>Asemakaavoituksen suunnittelualue sijaitsee Ylöjärven keskustan alueella.</p>
        <p><a href="/x.pdf">Raitiotien asemakaavoituksen käynnistäminen (kaupunginhallitus 3.10.2022)</a></p>
        <p>Kaavan osallistumis- ja arviointisuunnitelma oli nähtävillä 10.12.2025-20.3.2026.</p>
        <h2>Kaava-aineisto</h2>
        <p>Tämä on jo aineistoa eikä kuvausta.</p>
      </div>`)
    expect(ylojarviKuvaus($)).toBe(
      "Raitiotien edellyttämä asemakaavoitus on tullut vireille ympäristölautakunnan päätöksellä.\n\n" +
        "Asemakaavoituksen suunnittelualue sijaitsee Ylöjärven keskustan alueella."
    )
  })

  it("palauttaa nullin ilman sisaltolohkoa, jolloin keraaja kayttaa vanhaa valintaa", () => {
    expect(ylojarviKuvaus(cheerio.load("<p>jotain tekstiä tässä nyt</p>"))).toBeNull()
  })
})

describe("porvooKuvaus", () => {
  it("ottaa johdantokappaleet ensimmaiseen valiotsikkoon asti", () => {
    const $ = cheerio.load(`
      <p class="mt-half-gutter max-w-prose">Luonnoksen nähtävilläoloaika 19.8.-18.9.2026</p>
      <div class="prose md:prose-md"><p>Asemakaavassa tutkitaan asuinalueen laajentamista.</p></div>
      <div class="prose md:prose-md"><p>Kaavatyössä selvitetään alueen kehittämistä.</p></div>
      <div class="font-heading prose md:prose-md"><h2>Luonnosvaihe</h2></div>
      <div class="prose md:prose-md"><p>Osallisilla on mahdollisuus esittää mielipiteitä.</p></div>`)
    expect(porvooKuvaus($)).toBe(
      "Asemakaavassa tutkitaan asuinalueen laajentamista.\n\nKaavatyössä selvitetään alueen kehittämistä."
    )
  })
})

describe("yhteystiedot ja linkkilistat pois", () => {
  it("pudottaa yhteystietolauseen mutta sailyttaa kappaleen muun tekstin", () => {
    const $ = cheerio.load(`
      <div class="entry-content">
        <p>Tavoitteena on, että asemakaavan muutos saavuttaa lainvoiman vuoden 2027 aikana. Asemakaavaa ohjaa projektiarkkitehti Etunimi Sukunimi, p. 040 123 4567, etunimi.sukunimi@ylojarvi.fi.</p>
        <p>Asemakaavamuutoksella tavoitellaan lisää rakennusoikeutta. Yhteystiedot: kaavoituspäällikkö Etunimi Sukunimi, p. 044 123 4567.</p>
      </div>`)
    expect(ylojarviKuvaus($)).toBe(
      "Tavoitteena on, että asemakaavan muutos saavuttaa lainvoiman vuoden 2027 aikana.\n\n" +
        "Asemakaavamuutoksella tavoitellaan lisää rakennusoikeutta."
    )
  })

  it("jattaa Senaatin Lue myos -linkkilistan pois", () => {
    const $ = cheerio.load(`<article><p>Kasarmi peruskorjattiin.</p><p>Lue myös: Ensimmäinen kasarmi valmistui Upinniemeen</p></article>`)
    expect(puolustuskiinteistotKuvaus($)).toBe("Kasarmi peruskorjattiin.")
  })
})

describe("koostaKuvaus", () => {
  it("ohittaa tyhjat ja jo sisaltyvat osat", () => {
    expect(koostaKuvaus(["", "Pitkä teksti tässä.", "teksti tässä", null])).toBe("Pitkä teksti tässä.")
  })

  it("ottaa ensimmaisen osan aina mutta muut vain budjettiin asti", () => {
    const pitka = "a".repeat(1600)
    expect(koostaKuvaus([pitka, "lisää"])).toBe(pitka)
    expect(koostaKuvaus([])).toBeNull()
  })
})
