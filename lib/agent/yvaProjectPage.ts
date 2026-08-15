import { stripHtml } from "./stripHtml"

/*
 * YVA-hankesivun nimetyt kentät (ymparisto.fi).
 *
 * MIKSI ERIKSEEN HAKURAJAPINNASTA. `fetchYvaSource` poimii rakennuttajan
 * hakurajapinnan leipätekstistä `extractYvaDeveloper`illa, joka etsii
 * kuvioita vapaasta proosasta ("X Oy suunnittelee..."). Se osuu, mutta
 * vain osittain: mitattu 15.8.2026, 240 YVA-hankkeesta 146:lla (61 %)
 * rakennuttaja on — 94:llä ei.
 *
 * Puuttuvilla nimi ei ole leipätekstissä lainkaan (osuma 1/94 haettaessa
 * sanaa "hankevastaava"). Se on hankesivulla NIMETTYNÄ KENTTÄNÄ, jota
 * hakurajapinta ei palauta:
 *
 *   <div class="yva_content__item">
 *     <span class="yva_content__title">Hankkeesta vastaava:</span>
 *     Valoa Networks Oy, Dominic Marshall
 *   </div>
 *
 * Rakenne on sama kaikilla tarkistetuilla sivuilla ja sisältää seitsemän
 * kenttää: Tila, Alueet, Aihealue, Hankkeesta vastaava, Konsultti,
 * Yhteysviranomainen, Diaarinumero. Nimetty kenttä on aina luotettavampi
 * kuin proosasta arvattu — sama oppi kuin D-074:ssä.
 */

const FIELD_PATTERN =
  /yva_content__title[^>]*>([\s\S]*?)<\/span>([\s\S]*?)<\/div>/g

function cleanValue(raw: string): string {
  return stripHtml(raw.replace(/<br\s*\/?>/gi, ", "))
    .replace(/\s+/g, " ")
    .trim()
}

/*
 * Palauttaa sivun nimetyt kentät nimi → arvo. Kaksoispiste otsikossa
 * poistetaan, jotta avaimet ovat vakaita ("Hankkeesta vastaava").
 */
export function parseYvaFields(html: string | null | undefined) {
  const fields: Record<string, string> = {}
  if (!html) return fields

  for (const match of html.matchAll(FIELD_PATTERN)) {
    const label = stripHtml(match[1] ?? "")
      .replace(/\s+/g, " ")
      .replace(/:\s*$/, "")
      .trim()

    const value = cleanValue(match[2] ?? "")
    if (!label || !value) continue
    if (!(label in fields)) fields[label] = value
  }

  return fields
}

/*
 * Yhtiömuoto tai organisaatiosana tekee osasta organisaation. Julkiset
 * toimijat ("Metsähallitus", "Väylävirasto", ELY-keskus) eivät kanna
 * yhtiömuotoa, joten pelkkä `looksLikeCompany` hylkäisi ne.
 */
const ORGANISATION_MARKER =
  /\b(?:Oy|Oyj|Ab|Ky|Ltd|Plc|AB|A\/S|ry|B\.V\.|N\.V\.|GmbH|Group)\b|hallitus|virasto|keskus|kunta|kaupunki|säätiö|rahasto|yhtiö|yhtymä|liikelaitos|osuuskunta|seurakunta/i

/* Yhteystieto tai osoite, ei nimi. */
const CONTACT_OR_ADDRESS = /@|^p\.|^puh\.|^PL\b|^\+?\d|^Sähköposti/i

/*
 * "Etunimi Sukunimi" ilman organisaatiomerkkiä. Mitattu 15.8.2026: viidessä
 * tapauksessa viidestätoista hankevastaava-kenttä ALKAA yhteyshenkilöllä ja
 * organisaatio on vasta seuraavana ("Annemarie Kallström, Myrsky Energia
 * Oy"). Ilman tätä testiä hankkeen rakennuttajaksi kirjoittuisi henkilön
 * nimi.
 */
function looksLikePerson(segment: string): boolean {
  if (ORGANISATION_MARKER.test(segment)) return false

  const words = segment.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 3) return false

  return words.every((w) => /^[A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?$/.test(w))
}

/*
 * Yhteystietokenttä on muotoa "Yritys Oy, Etunimi Sukunimi, p. 040…,
 * etunimi@yritys.fi" — mutta järjestys ei ole taattu, ja organisaation nimi
 * voi itse sisältää pilkkuja ("Uudenmaan elinkeino-, liikenne- ja
 * ympäristökeskus"). Siksi osat käydään läpi eikä oteta vain ensimmäistä.
 */
function organisationFromContact(value: string | undefined): string | null {
  if (!value) return null

  const raw = value.split(",").map((s) => s.trim())

  /* Tavuviivaan päättyvä osa on katkennut yhdyssana: liitetään seuraavaan. */
  const segments: string[] = []
  for (const part of raw) {
    if (segments.length && /-$/.test(segments[segments.length - 1])) {
      segments[segments.length - 1] += `, ${part}`
      continue
    }
    segments.push(part)
  }

  for (const segment of segments) {
    if (segment.length < 4) continue
    if (CONTACT_OR_ADDRESS.test(segment)) continue
    if (looksLikePerson(segment)) continue

    /*
     * "Bull Team Oy ja WeKas Oy" -> ensimmäinen. Katkaisu tehdään VAIN jos
     * vasen puoli on jo valmis organisaatio: "liikenne- ja ympäristökeskus"
     * on yksi nimi, ei kaksi, ja siinä vasen puoli päättyy tavuviivaan.
     */
    const [left] = segment.split(/\s+ja\s+/i)
    const trimmedLeft = left.trim()

    if (
      trimmedLeft !== segment.trim() &&
      !/-$/.test(trimmedLeft) &&
      ORGANISATION_MARKER.test(trimmedLeft)
    ) {
      return trimmedLeft
    }

    return segment.trim()
  }

  return null
}

export function yvaDeveloperFromHtml(html: string | null | undefined) {
  return organisationFromContact(parseYvaFields(html)["Hankkeesta vastaava"])
}

/*
 * Rikastuskoukku `lib/agent/sources.ts`:n yva-lähteelle. Samalla
 * rajapinnalla kuin `createCompanyEnricher`, joten D-075:n runkotyöntekijä
 * osaa ajaa tämän ilman muutoksia.
 */
export function createYvaEnricher() {
  return async function enrichYvaCandidate(candidate: any) {
    if (!candidate?.source_url) return candidate

    let html: string | null = null

    try {
      const response = await fetch(candidate.source_url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        },
      })
      if (!response.ok) return candidate
      html = await response.text()
    } catch {
      return candidate
    }

    const fields = parseYvaFields(html)
    const developer = organisationFromContact(fields["Hankkeesta vastaava"])

    if (!developer && Object.keys(fields).length === 0) return candidate

    return {
      ...candidate,
      developer: candidate.developer || developer || null,
      /*
       * Yhteysviranomainen, konsultti ja diaarinumero tulevat samasta
       * jäsennyksestä ilman lisätyötä. Ne eivät ole rakennuttajia, joten
       * ne jäävät metadataan eivätkä yrityskenttiin.
       */
      yva_authority: fields["Yhteysviranomainen"] ?? null,
      yva_consultant: fields["Konsultti"] ?? null,
      yva_record_number: fields["Diaarinumero"] ?? null,
      yva_status: fields["Tila"] ?? null,
    }
  }
}
