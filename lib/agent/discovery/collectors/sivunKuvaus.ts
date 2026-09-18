import type { CheerioAPI } from "cheerio"

/*
 * SIVUN KUVAUS ALUSTA ASTI (D-194).
 *
 * D-190:n mittaus (`scripts/measure-puuttuva-alku.ts`) loysi kuusi
 * keraajaa, joiden tallentama kuvaus alkaa vasta sivun keskelta. Syy ei
 * ollut yksi vaan kuusi erilaista valintaa, jotka kaikki jattivat sivun
 * johdannon pois:
 *
 *   Puolustuskiinteistot  ingressi omassa elementissaan, luettiin vain <p>:t
 *   Kaarina               luettiin vain "Suunnittelun tavoitteet"
 *   Naantali, Ylojarvi    valittiin PISIN kappale, muut hylattiin
 *   Jamsa                 luettiin tavoiteosion ensimmainen kappale
 *   Porvoo                luettiin ensimmainen kappale
 *
 * Johdanto on se, joka kertoo MIKA hanke on ("Kaavatyossa kehitetaan
 * katuyhteytta Krossin ja Lakarin yritysalueille"), joten ilman sita
 * kuvaus on kontekstiton ja yrityspoiminta sokea sille.
 *
 * Funktiot ovat puhtaita, jotta keraaja, testit ja backfill kayttavat
 * samaa saantoa.
 */

const KUVAUKSEN_BUDJETTI = 1500

export function siisti(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim()
}

/*
 * YHTEYSTIETOLAUSEET POIS. Kaavasivun kappale paattyy usein lauseeseen
 * "Asemakaavaa ohjaa projektiarkkitehti X, p. 040 ..., etunimi.sukunimi@..."
 * - se ei ole kuvausta, ja yhteystiedot kerataan omaan kenttaansa.
 * Pudotetaan vain se lause, ei koko kappaletta. "p. 040" ei katkaise
 * lausetta, koska jakokohta vaatii perään ison alkukirjaimen.
 */
const YHTEYSTIETOLAUSE = /@|\bp\.\s*0\d|\b0\d{1,3}[\s-]?\d{3}[\s-]?\d{3,4}\b|^Yhteystiedot\b/i

export function poistaYhteystietolauseet(text: string): string {
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÄÖÅ])/)
    .filter((lause) => !YHTEYSTIETOLAUSE.test(lause))
    .join(" ")
    .trim()
}

/*
 * Osat jarjestyksessa, tyhjat ja toistot pois. Ensimmainen osa otetaan
 * aina, seuraavat vain budjetin rajoissa (sama kuin `collectDescription`).
 * Osa, joka sisaltyy jo aiempaan, ohitetaan: sama teksti on usein
 * sivulla kahdesti (ingressi + rungon ensimmainen kappale).
 */
export function koostaKuvaus(osat: (string | null | undefined)[]): string | null {
  const kept: string[] = []
  let length = 0
  for (const raw of osat) {
    const text = poistaYhteystietolauseet(siisti(raw))
    if (!text) continue
    if (kept.some((k) => k.includes(text))) continue
    if (length > 0 && length + text.length > KUVAUKSEN_BUDJETTI) break
    kept.push(text)
    length += text.length
  }
  return kept.length > 0 ? kept.join("\n\n") : null
}

/* Kappale, joka on pelkka linkki, on liite tai viittaus - ei kuvausta. */
function onPelkkaLinkki($: CheerioAPI, p: any): boolean {
  const teksti = siisti($(p).text())
  const linkit = siisti($(p).find("a").text())
  return teksti.length > 0 && linkit === teksti
}

/* ----------------------------------------------------------------------- */

/*
 * Senaatin uutissivu: uudemmissa jutuissa ingressi on meta-osion
 * `span.article__ingres`-elementissa eika <p>:ssa. Vanhemmissa se on
 * rungon ensimmainen kappale ja elementti on tyhja.
 */
export function puolustuskiinteistotKuvaus($: CheerioAPI): string | null {
  const ingressi = siisti($(".article__ingres").first().text())
  /* "Lue myös: ..." on linkkilista muihin juttuihin, ei tata hanketta. */
  const runko = $("article p")
    .toArray()
    .map((el) => siisti($(el).text()))
    .filter((p) => p && !/^Lue myös\b/i.test(p))
    .join(" ")
  if (!ingressi) return runko || null
  if (runko.includes(ingressi)) return runko
  return [ingressi, runko].filter(Boolean).join(" ")
}

