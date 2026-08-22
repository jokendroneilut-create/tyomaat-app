import type { Contact } from "@/lib/projects/contacts"
import { expandPlaceholderEmail, isPersonName } from "@/lib/agent/vaylaContacts"

/*
 * SENAATIN HANKESIVUN YHTEYSHENKILÖ.
 *
 * Jokaisella hankesivulla on ACF-kenttä `hankkeen_yhteystiedot`, jonka
 * sisältö on HTML-escapattua tekstiä:
 *
 *   <h2>Lisätietoja</h2>
 *   <strong>Senaatti-kiinteistöt</strong>
 *   Rakennuttajapäällikkö Miikka Teppo
 *   p. 040 180 0929
 *   etunimi.sukunimi@senaatti.fi
 *
 * Tieto on paras mahdollinen: rakennuttajapäällikkö on hankkeen tilaaja
 * eikä kirjaamo (vrt. D-104), ja numero on suora.
 *
 * VANHA JÄSENNIN JÄTTI PUOLET POIS. Se poimi vain nimen, nimikkeen ja
 * sähköpostin — puhelinta ei luettu lainkaan, ja sähköposti oli
 * malliosoite. Mitattu 22.8.2026: kymmenestä yhteystiedon saaneesta
 * hankkeesta yhdeksältä puuttui puhelin ja kuudelta osoite.
 *
 * Malliosoite laajennetaan nimen perusteella samalla säännöllä kuin
 * Väylävirastolla (D-103): "Miikka Teppo" + "etunimi.sukunimi@senaatti.fi"
 * -> "miikka.teppo@senaatti.fi".
 */

/* WordPressin JSON-escape: <, \/ ja \r\n. */
export function unescapeSenaattiField(raw: string): string {
  return String(raw ?? "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\\//g, "/")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;|&#160;/g, " ")
}

/* Rivi joka on pelkkä otsikko tai organisaation nimi, ei henkilö. */
const OTSIKKO = /^(lisätietoja|lisätiedot|yhteystiedot|yhteyshenkilöt?)$/i
const ORGANISAATIO =
  /^(senaatti-kiinteistöt|senaattikiinteistöt|puolustuskiinteistöt|senaatin asema-alueet)$/i

const PHONE_LINE = /^(?:p\.|puh\.?|tel\.?|gsm)?\s*((?:\+358|0)[\d\s-]{6,})$/i
const EMAIL_LINE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/*
 * "Rakennuttajapäällikkö Miikka Teppo" -> nimike + nimi.
 * Nimi on kaksi viimeistä sanaa, jos ne muodostavat henkilönnimen.
 */
function jaaNimikeJaNimi(line: string): { title: string | null; name: string | null } {
  const sanat = line.trim().split(/\s+/)
  if (sanat.length < 2) return { title: null, name: null }

  const nimi = sanat.slice(-2).join(" ")
  if (!isPersonName(nimi)) return { title: null, name: null }

  const nimike = sanat.slice(0, -2).join(" ").replace(/[,;:]$/, "").trim()
  return { title: nimike || null, name: nimi }
}

export function parseSenaattiContacts(rawField: string | null | undefined): Contact[] {
  const teksti = unescapeSenaattiField(String(rawField ?? ""))
  if (!teksti.trim()) return []

  const rivit = teksti
    .split("\n")
    .map((r) => r.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((r) => !OTSIKKO.test(r))

  const tulos: Contact[] = []
  let organisaatio: string | null = null
  let nykyinen: Contact | null = null

  const sulje = () => {
    /*
     * Pelkkä nimi ilman numeroa ja osoitetta ei ole yhteystieto.
     * Malliosoite laajennetaan vasta tässä, kun nimi on tiedossa.
     */
    if (!nykyinen) return
    const laajennettu = nykyinen.email ? expandPlaceholderEmail(nykyinen.email, nykyinen.name) : null
    nykyinen.email = laajennettu ?? ""
    if (nykyinen.email || nykyinen.phone) tulos.push(nykyinen)
    nykyinen = null
  }

  for (const rivi of rivit) {
    if (ORGANISAATIO.test(rivi)) {
      sulje()
      organisaatio = rivi
      continue
    }

    const puhelin = rivi.match(PHONE_LINE)
    if (puhelin && nykyinen) {
      nykyinen.phone = puhelin[1].replace(/\s+/g, " ").trim()
      continue
    }

    if (EMAIL_LINE.test(rivi)) {
      if (nykyinen) nykyinen.email = rivi
      continue
    }

    const { title, name } = jaaNimikeJaNimi(rivi)
    if (name) {
      /* Uusi henkilö aloittaa uuden kontaktin. */
      sulje()
      nykyinen = {
        name,
        title,
        organization: organisaatio,
        email: "",
        phone: null,
        kind: "person",
      }
    }
  }

  sulje()
  return tulos
}
