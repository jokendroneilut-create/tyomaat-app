import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * GRANLUND LAHTEEKSI.
 *
 * Pelkka keraajan committaaminen ei riita - lahde tarvitsee rivin
 * discovery_sources-tauluun (D-001).
 *
 * Nimi on "Granlund projektit", koska resolveFacts ja identityWorker
 * tunnistavat lahteen nimella eivatka parserilla.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

/*
 * id on annettava itse: sarakkeella ei ole oletusarvoa, ja ilman sita
 * insert kaatuu not-null-rajoitteeseen.
 */
const RIVI = {
  id: crypto.randomUUID(),
  name: "Granlund projektit",
  url: "https://www.granlund.fi/wp-json/wp/v2/projects",
  type: "api",
  collector: "apiCollector",
  parser: "granlundParser",
  category: "company_project",
  /* Perustaso, kuten Kreatella - ei kiireellinen mutta ei myoskaan turha. */
  priority: 10,
  refresh_minutes: 1440,
  enabled: true,
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: onJo, error: hErr } = await supabase
    .from("discovery_sources")
    .select("id,name,enabled")
    .eq("name", RIVI.name)
    .maybeSingle()
  if (hErr) throw hErr

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  if (onJo) {
    console.log(`  lahde on jo olemassa: ${onJo.id} (enabled=${onJo.enabled})`)
    return
  }

  console.log("  lisataan uusi lahde:")
  for (const [k, v] of Object.entries(RIVI)) console.log(`    ${k.padEnd(18)} ${v}`)

  if (!APPLY) { console.log("\n(kuivaharjoitus — aja --apply)"); return }

  const { data, error } = await supabase.from("discovery_sources").insert(RIVI).select().single()
  if (error) throw error
  console.log(`\nlisatty: ${data.id}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
