/*
 * Hankkeen vaihe kunnan hankintapäätöksestä.
 *
 * Vaihe päätellään aiemmin pelkästä otsikosta: /urak/ -> "Sopimus
 * myönnetty", muuten "Suunnittelussa". Sama rivi oli kopioituna kolmeen
 * jäsentäjään. Heuristiikka on liian heikko, koska otsikko ei kerro mitä
 * päätöksessä tehtiin:
 *
 *   "Keskusurheilukentän tekonurmen peruskorjaus" -> "Suunnittelussa"
 *
 * vaikka päätös on 5.12.2025, urakoitsija valittu ja teksti sanoo
 * "Hankinnan sopimuskausi on 15.4.-24.5.2026" - hanke on tänään tehty.
 * Mitattu: 966 päätösriviä 1017:stä oli merkitty suunnitteluvaiheeseen.
 *
 * KAKSI VAHVEMPAA SIGNAALIA, TÄSSÄ JÄRJESTYKSESSÄ:
 *
 *   1. SOPIMUSKAUSI kertoo missä hanke on juuri nyt. Päättynyt kausi
 *      tarkoittaa valmista, käynnissä oleva rakenteilla olevaa.
 *   2. VOITTAJA kertoo että sopimus on myönnetty, vaikka aikaa ei mainita.
 *
 * Kumpikaan ei ole otsikossa, joten otsikkoheuristiikka jää vasta
 * viimeiseksi varalle.
 */

/*
 * Vaiheiden sanasto on `projects.phase`-kentän jo käytössä olevaa: näiden
 * ulkopuolelta ei keksitä uusia arvoja. Mitattu kannasta - "Rakenteilla"
 * 137 kpl, "Sopimus myönnetty" 100, "Valmistunut" 36.
 */
export const PHASE_TENDER = "Kilpailutus"
export const PHASE_AWARDED = "Sopimus myönnetty"
export const PHASE_ONGOING = "Rakenteilla"
export const PHASE_DONE = "Valmistunut"

export type ContractPeriod = {
  start: Date | null
  end: Date
}

/*
 * Näkymättömät merkit pois ennen kuvioiden ajoa. Päätösaineistossa on
 * pehmeitä tavuviivoja ja nollan levyisiä välejä keskellä sanoja
 * ("Ilmoitus-​ ja"), ja ne katkaisevat kuvion näkymättömästi.
 */
function normalize(text: string): string {
  return text.replace(/[­​‌‍﻿]/g, "").replace(/\s+/g, " ")
}

/*
 * "Hankinnan sopimuskausi on 15.4.-24.5.2026"
 * "Hankinnan sopimuskausi on 1.5.2026 – 30.9.2026"
 *
 * ALKUVUOSI PUUTTUU USEIN, kun kausi on saman vuoden sisällä ("15.4.-24.5.2026").
 * Silloin se luetaan loppupäivästä.
 */
const PERIOD =
  /sopimuskausi\s+on\s+(\d{1,2})\.(\d{1,2})\.(\d{4})?\s*[-–—]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i

/*
 * "Sopimuskausi on 04-12.2025" - pelkät KUUKAUDET ja yksi vuosi.
 *
 * Päivämäärämuotoinen kuvio ei osu tähän, joten kausi jäi lukematta ja
 * hanke näytti myönnetyltä sopimukselta vielä puoli vuotta päättymisen
 * jälkeen. Kausi päättyy loppukuukauden viimeisenä päivänä.
 *
 * Ajetaan päivämääräkuvion JÄLKEEN, jottei "1.5.2026 – 30.9.2026" osu
 * tähän vahingossa.
 */
const MONTH_RANGE = /sopimuskausi\s+on\s+(\d{1,2})\s*[-–—]\s*(\d{1,2})\.(\d{4})/i

/*
 * "Kohteen töiden tulee olla täysin valmiit ja luovutettavissa tilaajalle
 * viimeistään 31.5.2026." Antaa vain loppupäivän, mutta se riittää:
 * valmistumisaika on se mitä vaiheesta halutaan tietää.
 */
const DEADLINE =
  /valmiit\s+ja\s+luovutettavissa[^.]{0,80}?viimeistään\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i

/*
 * TIETOISESTI POIS: "toteutusaikataulu" ja "urakka-aika".
 *
 * Toteutusaikataulu on lähes aina ALUSTAVA ja kuvaa suunnitteluvaiheita
 * ("hankesuunnitelman hyväksyminen 6/2026, toteutussuunnittelu 8/2026-2/2027"),
 * eli hanke on juuri siinä vaiheessa miksi se on merkittykin. Urakka-aika
 * taas mainitaan tyypillisesti ilman päivämäärää ("urakka-aika alkaa kun
 * sopimus on allekirjoitettu"). Kummastakin luettu vaihe olisi arvaus.
 */

