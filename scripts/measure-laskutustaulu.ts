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
 * LASKUTUSTAULUN TARKISTUS AJON JALKEEN (D-223).
 *
 * Tekee saman ketjun kuin `/api/admin/list-users` + sivun yhteenveto,
 * jotta DDL:n jalkeinen tila nahdaan ilman kirjautumista. Lisaksi
 * tarkistaa ettei anon-avain paase tauluun: hinnat ovat
 * liiketoimintatietoa, ja 30.7.2026 loytyi 16 taulua jotka olivat auki
 * anon-avaimelle.
 *
 *   npx tsx scripts/measure-laskutustaulu.ts
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseAdminEmails } = await import("../lib/auth/roles")
  const { asiakkaanTunniste } = await import("../lib/users/asiakastunniste")
  const { laskeLaskutus, muotoileEuro } = await import("../lib/users/laskutus")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  /* 1. Taulun sisalto. */
  const { data: rivit, error } = await db
    .from("customer_billing")
    .select("tunniste,tila,kuukausihinta_eur,alkaen,huomio,updated_at")
    .order("tunniste")
  if (error) throw new Error(`customer_billing ei luettavissa: ${error.message}`)

  console.log(`=== customer_billing: ${rivit?.length ?? 0} rivia ===`)
  for (const r of rivit ?? []) {
    console.log(
      `  ${String(r.tunniste).padEnd(28)} ${String(r.tila).padEnd(11)} ${
        r.kuukausihinta_eur === null ? "-" : `${r.kuukausihinta_eur} EUR/kk`
      }`
    )
  }

  /* 2. Liitos tunnuksiin, sama kuin list-users tekee. */
  const kaikki: any[] = []
  for (let page = 1; ; page++) {
    const { data, error: virhe } = await db.auth.admin.listUsers({ page, perPage: 100 })
    if (virhe) throw virhe
    kaikki.push(...(data.users ?? []))
    if ((data.users ?? []).length < 100) break
  }

  const adminEmails = new Set(parseAdminEmails(process.env.ADMIN_EMAILS).map((e) => e.toLowerCase()))
  const { data: roolirivit } = await db.from("user_roles").select("user_id,role")
  const roolit = new Map((roolirivit ?? []).map((r: any) => [r.user_id, r.role]))

  const kayttajat = kaikki.map((u) => ({
    email: u.email ?? null,
    role: adminEmails.has(String(u.email ?? "").toLowerCase())
      ? "admin"
      : (roolit.get(u.id) ?? "user"),
  }))

  const osumat = kayttajat.filter((u) =>
    (rivit ?? []).some((r: any) => String(r.tunniste).toLowerCase() === asiakkaanTunniste(u.email))
  )
  console.log(`\nliitos osuu ${osumat.length} tunnukseen`)

  /* 3. Yhteenveto, sama laskenta kuin sivun kortit. */
  const y = laskeLaskutus(kayttajat, (rivit ?? []) as any)
  console.log("\n=== KORTIT ===")
  console.log(`  Kuukausilaskutus (MRR)  ${muotoileEuro(y.mrr)}`)
  console.log(`  Vuodessa (ARR)          ${muotoileEuro(y.arr)}`)
  console.log(`  Maksavia asiakkaita     ${y.maksaviaAsiakkaita}  (${y.maksaviaTunnuksia} tunnusta · ${y.asiakkaitaYhteensa} asiakasta yhteensa)`)
  console.log(`  Testitunnuksia          ${y.testitunnuksia}`)
  console.log(`  Maksava ilman hintaa    ${y.ilmanHintaa}`)

  /* 4. RLS: anon-avain ei saa paasta tauluun. */
  const anonAvain = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  console.log("\n=== RLS ===")
  if (!anonAvain) {
    console.log("  anon-avainta ei ole ymparistossa - tarkistus ohitettu")
    return
  }
  const anon = createClient(url, anonAvain, { auth: { persistSession: false } })
  const { data: anonData, error: anonVirhe } = await anon.from("customer_billing").select("tunniste").limit(1)

  if (anonVirhe) console.log(`  anon TORJUTTU: ${anonVirhe.message}`)
  else if ((anonData ?? []).length === 0) console.log("  anon sai tyhjan tuloksen (RLS estaa rivit)")
  else console.log(`  *** ANON NAKEE ${anonData!.length} RIVIA - TAULU ON AUKI ***`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
