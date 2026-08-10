/*
 * Hilman ilmoituksen julkinen osoite.
 *
 * MUOTO VAATII KAKSI TUNNISTETTA, ei pelkkää ilmoitusnumeroa:
 *
 *   https://www.hankintailmoitukset.fi/fi/public/procedure/29876/enotice/54530/
 *                                                          ^procedureId  ^noticeId
 *
 * Aiempi muoto `/fi/public/procurement/{noticeId}/notice/overview/overview`
 * palautti "Ilmoitusta ei löytynyt" - eikä sitä huomattu, koska Hilma on
 * yksisivusovellus: väärä polku vastaa 200:lla ja samalla 9 656 tavun
 * kuorella kuin oikea, joten pelkkä HTTP-status ei paljasta virhettä.
 *
 * Oikea muoto luettiin Hilman omasta hakutuloksesta (/fi/search) ja
 * varmistettiin avaamalla sivu selaimessa: se näyttää oikean ilmoituksen.
 * Kokeillut ja toimimattomat: pelkkä noticeId, eForms-tunniste
 * (1f1451f8-…-01), ja API:n palauttama id "EF-54530".
 */
const BASE = "https://www.hankintailmoitukset.fi/fi/public/procedure"

export function hilmaNoticeUrl(
  procedureId: string | number | null | undefined,
  noticeId: string | number | null | undefined
): string | null {
  const procedure = String(procedureId ?? "").trim()
  const notice = String(noticeId ?? "").trim()

  /*
   * Molemmat vaaditaan. Puuttuvalla tunnisteella syntyisi osoite joka
   * ohjaa etusivulle - se näyttäisi toimivalta linkiltä mutta veisi
   * väärään paikkaan, mikä on huonompi kuin puuttuva linkki.
   */
  if (!procedure || !notice || procedure === "0" || notice === "0") return null

  return `${BASE}/${encodeURIComponent(procedure)}/enotice/${encodeURIComponent(notice)}/`
}
