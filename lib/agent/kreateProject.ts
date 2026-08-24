/*
 * KREATEN HANKESIVUN SISÄLTÖ.
 *
 * Kreaten WordPress-rajapinta palauttaa koko hankesivun HTML:nä
 * `content.rendered`-kentässä, ja kerääjä tallentaa sen sellaisenaan.
 * Resolveri ei kuitenkaan lukenut sitä lainkaan: hankkeen kuvaukseksi
 * jäi pelkkä otsikko ja arvioitu valmistuminen puuttui kokonaan.
 *
 * Mitattu 25.8.2026, 41 dokumenttia:
 *
 *   Valmistuminen     41/41   rakenteisena kenttänä (12/2026)
 *   Osoite            34/41   "Maalismaantie 1, Ii", "Jokikatu 57, Porvoo"
 *   Projektinjohtaja  18/41   nimetty henkilö
 *   kuvausteksti      41/41   mediaani 2 115 merkkiä (näytettiin 70)
 *
 * RAKENTEINEN KENTTÄ ON PAREMPI KUIN TEKSTISTÄ PÄÄTTELY. Sama tieto
 * saataisiin osittain proosasta ("urakka valmistuu joulukuussa 2026"),
 * mutta se osui vain 20 dokumenttiin 41:stä. Lähteen oma kenttä osuu
 * kaikkiin eikä vaadi arvausta.
 *
 * KAKSI ANSAA, molemmat havaittu mittaamalla:
 *
 *   1. Sivun alalaidassa on "muut hankkeet" -karuselli, jossa on TOISTEN
 *      hankkeiden nimiä ja valmistumisaikoja. Tekstin loppuosaa ei saa
 *      lukea — muuten hankkeelle kirjautuu naapurin päivämäärä. Ensimmäinen
 *      yritykseni poimi juuri sen.
 *   2. Murupolku ("Etusivu") vuotaa keskelle kuvaustekstiä, koska se on
 *      hero-osion ja leipätekstin välissä.
 */

/* Hankkeen oma sisältö loppuu tähän; sen jälkeen on henkilöstö ja karusellit. */
const KALUSTEET =
  /<section[^>]*id="block-(project-employees|show-posts|show-references)/i

export type KreateFields = {
  address: string | null
  /* Lähteen oma muoto, esim. "12/2026". */
  completionText: string | null
  /* ISO-päivä, kuukauden viimeinen. */
  estimatedCompletion: string | null
  projectManager: string | null
}

function puhdista(html: string): string {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#039;|&#8216;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * "12/2026" -> "2026-12-31". Kuukauden VIIMEINEN päivä, samoin kuin
 * parseFinnishCompletionDate: arviota käytetään automaattiseen
 * "valmistunut"-siirtoon, ja liian aikainen päivä merkitsisi hankkeen
 * valmiiksi kesken kaiken.
 */
export function kreateCompletionToIso(value: string | null | undefined): string | null {
  const m = String(value ?? "").trim().match(/^(\d{1,2})\s*\/\s*(\d{4})$/)
  if (!m) return null

  const kuukausi = Number(m[1])
  const vuosi = Number(m[2])
  if (kuukausi < 1 || kuukausi > 12) return null
  /* Selvästi virheellinen vuosi on kirjoitusvirhe, ei tieto. */
  if (vuosi < 2000 || vuosi > 2100) return null

  const viimeinen = new Date(Date.UTC(vuosi, kuukausi, 0))
  return viimeinen.toISOString().slice(0, 10)
}

/*
 * Kenttälohko on <div class="row"><h4>Osoite</h4><p>Lieksa</p></div>.
 * Poiminta on rakenteinen eikä sijaintiin perustuva, koska sijainti
 * osoittautui epäluotettavaksi (ks. karuselli yllä). Mitattu: hahmo
 * <h4>Valmistuminen</h4> esiintyy jokaisessa dokumentissa TÄSMÄLLEEN
 * kerran, joten väärän lohkon osumisen vaaraa ei ole.
 */
export function parseKreateFields(html: string | null | undefined): KreateFields {
  const h = String(html ?? "")
  const out: Record<string, string> = {}

  const re = /<h4>\s*([^<]{2,40}?)\s*<\/h4>\s*<p>\s*([\s\S]{0,300}?)\s*<\/p>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(h))) {
    const avain = m[1].trim()
    const arvo = puhdista(m[2])
    if (arvo && !(avain in out)) out[avain] = arvo
  }

  const completionText = out["Valmistuminen"] ?? null

  return {
    address: out["Osoite"] ?? null,
    completionText,
    estimatedCompletion: kreateCompletionToIso(completionText),
    projectManager: out["Projektinjohtaja"] ?? null,
  }
}

/* Alle tämän jäävä teksti ei ole kuvaus vaan jäännös. */
const MIN_PITUUS = 120

export function parseKreateDescription(
  html: string | null | undefined,
  title?: string | null
): string | null {
  const h = String(html ?? "")
  if (!h) return null

  const raja = h.search(KALUSTEET)
  const rajattu = raja > 0 ? h.slice(0, raja) : h

  let teksti = puhdista(
    rajattu
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      /* Kenttälohko näytetään omina kenttinään, ei kuvauksen seassa. */
      .replace(/<h4>[\s\S]{0,60}?<\/h4>\s*<p>[\s\S]{0,300}?<\/p>/gi, " ")
  )

  /* Murupolku on hero-osion ja leipätekstin välissä. */
  teksti = teksti.replace(/(^|\s)Etusivu(\s|$)/g, " ").replace(/\s+/g, " ").trim()

  /*
   * Otsikko toistuu hero-osiossa kuvauksen alussa. Se ei ole väärin,
   * mutta hankkeen nimi näytetään jo erikseen otsikkona.
   */
  const t = String(title ?? "").trim()
  if (t && teksti.toLowerCase().startsWith(t.toLowerCase())) {
    teksti = teksti.slice(t.length).trim()
  }

  return teksti.length >= MIN_PITUUS ? teksti : null
}
