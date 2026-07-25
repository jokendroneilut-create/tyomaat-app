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
