import { TRIAL_DAYS, daysSince } from "@/lib/users/trial"

/*
 * KOKEILUJAKSON MUISTUTUKSET (D-339).
 *
 * Johannes 23.10.2026: *"Tarvitsemme ominaisuuden joka muistuttaa trial
 * kayttajia. Muistutuksia voisi lahtea testikayttajille viikon valein
 * trialin aikana."*
 *
 * Kolme viestia: kun kokeilua on jaljella 21, 14 ja 7 paivaa. Koska
 * kokeilu on 30 vrk, laukaisupaivat ovat tunnuksen ian 9, 16 ja 23.
 * Johannes 24.10.2026: *"laske kokeilujakson jaljella olevat paivat ja
 * ilmoitetaan kayttajalle todelliset luvut."* Siksi viestiin menee
 * LASKETTU jaljella oleva maara, ei virstanpylvaan numero: jos ajo
 * myohastyy paivalla, teksti kertoo 20 eika 21.
 *
 * KENELLE: vain `customer_billing.tila = "testi"` (naytolla "Trial").
 * Johannes 24.10.2026: *"koneunionilla on valittuna tila 'ei maksava'
 * -> heille ei laheteta mitaan eika kenellekaan muullekaan jonka tila
 * on 'ei maksava'."* Siksi ehto on valkolista eika mustalista: tuntematon
 * tai puuttuva tila ei saa viestia.
 *
 * EI LUKITUILLE ([[locked-accounts-get-no-mail]]), eika adminille tai
 * myyjalle -- he eivat ole asiakkaita.
 *
 * EI TAKAUTUVIA VIESTEJA. Johannes: *"ne joilla trial on nyt mennyt jo
 * yli niin hoidan kasin."* Virstanpylvas ohitetaan pysyvasti jos tunnus
 * oli jo sen ohi ALOITUSPAIVANA -- nain ominaisuuden kayttoonotto ei
 * laukaise kerralla kymmenia viesteja menneista rajapyykeista.
 */

/* Paivia jaljella, suurimmasta pienimpaan. */
export const MUISTUTUKSET = [21, 14, 7] as const

/* Ominaisuus otettiin kayttoon tana paivana; sita ennen menneet rajapyykit hoidetaan kasin. */
export const ALOITUSPAIVA = "2026-10-24"

/* Nama roolit eivat ole asiakkaita. */
const EI_ASIAKAS = new Set(["admin", "seller"])

export type MuistutusEhdokas = {
  userId: string
  email: string | null
  /* auth.users.created_at -- EI profiles.created_at ([[account-lifecycle-log]]). */
  createdAt: string | null
  etunimi?: string | null
  /* customer_billing.tila asiakkaan tunnisteelta. */
  tila?: string | null
  lukittu?: boolean
  rooli?: string | null
  /* Jo kasitellyt virstanpylvaat (lahetetyt JA ohitetut). */
  kasitellyt?: number[]
}

export type Muistutus = {
  userId: string
  email: string
  etunimi: string | null
  /* Menee viestiin. */
  paiviaJaljella: number
  /* 21 | 14 | 7 -- lokin avain. */
  virstanpylvas: number
  /*
   * Virstanpylvaat jotka tama viesti tekee tarpeettomiksi. Jos ajo on
   * ollut poikki ja tunnus ohitti kaksi rajapyykkia, lahetetaan vain
   * kiireisin ja vanhemmat merkitaan ohitetuiksi -- muuten ne lahtisivat
   * seuraavana paivana vanhentuneella luvulla.
   */
  vanhentuneet: number[]
}

/* Montako paivaa kokeilua on jaljella; negatiivinen = ohi. */
export function paiviaJaljella(createdAt: string | null | undefined, now: number): number | null {
  const ika = daysSince(createdAt, now)
  if (ika == null) return null
  return TRIAL_DAYS - ika
}

