import { normalizeLegacyPhase } from "@/lib/projects/phases"

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

export function onYhteyshenkilo(metadata: unknown): boolean {
  const kontaktit = (metadata as { contact_persons?: unknown } | null)?.contact_persons
  if (!Array.isArray(kontaktit)) return false
  return kontaktit.some((k) => kelpaaYhteyshenkiloksi(k as Kontakti))
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
  yhteystiedolla: number
  osuus: number
}

export type MitattavaHanke = {
  phase?: string | null
  status?: string | null
  is_public?: boolean | null
  metadata?: unknown
}

/*
 * Mukaan vain asiakkaalle nakyvat aktiiviset hankkeet: piilotetun
 * hankkeen yhteystieto ei hyodyta ketaan, eika sen puute ole puute.
 */
export function laskeKattavuus(hankkeet: MitattavaHanke[]): Kattavuus[] {
  return MITATTAVAT_VAIHEET.map((vaihe) => {
    const joukko = hankkeet.filter(
      (h) =>
        h.status === "active" &&
        h.is_public === true &&
        normalizeLegacyPhase(h.phase) === vaihe
    )
    const yhteystiedolla = joukko.filter((h) => onYhteyshenkilo(h.metadata)).length

    return {
      vaihe,
      hankkeita: joukko.length,
      yhteystiedolla,
      osuus: joukko.length ? yhteystiedolla / joukko.length : 0,
    }
  })
}