/*
 * Kaarinan kaavasivu: ingressi `.field--name-field-description`, sitten
 * h2-otsikoidut osiot. Otsikon kentan jalkeinen sisar on osion teksti.
 */
export function kaarinaKuvaus($: CheerioAPI): string | null {
  const osio = (otsikko: RegExp) => {
    const h2 = $("h2")
      .filter((_, el) => otsikko.test(siisti($(el).text())))
      .first()
    return h2.length ? siisti(h2.parent().next().text()) : null
  }
  return koostaKuvaus([
    $(".field--name-field-description").first().text(),
    osio(/^Sijainti$/i),
    osio(/Suunnittelun tavoitteet/i),
  ])
}

/*
 * Naantalin kaavasivu: kaikki rungon kappaleet jarjestyksessa. Menettely-
 * kappaleet (hallitus, valitus, muistutus) pudotetaan kuten ennenkin.
 */
export function naantaliKuvaus($: CheerioAPI, menettely: RegExp): string | null {
  const kappaleet = $(".field--name-body")
    .first()
    .find("p")
    .toArray()
    .map((p) => siisti($(p).text()))
    .filter((p) => p.length > 40 && !menettely.test(p))
  return koostaKuvaus(kappaleet)
}

/*
 * Jamsan kaavasivu: h4-otsikoidut osiot. Sijainti kertoo alueen ja usein
 * sen koon ("n. 1,3 hehtaaria"), tavoitteet sen mita rakennetaan.
 */
export function jamsaKuvaus($: CheerioAPI): string | null {
  const article = $("main").length ? $("main") : $("body")
  const osio = (otsikko: RegExp) => {
    const h4 = article
      .find("h4")
      .filter((_, el) => otsikko.test(siisti($(el).text())))
      .first()
    if (!h4.length) return []
    return h4
      .nextUntil("h4")
      .filter("p")
      .toArray()
      .map((p) => siisti($(p).text()))
      .filter((p) => p.length > 20)
  }
  return koostaKuvaus([...osio(/^(Suunnittelualueen sijainti|Sijainti)$/i), ...osio(/^Kaavan tavoitteet$/i)])
}

/*
 * Ylojarven kaavasivu (WordPress): `.entry-content`in kappaleet ennen
 * ensimmaista h2:ta ("Kaava-aineisto"). Menettelykappaleet pudotetaan
 * samoilla saannoilla kuin ennen. Palauttaa null jos rakennetta ei ole,
 * jolloin keraaja kayttaa vanhaa valintaa.
 */
const YLOJARVI_OHITA = /^(Jaa|Kopioi|Löysitkö|Ylöjärven kaupunki \|)/i
const YLOJARVI_MENETTELY =
  /nähtävillä|yleisötilaisuus|valmistelee|valmistellaan|lisätietoja.*antaa|lisätietoja.*antavat|viimeksi muokattu|päätti.*käynnistää|vireille tulee|hyväksytty:\s*$/i

export function ylojarviKuvaus($: CheerioAPI): string | null {
  const sisalto = $(".entry-content").first()
  if (!sisalto.length) return null
  const kappaleet: string[] = []
  for (const el of sisalto.children().toArray()) {
    if (el.type === "tag" && /^h[1-3]$/.test(el.name)) break
    if (el.type !== "tag" || el.name !== "p") continue
    if (onPelkkaLinkki($, el)) continue
    const text = siisti($(el).text())
    if (text.length < 20 || YLOJARVI_OHITA.test(text) || YLOJARVI_MENETTELY.test(text)) continue
    kappaleet.push(text)
  }
  return koostaKuvaus(kappaleet)
}

/*
 * Porvoon kaavasivu: johdantokappaleet ennen ensimmaista valiotsikkoa.
 * Jokainen kappale ja otsikko on OMA `.prose`-lohkonsa (Gutenberg), joten
 * lohkot kaydaan jarjestyksessa ja pysahdytaan otsikkolohkoon. Otsikon
 * jalkeen tulee menettely ("Luonnosvaihe" - nahtavillaolo, mielipiteet,
 * kaavakavely), jota ei haluta kuvaukseen.
 */
export function porvooKuvaus($: CheerioAPI): string | null {
  const kappaleet: string[] = []
  for (const lohko of $(".prose").toArray()) {
    if ($(lohko).find("h1, h2, h3, h4").length > 0) break
    $(lohko)
      .children("p")
      .each((_, p) => {
        kappaleet.push(siisti($(p).text()))
      })
  }
  return koostaKuvaus(kappaleet)
}
