import {
  kaavanLopputila,
  kaavavaiheMeneeTaaksepain,
  type KaavanLopputila,
} from "./kaavanLopputila"

/*
 * KAAVAN LOPPUTILA NOSTAA RIVIN KATSELMOINTIIN (D-396).
 *
 * Johannes 8.11.2026 valitsi kahdesta vaihtoehdosta tämän: lainvoimainen
 * kaava EI siirrä hanketta automaattisesti eteenpäin, vaan nostaa sen
 * ihmisen katselmoitavaksi (`needs_review`, "Tarkistettava"-merkki
 * hallintanäkymässä).
 *
 * Perustelu: lähde kertoo että KAAVA on valmis, ei että hanke olisi
 * siirtynyt suunnitteluun. Automaattinen siirto väittäisi enemmän kuin
 * lähde sanoo ([[finding-signal-not-deciding-signal]]). Olemassa oleva
 * `advance-effective-zoning` siirtää hankkeen silloin kun lähteellä on
 * rakenteinen `kaava_tila` + `voimaantulo`; tämä sääntö täydentää sitä
 * niille lähteille joilla on vain vaiheteksti.
 *
 * VAIHE PÄIVITTYY AINA. Dokumentti on tuorein luenta lähteestä, joten
 * `decision_status` kirjoitetaan sen mukaiseksi vaikka lopputilaa ei
 * olisi — muuten hankkeen vaihetieto jää siihen hetkeen jolloin rivi
 * hyväksyttiin ([[own-data-unread]]).
 */

export type KaavanKatselmointi =
  | { toiminto: "nosta"; lopputila: KaavanLopputila; uusiVaihe: string }
  | { toiminto: "paivita_vaihe"; uusiVaihe: string }
  | { toiminto: "ei_mitaan"; syy: string }

export type KaavaHankeTiedot = {
  phase: string | null
  needsReview: boolean | null
  decisionStatus: string | null
}

export type KaavaDokumenttiTiedot = {
  /* `raw_payload.phase` tai `raw_payload.decision_status`. */
  vaihe: string | null
}

export function paatteleKaavanKatselmointi(
  hanke: KaavaHankeTiedot,
  dokumentti: KaavaDokumenttiTiedot | null
): KaavanKatselmointi {
  if (!dokumentti) return { toiminto: "ei_mitaan", syy: "dokumenttia ei löydy osoitteella" }

  const dokumentinVaihe = String(dokumentti.vaihe ?? "").replace(/\s+/g, " ").trim()
  if (!dokumentinVaihe) return { toiminto: "ei_mitaan", syy: "dokumentissa ei vaihetta" }

  const lopputila = kaavanLopputila(dokumentinVaihe)

  if (lopputila) {
    /*
     * Jo nostettua ei nosteta uudelleen: ihminen on nähnyt rivin, ja
     * toistuva nosto tekisi merkistä merkityksettömän. Vaihe päivittyy
     * silti.
     */
    if (hanke.needsReview) {
      return hanke.decisionStatus === dokumentinVaihe
        ? { toiminto: "ei_mitaan", syy: "jo katselmoitavana" }
        : { toiminto: "paivita_vaihe", uusiVaihe: dokumentinVaihe }
    }
    return { toiminto: "nosta", lopputila, uusiVaihe: dokumentinVaihe }
  }

  const meilla = String(hanke.decisionStatus ?? "").replace(/\s+/g, " ").trim()
  if (meilla === dokumentinVaihe) return { toiminto: "ei_mitaan", syy: "vaihe jo ajan tasalla" }

  /*
   * VAIHE SAA VAIN EDETÄ, kuten hankkeen omassa vaiheessa
   * (`phaseAdvances`). Mitattu 8.11.2026: 208 päivityksestä 9 olisi
   * mennyt taaksepäin ("Hyväksyminen" -> "Vireilletulo"). Osa niistä on
   * aitoja — kaava voidaan palauttaa valmisteluun — mutta taaksepäin
   * hyppäävä arvo on myös jäsennysvirheen vakiomuoto, eikä tieto
   * hyväksymisvaiheesta saa kadota sen takia.
   */
  if (kaavavaiheMeneeTaaksepain(meilla, dokumentinVaihe)) {
    return { toiminto: "ei_mitaan", syy: `vaihe menisi taaksepäin (${meilla} -> ${dokumentinVaihe})` }
  }

  return { toiminto: "paivita_vaihe", uusiVaihe: dokumentinVaihe }
}

/*
 * Metadata-kentät jotka noston yhteydessä kirjoitetaan. Erillinen
 * funktio, jotta takautuva ajo ja vuorokausiajo kirjoittavat saman
 * muodon ([[anchor-vocabulary-per-source]] kohta 4).
 *
 * `kaava_tila`-kenttää EI kirjoiteta tässä: se on
 * `advance-effective-zoning`-säännön ehto, ja sen asettaminen siirtäisi
 * hankkeen automaattisesti seuraavana yönä — juuri se mitä tällä
 * säännöllä haluttiin välttää.
 */
export function katselmointiMetadata(
  vanha: Record<string, any> | null | undefined,
  uusiVaihe: string,
  lopputila: KaavanLopputila | null,
  nyt: Date
): Record<string, any> {
  const md = { ...(vanha ?? {}) }
  md.decision_status = uusiVaihe
  md.kaavavaihe_tarkistettu = nyt.toISOString()
  if (lopputila) {
    md.kaava_lopputila = {
      tila: lopputila.tila,
      paiva: lopputila.paiva,
      todiste: lopputila.todiste,
      havaittu: nyt.toISOString(),
    }
    if (lopputila.paiva && lopputila.tila === "lainvoimainen") {
      md.kaava_voimaantulo = md.kaava_voimaantulo ?? lopputila.paiva
    }
  }
  return md
}
