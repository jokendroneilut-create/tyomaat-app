import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAAVASELOSTUKSEN KUVAUS JO TUODUILLE RIVEILLE (D-217).
 *
 * Kerays hakee kuvauksen nyt selostuksesta, mutta jo tuodut ehdokkaat ja
 * hankkeet jaivat kuulutuksen tekstiin ("nahtavilla 25.9.-2.11.2026
 * palvelupisteiden asiakaspaatteilla"). Dokumenttirivilla on jo uusi
 * teksti, joten tama ei hae mitaan verkosta.
 *
 * KUVAUS KORVATAAN, EI YHDISTETA. Vanha on menettelytekstia jossa ei ole
 * yhtaan hanketietoa; sailyttaminen tuottaisi sekaannusta. Muita kenttia
 * ei kosketa.
 *
 *   npx tsx scripts/fix-savonlinna-kuvaukset.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-savonlinna-kuvaukset.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const LAHDE = "savonlinna-asemakaavakuulutukset"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: docs, error } = await db
    .from("source_documents")
    .select("document_url, title, raw_payload")
    .eq("source_id", LAHDE)
  if (error) throw error

  const selostukset = (docs ?? []).filter(
    (d: any) => d.raw_payload?.description_source === "selostus" && d.raw_payload?.description
  )
  console.log(`dokumentteja ${docs?.length ?? 0}, joilla selostuskuvaus ${selostukset.length}\n`)

  let n = 0

  for (const d of selostukset as any[]) {
    const uusi = String(d.raw_payload.description)

    for (const [taulu, nimiSarake] of [
      ["potential_projects", "title"],
      ["projects", "name"],
    ] as const) {
      const { data: rivit, error: e1 } = await db
        .from(taulu)
        .select(`id, ${nimiSarake}, metadata`)
        .eq("metadata->>source_url", d.document_url)
      if (e1) throw e1

      for (const r of (rivit ?? []) as any[]) {
        const md = r.metadata ?? {}
        const vanha = String(md.description ?? "")
        if (vanha === uusi) continue

        n++
        console.log(`${taulu.padEnd(19)} ${String(r[nimiSarake]).slice(0, 44)}`)
        console.log(`   ${vanha.length} -> ${uusi.length} merkkia`)
        console.log(`   vanha: ${vanha.slice(0, 96)}`)
        console.log(`   uusi:  ${uusi.slice(0, 96)}`)

        if (!APPLY) continue

        const paivitys: Record<string, unknown> = {
          metadata: {
            ...md,
            description: uusi,
            description_source: "selostus",
            selostus_url: d.raw_payload.selostus_url ?? null,
          },
        }
        /* Hankkeen asiakasnakyma lukee additional_info-kentan. */
        if (taulu === "projects") paivitys.additional_info = uusi

        const { error: e2 } = await db.from(taulu).update(paivitys).eq("id", r.id)
        if (e2) throw e2
      }
    }
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} riviä ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
