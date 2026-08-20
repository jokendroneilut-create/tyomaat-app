import { detectCityFromText } from "./detectCityFromText"
import { extractStreetAddress } from "./extractStreetAddress"
import { extractClientFromText } from "./fetchSttHakuSource"
import { inferCompanyPhase, LEAD_LENGTH } from "./companyRelease"
import { inferBuildingType } from "./buildingType"

/*
 * HC HOIVAKODIT.
 *
 * Hoivakotien rakennuttaja ja rakentaja. Lähde löytyi siitä, että
 * käyttäjä joutui lisäämään käsin osoitteen "Hommaksenkaari 5" — se oli
 * heidän omassa tiedotteessaan valmiina.
 *
 * WP-RAJAPINTA, EI LISTAUSSIVUA. Sivun /ajankohtaista/ HTML on 53 kB
 * mutta sisältää 116 merkkiä tekstiä ja nolla linkkiä: lista rakennetaan
 * selaimessa. WordPressin oma REST-rajapinta palauttaa saman sisällön
 * valmiina, joten sitä käytetään.
 *
 * VOLYYMI ON PIENI. Mitattu 20.8.2026: koko sivustolla on YKSI artikkeli.
 * Lähde otettiin silti käyttöön, koska se on halpa ylläpitää ja tuo
 * osoitteen — mutta sen tuotto on syytä tarkistaa ennen kuin siihen
 * nojataan.
 */

const API_URL = "https://hchoivakodit.fi/wp-json/wp/v2/posts?per_page=30"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/* Kaksi vuotta: vanhempi tiedote ei ole enää myyntimahdollisuus. */
const MAX_AGE_MONTHS = 24

export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function fetchHcHoivakoditSource() {
  const response = await fetch(API_URL, { headers: { "User-Agent": UA } })
  if (!response.ok) return []

  const posts = (await response.json()) as any[]
  if (!Array.isArray(posts)) return []

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - MAX_AGE_MONTHS)

  const results: any[] = []

  for (const post of posts) {
    const published = post?.date ? new Date(post.date) : null
    if (published && published < cutoff) continue

    const title = stripHtml(String(post?.title?.rendered ?? ""))
    const body = stripHtml(String(post?.content?.rendered ?? ""))

    if (!title || body.length < 120) continue

    /*
     * Tilaaja luetaan otsikosta ja ingressistä samalla poiminnalla kuin
     * muilla yrityslähteillä. HC Hoivakodit on useimmiten sekä
     * rakennuttaja että rakentaja, mutta ei aina: mitatussa tiedotteessa
     * kohde rakennetaan Humanalle, ja tilaaja on allatiivissa otsikossa.
     */
    const client = extractClientFromText(title, body.slice(0, LEAD_LENGTH))

    results.push({
      name: title,
      city: detectCityFromText(title) ?? detectCityFromText(body),
      region: null,
      location: extractStreetAddress(body),
      description: body.slice(0, 4000),
      phase: inferCompanyPhase(title, body),
      developer: client,
      builder: "HC Hoivakodit",
      property_type: inferBuildingType(title, body) ?? "Hoivakoti",
      source_url: String(post?.link ?? ""),
      confidence: 0.7,
      completed: false,
      source_name: "hc_hoivakodit",
    })
  }

  return results
}
