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

/*
 * Osa tiedotteista ei mainitse kuukautta lainkaan, vain vuodenajan
 * ("hankkeen arvioidaan valmistuvan loppuvuodesta 2025"). Jokainen
 * vuodenaika-ilmaus kartoitetaan sen MYÖHÄISIMPÄÄN mahdolliseen
 * kuukauteen - näin päivämäärä ei koskaan arvioi valmistumista
 * todellista aikaisemmaksi, mikä pitäisi virhesuunnan turvallisena
 * (myöhemmin toteava sijaan liian aikaisin toteava).
 */
const FINNISH_SEASONS: [string, number][] = [
  ["alkuvuodesta", 4],
  ["kevätkaudella", 5],
  ["keväällä", 5],
  ["kesäkaudella", 8],
  ["kesällä", 8],
  ["syyskaudella", 11],
  ["syksyllä", 11],
  ["loppuvuodesta", 12],
]

function lastDayOfMonth(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
}

function findGuardedDate(
  text: string,
  regex: RegExp,
  resolveMonth: (matchedWord: string) => number | undefined
): string | null {
  let match: RegExpExecArray | null
  while ((match = regex.exec(text))) {
    const precedingWindow = text.slice(Math.max(0, match.index - 40), match.index)
    if (!/valmis/.test(precedingWindow)) continue

    const month = resolveMonth(match[1])
    if (!month) continue

    return lastDayOfMonth(parseInt(match[2], 10), month)
  }
  return null
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
  const monthMatch = findGuardedDate(
    normalized,
    new RegExp(`(${monthPattern})ssa\\s+(\\d{4})`, "g"),
    (word) => FINNISH_MONTHS.find(([name]) => name === word)?.[1]
  )
  if (monthMatch) return monthMatch

  const seasonPattern = FINNISH_SEASONS.map(([name]) => name).join("|")
  const seasonMatch = findGuardedDate(
    normalized,
    new RegExp(`(${seasonPattern})\\s+(\\d{4})`, "g"),
    (word) => FINNISH_SEASONS.find(([name]) => name === word)?.[1]
  )
  if (seasonMatch) return seasonMatch

  return null
}

export function isPastDate(isoDate: string | null): boolean {
  if (!isoDate) return false
  return isoDate <= new Date().toISOString().slice(0, 10)
}
