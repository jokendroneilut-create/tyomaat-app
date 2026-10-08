import { hilmaNoticeApiUrl } from "./hilmaRealizedLocation"

/*
 * HANKINNAN TULOS: VOITTAJA VAI EI VOITTAJAA (D-251).
 *
 * Johannes 8.10.2026 Virolahden lammitysmuodon muutoksesta: hankkeella
 * luki "Voittaja ratkennut", mutta yhtaan voittajaa ei nakynyt.
 *
 * SYY: sopimusilmoitus (ContractAwardNotice) EI tarkoita etta voittaja
 * olisi valittu. eFormsissa on oma kentta `tenderResultCode`:
 *
 *   selec-w   voittaja valittu
 *   clos-nw   suljettu ILMAN voittajaa
 *
 * Virolahdella koodi oli `clos-nw` ja syy `all-rej` — ainoa tarjous
 * hylattiin. Me nayttimme sen asiakkaalle sopimuksena.
 *
 * MIKSI TYHJA VOITTAJALISTA EI RIITA PAATTELYYN. Hakurajapinnan
 * `winnerOrganisations` on tyhja 102 ilmoituksella. Tarkistin niista
 * 15 taman rajapinnan kautta: **14 oli clos-nw mutta yksi oli selec-w**
 * — voittaja oli valittu, se vain puuttui hakurajapinnan vastauksesta.
 * Jos tyhjaa kenttaa pidettaisiin todisteena, joka viidestoista aito
 * sopimus merkittaisiin vaarin keskeytetyksi. Siksi tama kysyy
 * ilmoituksen omalta rajapinnalta.
 *
 * Sama rajapinta kuin suorituspaikalla (`hilmaRealizedLocation`), joten
 * kutsumalli ja aikakatkaisu ovat samat.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const TIMEOUT_MS = 8000

export type HilmaTulos = {
  /* null = ilmoitus ei kertonut; ei sama kuin "ei voittajaa". */
  tulos: "winner" | "no-winner" | null
  voittajat: string[]
  /* eForms-koodi, esim. "ins-fund" (rahoitus ei riita), "all-rej". */
  syy: string | null
}

const TYHJA: HilmaTulos = { tulos: null, voittajat: [], syy: null }

function lista(arvo: unknown): any[] {
  if (Array.isArray(arvo)) return arvo
  return arvo ? [arvo] : []
}

/* Organisaation nimi tunnuksella ORG-000N. */
function nimiTunnuksella(organisaatiot: any[], tunnus: string): string | null {
  for (const o of organisaatiot) {
    const id = o?.company?.partyIdentification?.id?.value
    if (id !== tunnus) continue
    const nimi = lista(o?.company?.partyName)[0]?.name?.value
    return typeof nimi === "string" && nimi.trim() ? nimi.trim() : null
  }
  return null
}

/* Jasennys erillaan hausta, jotta sen voi testata ilman verkkoa. */
export function tulosEFormsista(doc: any): HilmaTulos {
  const ext =
    doc?.eForm?.ublExtensions?.[0]?.extensionContent?.eformsExtension ?? null
  const noticeResult = ext?.noticeResult
  const lotResults = lista(noticeResult?.lotResult)
  if (!lotResults.length) return TYHJA

  const koodit = lotResults
    .map((r: any) => r?.tenderResultCode?.value)
    .filter((v: any) => typeof v === "string")

  if (!koodit.length) return TYHJA

  /*
   * Monen osan hankinnassa osa voi ratketa ja osa ei. Yksikin valittu
   * voittaja tekee ilmoituksesta sopimuksen — loput osat ovat eri asia.
   */
  const onVoittaja = koodit.includes("selec-w")

  const syy =
    lotResults
      .map((r: any) => r?.decisionReason?.decisionReasonCode?.value)
      .find((v: any) => typeof v === "string") ?? null

  if (!onVoittaja) {
    return { tulos: "no-winner", voittajat: [], syy }
  }

  /*
   * Voittajan nimi: tendering party -> tenderer -> ORG-tunnus ->
   * organisaation nimi. Varalla `tenderReference`, joka on vapaa teksti
   * ja siksi vasta toinen vaihtoehto.
   */
  const organisaatiot = lista(ext?.organizations?.organization)
  const puolueet = lista(noticeResult?.tenderingParty)

  const nimet = new Set<string>()
  for (const p of puolueet) {
    for (const t of lista(p?.tenderer)) {
      const nimi = nimiTunnuksella(organisaatiot, t?.id?.value)
      if (nimi) nimet.add(nimi)
    }
  }

  if (!nimet.size) {
    for (const lt of lista(noticeResult?.lotTender)) {
      const viite = lista(lt?.tenderReference)[0]?.id?.value
      if (typeof viite === "string" && viite.trim()) nimet.add(viite.trim())
    }
  }

  return { tulos: "winner", voittajat: [...nimet], syy: null }
}

/*
 * Palauttaa tyhjan myos virhetilanteessa. Tuntematon tulos EI saa
 * nayttaa keskeytykselta: `tulos: null` tarkoittaa "ei tietoa".
 */
export async function fetchHilmaTulos(
  procedureId: unknown,
  noticeId: unknown
): Promise<HilmaTulos> {
  const procedure = String(procedureId ?? "").trim()
  const notice = String(noticeId ?? "").trim()
  if (!procedure || !notice) return TYHJA

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(hilmaNoticeApiUrl(procedure, notice), {
      headers: { Accept: "application/json", "User-Agent": UA },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!res.ok) return TYHJA
    return tulosEFormsista(await res.json())
  } catch {
    return TYHJA
  } finally {
    clearTimeout(timer)
  }
}
