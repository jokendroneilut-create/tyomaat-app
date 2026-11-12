/*
 * ROVANIEMEN KAAVATORIN YHTEYSTIEDOT.
 *
 * "Lisätietoja"-lohkossa on käytännössä aina MONTA henkilöä. Kolme
 * todellista muotoa sivuilta 13.11.2026:
 *
 *   A  Kaavoituspäällikkö Markku Pyhäjärvi, puh. 016 322 8927
 *      sähköposti: etu.sukunimi@rovaniemi.fi
 *      Kaavasuunnittelija Ville Mäkitalo, puh. 040 671 2219 sähköposti: etu.sukunimi@rovaniemi.fi
 *
 *   B  Konsultti ja kaavanlaatija Jarmo Lokio / Arkkitehtitoimisto Jarmo Lokio Oy, puh. 044 700 2155
 *      sähköposti: jarmo.lokio@lokio.fi
 *      Kaavoituspäällikkö Markku Pyhäjärvi, puh. 016 322 8927
 *      ...
 *
 *   C  maankäyttöasiantuntija Niina Alanenpää puh. 016 322 8743
 *      kaavoituspäällikkö Markku Pyhäjärvi puh. 016 322 8927
 *      sähköposti: etu.sukunimi@rovaniemi.fi
 *
 * Aiempi jäsennin oletti yhden henkilön: se otti ensimmäisen
 * sähköpostin, ensimmäisen puhelinnumeron ja piti lopusta **kahta
 * viimeistä sanaa** nimenä. Lopputulos oli yksi merkintä jossa kaikki
 * oli väärässä kentässä (D-409):
 *
 *   name  "sähköposti: etu.sukunimi@rovaniemi.fi"
 *   title "Kaavoituspäällikkö Markku Pyhäjärvi, sähköposti:
 *          Kaavasuunnittelija Ville Mäkitalo, puh. 040 671 2219"
 *
 * Kaksi vikaa yhdessä: henkilöitä ei eroteltu, ja `replace(email, "")`
 * poisti vain ENSIMMÄISEN osuman, joten toinen samanlainen osoite jäi
 * tekstiin ja päätyi nimeksi.
 *
 * MALLIOSOITETTA EI TALLENNETA. "etu.sukunimi@rovaniemi.fi" ei ole
 * kenenkään osoite vaan ohje muodosta, eikä sitä johdeta nimestäkään:
 * rekisteriin kuuluu vain se jolla ihmisen oikeasti tavoittaa
 * ([[register-is-worksite-contacts]]). Puhelinnumero on tässä se.
 *
 * OIKEA OSOITE KUULUU SILLE JONKA PERÄSSÄ SE ON. Muodossa B konsultin
 * oma osoite seuraa heti hänen numeroaan, ja kaupungin väki jakaa
 * mallimuodon. Siksi osoite luetaan henkilön numeron JÄLKEISESTÄ
 * tekstistä seuraavan henkilön alkuun asti.
 */

export type RovaniemiContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
  organization: string | null
}

/* Osoite joka kertoo muodon eikä henkilöä. */
const MALLIOSOITE = /^(etu|etunimi|firstname)[.\s]*(suku|sukunimi|lastname)@/i
const OSOITE = /[\w.+-]+@[\w.-]+\.\w+/g

function onMalliosoite(email: string): boolean {
  return MALLIOSOITE.test(email.trim())
}

/* Nimen osa alkaa isolla; nimike voi olla pienellä ("maankäyttöasiantuntija"). */
const ISO_ALKU = /^[A-ZÅÄÖ]/

function siivoa(teksti: string): string {
  return teksti
    .replace(OSOITE, " ")
    .replace(/\bsähköposti\s*:?/gi, " ")
    .replace(/[\s,;:]+/g, " ")
    .trim()
}

/*
 * "Konsultti ja kaavanlaatija Jarmo Lokio / Arkkitehtitoimisto Jarmo
 * Lokio Oy" -> nimike + nimi vasemmalta, organisaatio kauttaviivan
 * oikealta. Ilman jakoa nimeksi tulisi "Lokio Oy".
 */
function jaaNimeen(teksti: string): {
  name: string | null
  title: string | null
  organization: string | null
} {
  const [vasen, ...oikea] = siivoa(teksti).split("/")
  const organization = oikea.join("/").trim() || null

  const sanat = vasen.trim().split(" ").filter(Boolean)
  const nimiOsat: string[] = []
  while (sanat.length && nimiOsat.length < 2 && ISO_ALKU.test(sanat[sanat.length - 1])) {
    nimiOsat.unshift(sanat.pop() as string)
  }

  if (nimiOsat.length < 2) {
    return { name: null, title: [...sanat, ...nimiOsat].join(" ") || null, organization }
  }

  return { name: nimiOsat.join(" "), title: sanat.join(" ") || null, organization }
}

