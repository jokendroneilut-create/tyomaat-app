import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MAAKUNTA KAUPUNGIN PERUSTEELLA.
 *
 * Hanke jolla on kaupunki mutta ei maakuntaa katoaa alueittain suodatetuista
 * näkymistä. Näin kävi 21.8.2026 kuudelle hankkeelle: suorituspaikkatäydennys
 * asetti kaupungin mutta ei maakuntaa. Sama vika voi syntyä mistä tahansa
 * lähteestä, joten korjaus tehdään kaikille hankkeille, ei vain Hilman.
 *
 * EI YLIKIRJOITA. Vain tyhjä maakunta täytetään, ja vain jos kuntarekisteri
 * tunnistaa kaupungin (myös ruotsinkielinen nimi, lakannut kunta tai kylä —
 * ks. PLACE_ALIASES).
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { getMunicipalityByAnyForm } = await import("../lib/geo/municipalityFromName")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, city, region, is_public")
      .is("region", null)
      .not("city", "is", null)
      .range(from, from + 999)
    if (error) throw error
    projects.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  let fixed = 0
  const unresolved: string[] = []
  const rows: string[] = []

  for (const p of projects) {
    const municipality = getMunicipalityByAnyForm(p.city)
    if (!municipality) {
      unresolved.push(`  ${String(p.city).padEnd(24)} ${String(p.name).slice(0, 46)}`)
      continue
    }

    fixed++
    rows.push(
      `  ${String(p.city).padEnd(22)} -> ${municipality.region.padEnd(20)} ${p.is_public ? "näkyvä " : "piilotettu"} ${String(p.name).slice(0, 40)}`
    )

    if (!APPLY) continue

    await supabase.from("projects").update({ region: municipality.region }).eq("id", p.id)
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`hankkeita ilman maakuntaa:  ${projects.length}`)
  console.log(`  maakunta täydennetään:    ${fixed}`)
  console.log(`  kaupunki ei tunnistu:     ${unresolved.length}`)

  if (rows.length) { console.log("\ntäydennettävät:"); for (const r of rows) console.log(r) }
  if (unresolved.length) {
    console.log("\nei ratkennut (vaatii käsin korjauksen TIC:issä):")
    for (const r of unresolved) console.log(r)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
