/*
 * Poistaa toimimattomat lähdelinkit.
 *
 * Vaatimus: yksikään näkyvä linkki ei saa olla rikki. Kuollut linkki on
 * huonompi kuin puuttuva - se näyttää toimivalta ja vie käyttäjän
 * virhesivulle. Sama periaate kuin `hilmaNoticeUrl` palauttaa mieluummin
 * null kuin osoitteen joka ohjaa etusivulle (D-046).
 *
 * KAKSI TARKISTUSTA. Ensimmäinen ajo (scripts/_verify) käy kaikki osoitteet
 * läpi rinnakkain, mikä altistaa hetkellisille katkoksille ja
 * nopeusrajoituksille. Tässä jokainen epäonnistunut osoite tarkistetaan
 * vielä kerran yksitellen ja pidemmällä aikakatkaisulla; vain kahdesti
 * kaatuneet tyhjennetään.
 *
 * Lukee syötteen tiedostosta _linkit.json (verify-ajon tuloste).
 *
 *   npx tsx scripts/prune-dead-source-urls.ts
 *   npx tsx scripts/prune-dead-source-urls.ts --apply
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

async function check(url: string): Promise<{ ok: boolean; status: number; note: string }> {
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 45000)
    const res = await fetch(url, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        accept: "text/html,*/*",
        "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
      },
    })
    clearTimeout(timer)
    const body = await res.arrayBuffer()
    return { ok: res.status < 400, status: res.status, note: `${body.byteLength} B` }
  } catch (err: any) {
    return { ok: false, status: 0, note: err?.name === "AbortError" ? "timeout" : String(err?.message ?? err).slice(0, 50) }
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const first: any[] = JSON.parse(readFileSync("./_linkit.json", "utf8"))
  const suspect = first.filter((t) => t.virhe || t.status >= 400 || t.status === 0)

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`
  )
  console.log(`ensimmäisessä tarkistuksessa kaatui: ${suspect.length} / ${first.length}`)
  console.log("tarkistetaan uudelleen yksitellen...\n")

  const dead: string[] = []
  const recovered: string[] = []

  for (const item of suspect) {
    const again = await check(item.u)
    if (again.ok) recovered.push(item.u)
    else dead.push(item.u)
  }

  console.log(`toipui toisella yrityksellä: ${recovered.length}`)
  console.log(`kuollut molemmilla:          ${dead.length}\n`)

  const deadSet = new Set(dead)
  const perSource: Record<string, number> = {}
  let cleared = 0

  for (const table of ["potential_projects", "projects"] as const) {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from(table)
        .select("id, metadata")
        .range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    for (const row of rows) {
      const md = row.metadata ?? {}
      if (!md.source_url || !deadSet.has(md.source_url)) continue

      const source = md.source ?? md.source_name ?? "(ei lähdettä)"
      perSource[`${table}: ${source}`] = (perSource[`${table}: ${source}`] ?? 0) + 1
      cleared++

      if (!APPLY) continue

      /*
       * Osoite säilytetään metatiedossa omassa kentässään, jotta se ei
       * katoa kokonaan: lähde voi palata, ja tieto siitä mistä rivi tuli
       * on jäljitettävyyttä.
       */
      const { error } = await supabase
        .from(table)
        .update({
          metadata: { ...md, source_url: null, dead_source_url: md.source_url },
        })
        .eq("id", row.id)

      if (error) console.log(`  VIRHE ${table}/${row.id}: ${error.message}`)
    }
  }

  console.log(`tyhjennettäviä rivejä: ${cleared}\n`)
  for (const [k, v] of Object.entries(perSource).sort((a, b) => b[1] - a[1]).slice(0, 16)) {
    console.log(`  ${k.slice(0, 46).padEnd(48)} ${v}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
