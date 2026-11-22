/*
 * ILMOITUSTYYPPI POIS HANKKEEN NIMESTÄ (22.11.2026, D-448).
 *
 * Johannes 22.11.2026: *"jos hyväksyn hankkeen jossa lukee esim.
 * Ennakkoilmoitus ja kutsu markkinavuoropuheluun … jääkö nuo tekstit
 * edelleen vaikka hanke eteneekin jo seuraavaan vaiheeseen?"* Jäivät:
 * liitos ei koskaan muuta nimeä ([[title-precedence]]). Mitattu samana
 * päivänä: 125 hankkeen nimessä ilmoitustyyppi, ja 40 niistä oli jo
 * sopimusvaiheessa ("JÄLKI-ILMOITUS: Osallistumispyyntö: Malmin uusi
 * sairaala…").
 *
 * Ilmoitustyyppi kertoo hankintamenettelyn vaiheen, ei hanketta, ja vaihe
 * on omassa kentässään. Siksi se poistetaan nimen ALUSTA ja LOPUSTA, niin
 * monta kertaa peräkkäin kuin niitä on. Keskeltä ei poisteta mitään:
 * "Tarkk’ampujankuja 1B, Julkisivun maalauksen jälki-ilmoitus" jää
 * ennalleen, koska sana on osa lausetta eikä erotettu.
 *
 * KESKEYTYS EI OLE ILMOITUSTYYPPI vaan tieto: hankinta on keskeytetty.
 * Sitä ei poisteta.
 */

const TYYPPI = [
  "kansallinen jälki-ilmoitus",
  "jälki-ilmoitus kilpailutukseen [\\d/.]+",
  "jälki-ilmoitus",
  "alustava tarjouspyyntö",
  "urakkatarjouspyyntö",
  "tarjouspyyntö",
  "tarjouskilpailukutsu",
  "kutsu markkinavuoropuheluun",
  "kutsu markkinainfoon",
  "kutsu markkinakartoitukseen",
  "markkinavuoropuhelukutsu",
  "markkinavuoropuhelu",
  "markkinakartoitusilmoitus",
  "markkinakartoitus",
  "urakoitsija ?kartoitus",
  "tietopyyntö markkinakartoitusta ja -vuoropuhelua varten",
  "tietopyyntö",
  "tekninen vuoropuhelu",
  "osallistumispyyntö",
  "ennakkoilmoitus määräaikojen lyhentämiseksi",
  "ennakkoilmoitus \\(\\d+\\. julkaisu\\)",
  "ennakkoilmoitus tarjouspyynnöstä",
  "ennakkoilmoitus",
  "urakkahankinta",
  "kutsu",
].join("|")

/* Tyyppi + erotin alussa: "JÄLKI-ILMOITUS: ", "Tietopyyntö / ", "Osallistumispyyntö " */
const ALUSSA = new RegExp(`^\\s*(?:${TYYPPI})(?:\\s*(?:[:/,–-]+|\\s+ja\\s+)\\s*|\\s+)`, "iu")

/* Erotin + tyyppi lopussa: ", jälki-ilmoitus", " - kutsu markkinavuoropuheluun" */
const LOPUSSA = new RegExp(`\\s*(?:[,/–]|\\s-)\\s*(?:${TYYPPI})\\s*$`, "iu")

function isoAlkukirjain(nimi: string): string {
  return nimi.charAt(0).toLocaleUpperCase("fi") + nimi.slice(1)
}

export function poistaIlmoitustyyppi(nimi: string | null | undefined): string {
  const alkuperainen = String(nimi ?? "")
  let tulos = alkuperainen.replace(/\s+/g, " ").trim()
  let alustaPois = false
  let lopustaPois = false

  for (let kierros = 0; kierros < 5; kierros++) {
    const ennen = tulos
    const alku = tulos.replace(ALUSSA, "")
    if (alku !== tulos) alustaPois = true
    const loppu = alku.replace(LOPUSSA, "")
    if (loppu !== alku) lopustaPois = true
    tulos = loppu
    if (tulos === ennen) break
  }

  /*
   * Nimeen kosketaan VAIN jos ilmoitustyyppi poistettiin. Muuten
   * välimerkkien siivous ja alkukirjaimen isonnus muuttaisivat nimiä,
   * joissa ilmoitustyyppiä ei ole: "atNorth FIN04" ja "wpd investoi…"
   * ovat oikein pienellä.
   */
  if (!alustaPois && !lopustaPois) return alkuperainen
  tulos = tulos.replace(/^[\s:/,–-]+|[\s:/,–-]+$/g, "").trim()

  /* Jos jäljelle ei jää kohteen nimeä, alkuperäinen on parempi kuin tyhjä. */
  if (tulos.length < 6 || !/\p{L}{3,}/u.test(tulos)) return alkuperainen
  return alustaPois ? isoAlkukirjain(tulos) : tulos
}
