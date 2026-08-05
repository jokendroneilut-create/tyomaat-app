import { normalizeLegacyPhase } from "./phases"

/*
 * Yksi totuus kilpailutushankkeen vanhenemispäivälle. Käytetään sekä
 * vanhennuscronissa (api/admin/expire-tender-projects) että hankekorteilla,
 * jottei logiikka eriydy.
 *
 * Referenssi: ensisijaisesti tarjousten MÄÄRÄAIKA (deadline), sitten
 * ilmoituksen julkaisu, viimeisenä hankkeen luontipäivä. Vanhenee vuosi
 * referenssistä.
 */
export const TENDER_EXPIRY_YEARS = 1

export function tenderExpiry(
  metadata: Record<string, any> | null | undefined,
  createdAt?: string | null
): { date: Date; source: "deadline" | "date_published" | "created_at" } | null {
  const md = metadata ?? {}
  const deadline = md.deadline ?? null
  const published = md.date_published ?? null
  const raw = deadline ?? published ?? createdAt ?? null
  if (!raw) return null

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null

  const date = new Date(parsed)
  date.setFullYear(date.getFullYear() + TENDER_EXPIRY_YEARS)

  const source = deadline ? "deadline" : published ? "date_published" : "created_at"
  return { date, source }
}

/*
 * Rikastunut = voittaja selvinnyt -> hanke ei enää vanhene kilpailutuksena
 * (se on edennyt "Sopimus myönnetty" -vaiheeseen).
 */
export function isTenderEnriched(
  metadata: Record<string, any> | null | undefined
): boolean {
  const md = metadata ?? {}
  return (
    md.is_contract_award === true ||
    (Array.isArray(md.winners) && md.winners.length > 0)
  )
}

/*
 * Hyväksynnässä valittavan "aseta vanhenemaan" -lipun päivä. Sama vuosi-
 * määräajasta-logiikka kuin kilpailutuksilla; jos referenssiä ei ole, vuosi
 * hyväksynnästä. Tallennetaan metadata.expire_at-kenttään ISO-merkkijonona.
 */
export function computeManualExpiry(
  metadata: Record<string, any> | null | undefined,
  createdAt?: string | null
): string {
  const t = tenderExpiry(metadata, createdAt)
  if (t) return t.date.toISOString()
  const d = new Date()
  d.setFullYear(d.getFullYear() + TENDER_EXPIRY_YEARS)
  return d.toISOString()
}

/*
 * Vanhentunut hanke palautetaan aktiiviseksi kun voittaja selviää. Ilman tätä
 * jälki-ilmoitus rikastaa hankkeen oikein (vaihe etenee, voittaja tallentuu)
 * mutta status jää "expired":ksi, jolloin hanke pysyy piilossa kartalta,
 * /today-näkymästä ja tiimilistalta. Piiloon jäisi juuri se hetki joka on
 * myyjälle arvokkain: urakoitsija on valittu ja rakentaminen alkaa.
 *
 * Vanhenemisen jälkeen ratkennut voittaja on tuore tapahtuma riippumatta
 * siitä milloin tarjouspyyntö julkaistiin — hankkeen vaihe kertoo lukijalle
 * loput.
 *
 * Yksi sääntö kahdelle kutsupaikalle (importCandidate, syncApprovedProject),
 * jottei sama ehto eriydy niiden välillä.
 */
export function shouldUnexpire(
  status: string | null | undefined,
  metadata: Record<string, any> | null | undefined
): boolean {
  return status === "expired" && isTenderEnriched(metadata)
}

/*
 * Hankkeen tosiasiallinen vanhenemispäivä korteille ja cronille — yhdistää
 * manuaalisen (metadata.expire_at, mikä tahansa vaihe) ja automaattisen
 * (Kilpailutus-vaihe) säännön. Rikastuneet (voittaja selvinnyt) eivät vanhene.
 */
export function resolveExpiry(
  metadata: Record<string, any> | null | undefined,
  phase: string | null | undefined,
  createdAt?: string | null
): { date: Date; manual: boolean } | null {
  const md = metadata ?? {}
  if (isTenderEnriched(md)) return null

  if (md.expire_at) {
    const d = new Date(md.expire_at)
    if (!Number.isNaN(d.getTime())) return { date: d, manual: true }
  }

  if (normalizeLegacyPhase(phase) === "tender") {
    const t = tenderExpiry(md, createdAt)
    if (t) return { date: t.date, manual: false }
  }

  return null
}