function toDate(day: string, month: string, year: string): Date {
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export function extractContractPeriod(
  description: string | null | undefined
): ContractPeriod | null {
  if (!description) return null
  const text = normalize(description)

  const period = text.match(PERIOD)
  if (period) {
    const [, d1, m1, y1, d2, m2, y2] = period
    return { start: toDate(d1, m1, y1 ?? y2), end: toDate(d2, m2, y2) }
  }

  const months = text.match(MONTH_RANGE)
  if (months) {
    const [, m1, m2, y] = months
    const startMonth = Number(m1)
    const endMonth = Number(m2)
    const endYear = Number(y)

    /*
     * Vuodenvaihteen ylittävä kausi ("11-03.2026") alkaa edellisenä
     * vuonna. Ilman tätä alku olisi loppua myöhempi ja vaihe menisi
     * "Sopimus myönnetty" vaikka kausi olisi jo käynnissä.
     */
    const startYear = startMonth <= endMonth ? endYear : endYear - 1

    return {
      start: new Date(startYear, startMonth - 1, 1),
      /* Kuukauden viimeinen päivä: seuraavan kuun päivä 0. */
      end: new Date(endYear, endMonth, 0),
    }
  }

  const deadline = text.match(DEADLINE)
  if (deadline) {
    const [, d, m, y] = deadline
    return { start: null, end: toDate(d, m, y) }
  }

  return null
}

/*
 * Vaihe sopimuskaudesta ja voittajasta. `fallback` on lähteen oma
 * otsikkopäättely, jota käytetään vain kun kumpaakaan signaalia ei ole -
 * Helsingillä se on rikkaampi kuin muilla, eikä sitä haluta menettää.
 */
export function inferDecisionPhase(opts: {
  description: string | null | undefined
  hasWinner: boolean
  fallback: string
  /* Otsikko tarvitaan vain kilpailutuksen vartijaan; ilman sitä se ohittuu. */
  title?: string | null
  now?: Date
}): string {
  const { description, hasWinner, fallback, title } = opts
  const now = opts.now ?? new Date()

  const period = extractContractPeriod(description)
  if (period) {
    if (period.end < now) return PHASE_DONE
    if (period.start && period.start <= now) return PHASE_ONGOING
    return PHASE_AWARDED
  }

  if (hasWinner) return PHASE_AWARDED

  /*
   * Kilpailutus on vasta edessä: teksti sanoo että työ kilpailutetaan,
   * eikä voittajaa ole. Tarkistetaan ennen varasääntöä, koska juuri
   * varasääntö (otsikon "urakka") antaa näille väärän vaiheen.
   */
  const text = description ?? ""
  if (
    COMPETITION_PENDING.test(text) &&
    !COMPETITION_DONE.test(text) &&
    CONTRACT_TITLE.test(title ?? "")
  ) {
    return PHASE_TENDER
  }

  return fallback
}

/*
 * Otsikkoheuristiikka, joka oli kopioituna CaseM:ssä, Dynastyssa ja Turussa.
 * Jää varalle silloin kun päätöstekstistä ei löydy kumpaakaan signaalia.
 */
/*
 * Kilpailutuksen ALOITUSPÄÄTÖS ei ole myönnetty sopimus. Otsikossa on
 * "urakka", joten pelkkä /urak/ antoi väärän vaiheen:
 *
 *   "Puhjon risteyssilta (W) korjausurakka 2026, korjausurakan
 *    kilpailuttaminen, kilpailutusperiaatteet"  ->  "Sopimus myönnetty"
 *
 * Päätös vasta hyväksyy tarjouspyynnön ennen sen julkaisua - urakoitsijaa
 * ei ole. Tarkistetaan siksi ennen urakkasanaa.
 */
const COMPETITION_START =
  /kilpailutusperiaat|kilpailuttamin|kilpailutuksen\s+aloitt|tarjouspyynnön\s+hyväksy|urakoitsijan\s+kilpailutus/i

/*
 * KILPAILUTUS VOI OLLA VAIN TEKSTISSÄ. "Päällystysurakka 2026 + optiot –
 * sisäinen hankintapäätös" ei kerro otsikossa mitään kilpailutuksesta,
 * mutta teksti sanoo "Päällystysurakassa KILPAILUTETAAN ... työt" - eli
 * kilpailutus on vasta edessä. Otsikon sana "urakka" antoi vaiheeksi
 * "Sopimus myönnetty" vaikka mitään ei ole myönnetty.
 *
 * KOLME VARTIJAA, koska pelkkä sana "kilpailutetaan" osuu aineistossa
 * neljään riviin joista vain yksi on kilpailutuspäätös:
 *
 *   1. Voittajaa ei ole  - voittaja kumoaa tämän aina.
 *   2. Ei mennyttä muotoa - "on kilpailutettu" tarkoittaa jo tehtyä.
 *   3. Otsikossa "urak"  - pudottaa vuokrauspäätöksen, lausunnon ja
 *      toteutusmuotopäätöksen, joissa sana esiintyy sivulauseessa.
 */
const COMPETITION_PENDING = /\bkilpailutetaan\b|kilpailutus\s+(?:käynnistet|aloitet)/i
const COMPETITION_DONE = /on\s+kilpailutettu|kilpailutettu\s+(?:avointa|rajoitettua|julkisista)/i
const CONTRACT_TITLE = /urak/i

export function phaseFromTitle(title: string): string {
  if (COMPETITION_START.test(title)) return PHASE_TENDER
  return /urak/i.test(title) ? PHASE_AWARDED : "Suunnittelussa"
}
