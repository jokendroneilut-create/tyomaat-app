/*
 * Onko tunnus lukittu? Lukitusreitti (app/api/admin/lock-user) kirjoittaa
 * sekä app_metadata.locked-lipun että Supaben ban_duration-kentän, joka
 * näkyy käyttäjällä banned_until-aikaleimana. Kumpi tahansa riittää:
 * lippu kertoo adminin tahdon, banned_until kattaa käsin Supaben
 * konsolista tehdyn eston.
 *
 * Lukitulle ei lähetetä sähköposteja (hälytykset, koosteet, joukkoviestit):
 * osa lukituista on sopinut palaavansa asiaan myöhemmin, eikä heille
 * kuulu lähettää palvelun viestejä sillä välin.
 */
type UserLike = {
  app_metadata?: Record<string, unknown> | null
  banned_until?: string | null
}

export function isAccountLocked(user: UserLike | null | undefined, now: Date = new Date()): boolean {
  if (!user) return false
  if (user.app_metadata?.locked === true) return true
  if (user.banned_until) {
    const until = new Date(user.banned_until)
    if (!Number.isNaN(until.getTime()) && until > now) return true
  }
  return false
}
