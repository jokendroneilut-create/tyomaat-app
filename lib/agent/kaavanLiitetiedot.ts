import { haeKaavaselostuksenTeksti, kaavanKuvausTekstista, valitseKaavanAsiakirja } from "./kaavanKuvaus"
import { jasennaAloitteentekija } from "./oasAloite"

/*
 * KAAVAN KUVAUS JA ALOITTEENTEKIJÄ LIITTEESTÄ (25.11.2026, D-450).
 *
 * Johannes 25.11.2026 Toholammin "Datakeskuksen alueen/ Kiertokangas
 * asemakaavasta": kuvaus ja liittyvä yritys ovat lähteessä saatavilla.
 * Keräin tallensi kuvaukseksi lohkon tekstin, joka oli pelkkä liitteen
 * nimi ("Datakeskuksen alueen OAS-11052026"). Sisältö on OAS:ssa:
 * "Kaavoitus on tullut ajankohtaiseksi Greensky Energy Oy:n aloitteesta …
 * n. 100 MW:n datakeskus".
 *
 * Yksi lataus, kaksi tietoa: selostus tai OAS (`valitseKaavanAsiakirja`),
 * siitä kuvaus (`kaavanKuvausTekstista`) ja aloitteentekijä
 * (`jasennaAloitteentekija`). Liitelista kulkee mukana, jotta keräin voi
 * lukea asiakirjan uudelleen vain kun liitteet muuttuvat.
 */

export type KaavanLiite = { label?: string | null; url?: string | null }

export function kaavanAsiakirja(liitteet: KaavanLiite[]): string | null {
  return valitseKaavanAsiakirja(liitteet.map((l) => ({ teksti: l.label ?? null, href: l.url ?? null })))
}

/*
 * Lohkon oma teksti ilman liitteiden nimiä. Jos jäljelle jää vain
 * nimiä tai sivun yleistä tekstiä, se ei ole kuvaus.
 */
export function lohkonOmaTeksti(lohkonTeksti: string, liitteet: KaavanLiite[]): string | null {
  let t = ` ${lohkonTeksti} `
  for (const l of liitteet) {
    const nimi = String(l.label ?? "").trim()
    if (nimi) t = t.split(nimi).join(" ")
  }
  t = t.replace(/\s+/g, " ").trim()
  /* Vähintään yksi kokonainen virke, ei pelkkä otsikko tai liitteen nimi. */
  return t.length >= 60 && /\p{Ll}{3,}[^.]*\.\s*/u.test(t) ? t : null
}

/*
 * Sisällysluettelo kuvauksena (Ähtärin Moksunniemi 27.11.2026): otsikko ja
 * sivunumero ovat liimautuneet ("Asemakaavan tavoitteet24 4.4.1Lähtökohta-
 * aineiston antamat tavoitteet24"), joten yleisen jäsentimen
 * luettelotunnistus ei osunut. Kaksi "sana+sivunumero alaluku" -kohtaa
 * riittää: tavallisessa tekstissä niitä ei ole.
 */
export function naytaaSisallysluettelolta(teksti: string | null | undefined): boolean {
  const osumat = String(teksti ?? "").match(/\p{L}\d{1,3}\s+\d+(?:\.\d+)+\s?\p{Lu}/gu) ?? []
  return osumat.length >= 2
}

export async function haeKaavanLiitetiedot(
  liitteet: KaavanLiite[],
  hae: (url: string) => Promise<string | null> = haeKaavaselostuksenTeksti
): Promise<{ kuvaus: string | null; aloitteentekija: string | null; asiakirja: string | null }> {
  const asiakirja = kaavanAsiakirja(liitteet)
  if (!asiakirja) return { kuvaus: null, aloitteentekija: null, asiakirja: null }
  const teksti = await hae(asiakirja)
  if (!teksti) return { kuvaus: null, aloitteentekija: null, asiakirja }
  const kuvaus = kaavanKuvausTekstista(teksti)
  return {
    kuvaus: naytaaSisallysluettelolta(kuvaus) ? null : kuvaus,
    aloitteentekija: jasennaAloitteentekija(teksti),
    asiakirja,
  }
}
