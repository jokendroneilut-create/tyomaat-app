/*
 * KUUKAUDEN TARKKUUDELLA ANNETTU VALMISTUMISAIKA PÄIVÄKSI.
 *
 * Rakentajien kohdesivut ilmoittavat valmistumisen kuukauden
 * tarkkuudella ("12/2027", "Lokakuu 2026"). Sarake on päivämäärä, joten
 * jokin päivä on valittava — valitaan kuukauden viimeinen, samoin kuin
 * pelkkä vuosi on aina tulkittu vuoden viimeiseksi päiväksi.
 *
 * Yhteinen moduuli kolmelle kerääjälle (Lapti, Bonava, T2H): sama
 * sääntö kolmena kopiona ajautuisi väistämättä erilleen.
 */

export function viimeinenPaiva(vuosi: number, kuukausi: number): string | null {
  if (!Number.isFinite(vuosi) || kuukausi < 1 || kuukausi > 12) return null

  const paiva = new Date(Date.UTC(vuosi, kuukausi, 0)).getUTCDate()
  return `${vuosi}-${String(kuukausi).padStart(2, "0")}-${paiva}`
}

/*
 * "12/2027" -> "2027-12-31". Pelkkä vuosi kelpaa myös, jolloin päiväksi
 * tulee vuoden viimeinen. Muusta ei arvata.
 */
export function paivaKuukaudesta(arvo: string | null | undefined): string | null {
  const teksti = String(arvo ?? "")

  const kk = teksti.match(/\b(\d{1,2})\s*\/\s*(20\d{2})\b/)
  if (kk) return viimeinenPaiva(Number(kk[2]), Number(kk[1]))

  const vuosi = teksti.match(/\b(20\d{2})\b/)
  return vuosi ? `${vuosi[1]}-12-31` : null
}
