/*
 * diag-rls.mjs — tarkistaa, mitkä public-taulut ovat luettavissa anon-avaimella
 * (= kuka tahansa ilman kirjautumista). Vertaa anon-rivimäärää service-rolen
 * (ohittaa RLS:n) määrään: jos anon näkee saman kuin service, taulu on ALTIS.
 *
 * Aja projektin juuresta:  node scripts/diag-rls.mjs
 * Exit-koodi 1 jos yksikin taulu on altis. Vain lukua (SELECT), ei muutoksia.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
try {
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').replace(/\r/g, '').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!(m[1] in process.env)) process.env[m[1]] = v
  }
} catch {
  console.error('.env.local ei löytynyt projektin juuresta.')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const svc = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Sovelluksen käyttämät public-taulut. Päivitä listaa jos uusia tulee.
const tables = [
  'agent_jobs', 'agent_runs', 'agent_sources', 'analytics_events', 'broadcast_message_log',
  'candidate_projects', 'discovery_pipeline_runs', 'discovery_runs', 'discovery_sources',
  'feedback_messages', 'llm_relevance_log', 'opportunity_alerts', 'opportunity_scores',
  'potential_projects', 'profiles', 'project_assignments', 'project_changes',
  'project_duplicate_candidates', 'project_facts', 'project_feedback', 'project_identifiers',
  'project_import_events', 'project_imports', 'project_phase_history', 'project_signals',
  'project_sources', 'projects', 'saved_searches', 'source_documents', 'team_members',
  'teams', 'user_project_favorites', 'user_project_status', 'user_tasks', 'user_today_preferences',
]

const cnt = async (c, t) => {
  const { count, error } = await c.from(t).select('*', { count: 'exact', head: true })
  return error ? { err: error.message } : { count: count ?? 0 }
}

const exposed = []
const rows = []
for (const t of tables) {
  const a = await cnt(anon, t)
  const s = await cnt(svc, t)
  let verdict
  if (a.err) {
    verdict = /permission|not find/.test(a.err) ? 'suojattu' : `virhe: ${a.err}`
  } else if (typeof s.count === 'number' && s.count > 0 && a.count >= s.count) {
    verdict = '⚠️  ALTIS'
    exposed.push(t)
  } else if (a.count > 0) {
    verdict = '⚠️  ALTIS'
    exposed.push(t)
  } else {
    verdict = s.count > 0 ? 'suojattu' : 'tyhjä'
  }
  rows.push({ t, a: a.err ? 'ERR' : a.count, s: s.err ? 'ERR' : s.count, verdict })
}

const pad = (v, n) => String(v).padEnd(n)
console.log(pad('taulu', 30), pad('anon', 8), pad('service', 8), 'tulos')
console.log('-'.repeat(70))
for (const r of rows) console.log(pad(r.t, 30), pad(r.a, 8), pad(r.s, 8), r.verdict)

if (exposed.length) {
  console.log(`\n\x1b[31mALTIS anon-avaimelle: ${exposed.join(', ')}\x1b[0m`)
  process.exitCode = 1
} else {
  console.log('\n\x1b[32mEi yhtään taulua auki anon-avaimelle.\x1b[0m')
}
