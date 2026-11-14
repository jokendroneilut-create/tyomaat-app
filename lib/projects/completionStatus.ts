import { normalizeLegacyPhase } from "./phases"

/*
 * VAIHE JA TILA PYSYVÄT YHDESSÄ (D-421).
 *
 * "Valmistunut" on sekä vaihe (`phase`) että tila (`status: "completed"`,
 * `completed_at`). Kuusi polkua kirjoitti vaiheen mutta ei tilaa: TIC-
 * hyväksyntä uudelle ja täsmätylle riville, agentin tuonti, TIC-muokkaus,
 * dashboard, duplikaattikatselmointi ja runkotyöntekijä. Mitattu 15.11.2026:
 * **30 riviä** oli Valmistunut / active. Asiakkaan lista suodattaa
 * vaiheella, mittarit ja kooste tilalla, joten sama hanke oli eri
 * näkymissä eri tilassa.
 *
 * Palauttaa vain muuttuvat kentät, jotta kutsuja voi levittää tuloksen
 * omaan päivitykseensä:
 *
 * - vaihe muuttuu valmistuneeksi → `completed`, ja valmistumisaika
 *   säilyy jos se on jo kirjattu (käsin tai tekstistä annettu päivä on
 *   tarkempi kuin tämä hetki)
 * - vaihe muuttuu pois valmistuneesta (käsin palautus) → `active`,
 *   valmistumisaika pois
 * - muuten ei mitään. `expired` ja `archived` eivät ole tämän funktion
 *   asia, paitsi kun hanke merkitään valmiiksi.
 */
export function completionStatusPatch(
  newPhase: string | null | undefined,
  current: { status?: string | null; completed_at?: string | null } | null | undefined,
  nowIso: string = new Date().toISOString()
): { status?: string; completed_at?: string | null } {
  const valmis = normalizeLegacyPhase(newPhase) === "completed"
  const status = current?.status ?? null

  if (valmis) {
    if (status === "completed" && current?.completed_at) return {}
    return { status: "completed", completed_at: current?.completed_at ?? nowIso }
  }

  if (newPhase && status === "completed") {
    return { status: "active", completed_at: null }
  }

  return {}
}

/*
 * Lähteen ilmoittama valmistumispäivä kelpaa valmistumisajaksi vain jos se
 * on jo mennyt; tuleva päivä on arvio, ei tapahtuma.
 */
export function mennytPaiva(
  paiva: string | null | undefined,
  nyt: Date = new Date()
): string | null {
  if (!paiva) return null
  const d = new Date(paiva)
  if (Number.isNaN(d.getTime()) || d > nyt) return null
  return d.toISOString()
}
