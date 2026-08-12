/*
 * Hakee päätöspäivän takautuvasti riveille jotka tuotiin ennen kuin
 * `metadata.decision_date` otettiin käyttöön.
 *
 * MIKSI TAKAUTUVASTI. Päätöspäivä on ainoa tapa mitata hankkeen ikää:
 * `first_seen` kertoo vain milloin ME näimme päätöksen, joten vuonna 2021
 * tehty päätös näyttää tuoreelta jos se tuotiin kantaan tänään. Mitattu
 * 12.8.2026: 1016 päätösriviä jonossa, eikä yhdelläkään ollut päivää.
 *
 * KAKSI ERI HAKUA, KOSKA ALUSTOJA ON KOLME.
 *
 * Ahjo (848 riviä): asiatunnus HEL-2021-006032 on haettavissa suoraan
 * Elasticsearch-indeksistä, sata tunnusta kyselyä kohti. Tarkka ja halpa.
 *
 * Dynasty ja CaseM (~168 riviä): kokouspäivä on asiasivulla, joten sivu
 * haetaan. Päivä ANKKUROIDAAN otsikkoon eikä oteta ensimmäistä
 * päivämäärän näköistä merkkijonoa - Dynastyn HTML sisältää
 * versionumeron "DYNASTY/10.5.0.2601", joka läpäisee päiväkuvion.
 *
 *   npx tsx scripts/backfill-decision-dates.ts
 *   npx tsx scripts/backfill-decision-dates.ts --apply
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

const ES =
  "https://paatokset-elastic-proxy.api.hel.ninja/paatokset_decisions/_search"
const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const PAGE_CONCURRENCY = 4

const iso = (d: number, m: number, y: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`

/*
 * Dynasty: otsikkorivi on "Konsernijaosto Pöytäkirja 16.06.2026".
 * Ankkurina h1title, koska sivun lopussa on versionumero joka näyttää
 * päivämäärältä.
 */
function dynastyMeetingDate(html: string): string | null {
  const m = html.match(
    /class="h1title"[\s\S]{0,300}?(\d{1,2})\.(\d{1,2})\.(\d{4})/i
  )
  return m ? iso(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

/* CaseM: asiakirjan otsikkorivillä lukee "Kokous 12.5.2026". */
function casemMeetingDate(html: string): string | null {
  const m = html.match(/Kokous\s+(\d{1,2})\.(\d{1,2})\.(\d{4})/i)
  return m ? iso(Number(m[1]), Number(m[2]), Number(m[3])) : null
}

async function helsinkiDates(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100)
    const res = await fetch(ES, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": UA,
      },
      body: JSON.stringify({
        query: { bool: { filter: [{ terms: { unique_issue_id: chunk } }] } },
        _source: ["unique_issue_id", "meeting_date"],
        sort: [{ meeting_date: "asc" }],
        size: 1000,
      }),
    })
    if (!res.ok) {
      console.log(`  ES-virhe ${res.status}`)
      continue
    }
    const json: any = await res.json()
    for (const hit of json?.hits?.hits ?? []) {
      const s = hit._source ?? {}
      const id = Array.isArray(s.unique_issue_id) ? s.unique_issue_id[0] : s.unique_issue_id
      const md = Array.isArray(s.meeting_date) ? s.meeting_date[0] : s.meeting_date
      if (!id || typeof md !== "number") continue

      /*
       * SAMA ASIA SAA USEITA PÄÄTÖKSIÄ, JA UUSIN ON OIKEA.
       *
       * Ensimmäinen versio otti vanhimman sillä perusteella että se kertoo
       * milloin asia tuli vireille. Se on väärä valinta tähän tarkoitukseen:
       * jos 2021 avatussa asiassa on tehty päätös 2026, hanke on elossa
       * eikä vanhentunut. Vanhin päivä merkitsisi sen viisi vuotta vanhaksi
       * ja johtaisi elävän hankkeen piilottamiseen - juuri se virhesuunta
       * jota vältetään.
       *
       * Uusin päätös vastaa kysymykseen "milloin tässä asiassa viimeksi
       * tapahtui jotain", joka on se mitä vanhentumisesta halutaan tietää.
       */
      const date = new Date(md * 1000).toISOString().slice(0, 10)
      const known = out.get(String(id))
      if (!known || date > known) out.set(String(id), date)
    }
  }

  return out
}

