/*
 * OMA KÄYTTÖ — KETÄ EI LASKETA ASIAKKAAKSI.
 *
 * Analytiikka on rajannut ylläpitäjän oman käytön pois `ADMIN_EMAILS`-
 * listan perusteella. Mitattu 20.9.2026: lista sisälsi yhden osoitteen,
 * `user_roles`-taulussa ei ollut yhtään admin-riviä, ja ylläpitäjän
 * kaksi muuta tunnusta laskettiin siksi asiakkaiksi — 30 vrk jaksolla
 * 15 päivää 27:stä näytti 1-2 käyttäjää liikaa, eri käyttäjiä 39 kun
 * oikea luku oli 37, ja sivulatauksia 3 522 kun oikea oli 3 081 (14 %).
 *
 * MIKSI ERILLINEN LISTA EIKÄ ADMIN_EMAILS. Osoitteen lisääminen
 * `ADMIN_EMAILS`-listalle antaisi sille admin-oikeudet (ks.
 * `lib/auth/roles.ts`). Testitunnus on olemassa nimenomaan asiakkaan
 * näkymän katsomista varten — admin-oikeus rikkoisi sen tehtävän. Rajaus
 * lukuihin ja oikeuksien myöntäminen ovat eri asia, joten ne ovat eri
 * muuttujassa.
 *
 * `ANALYTICS_EXCLUDE_EMAILS` on pilkulla eroteltu lista. Tyhjänä käytös
 * on sama kuin ennen: pois rajataan vain adminit.
 */

import { parseAdminEmails } from "@/lib/auth/roles"

export function omanKaytonEmails(env: Record<string, string | undefined>): string[] {
  const kaikki = [
    ...parseAdminEmails(env.ADMIN_EMAILS),
    ...parseAdminEmails(env.ANALYTICS_EXCLUDE_EMAILS),
  ]

  return [...new Set(kaikki)]
}

/*
 * Tunnukset joiden tapahtumat jätetään asiakasluvuista pois.
 *
 * `user_roles`-taulun admin-rivit otetaan mukaan, jottei lista jää
 * vanhentuneen ympäristömuuttujan varaan — juuri siitä 20.9. mitattu
 * virhe johtui.
 */
export function omanKaytonIds(input: {
  users: { id: string; email?: string | null }[]
  roolit?: { user_id: string; role?: string | null }[] | null
  emails: string[]
}): Set<string> {
  const ids = new Set<string>(
    (input.roolit ?? [])
      .filter((r) => r.role === "admin")
      .map((r) => r.user_id)
  )

  for (const u of input.users) {
    if (u.email && input.emails.includes(u.email.toLowerCase())) ids.add(u.id)
  }

  return ids
}
