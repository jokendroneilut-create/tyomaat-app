/*
 * Tilien hankintaraportti: montako tiliä luotu, milloin, ja mille
 * yrityksille.
 *
 * Lukee account_lifecycle-taulusta eikä auth.usersista, jotta myös
 * poistetut tilit ovat mukana - juuri sitä varten taulu tehtiin.
 *
 *   npx tsx scripts/report-accounts.ts
 *   npx tsx scripts/report-accounts.ts --months 24
 */
import { readFileSync } from "node:fs"

const monthsArg = process.argv.indexOf("--months")
const MONTHS = monthsArg > 0 ? Number(process.argv[monthsArg + 1]) || 12 : 12

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

/*
 * ILMAISSAHKOPOSTI EI OLE YRITYS. Ilman tata listaa "gmail.com"
 * nayttaisi suurimmalta asiakkaalta - mitattu 15.8.2026: 15 tilia.
 * Lista on tarkoituksella suomipainotteinen.
 */
const FREEMAIL = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "icloud.com", "live.com",
  "yahoo.com", "me.com", "msn.com", "protonmail.com", "proton.me",
  "suomi24.fi", "luukku.com", "pp.inet.fi", "elisanet.fi",
  "dnainternet.net", "kolumbus.fi", "saunalahti.fi", "netti.fi",
])

const domainOf = (email: string | null | undefined) =>
  String(email ?? "").split("@")[1]?.toLowerCase() ?? null

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("account_lifecycle")
      .select("*")
      .range(from, from + 999)
    if (error) {
      console.log("Taulua account_lifecycle ei ole tai se ei ole luettavissa.")
      console.log(`(${error.message})`)
      process.exit(1)
    }
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const created = rows.filter((r) => r.event === "created")
  const deleted = new Set(rows.filter((r) => r.event === "deleted").map((r) => r.user_id))

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - MONTHS)

  const inWindow = created.filter((r) => new Date(r.occurred_at) >= cutoff)

  console.log(`TILIEN HANKINTA - viimeiset ${MONTHS} kk`)
  console.log("=".repeat(56))
  console.log(`\nluotu jaksolla:     ${inWindow.length}`)
  console.log(`niista poistettu:   ${inWindow.filter((r) => deleted.has(r.user_id)).length}`)
  console.log(`kaikkiaan lokissa:  ${created.length} (poistettuja ${deleted.size})`)

  const byMonth = new Map<string, number>()
  for (const r of inWindow) {
    const k = String(r.occurred_at).slice(0, 7)
    byMonth.set(k, (byMonth.get(k) ?? 0) + 1)
  }
  console.log(`\nKUUKAUSITTAIN`)
  for (const [k, v] of [...byMonth].sort()) {
    console.log(`  ${k}  ${String(v).padStart(3)}  ${"#".repeat(v)}`)
  }

  /*
   * YRITYS = SAHKOPOSTIN DOMAIN. Se on ainoa yritystieto jota kannassa
   * on - erillista yrityskenttaa ei ole. Ilmaissahkopostilla
   * rekisteroitynytta ei voi yhdistaa yritykseen lainkaan.
   */
  const companies = new Map<string, any[]>()
  const freemail: any[] = []
  for (const r of created) {
    const d = domainOf(r.email)
    if (!d) continue
    if (FREEMAIL.has(d)) {
      freemail.push(r)
      continue
    }
    if (!companies.has(d)) companies.set(d, [])
    companies.get(d)!.push(r)
  }

  console.log(`\nYRITYKSET (sähköpostin domainin mukaan)`)
  console.log(`  eri yrityksiä:            ${companies.size}`)
  console.log(`  tilejä yritysdomainissa:  ${created.length - freemail.length}`)
  console.log(`  ilmaissähköpostilla:      ${freemail.length}  <- ei yhdistettävissä yritykseen`)

  console.log(`\n  yritykset joilla useampi tili:`)
  const multi = [...companies].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length)
  for (const [d, v] of multi) {
    const first = v.map((r) => r.occurred_at).sort()[0]
    console.log(`    ${String(v.length).padStart(3)} tiliä  ${d.padEnd(28)} ensimmäinen ${String(first).slice(0, 10)}`)
  }
  console.log(`\n  yhden tilin yrityksiä: ${companies.size - multi.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
