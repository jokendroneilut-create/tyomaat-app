/*
 * Yrittää palauttaa linkin niille riveille jotka jäivät ilman.
 *
 * `backfill-missing-source-url.ts` hylkäsi neljä lähdettä kokonaan kolmen
 * osoitteen otoksen perusteella (Tampere, Pori, Kuopio, Kerava) sekä 93
 * API-päätepistettä. Otos on kuitenkin liian karkea peruste hylätä koko
 * lähde: samasta lähteestä osa osoitteista toimii ja osa ei.
 *
 * Tässä jokainen jäljellä oleva osoite tarkistetaan YKSITELLEN ja otetaan
 * käyttöön jos se vastaa. API-päätepisteet jätetään yhä pois: ne vastaavat
 * 200:lla mutta palauttavat XML:ää, eivät ihmiselle avattavaa sivua.
 *
 * Kuopion osoitteet ovat yksisivusovelluksen reittejä (700 tavun kuori),
 * joten pelkkä status ei kelpaa todisteeksi - niille vaaditaan lisäksi
 * järkevä sisällön koko.
 *
 *   npx tsx scripts/recover-skipped-source-urls.ts
 *   npx tsx scripts/recover-skipped-source-urls.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const API_ENDPOINT =
  /service=WFS|\/geoserver\/|\/wfs\?|outputFormat=|\/api\/|\.json(\?|$)|format=json/i

/* Yksisivusovelluksen tyhjä kuori on pieni; oikea sivu ei ole. */
const MIN_PAGE_BYTES = 2000

async function check(url: string) {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 30000)
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        accept: "text/html,*/*",
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
      },
    })
    clearTimeout(timer)
    const body = await res.arrayBuffer()
    return { ok: res.status < 400 && body.byteLength >= MIN_PAGE_BYTES, status: res.status, size: body.byteLength }
  } catch {
    return { ok: false, status: 0, size: 0 }
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id, document_url")
      .range(from, from + 999)
    if (error) throw error
    for (const doc of data ?? []) if (doc.document_url) docs.set(doc.id, doc.document_url)
    if (!data || data.length < 1000) break
  }

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = rows.filter((r) => !r.metadata?.source_url)

  /* Sama osoite toistuu monella rivillä - tarkistetaan kerran. */
  const byUrl = new Map<string, any[]>()
  let apiSkipped = 0
  let noDoc = 0

  for (const row of targets) {
    const url = docs.get(row.metadata?.source_document_id)
    if (!url) {
      noDoc++
      continue
    }
    if (API_ENDPOINT.test(url)) {
      apiSkipped++
      continue
    }
    if (!byUrl.has(url)) byUrl.set(url, [])
    byUrl.get(url)!.push(row)
  }

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`
  )
  console.log(`linkittömiä rivejä:        ${targets.length}`)
  console.log(`  API-päätepiste:          ${apiSkipped}`)
  console.log(`  asiakirjaa ei ole:       ${noDoc}`)
  console.log(`  tarkistettavia osoitteita: ${byUrl.size}\n`)

  let toimii = 0
  let kuollut = 0
  let rivit = 0
  const perSource: Record<string, number> = {}

  for (const [url, group] of byUrl) {
    const result = await check(url)
    if (!result.ok) {
      kuollut++
      continue
    }
    toimii++
    rivit += group.length

    for (const row of group) {
      const source = row.metadata?.source ?? row.metadata?.source_name ?? "(ei lähdettä)"
      perSource[source] = (perSource[source] ?? 0) + 1

      if (!APPLY) continue
      const { error } = await supabase
        .from("potential_projects")
        .update({ metadata: { ...row.metadata, source_url: url } })
        .eq("id", row.id)
      if (error) console.log(`  VIRHE ${row.id}: ${error.message}`)
    }
  }

  console.log(`osoitteita toimii: ${toimii}, kuollut: ${kuollut}`)
  console.log(`rivejä palautui:   ${rivit}\n`)
  for (const [k, v] of Object.entries(perSource).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.slice(0, 36).padEnd(38)} ${v}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
