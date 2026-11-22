/*
 * LÄHDEHISTORIA LIITOKSESSA (22.11.2026).
 *
 * TIC:n "Liitä hankkeeseen" (approve + mergeIntoProjectId) ja automaattinen
 * täsmäys yhdistivät metatiedot muodossa `{ ...ehdokas, ...hanke }`, joten
 * hankkeen oma `source_history` voitti ja ehdokkaan lähde katosi. Mitattu
 * samana päivänä kahdesti: SRV:n tiedote Kuopion pääpoliisiasemaan ja NRC:n
 * tiedote HERI2 Nuppulinna–Jokelaan. Hankkeelta ei enää nähnyt, mistä tieto
 * tuli, eikä samaa osoitetta tunnistettu käsitellyksi.
 *
 * Yhdistäminen: hankkeen historia ensin, sitten ehdokkaan rivit joita siinä
 * ei vielä ole. Sama rivi tunnistetaan dokumentin id:stä, ja ilman sitä
 * osoitteesta. Jos ehdokkaalla ei ole historiaa lainkaan, sen oma lähde
 * kirjataan varariviksi, jotta liitos jättää aina jäljen.
 */

export type LahdehistoriaRivi = {
  source_name: string | null
  source_document_id: string | null
  document_url: string | null
  notice_type?: string | null
  main_type?: string | null
  date_published?: string | null
  is_contract_award?: boolean
  winners?: string[] | null
  seen_at: string
}

function sama(a: LahdehistoriaRivi, b: LahdehistoriaRivi): boolean {
  if (a.source_document_id && b.source_document_id) {
    return a.source_document_id === b.source_document_id
  }
  return Boolean(a.document_url) && a.document_url === b.document_url
}

function lista(arvo: unknown): LahdehistoriaRivi[] {
  return Array.isArray(arvo) ? (arvo.filter((r) => r && typeof r === "object") as LahdehistoriaRivi[]) : []
}

export function yhdistaLahdehistoria(
  hankkeen: unknown,
  ehdokkaan: unknown,
  varalla: LahdehistoriaRivi | null
): LahdehistoriaRivi[] {
  const tulos = [...lista(hankkeen)]
  const uudet = lista(ehdokkaan)
  const lisattavat = uudet.length > 0 ? uudet : varalla && (varalla.document_url || varalla.source_document_id) ? [varalla] : []

  for (const rivi of lisattavat) {
    if (!tulos.some((vanha) => sama(vanha, rivi))) tulos.push(rivi)
  }
  return tulos
}
