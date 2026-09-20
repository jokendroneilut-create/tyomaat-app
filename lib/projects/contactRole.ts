import type { Contact } from "./contacts"

/*
 * ROOLI VAPAASTA TEKSTISTÄ POIMITULLE YHTEYSHENKILÖLLE (D-207).
 *
 * `extractContacts` ei aseta roolia lainkaan: se lukee nimen, tittelin,
 * puhelimen ja osoitteen, eikä ota kantaa siihen kuka henkilö on
 * hankkeessa. Rakenteisilla lähteillä rooli tulee lähteestä
 * (`lupapisteResolver` merkitsee päätöksen tehneen rakennustarkastajan
 * `role: "authority"`), mutta tekstipoiminnassa sitä ei ole ollut.
 *
 * Kun poiminta siirtyy ehdokasvaiheeseen (D-207), sama teksti tuottaa
 * kaksi ihmistä jotka näyttävät samalta mutta eivät ole: luvan
 * ratkaissut viranomainen ja tiedotteen viestintähenkilö.
 *
 * MERKITÄÄN, EI PUDOTETA. Kumpaakaan ei poisteta. Tyhjä kenttä on
 * katselmoijalle pahempi kuin merkitty kenttä: hän näkee "Ei
 * yhteystietoa" eikä tiedä että tieto oli olemassa. Sama peruste kuin
 * viranomaismerkinnässä (ks. `contacts.ts`, `Contact.role`).
 */

/*
 * (a) VIRANOMAINEN = päätöksen tehnyt, ei hanketta tekevä.
 *
 * Rakennustarkastaja ja lupainsinööri ratkaisevat HAKIJAN luvan: he
 * tuntevat hankkeen muttei osta siihen mitään.
 *
 * "VALMISTELIJA" EI OLE TÄSSÄ JOUKOSSA, vaikka sana näyttää
 * viranomaiselta. Kunnan investointipäätöksessä (Porin Stadion,
 * Rovaniemen uimahalli) kaupunki on itse rakennuttaja, ja päätöksen
 * valmistellut liikuntajohtaja tai toimialajohtaja on hankkeen paras
 * yhteyshenkilö — ei viranomainen jota vastaan hanke tehdään. Lupa- ja
 * investointipäätös ovat eri asioita, ja ero on juuri tässä.
 */
const VIRANOMAISNIMIKE =
  /(rakennustarkastaj|lupainsin[oö]{2}r|lupa-?arkkitehti|lupavalmistelij|tarkastusinsin[oö]{2}r|rakennusvalvonna|rakennusvalvontap[aä]{2}llik|yhteysviranomai|lupa- ja valvontavirasto|ELY-keskus)/i

/*
 * VERKKOTUNNUS RIITTÄÄ KAHDELLE VIRANOMAISJOUKOLLE.
 *
 * `oikeus.fi` esiintyy vain muutoksenhakuohjeessa, ei hankkeen
 * osapuolena. Kunnan päätöksen lopussa on markkinaoikeuden tai
 * hallinto-oikeuden osoite, ja poimija lukee siitä "nimen" (kadunnimen)
 * ja osoitteen. Mitattu 20.9.2026: 3 ehdokasta 1 929:stä — harvinainen
 * mutta yksiselitteinen.
 *
 * `lvv.fi` (Lupa- ja valvontavirasto) ja `ely-keskus.fi` ovat YVA:n
 * YHTEYSVIRANOMAINEN: se arvioi hankkeen ympäristövaikutukset eikä osta
 * siitä mitään. Mitattu 21.9.2026: 251 kontaktia, joista 238 YVA-
 * lähteestä — ely-keskus.fi 144 ja lvv.fi 107. Muita virastopäätteitä
 * ei aineistossa esiinny, joten niitä ei myöskään arvata tähän.
 *
 * YVA-sivulla on oma "Yhteysviranomainen:"-kenttä, mutta kerättyyn
 * kuvaustekstiin otsikko säilyy vain 3 kertaa 251:stä — nimeä edeltää
 * sen sijaan viraston nimi. Siksi sääntö nojaa verkkotunnukseen, joka on
 * mitatusti aina paikalla, ja viraston nimi on vain lisätuki alla.
 */
