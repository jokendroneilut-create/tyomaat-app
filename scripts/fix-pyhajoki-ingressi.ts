import { readFileSync } from "node:fs"
import * as cheerio from "cheerio"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PYHÄJOEN KAAVASIVUJEN INGRESSI JA HANKKEESTA VASTAAVA (D-190).
 *
 * Kerääjä luki vain leipätekstilohkon, joten sivun ENSIMMÄINEN virke jäi
 * pois - ja juuri siinä lukee hankkeen omistaja. Mitattu 13.9.2026
 * Hanhelan datakeskuskaavasta: tallessa 782 merkkiä, sivulla 886, ja
 * puuttuva osa oli "Verda Cloud Oy (”Verda”) suunnittelee
 * datakeskushanketta Pyhäjoen kunnan pohjoisosaan kantaverkon varteen".
 *
 * Sivut haetaan uudelleen, koska puuttuvaa tekstiä ei ole tallessa.
 * Kuvaus korvataan vain jos uusi on pidempi, ja rakennuttaja kirjataan
 * vain jos kenttä on tyhjä.
 *
 *   npx tsx scripts/fix-pyhajoki-ingressi.ts
 *   npx tsx scripts/fix-pyhajoki-ingressi.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const VIIVE_MS = 1000
const nuku = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractYvaDeveloper } = await import("../lib/agent/fetchYvaSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (const table of ["potential_projects", "projects"] as const) {
    const columns =
      table === "potential_projects"
        ? "id, title, metadata"
        : "id, name, developer, additional_info, metadata"
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      for (const r of data ?? []) {
        if ((r as any).metadata?.source_name !== "Pyhäjoen kaavoitus") continue
        rivit.push({ ...(r as any), _taulu: table })
      }
      if (!data || data.length < 1000) break
    }
  }

  console.log(`Pyhäjoen kaavarivejä: ${rivit.length}`)

  /* Sama sivu voi olla usealla rivillä: haetaan kerran. */
  const sivut = new Map<string, { kuvaus: string; developer: string | null }>()
  for (const url of new Set(rivit.map((r) => String(r.metadata?.source_url ?? "")).filter(Boolean))) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } })
      if (!res.ok) {
        console.log(`  HAKU EPÄONNISTUI ${res.status}: ${url}`)
        continue
      }
      const $ = cheerio.load(await res.text())
      const ingressi = $(".field--name-field-ingressi").first().text().replace(/\s+/g, " ").trim()
      const body = $(".block-field-blocknodepagebody").first().text().replace(/\s+/g, " ").trim()
      const liitteet = $("a[href*='.pdf']")
        .toArray()
        .map((a) => $(a).text().replace(/\s+/g, " ").trim())
        .filter(Boolean)
      const kuvaus = [ingressi, body, ...liitteet].filter(Boolean).join(" ")
      sivut.set(url, { kuvaus, developer: extractYvaDeveloper(kuvaus) })
    } catch {
      console.log(`  VIRHE: ${url}`)
    }
    await nuku(VIIVE_MS)
  }

  let kuvauksia = 0
  let yrityksia = 0

  for (const r of rivit) {
    const sivu = sivut.get(String(r.metadata?.source_url ?? ""))
    if (!sivu) continue

    const nykyKuvaus = String(r.metadata?.description ?? "")
    const kuvausPitenee = sivu.kuvaus.length > nykyKuvaus.length
    const nykyDeveloper = r.developer ?? r.metadata?.developer ?? null
    const uusiDeveloper = !nykyDeveloper && sivu.developer ? sivu.developer : null

    if (!kuvausPitenee && !uusiDeveloper) continue
    if (kuvausPitenee) kuvauksia++
    if (uusiDeveloper) yrityksia++

    console.log(`\n${r._taulu} ${String(r.title ?? r.name).slice(0, 52)}`)
    if (kuvausPitenee) {
      console.log(`    kuvaus ${nykyKuvaus.length} -> ${sivu.kuvaus.length} merkkiä`)
      console.log(`    lisää alkuun: "${sivu.kuvaus.slice(0, Math.max(0, sivu.kuvaus.length - nykyKuvaus.length)).slice(0, 150)}"`)
    }
    if (uusiDeveloper) console.log(`    rakennuttaja (tyhjä) -> "${uusiDeveloper}"`)

    if (!APPLY) continue

    const metadata = {
      ...(r.metadata ?? {}),
      ...(kuvausPitenee ? { description: sivu.kuvaus } : {}),
      ...(uusiDeveloper ? { developer: uusiDeveloper } : {}),
    }

    await supabase
      .from(r._taulu)
      .update(
        r._taulu === "projects"
          ? {
              metadata,
              ...(kuvausPitenee && r.additional_info ? { additional_info: sivu.kuvaus } : {}),
              ...(uusiDeveloper ? { developer: uusiDeveloper } : {}),
            }
          : { metadata }
      )
      .eq("id", r.id)
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`kuvaus taydentyy:      ${kuvauksia}`)
  console.log(`rakennuttaja lisataan: ${yrityksia}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
