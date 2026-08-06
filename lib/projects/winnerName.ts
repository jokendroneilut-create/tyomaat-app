/*
 * Kilpailutuksen voittajan nimi metadatasta.
 *
 * Hilma tuottaa kaksi kenttää samasta tiedosta: winner_organisations on
 * MERKKIJONO (siivottu alkuperäinen) ja winners on siitä pilkottu taulukko.
 * Ero on helppo ohittaa, ja silloin `winner_organisations?.[0]` palauttaa
 * merkkijonon ensimmäisen KIRJAIMEN taulukon ensimmäisen alkion sijaan.
 *
 * Mitattu tapaus: "Maanrakennusurakka 4 2026 Käpykatu" (Kajaani) sai
 * katselmoinnissa pääurakoitsijaksi "K", vaikka voittaja oli
 * "Kuljetuspolar Oy".
 *
 * Yksi sääntö kaikille kutsupaikoille, jottei sama virhe synny uudelleen.
 */
export function resolveWinnerName(
  metadata: Record<string, any> | null | undefined
): string | null {
  const md = metadata ?? {}

  if (Array.isArray(md.winners)) {
    const joined = md.winners
      .map((w: unknown) => String(w ?? "").trim())
      .filter(Boolean)
      .join(", ")
    if (joined) return joined
  }

  if (typeof md.winner_organisations === "string") {
    const trimmed = md.winner_organisations.trim()
    if (trimmed) return trimmed
  }

  // Varmuuden vuoksi: jos kenttä onkin taulukko jossain lähteessä.
  if (Array.isArray(md.winner_organisations)) {
    const joined = md.winner_organisations
      .map((w: unknown) => String(w ?? "").trim())
      .filter(Boolean)
      .join(", ")
    if (joined) return joined
  }

  return null
}
