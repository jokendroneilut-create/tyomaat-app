/*
 * Poimii vapaasta suomenkielisestä tekstistä arvion hankkeen
 * valmistumisajankohdasta (esim. "hanke valmistuu lokakuussa 2026").
 * Palauttaa ISO-päivämäärän (YYYY-MM-DD) tai null jos tekstissä ei ole
 * tunnistettavaa valmistumismainintaa.
 *
 * Valitsee aina kyseisen ajanjakson VIIMEISEN mahdollisen päivän (esim.
 * "lokakuussa 2026" -> 2026-10-31, "vuonna 2026" -> 2026-12-31), koska
 * arviota käytetään automaattiseen "valmistunut"-tilaan siirtoon — on
 * turvallisempi arvioida myöhäiseksi kuin siirtää hanke valmiiksi liian
 * aikaisin.
 */

/* Jaettu myos muualle: aloituskuukauden lukemiseen (D-323). */
export const MONTHS: Record<string, number> = {
  tammikuu: 1,
  helmikuu: 2,
  maaliskuu: 3,
  huhtikuu: 4,
  toukokuu: 5,
  kesäkuu: 6,
  heinäkuu: 7,
  elokuu: 8,
  syyskuu: 9,
  lokakuu: 10,
  marraskuu: 11,
  joulukuu: 12,
}
const MONTH_ALTERNATION = Object.keys(MONTHS).join("|")

/*
 * Suomen vuodenajat eivät anna tarkkaa kuukautta — arvioidaan kauden
 * viimeiseksi kuukaudeksi (karkea heuristiikka). Adessiivimuodot
 * ("keväällä", "talvella") kirjoitettu suoraan taivutettuna, koska
 * kanta+pääte ei toimi säännöllisesti (esim. "kevät" -> "keväällä"
 * pudottaa t:n ja pidentää vokaalin, "talvi" -> "talvella" vaihtaa
 * i:n e:ksi) — helpompi luetella oikeat muodot kuin päätellä niitä.
 */
const SEASONS: Record<string, number> = {
  keväällä: 5, // huhti-toukokuu -> toukokuu
  kesällä: 8, // kesä-elokuu -> elokuu
  syksyllä: 11, // syys-marraskuu -> marraskuu
  talvella: 2, // joulu-helmikuu -> helmikuu (seuraavaa vuotta ei yritetä päätellä)
}
const SEASON_ALTERNATION = Object.keys(SEASONS).join("|")

/*
 * Keyword joka osoittaa VALMISTUMISTA (ei esim. rakentamisen alkua) —
 * päivämäärä haetaan vain tämän sanan jälkeisestä lyhyestä ikkunasta,
 * jottei tekstissä aiemmin mainittu esim. rakentamisen aloituspäivä
 * poimiudu vahingossa valmistumispäiväksi.
 *
 * Muodot ovat vartaloita eikä kokonaisia sanoja: "valmistuva" kattaa myös
 * "valmistuvan" ja "valmistuvat". Puuttuva "valmistuvan" oli mitattu aukko -
 * "kohteen arvioidaan valmistuvan lokakuussa 2026" on suomen tavallisin tapa
 * ilmaista arvio, eikä se osunut lainkaan.
 *
 * MENNYT AIKAMUOTO EI KELPAA. "valmistui" ja "valmistunut" on jätetty pois
 * tarkoituksella: mitattuna 4412 hankkeen kuvauksista menneen muodon
 * osumista ei yksikään koskenut hanketta itseään vaan purettavaa vanhaa
 * rakennusta, valmistunutta kaavaselvitystä tai naapurirakennusta.
 */
/*
 * KOLME MITATTUA AUKKOA LISAA (D-323). Vexatecin ja Rabbalsheden
 * tiedotteet 19.-20.10.2026:
 *
 *   "Urakan on määrä valmistua kesäkuussa 2027"     A-infinitiivi
 *   "otetaan käyttöön keväällä 2027"                 otetaan, ei "käyttöönotto"
 *   "uusiin tiloihin päästään muuttamaan kesäkuussa 2027"
 *
 * "valmistua" on turvallinen lisays: se on infinitiivi, ei koskaan
 * mennyt muoto. "käyttöön" kattaa "otetaan/päästään käyttöön", ja
 * "päästään muuttamaan" on kokonainen fraasi, koska pelkka "muuttaa"
 * tarkoittaa kaavoituksessa aivan muuta.
 *
 * EI LISATTY: "Syksyllä 2026 valmistuvien tilojen..." -- siina paiva on
 * ENNEN avainsanaa, ja kaannetty jarjestys vaatisi oman mittauksensa.
 * Ks. GAP-kommentti: vaara ankkuri on tassa jasentimessa tunnettu riski.
 */
