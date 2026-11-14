import * as cheerio from "cheerio"

/*
 * ROVANIEMEN KAAVATORIN KUVAUS RSS:STA (D-417).
 *
 * Syotteen kuvaus alkaa kaupunginosalinkilla ja <br>-rivinvaihdoilla:
 *
 *   <a href="...CityAreaId=30">Pohtimolampi, kaupunginosa nro 20</a><br />
 *   Arctic Lapland Investment Oy on hakenut asemakaavan laatimista ...
 *
 * Pelkka `.text()` liimasi ne: "kaupunginosa nro 20Arctic Lapland ...".
 * Kaupunginosa on jo osoitekentassa, joten linkki jatetaan pois ja
 * <br> muuttuu valilyonniksi. Kuvaus kertoo mita tehdaan, ei missa.
 */
export function rovaniemenKuvaus(html: string | null | undefined): string | null {
  if (!html) return null
  const $ = cheerio.load(`<div>${html}</div>`)
  $("a[href*='CityAreaId']").first().remove()
  $("br").replaceWith(" ")
  $("p, div, li").each((_, el) => {
    $(el).append(" ")
  })
  const teksti = $("div").first().text().replace(/ /g, " ").replace(/\s+/g, " ").trim()
  return teksti || null
}

/*
 * Kannassa jo oleva liimattu kuvaus: kaupunginosa edessa ilman
 * valilyontia. Irrotetaan vain kun kaupunginosan numero on suoraan
 * ison alkukirjaimen edessa -- sama rakenne kuin RSS:n linkki.
 */
export function korjaaLiimattuKuvaus(teksti: string | null | undefined): string | null {
  if (!teksti) return null
  const korjattu = String(teksti)
    /* "...nro 20Arctic" ja "...nro 1313. kaupunginosan" (numero toistuu heti). */
    .replace(/^[^.]{0,80}?kaupunginosa\s+nro\s+(\d+)(?=[A-ZÅÄÖ]|\1\.\s)/, "")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim()
  return korjattu || null
}