export function valitseMuistutettavat(
  ehdokkaat: MuistutusEhdokas[],
  now: number = Date.now(),
  aloituspaiva: string = ALOITUSPAIVA
): Muistutus[] {
  const aloitus = new Date(`${aloituspaiva}T00:00:00Z`).getTime()
  const tulos: Muistutus[] = []

  for (const e of ehdokkaat) {
    if (!e.email) continue
    if (e.tila !== "testi") continue
    if (e.lukittu) continue
    if (e.rooli && EI_ASIAKAS.has(e.rooli)) continue

    const jaljella = paiviaJaljella(e.createdAt, now)
    if (jaljella == null || jaljella <= 0) continue

    const ika = daysSince(e.createdAt, now)
    const ikaAloituspaivana = daysSince(e.createdAt, aloitus)
    if (ika == null) continue

    const kasitellyt = new Set(e.kasitellyt ?? [])

    /*
     * Erapaiva saavutetaan kun ika >= TRIAL_DAYS - virstanpylvas.
     * Kaydaan kiireisimmasta (7) ylospain, jotta myohastynyt ajo
     * lahettaa oikean eika vanhentuneen luvun.
     */
    const erantyneet = MUISTUTUKSET.filter((m) => {
      const laukaisuIka = TRIAL_DAYS - m
      if (ika < laukaisuIka) return false
      if (kasitellyt.has(m)) return false
      /* Oli jo ohi kun ominaisuus otettiin kayttoon -> ei takautuvaa viestia. */
      if (ikaAloituspaivana != null && ikaAloituspaivana >= laukaisuIka) return false
      return true
    })

    if (!erantyneet.length) continue

    const kiireisin = Math.min(...erantyneet)
    tulos.push({
      userId: e.userId,
      email: e.email,
      etunimi: e.etunimi?.trim() || null,
      paiviaJaljella: jaljella,
      virstanpylvas: kiireisin,
      vanhentuneet: erantyneet.filter((m) => m !== kiireisin),
    })
  }

  return tulos
}

/*
 * VIESTIN TEKSTI.
 *
 * Johanneksen sanamuoto 23.10.2026, luku laskettuna: *"Hei, Tyomaat.fi
 * PRO maksutonta kokeilujaksoasi on jaljella viela N paivaa."*
 */
export function muistutuksenOtsikko(paivia: number): string {
  return `Työmaat.fi PRO -kokeilujaksoasi on jäljellä ${paivia} ${paivia === 1 ? "päivä" : "päivää"}`
}

export function muistutuksenTeksti(
  etunimi: string | null,
  paivia: number,
  appBaseUrl: string
): { text: string; html: string } {
  const tervehdys = etunimi ? `Hei ${etunimi},` : "Hei,"
  const maara = `${paivia} ${paivia === 1 ? "päivä" : "päivää"}`

  const rivit = [
    tervehdys,
    "",
    `Työmaat.fi PRO -maksutonta kokeilujaksoasi on jäljellä vielä ${maara}.`,
    "",
    "Kokeilujakson aikana käytössäsi on koko palvelu: hankkeet kaikista lähteistä, hakuvahdit ja yhteystiedot.",
    "",
    `Avaa palvelu: ${appBaseUrl}`,
    "",
    "Jos haluat jatkaa kokeilun jälkeen tai sinulla on kysyttävää, vastaa tähän viestiin.",
    "",
    "Ystävällisin terveisin,",
    "Johannes Sippola",
    "Työmaat.fi",
  ]

  const text = rivit.join("\n")

  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111827;">` +
    `<p>${tervehdys}</p>` +
    `<p>Työmaat.fi PRO -maksutonta kokeilujaksoasi on jäljellä vielä <strong>${maara}</strong>.</p>` +
    `<p>Kokeilujakson aikana käytössäsi on koko palvelu: hankkeet kaikista lähteistä, hakuvahdit ja yhteystiedot.</p>` +
    `<p><a href="${appBaseUrl}" style="color:#1d4ed8;">Avaa Työmaat.fi</a></p>` +
    `<p>Jos haluat jatkaa kokeilun jälkeen tai sinulla on kysyttävää, vastaa tähän viestiin.</p>` +
    `<p>Ystävällisin terveisin,<br />Johannes Sippola<br />Työmaat.fi</p>` +
    `</div>`

  return { text, html }
}
