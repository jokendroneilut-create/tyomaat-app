/*
 * Hakee Rakennuslehden artikkelin leipätekstin riveille joilla on yhä
 * pelkkä RSS-ingressi.
 *
 * MIKSI. Rikastus (enrichRakennuslehtiCandidate) lisättiin 14.8.2026 ja
 * vaikuttaa vain uusiin hakuihin. Vanhoilla riveillä kuvaus on 50-150
 * merkkiä, eikä siitä voi lukea urakoitsijaa, tilaajaa eikä kustannusta.
 * Mitattu esimerkki: "Nyab rakentaa sähköaseman Forssaan" -> 56 merkkiä,
 * artikkelissa 223.
 *
 * Kirjoitetaan vain jos teksti PITENEE. Lyhyempi tulos tarkoittaa että
 * poiminta epäonnistui (maksumuuri, sivu poistettu), ja silloin on
 * parempi pitää se mitä oli.
 *
 *   npx tsx scripts/backfill-rakennuslehti-bodies.ts
 *   npx tsx scripts/backfill-rakennuslehti-bodies.ts --apply
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

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { enrichRakennuslehtiCandidate } = await import("../lib/agent/fetchRakennuslehtiSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string) => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select("*").range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`)

  for (const [table, titleKey] of [["projects", "name"], ["potential_projects", "title"]] as const) {
    const rows = await page(table)
    const mine = rows.filter((r: any) => {
      const url = String(r.source_url ?? r.metadata?.source_url ?? "")
      return url.includes("rakennuslehti.fi")
    })

    console.log(`${table}: ${mine.length} Rakennuslehti-riviä`)

    let grew = 0
    let same = 0
    for (const r of mine) {
      const before = String(r.description ?? r.metadata?.description ?? "")
      const url = r.source_url ?? r.metadata?.source_url

      const enriched = await enrichRakennuslehtiCandidate({
        source_url: url,
        description: before,
      })
      const after = String(enriched.description ?? "")

      if (after.length <= before.length) {
        same++
        continue
      }
      grew++
      console.log(`  ${String(r[titleKey]).slice(0, 56).padEnd(58)} ${before.length} -> ${after.length}`)

      if (!APPLY) continue

      const patch: Record<string, any> = { metadata: { ...r.metadata, description: after } }
      if (r.description !== undefined && r.description !== null) patch.description = after

      const { error } = await supabase.from(table).update(patch).eq("id", r.id)
      if (error) console.log(`    VIRHE: ${error.message}`)
    }

    console.log(`  piteni: ${grew}, ennallaan: ${same}\n`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
