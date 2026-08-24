/*
 * Pitää account_lifecycle-lokin ajan tasalla (käsiajo).
 *
 * LOGIIKKA ON MODUULISSA lib/users/accountLifecycleSync.ts, jota myös
 * ajastettu reitti /api/admin/sync-account-lifecycle käyttää. Kaksi
 * toteutusta erkaantuisi ajan myötä, ja poikkeama näkyisi vasta silloin
 * kun historiaa tarvitaan — eli liian myöhään.
 *
 * MIKSI TAYDENNYS EIKA TRIGGERI. Tilejä syntyy useaa reittiä: kutsu
 * sovelluksesta, Supabasen hallintapaneeli, mahdollinen tuleva
 * itserekisteröinti. Jokaisen polun kiinniottaminen erikseen tarkoittaa
 * että unohdettu polku jää hiljaa kirjaamatta. Täsmäytys auth.usersia
 * vasten kattaa ne kaikki, myös menneet, ja sen voi ajaa uudelleen.
 *
 * Triggeriä auth.users-tauluun ei tehdä: se on Supabasen oma skeema, ja
 * rikkinäinen triggeri siellä estäisi kirjautumisen.
 *
 * KAKSI SUUNTAA:
 *   1. auth.usersissa mutta ei lokissa  -> kirjataan "created"
 *   2. lokissa mutta ei enää auth.usersissa -> kirjataan "deleted"
 *
 * Aja ensin ilman lippua:
 *   npx tsx scripts/sync-account-lifecycle.ts
 *   npx tsx scripts/sync-account-lifecycle.ts --apply
 *
 * HUOM: ajastettu reitti hoitaa tämän nyt vuorokausittain. Käsiajo on
 * jäljellä tarkistusta ja poikkeustilanteita varten.
 */

import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

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
  const { runLifecycleSync } = await import("../lib/users/accountLifecycleSync")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const probe = await supabase.from("account_lifecycle").select("id").limit(1)
  if (probe.error) {
    console.log("Taulua account_lifecycle ei ole viela.")
    console.log("Aja ensin docs/sql/2026-08-15_account_lifecycle.sql Supabasen SQL-editorissa.")
    console.log(`(${probe.error.message})`)
    process.exit(1)
  }

  const t = await runLifecycleSync(supabase, { apply: APPLY })

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}`)
  console.log(`auth-tileja ${t.authCount}, lokissa ${t.knownUsers} tilia\n`)
  console.log(`kirjataan "created": ${t.created.length}`)
  console.log(`kirjataan "deleted" (havaittu kadonneeksi): ${t.deleted.length}`)
  for (const r of t.deleted) console.log(`  ${r.user_id}`)

  if (t.errors.length) {
    for (const e of t.errors) console.log(`  VIRHE ${e}`)
    process.exit(1)
  }

  console.log(APPLY ? "\nvalmis" : "")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