const COMPLETION_KEYWORD =
  "valmistuu|valmistua|valmistuva|valmistunee|valmistumas|valmistumi|luovutetaan|käyttöönotto|käyttöön|päästään muuttamaan"

/*
 * Väli valmistumissanan ja päivämäärän välillä. Piste on suljettu pois,
 * koska ikkuna ylitti muuten virkkeen rajan ja poimi seuraavan virkkeen
 * aloituspäivän: mitattu "Kohde valmistuu aikanaan. Rakennustyöt
 * käynnistyivät tammikuussa 2025" -> valmistumisajaksi tuli 2025-01-31.
 */
const GAP = "[^.\\d]{0,40}?"

function lastDayOfMonth(year: number, month: number): string {
  const day = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

/*
 * TIEDOTTEEN JULKAISUPAIVA TEKSTISTA.
 *
 * Tarvitaan kun kuukausi mainitaan ilman vuotta ("valmistuvat
 * marraskuussa"). Ilman viitepaivaa vuotta ei arvata lainkaan.
 */
export function parseReleaseDate(text: string): string | null {
  /*
   * Ei sananrajaa vaan numerotarkistus: Laptin tiedotteessa lukee
   * "uutinen20.8.2026" ilman valilyontia, jolloin sananraja ei osu
   * numeron eteen ja koko paivays jai lukematta.
   */
  const m = /(?<!\d)(\d{1,2})\.(\d{1,2})\.(20\d{2})(?!\d)/.exec(String(text ?? ""))
  if (!m) return null

  const [, p, k, v] = m
  const d = new Date(Date.UTC(Number(v), Number(k) - 1, Number(p)))
  if (d.getUTCMonth() !== Number(k) - 1 || d.getUTCDate() !== Number(p)) return null
  return d.toISOString().slice(0, 10)
}

/*
 * SELVITYS EI OLE HANKE (18.10.2026).
 *
 * Johannes Harviala–Hangasmäki-hankkeesta: *"Arvioitu valmistuminen
 * 2024-12-31 mutta lähde sanoo vuoden 2030 aikana"* — ja tunnisti syyn
 * itse: *"Voimajohtohankkeen vaikutuksista on käynnistynyt
 * ympäristöselvitys, joka valmistuu vuoden 2024 aikana. Se tulee
 * varmasti tästä."*
 *
 * Sivulla on kaksi valmistumismainintaa eri asioista:
 *
 *   "ympäristöselvitys, joka valmistuu vuoden 2024 aikana"      <- selvitys
 *   "voimajohdon rakentamisen arvioidaan valmistuvan vuoden 2030" <- hanke
 *
 * Poimija otti ensimmäisen, eli selvityksen valmistumisen. Virhe on
 * kalliimpi kuin tyhjä kenttä: mennyt päivä syöttää
 * `autoCompleteGate`:a, joka 90 vuorokauden jälkeen siirtää hankkeen
 * Valmistuneeksi ja **piilottaa sen asiakkaalta** (D-298) — vuonna 2030
 * valmistuva voimajohto olisi kadonnut listalta.
 *
 * Virkkeet joiden aihe on selvitys, suunnitelma tai lupa ohitetaan,
 * jolloin rakentamista koskeva virke voittaa vaikka se tulee
 * myöhemmin. Jos yksikään virke ei kelpaa, luetaan koko teksti kuten
 * ennen — muuten muutos poistaisi päiviä riveiltä joilla on vain
 * yksi maininta.
 */
const EI_HANKKEEN_VALMISTUMINEN =
  /*
   * Sanaraja jätetty pois tarkoituksella: suomen yhdyssanassa selvitys
   * on sanan lopussa ("ympäristöselvitys", "maaperäselvitys"), joten
   * `\bselvity` ei osuisi niihin.
   */
  /selvity|\bYVA\b|arviointiselostu|arviointiohjelma|suunnitelma|suunnittelu|yleiskaava|asemakaava|kaavoitu|raportti|hakemus|lupakäsittely|lupaprosessi|tarjouskilpailu|kilpailutus/i

export function parseEstimatedCompletionDate(
  text: string,
  referenceDate?: string | null
): string | null {
  const kokoTeksti = text.replace(/\s+/g, " ")

  /*
   * Virkejako pisteestä välilyönnin kanssa. Yhden ison kirjaimen
   * jälkeinen piste on kirjainlyhenne, ei virkkeen loppu — sama
   * tulkinta kuin osapuolipoiminnassa.
   */
  const virkkeet = kokoTeksti.split(/(?<!(?:^|\s)[A-ZÄÖÅ])\.\s+/)
  const hankevirkkeet = virkkeet.filter((v) => !EI_HANKKEEN_VALMISTUMINEN.test(v))

  if (hankevirkkeet.length && hankevirkkeet.length < virkkeet.length) {
    const vainHanke = lueValmistuminen(hankevirkkeet.join(". "), referenceDate)
    if (vainHanke) return vainHanke
  }

  return lueValmistuminen(kokoTeksti, referenceDate)
}

function lueValmistuminen(
  normalized: string,
  referenceDate?: string | null
): string | null {

  const monthYearRegex = new RegExp(
    `(?:${COMPLETION_KEYWORD})${GAP}(${MONTH_ALTERNATION})ssa\\s+(\\d{4})`,
    "i"
  )
  const monthYearMatch = normalized.match(monthYearRegex)
  if (monthYearMatch) {
    const month = MONTHS[monthYearMatch[1].toLowerCase()]
    const year = Number(monthYearMatch[2])
    return lastDayOfMonth(year, month)
  }

  const seasonYearRegex = new RegExp(
    `(?:${COMPLETION_KEYWORD})${GAP}(${SEASON_ALTERNATION})\\s+(\\d{4})`,
    "i"
  )
  const seasonYearMatch = normalized.match(seasonYearRegex)
  if (seasonYearMatch) {
    const month = SEASONS[seasonYearMatch[1].toLowerCase()]
    const year = Number(seasonYearMatch[2])
    return lastDayOfMonth(year, month)
  }

  /*
   * KUUKAUSI ILMAN VUOTTA.
   *
   * "Hiukkavaaran uudet rivitalokodit valmistuvat marraskuussa" on
   * tavallinen tapa kirjoittaa tiedotteen otsikko, eika se osunut
   * mihinkaan: poimija vaati vuosiluvun kuukauden peraan.
   *
   * Vuosi paatellaan JULKAISUPAIVASTA, ei kuluvasta paivasta - vanha
   * tiedote ei kerro tasta vuodesta. Ilman viitepaivaa ei arvata
   * mitaan.
   *
   * Menneeseen kuukauteen viittaava tiedote tarkoittaa seuraavaa
   * vuotta: joulukuussa julkaistu "valmistuu maaliskuussa" on ensi
   * maaliskuu.
   */
  if (referenceDate) {
    const viite = new Date(referenceDate)
    if (!Number.isNaN(viite.getTime())) {
      const monthOnlyRegex = new RegExp(
        `(?:${COMPLETION_KEYWORD})${GAP}(${MONTH_ALTERNATION})ssa(?!\s+\d{4})`,
        "i"
      )
      const monthOnlyMatch = normalized.match(monthOnlyRegex)
      if (monthOnlyMatch) {
        const month = MONTHS[monthOnlyMatch[1].toLowerCase()]
        const julkaisuKuu = viite.getUTCMonth() + 1
        const vuosi = month >= julkaisuKuu ? viite.getUTCFullYear() : viite.getUTCFullYear() + 1
        return lastDayOfMonth(vuosi, month)
      }
    }
  }

  const yearOnlyRegex = new RegExp(
    `(?:${COMPLETION_KEYWORD})${GAP}vuo(?:nna|den)\\s+(\\d{4})`,
    "i"
  )
  const yearOnlyMatch = normalized.match(yearOnlyRegex)
  if (yearOnlyMatch) {
    const year = Number(yearOnlyMatch[1])
    return lastDayOfMonth(year, 12)
  }

  return null
}
