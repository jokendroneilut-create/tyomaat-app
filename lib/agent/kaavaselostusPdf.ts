import { extractContacts, type Contact } from "@/lib/projects/contacts"
import { expandPlaceholderEmail } from "@/lib/agent/vaylaContacts"

/*
 * KAAVASELOSTUKSEN YHTEYSTIEDOT.
 *
 * Kaavalähteiden liitteissä on 245 kaavaselostusta 184 hankkeelle 56
 * kunnassa, eikä yhtäkään ole haettu. Niissä on juuri se tieto jota
 * muualta ei saa — nimetty henkilö puhelimineen ja sähköposteineen:
 *
 *   "Päivi Muhonen puh. +358 44 4598 434 paivi.muhonen@saarijarvi.fi"
 *   "Kaavan laatija: Sitowise Oy, Timo Huhtinen DI, YKS 245"
 *
 * KOKO ON SYY RAJATA. Mitattu 23.8.2026 kolmella selostuksella:
 * 229 000, 284 000 ja 884 000 merkkiä. Koko tekstin tallentaminen
 * 245:lle olisi satoja megatavuja, eikä siitä olisi vastaavaa hyötyä.
 *
 * Kolme rajausta:
 *
 *   1. Vain ensimmäiset sivut. Kaavan perustiedot ja yhteystiedot ovat
 *      kansilehdellä ja sitä seuraavassa perustieto-osiossa.
 *   2. Vain poiminta tallennetaan, ei tekstiä.
 *   3. Tiedostokoolla katto: kaavakartat ja liitekuvat ovat kymmeniä
 *      megatavuja eikä niissä ole yhteystietoja.
 */

/* Perustiedot ovat kansilehdellä ja heti sen jälkeen. */
const MAX_PAGES = 6

/* 25 MB riittää selostukselle; sitä isompi on kuvaliite. */
const MAX_BYTES = 25 * 1024 * 1024

const TIMEOUT_MS = 30000
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

/*
 * Kaavan laatija on konsulttitoimisto, joka suunnittelee alueen — oma
 * osapuolensa ja usein ensimmäinen joka tietää hankkeesta.
 */
const PLANNER_RE =
  /kaavan\s+laatija\s*:?\s*([^\n.]{4,90}?)(?=\s*(?:vireilletulo|kaavan\s+nimi|kaavatunnus|päiväys|$))/i

const PLANNER_CONSULTANT_RE = /kaavakonsultti\s*:?\s*([^\n.]{4,90})/i

export type KaavaselostusResult = {
  contacts: Contact[]
  planner: string | null
  /* Vain tunnusluku, ei tekstiä — teksti ei kuulu kantaan. */
  textLength: number
}

/*
 * Selostuksessa numeroon tarttuu alaviitteen numero: otoksesta
 * "040 753 1524 1". Suomalainen matkanumero on 10 numeroa ja lankanumero
 * 9, joten ylimenevat ovat roskaa. Kansainvalinen muoto (+358) jatetaan
 * rauhaan, koska sen pituus on eri.
 */
function trimPhone(phone: string | null): string | null {
  if (!phone) return null
  if (phone.trim().startsWith("+")) return phone

  const numerot = phone.replace(/\D/g, "")
  if (numerot.length <= 10) return phone

  /* Leikataan alkuperaisesta merkkijonosta, jotta valilyonnit sailyvat. */
  let otettu = 0
  let out = ""
  for (const merkki of phone) {
    if (/\d/.test(merkki)) {
      if (otettu === 10) break
      otettu++
    }
    out += merkki
  }
  return out.trim().replace(/[\s-]+$/, "")
}

