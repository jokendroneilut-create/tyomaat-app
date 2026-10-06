import { normalizeLegacyPhase } from "@/lib/projects/phases"
import { hankkeenYritysavaimet } from "./yritysavain"

/*
 * YHTEYSTIEDON KATTAVUUS (D-239).
 *
 * Johannes 6.10.2026: *"nyt aloitetaan keskittyminen yhteyshenkiloihin
 * toden teolla. tehdaan sille ensin kunnon mittarit."*
 *
 * TIUKKA MAARITELMA. Sama aineisto antaa kaksi tysin eri lukua:
 *
 *   loysa  — onko kontaktikenttaa lainkaan            86 %
 *   tiukka — nimetty henkilo + sahkoposti tai puhelin  57 %
 *
 * Loysa luku on imarteleva ja hyodyton: siihen lasketaan
 * "kaavoitus@vihti.fi" ja nimettomat organisaatiorivit. Myyja ei voi
 * soittaa postilaatikolle. Mittari mittaa siis sita, onko hankkeessa
 * ihminen jolle voi soittaa — ei sita, onko kentassa jotain.
 *
 * VIRANOMAINEN EI OLE YHTEYSHENKILO. Luvan ratkaissut rakennustarkastaja
 * tuntee hankkeen muttei osta siita mitaan (D-207). Han on merkitty
 * `role: "authority"` eika lasketa mukaan.
 */

export type Kontakti = {
  name?: string | null
  email?: string | null
  phone?: string | null
  role?: string | null
  kind?: string | null
  /*
   * TASO: KENEN YHTEYSHENKILO (D-241).
   *
   * Johannes 6.10.2026: *"yrityskohtainen tieto on parempi kun ei tietoa
   * ollenkaan. voi se olla jos se kerrotaan kayttajalle selvasti. tavoite
   * on kuitenkin loytaa hankekohtainen yhteyshenkilo."*
   *
   *   "project"  — tama hanke: nimi on luettu hankkeen omasta
   *                asiakirjasta (Helsingin paatoksen projektipaallikko,
   *                tiedotteen yhteyshenkilo)
   *   "company"  — yrityksen yleinen: oikea yritys, muttei tama hanke
   *
   * PUUTTUVA ARVO ON "project". Kaikki tahan asti kerätyt kontaktit
   * tulevat hankkeen omasta lahteesta, joten oletus on se mika ne ovat.
   * Yrityskohtainen taso on merkittava erikseen silloin kun se otetaan
   * kayttoon — muuten tasot sekoittuisivat hiljaa ja mittari nayttaisi
   * paremmalta kuin tilanne on.
   */
  level?: "project" | "company" | null
}

export function kelpaaYhteyshenkiloksi(kontakti: Kontakti | null | undefined): boolean {
  if (!kontakti) return false
  if (String(kontakti.role ?? "") === "authority") return false

  const nimi = String(kontakti.name ?? "").trim()
  if (!nimi) return false

  const sahkoposti = String(kontakti.email ?? "").trim()
  const puhelin = String(kontakti.phone ?? "").trim()
  return Boolean(sahkoposti || puhelin)
}

export function onHankekohtainen(kontakti: Kontakti | null | undefined): boolean {
  return String(kontakti?.level ?? "project") === "project"
}

export function onYhteyshenkilo(metadata: unknown): boolean {
  return kontaktit(metadata).some(kelpaaYhteyshenkiloksi)
}

/* Vain taman hankkeen oma yhteyshenkilo — tavoite, johon pyritaan. */
export function onHankekohtainenYhteyshenkilo(metadata: unknown): boolean {
  return kontaktit(metadata).some((k) => kelpaaYhteyshenkiloksi(k) && onHankekohtainen(k))
}

function kontaktit(metadata: unknown): Kontakti[] {
  const lista = (metadata as { contact_persons?: unknown } | null)?.contact_persons
  return Array.isArray(lista) ? (lista as Kontakti[]) : []
}

/*
 * MITATTAVAT VAIHEET.
 *
 * Kannassa on kaksi kirjoitusasua samalle vaiheelle ("Suunnittelussa" ja
 * "Suunnittelu", "Rakenteilla" ja "Rakentaminen aloitettu"), joten vaihe
 * on normalisoitava — muuten mittari nayttaisi vain puolet joukosta.
 * Mitattu 6.10.2026: erikseen laskettuna 352 ja 373 hanketta, yhdessa
 * 725.
 */
export const MITATTAVAT_VAIHEET = ["construction", "planning"] as const
export type MitattavaVaihe = (typeof MITATTAVAT_VAIHEET)[number]

export const VAIHEEN_NIMI: Record<MitattavaVaihe, string> = {
  construction: "Rakenteilla",
  planning: "Suunnittelussa",
}

export type Kattavuus = {
  vaihe: MitattavaVaihe
  hankkeita: number
  /* Mika tahansa kelvollinen yhteyshenkilo, myos yrityskohtainen. */
  yhteystiedolla: number
  /* Vain taman hankkeen oma yhteyshenkilo. */
  hankekohtaisia: number
  osuus: number
  hankekohtainenOsuus: number
}

export type MitattavaHanke = {
  phase?: string | null
  status?: string | null
  is_public?: boolean | null
  metadata?: unknown
  /* Yritysrekisterin liitosta varten (D-242). */
  developer?: string | null
  builder?: string | null
}

/*
 * Mukaan vain asiakkaalle nakyvat aktiiviset hankkeet: piilotetun
 * hankkeen yhteystieto ei hyodyta ketaan, eika sen puute ole puute.
 */
/*
 * Yrityskohtainen taydennys (D-242): hanke jolla ei ole omaa
 * yhteyshenkiloa mutta jonka yritys on rekisterissa. Rekisteri annetaan
 * parametrina, jotta laskenta pysyy puhtaana funktiona ja testattavana.
 */
export function laskeKattavuus(
  hankkeet: MitattavaHanke[],
  yritysrekisteri?: { has: (avain: string) => boolean }
): Kattavuus[] {
  return MITATTAVAT_VAIHEET.map((vaihe) => {
    const joukko = hankkeet.filter(
      (h) =>
        h.status === "active" &&
        h.is_public === true &&
        normalizeLegacyPhase(h.phase) === vaihe
    )
    const hankekohtaisia = joukko.filter((h) => onHankekohtainenYhteyshenkilo(h.metadata)).length

    /*
     * Kokonaisluku kattaa myos rekisterista tulevan yrityskohtaisen
     * yhteyshenkilon — se on juuri se ero jonka harmaa neula nayttaa.
     */
    const yhteystiedolla = joukko.filter(
      (h) =>
        onYhteyshenkilo(h.metadata) ||
        (yritysrekisteri
          ? hankkeenYritysavaimet(h).some((avain) => yritysrekisteri.has(avain))
          : false)
    ).length

    return {
      vaihe,
      hankkeita: joukko.length,
      yhteystiedolla,
      hankekohtaisia,
      osuus: joukko.length ? yhteystiedolla / joukko.length : 0,
      hankekohtainenOsuus: joukko.length ? hankekohtaisia / joukko.length : 0,
    }
  })
}
