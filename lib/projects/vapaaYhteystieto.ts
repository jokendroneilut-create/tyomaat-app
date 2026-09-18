import { decodeHtmlEntities } from "@/lib/agent/htmlEntities"
import { extractContacts, type Contact } from "./contacts"

/*
 * YHTEYSTIETO VAPAASTA TEKSTIKENTÄSTÄ (D-198).
 *
 * Osa kaavalähteistä antaa yhteystiedon yhtenä vapaana tekstinä
 * ("Kaavasuunnittelija <nimi>, p 040 ..., etunimi.sukunimi@...").
 * Tuusulan resolveri kirjoitti koko tekstin NIMI-kenttään, joten:
 *
 *   - asiakas näki nimenä rivinvaihtoja, numeroita ja osoitteita
 *   - puhelin ja sähköposti olivat tallessa mutta eivät klikattavina
 *   - mittari (`scripts/measure-yhteystiedot.ts`) luki hankkeen
 *     yhteystiedottomaksi, koska puhelin- ja sähköpostikentät olivat tyhjiä
 *
 * Jäsennys tehdään samalla `extractContacts`illa kuin tiedotteille.
 * Pelkkä nimi ("kaavasuunnittelija <nimi>") säilyy nimenä kuten
 * ennenkin - tietoa ei heitetä pois.
 */

/* Kentän lyhenne ei ole titteli: "<nimi> / sp. ... / p. ..." -> titteli "sp.". */
const EI_TITTELI = /^(?:sp|s-posti|sähköposti|email|puh|puhelin|p|gsm)\.?:?$/i

export type VapaaYhteystieto = Pick<Contact, "name" | "title" | "phone"> & {
  /* Pelkän nimen rivillä osoitetta ei ole. */
  email: string | null
} & Partial<Pick<Contact, "kind" | "organization">>

export function yhteystiedotVapaastaTekstista(raw: string | null | undefined): VapaaYhteystieto[] {
  const teksti = decodeHtmlEntities(String(raw ?? "")).trim()
  if (!teksti) return []

  const poimitut: VapaaYhteystieto[] = extractContacts(teksti).map((c) => ({
    ...c,
    title: c.title && EI_TITTELI.test(c.title.trim()) ? null : c.title,
  }))

  /*
   * SÄHKÖPOSTI EI SAA KADOTA. Sulkulauseke nimen jäljessä sekoittaa
   * poiminnan: "<nimi> (ent. <sukunimi>), 040..., osoite@..." ->
   * puhelin tuli, osoite ei (mitattu 19.9.2026). Tekstin osoite, joka
   * puuttuu tuloksesta, liitetään ainoalle osoitteettomalle henkilölle tai
   * omaksi rivikseen.
   */
  if (poimitut.length > 0) {
    for (const osoite of teksti.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []) {
      if (poimitut.some((c) => c.email?.toLowerCase() === osoite.toLowerCase())) continue
      const ilman = poimitut.filter((c) => !c.email)
      if (ilman.length === 1) ilman[0].email = osoite
      else poimitut.push({ name: null, title: null, phone: null, email: osoite })
    }
    return poimitut
  }

  /* Ei numeroa eikä osoitetta: nimi ja titteli sellaisenaan, jos ne ovat lyhyitä. */
  const nimi = teksti.replace(/\s+/g, " ").trim()
  if (nimi.length > 120 || /[@\d]/.test(nimi)) return []
  return [{ name: nimi, title: null, phone: null, email: null }]
}
