import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YVA-HANKKEEN RAKENNUTTAJA OTSIKOSTA (D-191).
 *
 * Otsikko on muotoa "<yritys>, <hankkeen nimi>", mutta sitä ei luettu -
 * rakennuttaja haettiin vain leipätekstistä. Mitattu 13.9.2026: 579
 * YVA-rivistä 136:lta puuttui rakennuttaja, ja 16:lla yhtiömuoto on
 * otsikossa.
 *
 * VAIN TYHJIIN. Olemassa olevaa arvoa ei korvata: leipätekstin ankkuroitu
 * poiminta on vahvempi todiste kuin otsikon muoto.
 *
 * EI VERKKOHAKUA - otsikko on tallessa.
 *
 *   npx tsx scripts/fix-yva-rakennuttaja-otsikosta.ts
 *   npx tsx scripts/fix-yva-rakennuttaja-otsikosta.ts --apply
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { developerFromYvaTitle } = await import("../lib/agent/fetchYvaSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let lisatty = 0

  for (const table of ["potential_projects", "projects"] as const) {
    const isQueue = table === "potential_projects"
    const columns = isQueue ? "id, title, metadata" : "id, name, developer, metadata"

    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    for (const row of rows) {
      if (row.metadata?.source_name !== "yva") continue
      if (row.developer ?? row.metadata?.developer) continue

      const otsikko = String(row.title ?? row.name ?? "")
      const uusi = developerFromYvaTitle(otsikko)
      if (!uusi) continue

      lisatty++
      console.log(`${table.padEnd(20)} "${uusi}"  <- ${otsikko.slice(0, 66)}`)

      if (!APPLY) continue

      const metadata = { ...(row.metadata ?? {}), developer: uusi }
      await supabase
        .from(table)
        .update(isQueue ? { metadata } : { metadata, developer: uusi })
        .eq("id", row.id)
    }
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`rakennuttaja lisatty: ${lisatty}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
