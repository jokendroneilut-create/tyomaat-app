/*
 * diag-analytics-vs-signin.mjs — vertaa analytiikan "Käyttäjät"-lukua
 * käyttäjäsivun "Viimeksi kirjautunut" -sarakkeeseen.
 *
 * Kysymys jota varten tämä on kirjoitettu (20.9.2026): analytiikka
 * näytti päivälle kolme käyttäjää, vaikka käyttäjäsivun mukaan kukaan
 * muu kuin admin ei ollut kirjautunut sinä päivänä.
 *
 * Aja projektin juuresta:  node scripts/diag-analytics-vs-signin.mjs [YYYY-MM-DD]
 * Vain lukua (SELECT), ei muutoksia. Sähköpostit tulostetaan peitettyinä,
 * koska repo on julkinen.
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/* Worktreessä .env.local on päähakemistossa, ei puussa. */
const envCandidates = [
  join(ROOT, '.env.local'),
  join(ROOT, '..', '..', '..', '..', '.env.local'),
]
const envPath = envCandidates.find((p) => existsSync(p))
if (!envPath) {
  console.error('.env.local ei löytynyt: ' + envCandidates.join(' | '))
  process.exit(1)
}
for (const line of readFileSync(envPath, 'utf8').replace(/\r/g, '').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const PAIVA = process.argv[2] || new Date().toISOString().slice(0, 10)

const svc = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

/* Peitetty sähköposti: ensimmäinen kirjain + domain. */
const peita = (e) => {
  if (!e) return '(ei sähköpostia)'
  const [nimi, domain] = String(e).split('@')
  return `${nimi.slice(0, 1)}***@${domain ?? '?'}`
}

async function main() {
  console.log(`=== Päivä ${PAIVA} (UTC) ===\n`)

  /* 1. Tapahtumat kyseiseltä päivältä. */
  const tapahtumat = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await svc
      .from('analytics_events')
      .select('user_id,event_type,path,duration_seconds,created_at')
      .gte('created_at', `${PAIVA}T00:00:00Z`)
      .lt('created_at', `${PAIVA}T23:59:59.999Z`)
      .order('created_at', { ascending: true })
      .range(alku, alku + 999)
    if (error) throw error
    tapahtumat.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(`analytics_events-rivejä: ${tapahtumat.length}`)

  const perUser = new Map()
  for (const t of tapahtumat) {
    const k = t.user_id ?? '(null)'
    const r = perUser.get(k) ?? { yht: 0, tyypit: {}, eka: null, vika: null }
    r.yht++
    r.tyypit[t.event_type ?? '(null)'] = (r.tyypit[t.event_type ?? '(null)'] ?? 0) + 1
    if (!r.eka) r.eka = t.created_at
    r.vika = t.created_at
    perUser.set(k, r)
  }

  /* 2. auth.users: sähköposti, last_sign_in_at. */
  const kaikki = []
  for (let page = 1; ; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw error
    kaikki.push(...(data.users ?? []))
    if ((data.users ?? []).length < 100) break
  }
  const users = new Map(kaikki.map((u) => [u.id, u]))
  console.log(`auth.users yhteensä: ${kaikki.length}`)

  /* 3. Roolit ja ympäristömuuttujan adminit — sama suodatus kuin reitillä. */
  const { data: roolit } = await svc.from('user_roles').select('user_id,role')
  const rooli = new Map((roolit ?? []).map((r) => [r.user_id, r.role]))
  /* Sama pari kuin lib/analytics/omaKaytto.ts (D-204). */
  const adminEmails = [...new Set(
    `${process.env.ADMIN_EMAILS || ''},${process.env.ANALYTICS_EXCLUDE_EMAILS || ''}`
      .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  )]
  console.log(`Oma käyttö (ADMIN_EMAILS + ANALYTICS_EXCLUDE_EMAILS): ${adminEmails.map(peita).join(', ') || '(tyhjä)'}`)
  console.log(`user_roles role=admin -rivejä: ${(roolit ?? []).filter((r) => r.role === 'admin').length}`)

  const adminIds = new Set((roolit ?? []).filter((r) => r.role === 'admin').map((r) => r.user_id))
  for (const u of kaikki) {
    if (u.email && adminEmails.includes(u.email.toLowerCase())) adminIds.add(u.id)
  }

  console.log(`\n--- Tapahtumia tuottaneet tunnukset ${PAIVA} ---`)
  const rivit = [...perUser.entries()].sort((a, b) => b[1].yht - a[1].yht)
  for (const [uid, r] of rivit) {
    const u = users.get(uid)
    const lsi = u?.last_sign_in_at ?? null
    console.log(
      [
        peita(u?.email),
        `id=${String(uid).slice(0, 8)}`,
        `tapahtumia=${r.yht}`,
        `tyypit=${JSON.stringify(r.tyypit)}`,
        `eka=${String(r.eka).slice(11, 19)}`,
        `vika=${String(r.vika).slice(11, 19)}`,
        `last_sign_in_at=${lsi ?? '(ei koskaan)'}`,
        `kirjautuiTänään=${lsi && lsi.slice(0, 10) === PAIVA ? 'KYLLÄ' : 'ei'}`,
        `user_roles=${rooli.get(uid) ?? '-'}`,
        `adminSuodatus=${adminIds.has(uid) ? 'SUODATETTU POIS' : 'LASKETAAN MUKAAN'}`,
      ].join('  ')
    )
  }

  const laskettu = rivit.filter(([uid]) => uid !== '(null)' && !adminIds.has(uid))
  console.log(`\nAnalytiikan "Käyttäjät" tälle päivälle = ${laskettu.length}`)
  console.log(`Näistä kirjautui samana päivänä (last_sign_in_at): ${
    laskettu.filter(([uid]) => (users.get(uid)?.last_sign_in_at ?? '').slice(0, 10) === PAIVA).length
  }`)

  /* 4. Kaikki tunnukset joiden last_sign_in_at osuu tälle päivälle. */
  console.log(`\n--- auth.users: last_sign_in_at = ${PAIVA} ---`)
  const kirjautuneet = kaikki.filter((u) => (u.last_sign_in_at ?? '').slice(0, 10) === PAIVA)
  if (!kirjautuneet.length) console.log('(ei yhtään)')
  for (const u of kirjautuneet) {
    console.log(`${peita(u.email)}  id=${u.id.slice(0, 8)}  last_sign_in_at=${u.last_sign_in_at}  user_roles=${rooli.get(u.id) ?? '-'}  admin=${adminIds.has(u.id)}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