/* Jokainen "puh." aloittaa uuden henkilön. */
/*
 * Numero voi alkaa plussalla: "puh. +358 40 194 6870". Ilman tata
 * Elias Ritolaa ei tunnistettu henkiloksi lainkaan ja hanen nimensa
 * valui seuraavan henkilon nimikkeeseen.
 */
const HENKILO = /([^]*?)(?:,\s*)?puh\.?\s*(\+?[\d][\d\s()+-]{5,})/gi

function pakene(teksti: string): string {
  return teksti.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/* Mihin kohtaan lohkoa henkilön nimi osuu; -1 jos ei löydy. */
function nimenKohta(lohko: string, name: string): number {
  const sukunimi = name.split(" ").pop() as string
  const osuma = lohko.search(new RegExp(pakene(sukunimi)))
  return osuma
}

function osoiteNimenJalkeen(lohko: string, name: string): string | null {
  const kohta = nimenKohta(lohko, name)
  if (kohta < 0) return null
  return (lohko.slice(kohta).match(OSOITE) ?? []).find((e) => !onMalliosoite(e)) ?? null
}

function osoiteEnnenNimea(lohko: string, name: string): string | null {
  const kohta = nimenKohta(lohko, name)
  if (kohta <= 0) return null
  return (lohko.slice(0, kohta).match(OSOITE) ?? []).find((e) => !onMalliosoite(e)) ?? null
}

export function parseRovaniemiContacts(text: string | null | undefined): RovaniemiContact[] {
  if (!text) return []

  const runko = String(text).replace(/^\s*Lisätietoja\s*:?\s*/i, "")
  const osumat = [...runko.matchAll(HENKILO)]
  const tulos: RovaniemiContact[] = []

  for (const [i, osuma] of osumat.entries()) {
    const { name, title, organization } = jaaNimeen(osuma[1] ?? "")
    if (!name) continue

    const phone = osuma[2].trim().replace(/[\s,.]+$/, "").replace(/\s+/g, " ")

    /*
     * OSOITE VOI OLLA NUMERON KUMMALLA PUOLELLA TAHANSA:
     *
     *   "Ville Pitkänen, sähköposti: x, puh. 040..."   ennen numeroa
     *   "Jarmo Lokio, puh. 044... sähköposti: y"       numeron jälkeen
     *
     * Ratkaiseva ei siis ole numero vaan NIMI: nimen jälkeen tuleva
     * osoite on tämän henkilön, nimeä edeltävä kuuluu edelliselle.
     * Ilman tätä Ville Pitkänen sai Markku Pyhäjärven osoitteen.
     */
    const omaOsoite = osoiteNimenJalkeen(osuma[1] ?? "", name)
    const edellisen = osoiteEnnenNimea(osuma[1] ?? "", name)
    if (edellisen && tulos.length && !tulos[tulos.length - 1].email) {
      tulos[tulos.length - 1].email = edellisen
    }

    tulos.push({ name, title, phone, email: omaOsoite, organization })
  }

  /*
   * Viimeisen henkilön osoite voi olla vielä viimeisen numeron jälkeen
   * ("Jarmo Lokio, puh. 044... sähköposti: y" lohkon lopussa).
   */
  if (tulos.length && !tulos[tulos.length - 1].email && osumat.length) {
    const viimeinen = osumat[osumat.length - 1]
    const hanta = runko.slice((viimeinen.index ?? 0) + viimeinen[0].length)
    const osoite = (hanta.match(OSOITE) ?? []).find((e) => !onMalliosoite(e)) ?? null
    if (osoite) tulos[tulos.length - 1].email = osoite
  }

  /*
   * Ei yhtään "puh."-merkintää: kokeillaan tulkita koko lohko yhdeksi
   * henkilöksi, jottei vanha yhden henkilön muoto katoa.
   */
  if (!tulos.length) {
    const { name, title, organization } = jaaNimeen(runko)
    const osoitteet = (runko.match(OSOITE) ?? []).filter((e) => !onMalliosoite(e))
    if (name) {
      tulos.push({
        name,
        title,
        phone: null,
        email: osoitteet.length === 1 ? osoitteet[0] : null,
        organization,
      })
    }
  }

  return tulos
}
