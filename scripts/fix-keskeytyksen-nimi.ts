import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KESKEYTYSETULIITE POIS KILPAILUTUSVAIHEEN HANKKEIDEN NIMISTÄ (D-196).
 *
 * Vain hankkeet joilla keskeytyslippu on päällä JA vaihe on kilpailutus.
 * Muussa vaiheessa oleviin ei kosketa: niiden vaihe on asetettu käsin
 * (Vuosaaren Urheilutalo, "Sopimus myönnetty"), ja etuliite on silloin
 * ainoa jäljellä oleva vihje keskeytyksestä.
 *
 *   npx tsx scripts/fix-keskeytyksen-nimi.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-keskeytyksen-nimi.ts --apply
 */
const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { stripCancellationPrefix, titleSaysCancellation } = await import("../lib/agent/hilmaCancellation")
  const { normalizeLegacyPhase } = await import("../lib/projects/phases")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: projektit, error } = await db.from("projects").select("id, name, phase, metadata").ilike("name", "%keskeyt%")
  if (error) throw error
  let n = 0
  for (const p of (projektit ?? []) as any[]) {
    if (p.metadata?.is_cancelled_procurement !== true) continue
    if (!titleSaysCancellation(p.name)) continue
    if (normalizeLegacyPhase(p.phase) !== "tender") { console.log(`OHITETAAN [${p.phase}] ${p.name}`); continue }
    const uusi = stripCancellationPrefix(p.name)
    if (uusi === p.name) continue
    n++
    console.log(`projects: "${p.name}"\n       -> "${uusi}"`)
    if (APPLY) {
      const { error: e } = await db.from("projects").update({ name: uusi }).eq("id", p.id)
      if (e) throw e
      const { data: ehd } = await db.from("potential_projects").select("id, title").eq("metadata->>approved_project_id", p.id)
      for (const c of (ehd ?? []) as any[]) {
        if (!titleSaysCancellation(c.title)) continue
        const { error: e2 } = await db.from("potential_projects").update({ title: stripCancellationPrefix(c.title) }).eq("id", c.id)
        if (e2) throw e2
      }
    }
  }
  console.log(APPLY ? `\n=== AJETTU: ${n} ===` : `\n=== KUIVAHARJOITUS: ${n} ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