const VIRANOMAISEN_DOMAIN = /(^|\.)(oikeus\.fi|lvv\.fi|ely-keskus\.fi)$/i

/*
 * NIMIKE ON SUOMESSA USEIN ENNEN NIMEÄ.
 *
 * "Päätöksen teki rakennustarkastaja Matti Virtanen, matti.virtanen@…"
 * — `extractContacts` lukee tittelin nimen JÄLKEISESTÄ tekstistä, joten
 * tässä muodossa titteli jää tyhjäksi ja pelkkään titteliin nojaava
 * sääntö ei laukea koskaan. Siksi viranomaissääntö lukee myös nimeä
 * edeltävän lyhyen ikkunan.
 *
 * Ikkuna on tarkoituksella kapea. Leveämpi osuisi päätöstekstin
 * proosaan ("rakennusvalvonta on antanut lausunnon"), joka on eri asia
 * kuin nimetty viranomainen.
 */
const NIMIKE_IKKUNA = 60

/*
 * (b) VIESTINTÄHENKILÖ = tiedotteen "Lisätietoja"-osion toinen ihminen.
 *
 * OSIOTA EI VOI PUDOTTAA. Mitattu 20.9.2026: SRV:n Suutarilan
 * tiedotteessa samassa "Lisätiedot"-lohkossa ovat elinkaarihankkeiden
 * johtaja, projektipäällikkö, viestinnän asiantuntija JA Helsingin
 * kaupungin projektinjohtaja. Kolme neljästä on myyjälle oikea
 * kontakti. Osioon perustuva sääntö olisi pudottanut kaikki neljä.
 *
 * Ero näkyy TITTELISSÄ, joten sääntö lukee VAIN tittelin — ei
 * ympäröivää tekstiä kuten viranomaissääntö. Ikkuna osuisi juuri niihin
 * sanoihin joiden perässä oikea kontakti on ("Lisätietoja ja
 * haastattelupyynnöt: <projektipäällikkö>"), eli merkitsisi väärän
 * ihmisen.
 *
 * ASTEVAIHTELU: "viestintäpäällikkö" mutta "viestinnän asiantuntija".
 * Ensimmäinen versio tunsi vain `viestint`, jolloin SRV:n viestinnän
 * asiantuntija jäi merkitsemättä.
 *
 * 166 osumaa 1 929:stä sisältää viestintätittelin, ja 44:ssä
 * viestintähenkilö on ainoa löytynyt henkilö — juuri niissä
 * pudottaminen olisi tuottanut tyhjän kentän (Helsingin kasvatus- ja
 * koulutuslautakunnan ennakkotiedotteet).
 */
const VIESTINTANIMIKE =
  /(viestint[aä]|viestinn[aä]n|mediayhteyd|tiedottaj|lehdist[oö]|communications|press officer|media relations)/i

export type PaateltyRooli = "authority" | "media" | null

export function paatteleRooli(
  contact: Contact,
  teksti?: string | null
): PaateltyRooli {
  const titteli = String(contact.title ?? "")
  const domain = String(contact.email ?? "").split("@")[1] ?? ""

  if (VIRANOMAISEN_DOMAIN.test(domain)) return "authority"
  if (VIRANOMAISNIMIKE.test(titteli)) return "authority"

  const nimi = String(contact.name ?? "").trim()
  if (nimi && teksti) {
    const i = teksti.indexOf(nimi)
    if (i > 0 && VIRANOMAISNIMIKE.test(teksti.slice(Math.max(0, i - NIMIKE_IKKUNA), i))) {
      return "authority"
    }
  }

  if (VIESTINTANIMIKE.test(titteli)) return "media"

  return null
}

/*
 * LÄHTEEN OMA ROOLI VOITTAA. Rakenteisesta kentästä luettu rooli on
 * vahvempi todiste kuin tekstistä pääteltu, joten sitä ei ylikirjoiteta
 * — sama sääntö kuin `alaMetadata`ssa lomakekentän ja tekstin välillä.
 */
export function merkitseRoolit(
  contacts: Contact[],
  teksti?: string | null
): Contact[] {
  return contacts.map((c) => {
    if (c.role) return c
    const rooli = paatteleRooli(c, teksti)
    return rooli ? { ...c, role: rooli } : c
  })
}
