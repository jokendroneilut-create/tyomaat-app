/*
 * JÄRJESTELMÄROOLI.
 *
 * Admin-oikeus on tullut ympäristömuuttujasta `ADMIN_EMAILS`. Kolmas
 * taso (myyjä) ei mahdu siihen, koska ympäristömuuttuja ei voi kertoa
 * kenen asiakkaita kukin myyjä sai. Rooli on siis kannassa
 * (docs/sql/2026-08-28_user_roles.sql), mutta ympäristömuuttuja jää
 * voimaan rinnalle.
 *
 * EI SEKOITETTAVA TIIMIROOLIIN. `team_members.role` on 'leader' tai
 * 'member' ja kertoo aseman tiimissä; tämä kertoo aseman
 * järjestelmässä.
 */

export type Role = "admin" | "seller" | "user"

export function parseAdminEmails(value: string | undefined | null): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/*
 * Ratkaisee roolin. Erotettu I/O:sta, jotta säännöt voi testata ilman
 * kantaa — juuri tässä logiikassa virhe olisi oikeuksien laajennus.
 */
export function resolveRole(input: {
  email: string | null | undefined
  dbRole: string | null | undefined
  adminEmails: string[]
}): Role {
  const email = (input.email || "").trim().toLowerCase()

  /*
   * Ympäristömuuttuja voittaa aina. Jos kannan sisältö menee rikki tai
   * admin poistaa vahingossa oman rivinsä, pääsy säilyy — lukitsematta
   * jääminen on tärkeämpää kuin yksi totuuden lähde.
   */
  if (email && input.adminEmails.includes(email)) return "admin"

  if (input.dbRole === "admin") return "admin"
  if (input.dbRole === "seller") return "seller"

  /* Tuntematon arvo ei koskaan tuota oikeuksia. */
  return "user"
}

/* Myyjä ei ole admin. Admin näkee kaiken minkä myyjäkin. */
export function isAdmin(role: Role): boolean {
  return role === "admin"
}

export function canSeeOwnCustomers(role: Role): boolean {
  return role === "admin" || role === "seller"
}
