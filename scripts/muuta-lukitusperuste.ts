import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LUKITUKSEN PERUSTELUN MUUTTAMINEN (D-364).
 *
 * Johannes 30.10.2026: *"pystytko muuttamaan tekstin ... Ei ole
 * editointinappulaa"*. Lukitus kysyy perustelun kerran eika sita voi
 * jalkeenpain muuttaa kayttoliittymasta.
 *
 * TEKSTI ON KAHDESSA PAIKASSA, ja vain toinen nakyy:
 *
 *   auth.users.app_metadata.locked_reason   <- tama nakyy kayttajalistalla
 *   account_lifecycle.metadata.reason        <- pysyva paivakirja
 *
 * Nayttoteksti korvataan, mutta paivakirjaan EI kirjoiteta uuden tekstin
 * yli: alkuperainen sanamuoto jaa talteen `reason_alkuperainen`-kenttaan
 * ja korjaus merkitaan paivayksineen. Paivakirja kertoo mita tapahtui,
 * ei mita jalkeenpain haluttiin sanoa ([[account-lifecycle-log]]).
 *
 *   npx tsx scripts/muuta-lukitusperuste.ts <sahkoposti> "<uusi teksti>"
 *   npx tsx scripts/muuta-lukitusperuste.ts <sahkoposti> "<uusi teksti>" --apply
 */
const APPLY = process.argv.includes("--apply")
const SPOSTI = process.argv[2]
const UUSI = process.argv[3]

async function main() {
  if (!SPOSTI || !UUSI || SPOSTI.startsWith("--") || UUSI.startsWith("--")) {
    console.log('Kaytto: npx tsx scripts/muuta-lukitusperuste.ts <sahkoposti> "<uusi teksti>" [--apply]')
    process.exit(1)
  }

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* Kayttaja haetaan sivuttaen: listUsers palauttaa sivun kerrallaan. */
  let kayttaja: any = null
  for (let sivu = 1; sivu <= 20 && !kayttaja; sivu++) {
    const { data, error } = await db.auth.admin.listUsers({ page: sivu, perPage: 200 })
    if (error) throw error
    kayttaja = (data.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === SPOSTI.toLowerCase())
    if ((data.users ?? []).length < 200) break
  }
  if (!kayttaja) {
    console.log(`Kayttajaa ${SPOSTI} ei loydy.`)
    return
  }

  const am = kayttaja.app_metadata ?? {}
  console.log(`Kayttaja ${kayttaja.email}  (${kayttaja.id})`)
  console.log(`  lukittu: ${am.locked === true}`)
  console.log(`  lukittu klo: ${am.locked_at ?? "-"}`)
  console.log(`  NYKYINEN perustelu: ${JSON.stringify(am.locked_reason ?? null)}`)
  console.log(`  UUSI perustelu:     ${JSON.stringify(UUSI)}`)

  if (am.locked !== true) {
    console.log("\nTunnus ei ole lukittu – perustelua ei muuteta.")
    return
  }

  const { data: rivit } = await db
    .from("account_lifecycle")
    .select("id,metadata,occurred_at")
    .eq("user_id", kayttaja.id)
    .eq("event", "locked")
  const rivi: any = (rivit ?? [])[0]
  console.log(`\n  paivakirjarivi: ${rivi ? rivi.id : "ei loydy"}`)
  if (rivi) console.log(`    nyt: ${JSON.stringify(rivi.metadata)}`)

  if (!APPLY) {
    console.log("\nKuivaharjoitus, ei kirjoitettu. Aja --apply kun teksti on luettu.")
    return
  }

  const { error: e1 } = await db.auth.admin.updateUserById(kayttaja.id, {
    app_metadata: { ...am, locked_reason: UUSI },
  })
  if (e1) throw e1

  if (rivi) {
    const md = { ...(rivi.metadata ?? {}) }
    /* Alkuperainen sanamuoto talteen vain kerran. */
    if (!md.reason_alkuperainen) md.reason_alkuperainen = md.reason ?? null
    md.reason = UUSI
    md.perustelu_korjattu = new Date().toISOString().slice(0, 10)
    const { error: e2 } = await db.from("account_lifecycle").update({ metadata: md }).eq("id", rivi.id)
    if (e2) throw e2
  }

  console.log("\n=== AJETTU ===")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
