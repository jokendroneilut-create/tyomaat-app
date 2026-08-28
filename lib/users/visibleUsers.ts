import type { Role } from "@/lib/auth/roles"

/*
 * KUKA NÄKEE KENET.
 *
 * Tämä on tietoturvaraja, ei näkymälogiikkaa: jos tämä vuotaa, myyjä
 * näkee toisen myyjän asiakkaat. Siksi se on erillinen ja testattu
 * funktio eikä rivi reitin sisällä.
 *
 * Myyjä näkee vain ne joiden `ownerId` on hän itse. Liittämätön asiakas
 * (`ownerId` null) ei näy kenellekään myyjälle — vain adminille.
 */

export type OwnedUser = { ownerId?: string | null }

export function visibleUsers<T extends OwnedUser>(
  role: Role,
  viewerId: string,
  users: T[]
): T[] {
  if (role === "admin") return users

  /* Tuntematon rooli ei näe mitään, ei edes omiaan. */
  if (role !== "seller") return []

  /* Tyhjä katsojatunnus ei saa osua tyhjiin omistajiin. */
  if (!viewerId) return []

  return users.filter((u) => u.ownerId === viewerId)
}
