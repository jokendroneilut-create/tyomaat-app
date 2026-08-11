/*
 * Päivittää jo hyväksyttyjen kaavahankkeiden kuvauksen vastaamaan
 * lähdedokumentin uutta, täydempää tekstiä.
 *
 * MIKSI ERILLINEN AJO. projects-rivi syntyy hyväksynnän hetkellä ja on
 * siitä eteenpäin tilannekuva: discovery-putken uudelleenajo päivittää
 * source_documents- ja fakta-rivit, mutta ei kosketa jo hyväksyttyä
 * hanketta. Ilman tätä Energiakujan kuvaus jäisi ikuisesti siihen
 * yhteen kappaleeseen josta Microsoft-maininta puuttuu.
 *
 * VAIN LAAJENNUS, EI YLIKIRJOITUS. Rivi päivitetään ainoastaan jos uusi
 * teksti alkaa täsmälleen vanhalla tekstillä. Silloin kyse on samasta
 * kuvauksesta jatkettuna, eikä käsin tehtyä muokkausta voi hukata.
 * Muut erot raportoidaan mutta jätetään koskematta.
 *
 *   npx tsx scripts/backfill-kaava-descriptions.ts
 *   npx tsx scripts/backfill-kaava-descriptions.ts --apply
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

const PARSERS = [
  "kirkkonummiKaavaParser",
  "seinajokiKaavaParser",
  "savonlinnaKaavaParser",
  "lappeenrantaKaavaParser",
]

const norm = (s: string) => s.replace(/\s+/g, " ").trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: sources, error: se } = await supabase
    .from("discovery_sources")
    .select("id, name")
    .in("parser", PARSERS)
  if (se) throw se

  const byUrl = new Map<string, string>()
  for (const s of sources ?? []) {
    const { data } = await supabase
      .from("source_documents")
      .select("document_url, raw_payload")
      .eq("source_id", s.id)
    for (const d of data ?? []) {
      const desc = d.raw_payload?.description
      if (typeof desc === "string" && desc.trim()) byUrl.set(d.document_url, desc)
    }
  }
  console.log(`lahdedokumentteja joilla kuvaus: ${byUrl.size}`)

  const all: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, additional_info, metadata")
      .range(from, from + 999)
    if (error) throw error
    all.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const names = new Set((sources ?? []).map((s) => s.name))
  const mine = all.filter((r) => names.has(r.metadata?.source))
  console.log(`hankkeita naista lahteista: ${mine.length}`)

  const extend: { row: any; next: string }[] = []
  const conflict: any[] = []
  let missing = 0
  let same = 0

  for (const row of mine) {
    const url = row.metadata?.source_url
    const next = url ? byUrl.get(url) : undefined
    if (!next) {
      missing++
      continue
    }
    const current = String(row.additional_info ?? "")
    if (norm(current) === norm(next)) {
      same++
      continue
    }
    if (!current.trim() || norm(next).startsWith(norm(current))) extend.push({ row, next })
    else conflict.push(row)
  }

  console.log(
    `\n${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}` +
      `\n  laajennetaan:        ${extend.length}` +
      `\n  ennallaan:           ${same}` +
      `\n  ei lahdedokumenttia: ${missing}` +
      `\n  ristiriita (ei kosketa): ${conflict.length}`
  )

  for (const r of conflict.slice(0, 10)) {
    console.log(`    ristiriita: ${String(r.name).slice(0, 60)}`)
  }

  for (const { row, next } of extend.slice(0, 5)) {
    console.log(
      `\n  ${String(row.name).slice(0, 60)}: ${String(row.additional_info ?? "").length} -> ${next.length} mrk`
    )
  }

  if (!APPLY) return

  let done = 0
  for (const { row, next } of extend) {
    const { error } = await supabase
      .from("projects")
      .update({ additional_info: next })
      .eq("id", row.id)
    if (error) console.log(`  VIRHE ${row.id}: ${error.message}`)
    else done++
  }
  console.log(`\npaivitetty: ${done}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
