import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HELSINGIN WFS-KAAVAHAKEMISTO POIS KAYTOSTA (D-218).
 *
 * Lahde on geometriahakemisto: otsikot ovat muotoa "Kaava 13021 -
 * OULUNKYLA" eika kuvausta ole lainkaan (mediaani 25 merkkia).
 *
 * Mitattu 29.9.2026:
 *
 *   hyvaksytty    4
 *   hylatty      90
 *   82 / 94 dokumentista vastaa kaavanumerolla SUKKA-rivia
 *
 * SUKKA (Helsingin vireilla olevat asemakaavat) kattaa saman aineiston
 * kunnollisella otsikolla ja 86-913 merkin kuvauksella, ja siita on
 * hyvaksytty 198 hanketta.
 *
 * EI POISTETA VAAN KYTKETAAN POIS. Rivi ja sen historia jaavat kantaan,
 * joten paatoksen voi perua ja vanhat dokumentit sailyvat.
 *
 *   npx tsx scripts/fix-poista-helsingin-wfs.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-poista-helsingin-wfs.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const NIMI = "Helsingin vireillä olevat kaavat"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: lahde, error } = await db
    .from("discovery_sources")
    .select("id, name, parser, enabled, priority, run_count, last_success_at")
    .eq("name", NIMI)
    .maybeSingle()
  if (error) throw error
  if (!lahde) { console.log(`Lahdetta "${NIMI}" ei loydy`); return }

  console.log("lahde:", JSON.stringify(lahde))

  const tilat = new Map<string, number>()
  for (let from = 0; ; from += 500) {
    const { data, error: e } = await db
      .from("potential_projects")
      .select("status")
      .eq("metadata->>source_name", NIMI)
      .order("id")
      .range(from, from + 499)
    if (e) throw e
    for (const r of data ?? []) tilat.set(String(r.status), (tilat.get(String(r.status)) ?? 0) + 1)
    if (!data || data.length < 500) break
  }
  console.log("ehdokkaiden tilat:", [...tilat].map(([k, v]) => `${k} ${v}`).join(", "))

  const { count: hankkeita } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("metadata->>source_name", NIMI)
  console.log(`hyvaksyttyja hankkeita (jaavat ennalleen): ${hankkeita}`)

  if (!lahde.enabled) { console.log("\nLahde on jo pois kaytosta."); return }

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS: kytkettaisiin pois ==="); return }

  const { error: e2 } = await db
    .from("discovery_sources")
    .update({ enabled: false })
    .eq("id", lahde.id)
  if (e2) throw e2

  console.log("\n=== KYTKETTY POIS ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