export function parseKaavaselostus(text: string | null | undefined): KaavaselostusResult {
  const t = String(text ?? "").replace(/\s+/g, " ").trim()
  if (!t) return { contacts: [], planner: null, textLength: 0 }

  /*
   * Yhteystiedot poimitaan samalla sähköpostiankkurilla kuin
   * tiedotteista (D-101). Kaavaselostuksessa muoto on sama:
   * "Päivi Muhonen puh. +358 44 4598 434 paivi.muhonen@saarijarvi.fi".
   */
  /*
   * Kolme siivousta, jokainen mitattu otoksesta 23.8.2026:
   *
   *   1. Malliosoite laajennetaan nimesta (D-103):
   *      "Henri Haapaniemi" + etunimi.sukunimi@pihtiputaa.fi
   *   2. Yleislaatikon (kaupunki@, kirjaamo@) yhteydessa poimittu nimi on
   *      lahes aina vaara - otoksessa "Risto Rytin", joka on kadunnimi.
   *   3. Ilman osoitetta ja numeroa jaava kontakti ei ole yhteystieto.
   */
  const YLEISLAATIKKO = /^(kaupunki|kunta|kirjaamo|info|kaavoitus|tekninen|asiakaspalvelu)/i

  /*
   * Asiakirjan omat sanat vuotavat nimeksi, koska puhelinankkuri etsii
   * lahimman isolla alkavan sanaparin: otoksesta "Kaavaselostus
   * Kaavaselostus" ja "Selostus Copyright".
   */
  const EI_NIMI = /(kaava|selostus|ehdotus|luonnos|copyright|liite|kartta|raportti|osallistumis)/i

  /*
   * Y-tunnus (1234567-8) menee puhelinhahmosta lapi: siina on 8 numeroa
   * ja valiviiva. Numero jonka keskella on valiviiva ei ole suomalainen
   * puhelinnumero.
   */
  const YTUNNUS = /^\s*\d{6,8}\s*-\s*\d/

  const contacts = extractContacts(t)
    .map((c) => {
      const laajennettu = c.email ? expandPlaceholderEmail(c.email, c.name) : null
      const email = laajennettu ?? (c.email && !/etunimi|sukunimi/i.test(c.email) ? c.email : "")

      const yleinen = email ? YLEISLAATIKKO.test(email.split("@")[0]) : false

      const roskaNimi = c.name ? EI_NIMI.test(c.name) : false
      const phone = c.phone && YTUNNUS.test(c.phone) ? null : trimPhone(c.phone)

      return {
        ...c,
        email,
        phone,
        name: yleinen || roskaNimi ? null : c.name,
        kind: (yleinen || roskaNimi ? "organization" : c.kind) as Contact["kind"],
      }
    })
    /* Ilman osoitetta EI kelpaa pelkka numero nimettomana. */
    .filter((c) => c.email || (c.phone && c.name))

  const planner =
    (t.match(PLANNER_RE)?.[1] ?? t.match(PLANNER_CONSULTANT_RE)?.[1] ?? "").trim() || null

  return { contacts, planner, textLength: t.length }
}

/*
 * Palauttaa tyhjän myös virhetilanteessa: liitteen hakeminen on lisätieto
 * eikä se saa kaataa keräysajoa.
 */
export async function fetchKaavaselostus(url: string): Promise<KaavaselostusResult | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
    })
    if (!response.ok) return null

    /*
     * Koko tarkistetaan ennen lukemista jos palvelin kertoo sen, ja
     * uudelleen sen jälkeen — osa palvelimista ei lähetä otsaketta.
     */
    const ilmoitettu = Number(response.headers.get("content-length") ?? 0)
    if (ilmoitettu > MAX_BYTES) return null

    const buf = Buffer.from(await response.arrayBuffer())
    if (buf.length > MAX_BYTES) return null

    /*
     * `pdf-parse/lib/pdf-parse.js` eikä paketin juuri: juuri ajaa
     * debug-tilassa oman testitiedostonsa ja kaatuu.
     */
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as any

    const parsed = await pdfParse(buf, { max: MAX_PAGES })
    return parseKaavaselostus(parsed?.text ?? "")
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/* Onko liite kaavaselostus? Kaavakartassa ja OAS:ssa ei ole yhteystietoja. */
export function isKaavaselostus(url: string, label?: string | null): boolean {
  if (!/\.pdf(\?|$)/i.test(url)) return false
  return /selostus/i.test(`${url} ${label ?? ""}`)
}
