import crypto from "crypto"
import https from "https"
import * as cheerio from "cheerio"
import { createClient } from "@supabase/supabase-js"
import type { DiscoverySource } from "../registry/sources"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function hashContent(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

function getTitleFromHilmaNotice(notice: any) {
  return (
    notice.titleFi ||
    notice.titleSv ||
    notice.titleEn ||
    notice.noticeNumber ||
    `Hilma notice ${notice.noticeId}`
  )
}

const LUPAPISTE_BULLETINS_PAGE = "https://julkipano.lupapiste.fi/app/fi/bulletins"
const LUPAPISTE_CATEGORIES = ["r", "p"]
const LUPAPISTE_MAX_PAGES_PER_CATEGORY = 5

async function fetchLupapisteCsrfToken() {
  const response = await fetch(LUPAPISTE_BULLETINS_PAGE, { cache: "no-store" })
  const setCookie = response.headers.get("set-cookie") ?? ""
  const match = setCookie.match(/anti-csrf-token=([^;]+)/)

  if (!match) {
    throw new Error("Lupapiste CSRF-tokenia ei löytynyt vastauksen evästeistä")
  }

  return {
    token: decodeURIComponent(match[1]),
    cookie: `anti-csrf-token=${match[1]}`,
  }
}

async function fetchLupapisteBulletinsPage({
  url,
  token,
  cookie,
  page,
  category,
}: {
  url: string
  token: string
  cookie: string
  page: number
  category: string
}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-anti-forgery-token": token,
      cookie,
    },
    body: JSON.stringify({
      page,
      searchText: "",
      municipality: "",
      state: "",
      category,
      sort: { field: "modified", asc: false },
    }),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Lupapiste fetch failed: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()

  if (!json.ok) {
    throw new Error(`Lupapiste API error: ${JSON.stringify(json)}`)
  }

  return json as { ok: true; left: number; data: any[] }
}

async function collectLupapisteSource(source: DiscoverySource) {
  const { token, cookie } = await fetchLupapisteCsrfToken()

  let found = 0
  let saved = 0

  for (const category of LUPAPISTE_CATEGORIES) {
    for (let page = 1; page <= LUPAPISTE_MAX_PAGES_PER_CATEGORY; page++) {
      const result = await fetchLupapisteBulletinsPage({
        url: source.url,
        token,
        cookie,
        page,
        category,
      })

      if (!result.data || result.data.length === 0) break

      for (const notice of result.data) {
        found += 1

        const documentUrl = `https://julkipano.lupapiste.fi/app/fi/bulletins#!/bulletin/${notice.id}`
        const rawText = JSON.stringify(notice)
        const contentHash = hashContent(rawText)

        const { error } = await supabaseAdmin
          .from("source_documents")
          .upsert(
            {
              source_id: source.id,
              source_name: source.name,
              title:
                notice.bulletinOpDescription ??
                notice.address ??
                notice["application-id"],
              document_url: documentUrl,
              document_type: "api",
              content_hash: contentHash,
              status: "downloaded",
              raw_text: rawText,
              raw_payload: {
                parser: source.parser,
                category,
                priority: source.priority,
                original: notice,
              },
              processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            { onConflict: "document_url" }
          )

        if (error) throw error

        saved += 1
      }
    }
  }

  return {
    documentsFound: found,
    documentsSaved: saved,
  }
}

async function collectHilmaSource(source: DiscoverySource) {
  const apiKey = process.env.HILMA_API_KEY

  if (!apiKey) {
    throw new Error("HILMA_API_KEY missing")
  }

  const body = {
    search: "cpvCodes:(45*)",
    top: 20,
    count: true,
    searchMode: "any",
    orderby: "datePublished desc",
  }

  const response = await fetch(source.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Hilma API fetch failed: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  const notices = Array.isArray(json.value) ? json.value : []

  let saved = 0

  for (const notice of notices) {
    const noticeId = notice.noticeId ?? notice.id
    const documentUrl = noticeId
      ? `https://www.hankintailmoitukset.fi/fi/public/procurement/${noticeId}/notice/overview/overview`
      : source.url

    const rawText = JSON.stringify(notice)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: getTitleFromHilmaNotice(notice),
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            category: source.category,
            priority: source.priority,
            noticeId,
            noticeNumber: notice.noticeNumber ?? null,
            datePublished: notice.datePublished ?? null,
            organisationName: notice.organisationNameFi ?? null,
            cpvCodes: notice.cpvCodes ?? null,
            procurementDocumentsUrl: notice.procurementDocumentsUrl ?? null,
            original: notice,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "document_url",
        }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: notices.length,
    documentsSaved: saved,
    count: json["@odata.count"] ?? null,
  }
}

function boundingBoxCenter(geometry: any): { x: number; y: number } | null {
  if (!geometry?.coordinates) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  function visit(coords: any): void {
    if (typeof coords[0] === "number") {
      const [x, y] = coords
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      return
    }

    for (const item of coords) visit(item)
  }

  visit(geometry.coordinates)

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return null
  }

  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

/*
 * Pieni raja, koska tämä haku tehdään osana yöllistä croneja, jolla on
 * tiukka (60s) kokonaisaikaraja koko putkelle — jokainen haku vie sekunteja,
 * joten iso raja täällä syö budjettia myöhemmiltä vaiheilta (faktat,
 * tunnistus). Loput kaavat käsitellään seuraavilla ajokerroilla.
 */
const VANTAA_MAX_HAKIJA_FETCHES_PER_RUN = 5

export type VantaaContact = {
  name: string
  title: string | null
  phone: string | null
  email: string | null
}

/*
 * Kaavan oma sivu ohjaa usein läpi meta-refresh-uudelleenohjauksen ennen
 * varsinaista sisältöä (osoiteslugi voi muuttua). fetch() ei seuraa tätä
 * automaattisesti, joten se puretaan käsin.
 */
async function fetchVantaaPlanDetails(
  planUrl: string
): Promise<{ hakija: string | null; contacts: VantaaContact[]; description: string | null }> {
  try {
    let url = planUrl
    let html = await (await fetch(url, { cache: "no-store" })).text()

    const metaRefreshMatch = html.match(
      /<meta[^>]+http-equiv=["']refresh["'][^>]+url=['"]([^'"]+)['"]/i
    )

    if (metaRefreshMatch) {
      url = metaRefreshMatch[1]
      html = await (await fetch(url, { cache: "no-store" })).text()
    }

    const $ = cheerio.load(html)
    let hakija: string | null = null
    let hakijaLisatiedot: string | null = null

    $("dt.point__term").each((_, el) => {
      const label = $(el).text().trim().toLowerCase()
      const value = $(el).next("dd.point__description").text().trim()

      if (label === "hakija") {
        hakija = value.length > 0 ? value : null
      }

      if (label === "lisätietoja hakijasta") {
        hakijaLisatiedot = value.length > 0 ? value : null
      }
    })

    /*
     * Kaavan sivun "Lisätietoja"-osio listaa kaupungin yhteyshenkilöt
     * (kaavoittaja/arkkitehti), ei hakijan omia yhteystietoja.
     */
    const contacts: VantaaContact[] = []

    $("div.info-contact").each((_, el) => {
      const name = $(el).find(".info-contact__heading").first().text().trim()
      if (!name) return

      const title = $(el).find(".info-contact__job").first().text().trim() || null
      const phoneHref = $(el).find('a[href^="tel:"]').first().attr("href") ?? null
      const emailHref = $(el).find('a[href^="mailto:"]').first().attr("href") ?? null

      contacts.push({
        name,
        title,
        phone: phoneHref ? phoneHref.replace(/^tel:/i, "").trim() : null,
        email: emailHref ? emailHref.replace(/^mailto:/i, "").trim() : null,
      })
    })

    /*
     * Kaavan kuvausteksti (sijainti, kaavamuutoksen sisältö, päätöskäsittely
     * jne.) sisältää runsaasti päivämääriä ja taustaa, joita ei ole muualla
     * rakenteisesti saatavilla. Poimitaan otsikot ja kappaleet erillisinä
     * riveinä, jotta jäsentely säilyy luettavana.
     */
    const bodyParagraphs: string[] = []

    $(".field--body .field__item")
      .first()
      .find("h2, h3, h4, p, li")
      .each((_, el) => {
        const text = $(el).text().replace(/\s+/g, " ").trim()
        if (text) bodyParagraphs.push(text)
      })

    const descriptionParts = [
      hakijaLisatiedot ? `Lisätietoja hakijasta: ${hakijaLisatiedot}` : null,
      ...bodyParagraphs,
    ].filter((part): part is string => Boolean(part))

    const description = descriptionParts.length > 0 ? descriptionParts.join("\n\n") : null

    return { hakija, contacts, description }
  } catch {
    return { hakija: null, contacts: [], description: null }
  }
}

async function collectVantaaKaavaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Vantaan kaavarajapinnan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  const features = Array.isArray(json.features) ? json.features : []

  /*
   * Kaavan hakija, yhteyshenkilöt ja kuvausteksti eivät muutu jälkikäteen,
   * joten sivua ei haeta uudelleen niille kaavoille joille tämä on jo
   * kertaalleen selvitetty. Merkkinä käytetään "description"-kenttää (uusin
   * lisätty kenttä), jotta ennen tätä ominaisuutta haetut rivit haetaan
   * automaattisesti kertaalleen uudelleen.
   */
  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<
    string,
    { hakija: string | null; contacts: VantaaContact[]; description: string | null }
  >()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description !== undefined) {
      knownDetails.set(row.document_url, {
        hakija: row.raw_payload.hakija ?? null,
        contacts: row.raw_payload.contacts ?? [],
        description: row.raw_payload.description ?? null,
      })
    }
  }

  let saved = 0
  let hakijaFetches = 0

  for (const feature of features) {
    const properties = feature.properties ?? {}
    const documentUrl = properties.kaavalinkki || `${source.url}#${properties.kaavatunnus}`

    const known = knownDetails.get(documentUrl)
    let hakija: string | null = known?.hakija ?? null
    let contacts: VantaaContact[] = known?.contacts ?? []
    let description: string | null = known?.description ?? null
    let detailsAttempted = knownDetails.has(documentUrl)

    if (
      !detailsAttempted &&
      properties.kaavalinkki &&
      hakijaFetches < VANTAA_MAX_HAKIJA_FETCHES_PER_RUN
    ) {
      const details = await fetchVantaaPlanDetails(properties.kaavalinkki)
      hakija = details.hakija
      contacts = details.contacts
      description = details.description
      hakijaFetches += 1
      detailsAttempted = true
    }

    const rawText = JSON.stringify(feature)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: properties.kaavanimi1 ?? properties.kaavatunnus ?? "Vantaan kaava",
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            center: boundingBoxCenter(feature.geometry),
            ...(detailsAttempted ? { hakija, contacts, description } : {}),
            original: feature,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: features.length,
    documentsSaved: saved,
  }
}

const HELSINKI_DISTRICTS_URL =
  "https://kartta.hel.fi/ws/geoserver/avoindata/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=avoindata:Kaupunginosajako&outputFormat=application/json"

async function fetchHelsinkiDistrictNames(): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  try {
    const response = await fetch(HELSINKI_DISTRICTS_URL, { cache: "no-store" })
    if (!response.ok) return map

    const json = await response.json()
    for (const feature of json.features ?? []) {
      const code = String(Number(feature.properties?.tunnus))
      const name = feature.properties?.nimi_fi
      if (code && name) map.set(code, name)
    }
  } catch {
    // Piirijaon nimet eivät ole kriittisiä — jatketaan ilman niitä.
  }

  return map
}

// Ks. VANTAA_MAX_HAKIJA_FETCHES_PER_RUN yllä — sama syy pieneen rajaan. PDF-
// jäsennys on hieman raskaampi kuin tavallinen HTML-haku, joten raja on
// silti maltillinen, mutta korkeampi kuin ennen (91 kaavaa / 5 per ajo olisi
// vienyt lähes 3 viikkoa täyteen taustatietoon).
const HELSINKI_MAX_SELOSTUS_FETCHES_PER_RUN = 10

/*
 * Vireillä olevan kaavan asemakaavaselostus-PDF löytyy luotettavasti tästä
 * vuosikansiottomasta osoitteesta niin kauan kuin kaava on vielä käsittelyssä
 * — vasta valmistuneet/lainvoimaiset kaavat arkistoidaan myöhemmin
 * vuosikohtaisiin kansioihin. Koska tämä lähde kerää nimenomaan vain
 * "vireillä"-tilassa olevia kaavoja, tämä osoite osuu oikeaan lähes aina.
 *
 * Selostus-PDF:n koko tekstidumppi (ensimmäiset merkit) on lähes
 * lukukelvoton (sisällysluettelo, lakiteksti, sivunumerot), joten siitä
 * poimitaan lisäksi kolme rakenteista kenttää joita PDF:n vakiomuotoilu
 * lähes aina sisältää: "Kaavan nimi:" (oikea otsikko, ei pelkkä
 * kaavatunnus), "osoitteessa X" (katuosoite) ja Tiivistelmä-kappale
 * (ihmisluettava yhteenveto koko selostuksen sijaan).
 */
async function fetchHelsinkiKaavaSelostus(kaavaTunnus: string): Promise<{
  description: string | null
  planName: string | null
  address: string | null
  selostusUrl: string | null
}> {
  const selostusUrl = `https://www.hel.fi/static/ksv/kaava/ak${kaavaTunnus}_selostus.pdf`
  const empty = { description: null, planName: null, address: null, selostusUrl: null }

  try {
    const response = await fetch(selostusUrl, {
      headers: {
        accept: "application/pdf,*/*",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      return empty
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default
    const parsed = await pdfParse(buffer)
    const text = parsed.text?.trim() ?? ""

    if (!text) return empty

    const planNameMatch = text.match(/Kaavan nimi:\s*([^\n]+)/)
    const planName = planNameMatch ? planNameMatch[1].replace(/\s+/g, " ").trim() || null : null

    /*
     * Osoitetta seuraa usein suoraan kuvaileva sivulause ilman pilkkua
     * ("osoitteessa Hopeatie 2 sijaitseva liike- ja toimistorakennus..."),
     * joten pysähdytään heti ensimmäiseen numeroon (talon numero) sen
     * sijaan että kaapattaisiin koko lause seuraavaan pilkkuun asti.
     */
    const addressMatch = text.match(/osoitteessa\s+([A-ZÄÖÅ][^\d\n]*?\d+)/)
    const address = addressMatch ? addressMatch[1].replace(/\s+/g, " ").trim() || null : null

    const summaryMatch = text.match(/Tiivistelmä\s*\n([\s\S]*?)\n\s*\n\s*\d+\s*\n/)
    const summary = summaryMatch
      ? summaryMatch[1].replace(/-\n/g, "").replace(/\s+/g, " ").trim()
      : null

    return {
      description: (summary && summary.length > 40 ? summary : text.slice(0, 8000)) || null,
      planName,
      address,
      selostusUrl,
    }
  } catch {
    return empty
  }
}

/*
 * Helsingin vireillä-rajapinnassa ei ole kaavan omaa nimeä, hakijaa eikä
 * kuvaustekstiä (toisin kuin Vantaalla) — vain kaavatunnus, käsittelyvaihe,
 * pinta-ala ja sijainti. Kuvausteksti haetaan erikseen kaavan omasta
 * asemakaavaselostus-PDF:stä (ks. fetchHelsinkiKaavaSelostus).
 */
async function collectHelsinkiKaavaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Helsingin kaavarajapinnan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  const features = Array.isArray(json.features) ? json.features : []
  const districtNames = await fetchHelsinkiDistrictNames()

  /*
   * Selostusteksti ei muutu jälkikäteen, joten sitä ei haeta uudelleen
   * kaavoille joille selostus on jo kertaalleen löytynyt onnistuneesti.
   * Epäonnistuneita hakuja (selostusta ei vielä julkaistu, kaava on liian
   * varhaisessa vaiheessa) EI merkitä pysyvästi käsitellyksi, koska
   * selostus voi ilmestyä myöhemmin kaavaprosessin edetessä — nämä
   * yritetään siis uudelleen jokaisella keräysajolla (sama malli kuin
   * Vantaan hakija-haussa).
   */
  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<
    string,
    { description: string | null; planName: string | null; address: string | null; selostusUrl: string | null }
  >()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description) {
      knownDetails.set(row.document_url, {
        description: row.raw_payload.description,
        planName: row.raw_payload.plan_name ?? null,
        address: row.raw_payload.address ?? null,
        selostusUrl: row.raw_payload.selostus_url ?? null,
      })
    }
  }

  let saved = 0
  let selostusFetches = 0

  for (const feature of features) {
    const properties = feature.properties ?? {}
    const kaavaTunnus = properties.kaavatunnus ?? properties.id
    const documentUrl = `${source.url}#${kaavaTunnus}`

    const districtCode = properties.sijaintialue
      ? String(Number(properties.sijaintialue))
      : null
    const districtName = districtCode ? districtNames.get(districtCode) ?? null : null

    const known = knownDetails.get(documentUrl)
    let description: string | null = known?.description ?? null
    let planName: string | null = known?.planName ?? null
    let address: string | null = known?.address ?? null
    let selostusUrl: string | null = known?.selostusUrl ?? null
    let detailsAttempted = knownDetails.has(documentUrl)

    if (
      !detailsAttempted &&
      properties.kaavatunnus &&
      selostusFetches < HELSINKI_MAX_SELOSTUS_FETCHES_PER_RUN
    ) {
      const details = await fetchHelsinkiKaavaSelostus(String(properties.kaavatunnus))
      description = details.description
      planName = details.planName
      address = details.address
      selostusUrl = details.selostusUrl
      selostusFetches += 1
      detailsAttempted = details.description !== null
    }

    const rawText = JSON.stringify(feature)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title:
            planName ??
            `Kaava ${properties.kaavatunnus ?? properties.id}${districtName ? ` – ${districtName}` : ""}`,
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            center: boundingBoxCenter(feature.geometry),
            district_name: districtName,
            ...(detailsAttempted
              ? { description, plan_name: planName, address, selostus_url: selostusUrl }
              : {}),
            original: feature,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: features.length,
    documentsSaved: saved,
  }
}

// Ks. VANTAA_MAX_HAKIJA_FETCHES_PER_RUN yllä — sama syy pieneen rajaan.
const TAMPERE_MAX_DETAIL_FETCHES_PER_RUN = 5

/*
 * Tampereen kaavan omalta sivulta (tampere.fi/kaavat/{nro}) poimitaan
 * vaiheen tila ja kuvausteksti. Diaarinumero ja päätöksentekijä ovat
 * upotettuina kuvaustekstin loppuun ("... Diaarinumero: TRE:xxx
 * Päätöksentekijä: Yhdyskuntalautakunta"), ei omina kenttinään, joten ne
 * puretaan kuvauksesta erilleen.
 */
async function fetchTampereKaavaDetails(planUrl: string): Promise<{
  phase: string | null
  description: string | null
  diaarinumero: string | null
  decisionMaker: string | null
  title: string | null
}> {
  try {
    let url = planUrl
    let html = await (await fetch(url, { cache: "no-store" })).text()

    const metaRefreshMatch = html.match(
      /<meta[^>]+http-equiv=["']refresh["'][^>]+url=['"]([^'"]+)['"]/i
    )

    if (metaRefreshMatch) {
      url = new URL(metaRefreshMatch[1], url).toString()
      html = await (await fetch(url, { cache: "no-store" })).text()
    }

    const $ = cheerio.load(html)
    const title = $("h1").first().text().trim() || null
    const phase = $(".field-phase").first().text().trim() || null
    const rawDescription =
      $(".field-description").first().text().replace(/\s+/g, " ").trim() || null

    let description = rawDescription
    let diaarinumero: string | null = null
    let decisionMaker: string | null = null

    if (rawDescription) {
      const diaariMatch = rawDescription.match(/Diaarinumero:\s*(.+?)\s*Päätöksentekijä:/)
      const paatoksentekijaMatch = rawDescription.match(/Päätöksentekijä:\s*(.+)$/)

      diaarinumero = diaariMatch?.[1]?.trim() ?? null
      decisionMaker = paatoksentekijaMatch?.[1]?.trim() ?? null
      description = rawDescription.replace(/\s*Diaarinumero:.*$/, "").trim()
    }

    return { phase, description, diaarinumero, decisionMaker, title }
  } catch {
    return { phase: null, description: null, diaarinumero: null, decisionMaker: null, title: null }
  }
}

async function collectTampereKaavaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Tampereen kaavarajapinnan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  const features = Array.isArray(json.features) ? json.features : []

  /*
   * Sama malli kuin Helsingin selostushaussa: vain onnistuneet haut
   * jäävät muistiin, epäonnistuneita yritetään joka ajolla uudelleen.
   */
  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<
    string,
    { phase: string | null; description: string | null; diaarinumero: string | null; decisionMaker: string | null; title: string | null }
  >()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description) {
      knownDetails.set(row.document_url, {
        phase: row.raw_payload.phase ?? null,
        description: row.raw_payload.description,
        diaarinumero: row.raw_payload.diaarinumero ?? null,
        decisionMaker: row.raw_payload.decision_maker ?? null,
        title: row.raw_payload.plan_title ?? null,
      })
    }
  }

  let saved = 0
  let detailFetches = 0

  for (const feature of features) {
    const properties = feature.properties ?? {}
    const planUrl = String(properties.KAAVAN_VERKKOSIVU_JA_DOKUMENTIT ?? "").match(/href="([^"]+)"/)?.[1] ?? null
    const kaavaTunnus = planUrl?.match(/\/kaavat\/(\d+)/)?.[1] ?? null
    const documentUrl = planUrl || `${source.url}#${properties.ID}`

    const known = knownDetails.get(documentUrl)
    let phase: string | null = known?.phase ?? null
    let description: string | null = known?.description ?? null
    let diaarinumero: string | null = known?.diaarinumero ?? properties.DIAARINRO ?? null
    let decisionMaker: string | null = known?.decisionMaker ?? null
    let planTitle: string | null = known?.title ?? null
    let detailsAttempted = knownDetails.has(documentUrl)

    if (
      !detailsAttempted &&
      planUrl &&
      detailFetches < TAMPERE_MAX_DETAIL_FETCHES_PER_RUN
    ) {
      const details = await fetchTampereKaavaDetails(planUrl)
      phase = details.phase
      description = details.description
      diaarinumero = details.diaarinumero ?? properties.DIAARINRO ?? null
      decisionMaker = details.decisionMaker
      planTitle = details.title
      detailFetches += 1
      detailsAttempted = details.description !== null
    }

    const rawText = JSON.stringify(feature)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: planTitle ?? `Asemakaava nro ${kaavaTunnus ?? properties.ID}`,
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            center: boundingBoxCenter(feature.geometry),
            kaava_tunnus: kaavaTunnus,
            diaarinumero,
            ...(detailsAttempted
              ? { phase, description, decision_maker: decisionMaker, plan_title: planTitle }
              : {}),
            original: feature,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: features.length,
    documentsSaved: saved,
  }
}

// Ks. VANTAA_MAX_HAKIJA_FETCHES_PER_RUN yllä — sama syy pieneen rajaan.
const TURKU_MAX_DETAIL_FETCHES_PER_RUN = 5

function unescapeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function xmlTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<GIS:${tag}>([^<]*)</GIS:${tag}>`))
  const value = match?.[1]?.trim()
  return value ? unescapeXml(value) : null
}

/*
 * Turku käyttää vanhempaa Tekla-pohjaista WFS-palvelinta (ei GeoServer
 * kuten Helsinki/Vantaa/Tampere) joka ei tue JSON-ulostuloa — vastaus
 * puretaan siis GML/XML-tekstinä yksinkertaisilla säännöllisillä
 * lausekkeilla, koska kenttärakenne on tasainen eikä sisäkkäinen
 * (DescribeFeatureType vahvisti kentät etukäteen).
 */
function parseTurkuFeatures(xml: string): {
  kaavaTunnus: string | null
  kaavanNimi: string | null
  kaavalaji: string | null
  kaavatilanne: string | null
  planUrl: string | null
  center: { x: number; y: number } | null
}[] {
  const blocks =
    xml.match(
      /<GIS:Akaava_Asemakaava_alueet_vireilla>[\s\S]*?<\/GIS:Akaava_Asemakaava_alueet_vireilla>/g
    ) ?? []

  return blocks.map((block) => {
    const coordsMatch = block.match(/<gml:coordinates>([^<]*)<\/gml:coordinates>/)

    let center: { x: number; y: number } | null = null

    if (coordsMatch) {
      const pairs = coordsMatch[1]
        .trim()
        .split(/\s+/)
        .map((pair) => pair.split(",").map(Number))
        .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y))

      if (pairs.length > 0) {
        const xs = pairs.map((p) => p[0])
        const ys = pairs.map((p) => p[1])
        center = {
          x: (Math.min(...xs) + Math.max(...xs)) / 2,
          y: (Math.min(...ys) + Math.max(...ys)) / 2,
        }
      }
    }

    return {
      kaavaTunnus: xmlTag(block, "Kaavatunnus"),
      kaavanNimi: xmlTag(block, "KaavanNimi"),
      kaavalaji: xmlTag(block, "Kaavalaji"),
      kaavatilanne: xmlTag(block, "Kaavatilanne"),
      planUrl: xmlTag(block, "URL"),
      center,
    }
  })
}

/*
 * Turun kaavan omalta sivulta (turku.fi/kaavoitus/{slug}, uudelleen-
 * ohjautuu HTTP 301:llä ilman meta-refresh-käsittelyä toisin kuin
 * Tampere/Vantaa) poimitaan kuvausteksti ja kaavan tunnistetietolaatikon
 * kaikki rivit ("Diaarinumero: ...", "Vastuuhenkilö: ..." jne.) —
 * kenttien määrä ja nimet vaihtelevat kaavoittain, joten ne kerätään
 * yleisesti "Otsikko: Arvo" -pareina, ei kiinteinä nimettyinä kenttinä.
 */
async function fetchTurkuKaavaDetails(planUrl: string): Promise<{
  description: string | null
  identifyingInfo: Record<string, string>
}> {
  try {
    const html = await (await fetch(planUrl, { cache: "no-store" })).text()
    const $ = cheerio.load(html)

    const description =
      $(".city-plan-content").first().children().first().text().replace(/\s+/g, " ").trim() ||
      null

    const identifyingInfo: Record<string, string> = {}

    $(".map-information__item").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      const separatorIndex = text.indexOf(":")
      if (separatorIndex === -1) return

      const label = text.slice(0, separatorIndex).trim()
      const value = text.slice(separatorIndex + 1).trim()
      if (label && value) identifyingInfo[label] = value
    })

    return { description, identifyingInfo }
  } catch {
    return { description: null, identifyingInfo: {} }
  }
}

async function collectTurkuKaavaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Turun kaavarajapinnan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const xml = await response.text()

  /*
   * Turun WFS-rajapinta on yhteinen Turun ja Kaarinan kanssa
   * (Kaavatunnus alkaa kuntanumerolla — Turku 853, Kaarina 202).
   * Kaarinan kaavat rajataan pois, koska niillä on eri verkkosivu
   * (kaarina.fi, eri rakenne) eikä tämä lähde ole tarkoitettu niille —
   * muuten ne päätyisivät virheellisesti "Turku"-kunnaksi.
   */
  const features = parseTurkuFeatures(xml).filter((feature) =>
    feature.kaavaTunnus?.trim().startsWith("853")
  )

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<
    string,
    { description: string | null; identifyingInfo: Record<string, string> }
  >()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description) {
      knownDetails.set(row.document_url, {
        description: row.raw_payload.description,
        identifyingInfo: row.raw_payload.identifying_info ?? {},
      })
    }
  }

  let saved = 0
  let detailFetches = 0

  /*
   * Yksi kaava voi koostua useasta erillisestä alueesta (usea
   * gml:featureMember jakaa saman Kaavatunnuksen/URL:n) — ilman tätä
   * välimuistia sama sivu haettaisiin turhaan monta kertaa saman ajon
   * sisällä, mikä söi koko ajon budjetin yhdeltä kaavalta.
   */
  const inRunDetails = new Map<
    string,
    { description: string | null; identifyingInfo: Record<string, string> }
  >()

  for (const feature of features) {
    const documentUrl =
      feature.planUrl || `${source.url}#${feature.kaavaTunnus ?? "unknown"}`

    const known = knownDetails.get(documentUrl) ?? inRunDetails.get(documentUrl)
    let description: string | null = known?.description ?? null
    let identifyingInfo: Record<string, string> = known?.identifyingInfo ?? {}
    let detailsAttempted = Boolean(known)

    if (
      !detailsAttempted &&
      feature.planUrl &&
      detailFetches < TURKU_MAX_DETAIL_FETCHES_PER_RUN
    ) {
      const details = await fetchTurkuKaavaDetails(feature.planUrl)
      description = details.description
      identifyingInfo = details.identifyingInfo
      detailFetches += 1
      detailsAttempted = details.description !== null

      if (detailsAttempted) {
        inRunDetails.set(documentUrl, { description, identifyingInfo })
      }
    }

    const rawText = JSON.stringify(feature)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: feature.kaavanNimi ?? `Asemakaava ${feature.kaavaTunnus ?? "?"}`,
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            center: feature.center,
            kaava_tunnus: feature.kaavaTunnus,
            kaavan_nimi: feature.kaavanNimi,
            kaavalaji: feature.kaavalaji,
            kaavatilanne: feature.kaavatilanne,
            ...(detailsAttempted
              ? { description, identifying_info: identifyingInfo }
              : {}),
            original: feature,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: features.length,
    documentsSaved: saved,
  }
}

const KREATE_PROJECTS_PER_RUN = 30

type KreateContact = {
  title: string | null
  name: string | null
  phone: string | null
  email: string | null
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .trim()
}

/*
 * Kreate.fi on WordPress, ja projektien REST-rajapinta antaa sekä listan
 * että jokaisen hankkeen sisällön (yhteystietotaulukko mukaan lukien)
 * SAMASSA vastauksessa — ei erillistä sivukohtaista hakua toisin kuin
 * kaupunkien kaavarajapinnoissa. Haetaan vain uusimman muokkauspäivän
 * mukaan järjestetty ensimmäinen sivu (ei kaikkia ~250 hanketta joka
 * ajolla), jotta muutokset (esim. vaiheen vaihtuminen) huomataan
 * nopeasti eikä yöllinen ajo hidastu turhaan.
 */
