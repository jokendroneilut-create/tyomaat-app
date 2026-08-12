import { extractContractPeriod } from "@/lib/agent/decisionPhase"

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

/*
 * ASIAKIRJAN VALMISTUMINEN EI OLE HANKKEEN VALMISTUMINEN.
 *
 * "valmis"-vartalo yksin ei riitä vartijaksi, koska hankkeen elinkaaren
 * alussa valmistuu nimenomaan papereita. Mitattu tapaus (Huutoniemen
 * sairaala-alue, 45 M€): "kehitys- ja hankesuunnitelmat valmistuvat
 * elokuussa 2026", kun työmaavaihe on 2027-2028. Ilman tätä sääntöä
 * kenttään olisi kirjoitettu 2026-08-31 ja auto-complete olisi merkinnyt
 * hankkeen valmiiksi ennen kuin rakentaminen edes alkaa.
 *
 * Sama ansa on jo nähty kaavojen valmistumispäivissä ja YVA:n
 * "Päättynyt"-tilassa: aikainen virstanpylväs näyttää lopulta.
 *
 * "SUUNNITELMAN MUKAAN" ON POIKKEUS. Se on adverbiaali, ei subjekti -
 * "suunnitelman mukaan rakennus valmistuu 12/2027" kertoo rakennuksen
 * valmistumisesta. Siksi asiakirjasanan jälkeen ei saa seurata "mukaan".
 */
const PLAN_DOCUMENT =
  "(?:hanke|kehitys|toteutus|yleis|tarve|rakennus|asema)?suunnitelm\\w*|kaav\\w*|selvity\\w*|selostu\\w*|osayleiskaav\\w*|auditoin\\w*"

/*
 * Välimerkki sallitaan asiakirjasanan jälkeen, koska subjekti ja verbi
 * erottuvat usein sivulauseella: "hankesuunnitelmat, jotka valmistuvat
 * elokuussa 2026".
 */
const PLAN_COMPLETES = new RegExp(
  `(?:${PLAN_DOCUMENT})(?!\\s+mukaan)[,;:]?(?:\\s+\\S+){0,3}\\s+valmistu`,
  "i"
)

function findGuardedDate(
  text: string,
  regex: RegExp,
  resolveMonth: (matchedWord: string) => number | undefined
): string | null {
  let match: RegExpExecArray | null
  while ((match = regex.exec(text))) {
    /*
     * Ikkuna on asiakirjatarkistuksessa leveämpi kuin "valmis"-vartijassa,
     * koska subjekti voi olla kauempana: "kehitys- ja hankesuunnitelmat,
     * joihin sisältyy toimintojen sijoittuminen, valmistuvat elokuussa".
     */
    const precedingWindow = text.slice(Math.max(0, match.index - 40), match.index)
    if (!/valmis/.test(precedingWindow)) continue

    const subjectWindow = text.slice(Math.max(0, match.index - 120), match.index)
    if (PLAN_COMPLETES.test(subjectWindow)) continue

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

  /*
   * NUMEROMUOTOINEN KUUKAUSI JA VUOSI: "työ valmistuu 12 /2019".
   *
   * Kuntien hankesuunnitelmissa aikataulu kirjoitetaan lähes aina näin,
   * ei kuukauden nimellä. Mitattu: 52 päätösriviä, joista 39 oli jo
   * mennyt - eli lähes 40 vuosia sitten valmistunutta hanketta odotti
   * katselmointijonossa merkinnällä "Suunnittelussa".
   *
   * Sama vartija kuin muillakin: "valmis"-kantainen sana enintään 40
   * merkkiä ennen. Ilman sitä osuisi myös aloituspäivä, joka on
   * tyypillisesti samassa virkkeessä ("Rakentaminen alkaa 06 /19, ja työ
   * valmistuu 12 /2019").
   *
   * VUOSI VAADITAAN NELINUMEROISENA. Kaksinumeroinen ("06 /19") jäisi
   * vuodeksi 19, koska päivän rakentaja lukee luvun sellaisenaan - ja
   * vuosisadan arvaaminen olisi turhaa, sillä mitatut valmistumisajat
   * kirjoitetaan aina nelinumeroisina.
   */
  const numericMatch = findGuardedDate(
    normalized,
    /(\d{1,2})\s*\/\s*(20\d{2})/g,
    (word) => {
      const month = Number(word)
      return month >= 1 && month <= 12 ? month : undefined
    }
  )
  if (numericMatch) return numericMatch

  /*
   * SOPIMUSKAUSI VIIMEISENÄ. Kunnan hankintapäätös ei sano "valmistuu
   * syyskuussa" vaan "Hankinnan sopimuskausi on 15.4.-24.5.2026", ja kauden
   * loppu on se päivä johon mennessä työn on oltava tehty. Ilman tätä
   * jo tehty hankinta pääsi TIC-jonoon mahdollisuutena - mitattu rivi oli
   * päätetty 5.12.2025 ja sen sopimuskausi päättyi 24.5.2026.
   *
   * Järjestys on tarkoituksellinen: yllä olevat kuviot on viritetty
   * yritysten tiedotteiden aineistolla, eikä sitä haluta häiritä. Tämä
   * vastaa vain silloin kun ne eivät löydä mitään.
   */
  const period = extractContractPeriod(text)
  if (period) return toIsoDate(period.end)

  return null
}

/*
 * Paikallinen päivä ISO-muotoon. toISOString() siirtäisi aikavyöhykkeen
 * verran, jolloin 1.1. muuttuisi edellisen vuoden viimeiseksi päiväksi.
 */
function toIsoDate(date: Date): string {
  const kk = String(date.getMonth() + 1).padStart(2, "0")
  const pp = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${kk}-${pp}`
}

export function isPastDate(isoDate: string | null): boolean {
  if (!isoDate) return false
  return isoDate <= new Date().toISOString().slice(0, 10)
}
