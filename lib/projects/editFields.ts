/*
 * KÄSIN MUOKKAUKSEN KENTTÄSIIVOUS.
 *
 * Omana moduulinaan eikä reitissä, jotta logiikka on testattavissa ilman
 * ympäristömuuttujia: reitin tuonti käynnistää Supabase-asiakkaan, ja
 * testi kaatuisi siihen ennen kuin pääsee itse asiaan.
 */

export function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function toPositiveNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

/*
 * Päivämäärä hyväksytään vain muodossa YYYY-MM-DD. Sarake on `date`, ja
 * kelvoton arvo kaataisi koko tallennuksen — silloin MUUTKIN samalla
 * kertaa muokatut kentät jäisivät tallentumatta.
 */
export function toIsoDate(value: unknown): string | null {
  const s = cleanString(value)
  if (!s) return null

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null

  const vuosi = Number(m[1])
  const kuukausi = Number(m[2])
  const paiva = Number(m[3])

  /*
   * Olematon päivä on tarkistettava erikseen: `new Date("2027-02-30")`
   * vierii maaliskuun toiseksi eikä palauta virhettä.
   */
  const d = new Date(Date.UTC(vuosi, kuukausi - 1, paiva))
  if (
    d.getUTCFullYear() !== vuosi ||
    d.getUTCMonth() !== kuukausi - 1 ||
    d.getUTCDate() !== paiva
  ) {
    return null
  }

  return s
}

export type CleanedContact = {
  name: string | null
  title: string | null
  organization: string | null
  email: string
  phone: string | null
  kind: "person" | "organization"
  role?: string
}

/*
 * Yhteystiedot: nimi, nimike, sähköposti ja puhelin. Tyhjä rivi
 * pudotetaan, jottei lomakkeen viimeinen tyhjä kenttäpari tallennu.
 *
 * TÄYSIN TYHJÄ LISTA ON SALLITTU: se on ainoa tapa poistaa väärin
 * poimittu yhteystieto käsin, ja juuri sitä varten muokkaus on olemassa.
 */
export function cleanContacts(value: unknown): CleanedContact[] | null {
  if (!Array.isArray(value)) return null

  return value
    .map((c: any) => {
      const name = cleanString(c?.name)
      return {
        name,
        title: cleanString(c?.title),
        organization: cleanString(c?.organization),
        email: cleanString(c?.email)?.toLowerCase() ?? "",
        phone: cleanString(c?.phone),
        kind: (name ? "person" : "organization") as CleanedContact["kind"],
        ...(c?.role ? { role: String(c.role) } : {}),
      }
    })
    .filter((c) => c.name || c.email || c.phone)
}
