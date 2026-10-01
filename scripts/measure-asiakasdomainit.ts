import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KELPAAKO DOMAIN YRITYKSEN TUNNISTEEKSI?
 *
 * Johannes 1.10.2026: hinta on yrityskohtainen, ja domainia voi kayttaa
 * yrityksen tunnisteena "mikali ei joskus tule yritysta joka kayttaisi
 * vaikka gmail osoitteita".
 *
 * Tama mittaa kaksi asiaa ennen kuin taulun avain lyodaan lukkoon:
 *
 *   1. Montako tunnusta jakaa domainin? Jos jokainen on yksin, hinnan
 *      voisi tallentaa tunnukselle - mutta jos ei, per-tunnus-hinta
 *      laskisi saman asiakkaan MRR:aan monta kertaa.
 *   2. Montako on vapaan sahkopostin domainilla? Ne EIVAT voi olla
 *      yrityksen tunniste: kaksi eri asiakasta gmailissa olisi sama
 *      "yritys".
 *
 *   npx tsx scripts/measure-asiakasdomainit.ts
 */

/* Vapaat sahkopostipalvelut: domain ei kerro naissa yrityksesta mitaan. */
const VAPAAT = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.fi", "outlook.com", "outlook.fi",
  "live.fi", "live.com", "msn.com", "yahoo.com", "icloud.com", "me.com",
  "suomi24.fi", "luukku.com", "elisanet.fi", "pp.inet.fi", "kolumbus.fi", "saunalahti.fi",
  "dnainternet.net", "windowslive.com", "protonmail.com", "proton.me",
])

function domain(email: string): string {
  return String(email ?? "").toLowerCase().split("@")[1] ?? ""
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseAdminEmails } = await import("../lib/auth/roles")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kaikki: any[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    kaikki.push(...(data.users ?? []))
    if ((data.users ?? []).length < 100) break
  }

  /* Myyjat ja adminit eivat ole asiakkaita, samoin kuin sivun omassa summassa. */
  const adminEmails = new Set(parseAdminEmails(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()))
  const { data: roolirivit } = await db.from("user_roles").select("user_id,role")
  const roolit = new Map((roolirivit ?? []).map((r: any) => [r.user_id, r.role]))

  const asiakkaat = kaikki.filter((u) => {
    const e = String(u.email ?? "").toLowerCase()
    if (!e) return false
    if (adminEmails.has(e)) return false
    const r = roolit.get(u.id)
    return r !== "seller" && r !== "admin"
  })

  console.log(`tunnuksia ${kaikki.length}, asiakastunnuksia ${asiakkaat.length}\n`)

  const ryhmat = new Map<string, string[]>()
  for (const u of asiakkaat) {
    const d = domain(String(u.email))
    if (!ryhmat.has(d)) ryhmat.set(d, [])
    ryhmat.get(d)!.push(String(u.email).toLowerCase())
  }

  const yritysDomainit = [...ryhmat].filter(([d]) => !VAPAAT.has(d))
  const vapaaDomainit = [...ryhmat].filter(([d]) => VAPAAT.has(d))

  console.log(`domaineja yhteensa ${ryhmat.size}`)
  console.log(`  yritysdomaineja  ${yritysDomainit.length}  (${yritysDomainit.reduce((n, [, u]) => n + u.length, 0)} tunnusta)`)
  console.log(`  vapaita          ${vapaaDomainit.length}  (${vapaaDomainit.reduce((n, [, u]) => n + u.length, 0)} tunnusta)`)

  const monenKayttajan = yritysDomainit.filter(([, u]) => u.length > 1).sort((a, b) => b[1].length - a[1].length)
  console.log(`\n=== YRITYKSET JOILLA ON USEITA TUNNUKSIA: ${monenKayttajan.length} ===`)
  console.log("(naissa per-tunnus-hinta laskisi MRR:n moninkertaisena)\n")
  for (const [d, kayttajat] of monenKayttajan) {
    console.log(`  ${String(kayttajat.length).padStart(2)} kpl  ${d}`)
    for (const e of kayttajat) console.log(`          ${e}`)
  }

  console.log(`\n=== VAPAAN SAHKOPOSTIN TUNNUKSET: ${vapaaDomainit.reduce((n, [, u]) => n + u.length, 0)} ===`)
  console.log("(naita EI voi tunnistaa domainilla - merkittava sahkopostilla)\n")
  for (const [d, kayttajat] of vapaaDomainit.sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(kayttajat.length).padStart(2)} kpl  ${d}`)
  }

  const yksin = yritysDomainit.filter(([, u]) => u.length === 1).length
  console.log(`\nyhden tunnuksen yritysdomaineja ${yksin}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
