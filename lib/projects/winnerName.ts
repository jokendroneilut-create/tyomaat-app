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
 *
 * EROTIN ON "//" EIKA PILKKU (D-328). Monta voittajaa yhdistettiin
 * ennen pilkulla, mutta `splitCompanyField` katkaisee pilkusta VAIN
 * y-tunnuksen sulkeen jalkeen -- ja se on tarkoituksellista, koska
 * yrityksen nimessa voi olla pilkku ("Destia Oy, Kunnossapitopalvelut").
 * Ilman y-tunnusta lista jai siis yhdeksi "yritykseksi": Lakeuslinjan
 * kolme osuusurakoitsijaa olisivat nakyneet hankekortilla yhtena
 * nimena "Leonhard Weiss Oü, Caverion Suomi Oy, Enersense PN Oy".
 *
 * "//" katkeaa aina, ja se on sama erotin jota Hilma kayttaa.
 * Mitattu 22.10.2026: kannassa oli 16 riviä 1 170:stä joilla builder
 * sisaltaa katkeamattoman pilkun -- osa niista on aitoja listoja, osa
 * yksittaisia yrityksia joiden nimessa on pilkku. Vanhoja rivejä ei
 * muuteta taman perusteella, koska niita ei voi erottaa saannolla.
 */
const EROTIN = " // "
export function resolveWinnerName(
  metadata: Record<string, any> | null | undefined
): string | null {
  const md = metadata ?? {}

  if (Array.isArray(md.winners)) {
    const joined = md.winners
      .map((w: unknown) => String(w ?? "").trim())
      .filter(Boolean)
      .join(EROTIN)
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
      .join(EROTIN)
    if (joined) return joined
  }

  return null
}
