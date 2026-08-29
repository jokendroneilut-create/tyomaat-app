/*
 * TALOYHTIÖN NIMI TÄSMÄYTYSAVAIMENA.
 *
 * "Asunto Oy Oulun Valoisa" on rekisteröity ja yksikäsitteinen tavalla
 * jota tiedoteotsikko ei ole. Sama hanke tunnistuu siitä vaikka otsikot
 * olisivat täysin eri lauseita — juuri niin kuin Laptin Hiukkavaarassa,
 * joka jäi 38 pisteeseen vaikka molemmissa teksteissä lukee sama yhtiö.
 *
 * KOKO KUVAUS ON KELVOTON LÄHDE. Mitattu 29.8.2026: kaikkien mainintojen
 * poiminta yhdisti Oulun, Turun, Porin ja Joensuun hankkeet samaan
 * avaimeen, koska tiedotteet luettelevat lopussa yrityksen MUITA
 * kohteita. Väärät parit 472. Pelkkä ensimmäinen maininta ei riittänyt
 * (193 väärää): tiedote johtaa toisinaan toisella kohteella.
 *
 * Rajaus otsikkoon ja ensimmäiseen virkkeeseen pudotti väärät parit
 * kahteen, ja nekin olivat kaupunkivirheitä eivät vääriä linkkejä.
 *
 * Avain EI mene calculateMatchiin eikä automaattiseen yhdistämiseen,
 * vaan ehdotuslistaan — sama linja kuin katuavaimella (D-090).
 */

const YHTIO_RE =
  /\b((?:Asunto|As\.?|Kiinteistö|Koy|KOy)\s*\.?\s*Oy\.?\s+[A-ZÄÖÅ][\wÄÖÅäöå-]+(?:\s+[A-ZÄÖÅ][\wÄÖÅäöå-]+){0,3})/

/*
 * Sijapäätteet pisimmästä lyhimpään: "Valoisaan", "Valoisan" ja
 * "Valoisa" ovat sama yhtiö.
 */
const PAATTEET = [
  "seen", "lle", "lla", "llä",
  "ssa", "ssä", "sta", "stä", "ksi", "ien",
  "in", "en", "an", "än", "on", "ön", "n",
]

/* Yhtiömuoto pois: se toistuu joka nimessä eikä erota mitään. */
const YHTIOMUOTO = /\b(asunto|as|kiinteistö|koy|oy|osakeyhtiö)\b/g

export function normalizeHousingCompany(nimi: string): string {
  const sanat = String(nimi ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(YHTIOMUOTO, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)

  if (!sanat.length) return ""

  /*
   * Vain viimeinen sana riisutaan: se on yhtiön erottava osa ja
   * taipuu. Edeltävät ovat yleensä paikannimiä ("Oulun", "Helsingin"),
   * joiden genetiivi kuuluu nimeen.
   */
  return sanat
    .map((s, i) => {
      if (i < sanat.length - 1) return s

      let sana = s
      for (const p of PAATTEET) {
        if (sana.length > p.length + 2 && sana.endsWith(p)) {
          sana = sana.slice(0, -p.length)
          break
        }
      }

      /*
       * Loppuvokaalit pois. Suomen taivutus ei riisu siististi
       * pelkillä päätteillä: "Valoisa", "Valoisan" ja "Valoisaan"
       * tuottivat kolme eri vartaloa. Karkea karsinta yhdistää ne, ja
       * neljän merkin raja suojaa lyhyet nimet ("Pyy").
       */
      while (sana.length > 4 && /[aeiouyäö]$/.test(sana)) {
        sana = sana.slice(0, -1)
      }

      return sana
    })
    .join(" ")
}

/*
 * Otsikko ja kuvauksen KAKSI ENSIMMÄISTÄ VIRKETTÄ. Rajaus on mitattu,
 * ei arvattu — ks. moduulin alku.
 *
 * Yksi virke ei riitä: STT:n tiedote johtaa yleisellä lauseella ja
 * nimeää taloyhtiön vasta toisessa virkkeessä ("Lapti on aloittanut…
 * Asunto Oy Oulun Valoisaan valmistuu 29 asuntoa").
 */
export function housingCompanyKey(
  title: string | null | undefined,
  description?: string | null
): string | null {
  const alkuvirkkeet = String(description ?? "")
    .split(/(?<=\.)\s/)
    .slice(0, 2)
    .join(" ")

  const alku = `${String(title ?? "")} ${alkuvirkkeet}`.trim()
  if (!alku) return null

  const m = YHTIO_RE.exec(alku)
  if (!m?.[1]) return null

  const avain = normalizeHousingCompany(m[1].replace(/\s+/g, " ").trim())

  /*
   * Pelkkä paikannimi ei yksilöi mitään: "Asunto Oy Oulun" osuisi
   * kaikkiin oululaisiin taloyhtiöihin. Siksi vaaditaan joko kaksi
   * sanaa (paikka + erottava osa) tai riittävän pitkä yksittäinen nimi.
   */
  const monisanainen = avain.includes(" ")
  return monisanainen || avain.length >= 6 ? avain : null
}
