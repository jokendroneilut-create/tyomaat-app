import * as cheerio from "cheerio"

/*
 * PIHTIPUTAAN KAAVASIVUN KUVAUS (D-418).
 *
 * Johannes 14.11.2026: *"hankkeesta puuttuu kuvaus."* Keraaja luki koko
 * `.entry-content`-lohkon tekstina. Uudella sivulla (korttelit 53, 55 ja
 * 58, 11/2026) lohkoa ei ole lainkaan, joten kuvaus, liitteet ja vaihe
 * jaivat tyhjiksi. Vanhoilla sivuilla taas kuvaukseen tuli koko sivu:
 * otsikko kolmesti, murupolku ("Asuminen ja ympäristö » Kaavoitus ja
 * mittaus » ..."), kuvateksti, liitelista ja yhteystiedot.
 *
 * Molemmissa pohjissa kuvaus on Elementorin tekstiwidgeteissa
 * `[data-elementor-type="wp-page"]`-lohkossa ENNEN ensimmaista
 * "Yhteystiedot"-, "Ladattavat liitteet"- tai "Kaava-aineisto"-otsikkoa.
 * Kuvateksti ("Kuva 1. ...") jatetaan pois. Kappaleet erotetaan
 * valilyonnilla -- `.text()` liimasi ne ("16,5 ha.Tason alueen").
 */
const LOPETUSOTSIKKO = /^(yhteystiedot|ladattavat liitteet|kaava-aineisto|liitteet)\b/i
const KUVATEKSTI = /^kuva\s+\d+\s*\./i

export function pihtipudasKuvaus(html: string | null | undefined): string | null {
  if (!html) return null
  const $ = cheerio.load(html)
  /* <br> kappaleen sisalla: "jemina.lahtela@envineer.fiHankkeesta vastaava" */
  $("br").replaceWith(" ")
  const sivu = $('[data-elementor-type="wp-page"]').first()
  const juuri = sivu.length ? sivu : $(".entry-content").first()
  if (!juuri.length) return null

  const kappaleet: string[] = []
  for (const el of juuri.find(".elementor-widget-heading, .elementor-widget-text-editor").toArray()) {
    const w = $(el)
    if (w.hasClass("elementor-widget-heading")) {
      if (LOPETUSOTSIKKO.test(w.text().replace(/\s+/g, " ").trim())) break
      continue
    }
    const osat = w.find("p, li").length
      ? w.find("p, li").toArray().map((p) => $(p).text())
      : [w.text()]
    for (const osa of osat) {
      const t = osa.replace(/ /g, " ").replace(/\s+/g, " ").trim()
      if (!t || KUVATEKSTI.test(t)) continue
      kappaleet.push(t)
    }
  }
  const kuvaus = kappaleet.join(" ").trim()
  return kuvaus || null
}
