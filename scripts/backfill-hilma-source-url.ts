/*
 * Täydentää Hilma-rivien puuttuvan lähdelinkin.
 *
 * VIKA: `source_url` puuttui KAIKILTA 320 Hilma-ehdokkaalta, joten
 * "avaa lähde" ei tehnyt mitään. Resolveri ei rakentanut osoitetta
 * lainkaan.
 *
 * Samalla paljastui että kerääjän rakentama osoite oli väärä: se käytti
 * muotoa `/fi/public/procurement/{noticeId}/notice/overview/overview`,
 * joka vie "Ilmoitusta ei löytynyt" -sivulle. Oikea muoto tarvitsee myös
 * procedureId:n - ks. lib/agent/hilmaNoticeUrl.ts.
 *
 * Tunnisteet luetaan `source_documents.raw_text`-kentän alkuperäisestä
 * ilmoituksesta, koska procedureId ei ole aiemmin päätynyt metatietoon.
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-hilma-source-url.ts
 *   npx tsx scripts/backfill-hilma-source-url.ts --apply
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
  const { hilmaNoticeUrl } = await import("../lib/agent/hilmaNoticeUrl")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Ilmoitusten tunnisteet: source_document_id -> { procedureId, noticeId } */
  const ids = new Map<string, { procedure: string | null; notice: string | null }>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id, raw_text")
      .eq("source_name", "Hilma")
      .range(from, from + 999)
    if (error) throw error
    for (const doc of data ?? []) {
      try {
        const notice = JSON.parse(doc.raw_text)
        ids.set(doc.id, {
          procedure: notice.procedureId != null ? String(notice.procedureId) : null,
          notice: notice.noticeId != null ? String(notice.noticeId) : null,
        })
      } catch {
        /* Rikkinäinen payload ohitetaan; rivi jää ilman linkkiä. */
      }
    }
    if (!data || data.length < 1000) break
  }

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, status, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = rows.filter(
    (r) => (r.metadata?.source ?? r.metadata?.source_name) === "Hilma"
  )

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${targets.length} Hilma-riviä`
  )
  console.log(`  ilmoituksia joilta tunnisteet löytyvät: ${ids.size}\n`)

  const stats = { lisatty: 0, eiTunnisteita: 0, joOli: 0, epaonnistui: 0 }

  for (const row of targets) {
    const md = row.metadata ?? {}
    if (md.source_url) {
      stats.joOli++
      continue
    }

    const known = ids.get(md.source_document_id)
    const url = hilmaNoticeUrl(
      known?.procedure ?? md.procedure_id,
      known?.notice ?? md.notice_id
    )

    if (!url) {
      stats.eiTunnisteita++
      continue
    }

    stats.lisatty++
    if (stats.lisatty <= 5) {
      console.log(`  ${String(row.title).slice(0, 60)}`)
      console.log(`   -> ${url}`)
    }

    if (!APPLY) continue

    const { error } = await supabase
      .from("potential_projects")
      .update({
        metadata: {
          ...md,
          source_url: url,
          procedure_id: known?.procedure ?? md.procedure_id ?? null,
        },
      })
      .eq("id", row.id)

    if (error) {
      stats.epaonnistui++
      console.log(`     VIRHE: ${error.message}`)
    }
  }

  console.log("")
  console.log(`linkki lisätty:      ${stats.lisatty}`)
  console.log(`tunnisteet puuttuu:  ${stats.eiTunnisteita}`)
  console.log(`linkki oli jo:       ${stats.joOli}`)
  console.log(`epäonnistui:         ${stats.epaonnistui}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
