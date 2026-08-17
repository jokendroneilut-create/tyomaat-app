import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TAKAUTUVA KORJAUS TALLENNETUSTA TEKSTISTÄ.
 *
 * `extractReleaseBody`n katkaisukuvio tunsi vain sanamuodon "Sinua
 * saattaisi kiinnostaa", joten sivun häntä — naapuriartikkelit,
 * uutiskirjemainokset, jakopalkit — jäi kuvaukseen. Mitattu 18.8.2026:
 * 323 riviä 12 513:sta.
 *
 * EI UUTTA VERKKOHAKUA. Sama roska on jo tallennetussa tekstissä, joten
 * leikkaus voidaan tehdä siihen suoraan. Samalla poimitaan puuttuva
 * rakennuttaja, jos siivottu teksti nimeää tilaajan yksiselitteisesti.
 *
 * Aja ensin ilman --apply-lippua: se ei kirjoita mitään.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { cutReleaseTail } = await import("../lib/agent/companyRelease")
  const { extractExplicitClient } = await import("../lib/agent/fetchSttHakuSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let cleaned = 0
  let developersAdded = 0
  let charsRemoved = 0
  const samples: string[] = []

  for (const table of ["potential_projects", "projects"] as const) {
    const isQueue = table === "potential_projects"
    const columns = isQueue ? "id, metadata" : "id, additional_info, developer, metadata"

    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    for (const row of rows) {
      const current = isQueue
        ? String(row.metadata?.description ?? "")
        : String(row.additional_info ?? row.metadata?.description ?? "")

      if (!current) continue

      const next = cutReleaseTail(current)
      /* Vain aito hännän leikkaus, ei välilyöntieroja. */
      if (next === current || current.length - next.length < 40 || next.length < 120) continue

      /* Rakennuttaja vain jos se puuttuu — käsin syötettyä ei ylikirjoiteta. */
      const existingDeveloper = isQueue ? row.metadata?.developer : row.developer
      const client = existingDeveloper ? null : extractExplicitClient(next)

      cleaned++
      charsRemoved += current.length - next.length
      if (client) developersAdded++

      if (samples.length < 6) {
        samples.push(
          `${table} ${String(row.id).slice(0, 8)}… ${current.length} → ${next.length} merkkiä` +
            (client ? `  rakennuttaja: ${client}` : "")
        )
      }

      if (!APPLY) continue

      if (isQueue) {
        await supabase
          .from("potential_projects")
          .update({
            metadata: {
              ...(row.metadata ?? {}),
              description: next,
              ...(client ? { developer: client } : {}),
              description_cleaned_at: new Date().toISOString(),
            },
          })
          .eq("id", row.id)
      } else {
        await supabase
          .from("projects")
          .update({
            additional_info: next,
            ...(client ? { developer: client } : {}),
            metadata: {
              ...(row.metadata ?? {}),
              description: next,
              description_cleaned_at: new Date().toISOString(),
            },
          })
          .eq("id", row.id)
      }
    }
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`siivottuja kuvauksia:      ${cleaned}`)
  console.log(`poistettuja merkkejä:      ${charsRemoved}`)
  console.log(`rakennuttaja täydentyi:    ${developersAdded}`)
  console.log("\nnäytteitä:")
  for (const s of samples) console.log(`  ${s}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
