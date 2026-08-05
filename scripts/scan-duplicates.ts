/*
 * Ajaa duplikaattiskannauksen paikallisesti ilman serverless-aikarajaa.
 *
 * /api/admin/scan-duplicates on rajattu 60 sekuntiin, mikä ei riitä kun
 * ikkunassa on paljon muuttuneita hankkeita. Tämä on sama skannaus ilman
 * rajaa, ja tulostaa mitoituksen jotta nähdään mahtuuko cron-ajo rajaan.
 *
 *   npx tsx scripts/scan-duplicates.ts              # inkrementaalinen (7 vrk)
 *   npx tsx scripts/scan-duplicates.ts --days=30
 *   npx tsx scripts/scan-duplicates.ts --full       # koko hankejoukko
 *   npx tsx scripts/scan-duplicates.ts --dry        # vain mitoitus
 */
import { readFileSync } from "node:fs"

const FULL = process.argv.includes("--full")
const DRY = process.argv.includes("--dry")
const DAYS = Number(
  process.argv.find((a) => a.startsWith("--days="))?.split("=")[1] ?? 7
)

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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { count: publicTotal } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("is_public", true)

  let projectIds: string[] | undefined

  if (!FULL) {
    const since = new Date(Date.now() - DAYS * 86400000).toISOString()
    const recent: any[] = []

    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("projects")
        .select("id")
        .eq("is_public", true)
        .or(`created_at.gte.${since},last_verified_at.gte.${since}`)
        .range(from, from + 999)

      if (error) throw error
      recent.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    projectIds = recent.map((p) => p.id)
  }

  const compared = FULL
    ? ((publicTotal ?? 0) * ((publicTotal ?? 0) - 1)) / 2
    : (projectIds?.length ?? 0) * (publicTotal ?? 0)

  console.log(`julkisia hankkeita:            ${publicTotal}`)
  console.log(
    FULL
      ? `tila:                          täysi läpikäynti`
      : `${DAYS} vrk:n ikkunassa muuttuneita:  ${projectIds?.length}`
  )
  console.log(`vertailuja (arvio):            ${compared.toLocaleString("fi-FI")}`)

  if (DRY) return

  const { scanForDuplicates } = await import(
    "../lib/agent/duplicates/scanForDuplicates"
  )

  const startedAt = Date.now()
  const result = await scanForDuplicates(projectIds ? { projectIds } : {})
  const seconds = Math.round((Date.now() - startedAt) / 1000)

  console.log(`\ntulos (${seconds} s):`)
  console.log(`  hankkeita skannattu:  ${result.projectsScanned}`)
  console.log(`  pareja verrattu:      ${result.pairsCompared.toLocaleString("fi-FI")}`)
  console.log(`  ehdokkaita löytyi:    ${result.candidatesFound}`)

  if (seconds > 55) {
    console.log(
      `\nHUOM: ajo kesti ${seconds} s. /api/admin/scan-duplicates on rajattu ` +
        `60 sekuntiin (maxDuration), joten cron-ajo ei ehdi loppuun.`
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