async function fetchKreateTaxonomy(
  taxonomy: "project_status" | "project_category"
): Promise<Map<number, string>> {
  const map = new Map<number, string>()

  try {
    const response = await fetch(
      `https://kreate.fi/wp-json/wp/v2/${taxonomy}?per_page=100`,
      { cache: "no-store" }
    )
    if (!response.ok) return map

    const terms = await response.json()
    for (const term of terms ?? []) {
      if (term?.id && term?.name) map.set(term.id, term.name)
    }
  } catch {
    // Taksonomian nimet eivät ole kriittisiä — jatketaan ilman niitä.
  }

  return map
}

function kreatePhaseFromStatusNames(statusNames: string[]): string | null {
  const normalized = statusNames.map((s) => s.toLowerCase())
  if (normalized.some((s) => s === "valmistuneet" || s === "completed")) {
    return "Valmistunut"
  }
  if (normalized.some((s) => s === "käynnissä" || s === "ongoing")) {
    return "Rakenteilla"
  }
  return null
}

function parseKreateContacts(contentHtml: string): KreateContact[] {
  const $ = cheerio.load(contentHtml)
  const contacts: KreateContact[] = []

  $(".row").each((_, el) => {
    const row = $(el)
    const name = row.find(".name").first().text().trim()
    if (!name) return

    contacts.push({
      title: row.find(".job").first().text().trim() || null,
      name,
      phone: row.find(".tel").first().text().trim() || null,
      email: row.find(".email").first().text().trim() || null,
    })
  })

  return contacts
}

async function collectKreateSource(source: DiscoverySource) {
  const [statusNames, categoryNames] = await Promise.all([
    fetchKreateTaxonomy("project_status"),
    fetchKreateTaxonomy("project_category"),
  ])

  const response = await fetch(
    `https://kreate.fi/wp-json/wp/v2/project?per_page=${KREATE_PROJECTS_PER_RUN}&lang=fi&orderby=modified&order=desc`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    throw new Error(`Kreaten hankerajapinnan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const posts = await response.json()

  let saved = 0

  for (const post of posts ?? []) {
    const title = decodeHtmlEntities(post.title?.rendered ?? "")
    const contentHtml = post.content?.rendered ?? ""
    const contacts = parseKreateContacts(contentHtml)

    const statusList = (post.project_status ?? [])
      .map((id: number) => statusNames.get(id))
      .filter(Boolean) as string[]
    const categoryList = (post.project_category ?? [])
      .map((id: number) => categoryNames.get(id))
      .filter(Boolean) as string[]

    const phase = kreatePhaseFromStatusNames(statusList)

    const rawText = JSON.stringify(post)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: title || `Kreate-hanke ${post.id}`,
          document_url: post.link,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            kreate_post_id: post.id,
            title,
            phase,
            category: categoryList[0] ?? null,
            contacts,
            modified: post.modified,
            original: post,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: posts?.length ?? 0,
    documentsSaved: saved,
  }
}

const VAYLA_PAGES_PER_RUN = 2
const VAYLA_MAX_DETAIL_FETCHES_PER_RUN = 5
const VAYLA_LISTING_BASE =
  "https://vayla.fi/suunnittelu-rakentaminen/-/project/c/35402106-35402107"

type VaylaListingItem = {
  title: string | null
  link: string | null
  description: string | null
  hankeType: string | null
  region: string | null
  phase: string | null
}

/*
 * Väylävirasto on Liferay-portaali — pelkkä ?...cur=N -kyselyparametri
 * ilman "friendly URL" -polkuosaa (/-/project/c/{id}) palauttaa
 * epävakaan/väärän sivun sisällön. Kokonaissivumäärä (~26) luetaan
 * itse sivutuslinkeistä, ei kovakoodata, koska hankkeiden määrä
 * vaihtelee ajan myötä.
 */
async function fetchVaylaListingPage(page: number): Promise<{
  items: VaylaListingItem[]
  totalPages: number
}> {
  const response = await fetch(
    `${VAYLA_LISTING_BASE}?_fi_yja_vayla_hanke_web_search_portlet_delta=15&_fi_yja_vayla_hanke_web_search_portlet_cur=${page}`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    throw new Error(`Väyläviraston hankelistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: VaylaListingItem[] = []

  $("table.articleIterator tr").each((_, row) => {
    const el = $(row)
    const link = el.find("h2.title a.projectPage").first().attr("href") ?? null
    const title = el.find("h2.title a.projectPage").first().text().trim() || null
    if (!link || !title) return

    items.push({
      title,
      link,
      description: el.find(".shortDescription").first().text().replace(/\s+/g, " ").trim() || null,
      hankeType: el.find(".category.hanke").first().text().trim() || null,
      region: el.find(".category.alue").first().text().trim() || null,
      phase: el.find(".category.hankkeen-vaihe").first().text().trim() || null,
    })
  })

  let totalPages = page
  $("a").each((_, a) => {
    const href = $(a).attr("href") ?? ""
    const match = href.match(/portlet_cur=(\d+)/)
    if (match) totalPages = Math.max(totalPages, Number(match[1]))
  })

  return { items, totalPages }
}

/*
 * Väylävirasto suojaa sähköpostiosoitteet Cloudflaren "email protection"
 * -obfuskaatiolla (ensimmäinen tavu on XOR-avain, loput ovat sillä
 * XOR:attuja hex-pareja) — tämä on täysin dokumentoitu, julkinen
 * purkualgoritmi, ei botti-esto jota pitäisi kiertää salaa.
 */
function decodeCloudflareEmail(encoded: string): string | null {
  try {
    const key = parseInt(encoded.substring(0, 2), 16)
    let email = ""
    for (let i = 2; i < encoded.length; i += 2) {
      email += String.fromCharCode(parseInt(encoded.substring(i, i + 2), 16) ^ key)
    }
    return email || null
  } catch {
    return null
  }
}

async function fetchVaylaProjectDetails(projectUrl: string): Promise<{
  contact: { organization: string | null; title: string | null; name: string | null; phone: string | null; email: string | null } | null
  progress: string | null
}> {
  try {
    const html = await (await fetch(projectUrl, { cache: "no-store" })).text()
    const $ = cheerio.load(html)

    const contactBox = $(".contact-information .contact").first()
    let contact = null

    if (contactBox.length) {
      const emailEncoded = contactBox.find(".__cf_email__").first().attr("data-cfemail")

      contact = {
        organization: contactBox.find(".organization").first().text().trim() || null,
        title: contactBox.find(".title").first().text().trim() || null,
        name: contactBox.find(".full-name").first().text().trim() || null,
        phone: contactBox.find(".phones li").first().text().trim() || null,
        email: emailEncoded ? decodeCloudflareEmail(emailEncoded) : null,
      }
    }

    const progress =
      $("[class*=project__progress]").first().text().replace(/\s+/g, " ").trim() || null

    return { contact, progress }
  } catch {
    return { contact: null, progress: null }
  }
}

async function collectVaylaSource(source: DiscoverySource) {
  const { totalPages } = await fetchVaylaListingPage(1)

  /*
   * Ei tunnistetietoa "viimeksi muokattu" -järjestyksestä (toisin kuin
   * Kreatella), joten koko ~390 hankkeen katalogi kierrätetään ajan
   * mittaan päivämäärään sidotulla kiertävällä sivuosoittimella sen
   * sijaan että sama alkupää haettaisiin joka yö uudelleen.
   */
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  const startPage = (dayOfYear % totalPages) + 1

  const pagesToFetch = Array.from(
    { length: VAYLA_PAGES_PER_RUN },
    (_, i) => ((startPage - 1 + i) % totalPages) + 1
  )

  const allItems: VaylaListingItem[] = []
  for (const page of pagesToFetch) {
    const { items } = await fetchVaylaListingPage(page)
    allItems.push(...items)
  }

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, { contact: any; progress: string | null }>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.contact || row.raw_payload?.progress) {
      knownDetails.set(row.document_url, {
        contact: row.raw_payload.contact ?? null,
        progress: row.raw_payload.progress ?? null,
      })
    }
  }

  const inRunDetails = new Map<string, { contact: any; progress: string | null }>()
  let saved = 0
  let detailFetches = 0

  for (const item of allItems) {
    if (!item.link) continue

    const known = knownDetails.get(item.link) ?? inRunDetails.get(item.link)
    let contact = known?.contact ?? null
    let progress = known?.progress ?? null
    let detailsAttempted = Boolean(known)

    if (!detailsAttempted && detailFetches < VAYLA_MAX_DETAIL_FETCHES_PER_RUN) {
      const details = await fetchVaylaProjectDetails(item.link)
      contact = details.contact
      progress = details.progress
      detailFetches += 1
      detailsAttempted = Boolean(details.contact || details.progress)

      if (detailsAttempted) {
        inRunDetails.set(item.link, { contact, progress })
      }
    }

    const rawText = JSON.stringify(item)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.link,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            description: item.description,
            hanke_type: item.hankeType,
            region: item.region,
            phase: item.phase,
            ...(detailsAttempted ? { contact, progress } : {}),
            original: item,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: allItems.length,
    documentsSaved: saved,
  }
}

const SENAATTI_MAX_DETAIL_FETCHES_PER_RUN = 10

/*
 * Senaatti.fi on myös WordPress, mutta REST-rajapinnan content.rendered
 * on raakaa WPBakery-lyhytkoodia (esim. [senaatti_hero heading="..."
 * text="..."]), ei valmista HTML:ää. Kuvausteksti poimitaan hero-lohkon
 * text-attribuutista suoraan sen sijaan että koko lyhytkoodi jäsennettäisiin.
 */
async function fetchSenaattiTaxonomy(
  taxonomy: "senaatti_tprojects" | "senaatti_tprojectl" | "senaatti_tprojectt"
): Promise<Map<number, string>> {
  const map = new Map<number, string>()

  try {
    const response = await fetch(
      `https://www.senaatti.fi/wp-json/wp/v2/${taxonomy}?per_page=100`,
      { cache: "no-store" }
    )
    if (!response.ok) return map

    const terms = await response.json()
    for (const term of terms ?? []) {
      if (term?.id && term?.name) map.set(term.id, term.name)
    }
  } catch {
    // Taksonomian nimet eivät ole kriittisiä — jatketaan ilman niitä.
  }

  return map
}

function extractSenaattiHeroText(contentHtml: string): string | null {
  const match = contentHtml.match(/text=(?:&#8221;|")([^"&]*(?:&(?!#8221;)[^"&]*)*)(?:&#8221;|")/)
  if (!match) return null

  return match[1]
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/&amp;/g, "&")
    .trim() || null
}

/*
 * Yhteystieto ei tule REST-rajapinnasta lainkaan — se on laskettu vain
 * hankkeen omalle sivulle upotettuun Google Tag Manager -dataLayeriin
 * ("hankkeen_yhteystiedot"-kenttä), joten se vaatii erillisen
 * sivukohtaisen haun.
 */
async function fetchSenaattiContact(projectUrl: string): Promise<{
  name: string | null
  title: string | null
  email: string | null
} | null> {
  try {
    const html = await (await fetch(projectUrl, { cache: "no-store" })).text()
    const match = html.match(/"hankkeen_yhteystiedot"\s*:\s*"([^"]*)"/)
    if (!match) return null

    const lines = match[1]
      .split(/\\r\\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line !== "Lisätietoja" && line !== "Senaatti-kiinteistöt")

    const email = lines.find((line) => line.includes("@")) ?? null
    const name = lines.find((line) => line !== email) ?? null
    const title = lines.find((line) => line !== email && line !== name) ?? null

    if (!name && !email) return null

    return { name, title, email }
  } catch {
    return null
  }
}

async function collectSenaattiSource(source: DiscoverySource) {
  const [phaseNames, locationNames, typeNames] = await Promise.all([
    fetchSenaattiTaxonomy("senaatti_tprojects"),
    fetchSenaattiTaxonomy("senaatti_tprojectl"),
    fetchSenaattiTaxonomy("senaatti_tprojectt"),
  ])

  const response = await fetch(
    "https://www.senaatti.fi/wp-json/wp/v2/senaatti_project?per_page=100",
    { cache: "no-store" }
  )

  if (!response.ok) {
    throw new Error(`Senaatin hankerajapinnan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const posts = await response.json()

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownContacts = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.contact) {
      knownContacts.set(row.document_url, row.raw_payload.contact)
    }
  }

  let saved = 0
  let detailFetches = 0

  for (const post of posts ?? []) {
    const title = post.title?.rendered ?? null
    const description = extractSenaattiHeroText(post.content?.rendered ?? "")

    const phase = (post.senaatti_tprojects ?? []).map((id: number) => phaseNames.get(id)).find(Boolean) ?? null
    const location = (post.senaatti_tprojectl ?? []).map((id: number) => locationNames.get(id)).find(Boolean) ?? null
    const buildingType = (post.senaatti_tprojectt ?? []).map((id: number) => typeNames.get(id)).find(Boolean) ?? null

    const known = knownContacts.get(post.link)
    let contact = known ?? null
    const detailsAttempted = Boolean(known)

    if (!detailsAttempted && detailFetches < SENAATTI_MAX_DETAIL_FETCHES_PER_RUN) {
      contact = await fetchSenaattiContact(post.link)
      detailFetches += 1
    }

    const rawText = JSON.stringify(post)
    const contentHash = hashContent(rawText)

    /*
     * Senaatin hankerajapinta listaa kaikki hankkeet, myös vuosia sitten
     * valmistuneet (esim. "Valmistunut" 2023) — ilman tätä ne päätyisivät
     * TIC-hyväksyntäjonoon aivan kuten uudetkin hankkeet. Sama
     * "merkitse jo käsitellyksi keräyshetkellä" -malli kuin muillakin
     * lähteillä (esim. Hämeenlinna), jotta ne eivät koskaan luo
     * kandidaattia.
     */
    const completed = (phase ?? "").toLowerCase() === "valmistunut"

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: title || `Senaatti-hanke ${post.id}`,
          document_url: post.link,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            senaatti_post_id: post.id,
            title,
            description,
            phase,
            location,
            building_type: buildingType,
            ...(contact ? { contact } : {}),
            original: post,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: posts?.length ?? 0,
    documentsSaved: saved,
  }
}

/*
 * Kuopion "sukka"-karttasovelluksen (Trimble/Tekla) taustarajapinta.
 * Palauttaa kaikki kaavat (myös vanhat lainvoimaiset) yhdessä
 * GeoJSON-vastauksessa — vireillä olevat suodatetaan pois niistä,
 * joilla date_legal on asetettu (= jo lainvoimainen/valmis prosessi).
 * Kuvaus ja yhteystiedot tulevat valmiina samassa vastauksessa, joten
 * erillistä yksityiskohtasivun hakua ei tarvita (toisin kuin Tampere/
 * Turku/Väylävirasto).
 */
function kuopioPhaseLabel(phaseId: number | null): string | null {
  switch (phaseId) {
    case 2:
      return "Vireilletulo"
    case 3:
      return "Valmisteluvaihe"
    case 4:
      return "Ehdotusvaihe"
    case 5:
      return "Hyväksytty"
    case 6:
      return "Lainvoimainen"
    default:
      return null
  }
}

function kuopioPlanTypeLabel(planTypeId: number | null): string | null {
  if (planTypeId === 1) return "Asemakaava"
  if (planTypeId === 2) return "Yleiskaava"
  if (planTypeId === 10) return "Ranta-asemakaavan kumoaminen"
  return null
}

type KuopioContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

/*
 * "contact"-kenttä on vapaamuotoinen teksti, esim. "Nimi\nPuhelin",
 * "Nimi, Puhelin, nimi(at)kuopio.fi" tai useampi henkilö tyhjällä
 * rivillä eroteltuna. Sähköposti on joskus kirjoitettu "(at)"-muodossa
 * roskapostisuodattimien vuoksi.
 */
function parseKuopioContacts(contact: string | null): KuopioContact[] {
  if (!contact || !contact.trim()) return []

  const blocks = contact
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block) => {
    const parts = block.includes(",")
      ? block.split(",").map((p) => p.trim())
      : block.split("\n").map((p) => p.trim())

    const name = parts[0] || null
    const rest = parts.slice(1)
    const emailRaw = rest.find((p) => p.includes("@") || p.includes("(at)"))
    const email = emailRaw ? emailRaw.replace("(at)", "@").trim() : null
    const phone = rest.find((p) => p !== emailRaw && /\d/.test(p)) ?? null

    return { name, title: null, phone, email }
  })
}

async function collectKuopioSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Kuopion kaavarajapinnan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  const allFeatures = Array.isArray(json.features) ? json.features : []

  const features = allFeatures.filter((feature: any) => !feature.properties?.date_legal)

  let saved = 0

  for (const feature of features) {
    const properties = feature.properties ?? {}
    const id = properties.id
    const documentUrl = `https://kartta.kuopio.fi/Applications/sukka/dist/#/viewplan/1/sukka_all_plans/${id}`

    const rawText = JSON.stringify(feature)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: properties.plan_name || `Kaava ${properties.plan_number ?? id}`,
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            kuopio_plan_id: id,
            plan_name: properties.plan_name,
            plan_number: properties.plan_number || null,
            record_number: properties.record_number || null,
            phase: kuopioPhaseLabel(properties.phase_id),
            plan_type: kuopioPlanTypeLabel(properties.plan_type_id),
            description: properties.description || null,
            contacts: parseKuopioContacts(properties.contact),
            center: boundingBoxCenter(feature.geometry),
            original: feature,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: features.length,
    documentsSaved: saved,
  }
}

/*
 * Hyvinkää käyttää täsmälleen samaa Trimble/Tekla "sukka"-taustarajapintaa
 * kuin Kuopio (sama GeoJSON-muoto, sama koordinaattijärjestelmä GK25),
 * vain eri layer-nimellä ("sukka_asemakaava_user" Kuopion
 * "sukka_all_plans" sijaan) ja eri phase_id-numeroinnilla.
 */
function hyvinkaaPhaseLabel(phaseId: number | null): string | null {
  switch (phaseId) {
    case 1:
      return "Vireilletulo"
    case 2:
      return "Vireilletulo"
    case 3:
      return "Valmisteluvaihe"
    case 4:
      return "Ehdotusvaihe"
    case 5:
      return "Hyväksytty"
    case 6:
      return "Lainvoimainen"
    default:
      return null
  }
}

type HyvinkaaContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

function parseHyvinkaaContacts(contact: string | null): HyvinkaaContact[] {
  if (!contact || !contact.trim()) return []

  const blocks = contact
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)

  return blocks.map((block) => {
    const parts = block.includes(",")
      ? block.split(",").map((p) => p.trim())
      : block.split("\n").map((p) => p.trim())

    const name = parts[0] || null
    const rest = parts.slice(1)
    const emailRaw = rest.find((p) => p.includes("@") || p.includes("(at)"))
    const email = emailRaw ? emailRaw.replace("(at)", "@").trim() : null
    const phone = rest.find((p) => p !== emailRaw && /\d/.test(p)) ?? null

    return { name, title: null, phone, email }
  })
}

async function collectHyvinkaaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Hyvinkään kaavarajapinnan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  const allFeatures = Array.isArray(json.features) ? json.features : []

  const features = allFeatures.filter((feature: any) => !feature.properties?.date_legal)

  let saved = 0

  for (const feature of features) {
    const properties = feature.properties ?? {}
    const id = properties.id
    const documentUrl = `https://kartta.hyvinkaa.fi/Applications/sukka/dist/#/viewplan/1/sukka_asemakaava_user/${id}`

    const rawText = JSON.stringify(feature)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: properties.plan_name || `Kaava ${properties.plan_number ?? id}`,
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            hyvinkaa_plan_id: id,
            plan_name: properties.plan_name,
            plan_number: properties.plan_number || null,
            record_number: properties.record_number || null,
            phase: hyvinkaaPhaseLabel(properties.phase_id),
            plan_type: kuopioPlanTypeLabel(properties.plan_type_id),
            description: properties.description || null,
            contacts: parseHyvinkaaContacts(properties.contact),
            center: boundingBoxCenter(feature.geometry),
            original: feature,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: features.length,
    documentsSaved: saved,
  }
}

/*
 * Seinäjoen "ajankohtaiset asemakaavat" -sivun navigointipalkki listaa
 * KAIKKI alasivut, myös jo vuosia sitten lainvoimaiset kaavat — vaihe
 * selviää vain jokaisen kaavan omalta sivulta ("Käsittelyvaiheet:"
 * -otsikon jälkeinen <ul>-lista, viimeinen päivätty rivi on nykyinen
 * vaihe), joten sama rate-limitoitu yksityiskohtahaku-malli kuin
 * Lahdella/Tampereella. Tunnus on otsikon lopussa suluissa, esim.
 * "Alakylä, korttelit 19 (osa) ja 118, Valion alue (09036)".
 */
const SEINAJOKI_MAX_DETAIL_FETCHES_PER_RUN = 8

type SeinajokiDetails = {
  completed: boolean
  phase: string | null
  description: string | null
}

async function fetchSeinajokiDetails(url: string): Promise<SeinajokiDetails> {
  const empty: SeinajokiDetails = { completed: false, phase: null, description: null }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    /*
     * H1 ei ole kuvaustekstin suora sisarelementti (kääritty omaan
     * div-säiliöönsä), joten kuvaus haetaan dokumenttijärjestyksessä
     * ensimmäisenä <p>-elementtinä H1:n jälkeen, ei sisaruksena. Haku on
     * rajattava <article>-elementtiin, koska muuten se voi jatkua sivun
     * <aside>-sivupalkkiin (esim. "Tästä pääset kaavoituskatsauksen 3d
     * kaupunkimalliin" -linkki), joka ei liity kyseiseen kaavaan mitenkään.
     */
    let description: string | null = null
    let sawH1 = false
    $("article *").each((_, el) => {
      if (description) return
      const $el = $(el)
      if ($el.is("h1")) {
        sawH1 = true
        return
      }
      if (sawH1 && $el.is("p")) {
        const text = $el.text().trim()
        if (text) description = text
      }
    })

    const stages: string[] = []
    $("h1.wp-block-heading, h2.wp-block-heading, h3.wp-block-heading, h4.wp-block-heading, h5.wp-block-heading, h6.wp-block-heading").each((_, el) => {
      if (!$(el).text().trim().startsWith("Käsittelyvaiheet")) return
      const $next = $(el).next()

      if ($next.is("ul.wp-block-list")) {
        $next.find("li").each((_, li) => {
          const text = $(li).text().replace(/\s+/g, " ").trim()
          if (text) stages.push(text)
        })
      } else if ($next.is("p")) {
        /*
         * Osalla sivuista käsittelyvaiheet eivät ole <ul><li>-listana vaan
         * yhtenä <p>-elementtinä <br>-erotettuna (esim. Falanderinkadun jatke).
         */
        const fragments = ($next.html() ?? "").split(/<br\s*\/?>/i)
        for (const fragment of fragments) {
          const text = cheerio
            .load(`<div>${fragment}</div>`)("div")
            .text()
            .replace(/\s+/g, " ")
            .trim()
          if (text) stages.push(text)
        }
      }
    })

    /*
     * Käsittelyvaiheet-lista sisältää KAIKKI vaiheet mallipohjana etukäteen,
     * myös ne jotka eivät ole vielä tapahtuneet — vain toteutuneilla vaiheilla
     * on päivämäärä edessä. Siksi viimeinen listan alkio ei kelpaa sellaisenaan,
     * vaan täytyy ottaa viimeinen PÄIVÄTTY vaihe.
     */
    const datedStages = stages.filter((stage) => /^\d/.test(stage))
    const lastStage = datedStages[datedStages.length - 1] ?? null
    const phase = lastStage ? lastStage.replace(/^[\d.\s–-]+/, "").trim() : null
    const completed = /voimaantulopäivä|lainvoimaisuuspäivä|lainvoimaisuuskuulutus|lopetettu|kumonnut/i.test(lastStage ?? "")

    /*
     * Osalla sivuista ei ole lainkaan varsinaista kuvaustekstiä artikkelin
     * rungossa — silloin koko Käsittelyvaiheet-lista kelpaa kuvaukseksi,
     * koska se on ainoa hankekohtainen sisältö sivulla.
     */
    if (!description && stages.length > 0) {
      description = `Käsittelyvaiheet:\n${stages.map((s) => `• ${s}`).join("\n")}`
    }

    return { completed, phase: phase || null, description }
  } catch {
    return empty
  }
}

