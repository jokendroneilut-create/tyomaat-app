/*
 * OAS:N "ALOITE"- JA "TAVOITTEET"-LUVUT (D-439).
 *
 * Johannes 19.11.2026 Kangasalan kaavasta 914 Tarastenjärvi: kaavasivulla
 * oli vain yksi tavoitelause, mutta sivun liitteenä olevassa OAS:ssa
 * kerrotaan kuka kaavaa hakee ja mitä hakija haluaa:
 *
 *   Aloite
 *   Aloitteen asemakaavan muuttamiseksi on tehnyt Tarasten Kiertotalousalue Oy.
 *   Hakemus asemakaavan muuttamiseksi saapui 26.3.2025 ...
 *   Aloitteen jättäjän tarkoituksena on muun muassa, että:
 *   • Nykyistä suurempi osa ... sijoittuu sisätiloihin ...
 *   Tavoitteet
 *   Suunnittelun tavoitteena on ...
 *
 * Aloitteen tekijä on hankkeen rakennuttaja, ja aloitteen sisältö kertoo
 * mitä alueelle on tulossa. Kumpikaan ei ole kaavasivulla.
 *
 * Mitattu 21 Kangasalan OAS:sta: luku on nimeltään "Aloite",
 * "Aloite/hakija" tai "SUUNNITTELUN ALOITE". Nimetty tekijä on kahdessa;
 * muissa aloitteen on tehnyt kaupunki tai nimeämätön maanomistaja, eikä
 * sellaista kirjata rakennuttajaksi.
 */

export type OasAloite = {
  /** Nimetty aloitteen tekijä (yhtiö tai yhteisö), ei kaupunki tai "maanomistaja". */
  aloitteentekija: string | null
  /** Aloite- ja Tavoitteet-lukujen teksti siistittynä, luettelot riveinä. */
  kuvaus: string | null
}

const ALOITE_OTSIKKO = /^(?:\d+\.?\s+)?(?:suunnittelun\s+)?aloite(?:\s*\/\s*hakija)?(?:\s+ja\s+tavoitteet)?\s*:?\s*(.*)$/i
const TAVOITE_OTSIKKO = /^(?:\d+\.?\s+)?(?:pää)?tavoitteet\s*:?\s*(.*)$|^(?:\d+\.?\s+)?suunnittelun\s+tavoitteet\s*:?\s*(.*)$/i

const ENIMMAISPITUUS = 1800

/* OAS-pohjan seuraavat luvut: pysäytetään näihin, vaikka edeltävä rivi olisi kesken. */
const SEURAAVA_LUKU =
  /^(?:\(\d+\)\s*)?(?:\d+\s+)?(?:lähtötiedot|lähtökohdat|suunnittelun lähtökohdat|maanomistus|suunnittelualueen (?:yleiskuvaus|sijainti)|kaavoitustilanne|osalliset|vaikutusten arviointi|selvitykset|tiedottaminen)\b/i

/* Sivun ylä- ja alatunnisteet: asianumero, sivunumero, kunnan yhteystietorivi. */
const TUNNISTE =
  /^(?:dnro|dno|asianumero|kla\/|\d+\s*\(\d+\)$)|p\.\s*0\d[\d\s]+\d\s+www\.|^\s*\d+\s*$|^PL\s+\d+,/i

/* Yleisnimiä, jotka eivät ole rakennuttaja. */
const EI_NIMI =
  /^(?:kaupunki|kunta|kaupungin|kunnan|alueen\s+maanomistaj|maanomistaj|yksityi|kiinteistönomistaj|elinympäristölautakunta|kaavoitus)/i

function onOtsikko(rivi: string): boolean {
  const r = rivi.trim()
  if (!r || r.length > 45) return false
  if (/^[•·\-–]/.test(r)) return false
  if (/[.,;:]$/.test(r)) return false
  if (r.split(/\s+/).length > 5) return false
  return /^(?:\d+\.?\s+)?\p{Lu}/u.test(r)
}

function siistiRivit(teksti: string): string[] {
  const rivit = teksti
    .normalize("NFC")
    .replace(/ /g, " ")
    .split(/\r?\n/)
    .map((r) => r.replace(/\s+/g, " ").trim())
  /* Toistuva rivi on sivun tunniste (kunnan nimi, osoite, asianumero). */
  const maarat = new Map<string, number>()
  for (const r of rivit) if (r) maarat.set(r, (maarat.get(r) ?? 0) + 1)
  return rivit.filter((r) => r && !TUNNISTE.test(r) && !((maarat.get(r) ?? 0) >= 2 && r.length > 25))
}

