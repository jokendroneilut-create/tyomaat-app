/*
 * LAHDEOSOITTEEN KANONINEN MUOTO (D-266).
 *
 * Johannes 11.10.2026: *"en tieda miksi tama tuli uudelleen koska
 * hyvaksyin jo yhden vastaavan tic jonosta aiemmin."*
 *
 * Syy: sama STT-tiedote on kahdessa osoitemuodossa.
 *
 *   sttinfo.fi/release/72371945/hartela-rakentaa-...
 *   sttinfo.fi/tiedote/72371945/hartela-rakentaa-...
 *
 * `stt_haku` kayttaa suomenkielista polkua, yrityslahteet (hartela,
 * skanska...) englanninkielista. Kaksoiskappaleiden esto vertaa
 * osoitteita merkki merkilta, joten sama tiedote tuli kahdesti.
 *
 * Mitattu 11.10.2026: **26 asiakkaalle nakyvaa hanketta ja 42
 * ehdokasta** oli syntynyt kahdesti samasta tiedotteesta.
 *
 * TIEDOTTEEN ID ON IDENTITEETTI, EI POLKU EIKA OTSIKKOSLUGI. Slugi
 * voi muuttua kun julkaisija korjaa otsikkoa, ja kyselyparametrit
 * vaihtelevat (`publisherId`, `lang`).
 */

/* sttinfo.fi:n tiedotteen numero, jos osoite on STT:n. */
export function sttTiedotteenId(url: string | null | undefined): string | null {
  return (
    String(url ?? "").match(
      /sttinfo\.fi\/(?:tiedote|release|pressrelease|pressmeddelande)\/(\d+)/i
    )?.[1] ?? null
  )
}

/*
 * Vertailukelpoinen muoto. Muille kuin STT:n osoitteille palautetaan
 * alkuperainen siistittyna — tata EI yleisteta arvaamalla, koska
 * jokaisen sivuston osoitelogiikka on omansa.
 */
export function kanoninenLahdeUrl(url: string | null | undefined): string {
  const raaka = String(url ?? "").trim()
  if (!raaka) return ""

  const id = sttTiedotteenId(raaka)
  if (id) return `https://www.sttinfo.fi/tiedote/${id}`

  return raaka
}
