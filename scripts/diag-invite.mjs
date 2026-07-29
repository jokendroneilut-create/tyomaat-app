/*
 * diag-invite.mjs — todistaa kutsu- ja salasananasetusketjun toimivuuden.
 *
 * Ajo projektin juuresta:
 *   node scripts/diag-invite.mjs                 # ketjutodistus, EI lähetä sähköpostia
 *   node scripts/diag-invite.mjs --send you@x.fi # tekee lisäksi AIDON kutsun (lähettää postin)
 *   node scripts/diag-invite.mjs --keep          # jätä testikäyttäjä siivoamatta (debug)
 *
 * Ketjutodistus ajaa TÄSMÄLLEEN saman koodipolun jonka oikea käyttäjä kulkee:
 *   generateLink(invite)  → sama token minkä sähköposti sisältäisi
 *   verifyOtp             → sama minkä /auth/callback tekee
 *   updateUser(password)  → sama minkä /set-password tekee
 *   signInWithPassword    → sama minkä /login tekee
 * ...mutta ilman sähköpostia ja toistettavasti. Jos tämä on vihreä, vika EI ole
 * sinun koodissasi. Jäljelle jää vain sähköpostin toimitus, jonka --send testaa.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// --- pieni .env.local -lukija (ei riippuvuutta dotenviin) ---
function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let val = m[2].trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!(m[1] in process.env)) process.env[m[1]] = val
    }
  } catch {
    fail('.env.local ei löytynyt projektin juuresta.')
    process.exit(1)
  }
}

// --- tuloste ---
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`)
const info = (m) => console.log(`  \x1b[36mi\x1b[0m ${m}`)
const head = (m) => console.log(`\n\x1b[1m${m}\x1b[0m`)
function fail(m) {
  console.log(`\x1b[31m${m}\x1b[0m`)
}

const args = process.argv.slice(2)
const sendIdx = args.indexOf('--send')
const sendTo = sendIdx >= 0 ? args[sendIdx + 1] : null
const keep = args.includes('--keep')
const linkIdx = args.indexOf('--link')
const linkFor = linkIdx >= 0 ? args[linkIdx + 1] : null

loadEnv()

// --link <email>: tulosta tuore invite-token (toisintamista/debuggausta varten),
// ei lähetä postia. Luo käyttäjän jos ei ole; token on kertakäyttöinen.
if (linkFor) {
  const admin0 = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  )
  const { data, error } = await admin0.auth.admin.generateLink({
    type: 'invite',
    email: linkFor,
    options: { redirectTo: 'https://app.tyomaat.fi/auth/callback' },
  })
  if (error) {
    fail(`generateLink: ${error.message}`)
    process.exit(1)
  }
  console.log('EMAIL=' + linkFor)
  console.log('USERID=' + data.user.id)
  console.log('TOKEN_HASH=' + data.properties.hashed_token)
  console.log('CALLBACK=https://app.tyomaat.fi/auth/callback?token_hash=' + data.properties.hashed_token + '&type=invite')
  process.exit(0)
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADMIN_EMAILS = process.env.ADMIN_EMAILS
// Kovakoodattu vastaamaan app/api/admin/invite-user/route.ts:ää — tuotanto
// lähettää AINA tämän, ei APP_BASE_URL:ää (joka on lokaalisti localhost).
const REDIRECT = 'https://app.tyomaat.fi/auth/callback'

let failures = 0
const mark = (cond, good, badMsg) => {
  if (cond) ok(good)
  else {
    bad(badMsg)
    failures++
  }
}

// ---------------------------------------------------------------------------
head('1) Ympäristömuuttujat')
mark(!!SUPABASE_URL, `NEXT_PUBLIC_SUPABASE_URL = ${SUPABASE_URL}`, 'NEXT_PUBLIC_SUPABASE_URL puuttuu')
mark(!!ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY löytyy', 'NEXT_PUBLIC_SUPABASE_ANON_KEY puuttuu')
mark(!!SERVICE_KEY, 'SUPABASE_SERVICE_ROLE_KEY löytyy', 'SUPABASE_SERVICE_ROLE_KEY puuttuu (kutsu ei toimi ilman tätä)')
mark(!!(ADMIN_EMAILS && ADMIN_EMAILS.trim()), `ADMIN_EMAILS = ${ADMIN_EMAILS}`, 'ADMIN_EMAILS on tyhjä → kukaan ei saa lähettää kutsuja')
info(`Kutsulinkki ohjaa: ${REDIRECT}`)
info('Varmista että tämä on Supabase → Authentication → URL Configuration → Redirect URLs -listalla.')

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  fail('\nPakollisia muuttujia puuttuu — ei voida jatkaa.')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ---------------------------------------------------------------------------
head('2) Ketjutodistus (ei lähetä sähköpostia)')

const testEmail = `diag+${Date.now()}@tyomaat.fi`
const testPassword = `Diag!${Math.random().toString(36).slice(2, 10)}Aa1`
let createdUserId = null

try {
  // a) generateLink = sama token minkä kutsusähköposti sisältäisi (ei lähetä postia)
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'invite',
    email: testEmail,
    options: { redirectTo: REDIRECT },
  })
  if (linkErr) throw new Error(`generateLink: ${linkErr.message}`)
  const hashedToken = linkData?.properties?.hashed_token
  createdUserId = linkData?.user?.id
  mark(!!hashedToken, 'generateLink(invite) tuotti tokenin (auth-admin toimii)', `generateLink ei palauttanut tokenia`)
  if (!hashedToken) throw new Error('ei tokenia')

  // b) verifyOtp tuoreella anon-clientilla = sama minkä /auth/callback tekee
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: verifyData, error: verifyErr } = await userClient.auth.verifyOtp({
    token_hash: hashedToken,
    type: 'invite',
  })
  mark(!verifyErr && !!verifyData?.session, 'verifyOtp loi istunnon (/auth/callback -vaihe toimii)', `verifyOtp: ${verifyErr?.message}`)
  if (verifyErr || !verifyData?.session) throw new Error('verifyOtp epäonnistui')

  // c) updateUser(password) = sama minkä /set-password tekee
  const { error: pwErr } = await userClient.auth.updateUser({ password: testPassword })
  mark(!pwErr, 'updateUser asetti salasanan (/set-password -vaihe toimii)', `updateUser: ${pwErr?.message}`)
  if (pwErr) throw new Error('updateUser epäonnistui')

  await userClient.auth.signOut()

  // d) signInWithPassword = sama minkä /login tekee
  const loginClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: loginData, error: loginErr } = await loginClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })
  mark(!loginErr && !!loginData?.session, 'signInWithPassword onnistui (/login -vaihe toimii)', `login: ${loginErr?.message}`)
} catch (e) {
  bad(`Ketju katkesi: ${e.message}`)
  failures++
} finally {
  if (createdUserId && !keep) {
    const { error: delErr } = await admin.auth.admin.deleteUser(createdUserId)
    if (delErr) info(`Huom: testikäyttäjän ${testEmail} siivous epäonnistui: ${delErr.message}`)
    else info(`Testikäyttäjä siivottu (${testEmail})`)
  } else if (createdUserId) {
    info(`Testikäyttäjä jätettiin: ${testEmail} (id ${createdUserId})`)
  }
}

// ---------------------------------------------------------------------------
head('3) Aito sähköpostin toimitus')
if (!sendTo) {
  info('Ohitettu. Aja  node scripts/diag-invite.mjs --send oma+testi@gmail.com  testataksesi oikean postin.')
  info('Vinkki: kokeile eri palveluun (esim. Gmail JA Outlook) — roskapostisuodatus vaihtelee.')
} else {
  try {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(sendTo, {
      redirectTo: REDIRECT,
    })
    if (error) {
      bad(`inviteUserByEmail(${sendTo}): ${error.message}`)
      if (/already/i.test(error.message)) {
        info('→ Osoitteella on jo tili. Poista se /dashboard/users -sivulta ja kokeile uudelleen, tai käytä tuoretta osoitetta.')
      }
      if (/rate|limit/i.test(error.message)) {
        info('→ Rate limit. Tämä on Supabasen OLETUS-SMTP:n merkki. Kytke oma SMTP (Resend) Supabasen dashboardista.')
      }
      failures++
    } else {
      ok(`Kutsu lähetetty osoitteeseen ${sendTo} (user id ${data?.user?.id})`)
      info('Avaa postilaatikko: tuliko viesti, ja veikö linkki /set-password-sivulle?')
      info('Jos EI tullut muutamassa minuutissa → sähköpostin toimitus on ongelma, ei koodi. Katso SMTP-asetukset.')
    }
  } catch (e) {
    bad(`Lähetys kaatui: ${e.message}`)
    failures++
  }
}

// ---------------------------------------------------------------------------
head('Yhteenveto')
if (failures === 0) {
  console.log('\x1b[32mKaikki tarkistukset OK.\x1b[0m Koodiketju toimii varmuudella.')
  if (!sendTo) console.log('Aja vielä --send-testi vahvistaaksesi sähköpostin toimituksen.')
} else {
  console.log(`\x1b[31m${failures} tarkistus(ta) epäonnistui.\x1b[0m Katso viestit yltä.`)
  process.exitCode = 1
}
