const FINNISH_MONTHS: [string, number][] = [
  ["tammikuu", 1],
  ["helmikuu", 2],
  ["maaliskuu", 3],
  ["huhtikuu", 4],
  ["toukokuu", 5],
  ["kesäkuu", 6],
  ["heinäkuu", 7],
  ["elokuu", 8],
  ["syyskuu", 9],
  ["lokakuu", 10],
  ["marraskuu", 11],
  ["joulukuu", 12],
]

function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

/*
 * Urakoitsijoiden tiedotteet ilmoittavat valmistumisajan usein vain
 * leipätekstissä ("Urakka valmistuu kokonaisuudessaan syyskuussa 2025")
 * eikä sivu itse päivity kun päivä koittaa - lähde voi siis edelleen
 * kuulostaa "käynnissä olevalta" kuukausia sen jälkeen kun työ on
 * tosiasiassa valmistunut. Poimimalla tämä päivämäärä talteen
 * estimated_completion-kenttään olemassa oleva
 * /api/admin/auto-complete-projects-cron siirtää hankkeen automaattisesti
 * "Valmistunut"-vaiheeseen kun päivä on mennyt.
 *
 * Haku rajataan "valmis"-kantaisen sanan lähelle (40 merkkiä ennen
 * kuukausimainintaa), jotta muut samassa tekstissä esiintyvät,
 * epäolennaiset kuukausi+vuosi-maininnat (esim. sertifikaatin
 * myöntämisajankohta tai työn aloituspäivä) eivät osu virheellisesti.
 */
export function inferCompletionDateFromText(
  text: string | null | undefined
): string | null {
  if (!text) return null
  const normalized = text.toLowerCase()

  const monthPattern = FINNISH_MONTHS.map(([name]) => name).join("|")
  const regex = new RegExp(`(${monthPattern})ssa\\s+(\\d{4})`, "g")

  let match: RegExpExecArray | null
  while ((match = regex.exec(normalized))) {
    const precedingWindow = normalized.slice(Math.max(0, match.index - 40), match.index)
    if (!/valmis/.test(precedingWindow)) continue

    const monthName = match[1]
    const year = parseInt(match[2], 10)
    const month = FINNISH_MONTHS.find(([name]) => name === monthName)?.[1]
    if (!month) continue

    return lastDayOfMonth(year, month)
  }

  return null
}

export function isPastDate(isoDate: string | null): boolean {
  if (!isoDate) return false
  return isoDate <= new Date().toISOString().slice(0, 10)
}
