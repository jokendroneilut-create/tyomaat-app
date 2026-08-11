/*
 * Täydentää YVA-menettelyn tilan olemassa oleviin riveihin.
 *
 * `projectPhase` on ollut haettuna ES-vastauksessa alusta asti mutta
 * jäänyt käyttämättä: jokainen YVA-rivi sai kovakoodatun vaiheen
 * "Suunnittelussa" eikä lähteen omaa tilaa tallennettu lainkaan.
 *
 * VAIHETTA EI MUUTETA. "Päättynyt / perusteltu päätelmä annettu"
 * tarkoittaa että YVA-menettely on ohi ja hanke etenee luvitukseen -
 * ei että hanke olisi valmis. Tila kirjoitetaan omaan kenttäänsä ja
 * kuvauksen alkuun; `phase_hint` jätetään koskematta.
 *
 *   npx tsx scripts/backfill-yva-status.ts
 *   npx tsx scripts/backfill-yva-status.ts --apply
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

const SEARCH_URL = "https://www.ymparisto.fi/fi/app/search/query"
const ES_QUERY = {
  _source: ["id", "link", "title", "projectPhase"],
  query: { bool: { filter: [{ term: { type: "yva_project" } }] } },
  sort: [{ publishTime: { order: "desc" } }],
}

const PROJECT_URL = (link: string) =>
  link?.startsWith("http") ? link : `https://www.ymparisto.fi${link || ""}`

async function fetchStatuses() {
  const byUrl = new Map<string, string>()

  for (let page = 0; page < 12; page++) {
    const res = await fetch(SEARCH_URL, {
      method: "POST",
      cache: "no-store",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
      },
      body: JSON.stringify({ ...ES_QUERY, from: page * 150, size: 150 }),
    })
    if (!res.ok) break

    const json: any = await res.json()
    const hits: any[] = json?.hits?.hits ?? []
    if (!hits.length) break

    for (const h of hits) {
      const s = h._source ?? {}
      const raw = Array.isArray(s.projectPhase) ? s.projectPhase[0] : s.projectPhase
      const status = String(raw ?? "").replace(/\s+/g, " ").trim()
      if (status && s.link) byUrl.set(PROJECT_URL(s.link), status)
    }
    if (hits.length < 150) break
  }

  return byUrl
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const byUrl = await fetchStatuses()
  console.log(`lahteesta luettuja tiloja: ${byUrl.size}`)

  const jakauma: Record<string, number> = {}
  for (const v of byUrl.values()) jakauma[v] = (jakauma[v] ?? 0) + 1
  for (const [k, v] of Object.entries(jakauma).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(v).padStart(4)}  ${k}`)
  }

  console.log(
    `\n${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`
  )

  for (const table of ["potential_projects", "projects"]) {
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

    const mine = rows.filter((r) => r.metadata?.source === "yva")
    const targets = mine.filter((r) => {
      const status = r.metadata?.source_url ? byUrl.get(r.metadata.source_url) : undefined
      return status && r.metadata?.yva_status !== status
    })

    const perStatus: Record<string, number> = {}
    for (const r of targets) {
      const s = byUrl.get(r.metadata.source_url)!
      perStatus[s] = (perStatus[s] ?? 0) + 1
    }

    console.log(`${table}: ${mine.length} yva-rivia, paivitetaan ${targets.length}`)
    for (const [k, v] of Object.entries(perStatus).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(v).padStart(4)}  ${k}`)
    }
    console.log(`    ei vastinetta lahteessa: ${mine.length - targets.length}`)

    if (!APPLY) continue

    let done = 0
    for (const r of targets) {
      const status = byUrl.get(r.metadata.source_url)!
      const { error } = await supabase
        .from(table)
        .update({ metadata: { ...r.metadata, yva_status: status } })
        .eq("id", r.id)
      if (error) console.log(`    VIRHE ${r.id}: ${error.message}`)
      else done++
    }
    console.log(`    paivitetty: ${done}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
