import crypto from "node:crypto"

/*
 * PIETARSAAREN KAAVOJEN TUNNISTE.
 *
 * Kaavan identiteetti on sivun otsikosta johdettu slug
 * ("asemakaavan-muutos-keskustassa"), ja sillä hanke tunnistetaan samaksi
 * ajosta toiseen. Sivulla on kuitenkin KAKSI eri kaavaa samalla
 * otsikolla:
 *
 *   "Asemakaavan muutos Keskustassa"  kirkon kortteli 15 (kirkko v. 1731)
 *   "Asemakaavan muutos Keskustassa"  Maria Malmin kortteli, ent. virastotalo
 *
 * Molemmat kirjoittuivat samaan slugiin, joten jälkimmäinen ylikirjoitti
 * ensimmäisen joka ajolla — eikä kirkon korttelin kaava koskaan päätynyt
 * järjestelmään, vaikka juuri sillä oli luonnos nähtävillä keväällä 2026.
 * Sivun 18 kaavasta meillä oli 17.
 *
 * Erotin otetaan KUVAUKSESTA, ei lohkon järjestysnumerosta. Numerointi
 * ("-2") vaihtaisi kaavojen identiteetit keskenään heti kun kaupunki
 * järjestää lohkot uudelleen, ja kaksi hanketta vaihtaisi sisältönsä
 * hiljaa. Kuvauksesta laskettu tiiviste pysyy samana lohkon paikasta
 * riippumatta.
 *
 * Erotin lisätään VAIN kun sama otsikko esiintyy sivulla useammin kuin
 * kerran. Muuten kaikkien 18 kaavan tunniste vaihtuisi kerralla ja ne
 * palaisivat jonoon kaksoiskappaleina.
 *
 * Tiedossa oleva rajoite: jos toinen samannimisistä kaavoista poistuu
 * sivulta, jäljelle jäävän tunniste palaa pelkäksi otsikkoslugiksi ja se
 * tulee jonoon uutena ehdokkaana. Se on yksi katselmoitava rivi, ei
 * hiljainen virhe.
 */

export type KaavaLohko = { title: string; description?: string | null }

export function pietarsaariSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/* Lyhyt tiiviste kuvauksesta: pituus riittää erottamaan kaksi kaavaa. */
function erotin(description: string | null | undefined): string {
  const teksti = (description ?? "").replace(/\s+/g, " ").trim().toLowerCase()
  return crypto.createHash("sha256").update(teksti).digest("hex").slice(0, 8)
}

export function pietarsaariKaavaSlugs(lohkot: KaavaLohko[]): string[] {
  const perus = lohkot.map((l) => pietarsaariSlug(l.title))

  const maara = new Map<string, number>()
  for (const s of perus) maara.set(s, (maara.get(s) ?? 0) + 1)

  return perus.map((s, i) => ((maara.get(s) ?? 0) > 1 ? `${s}-${erotin(lohkot[i].description)}` : s))
}

/*
 * SAMANNIMISTEN KAAVOJEN EROTTAMINEN NIMESSÄ.
 *
 * Pelkkä eri tunniste ei riitä. Ehdokkaiden yhdistäminen putoaa
 * viimeisenä keinona osoitteen ja kunnan vertailuun, ja näillä kaavoilla
 * "osoite" on kaavan otsikko — joten kaksi samannimistä Keskustan kaavaa
 * sulautui yhdeksi vielä senkin jälkeen kun tunnisteet erosivat. Kaksi
 * samannimistä hanketta olisi muutenkin myyjälle lukukelvoton pari.
 *
 * Tarkenne otetaan kaupungin OMASTA asiakirjan nimestä
 * ("OAS-kirkko-ja-sen-ymparisto-kaava-041.pdf" -> "kirkko ja sen
 * ymparisto", "Maria-Malm-PDB.pdf" -> "Maria Malm"). Emme siis keksi
 * nimeä vaan luemme sen lähteestä.
 */

/* Asiakirjatyyppien ja päivämäärien sanoja, jotka eivät erota kaavoja. */
const YLEISSANAT = new Set([
  "oas", "pdb", "kaava", "kaavakartta", "kartta", "asemakaava", "asemakaavakartta",
  "detaljplan", "detaljplanekarta", "detaljplaneandring", "plan", "planbeskrivning",
  "beskrivning", "beskriving", "selostus", "signed", "u", "so", "x1", "muutettu",
  "justerad", "uppdatering", "utvidgad", "utvidgning", "paivitys", "fisv",
])

function tiedostonNimi(href: string): string {
  const ilmanKyselya = href.split("?")[0].split("#")[0]
  let nimi = ilmanKyselya.split("/").pop() ?? ""
  try {
    nimi = decodeURIComponent(nimi)
  } catch {
    /* viallinen prosenttikoodaus: käytetään nimeä sellaisenaan */
  }
  return nimi.replace(/\.pdf$/i, "")
}

export function pietarsaariKaavaQualifier(documents: string[]): string | null {
  for (const href of documents) {
    const sanat = tiedostonNimi(href)
      .split(/[-_.\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      /* numerot ovat kaavanumeroita ja päivämääriä, eivät nimiä */
      .filter((s) => !/^\d+$/.test(s))
      .filter((s) => !/^\d{1,2}\.?\d{0,2}\.?\d{2,4}$/.test(s))
      .filter((s) => !YLEISSANAT.has(s.toLowerCase()))

    if (sanat.length) return sanat.join(" ")
  }
  return null
}

export function pietarsaariKaavaTitles(
  lohkot: (KaavaLohko & { documents?: string[] })[]
): string[] {
  const maara = new Map<string, number>()
  for (const l of lohkot) maara.set(l.title, (maara.get(l.title) ?? 0) + 1)

  const slugit = pietarsaariKaavaSlugs(lohkot)

  const tarkenteet = lohkot.map((l, i) => {
    if ((maara.get(l.title) ?? 0) < 2) return null
    /*
     * Viimeinen keino on tunnisteen tiiviste. Se on ruma mutta aina eri,
     * eikä kahta kaavaa saa päästää sulautumaan pelkän saman nimen takia.
     */
    return pietarsaariKaavaQualifier(l.documents ?? []) ?? slugit[i].split("-").pop() ?? null
  })

  /* Jos tarkenteet osuivat samaksi, ne eivät erota mitään. */
  return lohkot.map((l, i) => {
    const t = tarkenteet[i]
    if (!t) return l.title
    const sama = tarkenteet.some((muu, j) => j !== i && muu === t && lohkot[j].title === l.title)
    const kaytettava = sama ? (slugit[i].split("-").pop() ?? t) : t
    return `${l.title} (${kaytettava})`
  })
}
