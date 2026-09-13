import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YVA-HANKKEEN MUUT YRITYKSET LIITTYVIKSI (D-192).
 *
 * Rakennuttajaa ei arvata tekstin ensimmäisestä yritysnimestä - ne ovat
 * valtaosin konsultteja (Sitowise, Ramboll, AFRY, Sweco) ja verkkoyhtiöitä
 * (Fingrid). Ne ovat silti hankkeen aitoja osapuolia, joten ne kirjataan
 * `related_companies`-kenttään.
 *
 * VAIN TYHJIIN: olemassa olevaa listaa ei korvata.
 *
 * EI VERKKOHAKUA - teksti on tallessa.
 *
 *   npx tsx scripts/fix-yva-liittyvat-yritykset.ts
 *   npx tsx scripts/fix-yva-liittyvat-yritykset.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const NAYTTEITA = Number(process.argv.find((a) => a.startsWith("--naytteet="))?.split("=")[1] ?? 12)

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractYvaCompanies } = await import("../lib/agent/fetchYvaSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let rivit = 0
  let yrityksia = 0
  const naytteet: string[] = []

  for (const table of ["potential_projects", "projects"] as const) {
    const isQueue = table === "potential_projects"
    const columns = isQueue
      ? "id, title, metadata"
      : "id, name, developer, additional_info, metadata"

    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    for (const row of rows) {
      if (row.metadata?.source_name !== "yva") continue

      const nykyiset = Array.isArray(row.metadata?.related_companies)
        ? row.metadata.related_companies
        : []
      if (nykyiset.length > 0) continue

      const otsikko = String(row.title ?? row.name ?? "")
      const teksti = String(row.additional_info ?? row.metadata?.description ?? "")
      const developer = row.developer ?? row.metadata?.developer ?? null

      const yritykset = extractYvaCompanies(`${otsikko} ${teksti}`, developer)
      if (yritykset.length === 0) continue

      rivit++
      yrityksia += yritykset.length

      if (naytteet.length < NAYTTEITA) {
        naytteet.push(
          `${otsikko.slice(0, 52)}\n    rakennuttaja: ${developer ?? "-"}\n    liittyvät: ${JSON.stringify(yritykset)}`
        )
      }

      if (!APPLY) continue

      await supabase
        .from(table)
        .update({ metadata: { ...(row.metadata ?? {}), related_companies: yritykset } })
        .eq("id", row.id)
    }
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`rivejä: ${rivit}, yrityksiä yhteensä: ${yrityksia}`)
  console.log("\nnäytteitä:")
  for (const n of naytteet) console.log(`  ${n}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
