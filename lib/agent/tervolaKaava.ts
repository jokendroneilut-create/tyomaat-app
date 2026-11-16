import * as cheerio from "cheerio"

/*
 * TERVOLAN KAAVASIVU: INGRESSI JA YHTEYSTIETOLAATIKKO (D-429).
 *
 * YIT:n käyttäjän palaute 16.11.2026 Pukinselän osayleiskaavasta:
 * *"Hankkeesta on julkisesti tiedossa lisäksi hankekehittäjä: Helios
 * Nordic Energy Finland/ Helios 1 Cranberry Oy."* Tieto oli kaavasivulla
 * kahdessa kohdassa, joita keräin ei lukenut:
 *
 *   ingressi   "…käynnistänyt 24.9.2026 Helios 1 Cranberry Oy:n pyynnöstä…"
 *   laatikko   "Lisätietoja kaavoituksesta antavat:" — kunta, HANKETOIMIJA
 *              Helios Nordic Energy Finland Oy kahdella nimetyllä
 *              henkilöllä, KAAVAKONSULTTI Alusta Consulting Oy
 *
 * Sama laatikko on kaikilla 8 Tervolan kaavasivulla, viidellä eri
 * kirjoitusasulla (mitattu): rooliotsikko kaksoispisteellä tai ilman,
 * nimi ennen nimikettä tai sen jälkeen ("Kunnanjohtaja Mika Simoska" /
 * "Mika Simoska, kunnanjohtaja"), yhtiö ja henkilö samalla rivillä
 * ("ABO Energy Suomi Oy, Kalle Oiva"), puhelin ja sähköposti samalla
 * rivillä, ja yhtiö ilman rooliotsikkoa (FCG). Siksi jäsennys on
 * rivipohjainen tilakone eikä yksi kuvio.
 *
 * Kuvaukseen eivät kuulu sivun yhteiset moduulit ("Jaa sivu eteenpäin",
 * "Ota yhteyttä Vaihde…", "Seuraa meitä"): ne ovat samalla
 * `.editor-container`-luokalla mutta `.child-module-wrapper`in sisällä.
 */

type Rooli = "kunta" | "hankevastaava" | "konsultti" | null

export type TervolaYhteys = {
  kind: "person" | "organization"
  name: string | null
  title: string | null
  organization: string | null
  phone: string | null
  email: string | null
  role: "agent" | null
}

export type TervolaOsapuolet = {
  contacts: TervolaYhteys[]
  developer: string | null
  consultants: string[]
}

const ROOLIOTSIKKO =
  /^(tervolan kunta|hankevastaava|hankkeesta vastaava|hanketoimija|kaavakonsultti)\s*:?\s*(.*)$/i
const YHTIO = /\b(Oy|Oyj|Ab|Ky)\b/
const NIMI = /^[A-ZÅÄÖ][\p{L}-]+\s+[A-ZÅÄÖ][\p{L}-]+$/u
const PUHELIN = /(?:puh\.?|p\.?)?\s*(\+?\d{2,4}[\d ]{5,}\d)/i
const SAHKOPOSTI = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/

function rooliOtsikosta(s: string): Rooli {
  const k = s.toLowerCase()
  if (k === "tervolan kunta") return "kunta"
  if (k === "kaavakonsultti") return "konsultti"
  return "hankevastaava"
}

function rivit(html: string): string[] {
  /*
   * NFC ensin: Vitsakankaan sivulla "Seppänen" on kirjoitettu a +
   * yhdistävä kaksoispiste (U+0308), jota \p{L} ei hyväksy kirjaimeksi,
   * ja nimi jäi pois.
   */
  return html
    .normalize("NFC")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter(Boolean)
}

/* "Kunnanjohtaja Mika Simoska" | "Mika Simoska, kunnanjohtaja" | "Jenni Elonen" */
function henkilo(rivi: string): { name: string; title: string | null } | null {
  const pilkku = rivi.split(/,\s*/)
  if (pilkku.length === 2 && NIMI.test(pilkku[0])) return { name: pilkku[0], title: pilkku[1] || null }
  const sanat = rivi.split(" ")
  if (sanat.length < 2) return null
  const nimi = sanat.slice(-2).join(" ")
  if (!NIMI.test(nimi)) return null
  const nimike = sanat.slice(0, -2).join(" ")
  /* Nimikkeen sanat ovat pieniä; isolla alkava edeltäjä olisi kolmiosainen nimi. */
  if (nimike && /^[A-ZÅÄÖ]/.test(nimike) && !/johtaja|päällikkö|insinööri|arkkitehti|suunnittelija|koordinaattori/i.test(nimike)) {
    return null
  }
  return { name: nimi, title: nimike || null }
}

