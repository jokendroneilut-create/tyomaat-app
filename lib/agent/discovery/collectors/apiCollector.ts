import crypto from "crypto"
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

// Ks. VANTAA_MAX_HAKIJA_FETCHES_PER_RUN yllä — sama syy pieneen rajaan.
const HELSINKI_MAX_SELOSTUS_FETCHES_PER_RUN = 5

/*
 * Vireillä olevan kaavan asemakaavaselostus-PDF löytyy luotettavasti tästä
 * vuosikansiottomasta osoitteesta niin kauan kuin kaava on vielä käsittelyssä
 * — vasta valmistuneet/lainvoimaiset kaavat arkistoidaan myöhemmin
 * vuosikohtaisiin kansioihin. Koska tämä lähde kerää nimenomaan vain
 * "vireillä"-tilassa olevia kaavoja, tämä osoite osuu oikeaan lähes aina.
 */
async function fetchHelsinkiKaavaSelostus(
  kaavaTunnus: string
): Promise<{ description: string | null; selostusUrl: string | null }> {
  const selostusUrl = `https://www.hel.fi/static/ksv/kaava/ak${kaavaTunnus}_selostus.pdf`

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
      return { description: null, selostusUrl: null }
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default
    const parsed = await pdfParse(buffer)
    const text = parsed.text?.trim() ?? ""

    return {
      description: text.length > 0 ? text.slice(0, 8000) : null,
      selostusUrl,
    }
  } catch {
    return { description: null, selostusUrl: null }
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
    { description: string | null; selostusUrl: string | null }
  >()
  for (const row of existingRows ?? []) {
    if (row.raw_payload?.description) {
      knownDetails.set(row.document_url, {
        description: row.raw_payload.description,
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
    let selostusUrl: string | null = known?.selostusUrl ?? null
    let detailsAttempted = knownDetails.has(documentUrl)

    if (
      !detailsAttempted &&
      properties.kaavatunnus &&
      selostusFetches < HELSINKI_MAX_SELOSTUS_FETCHES_PER_RUN
    ) {
      const details = await fetchHelsinkiKaavaSelostus(String(properties.kaavatunnus))
      description = details.description
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
          title: `Kaava ${properties.kaavatunnus ?? properties.id}${districtName ? ` – ${districtName}` : ""}`,
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
            ...(detailsAttempted ? { description, selostus_url: selostusUrl } : {}),
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

export async function collectApiSource(source: DiscoverySource) {
  if (source.parser === "hilmaParser") {
    return collectHilmaSource(source)
  }

  if (source.parser === "lupapisteParser") {
    return collectLupapisteSource(source)
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