import { PHASE_LABELS } from "@/lib/projects/phases"

/*
 * MILLOIN ARVIOITU VALMISTUMISPÄIVÄ SAA PIILOTTAA HANKKEEN.
 *
 * `estimated_completion` on poimittu vapaasta tekstistä ("valmistuu
 * lokakuussa 2026"). Kun päivä menee, `auto-complete-projects` siirtää
 * hankkeen vaiheeseen "Valmistunut" ja tilaan "completed" — eli hanke
 * katoaa asiakkaan listalta.
 *
 * PERIAATE (Johannes 2.9.2026): **kesken oleva hanke piilotettuna on
 * pahempi kuin valmistunut hanke listalla.** Väärä piilotus vie
 * asiakkaalta liidin jota hän ei voi tietää menettäneensä; turha rivi
 * listalla näkyy ja on korjattavissa.
 *
 * MITATTU 2.9.2026: cron oli piilottanut 114 hanketta, ja niistä vain
 * kuusi kestää tarkastelun. Kolme porttia, kukin omasta mitatusta
 * syystään:
 */

/* Odotusaika päivän jälkeen. Rakennushanke myöhästyy useammin kuin
 * valmistuu etuajassa, joten arvion umpeutuminen ei ole todiste. */
export const ODOTUS_PAIVAA = 90

export type AutoCompleteInput = {
  /* Poimittu valmistumispäivä (YYYY-MM-DD). */
  estimatedCompletion: string | null | undefined
  /* Milloin hanke tuli meille. */
  createdAt: string | null | undefined
  /* Lähdedokumentin last_seen_at: lähde listaa hanketta yhä. */
  lastSeenAt?: string | null
  phase?: string | null
  now?: Date
}

export type AutoCompleteVerdict = "complete" | "wait" | "skip"

export function evaluateAutoComplete(input: AutoCompleteInput): AutoCompleteVerdict {
  const paiva = String(input.estimatedCompletion ?? "").trim()
  if (!paiva) return "skip"
  if (String(input.phase ?? "") === PHASE_LABELS.completed) return "skip"

  const now = input.now ?? new Date()
  const paivaMs = new Date(`${paiva.slice(0, 10)}T00:00:00Z`).getTime()
  if (!Number.isFinite(paivaMs)) return "skip"

  /*
   * PORTTI 1: PÄIVÄ EI SAA OLLA VANHEMPI KUIN LÖYTÖHETKI.
   *
   * Me poimimme vain käynnissä olevia hankkeita. Jos lähde ilmoitti
   * hankkeen 2026 ja "valmistumispäivä" on 2003, kyse ei ole
   * valmistuneesta hankkeesta vaan väärin luetusta vuosiluvusta —
   * vanhan kaavan viitteestä, edellisestä vaiheesta tai liitteen
   * päiväyksestä. Mitattu: 85 piilotetusta 114:sta kaatui tähän,
   * mukaan lukien "Hukkalansalon tuulivoimakaava" (2003-12-31,
   * löydetty 15.7.2026) ja "Pursialan asemakaavan muutos" (2013-12-31).
   */
  const loyto = String(input.createdAt ?? "").slice(0, 10)
  if (loyto && paiva.slice(0, 10) < loyto) return "skip"

  /*
   * PORTTI 2: ODOTUSAIKA.
   *
   * Arvio on arvio. Mitattu: 22 hanketta piilotettiin 2 vuorokautta
   * päivän umpeutumisen jälkeen, mukaan lukien viisi siltaurakkaa ja
   * "Sallan rajavartioaseman uudistus".
   */
  const kulunut = Math.floor((now.getTime() - paivaMs) / 86_400_000)
  if (kulunut < ODOTUS_PAIVAA) return "wait"

  /*
   * PORTTI 3: LÄHDE LISTAA HANKETTA YHÄ.
   *
   * `last_seen_at` kertoo milloin dokumentti viimeksi nähtiin lähteessä.
   * Jos lähde on nähnyt hankkeen valmistumispäivän JÄLKEEN, se on
   * signaali siitä että hanke on yhä käynnissä — juuri se "muu signaali"
   * jonka odotusajan kuuluu ottaa huomioon.
   */
  const nahty = String(input.lastSeenAt ?? "").slice(0, 10)
  if (nahty && nahty > paiva.slice(0, 10)) return "wait"

  return "complete"
}