async function collectSeinajokiSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Seinäjoen kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: { title: string; tunnus: string | null; url: string }[] = []
  const seenUrls = new Set<string>()

  $("a.page-nav-lvl-4__link").each((_, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().trim()
    if (!href || !text) return
    /*
     * page-nav-lvl-4__link on koko sivuston vasemman navigaation luokka,
     * ei tälle sivulle rajattu — täytyy suodattaa href:n polulla, muuten
     * mukaan tulee koko sivuston valikko (eläinlääkärit, elintarvikevalvonta jne).
     */
    if (!href.includes("/ajankohtaiset-asemakaavat/")) return
    if (href.endsWith("/ajankohtaiset-asemakaavat/")) return
    if (seenUrls.has(href)) return
    seenUrls.add(href)

    const match = text.match(/^(.*?)\s*\(([\w.:-]+)\)\s*$/)
    const title = match ? match[1].trim() : text
    const tunnus = match ? match[2].trim() : null

    items.push({ title, tunnus, url: href })
  })

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, SeinajokiDetails>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.phase) {
      knownDetails.set(row.document_url, {
        completed: row.raw_payload.completed ?? false,
        phase: row.raw_payload.phase,
        description: row.raw_payload.description ?? null,
      })
    }
  }

  let detailFetches = 0
  let saved = 0

  for (const item of items) {
    let details = knownDetails.get(item.url) ?? null

    if (!details && detailFetches < SEINAJOKI_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchSeinajokiDetails(item.url)
      detailFetches += 1
    }

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: item.tunnus,
            phase: details?.phase ?? null,
            description: details?.description ?? null,
            completed: details?.completed ?? false,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(details?.completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Rovaniemen "Kaavatori" on RSS-syötteenä saatava kaavaportaali. Toisin
 * kuin Seinäjoella, "Uusin vaihe" -kenttä EI koskaan näytä valmistunutta
 * lopputilaa (voimaantulo) — vaikuttaa siltä että lainvoimaiset kaavat
 * poistuvat Kaavatorista kokonaan eivätkä vain jää viimeiseksi vaiheeksi.
 * Sen sijaan osa listatuista kaavoista on vuosikymmenen takaa eikä niiden
 * vaihetta ole koskaan päivitetty (todennäköisesti hylätty/jäissä).
 * Koska selkeää valmistumismerkkiä ei ole, käytetään "Uusin vaihe"
 * -tekstistä poimittua viimeisintä vuosilukua: jos se on yli kaksi vuotta
 * vanha, kaava merkitään jäätyneeksi ("stale") eikä siitä luoda kandidaattia.
 */
const ROVANIEMI_MAX_DETAIL_FETCHES_PER_RUN = 8
const ROVANIEMI_STALE_YEARS = 2

type RovaniemiContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

type RovaniemiDetails = {
  address: string | null
  phase: string | null
  decisionNumber: string | null
  processingSteps: string | null
  contact: RovaniemiContact | null
  stale: boolean
}

function rovaniemiExtractLastYear(text: string): number | null {
  const matches = text.match(/\d{4}/g)
  if (!matches || matches.length === 0) return null
  return parseInt(matches[matches.length - 1], 10)
}

function parseRovaniemiContact(text: string | null): RovaniemiContact | null {
  if (!text) return null

  const withoutPrefix = text.replace(/^Lisätietoja\s*:?\s*/i, "")

  const emailMatch = withoutPrefix.match(/[\w.+-]+@[\w.-]+\.\w+/)
  const email = emailMatch ? emailMatch[0] : null
  const withoutEmail = email ? withoutPrefix.replace(email, "") : withoutPrefix

  const phoneMatch = withoutEmail.match(/puh\.?\s*([\d\s,()+-]+)/i)
  const phone = phoneMatch ? phoneMatch[1].trim().replace(/[,.]+$/, "").replace(/\s+/g, " ") : null
  const withoutPhone = phoneMatch ? withoutEmail.replace(phoneMatch[0], "") : withoutEmail

  const cleaned = withoutPhone.replace(/[,.]+$/, "").trim()
  const words = cleaned.split(/\s+/).filter(Boolean)
  const name = words.length >= 2 ? words.slice(-2).join(" ") : cleaned || null
  const title = words.length > 2 ? words.slice(0, -2).join(" ") : null

  if (!name && !phone && !email) return null

  return { name, title, phone, email }
}

async function fetchRovaniemiDetails(url: string): Promise<RovaniemiDetails> {
  const empty: RovaniemiDetails = {
    address: null,
    phase: null,
    decisionNumber: null,
    processingSteps: null,
    contact: null,
    stale: false,
  }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    let address: string | null = null
    let phase: string | null = null

    $("h3").each((_, el) => {
      const text = $(el).text().trim()
      if (text.includes("Sijainti")) {
        address = $(el).next().text().replace(/\s+/g, " ").trim() || null
      }
      if (text.includes("Uusin vaihe")) {
        phase = $(el).next().text().replace(/\s+/g, " ").trim() || null
      }
    })

    let decisionNumber: string | null = null
    let processingSteps: string | null = null
    let contact: RovaniemiContact | null = null

    $("span.label").each((_, el) => {
      const label = $(el).text().trim()

      if (label === "Päätösnumero") {
        decisionNumber = $(el).next().text().trim() || null
      }

      /*
       * "Käsittelyvaiheet" on span.label, jonka jälkeen seuraava sisarus
       * (div) sisältää sekä varsinaiset käsittelyvaiheet että usein myös
       * "Lisätietoja: ..." yhteystietokappaleen samassa säiliössä.
       */
      if (label === "Käsittelyvaiheet") {
        const paragraphs = $(el)
          .next()
          .find("p")
          .toArray()
          .map((p) => $(p).text().replace(/\s+/g, " ").trim())
          .filter(Boolean)

        const contactParagraph = paragraphs.find((p) => /^Lisätietoja/i.test(p)) ?? null
        const stepParagraphs = paragraphs.filter((p) => p !== contactParagraph)

        processingSteps = stepParagraphs.join(" ") || null
        contact = parseRovaniemiContact(contactParagraph)
      }
    })

    const lastYear = phase ? rovaniemiExtractLastYear(phase) : null
    const currentYear = new Date().getFullYear()
    const stale = lastYear !== null && lastYear <= currentYear - ROVANIEMI_STALE_YEARS

    return { address, phase, decisionNumber, processingSteps, contact, stale }
  } catch {
    return empty
  }
}

function stripHtmlToText(html: string): string {
  return cheerio
    .load(`<div>${html}</div>`)("div")
    .text()
    .replace(/\s+/g, " ")
    .trim()
}

async function collectRovaniemiSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Rovaniemen Kaavatori-syötteen haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const xml = await response.text()
  const $rss = cheerio.load(xml, { xmlMode: true })

  const items: { title: string; description: string | null; url: string; guid: string }[] = []

  $rss("item").each((_, el) => {
    const title = $rss(el).find("title").text().trim()
    const link = $rss(el).find("link").text().trim()
    const guid = $rss(el).find("guid").text().trim()
    const descriptionHtml = $rss(el).find("description").text()

    if (!title || !link || !guid) return

    items.push({
      title,
      description: descriptionHtml ? stripHtmlToText(descriptionHtml) : null,
      url: link,
      guid,
    })
  })

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, RovaniemiDetails>()
  for (const row of existingRows ?? []) {
    // processingSteps/contact lisättiin myöhemmin — vanhat rivit haetaan
    // siis uudelleen kunnes nekin sisältävät nämä kentät.
    if (row.raw_payload?.phase && row.raw_payload?.processing_steps !== undefined) {
      knownDetails.set(row.document_url, {
        address: row.raw_payload.address ?? null,
        phase: row.raw_payload.phase,
        decisionNumber: row.raw_payload.decision_number ?? null,
        processingSteps: row.raw_payload.processing_steps ?? null,
        contact: row.raw_payload.contact ?? null,
        stale: row.raw_payload.stale ?? false,
      })
    }
  }

  let detailFetches = 0
  let saved = 0

  for (const item of items) {
    let details = knownDetails.get(item.url) ?? null

    if (!details && detailFetches < ROVANIEMI_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchRovaniemiDetails(item.url)
      detailFetches += 1
    }

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: item.guid,
            address: details?.address ?? null,
            phase: details?.phase ?? null,
            decision_number: details?.decisionNumber ?? null,
            processing_steps: details?.processingSteps ?? null,
            contact: details?.contact ?? null,
            stale: details?.stale ?? false,
            description: item.description,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(details?.stale
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Mikkelin "Vireillä ja nähtävillä olevat kaavat" -sivu listaa WordPress-
 * alisivuina VAIN sillä hetkellä aktiiviset kaavat (WP REST API:n parent-
 * suodatus rajaa tarkasti tämän sivun lapsisivuihin, ei koko sivuston
 * navigaatioon kuten Seinäjoella) — joten erillistä valmistumis-/
 * jäätymistunnistusta ei tarvita, listalla olo itsessään merkitsee
 * aktiivisuutta. Kenttäotsikot (TUNNISTETIEDOT/TAVOITE/SUUNNITTELUN
 * VAIHEET) vaihtelevat kirjoitusasultaan sivujen välillä (esim.
 * "TAVOITE" vs. "TAVOITTEET", "MliDNRO" vs. "MliDnro"), joten haku
 * tehdään case-insensitiivisesti koko sivun <p>-elementeistä eikä
 * luoteta kiinteään HTML-rakenteeseen.
 */
const MIKKELI_MAX_DETAIL_FETCHES_PER_RUN = 8

type MikkeliContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

type MikkeliDetails = {
  kaavaTunnus: string | null
  decisionNumber: string | null
  phase: string | null
  description: string | null
  contact: MikkeliContact | null
}

function parseMikkeliContact(text: string | null): MikkeliContact | null {
  if (!text || !text.trim()) return null

  const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/)
  const emailRaw = emailMatch ? emailMatch[0] : null
  // "etunimi.sukunimi@..." on täyttämätön lomakepohja, ei oikea osoite.
  const placeholderMatch = emailRaw ? emailRaw.match(/^etunimi\.sukunimi(@.+)$/i) : null
  const email = emailRaw && !placeholderMatch ? emailRaw : null
  const withoutEmail = emailRaw ? text.replace(emailRaw, "") : text

  const phoneMatch = withoutEmail.match(/\d[\d\s]{6,}\d/)
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, " ").trim() : null
  const withoutPhone = phone ? withoutEmail.replace(phoneMatch![0], "") : withoutEmail

  /*
   * Yhteyshenkilön muoto vaihtelee sivuittain ("Nimi puhelin, sähköposti"
   * vs. "Titteli Nimi, p. puhelin. sähköposti"), joten puhelin/sähköposti
   * poistetaan ensin osoitteesta ja jäljelle jäävä teksti siivotaan
   * kaikista pilkuista/pisteistä/"p."-lyhenteestä ennen sanajakoa —
   * muuten irralliset välimerkit päätyvät virheellisesti nimen tilalle.
   */
  const cleaned = withoutPhone
    .replace(/\bp(uh)?\.?\s*/gi, " ")
    .replace(/[,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  const words = cleaned.split(/\s+/).filter(Boolean)
  const name = words.length >= 2 ? words.slice(-2).join(" ") : cleaned || null
  const title = words.length > 2 ? words.slice(0, -2).join(" ") : null

  /*
   * Lomakepohjan domain-osa ("@mikkeli.fi") on aito, vain etunimi.sukunimi
   * on täyttämätön — nimestä voi siis päätellä todellisen osoitteen
   * luotettavasti sivun itsensä kertoman muotoilun mukaisesti.
   */
  const derivedEmail =
    !email && placeholderMatch && name
      ? name
          .toLowerCase()
          .replace(/ä/g, "a")
          .replace(/ö/g, "o")
          .replace(/å/g, "a")
          .split(/\s+/)
          .join(".") + placeholderMatch[1].toLowerCase()
      : null

  if (!name && !phone && !email && !derivedEmail) return null

  return { name, title, phone, email: email ?? derivedEmail }
}

function findMikkeliSection($: cheerio.CheerioAPI, labelPattern: RegExp) {
  let label: any = null
  $("p").each((_, el) => {
    if (label) return
    if (labelPattern.test($(el).text().trim())) label = $(el)
  })
  return label ? $(label).next() : null
}

async function fetchMikkeliDetails(pageId: number): Promise<MikkeliDetails> {
  const empty: MikkeliDetails = { kaavaTunnus: null, decisionNumber: null, phase: null, description: null, contact: null }

  try {
    const response = await fetch(
      `https://mikkeli.fi/wp-json/wp/v2/pages/${pageId}?_fields=id,content`,
      { cache: "no-store" }
    )
    if (!response.ok) return empty

    const data = await response.json()
    const html = data?.content?.rendered
    if (!html) return empty

    const $ = cheerio.load(html)

    let kaavaTunnus: string | null = null
    let decisionNumber: string | null = null
    let contactRaw: string | null = null

    $("li").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (/kaavatunnus/i.test(text)) {
        kaavaTunnus = text.replace(/^.*?kaavatunnus\s*:?\s*/i, "").trim() || null
      } else if (/mlidnro/i.test(text)) {
        decisionNumber = text.replace(/^.*?mlidnro\s*:?\s*/i, "").trim() || null
      } else if (/laatija|yhteyshenkilö/i.test(text)) {
        contactRaw = text.replace(/^.*?(laatija\s*\/\s*yhteyshenkilö|yhteyshenkilö)\s*:?\s*/i, "").trim() || null
      }
    })

    const tavoite = findMikkeliSection($, /^TAVOIT(E|TEET)$/i)
    const description = tavoite ? tavoite.text().replace(/\s+/g, " ").trim() || null : null

    const vaiheetList = findMikkeliSection($, /^SUUNNITTELUN VAIHEET$/i)
    const stages: string[] = []
    vaiheetList?.find("li").each((_, li) => {
      const text = $(li).text().replace(/\s+/g, " ").trim()
      if (text) stages.push(text)
    })
    const phase = stages[stages.length - 1] ?? null

    return {
      kaavaTunnus,
      decisionNumber,
      phase,
      description,
      contact: parseMikkeliContact(contactRaw),
    }
  } catch {
    return empty
  }
}

async function collectMikkeliSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Mikkelin kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const listItems: { id: number; title: string; url: string }[] = await response.json().then((items: any[]) =>
    items.map((item) => ({
      id: item.id,
      title: item.title?.rendered ?? "",
      url: item.link ?? "",
    }))
  )

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, MikkeliDetails>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.phase || row.raw_payload?.kaava_tunnus) {
      knownDetails.set(row.document_url, {
        kaavaTunnus: row.raw_payload.kaava_tunnus ?? null,
        decisionNumber: row.raw_payload.decision_number ?? null,
        phase: row.raw_payload.phase ?? null,
        description: row.raw_payload.description ?? null,
        contact: row.raw_payload.contact ?? null,
      })
    }
  }

  let detailFetches = 0
  let saved = 0

  for (const item of listItems) {
    if (!item.title || !item.url) continue

    let details = knownDetails.get(item.url) ?? null

    if (!details && detailFetches < MIKKELI_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchMikkeliDetails(item.id)
      detailFetches += 1

      // Osa sivuista ei sisällä TUNNISTETIEDOT-listaa lainkaan, mutta
      // kaavatunnus näkyy silti otsikon lopussa suluissa, esim. "(957)".
      if (details && !details.kaavaTunnus) {
        const titleTunnusMatch = item.title.match(/\((\d+)\)\s*$/)
        if (titleTunnusMatch) {
          details = { ...details, kaavaTunnus: titleTunnusMatch[1] }
        }
      }
    }

    /*
     * Osa "nahtavilla-olevat-kaavat"-sivun lapsisivuista on kategoria-
     * indeksejä (esim. "Vireillä olevat yleiskaavat") eikä yksittäisiä
     * kaavoja — jos sivu on faktisesti haettu eikä siitä silti löydy
     * kaavatunnusta (ei listasta eikä otsikosta), se ei ole oikea kaava
     * ja jätetään pysyvästi pois faktojen/tunnistuksen ulkopuolelle.
     */
    const isNonPlanPage = details !== null && !details.kaavaTunnus

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: details?.kaavaTunnus ?? null,
            decision_number: details?.decisionNumber ?? null,
            phase: details?.phase ?? null,
            description: details?.description ?? null,
            contact: details?.contact ?? null,
            is_non_plan_page: isNonPlanPage,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(isNonPlanPage
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: listItems.length,
    documentsSaved: saved,
  }
}

/*
 * Kotkan "Vireillä olevat asemakaavat" -sivu on WP:n lapsisivuina — sama
 * malli kuin Mikkelillä, mutta vielä siistimpi: jokaisen kaavan sivulla
 * on "Asiakirjat ja liitteet" -osiossa käsittelyvaiheiden otsikkoketju,
 * jossa TULEVAT (ei vielä tapahtuneet) vaiheet on tyylitelty harmaaksi
 * (style="color: #808080") — viimeinen EI-harmaa otsikko on siis suoraan
 * nykyinen vaihe, ei tarvitse päätellä päivämääristä kuten Rovaniemellä.
 * Koska sivu listaa vain vireillä olevia (lainvoimaiset ovat omalla
 * erillisellä "lainvoimaiset-asemakaavat"-sivullaan sivuston puolella),
 * erillistä jäätymis-/valmistumistunnistusta ei tarvita — paitsi jos
 * "Kaava lainvoimainen" joskus itse näkyisi ei-harmaana, mikä merkitään
 * silti varmuuden vuoksi valmiiksi.
 */
async function collectKotkaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Kotkan kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const items: any[] = await response.json()

  let saved = 0

  for (const item of items) {
    const title = item.title?.rendered ?? ""
    const url = item.link ?? ""
    const html = item.content?.rendered ?? ""

    if (!title || !url) continue

    const $ = cheerio.load(html)

    let phase: string | null = null
    let description: string | null = null

    const firstP = $("p").first()
    description = firstP.text().replace(/\s+/g, " ").trim() || null

    $("h2, h3, h4").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (!text || text === "Asiakirjat ja liitteet") return

      const style = $(el).attr("style") ?? ""
      const isFuture = /#808080/i.test(style)
      if (!isFuture) phase = text
    })

    const completed = phase !== null && /kaava lainvoimainen/i.test(phase)

    const titleTunnusMatch = title.match(/\((\d+)\)\s*$/)
    const kaavaTunnus = titleTunnusMatch ? titleTunnusMatch[1] : null

    const rawText = JSON.stringify({ title, url, phase, description })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Salon kaavasivut käyttävät ACF-sisältölohkoja (acf.everblox_v1[].columns[].content),
 * ei tavallista content.rendered-kenttää. Käsittelyvaiheet (Hyväksymisvaihe,
 * Ehdotusvaihe, Laatimisvaihe, Aloitusvaihe) on listattu KÄÄNTEISESSÄ
 * aikajärjestyksessä — uusin vaihe ensin, toisin kuin Seinäjoella — joten
 * ensimmäinen <h2> on suoraan nykyinen vaihe. Kaavatunnusta ei ole missään
 * (ei numerosarjaa otsikossa toisin kuin Mikkelillä/Kotkalla), joten WP:n
 * sivu-ID kelpaa yksilöivänä tunnisteena. "Hyväksymisvaihe"-osiossa mainittu
 * "lainvoimainen"/"tullut voimaan" tarkoittaa kaava on jo valmis.
 */
function saloExtractSectionText($: cheerio.CheerioAPI, heading: any): string {
  let text = ""
  let el = $(heading).next()
  while (el.length && !el.is("h2")) {
    text += " " + el.text()
    el = el.next()
  }
  return text
}

/*
 * Yhteystiedot eivät sisälly ACF-bulkkihakuun (relative_contacts viittaa
 * vain sisäiseen ID:hen, ei renderöityyn sisältöön) — ne pitää hakea
 * jokaisen hankkeen omalta sivulta erikseen ".c-contact"-lohkosta, siksi
 * sama rate-limitoitu yksityiskohtahaku-malli kuin Järvenpäällä/Lahdessa.
 */
const SALO_MAX_CONTACT_FETCHES_PER_RUN = 15

async function fetchSaloContacts(url: string) {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return []

    const html = await response.text()
    const $ = cheerio.load(html)

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    $(".c-contact").each((_, el) => {
      const card = $(el)
      const name = card.find(".c-contact__title").first().text().trim() || null
      const contactTitle = card.find(".c-contact__job-title").first().text().trim() || null
      const phoneHref = card.find("a[href^='tel:']").first().attr("href")
      const phone = phoneHref ? phoneHref.replace(/^tel:/, "") : null
      const emailHref = card.find("a[href^='mailto:']").first().attr("href")
      const email = emailHref ? emailHref.replace(/^mailto:/, "") : null
      if (name) contacts.push({ name, title: contactTitle, phone, email })
    })

    return contacts
  } catch {
    return []
  }
}

async function collectSaloSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Salon kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const items: any[] = await response.json()

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownContacts = new Map<string, any[]>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.contacts?.length) {
      knownContacts.set(row.document_url, row.raw_payload.contacts)
    }
  }

  let contactFetches = 0
  let saved = 0

  for (const item of items) {
    const title = item.title?.rendered ?? ""
    const url = item.link ?? ""
    const html = item.acf?.everblox_v1?.[0]?.columns?.[0]?.content ?? ""

    if (!title || !url) continue

    const $ = cheerio.load(html)
    const h2s = $("h2").toArray()

    let phase: string | null = null
    let completed = false

    if (h2s.length > 0) {
      const firstH2 = h2s[0]
      phase = $(firstH2).text().replace(/\s+/g, " ").trim() || null

      const sectionText = saloExtractSectionText($, firstH2)
      completed = /lainvoimainen|tullut voimaan/i.test(sectionText)
    }

    let description: string | null = null
    if (h2s.length > 0) {
      const lastH2 = h2s[h2s.length - 1]
      description =
        $(lastH2)
          .nextAll("p")
          .toArray()
          // OAS/liite-linkkikappaleet sisältävät vain latauslinkin ("c-file"),
          // ei varsinaista kuvaustekstiä, joten ne suodatetaan pois.
          .filter((p) => $(p).find("a.c-file").length === 0)
          .map((p) => $(p).text().replace(/\s+/g, " ").trim())
          .filter(Boolean)
          .join(" ") || null
    }
    if (!description) {
      description = $("p").first().text().replace(/\s+/g, " ").trim() || null
    }

    const kaavaTunnus = item.id ? String(item.id) : null

    let contacts = knownContacts.get(url)
    if (!contacts && contactFetches < SALO_MAX_CONTACT_FETCHES_PER_RUN) {
      contactFetches += 1
      contacts = await fetchSaloContacts(url)
    }
    contacts = contacts ?? []

    const rawText = JSON.stringify({ title, url, phase, description, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Porvoo on kaksikielinen — WP:n sivupuu erottaa suomen- ja ruotsinkieliset
 * sivut kokonaan eri parent-sivujen alle (fi: "Asemakaavat", sv: "Detaljplaner"
 * eri page-ID), joten pelkkä parent-suodatus riittää eikä erillistä
 * kielisuodatusta tarvita. Nykyinen vaihe näkyy suoraan H1:n alla olevassa
 * "hero"-lohkossa (esim. "Asemakaava on tullut voimaan 8.4.2026"),
 * ei tarvitse Käsittelyvaiheet-listaa kuten Seinäjoella.
 */
async function collectPorvooSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Porvoon kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const items: any[] = await response.json()

  let saved = 0

  for (const item of items) {
    const title = item.title?.rendered ?? ""
    const url = item.link ?? ""
    const html = item.content?.rendered ?? ""

    if (!title || !url) continue

    const $ = cheerio.load(html)

    const phase = $(".mt-half-gutter.max-w-prose").first().text().replace(/\s+/g, " ").trim() || null
    const completed = phase !== null && /tullut voimaan|lainvoimainen|saanut lainvoiman/i.test(phase)

    const description =
      $(".prose").first().find("p").first().text().replace(/\s+/g, " ").trim() ||
      $("p").first().text().replace(/\s+/g, " ").trim() ||
      null

    const titleTunnusMatch = title.match(/^(?:AK|DP)\s*([\d/]+)/i)
    const kaavaTunnus = titleTunnusMatch ? titleTunnusMatch[1] : null

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    $(".wp-block-contact-listing .mt-6.flex.flex-wrap > div").each((_, el) => {
      const card = $(el)
      const contactName = card.find("h5").first().text().replace(/\s+/g, " ").trim() || null
      const contactTitle = card.find("p").first().text().replace(/\s+/g, " ").trim() || null
      const phoneHref = card.find("a[href^='tel:']").first().attr("href")
      const phone = phoneHref ? phoneHref.replace(/^tel:/, "") : null
      const emailHref = card.find("a[href^='mailto:']").first().attr("href")
      const email = emailHref ? emailHref.replace(/^mailto:/, "") : null
      if (contactName) contacts.push({ name: contactName, title: contactTitle, phone, email })
    })

    const rawText = JSON.stringify({ title, url, phase, description, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Kokkolassa kaikki käynnissä olevat asemakaavatyöt on listattu YHDELLE
 * sivulle "accordion"-elementteinä (<li class="accordion-row"> sisältää
 * <h3> otsikon ja <div class="accordion-content"> rungon), ei erillisinä
 * alisivuina kuten muualla. Käsittelyvaiheet on vapaamuotoista proosaa
 * ("Käsittelyvaiheet: X. Y. Z.") eikä listaelementtejä, joten viimeinen
 * lause otetaan nykyiseksi vaiheeksi (etenevä aikajärjestys, kuten
 * Hämeenlinnassa). Kaavatunnusta ei ole, joten otsikosta muodostettu
 * slug kelpaa yksilöivänä tunnisteena.
 */
function kokkolaSlugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function collectKokkolaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Kokkolan kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  let saved = 0

  const rows = $("li.accordion-row").toArray()

  for (const row of rows) {
    const $row = $(row)
    const title = $row.find(".accordion-title-text").first().text().replace(/\s+/g, " ").trim()
    if (!title) continue

    const bodyText = $row.find(".accordion-content").text().replace(/\s+/g, " ").trim()

    const kasittelyIdx = bodyText.indexOf("Käsittelyvaiheet:")
    const yhteysIdx = bodyText.indexOf("Yhteyshenkilö:")

    const description = (kasittelyIdx >= 0 ? bodyText.slice(0, kasittelyIdx) : bodyText).trim() || null

    const stagesText =
      kasittelyIdx >= 0
        ? bodyText.slice(kasittelyIdx + "Käsittelyvaiheet:".length, yhteysIdx >= 0 ? yhteysIdx : undefined).trim()
        : null

    const contactName = yhteysIdx >= 0 ? bodyText.slice(yhteysIdx + "Yhteyshenkilö:".length).trim() || null : null

    /*
     * Lyhennetyt päivämääräväli ("2.5. – 1.6.2026") sisältää pisteen ja
     * välilyönnin kesken virkkeen, joten pelkkä ". "-jako pilkkoisi väärin.
     * Oikea virkkeen loppu tunnistetaan siitä, että seuraava sana alkaa
     * isolla kirjaimella (suomenkielinen hallintoproosa aloittaa virkkeet
     * aina isolla, päivämäärät eivät koskaan).
     */
    const sentences = stagesText
      ? stagesText
          .split(/\.\s+(?=[A-ZÄÖÅ])/)
          .map((s) => (s.endsWith(".") ? s : `${s}.`))
          .map((s) => s.trim())
          .filter(Boolean)
      : []
    const phase = sentences[sentences.length - 1] ?? null
    const completed = phase !== null && /lainvoimainen|tullut voimaan/i.test(phase)

    const kaavaTunnus = kokkolaSlugify(title)
    const url = `${source.url}#${kaavaTunnus}`

    const rawText = JSON.stringify({ title, phase, description, contactName })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            contact_name: contactName,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: rows.length,
    documentsSaved: saved,
  }
}

/*
 * Kirkkonummi jakaa kaavat neljälle alueelliselle alisivulle (eteläinen,
 * itäinen, keskinen, pohjoinen Kirkkonummi) — jokaisen kaavan sivulla on
 * suoraan "Tilanne: {vaihe} ({pvm})" -kenttä, mutta se ei aina ole sivun
 * ensimmäinen kappale (osalla sivuista on ensin otsikkokappale), joten
 * kaikki <p>-elementit käydään läpi eikä luoteta ensimmäiseen. Valmis-
 * tumissanasto vaihtelee taivutusmuodoittain (lainvoimainen,
 * lainvoimaiseksi, lainvoiman) — tunnistus tehdään sanavartaloa vasten.
 */
const KIRKKONUMMI_REGION_PARENT_IDS = [19717, 19715, 19697, 19719]

async function collectKirkkonummiSource(source: DiscoverySource) {
  const allItems: { id: number; title: string; url: string; html: string }[] = []

  for (const parentId of KIRKKONUMMI_REGION_PARENT_IDS) {
    const listUrl = `https://kirkkonummi.fi/wp-json/wp/v2/pages?parent=${parentId}&per_page=100&_fields=id,title,link,content`
    const response = await fetch(listUrl, { cache: "no-store" })

    if (!response.ok) {
      throw new Error(`Kirkkonummen kaavalistan haku epäonnistui (${parentId}): ${response.status} ${response.statusText}`)
    }

    const items: any[] = await response.json()
    for (const item of items) {
      allItems.push({
        id: item.id,
        title: item.title?.rendered ?? "",
        url: item.link ?? "",
        html: item.content?.rendered ?? "",
      })
    }
  }

  let saved = 0

  for (const item of allItems) {
    if (!item.title || !item.url) continue

    const $ = cheerio.load(item.html)

    let phase: string | null = null
    $("p").each((_, el) => {
      if (phase) return
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (text.startsWith("Tilanne:")) {
        phase = text.replace(/^Tilanne:\s*/, "").trim() || null
      }
    })

    let description: string | null = null
    $("p").each((_, el) => {
      if (description) return
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (text.length > 60 && !text.startsWith("Tilanne:")) {
        description = text
      }
    })

    const completed = phase !== null && /lainvoima|tullut voimaan|voimaantulo/i.test(phase)

    const kaavaTunnus = String(item.id)

    const rawText = JSON.stringify({ title: item.title, url: item.url, phase, description })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: allItems.length,
    documentsSaved: saved,
  }
}

/*
 * Keravan sivusto käyttää mukautettua "project"-artikkelityyppiä
 * kaavoitus-taksonomialla (project-type-tax=116 "Kaava") ja siistiä
 * phase-tax-taksonomiaa vaiheelle — ei tarvitse tekstipäättelyä.
 * Node.js:n fetch (undici) törmää ajoittain palvelimen esto-/WAF-
 * käytäntöön (satunnaisia HTTP 500 -vastauksia), vaikka sama pyyntö
 * curlilla onnistuu aina — siksi jokainen pyyntö tehdään uudelleen-
 * yrityksellä ja selaimen kaltaisella User-Agentilla.
 */
const KERAVA_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
}

const KERAVA_PHASE_TAX_NAMES: Record<number, string> = {
  130: "Aloitusvaihe",
  112: "Ehdotus",
  134: "Ehdotusvaihe",
  124: "Hyväksyminen",
  136: "Hyväksymisvaihe",
  126: "Luonnos",
  132: "Luonnosvaihe",
  140: "Rakentaminen",
  128: "Suunnittelu",
  142: "Valmis",
  138: "Voimaantulo",
}

const KERAVA_MAX_DETAIL_FETCHES_PER_RUN = 8

/*
 * Node.js:n fetch (undici) törmää järjestelmällisesti Keravan sivuston
 * esto-/WAF-käytäntöön (aina HTTP 500), vaikka identtinen pyyntö onnistuu
 * aina curlilla ja Node.js:n perinteisellä https-moduulilla — kyse on siis
 * undicin TLS-/HTTP-sormenjäljen torjunnasta, ei satunnaisesta kuormasta,
 * joten pelkkä fetch-uudelleenyritys ei riitä. Siksi Kerava käyttää https-
 * moduulia suoraan fetchin sijaan.
 */
function keravaHttpsGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: KERAVA_FETCH_HEADERS }, (res) => {
        let body = ""
        res.on("data", (chunk) => (body += chunk))
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }))
      })
      .on("error", reject)
  })
}

async function fetchKeravaJson(url: string, attempts = 4): Promise<any> {
  let lastError: unknown = null

  for (let i = 0; i < attempts; i++) {
    try {
      const { status, body } = await keravaHttpsGet(url)
      if (status === 200) {
        return JSON.parse(body)
      }
      lastError = new Error(`HTTP ${status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 400 + i * 200))
  }

  throw lastError instanceof Error ? lastError : new Error("Keravan haku epäonnistui")
}

async function collectKeravaSource(source: DiscoverySource) {
  const listItems: any[] = await fetchKeravaJson(
    "https://www.kerava.fi/wp-json/wp/v2/project?project-type-tax=116&per_page=100&_fields=id,title,link,phase-tax"
  )

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDescriptions = new Map<string, string | null>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description_fetched) {
      knownDescriptions.set(row.document_url, row.raw_payload.description ?? null)
    }
  }

  let detailFetches = 0
  let saved = 0

  for (const item of listItems) {
    const title = item.title?.rendered ?? ""
    const url = item.link ?? ""
    if (!title || !url) continue

    const phaseIds: number[] = item["phase-tax"] ?? []
    const phase = phaseIds.map((id) => KERAVA_PHASE_TAX_NAMES[id]).filter(Boolean).join(", ") || null
    const completed = phaseIds.some((id) => KERAVA_PHASE_TAX_NAMES[id] === "Valmis" || KERAVA_PHASE_TAX_NAMES[id] === "Voimaantulo")

    const titleTunnusMatch = title.match(/\(([\w-]+)\)\s*$/)
    const kaavaTunnus = titleTunnusMatch ? titleTunnusMatch[1] : null

    let description: string | null = null
    let descriptionFetched = knownDescriptions.has(url)

    if (descriptionFetched) {
      description = knownDescriptions.get(url) ?? null
    } else if (detailFetches < KERAVA_MAX_DETAIL_FETCHES_PER_RUN) {
      try {
        const detail = await fetchKeravaJson(
          `https://www.kerava.fi/wp-json/wp/v2/project/${item.id}?_fields=content`
        )
        const $ = cheerio.load(detail?.content?.rendered ?? "")
        description = $("p").first().text().replace(/\s+/g, " ").trim() || null
        descriptionFetched = true
      } catch {
        // jätetään yrittämättä uudelleen seuraavalla ajolla
      }
      detailFetches += 1
    }

    const rawText = JSON.stringify({ title, url, phase, description })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            description_fetched: descriptionFetched,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: listItems.length,
    documentsSaved: saved,
  }
}

/*
 * Tuusula käyttää samaa Trimble/Tekla "sukka"-GIS-taustajärjestelmää kuin
 * Kuopio ja Hyvinkää (kartta.tuusula.fi, layer "sukka_asemakaava_user",
 * koordinaatit GK25). Toisin kuin Hyvinkäällä, phase_id ei ole luotettava
 * nykyisen vaiheen indikaattori täällä (esim. phase_id=6 esiintyy sekä
 * vireillä että jo lainvoimaisilla kaavoilla) — description-kenttä on
 * sen sijaan kronologinen kertomus, joten nykyinen vaihe poimitaan sen
 * viimeisenä virkkeenä. date_legal-kentän olemassaolo on ainoa luotettava
 * valmistumismerkki, joten sitä käytetään poissulkuun (kuten Hyvinkäällä).
 */
/*
 * Kuvausteksti sisältää usein loppuun asti tavoite- tai ohjeistus-
 * lauseita ("Voit jättää mielipiteen...") varsinaisen tilannepäivityksen
 * jälkeen, joten pelkkä viimeinen virke ei riitä — nykyinen vaihe on
 * viimeinen virke joka sisältää päivämäärän, koska aidot tilanne-
 * päivitykset ovat lähes aina päivättyjä ("hyväksytty valtuustossa
 * 29.5.2017"), toisin kuin tavoite-/ohjeistuslauseet.
 */
function tuusulaExtractLastSentence(description: string | null): string | null {
  if (!description) return null

  const cleaned = description.replace(/\s+/g, " ").trim()
  if (!cleaned) return null

  const sentences = cleaned
    .split(/\.\s+(?=[A-ZÄÖÅ])/)
    .map((s) => (s.endsWith(".") ? s : `${s}.`))
    .map((s) => s.trim())
    .filter(Boolean)

  const datePattern = /\d{1,2}\.\d{1,2}\.(?:\d{2,4})?/
  const datedSentences = sentences.filter((s) => datePattern.test(s))

  return datedSentences[datedSentences.length - 1] ?? sentences[sentences.length - 1] ?? null
}

