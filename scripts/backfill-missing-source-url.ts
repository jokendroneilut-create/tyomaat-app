/*
 * Täydentää puuttuvan lähdelinkin `source_documents`-taulusta.
 *
 * Ehdokkaalla on `source_document_id`, ja asiakirjalla on `document_url` -
 * linkki on siis ollut tallessa koko ajan, se ei vain kulkenut ehdokkaalle.
 * Koski 1 865 riviä, joista yksikään ei ollut katselmointijonossa: vika
 * näkyi vain jo hyväksyttyjen hankkeiden "avaa lähde" -painikkeessa.
 *
 * SOKEA KOPIOINTI OLISI VÄÄRIN. Tallennettu osoite ei ole todiste siitä
 * että linkki toimii - juuri se oletus piilotti Hilman rikkinäisen
 * osoitteen (D-046). Otos jokaisesta lähteestä ajettiin läpi, ja neljä
 * lähdettä hylättiin:
 *
 *   Tampere (129)  osa 404
 *   Pori (25)      osa 404 - osoitteessa myös purkamaton &auml;
 *   Kuopio (56)    vain 700 tavun SPA-kuori, ei sisältöä
 *   Kerava (35)    500
 *
 * Lisäksi ohitetaan API-päätepisteet (93 riviä, valtaosa Helsingin WFS):
 * ne palauttavat XML:ää eivätkä ole ihmiselle avattavia sivuja.
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-missing-source-url.ts
 *   npx tsx scripts/backfill-missing-source-url.ts --apply
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

/* Lähteet joiden tallennetut osoitteet eivät toimi. Mitattu otoksella. */
const BROKEN_SOURCES = new Set([
  "Tampereen kaupunkisuunnittelu",
  "Porin kaupunkisuunnittelu",
  "Kuopion kaupunkisuunnittelu",
  "Keravan kaupunkisuunnittelu",
])

/* Rajapintaosoite, ei ihmiselle avattava sivu. */
const API_ENDPOINT = /service=WFS|\/geoserver\/|\/wfs\?|outputFormat=|\/api\/|\.json(\?|$)|format=json/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs = new Map<string, string>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id, document_url")
      .range(from, from + 999)
    if (error) throw error
    for (const doc of data ?? []) {
      if (doc.document_url) docs.set(doc.id, doc.document_url)
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

  const stats = { lisatty: 0, rikkinainen: 0, api: 0, eiAsiakirjaa: 0, epaonnistui: 0 }
  const perSource: Record<string, number> = {}

  for (const row of rows) {
    const md = row.metadata ?? {}
    if (md.source_url) continue

    const url = docs.get(md.source_document_id)
    if (!url) {
      stats.eiAsiakirjaa++
      continue
    }

    const source = md.source ?? md.source_name ?? "(ei lähdettä)"
    if (BROKEN_SOURCES.has(source)) {
      stats.rikkinainen++
      continue
    }
    if (API_ENDPOINT.test(url)) {
      stats.api++
      continue
    }

    stats.lisatty++
    perSource[source] = (perSource[source] ?? 0) + 1

    if (!APPLY) continue

    const { error } = await supabase
      .from("potential_projects")
      .update({ metadata: { ...md, source_url: url } })
      .eq("id", row.id)

    if (error) {
      stats.epaonnistui++
      console.log(`  VIRHE ${row.id}: ${error.message}`)
    }
  }

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`
  )
  console.log(`linkki lisätty:            ${stats.lisatty}`)
  console.log(`ohitettu, rikkinäinen lähde: ${stats.rikkinainen}`)
  console.log(`ohitettu, API-päätepiste:    ${stats.api}`)
  console.log(`asiakirjaa ei ole:           ${stats.eiAsiakirjaa}`)
  console.log(`epäonnistui:                 ${stats.epaonnistui}`)
  console.log("\nlähteittäin:")
  for (const [k, v] of Object.entries(perSource).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${k.slice(0, 36).padEnd(38)} ${v}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
