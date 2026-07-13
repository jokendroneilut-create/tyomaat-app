import crypto from "crypto"
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

        const documentUrl = `https://julkipano.lupapiste.fi/muutoksenhaku/${notice.id}`
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
      ? `https://www.hankintailmoitukset.fi/fi/public/procurement/${noticeId}/notice/overview`
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

export async function collectApiSource(source: DiscoverySource) {
  if (source.parser === "hilmaParser") {
    return collectHilmaSource(source)
  }

  if (source.parser === "lupapisteParser") {
    return collectLupapisteSource(source)
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