export function jasennaTervolanYhteystiedot(laatikotHtml: string[]): TervolaOsapuolet {
  const contacts: TervolaYhteys[] = []
  let developer: string | null = null
  const consultants: string[] = []

  for (const laatikko of laatikotHtml) {
    let rooli: Rooli = null
    let yhtio: string | null = null
    let viimeinen: TervolaYhteys | null = null

    const kasitteleRivi = (rivi: string) => {
      const otsikko = rivi.match(ROOLIOTSIKKO)
      if (otsikko) {
        rooli = rooliOtsikosta(otsikko[1])
        yhtio = rooli === "kunta" ? "Tervolan kunta" : null
        viimeinen = null
        if (otsikko[2]) kasitteleRivi(otsikko[2])
        return
      }

      const sp = rivi.match(SAHKOPOSTI)
      const puh = rivi.replace(SAHKOPOSTI, "").match(PUHELIN)
      const loput = rivi.replace(SAHKOPOSTI, "").replace(PUHELIN, "").replace(/\b(puh|p)\.?\s*$/i, "").trim()

      if (!sp && !puh && YHTIO.test(rivi)) {
        const [yhtionNimi, ...henkiloOsa] = rivi.split(/,\s*/)
        yhtio = yhtionNimi.trim()
        if (rooli === "hankevastaava" && !developer) developer = yhtio
        if (rooli !== "hankevastaava" && rooli !== "kunta" && !consultants.includes(yhtio)) consultants.push(yhtio)
        viimeinen = null
        if (henkiloOsa.length) kasitteleRivi(henkiloOsa.join(", "))
        return
      }

      if (sp || puh) {
        if (!viimeinen) {
          /* Yhtiön numero ilman henkilöä (Arkkitehtitoimisto Jarmo Lokio Oy). */
          viimeinen = {
            kind: "organization",
            name: null,
            title: rooli === "konsultti" ? "Kaavakonsultti" : null,
            organization: yhtio,
            phone: null,
            email: null,
            role: rooli === "konsultti" ? "agent" : null,
          }
          contacts.push(viimeinen)
        }
        if (puh && !viimeinen.phone) viimeinen.phone = puh[1].trim()
        if (sp && !viimeinen.email) viimeinen.email = sp[0]
        if (!loput) return
      }

      const h = henkilo(loput || rivi)
      if (!h) return
      const roolinimi =
        rooli === "hankevastaava" ? "Hankevastaava" : rooli === "konsultti" ? "Kaavakonsultti" : null
      viimeinen = {
        kind: "person",
        name: h.name,
        title: [roolinimi, h.title].filter(Boolean).join(", ") || null,
        organization: yhtio,
        phone: null,
        email: null,
        role: rooli === "konsultti" ? "agent" : null,
      }
      contacts.push(viimeinen)
    }

    for (const rivi of rivit(laatikko)) kasitteleRivi(rivi)
  }

  return { contacts, developer, consultants }
}

export function tervolanKaavasivu(html: string): { ingressi: string | null; kuvaus: string; osapuolet: TervolaOsapuolet } {
  const $ = cheerio.load(html)
  const ingressi = $(".ingress").first().text().replace(/\s+/g, " ").trim() || null
  const kappaleet = $(".editor-container")
    .filter((_, el) => $(el).closest(".child-module-wrapper").length === 0)
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, " ").trim())
    .filter(Boolean)
  const liitteet = $(".link-text")
    .toArray()
    .map((el) => $(el).text().replace(/\s+/g, " ").trim())
    .filter(Boolean)
  const laatikot = $(".contact-banner address")
    .toArray()
    .map((el) => $(el).html() ?? "")
  return {
    ingressi,
    kuvaus: [ingressi, ...kappaleet, ...liitteet].filter(Boolean).join(" "),
    osapuolet: jasennaTervolanYhteystiedot(laatikot),
  }
}

/*
 * Ingressin aloitteentekijä: "…Helios 1 Cranberry Oy:n pyynnöstä",
 * "…Myrsky Energia Oy:n kaavoitusaloitteesta", "…Energiequelle Oy:n
 * esityksestä". Aloitteentekijä voi olla eri yhtiö kuin nykyinen
 * hankevastaava (Kuoringissa Myrsky Energia aloitti, nyt ABO Energy).
 */
export function aloitteentekija(ingressi: string | null): string | null {
  /* Vain isolla alkavat sanat ja numerot ennen yhtiömuotoa: "Helios 1 Cranberry Oy". */
  const m = String(ingressi ?? "")
    .normalize("NFC")
    .match(
      /* Ensimmäinen sana alkaa kirjaimella, muuten päiväys "24.9.2026" tarttuu mukaan. */
      /([A-ZÅÄÖ][\p{L}0-9&.-]*\s(?:[A-ZÅÄÖ0-9][\p{L}0-9&.-]*\s){0,3}(?:Oy|Oyj|Ab|Ky)):n\s+(?:pyynnöstä|kaavoitusaloitteesta|aloitteesta|esityksestä|hakemuksesta)/u
    )
  return m ? m[1].trim() : null
}