async function collectTuusulaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Tuusulan kaavarajapinnan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()
  const features = Array.isArray(json.features) ? json.features : []

  let saved = 0

  for (const feature of features) {
    const properties = feature.properties ?? {}
    const id = properties.id
    const documentUrl = `https://kartta.tuusula.fi/Applications/sukka/dist/#/viewplan/1/sukka_asemakaava_user/${id}`

    const planName = properties.plan_name ? String(properties.plan_name).trim() : null
    const recordNumber = properties.record_number ? String(properties.record_number).trim() : null
    const description = properties.description ?? null
    const phase = tuusulaExtractLastSentence(description)
    const completed = !!properties.date_legal
    const center = boundingBoxCenter(feature.geometry)

    const rawText = JSON.stringify(feature)
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: planName ?? `Kaava ${recordNumber ?? id}`,
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            plan_name: planName,
            record_number: recordNumber,
            phase,
            description,
            contact: properties.contact ?? null,
            center,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: features.length,
    documentsSaved: saved,
  }
}

/*
 * Nurmijärven "Ajankohtaiset asemakaavat" -sivu listaa WordPress-
 * alisivuina VAIN aktiiviset kaavat (valmistuneet ovat omalla erillisellä
 * "Voimaan tulleet asemakaavat" -sivullaan), joten valmistumistunnistusta
 * ei periaatteessa tarvita — mutta tehdään silti varmuuden vuoksi samalla
 * tavalla kuin Kotkalla. Käsittelyvaiheet on käänteisessä aikajärjestyksessä
 * (uusin ensin, kuten Salolla), joten ensimmäinen <li> on nykyinen vaihe.
 * Kaavatunnus on suoraan otsikon alussa, esim. "6-027 Herontie 1".
 */
