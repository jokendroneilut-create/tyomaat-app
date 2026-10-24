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
 * KUKA SAA KOKEILUMUISTUTUKSEN JA MILLOIN (D-340).
 *
 * Ajaa OIKEAA valintafunktiota (`valitseMuistutettavat`) eika omaa
 * kopiota saannosta, ja simuloi sillä 45 vrk eteenpain: nain naen
 * paivakohtaisen maaran ennen kuin yksikaan viesti lahtee
 * ([[dry-run-before-backfill]], [[verify-findings-against-source]]).
 *
 * Lokitaulua ei tarvita: simulaatio pitaa itse kirjaa lahetetyista.
 *
 *   npx tsx scripts/esikatsele-kokeilumuistutukset.ts
 *   npx tsx scripts/esikatsele-kokeilumuistutukset.ts --paivat 45
 */

import { isAccountLocked } from "../lib/auth/isAccountLocked"
import { asiakkaanTunniste } from "../lib/users/asiakastunniste"
import { parseAdminEmails, resolveRole } from "../lib/auth/roles"
import {
  valitseMuistutettavat,
  muistutuksenOtsikko,
  ALOITUSPAIVA,
  type MuistutusEhdokas,
} from "../lib/users/trialMuistutukset"

async function main() {
  const i = process.argv.indexOf("--paivat")
  const paivia = i > 0 ? Number(process.argv[i + 1]) : 45

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kayttajat: any[] = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    kayttajat.push(...(data?.users ?? []))
    if ((data?.users ?? []).length < 200) break
  }

  const { data: laskutusrivit } = await db.from("customer_billing").select("tunniste,tila")
  const tilat = new Map(
    (laskutusrivit ?? []).map((r: any) => [String(r.tunniste).toLowerCase(), r.tila])
  )
  const { data: yritysrivit } = await db.from("user_company").select("user_id,yritys")
  const yritykset = new Map((yritysrivit ?? []).map((r: any) => [r.user_id, r.yritys]))
  const { data: profiilit } = await db.from("profiles").select("id,first_name")
  const etunimet = new Map((profiilit ?? []).map((r: any) => [r.id, r.first_name]))
  const { data: roolirivit } = await db.from("user_roles").select("user_id,role")
  const kantaroolit = new Map((roolirivit ?? []).map((r: any) => [r.user_id, r.role]))
  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)

  const pohja: MuistutusEhdokas[] = kayttajat.map((u) => ({
    userId: u.id,
    email: u.email ?? null,
    createdAt: u.created_at ?? null,
    etunimi: etunimet.get(u.id) ?? null,
    tila: tilat.get(asiakkaanTunniste(u.email, yritykset.get(u.id))) ?? null,
    lukittu: isAccountLocked(u),
    rooli: resolveRole({ email: u.email, dbRole: kantaroolit.get(u.id) ?? null, adminEmails }),
    kasitellyt: [],
  }))

  const kasitellyt = new Map<string, number[]>()
  const alku = new Date(`${ALOITUSPAIVA}T09:00:00Z`).getTime()

  console.log(`=== ${kayttajat.length} tunnusta, simulaatio ${paivia} vrk alkaen ${ALOITUSPAIVA} ===\n`)

  let yhteensa = 0
  let ohitettuja = 0

  for (let d = 0; d <= paivia; d++) {
    const nyt = alku + d * 86400000
    const ehdokkaat = pohja.map((e) => ({ ...e, kasitellyt: kasitellyt.get(e.userId) ?? [] }))
    const valitut = valitseMuistutettavat(ehdokkaat, nyt)
    if (!valitut.length) continue

    const pvm = new Date(nyt).toISOString().slice(0, 10)
    console.log(`${pvm} (+${String(d).padStart(2)} vrk): ${valitut.length} viestiä`)
    for (const m of valitut) {
      console.log(
        `   ${String(m.email).padEnd(38)} ${String(m.virstanpylvas).padStart(2)} pv -> "${muistutuksenOtsikko(m.paiviaJaljella)}"` +
          (m.vanhentuneet.length ? `  (ohitetaan ${m.vanhentuneet.join(", ")})` : "")
      )
      const lista = kasitellyt.get(m.userId) ?? []
      lista.push(m.virstanpylvas, ...m.vanhentuneet)
      kasitellyt.set(m.userId, lista)
      ohitettuja += m.vanhentuneet.length
    }
    yhteensa += valitut.length
  }

  console.log(`\nYhteensä ${yhteensa} viestiä ${paivia} vrk aikana, ohitettuja rajapyykkejä ${ohitettuja}`)
  console.log("Simulaatio ei lähetä mitään eikä kirjoita lokiin.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
