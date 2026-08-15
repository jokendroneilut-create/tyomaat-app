/*
 * Poimii YVA-hankkeiden rakennuttajan hankesivun nimetystä kentästä.
 *
 * `fetchYvaSource` lukee rakennuttajan hakurajapinnan leipätekstistä
 * proosakuvioilla. Se osuu 146:een hankkeeseen 240:stä; lopuilla 94:llä nimi
 * EI OLE leipätekstissä lainkaan (mitattu 15.8.2026: sana "hankevastaava"
 * osui 1/94). Nimi on hankesivulla nimettynä kenttänä "Hankkeesta vastaava",
 * jota hakurajapinta ei palauta.
 *
 * Uusille hankkeille tämä hoituu nyt rikastuskoukulla (lib/agent/sources.ts),
 * mutta jo tallennetut eivät täydenny itsestään — sama ilmiö kuin D-075:ssä.
 *
 *   npx tsx scripts/backfill-yva-developer.ts
 *   npx tsx scripts/backfill-yva-developer.ts --apply --limit=200
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(
  process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 15
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
  const { parseYvaFields, yvaDeveloperFromHtml } = await import(
    "../lib/agent/yvaProjectPage"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, developer, metadata")
      .eq("status", "active")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = rows
    .filter((r: any) => String(r.metadata?.source_name ?? "") === "yva")
    .filter((r: any) => !String(r.developer ?? "").trim())
    .filter((r: any) => r.metadata?.source_url)
    .slice(0, LIMIT)

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}  |  kohteita ${targets.length}\n`
  )

  let found = 0
  let missing = 0
  let failed = 0

  for (const row of targets) {
    let html: string | null = null

    try {
      const response = await fetch(String(row.metadata.source_url), {
        headers: {
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        },
      })
      if (!response.ok) {
        console.log(`  HTTP ${response.status}  ${String(row.name).slice(0, 50)}`)
        failed++
        continue
      }
      html = await response.text()
    } catch (error: any) {
      console.log(`  VIRHE ${String(error?.message ?? error).slice(0, 40)}  ${String(row.name).slice(0, 40)}`)
      failed++
      continue
    }

    const fields = parseYvaFields(html)
    const developer = yvaDeveloperFromHtml(html)

    if (!developer) {
      missing++
      console.log(`  -                     ${String(row.name).slice(0, 52)}`)
      continue
    }

    found++
    console.log(
      `  ${developer.slice(0, 34).padEnd(36)} ${String(row.name).slice(0, 46)}`
    )

    if (!APPLY) continue

    const { error } = await supabase
      .from("projects")
      .update({
        developer,
        metadata: {
          ...(row.metadata ?? {}),
          yva_authority: fields["Yhteysviranomainen"] ?? null,
          yva_consultant: fields["Konsultti"] ?? null,
          yva_record_number: fields["Diaarinumero"] ?? null,
          developer_source: "yva_page",
          enriched_at: new Date().toISOString(),
        },
      })
      .eq("id", row.id)

    if (error) console.log(`     VIRHE: ${error.message}`)
  }

  console.log(
    `\nrakennuttaja löytyi ${found}, ei kentässä ${missing}, haku epäonnistui ${failed}`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