async function pageDate(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA } })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const declared = res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1]
    let html: string
    try {
      html = new TextDecoder(declared ?? "utf-8").decode(buffer)
    } catch {
      html = new TextDecoder("utf-8").decode(buffer)
    }
    return url.includes("cloudnc.fi") ? casemMeetingDate(html) : dynastyMeetingDate(html)
  } catch {
    return null
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string) => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select("id, metadata")
        .range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  type Target = { table: string; id: string; metadata: any; issueId: string; url: string }
  const targets: Target[] = []

  for (const table of ["potential_projects", "projects"]) {
    for (const r of await page(table)) {
      const source = String(r.metadata?.source ?? "")
      if (!/paatokset|paatos/i.test(source)) continue
      /*
       * `--force` laskee päivän uudelleen myös riveille joilla se jo on.
       * Tarvittiin kun valinta vaihtui vanhimmasta uusimpaan päätökseen.
       */
      if (r.metadata?.decision_date && !process.argv.includes("--force")) continue

      const issueId = String(r.metadata?.permit_number ?? "")
      const url = String(r.metadata?.source_url ?? "")
      if (!issueId && !url) continue

      targets.push({ table, id: r.id, metadata: r.metadata, issueId, url })
    }
  }

  const helsinki = targets.filter((t) => /^HEL-/i.test(t.issueId))
  const pages = targets.filter((t) => !/^HEL-/i.test(t.issueId) && t.url)

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n` +
      `  ilman paatospaivaa: ${targets.length}\n` +
      `    Ahjo (asiatunnus): ${helsinki.length}\n` +
      `    Dynasty/CaseM (sivuhaku): ${pages.length}\n`
  )

  const resolved = new Map<string, string>()

  const byIssue = await helsinkiDates([...new Set(helsinki.map((t) => t.issueId))])
  console.log(`  Ahjo: ${byIssue.size} tunnusta ratkesi`)
  for (const t of helsinki) {
    const d = byIssue.get(t.issueId)
    if (d) resolved.set(`${t.table}:${t.id}`, d)
  }

  let cursor = 0
  let pageOk = 0
  await Promise.all(
    Array.from({ length: PAGE_CONCURRENCY }, async () => {
      while (cursor < pages.length) {
        const t = pages[cursor++]
        const d = await pageDate(t.url)
        if (d) {
          resolved.set(`${t.table}:${t.id}`, d)
          pageOk++
        }
      }
    })
  )
  console.log(`  Dynasty/CaseM: ${pageOk}/${pages.length} sivua ratkesi\n`)

  const years: Record<string, number> = {}
  for (const d of resolved.values()) years[d.slice(0, 4)] = (years[d.slice(0, 4)] ?? 0) + 1
  console.log("  paatosvuodet:")
  for (const [y, n] of Object.entries(years).sort()) {
    console.log(`    ${y}: ${String(n).padStart(4)}`)
  }
  console.log(`\n  ratkesi yhteensa: ${resolved.size}/${targets.length}`)

  if (!APPLY) return

  let done = 0
  for (const t of targets) {
    const date = resolved.get(`${t.table}:${t.id}`)
    if (!date) continue
    const { error } = await supabase
      .from(t.table)
      .update({ metadata: { ...t.metadata, decision_date: date } })
      .eq("id", t.id)
    if (error) console.log(`  VIRHE ${t.id}: ${error.message}`)
    else done++
  }
  console.log(`\nkirjoitettu: ${done}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