async function collectNurmijarviSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Nurmijärven kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const items: any[] = await response.json()

  let saved = 0

  for (const item of items) {
    const title = item.title?.rendered ?? ""
    const url = item.link ?? ""
    const html = item.content?.rendered ?? ""

    if (!title || !url) continue

    const $ = cheerio.load(html)

    const phase = $("ul.wp-block-list li").first().text().replace(/\s+/g, " ").trim() || null
    const completed = phase !== null && /lainvoima|tullut voimaan|voimaantulo/i.test(phase)

    const description =
      $("p")
        .toArray()
        .map((el) => $(el).text().replace(/\s+/g, " ").trim())
        .find((text) => text.length > 40) ?? null

    const titleTunnusMatch = title.match(/^(\d+-\d+)\s+/)
    const kaavaTunnus = titleTunnusMatch ? titleTunnusMatch[1] : null

    const rawText = JSON.stringify({ title, url, phase, description })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Sipoon "Vireillä olevat asemakaavat" -sivun alisivuilla on VÄHINTÄÄN
 * neljä erilaista pohjarakennetta nykyisen vaiheen ilmoittamiseen (otsikko
 * "Tässä mennään nyt"/"Tässä ollaan nyt"/"Missä mennään nyt?", eri
 * otsikkotasoilla, joskus "Aikaisemmat vaiheet" -välikerroksen takana).
 * Siksi haetaan ankkuriotsikon jälkeen ENSIMMÄINEN tunnettu vaihesana
 * (Aloitusvaihe/Valmisteluvaihe/jne.) mistä tahansa myöhemmästä otsikosta,
 * ja jos mikään ei täsmää, otetaan varalta ankkuria seuraava otsikko
 * sellaisenaan (esim. vapaamuotoinen tilannekuvaus).
 */
const SIPOO_PHASE_ANCHOR = /^(Tässä|Missä) (mennään|ollaan) nyt\??$/i
const SIPOO_PHASE_WORD =
  /^(Aloitusvaihe|Valmisteluvaihe|Luonnosvaihe|Ehdotusvaihe|Hyväksymisvaihe|Hyväksyminen|Voimaantulo|Lainvoimainen|Asemakaavatyön keskeyttäminen)$/i

async function collectSipooSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Sipoon kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const items: any[] = await response.json()

  let saved = 0

  for (const item of items) {
    const title = item.title?.rendered ?? ""
    const url = item.link ?? ""
    const html = item.content?.rendered ?? ""

    if (!title || !url) continue

    const $ = cheerio.load(html)

    let foundAnchor = false
    let phase: string | null = null
    let fallback: string | null = null

    $("h1, h2, h3, h4, h5, h6").each((_, el) => {
      if (phase) return
      const text = $(el).text().replace(/\s+/g, " ").trim()

      if (!foundAnchor) {
        if (SIPOO_PHASE_ANCHOR.test(text)) foundAnchor = true
        return
      }

      if (!fallback) fallback = text
      if (SIPOO_PHASE_WORD.test(text)) phase = text
    })

    const finalPhase = phase ?? fallback
    const completed = finalPhase !== null && /lainvoima|tullut voimaan|voimaantulo/i.test(finalPhase)

    const description =
      $(".summary-content p")
        .toArray()
        .map((el) => $(el).text().replace(/\s+/g, " ").trim())
        .find((text) => text.length > 20) ?? null

    const titleTunnusMatch = title.match(/^([A-ZÄÖÅ]+\s?\d+[A-ZÄÖÅ]*)\s+/)
    const kaavaTunnus = titleTunnusMatch ? titleTunnusMatch[1].trim() : null

    const rawText = JSON.stringify({ title, url, phase: finalPhase, description })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase: finalPhase,
            description,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Järvenpään sivusto on staattisesti generoitu headless-WordPress +
 * Next.js -sivusto (ei live-GraphQL-rajapintaa julkisesti saatavilla,
 * CloudFront estää POST-pyynnöt) — sisältö haetaan siis tavallisella
 * palvelinpuolen renderöidyllä HTML:llä, aivan kuten muillakin
 * WordPress-lähteillä. Nykyinen vaihe ilmaistaan KUVABADGEINA (esim.
 * ".../valmistelu.png"), ei tekstinä — badget on käänteisessä
 * aikajärjestyksessä (uusin ensin), joten ensimmäinen badge on nykyinen
 * vaihe. "lainvoima"-badge ensimmäisenä tarkoittaa kaavan olevan jo
 * lainvoimainen, vaikka se näkyy "Vireillä olevat asemakaavat" -sivulla.
 */
const JARVENPAA_PHASE_LABELS: Record<string, string> = {
  aloitus: "Aloitusvaihe",
  valmistelu: "Valmisteluvaihe",
  luonnos: "Luonnosvaihe",
  ehdotus: "Ehdotusvaihe",
  hyvaksyminen: "Hyväksymisvaihe",
  voimaantulo: "Voimaantulo",
  lainvoima: "Lainvoimainen",
}

const JARVENPAA_MAX_DETAIL_FETCHES_PER_RUN = 10

async function collectJarvenpaaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Järvenpään kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const $list = cheerio.load(html)

  const items: { title: string; url: string }[] = []
  const seenUrls = new Set<string>()

  $list("a").each((_, el) => {
    const href = $list(el).attr("href")
    const text = $list(el).text().trim()
    if (!href || !text) return
    if (!href.includes("/vireilla-olevat-asemakaavat/")) return
    if (href.endsWith("/vireilla-olevat-asemakaavat")) return

    const absoluteUrl = href.startsWith("http") ? href : `https://www.jarvenpaa.fi${href}`
    if (seenUrls.has(absoluteUrl)) return
    seenUrls.add(absoluteUrl)

    items.push({ title: text, url: absoluteUrl })
  })

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.phase || row.raw_payload?.kaava_tunnus) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let detailFetches = 0
  let saved = 0

  for (const item of items) {
    const known = knownDetails.get(item.url)

    if (known) {
      const rawText = JSON.stringify({ item, ...known })
      const contentHash = hashContent(rawText)

      const { error } = await supabaseAdmin
        .from("source_documents")
        .upsert(
          {
            source_id: source.id,
            source_name: source.name,
            title: item.title,
            document_url: item.url,
            document_type: "api",
            content_hash: contentHash,
            status: "downloaded",
            raw_text: rawText,
            raw_payload: known,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(known.completed
              ? {
                  facts_extracted_at: new Date().toISOString(),
                  identity_resolved_at: new Date().toISOString(),
                }
              : {}),
          },
          { onConflict: "document_url" }
        )

      if (error) throw error
      saved += 1
      continue
    }

    if (detailFetches >= JARVENPAA_MAX_DETAIL_FETCHES_PER_RUN) continue
    detailFetches += 1

    const detailResponse = await fetch(item.url, { cache: "no-store" })
    if (!detailResponse.ok) continue

    const detailHtml = await detailResponse.text()
    const $ = cheerio.load(detailHtml)
    $("style, script").remove()

    const description =
      $("p")
        .toArray()
        .map((el) => $(el).text().replace(/\s+/g, " ").trim())
        // Murupolku ("Etusivu/.../Sivun nimi") renderöityy myös <p>-elementiksi
        // ja on usein yli 60 merkkiä pitkä, joten se pitää suodattaa erikseen.
        .find((text) => text.length > 60 && !text.startsWith("Etusivu/")) ?? null

    let decisionNumber: string | null = null
    let kaavaTunnus: string | null = null
    $("p").each((_, el) => {
      if (kaavaTunnus) return
      const html = $(el).html() ?? ""
      if (!/Kaavatunnus/i.test(html)) return
      const lines = html
        .split(/<br\s*\/?>/i)
        .map((l) => $.load(`<div>${l}</div>`)("div").text().trim())
        .filter(Boolean)
      const tunnusLine = lines.find((l) => /Kaavatunnus/i.test(l))
      kaavaTunnus = tunnusLine ? tunnusLine.replace(/^.*Kaavatunnus\s*:?\s*/i, "").trim() || null : null
      const otherLine = lines.find((l) => l !== tunnusLine)
      decisionNumber = otherLine || null
    })

    const phaseBadges: string[] = []
    $("img[src*='.png']").each((_, el) => {
      const src = $(el).attr("src") ?? ""
      const match = src.match(/\/([a-z]+)\.png/i)
      if (match && JARVENPAA_PHASE_LABELS[match[1].toLowerCase()]) {
        phaseBadges.push(match[1].toLowerCase())
      }
    })
    const currentPhaseKey = phaseBadges[0] ?? null
    const phase = currentPhaseKey ? JARVENPAA_PHASE_LABELS[currentPhaseKey] : null
    const completed = currentPhaseKey === "lainvoima"

    const addressMatch = description?.match(/osoitteessa\s+([^.,]+)/i)
    const address = addressMatch ? addressMatch[1].trim() : null

    const contactTitle = $(".ContactWrapper__ContactTitle").first().text().trim() || null
    const contactName = $(".ContactWrapper__Name").first().text().trim() || null
    const contactEmail = $(".ContactWrapper__Email").first().text().trim() || null
    const contactPhone = $(".ContactWrapper__Phone").first().text().trim() || null
    const contacts =
      contactName || contactEmail || contactPhone
        ? [{ name: contactName, title: contactTitle, phone: contactPhone, email: contactEmail }]
        : []

    const rawText = JSON.stringify({ item, decisionNumber, kaavaTunnus, phase, description, address, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: kaavaTunnus,
            decision_number: decisionNumber,
            phase,
            address,
            description,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Puolustuskiinteistöjen uutiset/artikkelit-sivu (eri sisältövirta kuin
 * senaatti_project-hankelistaus — ei siis päällekkäistä) renderöityy
 * admin-ajax.php-kutsulla (action=senaatti_defense_news_with_filters,
 * s_page=N), joka palauttaa HTML-fragmentin JSON:n "data"-kentässä. Listaus
 * sisältää sekä yksittäisiä rakennushankkeita että yleisiä tiedotteita
 * (tilinpäätökset, asiakastyytyväisyys), joten otsikko+ingressi
 * suodatetaan avainsanoilla ennen kuin hankkeen omalta sivulta haetaan
 * koko kuvaus (rate-limitoitu kuten Järvenpäällä/Lahdessa).
 */
const PUOLUSTUSKIINTEISTOT_MAX_DETAIL_FETCHES_PER_RUN = 15
const PUOLUSTUSKIINTEISTOT_MAX_LIST_PAGES = 20

const PUOLUSTUSKIINTEISTOT_INCLUDE_KEYWORDS = [
  "peruskorja",
  "rakennu",
  "rakenneta",
  "rakennuttaa",
  "rakentaminen",
  "korjataan",
  "puretaan",
  "purku",
  "harjakorkeu",
  "käyttöönot",
  "kunnostetaan",
  "kunnostus",
  "laajenn",
  "uudisrakenn",
]

const PUOLUSTUSKIINTEISTOT_EXCLUDE_KEYWORDS = [
  "asiakastyytyväisyys",
  "tilinpäätös",
  "energiansäästö",
  "kestävyysraportti",
  "vuoropuhelu",
  "riskinarvio",
  "infotilaisuu",
  "kustannustehokkuus",
]

function puolustuskiinteistotIsProjectArticle(title: string, excerpt: string): boolean {
  const text = `${title} ${excerpt}`.toLowerCase()
  if (PUOLUSTUSKIINTEISTOT_EXCLUDE_KEYWORDS.some((k) => text.includes(k))) return false
  return PUOLUSTUSKIINTEISTOT_INCLUDE_KEYWORDS.some((k) => text.includes(k))
}

async function collectPuolustuskiinteistotSource(source: DiscoverySource) {
  const items: { title: string; url: string; excerpt: string }[] = []
  const seenUrls = new Set<string>()

  for (let page = 1; page <= PUOLUSTUSKIINTEISTOT_MAX_LIST_PAGES; page++) {
    const response = await fetch(
      `${source.url}?action=senaatti_defense_news_with_filters&s_page=${page}`,
      { cache: "no-store" }
    )
    if (!response.ok) break

    const json = await response.json()
    const html = json?.data ?? ""
    if (!html) break

    const $ = cheerio.load(html)
    const articles = $("article").toArray()
    if (articles.length === 0) break

    let newOnPage = 0
    for (const el of articles) {
      const $el = $(el)
      const link = $el.find("a").first().attr("href") ?? ""
      const title = $el.find(".latest-posts-article__title").text().replace(/\s+/g, " ").trim()
      const excerpt = $el.find(".latest-posts-article__excerpt").text().replace(/\s+/g, " ").trim()

      if (!link || !title || seenUrls.has(link)) continue
      seenUrls.add(link)
      newOnPage += 1

      if (puolustuskiinteistotIsProjectArticle(title, excerpt)) {
        items.push({ title, url: link, excerpt })
      }
    }

    if (newOnPage === 0) break
  }

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let detailFetches = 0
  let saved = 0

  for (const item of items) {
    const known = knownDetails.get(item.url)

    if (known) {
      const rawText = JSON.stringify({ item, ...known })
      const contentHash = hashContent(rawText)

      const { error } = await supabaseAdmin
        .from("source_documents")
        .upsert(
          {
            source_id: source.id,
            source_name: source.name,
            title: item.title,
            document_url: item.url,
            document_type: "api",
            content_hash: contentHash,
            status: "downloaded",
            raw_text: rawText,
            raw_payload: known,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(known.completed
              ? {
                  facts_extracted_at: new Date().toISOString(),
                  identity_resolved_at: new Date().toISOString(),
                }
              : {}),
          },
          { onConflict: "document_url" }
        )

      if (error) throw error
      saved += 1
      continue
    }

    if (detailFetches >= PUOLUSTUSKIINTEISTOT_MAX_DETAIL_FETCHES_PER_RUN) continue
    detailFetches += 1

    const detailResponse = await fetch(item.url, { cache: "no-store" })
    if (!detailResponse.ok) continue

    const detailHtml = await detailResponse.text()
    const $ = cheerio.load(detailHtml)
    $("style, script").remove()

    const description =
      $("article p")
        .toArray()
        .map((el) => $(el).text().replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .join(" ") || item.excerpt

    /*
     * Artikkelin runko mainitsee usein alkuperäisen rakennuksen
     * valmistumisvuoden ("vuonna 1966 valmistunut rakennus"), joten
     * "valmistui"-haku koko tekstistä antaisi vääriä positiivisia —
     * vain otsikko kertoo luotettavasti onko JUURI TÄMÄ hanke valmis.
     */
    const completed = /valmistui|peruskorjattu|uudistettu|otettu käyttöön|käyttöönotto/i.test(item.title)
    const publishedAt = $("time").first().attr("datetime") ?? null

    const rawText = JSON.stringify({ item, description, completed, publishedAt })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            description,
            published_at: publishedAt,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Espoon hakusivu on Next.js/Elasticsearch-pohjainen — sekä hakutulossivu
 * että hankkeen omat sivut upottavat täyden JSON-datan sivun
 * __NEXT_DATA__-scriptiin, joten mitään ei tarvitse päätellä CSS-
 * selektoreilla. Hakuparametrilla projectPhase suodatetaan jo
 * palvelinpuolella pois "Lainvoimainen"-vaiheen kaavat, joten kerääjä
 * näkee valmiiksi vain aktiiviset ~180 hanketta. Listaussivu antaa jo
 * otsikon/kuvauksen/alueen, mutta kaavatunnus, tarkka vaihe ja
 * yhteystiedot pitää hakea jokaisen hankkeen omalta sivulta erikseen
 * (rate-limitoitu, kuten Lahdella/Järvenpäällä).
 */
const ESPOO_MAX_DETAIL_FETCHES_PER_RUN = 15
const ESPOO_MAX_LIST_PAGES = 25

function espooExtractNextData(html: string): any | null {
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

async function fetchEspooDetails(url: string) {
  const empty = {
    kaavaTunnus: null as string | null,
    phase: null as string | null,
    planType: null as string | null,
    changeApplicant: null as string | null,
    contacts: [] as { name: string | null; title: string | null; phone: string | null; email: string | null }[],
  }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const nextData = espooExtractNextData(html)
    const gqlState = nextData?.props?.graphQLState ?? {}

    let project: any = null
    for (const entry of Object.values(gqlState) as any[]) {
      if (entry?.data?.Project) {
        project = entry.data.Project
        break
      }
    }
    if (!project) return empty

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    for (const block of project.content ?? []) {
      if (block.type !== "ContactParagraph") continue
      for (const person of block.content ?? []) {
        contacts.push({
          name: person.title ?? null,
          title: person.label ?? null,
          phone: person.phone ?? null,
          email: person.email ?? null,
        })
      }
    }

    return {
      kaavaTunnus: project.projectNumber ?? null,
      phase: project.meta?.phase?.[0]?.name ?? null,
      planType: project.meta?.plan?.[0]?.name ?? null,
      changeApplicant: project.changeApplicant ?? null,
      contacts,
    }
  } catch {
    return empty
  }
}

async function collectEspooKaavaSource(source: DiscoverySource) {
  const items: {
    id: string
    title: string
    url: string
    lead: string | null
    area: string | null
  }[] = []
  const seenIds = new Set<string>()

  for (let page = 1; page <= ESPOO_MAX_LIST_PAGES; page++) {
    const response = await fetch(`${source.url}&page=${page}`, { cache: "no-store" })
    if (!response.ok) break

    const html = await response.text()
    const nextData = espooExtractNextData(html)
    const hits = nextData?.props?.pageProps?.initialData?.hits ?? []
    if (hits.length === 0) break

    let newOnPage = 0
    for (const hit of hits) {
      const src = hit._source
      if (!src?.id || !src?.path || seenIds.has(src.id)) continue
      seenIds.add(src.id)
      newOnPage += 1

      items.push({
        id: src.id,
        title: (src.title ?? "").trim(),
        url: `https://www.espoo.fi${src.path}`,
        lead: src.lead ?? null,
        area: Array.isArray(src.greaterAreas) ? src.greaterAreas.join(", ") : null,
      })
    }

    if (newOnPage === 0) break
  }

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.kaava_tunnus || row.raw_payload?.phase) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let detailFetches = 0
  let saved = 0

  for (const item of items) {
    if (!item.title || !item.url) continue

    const known = knownDetails.get(item.url)

    let details = known
      ? {
          kaavaTunnus: known.kaava_tunnus ?? null,
          phase: known.phase ?? null,
          planType: known.plan_type ?? null,
          changeApplicant: known.change_applicant ?? null,
          contacts: known.contacts ?? [],
        }
      : null

    if (!details && detailFetches < ESPOO_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchEspooDetails(item.url)
      detailFetches += 1
    }

    const phase = details?.phase ?? null
    const completed = (phase ?? "").toLowerCase() === "lainvoimainen"

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: details?.kaavaTunnus ?? null,
            phase,
            plan_type: details?.planType ?? null,
            change_applicant: details?.changeApplicant ?? null,
            description: item.lead,
            area: item.area,
            contacts: details?.contacts ?? [],
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Lohjan kaavalistaus sekoittaa varsinaisia asemakaavoja (otsikko alkaa
 * tunnisteella L/K/RA/Y + numero, esim. "L80 Puu-Anttila...") muihin
 * hankesivuihin (visiot, katuselvitykset, ulkoiset infrahankkeet) —
 * vain tunnistekoodilla alkavat hyväksytään. Koko sisältö tulee jo
 * WP:n bulkkihaussa (content.rendered), joten erillistä sivuhakua ei
 * tarvita. Yhteystiedot ovat "Lisätiedot: Nimi (at) domain p.numero"
 * -muodossa, usein useampi <br>-erotettuna samassa kappaleessa.
 */
const LOHJA_PLAN_CODE_PATTERN = /^(L|K|RA|Y)\d+[a-z]?\b/

function lohjaParseContacts($: cheerio.CheerioAPI) {
  const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []

  $("p").each((_, el) => {
    const html = $(el).html() ?? ""
    if (!/Lisätiedot/i.test(html)) return

    const withoutLabel = html.replace(/^[\s\S]*?Lisätiedot:?\s*/i, "")
    const fragments = withoutLabel.split(/<br\s*\/?>/i)

    for (const fragment of fragments) {
      const line = cheerio.load(`<div>${fragment}</div>`)("div").text().replace(/\s+/g, " ").trim()
      if (!line) continue

      const emailMatch = line.match(/([\w.+-]+)\(at\)([\w.-]+\.\w+)/i)
      const email = emailMatch ? `${emailMatch[1]}@${emailMatch[2]}` : null
      const phoneMatch = line.match(/p\.?\s*(\d[\d\s-]{6,}\d)/i)
      const phone = phoneMatch ? phoneMatch[1].replace(/\s+/g, " ").trim() : null

      let rest = line
      if (emailMatch) rest = rest.replace(emailMatch[0], "")
      if (phoneMatch) rest = rest.replace(phoneMatch[0], "")
      rest = rest
        .replace(/^Kaupunginarkkitehti:?/i, "")
        .replace(/[,|]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()

      if (rest || email || phone) {
        contacts.push({ name: rest || null, title: null, phone, email })
      }
    }
  })

  return contacts
}

async function collectLohjaKaavaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Lohjan kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const items: any[] = await response.json()

  let saved = 0

  for (const item of items) {
    const title = (item.title?.rendered ?? "").trim()
    const url = item.link ?? ""
    const html = item.content?.rendered ?? ""

    if (!title || !url) continue
    if (!LOHJA_PLAN_CODE_PATTERN.test(title)) continue

    const kaavaTunnus = title.match(LOHJA_PLAN_CODE_PATTERN)?.[0] ?? null

    const $ = cheerio.load(html)

    const descriptionParts: string[] = []
    $("body")
      .children()
      .each((_, el) => {
        const $el = $(el)
        if ($el.is("h2, h3, h4, h5, h6")) return false
        if ($el.is("p")) {
          const text = $el.text().replace(/\s+/g, " ").trim()
          if (text && !/Lisätiedot/i.test(text)) descriptionParts.push(text)
        }
      })
    const description = descriptionParts.join(" ").slice(0, 3000) || null

    const headings: string[] = []
    $("h4.wp-block-heading, h3.wp-block-heading").each((_, el) => {
      const text = $(el).text().trim()
      if (text) headings.push(text)
    })
    const phase = headings[headings.length - 1] ?? null

    const completed =
      /hyväksytty/i.test(title) || /hyväksy|voimaantulo|lainvoima/i.test(phase ?? "")

    const contacts = lohjaParseContacts($)

    const rawText = JSON.stringify({ title, url, phase, description, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Rauman kaavasivut ovat lohkopohjaisia (Gutenberg) — kaavatunnus (esim.
 * "22-005") on jo WP-otsikossa, ja koko sisältö tulee bulkkihaussa
 * (content.rendered), joten erillistä sivuhakua ei tarvita. Sivun oma
 * "todellinen" otsikko ja nykyinen vaihe ovat molemmat <h2>-otsikkoina
 * ilman luotettavaa erottavaa CSS-luokkaa, joten ne erotetaan sisällön
 * perusteella: vaihe-otsikko täsmää tunnettuun sanastoon
 * (Vireilletulo/Valmistelu/Ehdotus/Hyväksytty/Voimaantulo/Lainvoimainen),
 * muut kelpaavat otsikoksi. Yhteystiedot ovat "Lisätietoja antaa"
 * -osion jälkeisissä kontaktikorteissa (Nimi-otsikko, sitten titteli/
 * puhelin/sähköposti omina <p>-elementteinään).
 */
const RAUMA_PHASE_HEADING_PATTERN = /^(Vireilletulo|Valmistelu|Ehdotus|Hyväksytty|Voimaantulo|Lainvoimainen)/i
const RAUMA_NON_TITLE_HEADING_PATTERN = /^(Lisätietoja|Materiaali|Selvitykset)/i

function raumaParseContacts($: cheerio.CheerioAPI) {
  const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []

  let afterLisatiedot = false
  $("h2, li").each((_, el) => {
    const $el = $(el)
    if ($el.is("h2")) {
      if (/^Lisätietoja/i.test($el.text().trim())) afterLisatiedot = true
      return
    }
    if (!afterLisatiedot) return
    if (!$el.hasClass("contact") && !$el.find(".contact").length && !/contact/i.test($el.attr("class") ?? "")) return

    const name = $el.find("h2").first().text().trim() || null
    const paragraphs = $el
      .find("p")
      .toArray()
      .map((p) => $(p).text().replace(/\s+/g, " ").trim())
      .filter(Boolean)

    const email = paragraphs.find((p) => p.includes("@")) ?? null
    const phone = paragraphs.find((p) => /puh\.?\s*[\d\s-]+/i.test(p))?.replace(/^puh\.?\s*/i, "") ?? null
    const title = paragraphs.find((p) => p !== email && p !== phone && !/puh\.?\s*[\d\s-]+/i.test(p)) ?? null

    if (name || email || phone) {
      contacts.push({ name, title, phone, email })
    }
  })

  return contacts
}

async function collectRaumaKaavaSource(source: DiscoverySource) {
  const response = await fetch(source.url, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(`Rauman kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`)
  }

  const items: any[] = await response.json()

  let saved = 0

  for (const item of items) {
    const wpTitle = (item.title?.rendered ?? "").trim()
    const url = item.link ?? ""
    const html = item.content?.rendered ?? ""

    if (!wpTitle || !url) continue

    const kaavaTunnus = wpTitle.match(/(\d{2}[-–]\d{3})/)?.[1]?.replace("–", "-") ?? null

    const $ = cheerio.load(html)

    const headings: { text: string; el: any }[] = []
    $("h2").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (text) headings.push({ text, el })
    })

    const phaseHeadings = headings.filter((h) => RAUMA_PHASE_HEADING_PATTERN.test(h.text))
    const phase = phaseHeadings[phaseHeadings.length - 1]?.text ?? null

    const titleHeading = headings.find(
      (h) => !RAUMA_PHASE_HEADING_PATTERN.test(h.text) && !RAUMA_NON_TITLE_HEADING_PATTERN.test(h.text)
    )
    const title = titleHeading?.text ?? wpTitle

    const descriptionParts: string[] = []
    $("p").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (text && text.length > 15 && !text.includes("@")) descriptionParts.push(text)
    })
    const description = descriptionParts.slice(0, 4).join(" ").slice(0, 3000) || null

    const completed = /voimaantulo|lainvoima/i.test(phase ?? "")
    const contacts = raumaParseContacts($)

    const rawText = JSON.stringify({ title, url, phase, description, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Kaarina käyttää Drupalia (ei WordPressiä kuten muut tämän session
 * kaupungit) eikä JSON:API-rajapinta ole julkisesti auki, joten
 * hankesivut löydetään sitemap.xml:stä (URL-polku sisältää aina
 * "kaavoitus-ja-kaupunkisuunnittelu/a<tunnus>-..."). Vain n. 20
 * hanketta, joten kaikki haetaan joka ajolla ilman rate-limitointia.
 * "Kaavan vaiheet" -osio listaa KAIKKI mahdolliset vaiheet mallipohjana
 * etukäteen — vain toteutuneilla on kaksoispiste + päivämäärä perässä,
 * joten viimeinen päivätty rivi kertoo nykyisen vaiheen (sama malli
 * kuin Rovaniemellä/Sipoossa).
 */
async function fetchKaarinaSitemapUrls(): Promise<string[]> {
  const response = await fetch("https://kaarina.fi/sitemap.xml", { cache: "no-store" })
  if (!response.ok) return []

  const xml = await response.text()
  const urls = [...xml.matchAll(/<loc>([^<]*kaavoitus-ja-kaupunkisuunnittelu\/a\d[^<]*)<\/loc>/gi)].map(
    (m) => m[1]
  )
  return [...new Set(urls)]
}

async function fetchKaarinaKaavaDetails(url: string) {
  const empty = {
    title: null as string | null,
    phase: null as string | null,
    description: null as string | null,
    contacts: [] as { name: string | null; title: string | null; phone: string | null; email: string | null }[],
  }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const title = $("h1").first().text().replace(/\s+/g, " ").trim() || null

    const findSection = (headingText: RegExp) => {
      let heading: any = null
      $("h2").each((_, el) => {
        if (heading) return
        if (headingText.test($(el).text().trim())) heading = el
      })
      return heading ? $(heading).parent().next() : null
    }

    const goalsSection = findSection(/Suunnittelun tavoitteet/i)
    const description = goalsSection ? goalsSection.text().replace(/\s+/g, " ").trim() || null : null

    const stagesSection = findSection(/Kaavan vaiheet/i)
    const stages: string[] = []
    stagesSection?.find("li").each((_, li) => {
      const text = $(li).text().replace(/\s+/g, " ").trim()
      if (text) stages.push(text)
    })
    const datedStages = stages.filter((s) => /:\s*\S/.test(s))
    const lastDated = datedStages[datedStages.length - 1] ?? null
    const phase = lastDated ? lastDated.split(":")[0].trim() : null

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    $(".node--type-contact-card, article.contact").each((_, el) => {
      const $el = $(el)
      const name = $el.find("h3").first().text().replace(/\s+/g, " ").trim() || null
      const contactTitle =
        $el.find("[class*='contact-person-title']").first().text().replace(/\s+/g, " ").trim() || null
      const phone = $el.find("a[href^='tel:']").first().attr("href")?.replace(/^tel:/, "") ?? null
      const email = $el.find("[class*='contact-email']").first().text().replace(/\s+/g, " ").trim() || null
      if (name || phone || email) contacts.push({ name, title: contactTitle, phone, email })
    })

    return { title, phase, description, contacts }
  } catch {
    return empty
  }
}

async function collectKaarinaKaavaSource(source: DiscoverySource) {
  const urls = await fetchKaarinaSitemapUrls()

  let saved = 0

  for (const url of urls) {
    const details = await fetchKaarinaKaavaDetails(url)
    if (!details.title) continue

    const kaavaTunnus = details.title.match(/^(A\d+[A-Za-z]?)/)?.[1] ?? null
    const completed = /lainvoimainen|voimaantulo/i.test(details.phase ?? "")

    const rawText = JSON.stringify({ url, ...details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: details.title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: details.title,
            kaava_tunnus: kaavaTunnus,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: urls.length,
    documentsSaved: saved,
  }
}

const NOKIA_ZONING_PAGE_SLUG = "vireilla-olevat-kaavat"
const NOKIA_PHASE_ORDER = [
  "Vireille",
  "Osallistumis- ja arviointisuunnitelma",
  "Luonnos",
  "Ehdotus",
  "Hyväksyminen",
  "Voimaantulo",
]

function nokiaCurrentPhase(aikatauluText: string | null): string | null {
  if (!aikatauluText) return null

  const lines = aikatauluText
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)

  let current: string | null = null

  for (const line of lines) {
    const hasDate = /\d{1,2}\.\d{1,2}\.\d{4}/.test(line)
    if (!hasDate) continue

    const label = NOKIA_PHASE_ORDER.find((phase) => line.startsWith(phase))
    if (label) current = label
  }

  return current
}

async function collectNokiaKaavaSource(source: DiscoverySource) {
  const response = await fetch(
    `https://www.nokiankaupunki.fi/wp-json/wp/v2/pages?slug=${NOKIA_ZONING_PAGE_SLUG}&_fields=id,title,link,content`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    return { documentsFound: 0, documentsSaved: 0 }
  }

  const pages = (await response.json()) as any[]
  const page = pages[0]
  if (!page) return { documentsFound: 0, documentsSaved: 0 }

  const $ = cheerio.load(page.content.rendered)
  const items = $(".block-child-accordion-item")

  let found = 0
  let saved = 0

  for (const el of items.toArray()) {
    const $item = $(el)
    const rawTitle = $item.find("summary .title").first().text().replace(/\s+/g, " ").trim()

    const tunnusMatch = rawTitle.match(/^(\d+:\d+),\s*(.+)$/)
    if (!tunnusMatch) continue

    found += 1

    const kaavaTunnus = tunnusMatch[1]
    const address = tunnusMatch[2].trim()

    const detailsId = $item.find("details").first().attr("id")
    const documentUrl = `${page.link}#${detailsId ?? kaavaTunnus.replace(/:/g, "-")}`

    const content = $item.find(".child-content")
    const leadHtml = content.find("p.is-style-lead").first().html() ?? ""
    const diaarinumero = leadHtml.match(/Diaarinumero:\s*([^)<]+)/)?.[1]?.trim() ?? null
    const description =
      leadHtml
        .replace(/\(Diaarinumero:[^)]*\)/i, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim() || null

    const aikatauluHeading = content
      .find("h2")
      .filter((_, h) => $(h).text().trim() === "Aikataulu")
      .first()
    const aikatauluHtml = aikatauluHeading.length ? aikatauluHeading.next().html() : null
    const phase = nokiaCurrentPhase(aikatauluHtml)

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    content.find(".card-contact").each((_, card) => {
      const $card = $(card)
      const name =
        $card.find(".card-contact__item--content-name").first().text().replace(/\s+/g, " ").trim() || null
      const contactTitle =
        $card.find(".card-contact__item--content-job-title").first().text().replace(/\s+/g, " ").trim() || null
      const phone = $card.find("a[href^='tel:']").first().attr("href")?.replace(/^tel:/, "") ?? null
      const email = $card.find("a[href^='mailto:']").first().attr("href")?.replace(/^mailto:/, "") ?? null
      if (name || phone || email) contacts.push({ name, title: contactTitle, phone, email })
    })

    const completed = /voimaantulo/i.test(phase ?? "")

    const rawText = JSON.stringify({ documentUrl, rawTitle, kaavaTunnus, address, phase, description, diaarinumero, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: rawTitle,
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: rawTitle,
            kaava_tunnus: kaavaTunnus,
            address,
            phase,
            description,
            diaarinumero,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: found,
    documentsSaved: saved,
  }
}

/*
 * Vihdin "vireillä olevat asemakaavat" -sivusto jakautuu neljään
 * taajamaan (Nummela, Ojakkala, Vihdin kirkonkylä, Otalampi), mutta
 * jokaisella sivulla on jaettu vasen sivupalkki, joka listaa KAIKKIEN
 * taajamien yksittäiset kaavat kerralla — riittää siis hakea yksi
 * sivu saadakseen koko linkkilistan. Yksittäisen kaavan sivun
 * "vaihe"-kappaleiden järjestys ei ole luotettavasti kronologinen eri
 * sivujen välillä (osa uusin-ensin, osa vanhin-ensin), ja teksti voi
 * mainita SISARKAAVAN (esim. V47a) saavuttaman lainvoiman kaavan V47b
 * omalla sivulla — siksi vaihe päätellään "Kaava-aineisto"-osion
 * materiaalimaininnoista prioriteettijärjestyksessä (edistynein
 * mainittu vaihe voittaa) sen sijaan, että luotettaisiin tekstin
 * järjestykseen. Koska lähde kattaa vain "vireillä olevat" (ei vielä
 * lainvoimaisia) kaavoja, completed on aina false tälle lähteelle.
 */
/*
 * Jaettu sivupalkki laajentaa HTML:ssä vain SEN taajaman alilistan,
 * jonka sivulla parhaillaan ollaan (muiden taajamien alilistat jäävät
 * pois DOM:sta kokonaan, ei vain CSS:llä piilotettuna) — siksi kaikki
 * neljä taajamasivua pitää hakea erikseen kattavuuden varmistamiseksi.
 */
const VIHTI_DISTRICT_URLS = [
  "https://www.vihti.fi/asuminen-ja-ymparisto/kaavoitus/asemakaavoitus/vireilla-olevat-asemakaavat/nummela-vireilla-olevat-asemakaavat/",
  "https://www.vihti.fi/asuminen-ja-ymparisto/kaavoitus/asemakaavoitus/vireilla-olevat-asemakaavat/ojakkala/",
  "https://www.vihti.fi/asuminen-ja-ymparisto/kaavoitus/asemakaavoitus/vireilla-olevat-asemakaavat/vihdin-kirkonkyla/",
  "https://www.vihti.fi/asuminen-ja-ymparisto/kaavoitus/asemakaavoitus/vireilla-olevat-asemakaavat/5057-2/",
]
const VIHTI_PLAN_TITLE_PATTERN = /^([A-Za-z]{1,3}\d{1,4}[a-z]?)\s+(.+)$/

async function fetchVihtiPlanLinks(): Promise<{ title: string; url: string }[]> {
  const seen = new Set<string>()
  const links: { title: string; url: string }[] = []

  for (const districtUrl of VIHTI_DISTRICT_URLS) {
    const response = await fetch(districtUrl, { cache: "no-store" })
    if (!response.ok) continue

    const html = await response.text()
    const $ = cheerio.load(html)

    $(".sidebar-nav__list a").each((_, el) => {
      const href = $(el).attr("href")
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (!href || !text) return
      if (!VIHTI_PLAN_TITLE_PATTERN.test(text)) return
      if (seen.has(href)) return

      seen.add(href)
      links.push({ title: text, url: href })
    })
  }

  return links
}

function vihtiPhaseFromText(text: string): string {
  if (/hyväksy/i.test(text)) return "Hyväksyminen"
  if (/ehdotus/i.test(text)) return "Ehdotus"
  if (/luonnos/i.test(text)) return "Luonnos"
  if (/osallistumis|arviointi/i.test(text)) return "Osallistumis- ja arviointisuunnitelma"
  return "Vireilletulo"
}

async function fetchVihtiKaavaDetails(url: string) {
  const empty = { description: null, phase: "Vireilletulo", contacts: [] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const contactBoxText = $(".s-content-box__contacts").text().replace(/\s+/g, " ").trim()
    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    const emailMatch = contactBoxText.match(/([\w.-]+)\((?:a|ät|at)\)([\w.-]+\.\w+)/i)
    if (emailMatch) {
      contacts.push({
        name: null,
        title: "Kaavoitus",
        phone: null,
        email: `${emailMatch[1]}@${emailMatch[2]}`,
      })
    }

    $(".sidebar-left").remove()

    const findSection = (headingPattern: RegExp) => {
      let heading: any = null
      $("h4").each((_, el) => {
        if (heading) return
        if (headingPattern.test($(el).text().trim())) heading = el
      })
      if (!heading) return ""

      let text = ""
      let el = $(heading).next()
      while (el.length && el[0].tagName !== "h4") {
        text += " " + $(el).text().replace(/\s+/g, " ").trim()
        el = el.next()
      }
      return text.trim()
    }

    /*
     * Osa sivuista ei käytä h4-otsikoita lainkaan, vaan sama tieto on
     * yhden <p>:n sisällä <strong>Otsikko<br></strong>leipäteksti-muodossa.
     */
    const findInlineSection = (labelPattern: RegExp) => {
      let result = ""
      $("p").each((_, el) => {
        const strong = $(el).find("strong").first()
        if (!strong.length) return
        const label = strong.text().trim()
        if (!labelPattern.test(label)) return

        const fullText = $(el).text().replace(/\s+/g, " ").trim()
        const afterLabel = fullText.slice(label.length).trim()
        if (afterLabel) result = afterLabel
      })
      return result
    }

    /*
     * Harvinaisin sivuvariantti: ei h4-otsikkoa eikä <strong>-etikettiä,
     * pelkkä ensimmäinen leipätekstikappale kuvauksena ilman minkäänlaista
     * otsikkoa. Käytetään vasta viimeisenä keinona.
     */
    const findFirstParagraphFallback = () => {
      let result = ""
      $("p").each((_, el) => {
        if (result) return
        const text = $(el).text().replace(/\s+/g, " ").trim()
        if (text.length < 30) return
        if (/viimeksi päivitetty|osallistumis- ja arviointisuunnitelma$|vaihde \(|postiosoite|palautekanava|kunnanvirasto/i.test(text)) return
        result = text
      })
      return result
    }

    const description =
      findSection(/tarkoitus/i) || findInlineSection(/tarkoitus/i) || findFirstParagraphFallback() || null
    const aineistoText = findSection(/aineisto/i) || findInlineSection(/aineisto/i)
    const vaiheText = findSection(/vaihe/i) || findInlineSection(/vaihe/i)
    const phase = vihtiPhaseFromText(`${aineistoText} ${vaiheText} ${description ?? ""}`)

    return { description, phase, contacts }
  } catch {
    return empty
  }
}

/*
 * Imatran kaavasivut ovat Drupalin vapaamuotoista WYSIWYG-tekstiä
 * (.field--name-body), ei strukturoitua otsikkohierarkiaa — osa
 * sivuista käyttää h2/h3-otsikkoja, osa <p><strong>Otsikko:</strong>...
 * -muotoa saman sivun sisällä. Kerätään molemmat "Vireillä olevat" ja
 * "Nähtävillä olevat" -osiot listaussivulta (kaikki ei-vielä-lainvoimaiset
 * kaavat); "Valmiit asemakaavat" -osio jätetään tarkoituksella pois.
 */
const IMATRA_LISTING_URL = "https://www.imatra.fi/asuminen-ja-ymparisto/kaavoitus/asemakaavat"
const IMATRA_LINK_TITLE_PATTERN = /,\s*kaava\s+(\d+)/i

async function fetchImatraPlanLinks(): Promise<{ title: string; url: string; kaavaTunnus: string }[]> {
  const response = await fetch(IMATRA_LISTING_URL, { cache: "no-store" })
  if (!response.ok) return []

  const html = await response.text()
  const $ = cheerio.load(html)

  const collectSection = (headingText: string) => {
    const heading = $("h2")
      .filter((_, el) => $(el).text().trim() === headingText)
      .first()
    if (!heading.length) return []

    const links: { title: string; url: string; kaavaTunnus: string }[] = []
    let el = heading.next()
    while (el.length && el[0].tagName !== "h2") {
      el.find("a")
        .addBack("a")
        .each((_, a) => {
          const href = $(a).attr("href")
          const text = $(a).text().replace(/\s+/g, " ").trim()
          if (!href || !text) return

          const tunnusMatch = text.match(IMATRA_LINK_TITLE_PATTERN)
          if (!tunnusMatch) return

          const absoluteUrl = href.startsWith("http") ? href : `https://www.imatra.fi${href}`
          links.push({ title: text, url: absoluteUrl, kaavaTunnus: tunnusMatch[1] })
        })
      el = el.next()
    }
    return links
  }

  const seen = new Set<string>()
  const links: { title: string; url: string; kaavaTunnus: string }[] = []
  for (const link of [
    ...collectSection("Nähtävillä olevat asemakaavat"),
    ...collectSection("Vireillä olevat asemakaavat"),
  ]) {
    if (seen.has(link.url)) continue
    seen.add(link.url)
    links.push(link)
  }

  return links
}

function imatraPhaseFromText(text: string): string {
  if (/voimaantulo|lainvoima/i.test(text)) return "Lainvoimaisuus"
  if (/hyväksy/i.test(text)) return "Hyväksyminen"
  if (/ehdotus/i.test(text)) return "Ehdotus"
  if (/luonnos/i.test(text)) return "Luonnos"
  if (/osallistumis|arviointi/i.test(text)) return "Osallistumis- ja arviointisuunnitelma"
  if (/vireille/i.test(text)) return "Vireilletulo"
  return "Vireilletulo"
}

async function fetchImatraKaavaDetails(url: string) {
  const empty = { description: null, phase: "Vireilletulo", contacts: [] as any[] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    const spamspan = $(".spamspan").first()
    if (spamspan.length) {
      const user = spamspan.find(".u").text().trim()
      const domain = spamspan.find(".d").text().trim()
      if (user && domain) {
        contacts.push({ name: null, title: "Kaavoitus", phone: null, email: `${user}@${domain}` })
      }
    }

    const body = $(".field--name-body").first()

    let currentLabel: string | null = null
    const sections: Record<string, string> = {}
    let leadText = ""

    body.children().each((_, el) => {
      const tag = el.tagName?.toLowerCase()
      const $el = $(el)

      if (tag === "h2" || tag === "h3" || tag === "h4") {
        currentLabel = $el.text().replace(/\s+/g, " ").trim().replace(/:$/, "")
        if (currentLabel && !(currentLabel in sections)) sections[currentLabel] = ""
        return
      }

      if (tag !== "p") return

      const strong = $el.find("strong").first()
      const strongText = strong.length ? strong.text().replace(/\s+/g, " ").trim() : ""
      const fullText = $el.text().replace(/\s+/g, " ").trim()

      if (strongText && /:$/.test(strongText) && fullText.startsWith(strongText)) {
        currentLabel = strongText.replace(/:$/, "")
        if (!(currentLabel in sections)) sections[currentLabel] = ""
        sections[currentLabel] += ` ${fullText.slice(strongText.length).trim()}`
        return
      }

      if (currentLabel) {
        sections[currentLabel] += ` ${fullText}`
      } else {
        leadText += ` ${fullText}`
      }
    })

    const descriptionKey = Object.keys(sections).find((k) => /tavoite/i.test(k))
    const phaseKey = Object.keys(sections).find((k) => /käsittelyvaihe|vaihe/i.test(k))

    const description = (descriptionKey ? sections[descriptionKey].trim() : "") || leadText.trim() || null
    const phaseText = phaseKey ? sections[phaseKey] : ""
    const phase = imatraPhaseFromText(phaseText)

    return { description, phase, contacts }
  } catch {
    return empty
  }
}

async function collectImatraKaavaSource(source: DiscoverySource) {
  const links = await fetchImatraPlanLinks()

  let saved = 0

  for (const link of links) {
    const details = await fetchImatraKaavaDetails(link.url)
    const completed = /voimaantulo|lainvoima/i.test(details.phase ?? "")

    const rawText = JSON.stringify({ link, ...details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: link.title,
          document_url: link.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: link.title,
            kaava_tunnus: link.kaavaTunnus,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: links.length,
    documentsSaved: saved,
  }
}

/*
 * Raahen kaavasivun "Vireillä olevat" -listaus jakautuu Drupalin
 * sivutukseen (?page=0, ?page=1, ...) — kummallakin sivulla on oma
 * "Vireillä olevat" -otsikko ja linkkilista, joten molemmat haetaan ja
 * yhdistetään. Yksittäisen kaavan sivulla nykyinen vaihe on suoraan
 * "Ajankohtaista"-otsikon ALLA oleva ENSIMMÄINEN h3-otsikko (esim.
 * "Hyväksyminen") — sivu näyttää tämän aina erillään "Aiemmat
 * suunnitteluvaiheet" -osiosta, joten vaihetta ei tarvitse päätellä
 * tekstistä kuten useimmilla muilla sivustoilla.
 */
const RAAHE_LISTING_URLS = [
  "https://raahe.fi/elinymparisto/kaavoitus",
  "https://raahe.fi/elinymparisto/kaavoitus?page=1",
]
const RAAHE_TUNNUS_PATTERN = /^(AK|AKM)\s*(\d+)/i

async function fetchRaahePlanLinks(): Promise<{ title: string; url: string; kaavaTunnus: string | null }[]> {
  const seen = new Set<string>()
  const links: { title: string; url: string; kaavaTunnus: string | null }[] = []

  for (const listingUrl of RAAHE_LISTING_URLS) {
    const response = await fetch(listingUrl, { cache: "no-store" })
    if (!response.ok) continue

    const html = await response.text()
    const $ = cheerio.load(html)

    const heading = $("h2")
      .filter((_, el) => $(el).text().trim() === "Vireillä olevat")
      .last()
    if (!heading.length) continue

    let el = heading.next()
    while (el.length && el[0].tagName !== "h2") {
      el.find("a")
        .addBack("a")
        .each((_, a) => {
          const href = $(a).attr("href")
          const text = $(a).text().replace(/\s+/g, " ").trim()
          if (!href || !text) return
          if (!href.startsWith("/kaavoitus/")) return

          const absoluteUrl = `https://raahe.fi${href}`
          if (seen.has(absoluteUrl)) return
          seen.add(absoluteUrl)

          const tunnusMatch = text.match(RAAHE_TUNNUS_PATTERN)
          const kaavaTunnus = tunnusMatch ? `${tunnusMatch[1].toUpperCase()}${tunnusMatch[2]}` : null

          links.push({ title: text, url: absoluteUrl, kaavaTunnus })
        })
      el = el.next()
    }
  }

  return links
}

async function fetchRaaheKaavaDetails(url: string) {
  const empty = { title: null as string | null, description: null, phase: "Vireilletulo", contacts: [] as any[] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const title = $("h1").first().text().replace(/\s+/g, " ").trim() || null

    const textUntilNextH2 = (heading: any) => {
      let text = ""
      let el = $(heading).next()
      while (el.length && el[0].tagName !== "h2") {
        text += ` ${$(el).text().replace(/\s+/g, " ").trim()}`
        el = el.next()
      }
      return text.trim()
    }

    /*
     * Kuvausotsikko vaihtelee suunnitelmatyypin mukaan (asemakaavoilla
     * "Asemakaava", yleiskaavoilla "Osayleiskaava", jne.) — sen sijaan
     * että arvattaisiin otsikon teksti, käytetään sijaintia: kuvaus on
     * aina ensimmäinen h2 "Ajankohtaista"-osion JÄLKEEN.
     */
    const ajankohtaistaHeading = $("h2")
      .filter((_, el) => $(el).text().trim() === "Ajankohtaista")
      .first()
    const descriptionHeading = ajankohtaistaHeading.length
      ? ajankohtaistaHeading.nextAll("h2").first()
      : null
    const description =
      descriptionHeading && descriptionHeading.length ? textUntilNextH2(descriptionHeading) || null : null

    const firstH3 = ajankohtaistaHeading.length
      ? $(ajankohtaistaHeading).nextAll("h3").first()
      : null
    const phase = firstH3 && firstH3.length ? firstH3.text().replace(/\s+/g, " ").trim() : "Vireilletulo"

    /*
     * "Lisätietoja"-kappaleen sisältö vaihtelee: yleensä yksi otsikko +
     * nimi ("Kaavasuunnittelija" + "Mathias Holmén"), joskus useampi
     * henkilö samassa kappaleessa. Ilman luotettavaa erotinta useamman
     * henkilön tapaus ei erotu varmasti otsikko/nimi-parista, joten
     * poimitaan vain ENSIMMÄINEN pari (otsikko, sitten nimi) ja
     * jätetään mahdolliset lisähenkilöt pois — puhelin/sähköposti ei
     * ole tällä sivustolla muutenkaan saatavilla.
     */
    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    const lisatietojaLabel = $("strong")
      .filter((_, el) => $(el).text().trim() === "Lisätietoja")
      .first()
    if (lisatietojaLabel.length) {
      const paragraph = lisatietojaLabel.closest("p")
      const fullText = paragraph.text().replace(/\s+/g, " ").trim()
      const rest = fullText.replace(/^Lisätietoja\s*/, "").trim()
      const parts = rest.split(/\s*(?:\r?\n|(?<=[a-zäöå])(?=[A-ZÄÖÅ]))/).filter(Boolean)

      if (parts.length >= 2 && !/henkilöstöhaku|yhteystiedot/i.test(parts[0])) {
        contacts.push({ name: parts[1], title: parts[0], phone: null, email: null })
      }
    }

    return { title, description, phase, contacts }
  } catch {
    return empty
  }
}

async function collectRaaheKaavaSource(source: DiscoverySource) {
  const links = await fetchRaahePlanLinks()

  let saved = 0

  for (const link of links) {
    const details = await fetchRaaheKaavaDetails(link.url)
    const title = details.title ?? link.title
    const completed = /voimaantulo|lainvoima/i.test(details.phase ?? "")

    const rawText = JSON.stringify({ link, ...details, title })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: link.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: link.kaavaTunnus,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: links.length,
    documentsSaved: saved,
  }
}

/*
 * Sastamalan kaavasivu on yksi WordPress-sivu (id 295), jonka koko
 * sisältö on haitari (accordion): jokainen kaava on oma <button>+<div>
 * -pari, eikä erillisiä alasivuja ole. Alaotsikot (<h5>) esiintyvät
 * UUSIN ENSIN -järjestyksessä (esim. "Luonnos" ennen "Osallistumis- ja
 * arviointisuunnitelma", vaikka OAS tapahtuu aina ensin kronologisesti),
 * joten ENSIMMÄINEN <h5> ("Yhteystiedot" pois lukien) on aina nykyinen
 * vaihe.
 */
const SASTAMALA_PAGE_URL =
  "https://sastamala.fi/wp-json/wp/v2/pages/295?_fields=id,slug,link,title,content"
const SASTAMALA_TUNNUS_PATTERN = /^([ARY]_?\d+)\s+(.+)$/i

/*
 * "Lisätietoja antaa" -lause ei aina noudata samaa sanajärjestystä —
 * joskus nimi tulee ennen tehtävänimikettä ("Jasmin Broman
 * kaavoitusarkkitehti"), joskus toisin päin ("maankäyttöjohtaja Ilmari
 * Mattila") — joten nimeä ei etsitä kiinteästä positiosta, vaan isolla
 * alkukirjaimella alkavana 1-2 sanan pätkänä (ISOT/pienet kirjaimet
 * erottavat nimen ja nimikkeen, joten regex ei saa olla /i-tilassa).
 */
function parseSastamalaContact(text: string) {
  const emailMatch = text.match(/([\w.-]+@[\w.-]+)/)
  const phoneMatch = text.match(/puh\.?\s*([\d\s]+?)(?:,|\s*$)/)

  let remaining = text.replace(/Lisätietoja antaa\s*/i, "")
  if (emailMatch) remaining = remaining.replace(emailMatch[0], "")
  remaining = remaining.replace(/puh\.?[\d\s,]+/, "").trim()

  const nameMatch = remaining.match(/([A-ZÄÖÅ][\wäöåÄÖÅ'-]+(?:\s+[A-ZÄÖÅ][\wäöåÄÖÅ'-]+)?)/)
  if (!nameMatch) return null

  return {
    name: nameMatch[1].trim(),
    title: remaining.replace(nameMatch[1], "").trim() || null,
    phone: phoneMatch ? phoneMatch[1].trim() : null,
    email: emailMatch ? emailMatch[1] : null,
  }
}

async function collectSastamalaKaavaSource(source: DiscoverySource) {
  const response = await fetch(SASTAMALA_PAGE_URL, { cache: "no-store" })
  if (!response.ok) return { documentsFound: 0, documentsSaved: 0 }

  const page = (await response.json()) as any
  if (!page?.content?.rendered) return { documentsFound: 0, documentsSaved: 0 }

  const $ = cheerio.load(page.content.rendered)
  const items = $(".b-single-accordion-box")

  let found = 0
  let saved = 0

  for (const el of items.toArray()) {
    const $item = $(el)
    const rawTitle = $item
      .find(".b-single-accordion-box__toggle-btn")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim()

    const tunnusMatch = rawTitle.match(SASTAMALA_TUNNUS_PATTERN)
    if (!tunnusMatch) continue

    found += 1

    const kaavaTunnus = tunnusMatch[1].toUpperCase()
    const planTitle = tunnusMatch[2].trim()

    const content = $item.find(".b-single-accordion-box__content").first()
    const description = content.find("p").first().text().replace(/\s+/g, " ").trim() || null

    const h5s = content.find("h5")
    const phaseHeading = h5s
      .filter((_, h) => !/yhteystiedot/i.test($(h).text()))
      .first()
    const phase = phaseHeading.length ? phaseHeading.text().replace(/\s+/g, " ").trim() : "Vireilletulo"

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    const yhteystiedotHeading = h5s.filter((_, h) => /yhteystiedot/i.test($(h).text())).first()
    if (yhteystiedotHeading.length) {
      const contactText = yhteystiedotHeading.next("p").text().replace(/\s+/g, " ").trim()
      const contact = parseSastamalaContact(contactText)
      if (contact) contacts.push(contact)
    }

    const completed = /voimaantulo|lainvoima/i.test(phase)

    const documentUrl = `${page.link}#${kaavaTunnus.toLowerCase()}`
    const rawText = JSON.stringify({ documentUrl, rawTitle, kaavaTunnus, planTitle, phase, description, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: planTitle,
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: planTitle,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: found,
    documentsSaved: saved,
  }
}

async function collectVihtiKaavaSource(source: DiscoverySource) {
  const links = await fetchVihtiPlanLinks()

  let saved = 0

  for (const link of links) {
    const titleMatch = link.title.match(VIHTI_PLAN_TITLE_PATTERN)
    if (!titleMatch) continue

    const kaavaTunnus = titleMatch[1]
    const details = await fetchVihtiKaavaDetails(link.url)

    const rawText = JSON.stringify({ link, kaavaTunnus, ...details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: link.title,
          document_url: link.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: link.title,
            kaava_tunnus: kaavaTunnus,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed: false,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: links.length,
    documentsSaved: saved,
  }
}

/*
 * Riihimäen kaavasivut palauttavat wp-json:sta tyhjän content.rendered-
 * kentän (sivunrakennustyökalu ei tue oletus-REST-kenttää), joten
 * wp-json:ia käytetään vain listaamiseen (parent=1543 palauttaa kaikki
 * yksittäiset kaavasivut), ja itse sisältö haetaan jokaisen sivun
 * renderöidystä HTML:stä erikseen. Sivulla EI ole erillistä kaava-
 * tunnusta — ainoa mahdollinen koodi ("kohdetunnuksella A1") on upotettu
 * vapaaseen leipätekstiin ja uudelleenkäytetään vuosittain eri kaavoille,
 * joten se ei kelpaa luotettavaksi tunnisteeksi. Sen sijaan käytetään
 * URL-slugia tunnisteena. Vaihe päätellään siitä, MIKÄ vaiheotsikoista
 * (Aloitusvaihe/Luonnosvaihe/Ehdotusvaihe/Hyväksyminen/Lainvoimaisuus)
 * sisältää oikean vuosiluvun (20xx) — myöhemmät, vielä saavuttamattomat
 * vaiheet sisältävät vain yleisluontoista tekstiä prosessista ilman
 * konkreettista päivämäärää.
 */
const RIIHIMAKI_PARENT_PAGE_ID = 1543
const RIIHIMAKI_PHASE_ORDER = ["Aloitusvaihe", "Luonnosvaihe", "Ehdotusvaihe", "Hyväksyminen", "Lainvoimaisuus"]

/*
 * riihimaki.fi:n WAF palauttaa 500:n Node-fetchin (undici) TLS-
 * sormenjäljelle, mutta hyväksyy Node:n ydin-https-moduulin — siksi
 * kaikki tämän lähteen haut tehdään sillä eikä globaalilla fetch():lla.
 */
function riihimakiHttpsGet(url: string): Promise<{ ok: boolean; text: () => Promise<string> }> {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
        },
        (res) => {
          let data = ""
          res.on("data", (chunk) => {
            data += chunk
          })
          res.on("end", () => {
            const status = res.statusCode ?? 0
            resolve({ ok: status >= 200 && status < 300, text: async () => data })
          })
        }
      )
      .on("error", reject)
  })
}

async function fetchRiihimakiPlanLinks(): Promise<{ title: string; url: string; slug: string }[]> {
  const response = await riihimakiHttpsGet(
    `https://www.riihimaki.fi/wp-json/wp/v2/pages?parent=${RIIHIMAKI_PARENT_PAGE_ID}&per_page=50&_fields=id,slug,title,link`
  )
  if (!response.ok) return []

  const pages = JSON.parse(await response.text()) as any[]
  return pages
    .map((p) => ({
      title: (p.title?.rendered ?? "").replace(/&#8211;/g, "–").trim(),
      url: p.link,
      slug: p.slug,
    }))
    .filter((p) => p.title && p.url)
}

async function fetchRiihimakiKaavaDetails(url: string) {
  const empty = { title: null, description: null, phase: "Aloitusvaihe", contacts: [] }

  try {
    const response = await riihimakiHttpsGet(url)
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)
    $("script, style, nav, footer, header").remove()

    const title = $("h1").first().text().replace(/\s+/g, " ").trim() || null

    const firstH2 = $("h2").first()
    const descriptionParts: string[] = []
    if (firstH2.length) {
      let el = firstH2.next()
      while (el.length && el[0].tagName !== "h2" && el[0].tagName !== "h3") {
        const text = $(el).text().replace(/\s+/g, " ").trim()
        if (text) descriptionParts.push(text)
        el = el.next()
      }
    }
    const description = descriptionParts.join(" ").trim() || null

    let currentPhase = "Aloitusvaihe"
    const headings = $("h2, h3").toArray()
    for (let i = 0; i < headings.length; i++) {
      const headingText = $(headings[i]).text().trim()
      const matchedPhase = RIIHIMAKI_PHASE_ORDER.find((p) => headingText === p)
      if (!matchedPhase) continue

      let sectionText = ""
      let el = $(headings[i]).next()
      while (el.length && !(el[0].tagName === "h2" || (el[0].tagName === "h3" && RIIHIMAKI_PHASE_ORDER.includes($(el).text().trim())))) {
        sectionText += " " + $(el).text().replace(/\s+/g, " ").trim()
        el = el.next()
      }

      if (/20\d{2}/.test(sectionText)) currentPhase = matchedPhase
    }

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    $("article.contact-person").each((_, article) => {
      const $article = $(article)
      const rawName = $article
        .find(".contact-person__personal__name")
        .first()
        .text()
        .replace(/\s+/g, " ")
        .trim()
      const tokens = rawName.split(" ")
      const name = tokens.length === 2 ? `${tokens[1]} ${tokens[0]}` : rawName || null

      const title =
        $article.find(".contact-person__personal__title").first().text().replace(/\s+/g, " ").trim() || null
      const phone = $article.find("a[href^='tel:']").first().attr("href")?.replace(/^tel:/, "") ?? null
      const email = $article.find("a[href^='mailto:']").first().attr("href")?.replace(/^mailto:/, "") ?? null

      if (name || phone || email) contacts.push({ name, title, phone, email })
    })

    return { title, description, phase: currentPhase, contacts }
  } catch {
    return empty
  }
}

async function collectRiihimakiKaavaSource(source: DiscoverySource) {
  const links = await fetchRiihimakiPlanLinks()

  let saved = 0

  for (const link of links) {
    const details = await fetchRiihimakiKaavaDetails(link.url)
    const title = details.title ?? link.title
    const completed = /lainvoimaisuus/i.test(details.phase ?? "")

    const rawText = JSON.stringify({ link, ...details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: link.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: link.slug,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: links.length,
    documentsSaved: saved,
  }
}

/*
 * Raasepori (raseborg.fi) on kaksikielinen, ja jokainen kaavahanke on
 * kahtena erillisenä wp-json "planer"-tyypin tietueena — suomeksi
 * (slug "kaava-NNNN") ja ruotsiksi (slug "plan-NNNN"), samalla
 * nelinumeroisella hanketunnuksella. Kerätään vain lang==="fi" jotta
 * sama hanke ei tuota kahta kandidaattia. Käsittelyvaihe-osiossa
 * näytetään VAIN jo saavutetut vaiheet (ei tulevaa vaihetta
 * paikkamerkkinä), uusin ensin — joten ensimmäinen otsikko kertoo
 * nykyisen vaiheen.
 */
const RAASEPORI_TITLE_NAME_PATTERN =
  /((?:johtava\s+)?(?:kaavakonsultt\w*|kaavoitusinsinööri|kaavoituspäällikkö|kaupunginarkkitehti|maankäyttö\w*|arkkitehti))\s+(\p{Lu}[\p{L}-]+(?:\s\p{Lu}[\p{L}-]+)?)/giu
const RAASEPORI_PHONE_PATTERN = /(?:puh\.?|p\.)\s*(\d[\d\s]{5,12}\d)/gi
const RAASEPORI_EMAIL_PATTERN = /([\w.+-]+@[\w.-]+\.\w+)/g

async function fetchRaaseporiPlanLinks(): Promise<{ title: string; url: string; slug: string }[]> {
  const links: { title: string; url: string; slug: string }[] = []

  for (let page = 1; page <= 5; page++) {
    const response = await fetch(
      `https://www.raseborg.fi/wp-json/wp/v2/planer?per_page=100&page=${page}&_fields=id,slug,link,lang,title`,
      { cache: "no-store" }
    )
    if (!response.ok) break

    const items = (await response.json()) as any[]
    if (!Array.isArray(items) || items.length === 0) break

    for (const item of items) {
      if (item.lang !== "fi") continue
      const title = (item.title?.rendered ?? "").replace(/&#8211;/g, "–").trim()
      if (!title || !item.link) continue
      links.push({ title, url: item.link, slug: item.slug })
    }

    if (items.length < 100) break
  }

  return links
}

async function fetchRaaseporiKaavaDetails(url: string) {
  const empty = { description: null, phase: "Kaavoituksen aloitus", contacts: [] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)
    $("script, style, nav, footer, header").remove()

    /*
     * h1 elää eri lohkossa (sivun yläbanneri) kuin varsinainen sisältö
     * (kuvaus, yhteystiedot, käsittelyvaihe), joten niitä ei voi kävellä
     * h1:n sisaruksina — sen sijaan käydään läpi litteä lista <main>-
     * elementin sisällä olevista otsikko-/kappale-elementeistä.
     */
    const items = $("main").first().find("h1,h2,h3,h4,p,li").toArray()

    const descriptionParts: string[] = []
    let contactText = ""
    let inContacts = false

    for (const item of items) {
      const tag = item.tagName
      if (tag === "h1") continue

      const text = $(item).text().replace(/\s+/g, " ").trim()

      if ((tag === "h2" || tag === "h4") && /lisätietoja/i.test(text)) {
        inContacts = true
        continue
      }
      if (tag === "h2") break

      if (inContacts) {
        contactText += " " + text
      } else if (tag === "p" && text && !/^etusivu/i.test(text)) {
        descriptionParts.push(text)
      }
    }

    const description = descriptionParts.join(" ").trim() || null

    const kasittelyHeading = $("h2")
      .filter((_, el2) => /käsittelyvaihe/i.test($(el2).text()))
      .first()
    const currentPhaseHeading = kasittelyHeading.length ? kasittelyHeading.next() : null
    const phase =
      currentPhaseHeading && currentPhaseHeading.length && currentPhaseHeading[0].tagName === "h4"
        ? currentPhaseHeading.text().replace(/\s+/g, " ").trim()
        : "Kaavoituksen aloitus"

    const normalizedContactText = contactText.replace(/\((?:at|ät)\)/gi, "@")

    const names = [...contactText.matchAll(RAASEPORI_TITLE_NAME_PATTERN)]
    const phones = [...contactText.matchAll(RAASEPORI_PHONE_PATTERN)].map((m) => m[1].trim())
    const emails = [...normalizedContactText.matchAll(RAASEPORI_EMAIL_PATTERN)].map((m) => m[1])

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] =
      names.map((match, index) => ({
        name: match[2].trim(),
        title: match[1],
        phone: phones[index] ?? null,
        email: emails[index] ?? null,
      }))

    if (contacts.length === 0 && emails.length > 0) {
      contacts.push({ name: null, title: "Kaavoitus", phone: phones[0] ?? null, email: emails[0] })
    }

    return { description, phase, contacts }
  } catch {
    return empty
  }
}

async function collectRaaseporiKaavaSource(source: DiscoverySource) {
  const links = await fetchRaaseporiPlanLinks()

  let saved = 0

  for (const link of links) {
    const details = await fetchRaaseporiKaavaDetails(link.url)
    const completed = /lainvoima|voimaantulo/i.test(details.phase ?? "")

    const rawText = JSON.stringify({ link, ...details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: link.title,
          document_url: link.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: link.title,
            kaava_tunnus: link.slug,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: links.length,
    documentsSaved: saved,
  }
}

/*
 * Raisio (Drupal) listaa "valmisteilla olevat asemakaavat" -linkit
 * tavallisena <li><a>-listana kaavoitussivun rungossa (ei erillistä
 * API:a eikä sitemapia jossa kaikki olisivat mukana). Sivuilla ei ole
 * erillistä vaihe-osiota — kaavan tilanne kerrotaan proosana kuvaus-
 * kappaleessa (esim. "Kaava on tullut vireille 2012..."), joten vaihe
 * päätellään samasta tekstistä avainsanahaulla.
 */
const RAISIO_LISTING_URL =
  "https://raisio.fi/fi/asuminen-ja-ymparisto/kaupunkisuunnittelu/kaavoitus-ja-maankaytto/asemakaavoitus"

function raisioNormalizeUrl(href: string): string {
  if (href.startsWith("/")) return `https://raisio.fi${href}`
  return href.replace(/^https?:\/\/(www\.)?raisio\.fi/, "https://raisio.fi")
}

function raisioPhaseFromText(text: string): string {
  if (/lainvoima|voimaantulo/i.test(text)) return "Lainvoimainen"
  if (/hyväksy/i.test(text)) return "Hyväksyminen"
  if (/ehdotus/i.test(text)) return "Ehdotus"
  if (/luonnos/i.test(text)) return "Luonnos"
  if (/osallistumis|arviointi/i.test(text)) return "Osallistumis- ja arviointisuunnitelma"
  if (/vireille/i.test(text)) return "Vireilletulo"
  return "Vireilletulo"
}

async function fetchRaisioPlanLinks(): Promise<{ title: string; url: string; slug: string }[]> {
  const response = await fetch(RAISIO_LISTING_URL, { cache: "no-store" })
  if (!response.ok) return []

  const html = await response.text()
  const $ = cheerio.load(html)

  const seen = new Set<string>()
  const links: { title: string; url: string; slug: string }[] = []

  $("li a").each((_, el) => {
    const href = $(el).attr("href")
    const title = $(el).text().replace(/\s+/g, " ").trim()
    if (!href || !title) return
    if (!/asemakaava/i.test(href)) return

    const url = raisioNormalizeUrl(href)
    if (seen.has(url)) return
    seen.add(url)

    const slug = url.replace(/\/$/, "").split("/").pop() ?? title
    links.push({ title, url, slug })
  })

  return links
}

async function fetchRaisioKaavaDetails(url: string) {
  const empty = { title: null, description: null, phase: "Vireilletulo", contacts: [] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const title = $("h1").first().text().replace(/\s+/g, " ").trim() || null

    const description =
      $(".field--name-body p")
        .map((_, el) => $(el).text().replace(/\s+/g, " ").trim())
        .get()
        .join(" ")
        .trim() || null

    const phase = raisioPhaseFromText(description ?? "")

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    $(".contact-card").each((_, card) => {
      const $card = $(card)
      const name = $card.find(".contact-card__title").first().text().replace(/\s+/g, " ").trim() || null
      const contactTitle =
        $card.find(".contact-card__subtitle").first().text().replace(/\s+/g, " ").trim() || null
      const phone = $card.find("a[href^='tel:']").first().attr("href")?.replace(/^tel:/, "") ?? null
      const email = $card.find("a[href^='mailto:']").first().attr("href")?.replace(/^mailto:/, "") ?? null
      if (name || phone || email) contacts.push({ name, title: contactTitle, phone, email })
    })

    return { title, description, phase, contacts }
  } catch {
    return empty
  }
}

async function collectRaisioKaavaSource(source: DiscoverySource) {
  const links = await fetchRaisioPlanLinks()

  let saved = 0

  for (const link of links) {
    const details = await fetchRaisioKaavaDetails(link.url)
    const title = details.title ?? link.title
    const completed = /lainvoima|voimaantulo/i.test(details.phase ?? "")

    const rawText = JSON.stringify({ link, ...details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: link.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: link.slug,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: links.length,
    documentsSaved: saved,
  }
}

/*
 * Lempäälän kaavasivut ovat WordPress-sivun 3309 lapsisivuja, ja
 * wp-json:in content.rendered-kenttä sisältää KOKO sivuston
 * navigaatiovalikon <li>-elementteinä ennen varsinaista sisältöä —
 * siksi kuvaus/vaihe/yhteystiedot poimitaan vain h1-h5/p-elementeistä,
 * ei <li>:stä. Vaiheotsikot (h4, esim. "Ehdotus:", "Luonnos:") eivät
 * ole luotettavasti kronologisessa järjestyksessä sivulla, joten
 * nykyinen vaihe päätellään edistyneimmästä otsikosta prioriteetti-
 * järjestyksessä, ei sijainnista.
 */
const LEMPAALA_PARENT_PAGE_ID = 3309

function lempaalaPhaseFromHeadings(headings: string[]): string {
  const combined = headings.join(" ").toLowerCase()
  if (/voimaan|lainvoima/.test(combined)) return "Voimaantulo"
  if (/hyväksy/.test(combined)) return "Hyväksyminen"
  if (/ehdotus/.test(combined)) return "Ehdotus"
  if (/luonnos/.test(combined)) return "Luonnos"
  if (/osallistumis|arviointi|arvionti/.test(combined)) return "Osallistumis- ja arviointisuunnitelma"
  return "Vireilletulo"
}

async function fetchLempaalaPlanPages(): Promise<{ title: string; url: string; slug: string; content: string }[]> {
  const response = await fetch(
    `https://www.lempaala.fi/wp-json/wp/v2/pages?parent=${LEMPAALA_PARENT_PAGE_ID}&per_page=100&_fields=id,slug,link,title,content`,
    { cache: "no-store" }
  )
  if (!response.ok) return []

  const pages = (await response.json()) as any[]
  return pages
    .map((p) => ({
      title: (p.title?.rendered ?? "").trim(),
      url: p.link,
      slug: p.slug,
      content: p.content?.rendered ?? "",
    }))
    .filter((p) => p.title && p.url)
}

function parseLempaalaKaavaDetails(content: string) {
  const empty = { title: null, description: null, phase: "Vireilletulo", contacts: [] }

  try {
    const $ = cheerio.load(content)

    const title = $("h1").first().text().replace(/\s+/g, " ").trim() || null

    const descriptionParts: string[] = []
    let el = $("h1").first().length ? $("h1").first() : $("h2").first()
    el = el.next()
    while (el.length && el[0].tagName !== "h3" && el[0].tagName !== "h4") {
      if (el[0].tagName === "p") {
        const text = $(el).text().replace(/\s+/g, " ").trim()
        if (text && !/^oheisista|^tutustu|^lataa\b|pdf-tiedosto(sta)?$/i.test(text)) {
          descriptionParts.push(text)
        }
      }
      el = el.next()
    }
    const description = descriptionParts.join(" ").trim() || null

    const phaseHeadings = $("h4")
      .map((_, h) => $(h).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((t) => !/^tiedotteet|^aineistot/i.test(t))
    const phase = lempaalaPhaseFromHeadings(phaseHeadings)

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    $(".gb-sidebar-contact-card").each((_, card) => {
      const $card = $(card)
      const rawName = $card.find(".person-name").first().text().replace(/\s+/g, " ").trim()
      const tokens = rawName.split(" ")
      const name = tokens.length === 2 ? `${tokens[1]} ${tokens[0]}` : rawName || null
      const contactTitle = $card.find(".person-title").first().text().replace(/\s+/g, " ").trim() || null
      const phone = $card.find("a[href^='tel:']").first().text().trim() || null
      const email =
        $card
          .find("a")
          .filter((_, a) => /^mailto:/i.test($(a).attr("href") ?? ""))
          .first()
          .attr("href")
          ?.replace(/^mailto:/i, "") ?? null
      if (name || phone || email) contacts.push({ name, title: contactTitle, phone, email })
    })

    return { title, description, phase, contacts }
  } catch {
    return empty
  }
}

async function collectLempaalaKaavaSource(source: DiscoverySource) {
  const links = await fetchLempaalaPlanPages()

  let saved = 0

  for (const link of links) {
    const details = parseLempaalaKaavaDetails(link.content)
    const title = details.title ?? link.title
    const completed = /voimaan|lainvoima/i.test(details.phase ?? "")

    const rawText = JSON.stringify({ link, ...details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: link.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: link.slug,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: links.length,
    documentsSaved: saved,
  }
}

const KAJAANI_LISTING_URL = "https://kajaani.cloudnc.fi/fi-FI/Kaavat"
const KAJAANI_CONTACT_PATTERN =
  /([A-Za-zÅÄÖåäö][^,]*?),?\s*(?:p\.\s*)?(\d[\d\s-]{4,14}\d)[,\s]+([\w.+-]+@[\w.-]+\.\w+)/g

function kajaaniSplitNameTitle(raw: string): { name: string | null; title: string | null } {
  const cleaned = raw.replace(/^(ja|tai)\s+/i, "").trim()
  const tokens = cleaned.split(/\s+/)
  if (tokens.length <= 2) return { name: cleaned || null, title: null }

  const name = tokens.slice(-2).join(" ")
  const title = tokens.slice(0, -2).join(" ")
  return { name: name || null, title: title || null }
}

async function fetchKajaaniKaavaDetails(url: string) {
  const empty = { kaavaTunnus: null, phase: null, description: null, contacts: [] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const kaavaTunnus = $(".kaavatunnus-info").first().text().replace(/\s+/g, " ").trim() || null
    const description = $(".kuulutus-info").first().text().replace(/\s+/g, " ").trim() || null

    const phase = $(".phase.box").first().find(".phase-header b").first().text().replace(/\s+/g, " ").trim() || null

    const contactsRaw = $(".yhteyshenkilo-info")
      .first()
      .text()
      .replace(/\(at\)/gi, "@")
      .replace(/\s+/g, " ")
      .trim()
    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    for (const match of contactsRaw.matchAll(KAJAANI_CONTACT_PATTERN)) {
      const { name, title } = kajaaniSplitNameTitle(match[1])
      contacts.push({
        name,
        title,
        phone: match[2].trim(),
        email: match[3].trim(),
      })
    }

    return { kaavaTunnus, phase, description, contacts }
  } catch {
    return empty
  }
}

async function collectKajaaniKaavaSource(source: DiscoverySource) {
  const response = await fetch(KAJAANI_LISTING_URL, { cache: "no-store" })
  if (!response.ok) return { documentsFound: 0, documentsSaved: 0 }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: { title: string; url: string; completed: boolean }[] = []

  $("a[href*='content/']").each((_, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().replace(/\s+/g, " ").trim()
    if (!href || !text) return

    const match = text.match(/^(Vireille tulleet asemakaavat|Voimaan tulleet asemakaavat):\s*(.+)$/)
    if (!match) return

    const title = match[2].replace(/\s*-\s*\d{1,2}\.\d{1,2}\.\d{4}$/, "").trim()
    const url = new URL(href, "https://kajaani.cloudnc.fi").toString()
    const completed = match[1] === "Voimaan tulleet asemakaavat"

    items.push({ title, url, completed })
  })

  let saved = 0

  for (const item of items) {
    const details = await fetchKajaaniKaavaDetails(item.url)

    const rawText = JSON.stringify({ item, ...details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: details.kaavaTunnus,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed: item.completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(item.completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Hollola käyttää samaa CloudNC-alustaa kuin Kajaani (samat CSS-luokat:
 * .kaavatunnus-info, .yhteyshenkilo-info, .phase.box .phase-header b),
 * mutta kuvaus on eri paikassa — .kuulutus-info sisältää AJANKOHTAISTA-
 * tilapäivityksen, ei tavoitekuvausta, joka löytyy sen sijaan omasta
 * .basic-content-lohkosta.
 */
const HOLLOLA_LISTING_URL = "https://hollola.cloudnc.fi/fi-FI/Kaavat/Aktiiviset"
const HOLLOLA_LINK_PATTERN = /^\/fi-FI\/content\/\d+\/12722$/
const HOLLOLA_PHONE_PATTERN = /Lisätietoja antaa[^.]*?puh\.?\s*(\d[\d ]{6,14}\d)/i

async function fetchHollolaKaavaDetails(url: string) {
  const empty = { kaavaTunnus: null as string | null, phase: null as string | null, description: null as string | null, contacts: [] as any[] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const kaavaTunnus = $(".kaavatunnus-info").first().text().replace(/\s+/g, " ").trim() || null

    const description =
      $(".basic-content p")
        .map((_, p) => $(p).text().replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean)
        .slice(0, 3)
        .join(" ") || null

    const phase =
      $(".phase.box").first().find(".phase-header b").first().text().replace(/\s+/g, " ").trim() || null

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    const yhteyshenkiloText = $(".yhteyshenkilo-info").first().text().replace(/\s+/g, " ").trim()
    if (yhteyshenkiloText) {
      const { name, title } = kajaaniSplitNameTitle(yhteyshenkiloText)
      const phoneMatch = $("body").text().match(HOLLOLA_PHONE_PATTERN)
      contacts.push({ name, title, phone: phoneMatch ? phoneMatch[1].trim() : null, email: null })
    }

    return { kaavaTunnus, phase, description, contacts }
  } catch {
    return empty
  }
}

async function collectHollolaKaavaSource(source: DiscoverySource) {
  const response = await fetch(HOLLOLA_LISTING_URL, { cache: "no-store" })
  if (!response.ok) return { documentsFound: 0, documentsSaved: 0 }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: { title: string; url: string }[] = []
  const seen = new Set<string>()

  $("a[href*='content/']").each((_, el) => {
    const href = $(el).attr("href")
    const text = $(el).text().replace(/\s+/g, " ").trim()
    if (!href || !text) return
    if (!HOLLOLA_LINK_PATTERN.test(href)) return
    if (seen.has(href)) return

    seen.add(href)
    const url = new URL(href, "https://hollola.cloudnc.fi").toString()
    items.push({ title: text, url })
  })

  let saved = 0

  for (const item of items) {
    const details = await fetchHollolaKaavaDetails(item.url)
    const kaavaTunnus = details.kaavaTunnus ?? item.url.match(/content\/(\d+)/)?.[1] ?? null
    const completed = /voimaantulo|lainvoima/i.test(details.phase ?? "")

    const rawText = JSON.stringify({ item, ...details, kaavaTunnus })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: kaavaTunnus,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

const KANGASALA_PHASE_HEADING_ORDER = [
  { pattern: /voimaan|lainvoima/i, label: "Voimaantulo" },
  { pattern: /hyväksy/i, label: "Hyväksyminen" },
  { pattern: /ehdotus/i, label: "Kaavaehdotus" },
  { pattern: /luonnos|selostus/i, label: "Kaavaluonnos" },
  { pattern: /osallistumis/i, label: "Osallistumis- ja arviointisuunnitelma" },
]

function kangasalaPhaseFromHeadings(headings: string[]): string | null {
  for (const stage of KANGASALA_PHASE_HEADING_ORDER) {
    if (headings.some((h) => stage.pattern.test(h))) return stage.label
  }
  return null
}

async function collectKangasalaKaavaSource(source: DiscoverySource) {
  const response = await fetch(
    "https://www.kangasala.fi/wp-json/wp/v2/pages?parent=843&per_page=100&_fields=id,title,link,content",
    { cache: "no-store" }
  )
  if (!response.ok) return { documentsFound: 0, documentsSaved: 0 }

  const pages = (await response.json()) as any[]

  let saved = 0

  for (const page of pages) {
    const title = (page.title?.rendered ?? "").replace(/\s+/g, " ").trim()
    if (!title) continue

    const kaavaTunnus = title.match(/^(\d+)\s/)?.[1] ?? null
    const url = page.link as string

    const $ = cheerio.load(page.content?.rendered ?? "")

    const headings: string[] = []
    $("h2").each((_, el) => {
      headings.push($(el).text().replace(/\s+/g, " ").trim())
    })
    const phase = kangasalaPhaseFromHeadings(headings)

    let goalPara: string | null = null
    let firstPara: string | null = null
    $("p").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (text.length < 20 || /^(Jaa|Kopioi)/i.test(text)) return
      if (!firstPara) firstPara = text
      if (!goalPara && /tavoit/i.test(text)) goalPara = text
    })
    const description = goalPara ?? firstPara ?? null

    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []
    $(".card-contact").each((_, card) => {
      const $card = $(card)
      const name =
        $card.find(".card-contact__item--content-name").first().text().replace(/\s+/g, " ").trim() || null
      const contactTitle =
        $card.find(".card-contact__item--content-job-title").first().text().replace(/\s+/g, " ").trim() || null
      const phone = $card.find("a[href^='tel:']").first().attr("href")?.replace(/^tel:/, "") ?? null
      const email = $card.find("a[href^='mailto:']").first().attr("href")?.replace(/^mailto:/, "") ?? null
      if (name || phone || email) contacts.push({ name, title: contactTitle, phone, email })
    })

    const completed = /voimaan|lainvoima/i.test(phase ?? "")

    const rawText = JSON.stringify({ url, title, kaavaTunnus, phase, description, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: kaavaTunnus,
            phase,
            description,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: pages.length,
    documentsSaved: saved,
  }
}

const YLOJARVI_LISTING_URL = "https://www.ylojarvi.fi/asemakaavat-vireilla/"
const YLOJARVI_PHASE_ORDER = [
  { pattern: /hyväksymisvaihe|hyväksymispäätös|voimaan|lainvoima/i, label: "Hyväksymisvaihe" },
  { pattern: /ehdotusvaihe/i, label: "Ehdotusvaihe" },
  { pattern: /luonnosvaihe/i, label: "Luonnosvaihe" },
  { pattern: /aloitusvaihe/i, label: "Aloitusvaihe" },
  { pattern: /osallistumis/i, label: "Osallistumis- ja arviointisuunnitelma" },
]

function ylojarviPhaseFromText(text: string): string | null {
  for (const stage of YLOJARVI_PHASE_ORDER) {
    if (stage.pattern.test(text)) return stage.label
  }
  return null
}

const YLOJARVI_TITLE_NAME_PATTERN =
  /(kaavasuunnittelija|kaavoitusarkkitehti|projektiarkkitehti|kaavoituspäällikkö|maisemasuunnittelija|kaupunginarkkitehti)\s+(\p{Lu}[\p{L}-]+(?:\s\p{Lu}[\p{L}-]+)+)/gu
const YLOJARVI_PHONE_PATTERN = /\b(0\d{2}[\s-]?\d{3,4}[\s-]?\d{3,4})\b/g

function ylojarviStripDiacritics(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/å/g, "a")
}

function ylojarviDeriveEmail(name: string) {
  return name.trim().split(/\s+/).map(ylojarviStripDiacritics).join(".") + "@ylojarvi.fi"
}

function ylojarviParseContactsFromParagraph(
  text: string
): { name: string | null; title: string | null; phone: string | null; email: string | null }[] {
  const people = [...text.matchAll(YLOJARVI_TITLE_NAME_PATTERN)]
  if (people.length === 0) return []

  const phones = [...text.matchAll(YLOJARVI_PHONE_PATTERN)].map((m) => m[1].trim())
  const emailMatch = text.match(/([\w.-]+@ylojarvi\.fi)/)
  const genericEmail =
    emailMatch && emailMatch[1] !== "etunimi.sukunimi@ylojarvi.fi" ? emailMatch[1] : null

  return people.map((match, index) => ({
    name: match[2].trim(),
    title: match[1],
    phone: phones[index] ?? phones[0] ?? null,
    email: genericEmail ?? ylojarviDeriveEmail(match[2]),
  }))
}

async function fetchYlojarviKaavaDetails(url: string) {
  const empty = { phase: null, description: null, contacts: [] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const candidates: string[] = []
    const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []

    $("p").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (text.length < 20) return

      contacts.push(...ylojarviParseContactsFromParagraph(text))

      if (/^(Jaa|Kopioi|Löysitkö|Ylöjärven kaupunki \|)/i.test(text)) return
      if (/nähtävillä|yleisötilaisuus|valmistelee|valmistellaan|lisätietoja.*antaa|lisätietoja.*antavat|viimeksi muokattu|päätti.*käynnistää|vireille tulee|hyväksytty:\s*$/i.test(text)) return

      candidates.push(text)
    })

    const description =
      candidates.length > 0
        ? candidates.reduce((longest, current) => (current.length > longest.length ? current : longest))
        : null

    const kaavaAineistoHeading = $("h3")
      .filter((_, el) => $(el).text().trim() === "Kaava-aineisto")
      .first()
    const kaavaAineistoText = kaavaAineistoHeading.length
      ? kaavaAineistoHeading.nextAll().slice(0, 8).text().replace(/\s+/g, " ")
      : ""
    const phase = ylojarviPhaseFromText(`${kaavaAineistoText} ${description ?? ""}`)

    return { phase, description, contacts }
  } catch {
    return empty
  }
}

async function collectYlojarviKaavaSource(source: DiscoverySource) {
  const response = await fetch(YLOJARVI_LISTING_URL, { cache: "no-store" })
  if (!response.ok) return { documentsFound: 0, documentsSaved: 0 }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: { title: string; url: string; slug: string }[] = []
  $(".sub-page-list .sub-page-item a").each((_, el) => {
    const href = $(el).attr("href")
    const title = $(el).text().replace(/\s+/g, " ").trim()
    if (!href || !title) return

    const slug = href.replace(/\/$/, "").split("/").pop() ?? null
    if (!slug) return

    items.push({ title, url: href, slug })
  })

  let saved = 0

  for (const item of items) {
    const details = await fetchYlojarviKaavaDetails(item.url)
    const completed = /voimaan|lainvoima/i.test(details.phase ?? "")

    const rawText = JSON.stringify({ item, ...details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: item.slug,
            phase: details.phase,
            description: details.description,
            contacts: details.contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Savonlinnan kaavamuutokset eivät elä yhdellä "vireillä"-listaussivulla,
 * vaan jokainen vaihe (vireille, nähtävillä, voimaantulo) julkaistaan
 * omana erillisenä kuulutus-postauksenaan (custom post type
 * "announcements", ei erillistä per-kaava-sivua). Sama hanke voi siis
 * esiintyä feedissä useaan kertaan eri ajankohtina samalla otsikolla
 * mutta eri slugilla (esim. "asemakaavan-muutos-savola-2" ja "...-3").
 * Koska feedissä on vuosikausien historiaa ilman luotettavaa signaalia
 * siitä, onko vanha (ilman myöhempää voimaantulo-kuulutusta jäänyt)
 * hanke yhä oikeasti vireillä vai vain unohtunut kuulutusjärjestelmästä,
 * rajataan poiminta tuoreisiin kuulutuksiin (viimeiset ~15 kk) datan
 * laadun varmistamiseksi — vanhempi historia jätetään tarkoituksella
 * pois sen sijaan että arvattaisiin niiden tila väärin. "Voimaantulo"-
 * ja "poikkeamis"-otsikot suodatetaan pois kokonaan (jo lainvoimaiset
 * kaavat / eri asiatyyppi), ja mahdolliset toistuvat postaukset samasta
 * hankkeesta karsitaan pitämällä vain tuorein otsikkoa kohden.
 */
const SAVONLINNA_ANNOUNCEMENTS_URL =
  "https://www.savonlinna.fi/wp-json/wp/v2/announcements?search=asemakaava&per_page=100&_fields=id,slug,title,link,date,content"
const SAVONLINNA_MAX_AGE_MONTHS = 15

const SAVONLINNA_PHASE_ORDER = [
  { pattern: /hyväksy|voimaan|lainvoima/i, label: "Hyväksyminen" },
  { pattern: /ehdotus/i, label: "Kaavaehdotus" },
  { pattern: /luonnos/i, label: "Kaavaluonnos" },
  { pattern: /osallistumis/i, label: "Osallistumis- ja arviointisuunnitelma" },
]

function savonlinnaPhaseFromText(text: string): string | null {
  for (const stage of SAVONLINNA_PHASE_ORDER) {
    if (stage.pattern.test(text)) return stage.label
  }
  return null
}

const SAVONLINNA_NAME_PHONE_PATTERN = /([\p{Lu}][\p{L}-]+\s[\p{Lu}][\p{L}-]+)\s*,?\s*p\.?\s*(\d[\d\s]{4,12}\d)/u

function savonlinnaParseContacts(bodyText: string) {
  const match = bodyText.match(/Lisätietoja:?\s*([^\n]+)/i)
  if (!match) return []

  const segments = match[1].split(";").map((segment) => segment.trim())
  const contacts: { name: string | null; title: string | null; phone: string | null; email: string | null }[] = []

  for (const segment of segments) {
    const nameMatch = segment.match(SAVONLINNA_NAME_PHONE_PATTERN)
    if (!nameMatch) continue

    const emailMatch = segment.match(/([\w.-]+@[\w.-]+\.\w+)/)
    contacts.push({
      name: nameMatch[1].trim(),
      title: null,
      phone: nameMatch[2].trim(),
      email: emailMatch ? emailMatch[1] : null,
    })
  }

  return contacts
}

async function collectSavonlinnaKaavaSource(source: DiscoverySource) {
  const response = await fetch(SAVONLINNA_ANNOUNCEMENTS_URL, { cache: "no-store" })
  if (!response.ok) return { documentsFound: 0, documentsSaved: 0 }

  const posts = (await response.json()) as any[]

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - SAVONLINNA_MAX_AGE_MONTHS)

  const relevant = posts.filter((post) => {
    const title = post.title?.rendered ?? ""
    if (/voimaantulo|poikkeamis/i.test(title)) return false
    return new Date(post.date) >= cutoff
  })

  const latestByTitle = new Map<string, any>()
  for (const post of relevant) {
    const key = (post.title?.rendered ?? "").trim()
    const existing = latestByTitle.get(key)
    if (!existing || new Date(post.date) > new Date(existing.date)) {
      latestByTitle.set(key, post)
    }
  }

  let saved = 0

  for (const post of latestByTitle.values()) {
    const title = (post.title?.rendered ?? "").trim()
    if (!title) continue

    const $ = cheerio.load(post.content?.rendered ?? "")
    const bodyText = $.root().text().replace(/\s+/g, " ").trim()

    let description: string | null = null
    $("p").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (description) return
      if (text.length < 20) return
      if (/^(Lisätietoja|Mahdolliset|Savonlinnassa)/i.test(text)) return
      description = text
    })

    const phase = savonlinnaPhaseFromText(bodyText)
    const completed = /voimaan|lainvoima/i.test(phase ?? "")
    const contacts = savonlinnaParseContacts(bodyText)

    const rawText = JSON.stringify({ title, url: post.link, phase, description, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: post.link,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            phase,
            description,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: latestByTitle.size,
    documentsSaved: saved,
  }
}

/*
 * Lahden "kaavatyökohteet"-listaussivu antaa vain otsikon ja linkin —
 * kaikki muu tieto (tunnus, vaihe, kuvaus, yhteystiedot) pitää hakea
 * jokaisen hankkeen omalta sivulta, siksi sama rate-limitoitu
 * yksityiskohtahaku-malli kuin Tampereella/Turulla. Osa listatuista
 * linkeistä on jo edennyt lainvoimaiseksi ja uudelleenohjautuu polkuun
 * "/asemakaavoitus/lainvoimaiset-asemakaavat/" — nämä merkitään
 * completed:iksi ja jätetään pysyvästi faktojen/tunnistuksen
 * ulkopuolelle (facts_extracted_at/identity_resolved_at asetetaan
 * suoraan), koska ne eivät enää ole aktiivisia liidejä.
 */
const LAHTI_MAX_DETAIL_FETCHES_PER_RUN = 5

type LahtiContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

type LahtiDetails = {
  completed: boolean
  kaavaTunnus: string | null
  planType: string | null
  vireilletulo: string | null
  applicant: string | null
  phase: string | null
  description: string | null
  contacts: LahtiContact[]
  center: { x: number; y: number } | null
}

async function fetchLahtiDetails(url: string): Promise<LahtiDetails> {
  const empty: LahtiDetails = {
    completed: false,
    kaavaTunnus: null,
    planType: null,
    vireilletulo: null,
    applicant: null,
    phase: null,
    description: null,
    contacts: [],
    center: null,
  }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const completed = response.url.includes("/lainvoimaiset-asemakaavat/")
    const $ = cheerio.load(html)

    const table: Record<string, string> = {}
    $("table.tablepress tr").each((_, tr) => {
      const cells = $(tr).find("td")
      const label = $(cells[0]).text().trim()
      const value = $(cells[1]).text().trim()
      if (label) table[label] = value
    })

    const stages: { title: string; status: string | null }[] = []
    $("li.accordion-row.phases-single .accordion-title-text").each((_, el) => {
      const $el = $(el)
      const status = $el.find(".phase-description").text().trim() || null
      const clone = $el.clone()
      clone.find(".phase-description").remove()
      const title = clone.text().trim()
      if (title) stages.push({ title, status })
    })

    const phase =
      stages.find((s) => s.status === "Meneillään")?.title ??
      (completed ? "Voimaantulo" : null)

    const description = $(".acf-block-text-content .content p").first().text().trim() || null

    const contacts: LahtiContact[] = []
    $("li.contact-card").each((_, li) => {
      const $li = $(li)
      const name =
        $li.find(".contact-card__name p.has-text-weight-semibold.contact-detail").first().text().trim() ||
        null
      const title =
        $li.find(".contact-card__name p.contact-detail.is-size-6").first().text().trim() || null
      const phone = $li.find("a[href^='tel:']").attr("href")?.replace("tel:", "") ?? null
      const email = $li.find("a[href^='mailto:']").attr("href")?.replace("mailto:", "") ?? null
      if (name) contacts.push({ name, title, phone, email })
    })

    /*
     * Karttaupotuksen "cp"-parametri on muotoa pohjoinen,itä
     * (GK26FIN-yksiköissä), eli päinvastainen järjestys kuin
     * gk26ToWgs84(x, y) odottaa.
     */
    const iframeSrc =
      $("iframe[data-src*='kartta.lahti.fi']").attr("data-src") ??
      $("iframe[src*='kartta.lahti.fi']").attr("src") ??
      ""
    const cpMatch = iframeSrc.match(/cp=([\d.]+),([\d.]+)/)
    const center = cpMatch ? { y: parseFloat(cpMatch[1]), x: parseFloat(cpMatch[2]) } : null

    return {
      completed,
      kaavaTunnus: table["Kaavatunnus"] || null,
      planType: table["Kaavatyön tyyppi"] || null,
      vireilletulo: table["Vireilletulo"] || null,
      applicant: table["Kaava-aloitteen tekijä"] || null,
      phase,
      description,
      contacts,
      center,
    }
  } catch {
    return empty
  }
}

async function collectLahtiSource(source: DiscoverySource) {
  const listingResponse = await fetch(source.url, { cache: "no-store" })

  if (!listingResponse.ok) {
    throw new Error(
      `Lahden kaavalistan haku epäonnistui: ${listingResponse.status} ${listingResponse.statusText}`
    )
  }

  const listingHtml = await listingResponse.text()
  const $listing = cheerio.load(listingHtml)

  const items: { url: string; title: string }[] = []
  const seen = new Set<string>()

  $listing("a[href*='/asemakaavoitus/kaavatyokohteet/']").each((_, el) => {
    const href = $listing(el).attr("href")
    if (!href) return

    const url = href.startsWith("http") ? href : `https://www.lahti.fi${href}`
    if (!/\/asemakaavoitus\/kaavatyokohteet\/[a-z0-9-]+\/?$/.test(url)) return
    if (seen.has(url)) return

    const title = $listing(el).text().trim()
    if (!title) return

    seen.add(url)
    items.push({ url, title })
  })

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description || row.raw_payload?.completed) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let saved = 0
  let detailFetches = 0

  for (const item of items) {
    const known = knownDetails.get(item.url)

    let details: LahtiDetails | null = known
      ? {
          completed: known.completed ?? false,
          kaavaTunnus: known.kaava_tunnus ?? null,
          planType: known.plan_type ?? null,
          vireilletulo: known.vireilletulo ?? null,
          applicant: known.applicant ?? null,
          phase: known.phase ?? null,
          description: known.description ?? null,
          contacts: known.contacts ?? [],
          center: known.center ?? null,
        }
      : null

    let detailsAttempted = Boolean(known)

    if (!detailsAttempted && detailFetches < LAHTI_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchLahtiDetails(item.url)
      detailFetches += 1
      detailsAttempted = details.description !== null || details.completed
    }

    const isCompleted = detailsAttempted && details?.completed === true

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            ...(detailsAttempted && details
              ? {
                  kaava_tunnus: details.kaavaTunnus,
                  plan_type: details.planType,
                  vireilletulo: details.vireilletulo,
                  applicant: details.applicant,
                  phase: details.phase,
                  description: details.description,
                  contacts: details.contacts,
                  center: details.center,
                  completed: details.completed,
                }
              : {}),
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(isCompleted
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Porin "vireillä olevat asemakaavat" -listaussivu (WordPress) ryhmittelee
 * kaavat vaiheittain otsikoiden VIREILLETULOVAIHE/LUONNOSVAIHE/EHDOTUSVAIHE
 * alle — vaihe saadaan siis suoraan listalta, ilman yksityiskohtahakua.
 * Yksityiskohtasivut (vanha ASP.NET-sovellus pori.cloudnc.fi) ovat
 * poikkeuksellisen suuria (n. 2-3 Mt, upotettu base64-kuva), joten
 * niistä ei koskaan tallenneta koko HTML:ää — vain poimitut kentät.
 */
const PORI_MAX_DETAIL_FETCHES_PER_RUN = 5

type PoriContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

/*
 * "Yhteyshenkilö"-kenttä on vapaamuotoista tekstiä jonka muoto vaihtelee
 * hankkeittain — havaittu ainakin: "Titteli Nimi p. puhelin",
 * "Titteli Nimi, p. puhelin" ja "Nimi, Titteli, puhelin". Useampi
 * henkilö on eroteltu "/"-merkillä. Koska titteli ja nimi eivät ole
 * aina samassa järjestyksessä, nimi tunnistetaan rakenteesta (kaksi
 * isolla alkukirjaimella alkavaa sanaa) sen sijaan että oletettaisiin
 * kiinteä sijainti.
 */
function isPoriPersonName(value: string): boolean {
  return /^[A-ZÄÖÅ][\wäöåÄÖÅ'-]*(?:-[A-ZÄÖÅ][\wäöåÄÖÅ'-]*)?\s+[A-ZÄÖÅ][\wäöåÄÖÅ'-]*(?:-[A-ZÄÖÅ][\wäöåÄÖÅ'-]*)?$/.test(
    value.trim()
  )
}

function splitPoriTitleAndName(value: string): { title: string | null; name: string } {
  const match = value.match(
    /^(.*?)\s*([A-ZÄÖÅ][\wäöåÄÖÅ'-]*(?:-[A-ZÄÖÅ][\wäöåÄÖÅ'-]*)?\s+[A-ZÄÖÅ][\wäöåÄÖÅ'-]*(?:-[A-ZÄÖÅ][\wäöåÄÖÅ'-]*)?)$/
  )
  if (match && match[2]) return { title: match[1].trim() || null, name: match[2].trim() }
  return { title: null, name: value.trim() }
}

function parsePoriContacts(text: string | null): PoriContact[] {
  if (!text || !text.trim()) return []

  return text
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const commaParts = part.split(",").map((s) => s.trim()).filter(Boolean)

      if (commaParts.length >= 2) {
        const last = commaParts[commaParts.length - 1]
        const phoneMatch = last.match(/^(?:p\.?\s*)?(\d[\d\s]{4,})$/)

        if (phoneMatch) {
          const phone = phoneMatch[1].replace(/\s+/g, " ").trim()
          const rest = commaParts.slice(0, -1)

          if (rest.length === 2) {
            if (isPoriPersonName(rest[0]) && !isPoriPersonName(rest[1])) {
              return { name: rest[0], title: rest[1] || null, phone, email: null }
            }
            if (isPoriPersonName(rest[1]) && !isPoriPersonName(rest[0])) {
              return { name: rest[1], title: rest[0] || null, phone, email: null }
            }
          }

          const { title, name } = splitPoriTitleAndName(rest.join(" "))
          return { name, title, phone, email: null }
        }
      }

      const spaceMatch = part.match(/^(.*?)\s+p\.?\s*(\d[\d\s]{4,})$/)
      if (spaceMatch) {
        const { title, name } = splitPoriTitleAndName(spaceMatch[1].trim())
        return { name, title, phone: spaceMatch[2].replace(/\s+/g, " ").trim(), email: null }
      }

      return { name: part, title: null, phone: null, email: null }
    })
}

type PoriDetails = {
  kaavaTunnus: string | null
  applicant: string | null
  sijainti: string | null
  tavoitteet: string | null
  decisionMaker: string | null
  contacts: PoriContact[]
}

async function fetchPoriDetails(url: string): Promise<PoriDetails> {
  const empty: PoriDetails = {
    kaavaTunnus: null,
    applicant: null,
    sijainti: null,
    tavoitteet: null,
    decisionMaker: null,
    contacts: [],
  }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const kaavaTunnus = $(".kaavatunnus-info").first().text().trim() || null
    const yhteyshenkilo = $(".yhteyshenkilo-info").first().text().trim() || null

    const sections: Record<string, string> = {}
    $(".basic-content h2").each((_, h2) => {
      const label = $(h2).text().trim()
      const value = $(h2).next("p").text().trim()
      if (label) sections[label] = value
    })

    return {
      kaavaTunnus,
      applicant: null,
      sijainti: sections["Sijainti"] || null,
      tavoitteet: sections["Kaavan tavoitteet"] || null,
      decisionMaker: sections["Hyväksyvä taho"] || null,
      contacts: parsePoriContacts(yhteyshenkilo),
    }
  } catch {
    return empty
  }
}

async function collectPoriSource(source: DiscoverySource) {
  const listingResponse = await fetch(source.url, { cache: "no-store" })

  if (!listingResponse.ok) {
    throw new Error(
      `Porin kaavalistan haku epäonnistui: ${listingResponse.status} ${listingResponse.statusText}`
    )
  }

  const listingHtml = await listingResponse.text()
  const $listing = cheerio.load(listingHtml)

  const PHASE_HEADINGS: Record<string, string> = {
    VIREILLETULOVAIHE: "Vireilletulovaihe",
    LUONNOSVAIHE: "Luonnosvaihe",
    EHDOTUSVAIHE: "Ehdotusvaihe",
  }

  const items: { url: string; title: string; phase: string }[] = []

  let currentPhase: string | null = null

  $listing(".wp-block-heading, ul.wp-block-list li").each((_, el) => {
    const $el = $listing(el)

    if ($el.is("h3")) {
      const headingText = $el.text().trim().toUpperCase()
      if (PHASE_HEADINGS[headingText]) {
        currentPhase = PHASE_HEADINGS[headingText]
      }
      return
    }

    if (!currentPhase) return

    const link = $el.find("a[href*='/Kaavat/Asemakaava_vireilla/']").first()
    const href = link.attr("href")
    if (!href) return

    const url = href.split("(")[0]
    const title = $el.text().replace(/\s+/g, " ").trim()
    if (!title) return

    items.push({ url, title, phase: currentPhase })
  })

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.kaava_tunnus) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let saved = 0
  let detailFetches = 0
  const seenUrls = new Set<string>()

  for (const item of items) {
    if (seenUrls.has(item.url)) continue
    seenUrls.add(item.url)

    const known = knownDetails.get(item.url)

    let details: PoriDetails | null = known
      ? {
          kaavaTunnus: known.kaava_tunnus ?? null,
          applicant: known.applicant ?? null,
          sijainti: known.sijainti ?? null,
          tavoitteet: known.tavoitteet ?? null,
          decisionMaker: known.decision_maker ?? null,
          contacts: known.contacts ?? [],
        }
      : null

    let detailsAttempted = Boolean(known)

    if (!detailsAttempted && detailFetches < PORI_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchPoriDetails(item.url)
      detailFetches += 1
      detailsAttempted = details.kaavaTunnus !== null
    }

    const description = [details?.sijainti, details?.tavoitteet].filter(Boolean).join("\n\n") || null

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            phase: item.phase,
            ...(detailsAttempted && details
              ? {
                  kaava_tunnus: details.kaavaTunnus,
                  sijainti: details.sijainti,
                  tavoitteet: details.tavoitteet,
                  description,
                  decision_maker: details.decisionMaker,
                  contacts: details.contacts,
                }
              : {}),
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Oulun "suunnitelmat ja kaavahankkeet" -listaussivu (Drupal Views,
 * ?type=73=asemakaava) antaa jo listalta tunnuksen ja kaupunginosan
 * ilman yksityiskohtahakua. Sivutuksessa ei ole "viimeksi muokattu"
 * -järjestystä (kuten ei Väylävirastollakaan), joten koko ~167 hankkeen
 * katalogi kierrätetään päivämäärään sidotulla kiertävällä
 * sivuosoittimella. Yksityiskohtasivulta haetaan kuvaus, nykyinen vaihe
 * (paragraph jolla luokka "ongoing") ja yhteystiedot — jos yhtään
 * vaihetta ei ole "ongoing" tai "upcoming" (kaikki "ready"), hanke on jo
 * valmis eikä enää aktiivinen liidi, joten se merkitään completed:iksi
 * ja jätetään pysyvästi faktojen/tunnistuksen ulkopuolelle. Karttaupotus
 * käyttää tuntematonta paikallista koordinaattimuotoa (esim.
 * "cp=7204888,472056" ei vastaa TM35FIN:iä eikä muiden kaupunkien
 * GK-vyöhykemuotoa) — koordinaatteja ei siksi poimita, samaan tapaan
 * kuin Kreatella/Väylävirastolla.
 */
const OULU_LISTING_BASE = "https://www.ouka.fi/suunnitelmat-ja-kaavahankkeet"
const OULU_PAGES_PER_RUN = 2
const OULU_MAX_DETAIL_FETCHES_PER_RUN = 5

type OuluListingItem = {
  url: string
  title: string
  kaavaTunnus: string | null
  region: string | null
}

async function fetchOuluListingPage(
  page: number
): Promise<{ items: OuluListingItem[]; totalPages: number }> {
  const response = await fetch(`${OULU_LISTING_BASE}?type=73&page=${page}`, { cache: "no-store" })
  if (!response.ok) return { items: [], totalPages: page + 1 }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: OuluListingItem[] = []
  $(".views-row a.project-card").each((_, el) => {
    const $el = $(el)
    const href = $el.attr("href")
    if (!href) return

    const url = href.startsWith("http") ? href : `https://www.ouka.fi${href}`
    const title = $el.find(".project-card__title").text().trim()
    const kaavaTunnus =
      $el.find(".project-card__planning-number .field__item").first().text().trim() || null
    const region =
      $el.find(".project-card__regions").text().replace(/\s+/g, " ").trim() || null

    if (title) items.push({ url, title, kaavaTunnus, region })
  })

  let totalPages = page + 1
  $("a[href*='page=']").each((_, el) => {
    const href = $(el).attr("href") ?? ""
    const match = href.match(/page=(\d+)/)
    if (match) totalPages = Math.max(totalPages, Number(match[1]) + 1)
  })

  return { items, totalPages }
}

type OuluContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

type OuluDetails = {
  description: string | null
  phase: string | null
  completed: boolean
  contacts: OuluContact[]
}

async function fetchOuluDetails(url: string): Promise<OuluDetails> {
  const empty: OuluDetails = { description: null, phase: null, completed: false, contacts: [] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const description =
      $("#project-description .field--name-field-description").first().text().trim() || null

    let phase: string | null = null
    let hasOngoing = false
    let hasUpcoming = false

    $(".paragraph--type--project-phase").each((_, el) => {
      const $el = $(el)
      const classes = $el.attr("class") ?? ""
      const title = $el.find(".phase__title .field--name-field-title").first().text().trim()

      if (classes.includes("ongoing")) {
        phase = title
        hasOngoing = true
      }
      if (classes.includes("upcoming")) hasUpcoming = true
    })

    const completed = !hasOngoing && !hasUpcoming

    const contacts: OuluContact[] = []
    $("#project-contacts .contact-card").each((_, el) => {
      const $el = $(el)
      const title = $el.find(".contact-card__title").first().text().trim() || null
      const name = $el.find(".contact-card__name").first().text().trim() || null
      const phone = $el.find("a[href^='tel:']").attr("href")?.replace("tel:", "") ?? null
      const email = $el.find("a[href^='mailto:']").attr("href")?.replace("mailto:", "") ?? null
      if (name) contacts.push({ name, title, phone, email })
    })

    return { description, phase, completed, contacts }
  } catch {
    return empty
  }
}

async function collectOuluSource(source: DiscoverySource) {
  const { totalPages: discoveredTotal } = await fetchOuluListingPage(0)
  const totalPages = Math.max(discoveredTotal, 1)

  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  const startPage = dayOfYear % totalPages

  const pagesToFetch = Array.from(
    { length: OULU_PAGES_PER_RUN },
    (_, i) => (startPage + i) % totalPages
  )

  const allItems: OuluListingItem[] = []
  const seenUrls = new Set<string>()

  for (const page of pagesToFetch) {
    const { items } = await fetchOuluListingPage(page)
    for (const item of items) {
      if (seenUrls.has(item.url)) continue
      seenUrls.add(item.url)
      allItems.push(item)
    }
  }

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description || row.raw_payload?.completed) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let saved = 0
  let detailFetches = 0

  for (const item of allItems) {
    const known = knownDetails.get(item.url)

    let details: OuluDetails | null = known
      ? {
          description: known.description ?? null,
          phase: known.phase ?? null,
          completed: known.completed ?? false,
          contacts: known.contacts ?? [],
        }
      : null

    let detailsAttempted = Boolean(known)

    if (!detailsAttempted && detailFetches < OULU_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchOuluDetails(item.url)
      detailFetches += 1
      detailsAttempted = details.description !== null || details.completed
    }

    const isCompleted = detailsAttempted && details?.completed === true

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: item.kaavaTunnus,
            region: item.region,
            ...(detailsAttempted && details
              ? {
                  description: details.description,
                  phase: details.phase,
                  contacts: details.contacts,
                  completed: details.completed,
                }
              : {}),
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(isCompleted
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: allItems.length,
    documentsSaved: saved,
  }
}

/*
 * Jyväskylän "vireillä olevat kaavat" -listaussivu ryhmittelee hankkeet
 * kaupunginosittain (accordion), mutta antaa vain otsikon+linkin — ei
 * muodollista kaavatunnusta lainkaan (identifiointi siis pelkän URL:n
 * varassa, sama malli kuin Väylävirastolla). Vaihe päätellään
 * yksityiskohtasivun 4-vaiheisesta accordionista: viimeinen vaihe jolla
 * on sisältöä (kuvausteksti/liitteet) on nykyinen vaihe — jos jopa
 * "Hyväksymisvaihe" on jo täytetty, hanke on valmis eikä enää aktiivinen
 * liidi (completed, sama malli kuin Lahdella/Oululla). Yhteystietojen
 * sähköposti on Cloudflaren XOR-obfuskoima (sama menetelmä kuin
 * Väylävirastolla, decodeCloudflareEmail() uudelleenkäytetty).
 * Karttaupotuksen koordinaattimuoto on tuntematon (sama tilanne kuin
 * Oulu) — ei poimita.
 */
const JYVASKYLA_LISTING_URL = "https://www.jyvaskyla.fi/kaavoitus/vireilla"
const JYVASKYLA_MAX_DETAIL_FETCHES_PER_RUN = 5
const JYVASKYLA_PHASES = ["Aloitusvaihe", "Luonnosvaihe", "Ehdotusvaihe", "Hyväksymisvaihe"]

type JyvaskylaListingItem = {
  url: string
  title: string
  district: string | null
}

async function fetchJyvaskylaListing(): Promise<JyvaskylaListingItem[]> {
  const response = await fetch(JYVASKYLA_LISTING_URL, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(
      `Jyväskylän kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: JyvaskylaListingItem[] = []
  const seen = new Set<string>()

  $(".accordion__item").each((_, el) => {
    const $el = $(el)
    const district = $el.find(".field-accordion-title").first().text().trim() || null

    $el.find("a[href*='/vireilla/'], a[href*='/vireilla-olevat-asemakaavat/']").each((_, a) => {
      const $a = $(a)
      const href = $a.attr("href")
      if (!href) return

      const url = href.startsWith("http") ? href : `https://www.jyvaskyla.fi${href}`
      if (seen.has(url)) return

      const title = $a.text().trim()
      if (!title) return

      seen.add(url)
      items.push({ url, title, district })
    })
  })

  return items
}

type JyvaskylaContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

type JyvaskylaDetails = {
  description: string | null
  phase: string | null
  completed: boolean
  contacts: JyvaskylaContact[]
}

function jyvaskylaFragmentText(html: string): string {
  return cheerio.load(`<div>${html}</div>`)("div").text().trim()
}

async function fetchJyvaskylaDetails(url: string): Promise<JyvaskylaDetails> {
  const empty: JyvaskylaDetails = { description: null, phase: null, completed: false, contacts: [] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const description =
      $(".body.field--name-body").first().text().replace(/\s+/g, " ").trim() || null

    let phase: string | null = null
    let lastPhaseIndex = -1

    $(".accordion__item").each((_, el) => {
      const $el = $(el)
      const titleText = $el.find(".field-accordion-title").first().text().trim()
      const canonical = JYVASKYLA_PHASES.find((p) => titleText.startsWith(p))
      if (!canonical) return

      const contentText = $el.find(".accordion__content").first().text().trim()
      if (contentText.length > 0) {
        phase = canonical
        lastPhaseIndex = JYVASKYLA_PHASES.indexOf(canonical)
      }
    })

    const completed = lastPhaseIndex === JYVASKYLA_PHASES.length - 1

    const contacts: JyvaskylaContact[] = []
    $(".infobox--bottom .content p").each((_, p) => {
      const innerHtml = $(p).html() ?? ""
      const parts = innerHtml.split(/<br\s*\/?>/i)
      if (parts.length < 2) return

      const name = jyvaskylaFragmentText(parts[0])
      if (!name) return

      const title = parts[1] ? jyvaskylaFragmentText(parts[1]) || null : null
      const phoneText = parts[2] ? jyvaskylaFragmentText(parts[2]) : ""
      const phone = phoneText.replace(/^p\.?\s*/i, "").trim() || null

      const $emailFragment = cheerio.load(`<div>${parts[3] ?? ""}</div>`)
      const cfEmail = $emailFragment(".__cf_email__").attr("data-cfemail")
      const email = cfEmail ? decodeCloudflareEmail(cfEmail) : null

      contacts.push({ name, title, phone, email })
    })

    return { description, phase, completed, contacts }
  } catch {
    return empty
  }
}

async function collectJyvaskylaSource(source: DiscoverySource) {
  const items = await fetchJyvaskylaListing()

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description || row.raw_payload?.completed) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let saved = 0
  let detailFetches = 0

  for (const item of items) {
    const known = knownDetails.get(item.url)

    let details: JyvaskylaDetails | null = known
      ? {
          description: known.description ?? null,
          phase: known.phase ?? null,
          completed: known.completed ?? false,
          contacts: known.contacts ?? [],
        }
      : null

    let detailsAttempted = Boolean(known)

    if (!detailsAttempted && detailFetches < JYVASKYLA_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchJyvaskylaDetails(item.url)
      detailFetches += 1
      detailsAttempted = details.description !== null || details.completed
    }

    const isCompleted = detailsAttempted && details?.completed === true

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            district: item.district,
            ...(detailsAttempted && details
              ? {
                  description: details.description,
                  phase: details.phase,
                  contacts: details.contacts,
                  completed: details.completed,
                }
              : {}),
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(isCompleted
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Hämeenlinnan "vireillä olevat kaavat" -sivu on poikkeuksellisen
 * kattava: koko 48 hankkeen lista on YHDELLÄ sivulla accordion-
 * laatikkoina, ja jokaisessa on jo valmiina kuvaus, tunnus,
 * yhteyshenkilön nimi ja täysi "Vaiheet"-tapahtumahistoria — ei siis
 * yhtään erillistä yksityiskohtahakua tarvita (toisin kuin Lahti/Pori/
 * Oulu/Jyväskylä). "Vaiheet"-lista on staattinen kaikkien vaiheiden
 * nimistä; ne joissa on päivämäärä ovat jo tapahtuneet, ne ilman
 * päivämäärää ovat vielä tulevia — viimeinen päivätty vaihe on siis
 * hankkeen nykyinen vaihe. Jos viimeinen päivätty vaihe on
 * "Lainvoimainen", hanke on jo kokonaan valmis eikä enää aktiivinen
 * liidi (sama completed-malli kuin Lahdella/Oululla/Jyväskylällä).
 * Sivulla on vain yksi yhteinen yleiskartta koko listalle, ei
 * per-hanke-koordinaatteja — ei siis poimita.
 */
const HAMEENLINNA_LISTING_URL =
  "https://www.hameenlinna.fi/asuminen-ja-ymparisto/kaavoitus/vireilla-olevat-kaavat/"

function parseHameenlinnaTunnus(rawTitle: string): { title: string; tunnus: string | null } {
  const match = rawTitle.match(/^(.*?)\s*\(((?:ak|akm|rak|rakm|ak ja akm)\s*\d+)\)\s*.*$/i)
  if (match) {
    return { title: match[1].trim(), tunnus: match[2].replace(/\s+/g, " ").trim() }
  }
  return { title: rawTitle.trim(), tunnus: null }
}

async function collectHameenlinnaSource(source: DiscoverySource) {
  const response = await fetch(HAMEENLINNA_LISTING_URL, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(
      `Hämeenlinnan kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  let saved = 0
  let found = 0

  const boxes = $(".b-single-accordion-box").toArray()

  for (const box of boxes) {
    const $box = $(box)
    const rawTitle = $box.find(".b-single-accordion-box__toggle-btn").first().text().trim()
    if (!rawTitle) continue

    found += 1

    const { title, tunnus } = parseHameenlinnaTunnus(rawTitle)
    const $content = $box.find(".b-single-accordion-box__content").first()
    const contentId = $content.attr("id") || null

    let description: string | null = null
    let contactName: string | null = null

    $content.children("p").each((_, p) => {
      const text = $(p).text().replace(/\s+/g, " ").trim()
      if (!text) return

      const contactMatch = text.match(/^Yhteyshenkilö:\s*(.+)$/i)
      if (contactMatch) {
        contactName = contactMatch[1].trim()
        return
      }

      if (!description) description = text
    })

    const steps: { label: string; dated: boolean }[] = []

    $content.find("h2, h3").each((_, heading) => {
      if ($(heading).text().trim() !== "Vaiheet") return

      $(heading)
        .next("ul")
        .find("li")
        .each((_, li) => {
          const text = $(li).text().replace(/\s+/g, " ").trim()
          if (!text) return

          const digitIdx = text.search(/\d/)
          const dated = digitIdx !== -1
          const label = dated
            ? text.slice(0, digitIdx).trim().replace(/[,/]$/, "").trim()
            : text.trim()

          steps.push({ label, dated })
        })
    })

    const datedSteps = steps.filter((s) => s.dated)
    const currentStep = datedSteps[datedSteps.length - 1] ?? null
    const phase = currentStep?.label || null
    const completed = phase?.toLowerCase().startsWith("lainvoimainen") ?? false

    const documentUrl = `${HAMEENLINNA_LISTING_URL}#${contentId ?? encodeURIComponent(rawTitle)}`

    const rawText = JSON.stringify({ rawTitle, title, tunnus, description, contactName, steps })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title,
          document_url: documentUrl,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title,
            kaava_tunnus: tunnus,
            description,
            contact_name: contactName,
            phase,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: found,
    documentsSaved: saved,
  }
}

/*
 * Joensuun "laadinnassa olevat kaavat" -listaussivu antaa jo listalta
 * otsikon, vaiheen (data-status-attribuutti), kuvauksen ja kaupungin-
 * osan ilman erillistä hakua — vain yhteystiedot vaativat rate-
 * limitoidun yksityiskohtahaun (sama malli kuin Tampere/Turku/
 * Väylävirasto). Ei muodollista kaavatunnusta (sama tilanne kuin
 * Jyväskylällä) — tunnistus URL:n varassa. data-status sisältää myös
 * jo lainvoimaisia ("lainvoimainen") ja keskeytettyjä ("keskeytetty")
 * hankkeita suoraan listalla — molemmat merkitään completed:iksi ja
 * jätetään pysyvästi faktojen/tunnistuksen ulkopuolelle, koska ne
 * eivät enää ole aktiivisia liidejä. Sähköposti on Cloudflaren XOR-
 * obfuskoima samalla menetelmällä kuin Väylävirastolla/Jyväskylällä —
 * decodeCloudflareEmail() uudelleenkäytetty.
 */
const JOENSUU_LISTING_URL =
  "https://www.joensuu.fi/kaupunki-ja-kehitys/suunnittelu-ja-rakentaminen/kaavoitus/laadinnassa-olevat-kaavat/"
const JOENSUU_MAX_DETAIL_FETCHES_PER_RUN = 5
const JOENSUU_COMPLETED_STATUSES = ["lainvoimainen", "keskeytetty"]

type JoensuuListingItem = {
  url: string
  title: string
  status: string | null
  district: string | null
  description: string | null
}

async function fetchJoensuuListing(): Promise<JoensuuListingItem[]> {
  const response = await fetch(JOENSUU_LISTING_URL, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(
      `Joensuun kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: JoensuuListingItem[] = []

  $("li[data-status]").each((_, li) => {
    const $li = $(li)
    const status = ($li.attr("data-status") ?? "").trim() || null
    const url = $li.find("a").first().attr("href")
    if (!url) return

    const title = $li.find("h3").first().text().replace(/\s+/g, " ").trim()
    if (!title) return

    let description: string | null = null
    let district: string | null = null

    $li.find("p").each((_, p) => {
      const text = $(p).text().replace(/\s+/g, " ").trim()
      if (!text) return

      const districtMatch = text.match(/^Kaupunginosa:\s*(.+)$/i)
      if (districtMatch) {
        district = districtMatch[1].trim()
        return
      }

      if (!description) description = text
    })

    items.push({ url, title, status, district, description })
  })

  return items
}

type JoensuuContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

async function fetchJoensuuContacts(url: string): Promise<JoensuuContact[]> {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return []

    const html = await response.text()
    const $ = cheerio.load(html)

    const contacts: JoensuuContact[] = []

    $(".block-contact-cards li").each((_, li) => {
      const $li = $(li)
      const $paragraphs = $li.find("p")

      const name = $paragraphs.eq(0).find("strong").first().text().trim() || null
      if (!name) return

      const title = $paragraphs.eq(1).text().trim() || null
      const phone = $li.find("a[href^='tel:']").first().attr("href")?.replace("tel:", "") ?? null
      const cfEmail = $li.find(".__cf_email__").first().attr("data-cfemail")
      const email = cfEmail ? decodeCloudflareEmail(cfEmail) : null

      contacts.push({ name, title, phone, email })
    })

    return contacts
  } catch {
    return []
  }
}

async function collectJoensuuSource(source: DiscoverySource) {
  const items = await fetchJoensuuListing()

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownContacts = new Map<string, JoensuuContact[]>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.contacts?.length > 0) {
      knownContacts.set(row.document_url, row.raw_payload.contacts)
    }
  }

  let saved = 0
  let detailFetches = 0

  for (const item of items) {
    const completed = Boolean(item.status && JOENSUU_COMPLETED_STATUSES.includes(item.status))

    const known = knownContacts.get(item.url)
    let contacts: JoensuuContact[] = known ?? []
    const contactsAttempted = Boolean(known) || completed

    if (!contactsAttempted && detailFetches < JOENSUU_MAX_DETAIL_FETCHES_PER_RUN) {
      contacts = await fetchJoensuuContacts(item.url)
      detailFetches += 1
    }

    const rawText = JSON.stringify({ item, contacts })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            status: item.status,
            district: item.district,
            description: item.description,
            contacts,
            completed,
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(completed
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Vaasan "vireillä olevat asemakaavat" -listaussivu antaa vain
 * kuvatiilen otsikon+linkin (jossa muodollinen tunnus, esim.
 * "Ahventie 20 (ak1146)") — kuvaus, vaihe ja yhteystiedot vaativat
 * rate-limitoidun yksityiskohtahaun (sama malli kuin Lahti/Pori/
 * Oulu/Jyväskylä). Vaihe päätellään samalla "viimeinen päivätty
 * timeline-rivi" -heuristiikalla kuin Hämeenlinnalla (rivit ilman
 * päivämäärää ovat vielä tulevia) — jos viimeinen päivätty rivi on
 * "Lainvoimainen", hanke on jo valmis eikä enää aktiivinen liidi
 * (completed). Sähköposti ei ole obfuskoitu.
 */
const VAASA_LISTING_URL =
  "https://www.vaasa.fi/tietoa-vaasasta-ja-seudusta/kehittyva-vaasa/kaupunkisuunnittelu/kaavoitus/vireilla-olevat-asemakaavat/"
const VAASA_MAX_DETAIL_FETCHES_PER_RUN = 5

type VaasaListingItem = {
  url: string
  title: string
  tunnus: string | null
}

function parseVaasaTunnus(rawTitle: string): { title: string; tunnus: string | null } {
  const match = rawTitle.match(/^(.*?)\s*\((ak\s*\d+)\)\s*$/i)
  if (match) {
    return { title: match[1].trim(), tunnus: match[2].replace(/\s+/g, "").trim() }
  }
  return { title: rawTitle.trim(), tunnus: null }
}

async function fetchVaasaListing(): Promise<VaasaListingItem[]> {
  const response = await fetch(VAASA_LISTING_URL, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(
      `Vaasan kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: VaasaListingItem[] = []

  $(".childpage-thumbnails__item").each((_, li) => {
    const $li = $(li)
    const $link = $li.find("a.js-thumbnail-title").first()
    const url = $link.attr("href")
    if (!url) return

    const rawTitle = $link.find(".hyphen").first().text().trim()
    if (!rawTitle) return

    const { title, tunnus } = parseVaasaTunnus(rawTitle)
    items.push({ url, title, tunnus })
  })

  return items
}

type VaasaContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

type VaasaDetails = {
  description: string | null
  phase: string | null
  completed: boolean
  contacts: VaasaContact[]
}

async function fetchVaasaDetails(url: string): Promise<VaasaDetails> {
  const empty: VaasaDetails = { description: null, phase: null, completed: false, contacts: [] }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const description =
      $(".content-header").next(".wysiwyg").find("p").text().replace(/\s+/g, " ").trim() || null

    const datedLabels: string[] = []

    $(".timeline__content__single__text__title").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim()
      if (!text) return

      const digitIdx = text.search(/\d/)
      if (digitIdx === -1) return

      datedLabels.push(text.slice(0, digitIdx).trim())
    })

    const phase = datedLabels[datedLabels.length - 1] ?? null
    const completed = phase?.toLowerCase().startsWith("lainvoimainen") ?? false

    const contacts: VaasaContact[] = []
    $("#contacts .search-contact-card").each((_, li) => {
      const $li = $(li)
      const name = $li.find(".search-contact-card__content__info__nameandtitle__heading").first().text().replace(/\s+/g, " ").trim() || null
      if (!name) return

      const title =
        $li
          .find(".search-contact-card__content__info__nameandtitle__title")
          .first()
          .text()
          .replace(/\s+/g, " ")
          .replace(/\s+,/g, ",")
          .trim() || null
      const phone =
        $li.find(".contact-list-item--phone .contact-list-item__text").first().text().trim() || null
      const email = $li.find("a[href^='mailto:']").first().attr("href")?.replace("mailto:", "") ?? null

      contacts.push({ name, title, phone, email })
    })

    return { description, phase, completed, contacts }
  } catch {
    return empty
  }
}

async function collectVaasaSource(source: DiscoverySource) {
  const items = await fetchVaasaListing()

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description || row.raw_payload?.completed) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let saved = 0
  let detailFetches = 0

  for (const item of items) {
    const known = knownDetails.get(item.url)

    let details: VaasaDetails | null = known
      ? {
          description: known.description ?? null,
          phase: known.phase ?? null,
          completed: known.completed ?? false,
          contacts: known.contacts ?? [],
        }
      : null

    let detailsAttempted = Boolean(known)

    if (!detailsAttempted && detailFetches < VAASA_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchVaasaDetails(item.url)
      detailFetches += 1
      detailsAttempted = details.description !== null || details.completed
    }

    const isCompleted = detailsAttempted && details?.completed === true

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            kaava_tunnus: item.tunnus,
            ...(detailsAttempted && details
              ? {
                  description: details.description,
                  phase: details.phase,
                  contacts: details.contacts,
                  completed: details.completed,
                }
              : {}),
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(isCompleted
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Kouvolan "ajankohtaiset asemakaavat" -listaussivu on WordPress-
 * sivupuun sivupalkki (ei erillinen listaus-widget) — 41 hankesivua
 * löytyy suodattamalla kaikki linkit jotka osuvat listaussivun omaan
 * URL-poikkuun. Jokainen hankesivu antaa muodollisen tunnuksen
 * kuvaustekstin sisällä ("kaava nro 01/040"), ja vaihe päätellään
 * ensimmäisestä <h3>-otsikosta "Suunnittelun vaihe"-otsikon jälkeen —
 * osiot ovat käänteisessä aikajärjestyksessä (uusin ensin), joten
 * ensimmäinen h3 on aina nykyinen vaihe. Jos se on "Voimaantulo",
 * hanke on jo lainvoimainen eikä enää aktiivinen liidi (completed).
 * Yhteystiedot ovat sekaisin desimaali- ja heksadesimaalimuotoisina
 * HTML-merkkiviitteinä (&#97; / &#x69;) leipätekstin sisällä — cheerio
 * purkaa nämä automaattisesti tavallisen HTML-jäsennyksen osana, joten
 * erillistä dekoodausta ei tarvita (toisin kuin Väylävirasto/
 * Jyväskylä/Joensuun Cloudflare-obfuskointi).
 */
const KOUVOLA_LISTING_URL =
  "https://www.kouvola.fi/asuminen-ja-ymparisto/kaavoitus-ja-kaupunkisuunnittelu/ajankohtaiset-asemakaavat/"
const KOUVOLA_MAX_DETAIL_FETCHES_PER_RUN = 5

type KouvolaListingItem = {
  url: string
  title: string
}

async function fetchKouvolaListing(): Promise<KouvolaListingItem[]> {
  const response = await fetch(KOUVOLA_LISTING_URL, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(
      `Kouvolan kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: KouvolaListingItem[] = []
  const seen = new Set<string>()

  $("a[href*='/ajankohtaiset-asemakaavat/']").each((_, a) => {
    const $a = $(a)
    const href = $a.attr("href")
    if (!href) return
    if (!/\/ajankohtaiset-asemakaavat\/[a-z0-9-]+\/?$/.test(href)) return
    if (seen.has(href)) return

    const title = $a.text().trim()
    if (!title) return

    seen.add(href)
    items.push({ url: href, title })
  })

  return items
}

type KouvolaContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

function splitKouvolaTitleAndName(value: string): { title: string | null; name: string } {
  const match = value.match(
    /^(.*?)\s*([A-ZÄÖÅ][\wäöåÄÖÅ'-]*(?:-[A-ZÄÖÅ][\wäöåÄÖÅ'-]*)?\s+[A-ZÄÖÅ][\wäöåÄÖÅ'-]*(?:-[A-ZÄÖÅ][\wäöåÄÖÅ'-]*)?)$/
  )
  if (match && match[2]) return { title: match[1].trim() || null, name: match[2].trim() }
  return { title: null, name: value.trim() }
}

type KouvolaDetails = {
  kaavaTunnus: string | null
  description: string | null
  phase: string | null
  completed: boolean
  contacts: KouvolaContact[]
}

async function fetchKouvolaDetails(url: string): Promise<KouvolaDetails> {
  const empty: KouvolaDetails = {
    kaavaTunnus: null,
    description: null,
    phase: null,
    completed: false,
    contacts: [],
  }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    const description = $(".page-ingress p").first().text().replace(/\s+/g, " ").trim() || null
    const kaavaTunnus = description?.match(/kaava\s*nro\s*([\d/]+)/i)?.[1] ?? null

    let phaseHeading = $("#suunnittelunvaihe")
    if (phaseHeading.length === 0) {
      phaseHeading = $("h2.wp-block-heading").filter(
        (_, el) => $(el).text().trim() === "Suunnittelun vaihe"
      )
    }

    const phase =
      phaseHeading.nextUntil("h2.wp-block-heading", "h3.wp-block-heading").first().text().trim() ||
      null

    const completed = phase?.toLowerCase() === "voimaantulo"

    const contacts: KouvolaContact[] = []

    $(".page-content-wrapper p").each((_, p) => {
      const $p = $(p)
      const text = $p.text().replace(/\s+/g, " ").trim()

      const match = text.match(/Lisätietoja:?\s*([^,]+),/)
      if (!match) return

      const { title, name } = splitKouvolaTitleAndName(match[1].trim())
      if (!name || !/^[A-ZÄÖÅ][\wäöåÄÖÅ'-]*\s+[A-ZÄÖÅ][\wäöåÄÖÅ'-]*$/.test(name)) return

      const email = $p.find("a[href^='mailto:']").first().attr("href")?.replace("mailto:", "").trim() || null
      const phone = $p.find("a[href^='tel:']").first().attr("href")?.replace("tel:", "").trim() || null

      contacts.push({ name, title, phone, email })
    })

    return { kaavaTunnus, description, phase, completed, contacts: contacts.slice(0, 1) }
  } catch {
    return empty
  }
}

async function collectKouvolaSource(source: DiscoverySource) {
  const items = await fetchKouvolaListing()

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description || row.raw_payload?.completed) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let saved = 0
  let detailFetches = 0

  for (const item of items) {
    const known = knownDetails.get(item.url)

    let details: KouvolaDetails | null = known
      ? {
          kaavaTunnus: known.kaava_tunnus ?? null,
          description: known.description ?? null,
          phase: known.phase ?? null,
          completed: known.completed ?? false,
          contacts: known.contacts ?? [],
        }
      : null

    let detailsAttempted = Boolean(known)

    if (!detailsAttempted && detailFetches < KOUVOLA_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchKouvolaDetails(item.url)
      detailFetches += 1
      detailsAttempted = details.description !== null || details.completed
    }

    const isCompleted = detailsAttempted && details?.completed === true

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            ...(detailsAttempted && details
              ? {
                  kaava_tunnus: details.kaavaTunnus,
                  description: details.description,
                  phase: details.phase,
                  contacts: details.contacts,
                  completed: details.completed,
                }
              : {}),
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(isCompleted
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

/*
 * Lappeenrannan "vireillä olevat asemakaavat" -listaussivu (Kentico/
 * InfoWeb) antaa vain otsikon+linkin — jokainen ~900 kt:n hankesivu
 * vaatii rate-limitoidun yksityiskohtahaun (sama malli kuin Lahti/
 * Pori/Oulu/Jyväskylä/Vaasa). Vaihe päätellään "Kaavaprosessin
 * vaiheet" -osion process-ympyröiden täyttöasteesta: täytetty ympyrä
 * (ei "border-secondary"-luokkaa) tarkoittaa saavutettua vaihetta,
 * ontto ympyrä tulevaa — viimeinen saavutettu vaihe on nykyinen. Jos
 * kaikki vaiheet (myös viimeinen, Hyväksymisvaihe) on saavutettu,
 * hanke on käytännössä hyväksytty eikä enää aktiivinen liidi
 * (completed). Ei muodollista kaavatunnusta — tunnistus URL:n
 * varassa. Yhteystiedot eivät ole obfuskoituja. Karttalinkin "cp"-
 * parametri on GK28FIN-muodossa (pohjoinen,itä).
 */
const LAPPEENRANTA_LISTING_URL =
  "https://www.lappeenranta.fi/fi/asuminen-ja-rakentaminen/kaavoitus/asemakaavoitus/vireilla-olevat-asemakaavat"
const LAPPEENRANTA_BASE_URL = "https://www.lappeenranta.fi"
const LAPPEENRANTA_MAX_DETAIL_FETCHES_PER_RUN = 5

type LappeenrantaListingItem = {
  url: string
  title: string
}

async function fetchLappeenrantaListing(): Promise<LappeenrantaListingItem[]> {
  const response = await fetch(LAPPEENRANTA_LISTING_URL, { cache: "no-store" })

  if (!response.ok) {
    throw new Error(
      `Lappeenrannan kaavalistan haku epäonnistui: ${response.status} ${response.statusText}`
    )
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  const items: LappeenrantaListingItem[] = []
  const seen = new Set<string>()

  $("a[href*='/vireilla-olevat-asemakaavat/']").each((_, a) => {
    const $a = $(a)
    const href = $a.attr("href")
    if (!href) return
    if (!/\/vireilla-olevat-asemakaavat\/[a-z0-9-]+$/.test(href)) return

    const url = href.startsWith("http") ? href : `${LAPPEENRANTA_BASE_URL}${href}`
    if (seen.has(url)) return

    const title = $a.text().replace(/\s+/g, " ").trim()
    if (!title) return

    seen.add(url)
    items.push({ url, title })
  })

  return items
}

type LappeenrantaContact = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
}

type LappeenrantaDetails = {
  description: string | null
  phase: string | null
  completed: boolean
  contacts: LappeenrantaContact[]
  center: { x: number; y: number } | null
}

async function fetchLappeenrantaDetails(url: string): Promise<LappeenrantaDetails> {
  const empty: LappeenrantaDetails = {
    description: null,
    phase: null,
    completed: false,
    contacts: [],
    center: null,
  }

  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return empty

    const html = await response.text()
    const $ = cheerio.load(html)

    let description: string | null = null
    $("h2, h3").each((_, h) => {
      if (description) return
      if ($(h).text().trim() === "Tavoite") {
        description = $(h).next("p").text().replace(/\s+/g, " ").trim() || null
      }
    })

    const steps: { heading: string; reached: boolean }[] = []
    $(".process-body").each((_, body) => {
      const $body = $(body)
      const heading = $body.find("h2, h3").first().text().trim()
      if (!heading) return

      const circle = $body.closest(".row").find(".process-number .ratio").first()
      const reached = circle.length > 0 && !circle.hasClass("border-secondary")

      steps.push({ heading, reached })
    })

    const reachedSteps = steps.filter((s) => s.reached)
    const phase = reachedSteps[reachedSteps.length - 1]?.heading ?? null
    const completed = steps.length > 0 && reachedSteps.length === steps.length

    const mapHref = $("a[href*='kartta.lappeenranta.fi']").first().attr("href") ?? ""
    const cpMatch = mapHref.match(/cp=([\d.]+),([\d.]+)/)
    const center = cpMatch ? { y: parseFloat(cpMatch[1]), x: parseFloat(cpMatch[2]) } : null

    const contacts: LappeenrantaContact[] = []
    $(".iwc-page-section-contacts .card").each((_, card) => {
      const $card = $(card)
      const name = $card.find(".card-title").first().text().trim() || null
      if (!name) return

      const title = $card.find("p").first().text().trim() || null
      const email = $card.find("a[href^='mailto:']").first().attr("href")?.replace("mailto:", "").trim() ?? null
      const phone = $card.find("a[href^='tel:']").first().attr("href")?.replace("tel:", "").trim() ?? null

      contacts.push({ name, title, phone, email })
    })

    return { description, phase, completed, contacts, center }
  } catch {
    return empty
  }
}

async function collectLappeenrantaSource(source: DiscoverySource) {
  const items = await fetchLappeenrantaListing()

  const { data: existingRows } = await supabaseAdmin
    .from("source_documents")
    .select("document_url, raw_payload")
    .eq("source_id", source.id)

  const knownDetails = new Map<string, any>()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description || row.raw_payload?.completed) {
      knownDetails.set(row.document_url, row.raw_payload)
    }
  }

  let saved = 0
  let detailFetches = 0

  for (const item of items) {
    const known = knownDetails.get(item.url)

    let details: LappeenrantaDetails | null = known
      ? {
          description: known.description ?? null,
          phase: known.phase ?? null,
          completed: known.completed ?? false,
          contacts: known.contacts ?? [],
          center: known.center ?? null,
        }
      : null

    let detailsAttempted = Boolean(known)

    if (!detailsAttempted && detailFetches < LAPPEENRANTA_MAX_DETAIL_FETCHES_PER_RUN) {
      details = await fetchLappeenrantaDetails(item.url)
      detailFetches += 1
      detailsAttempted = details.description !== null || details.completed
    }

    const isCompleted = detailsAttempted && details?.completed === true

    const rawText = JSON.stringify({ item, details })
    const contentHash = hashContent(rawText)

    const { error } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          source_name: source.name,
          title: item.title,
          document_url: item.url,
          document_type: "api",
          content_hash: contentHash,
          status: "downloaded",
          raw_text: rawText,
          raw_payload: {
            parser: source.parser,
            priority: source.priority,
            title: item.title,
            ...(detailsAttempted && details
              ? {
                  description: details.description,
                  phase: details.phase,
                  contacts: details.contacts,
                  center: details.center,
                  completed: details.completed,
                }
              : {}),
          },
          processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(isCompleted
            ? {
                facts_extracted_at: new Date().toISOString(),
                identity_resolved_at: new Date().toISOString(),
              }
            : {}),
        },
        { onConflict: "document_url" }
      )

    if (error) throw error

    saved += 1
  }

  return {
    documentsFound: items.length,
    documentsSaved: saved,
  }
}

export async function collectApiSource(source: DiscoverySource) {
  if (source.parser === "lappeenrantaKaavaParser") {
    return collectLappeenrantaSource(source)
  }

  if (source.parser === "kouvolaKaavaParser") {
    return collectKouvolaSource(source)
  }

  if (source.parser === "vaasaKaavaParser") {
    return collectVaasaSource(source)
  }

  if (source.parser === "joensuuKaavaParser") {
    return collectJoensuuSource(source)
  }

  if (source.parser === "hameenlinnaKaavaParser") {
    return collectHameenlinnaSource(source)
  }

  if (source.parser === "jyvaskylaKaavaParser") {
    return collectJyvaskylaSource(source)
  }

  if (source.parser === "ouluKaavaParser") {
    return collectOuluSource(source)
  }

  if (source.parser === "poriKaavaParser") {
    return collectPoriSource(source)
  }

  if (source.parser === "lahtiKaavaParser") {
    return collectLahtiSource(source)
  }

  if (source.parser === "kuopioKaavaParser") {
    return collectKuopioSource(source)
  }

  if (source.parser === "hyvinkaaKaavaParser") {
    return collectHyvinkaaSource(source)
  }

  if (source.parser === "seinajokiKaavaParser") {
    return collectSeinajokiSource(source)
  }

  if (source.parser === "rovaniemiKaavaParser") {
    return collectRovaniemiSource(source)
  }

  if (source.parser === "mikkeliKaavaParser") {
    return collectMikkeliSource(source)
  }

  if (source.parser === "kotkaKaavaParser") {
    return collectKotkaSource(source)
  }

  if (source.parser === "saloKaavaParser") {
    return collectSaloSource(source)
  }

  if (source.parser === "porvooKaavaParser") {
    return collectPorvooSource(source)
  }

  if (source.parser === "kokkolaKaavaParser") {
    return collectKokkolaSource(source)
  }

  if (source.parser === "kirkkonummiKaavaParser") {
    return collectKirkkonummiSource(source)
  }

  if (source.parser === "keravaKaavaParser") {
    return collectKeravaSource(source)
  }

  if (source.parser === "tuusulaKaavaParser") {
    return collectTuusulaSource(source)
  }

  if (source.parser === "nurmijarviKaavaParser") {
    return collectNurmijarviSource(source)
  }

  if (source.parser === "sipooKaavaParser") {
    return collectSipooSource(source)
  }

  if (source.parser === "jarvenpaaKaavaParser") {
    return collectJarvenpaaSource(source)
  }

  if (source.parser === "senaattiParser") {
    return collectSenaattiSource(source)
  }

  if (source.parser === "puolustuskiinteistotParser") {
    return collectPuolustuskiinteistotSource(source)
  }

  if (source.parser === "espooKaavaParser") {
    return collectEspooKaavaSource(source)
  }

  if (source.parser === "lohjaKaavaParser") {
    return collectLohjaKaavaSource(source)
  }

  if (source.parser === "raumaKaavaParser") {
    return collectRaumaKaavaSource(source)
  }

  if (source.parser === "kaarinaKaavaParser") {
    return collectKaarinaKaavaSource(source)
  }

  if (source.parser === "nokiaKaavaParser") {
    return collectNokiaKaavaSource(source)
  }

  if (source.parser === "kajaaniKaavaParser") {
    return collectKajaaniKaavaSource(source)
  }

  if (source.parser === "hollolaKaavaParser") {
    return collectHollolaKaavaSource(source)
  }

  if (source.parser === "kangasalaKaavaParser") {
    return collectKangasalaKaavaSource(source)
  }

  if (source.parser === "ylojarviKaavaParser") {
    return collectYlojarviKaavaSource(source)
  }

  if (source.parser === "vihtiKaavaParser") {
    return collectVihtiKaavaSource(source)
  }

  if (source.parser === "raaheKaavaParser") {
    return collectRaaheKaavaSource(source)
  }

  if (source.parser === "sastamalaKaavaParser") {
    return collectSastamalaKaavaSource(source)
  }

  if (source.parser === "imatraKaavaParser") {
    return collectImatraKaavaSource(source)
  }

  if (source.parser === "riihimakiKaavaParser") {
    return collectRiihimakiKaavaSource(source)
  }

  if (source.parser === "raaseporiKaavaParser") {
    return collectRaaseporiKaavaSource(source)
  }

  if (source.parser === "raisioKaavaParser") {
    return collectRaisioKaavaSource(source)
  }

  if (source.parser === "lempaalaKaavaParser") {
    return collectLempaalaKaavaSource(source)
  }

  if (source.parser === "savonlinnaKaavaParser") {
    return collectSavonlinnaKaavaSource(source)
  }

  if (source.parser === "hilmaParser") {
    return collectHilmaSource(source)
  }

  if (source.parser === "lupapisteParser") {
    return collectLupapisteSource(source)
  }

  if (source.parser === "kreateParser") {
    return collectKreateSource(source)
  }

  if (source.parser === "vaylaParser") {
    return collectVaylaSource(source)
  }

  if (source.parser === "vantaaKaavaParser") {
    return collectVantaaKaavaSource(source)
  }

  if (source.parser === "tampereKaavaParser") {
    return collectTampereKaavaSource(source)
  }

  if (source.parser === "turkuKaavaParser") {
    return collectTurkuKaavaSource(source)
  }

  if (source.parser === "helsinkiKaavaParser") {
    return collectHelsinkiKaavaSource(source)
  }

  const response = await fetch(source.url, {
    headers: {
      accept: "application/json, text/plain, */*",
    },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`API fetch failed: ${response.status} ${response.statusText}`)
  }

  const contentType = response.headers.get("content-type") ?? ""
  const rawText = await response.text()
  const contentHash = hashContent(rawText)

  const { data, error } = await supabaseAdmin
    .from("source_documents")
    .upsert(
      {
        source_id: source.id,
        source_name: source.name,
        title: source.name,
        document_url: source.url,
        document_type: "api",
        content_hash: contentHash,
        status: "downloaded",
        raw_text: rawText,
        raw_payload: {
          contentType,
          category: source.category,
          priority: source.priority,
          parser: source.parser,
        },
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "document_url",
      }
    )
    .select()
    .single()

  if (error) {
    throw error
  }

  return {
    documentId: data.id,
    documentsFound: 1,
    documentsSaved: 1,
  }
}