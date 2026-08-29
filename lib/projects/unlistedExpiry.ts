/*
 * HANKE JOTA EI ENAA OLE LAHTEEN LISTALLA.
 *
 * Kaavoitushankkeille ei ollut yhtaan poistumistapaa. Mitattu 29.8.2026:
 * 2901 kaavahanketta, joista 2890 nakyi asiakkaalle, 0 vanhentunutta ja
 * 0 manuaalista vanhenemispaivaa. Kaava jai siis nakymaan ikuisesti.
 *
 * Lahde itse kertoo milloin hanke on ohi: kaava katoaa kaupungin
 * "vireilla olevat" -listalta kun kaavoitus on paattynyt (hyvaksyminen,
 * lainvoima, raukeaminen tai yhdistaminen toiseen kaavaan). Sita ei
 * kuitenkaan voi lukea siita etta rivia ei kirjoitettu: osa keraajista
 * lukee listasta vain muutaman sivun kerrallaan. Siksi paatos tehdaan
 * `last_seen_at`-kentasta ja pitkasta kynnyksesta.
 *
 * KYNNYS 60 VRK. Pisin tiedetty keraajan kierros on Oulun 2 sivua
 * vuorokaudessa, eli koko lista noin 10 vuorokaudessa. 60 on siita
 * kuusinkertainen varmuusmarginaali. Lyhyempaa ei voi perustella
 * mittauksella: kanta on vasta kuusi viikkoa vanha.
 *
 * VANHENEMINEN EI OLE POISTO. Hanke saa tilan "expired", joka piilottaa
 * sen asiakkaan listalta mutta sailyttaa rivin ja historian. Jos
 * dokumentti nakyy lahteella uudelleen, hanke palautetaan.
 */

/*
 * KYTKIN: ENSIMMAINEN AITO VANHENEMINEN ON TEHTAVA TIETOISESTI.
 *
 * Cron ajaa joka aamu klo 5:45, joten ilman tata se ehtisi vanhentaa
 * ensimmaisen erän ennen kuin kukaan on lukenut yhtaan riviä. Juuri
 * ensimmainen ajo on se joka paljastaa jos saanto vanhentaa jotain
 * vaarin — ja se on luettava riveittain, kuten jokainen takautuva ajo.
 *
 * Kytkin pois: cron laskee paatokset ja raportoi ne, mutta EI kirjoita
 * mitaan. Se toimii siis tarkkailijana.
 *
 * Kytkin paalle: vaihda arvoksi true ja pushaa. Tallainen kytkin kuuluu
 * koodiin eika ympäristomuuttujaan tai osoiteparametriin, koska silloin
 * paatos nakyy git-historiassa eika se voi tapahtua vahingossa.
 *
 * Ennen kytkemista: aja kuivaharjoitus ja lue tulos riveittain.
 *   npx tsx scripts/dry-run-unlisted-expiry.ts
 */
export const UNLISTED_EXPIRY_ENABLED = false

/*
 * Kirjoitetaanko tallä ajolla. Kytkin voittaa aina: kuivaharjoituksen voi
 * pyytaa, mutta kirjoittamista ei voi pyytaa kytkimen ohi.
 */
export function writesAllowed(
  enabled: boolean,
  dryRunRequested: boolean
): boolean {
  if (!enabled) return false
  return !dryRunRequested
}

export const UNLISTED_THRESHOLD_DAYS = 60

/* Lahde on elossa vain jos se on ajettu aivan askettain JA tuottanut jotain. */
export type SourceHealth = {
  lastSuccessAt: string | null
  /* Milloin lahde viimeksi kirjoitti YHDENKAAN dokumentin. */
  lastWriteAt: string | null
}

export type UnlistedInput = {
  now: Date
  status: string | null
  phase: string | null
  /* Dokumentin last_seen_at. null = ei koskaan nahty uudella kentalla. */
  lastSeenAt: string | null
  /* Onko dokumentti pelkka listausrivi jonka last_seen_at ei paivity. */
  listingOnly?: boolean
  source: SourceHealth
  /* Tuorein havainto MISTA TAHANSA muusta lahteesta samalle hankkeelle. */
  otherSourceSeenAt?: string | null
  expiredReason?: string | null
}

export const UNLISTED_REASON = "ei_enaa_lahteen_listalla"

function vrk(a: Date, b: string | null | undefined): number | null {
  if (!b) return null
  const t = new Date(b).getTime()
  if (Number.isNaN(t)) return null
  return (a.getTime() - t) / 86400000
}

export function evaluateUnlisted(
  input: UnlistedInput
): "expire" | "revive" | "keep" {
  const nahtyVrk = vrk(input.now, input.lastSeenAt)

  /*
   * PALAUTUS ENSIN. Jos hanke on vanhennettu juuri tasta syysta ja
   * dokumentti on taas nakynyt, se palaa nakyviin heti — riippumatta
   * siita onko lahde muuten terve.
   */
  if (input.status === "expired" && input.expiredReason === UNLISTED_REASON) {
    if (nahtyVrk !== null && nahtyVrk < UNLISTED_THRESHOLD_DAYS) return "revive"
    return "keep"
  }

  if (input.status !== "active") return "keep"

  /* Valmistunut hanke on jo poistunut nakyvista toista reittia. */
  if (input.phase === "Valmistunut") return "keep"

  /*
   * Tyhja last_seen_at ei ole todiste katoamisesta vaan siita ettei
   * kenttaa ole viela kirjoitettu. Mieluummin tyhja kuin vaara.
   */
  if (nahtyVrk === null) return "keep"

  /* Listausrivit eivat paivity, joten niiden ika ei kerro mitaan. */
  if (input.listingOnly) return "keep"

  /*
   * HILJAINEN LAHDEVIKA EI SAA VANHENTAA HANKKEITA. Jos lahde ei ole
   * ajettu tai se ei ole kirjoittanut mitaan, kaikki sen dokumentit
   * nayttaisivat kadonneen yhta aikaa.
   */
  const ajoVrk = vrk(input.now, input.source.lastSuccessAt)
  const kirjoitusVrk = vrk(input.now, input.source.lastWriteAt)
  if (ajoVrk === null || ajoVrk > 3) return "keep"
  if (kirjoitusVrk === null || kirjoitusVrk > 7) return "keep"

  /* Toinen lahde on nahnyt hankkeen askettain: se on yha elossa. */
  const muuVrk = vrk(input.now, input.otherSourceSeenAt)
  if (muuVrk !== null && muuVrk < UNLISTED_THRESHOLD_DAYS) return "keep"

  return nahtyVrk >= UNLISTED_THRESHOLD_DAYS ? "expire" : "keep"
}
