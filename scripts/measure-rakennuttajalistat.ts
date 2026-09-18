import { readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RAKENNUTTAJAKENTTAAN KERTYNEET LISTAT (ROADMAP, D-189).
 *
 * Tulostaa hyvaksytyt hankkeet, joiden developer-kentassa on erotin
 * (pilkku, " ja ", " sekä ", "/", ";"), jaettuna osiin. Ohkolanlaakson
 * esimerkissa ("Destia Oy, WSP Finland Oy") KUMPIKAAN ei ole rakennuttaja,
 * joten mekaaninen "eka nimi rakennuttajaksi" ei kelpaa - rivit luetaan.
 *
 *   npx tsx scripts/measure-rakennuttajalistat.ts
 */
const TULOS = join(tmpdir(), "rakennuttajalistat.txt")
const EROTIN = /,\s+|\s+ja\s+|\s+sekä\s+|\s*\/\s*|;\s*/

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("id, name, developer, builder, is_public, metadata").range(from, from + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const out: string[] = []
  let n = 0
  for (const r of rivit) {
    const d = String(r.developer ?? "").trim()
    if (!d || !EROTIN.test(d)) continue
    n++
    const osat = d.split(EROTIN).map((s) => s.trim()).filter(Boolean)
    out.push(`${r.is_public ? "N" : "-"} [${r.metadata?.source_name ?? "?"}] ${String(r.name).slice(0, 60)}\n    developer: ${d}\n    osat: ${osat.map((o) => `«${o}»`).join(" ")}\n    builder: ${r.builder ?? "-"}`)
  }
  writeFileSync(TULOS, out.join("\n"), "utf8")
  console.log(`hankkeita ${rivit.length}, developer-kentässä erotin: ${n} -> ${TULOS}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