/* Rivitetty kappale yhdeksi: luettelomerkki aloittaa uuden rivin, tavutus "laati- minen" yhdistetään. */
function kappaleeksi(rivit: string[]): string {
  const ulos: string[] = []
  for (const r of rivit) {
    if (/^[•·]/.test(r) || !ulos.length) ulos.push(r.replace(/^[•·]\s*/, "– "))
    else ulos[ulos.length - 1] += ` ${r}`
  }
  return ulos
    /*
     * Tavutus "laati- minen" yhdistetään, mutta "osallistumis- ja arviointi"
     * ja "työpaikka- ja palvelu" ovat oikeita yhdysmerkkejä.
     */
    .map((k) =>
      k
        .replace(/(\p{Ll})- (?!(?:ja|tai|sekä|eli)\b)(\p{Ll})/gu, "$1$2")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n")
}

function luku(rivit: string[], alku: number): { teksti: string[]; loppu: number } {
  const teksti: string[] = []
  let i = alku
  for (; i < rivit.length; i++) {
    /* Otsikko päättää luvun vain virkkeen jälkeen, ettei rivitetty lause katkea. */
    if (onOtsikko(rivit[i]) && teksti.length && /[.:]$/.test(teksti[teksti.length - 1])) break
    /* Monipalstaisessa pohjassa (859) seuraava luku alkaa kesken rivin. */
    if (SEURAAVA_LUKU.test(rivit[i])) break
    teksti.push(rivit[i])
  }
  return { teksti, loppu: i }
}

export function jasennaAloitteentekija(teksti: string): string | null {
  const t = teksti.replace(/\s+/g, " ")
  const m =
    t.match(/aloitteen\b[^.]{0,80}?\bon\s+(?:tehnyt|tehneet|jättänyt|jättäneet)\s+(.+?)(?=\.\s|\.$|,\s|\s+ja\s+(?:kaavoituksen|kaavan|hakemus)|$)/i) ??
    t.match(/(?:kaavamuutosta|asemakaavan\s+muutosta|asemakaavaa|kaavaa)\s+(?:on\s+)?hakenut\s+(.+?)(?=\.\s|\.$|,\s|$)/i) ??
    t.match(/(?:aloitteen\s+tekijä|hakija)\s*:\s*(.+?)(?=\.\s|\.$|,\s|$)/i)
  const nimi = m?.[1]?.trim().replace(/\s+/g, " ") ?? null
  if (!nimi || nimi.length > 80 || EI_NIMI.test(nimi)) return null
  /* Yhtiö tai yhteisö tunnistetaan isosta alkukirjaimesta. */
  return /^\p{Lu}/u.test(nimi) ? nimi : null
}

export function jasennaOasAloite(teksti: string | null | undefined): OasAloite {
  if (!teksti) return { aloitteentekija: null, kuvaus: null }
  const rivit = siistiRivit(teksti)

  const osat: string[] = []
  let aloiteTeksti = ""

  const ai = rivit.findIndex((r) => ALOITE_OTSIKKO.test(r) && r.length <= 60 && !/^aloitteen/i.test(r))
  if (ai >= 0) {
    const loput = rivit[ai].match(ALOITE_OTSIKKO)?.[1]?.trim()
    const runko = [...(loput ? [loput] : []), ...luku(rivit, ai + 1).teksti]
    aloiteTeksti = kappaleeksi(runko)
    if (aloiteTeksti) osat.push(aloiteTeksti)
  }

  const ti = rivit.findIndex((r, i) => i > ai && TAVOITE_OTSIKKO.test(r) && r.length <= 60)
  if (ti >= 0) {
    const m = rivit[ti].match(TAVOITE_OTSIKKO)
    const loput = (m?.[1] ?? m?.[2] ?? "").trim()
    const tavoite = kappaleeksi([...(loput ? [loput] : []), ...luku(rivit, ti + 1).teksti])
    if (tavoite) osat.push(`Tavoitteet: ${tavoite}`)
  }

  let kuvaus = osat.join("\n\n").trim() || null
  if (kuvaus && kuvaus.length > ENIMMAISPITUUS) kuvaus = `${kuvaus.slice(0, ENIMMAISPITUUS).replace(/\s\S*$/, "")} …`

  return { aloitteentekija: jasennaAloitteentekija(aloiteTeksti || teksti.slice(0, 6000)), kuvaus }
}

/* OAS-liite kaavasivun linkeistä: uusin tarkistettu, ei palauteraporttia tai liitettä. */
export function valitseOasLinkki(linkit: { href: string; teksti?: string | null }[]): string | null {
  const ehdokkaat = linkit.filter((l) => {
    const avain = `${l.href} ${l.teksti ?? ""}`
    return (
      /\.pdf(?:\?|$)/i.test(l.href) &&
      /osallistumis-?\s*ja-?\s*arviointisuunnitel/i.test(avain) &&
      !/palaute|liite|yleis[oö]tilaisuu|ohjelma/i.test(avain)
    )
  })
  if (!ehdokkaat.length) return null
  /* Latauspolun vuosi/kuukausi (/2026/06/) kertoo uusimman. */
  const avain = (h: string) => h.match(/\/(\d{4})\/(\d{2})\//)?.slice(1).join("") ?? "000000"
  return [...ehdokkaat].sort((a, b) => avain(b.href).localeCompare(avain(a.href)) || (/tark/i.test(b.href) ? 1 : 0) - (/tark/i.test(a.href) ? 1 : 0))[0].href
}

/* Liitteen haku on lisätieto: virhe palauttaa tyhjän eikä kaada keruuta. */
export async function haeOasAloite(url: string): Promise<(OasAloite & { url: string }) | null> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), 30000)
  try {
    const v = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }, signal: ohjain.signal })
    if (!v.ok) return null
    const buf = Buffer.from(await v.arrayBuffer())
    if (buf.length > 25 * 1024 * 1024) return null
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as any
    const teksti = (await pdfParse(buf, { max: 5 }))?.text ?? ""
    return { ...jasennaOasAloite(teksti), url }
  } catch {
    return null
  } finally {
    clearTimeout(kello)
  }
}
