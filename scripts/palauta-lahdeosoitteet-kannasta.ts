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
 * LAHDEOSOITE KANNASTA, EI VERKOSTA (D-383).
 *
 * Verkkohaku 251 lahteettomalle hankkeelle loysi osoitteen 179:lle,
 * mutta tuotosta lukiessa paljastui ettei osa niista ole hankkeen
 * lahteita vaan **kaapijasivuja**: `app.cobrief.com` 8 kertaa,
 * `fi.openprocurements.com` 3, `b2b.profinder.fi` 3. Ne
 * uudelleenjulkaisevat Hilman hankintailmoituksia
 * ([[rakennuslehti-is-secondary]]).
 *
 * JA ALKUPERAINEN OSOITE ON JO KANNASSA. Sama hanke, jolle haku tarjosi
 * cobriefia, viittaa `metadata.potential_project_id`illa jonoriviin
 * jonka `source_url` on hankintailmoitukset.fi
 * ([[own-data-unread]]).
 *
 * KAKSI REITTIA, molemmat ilmaisia:
 *
 *   `metadata.source_document_id`  -> `source_documents.document_url`
 *   `metadata.potential_project_id` -> jonorivin `metadata.source_url`
 *
 * Mitattu 7.11.2026: 251 lahteettomasta **26 ratkeaa nain**, ja osoite
 * on alkuperaisen julkaisijan eika kaapijan.
 *
 * TAMA AJETAAN ENNEN VERKKOHAKUA. Verkosta haetaan vain se mita kanta
 * ei anna.
 *
 *   npx tsx scripts/palauta-lahdeosoitteet-kannasta.ts
 *   npx tsx scripts/palauta-lahdeosoitteet-kannasta.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const TUNNISTE = "lahde_kannasta_2026_11"

/* Sama suodatin kuin muualla: listaus- ja yhteystietosivu ei ole lahde. */
const OMA_SIVU = /(^|\.)tyomaat\.fi$/i
const EI_HANKESIVU = /\/(yhteystiedot|contact|contacts|ListItems|kaupunki-rakentaa)\/?$/i

function kelpaa(url: unknown): string | null {
  const teksti = String(url ?? "")
  if (!/^https?:\/\//.test(teksti)) return null
  try {
    const osoite = new URL(teksti)
    if (OMA_SIVU.test(osoite.hostname)) return null
    if (EI_HANKESIVU.test(osoite.pathname)) return null
  } catch {
    return null
  }
  return teksti
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,is_public,status,metadata")
      .range(a, a + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const onLahde = (h: any) =>
    Boolean(
      h.metadata?.source_url ||
        h.metadata?.documents_url ||
        (Array.isArray(h.metadata?.source_history) ? h.metadata.source_history.length : 0)
    )

  const ilman = hankkeet.filter((h) => h.is_public && h.status === "active" && !onLahde(h))
  console.log(`ilman lahdetta ${ilman.length}`)

  const dokIdt = [...new Set(ilman.map((h) => h.metadata?.source_document_id).filter(Boolean))]
  const jonoIdt = [...new Set(ilman.map((h) => h.metadata?.potential_project_id).filter(Boolean))]

  const { data: dokumentit, error: e1 } = await db
    .from("source_documents")
    .select("id,document_url,source_name")
    .in("id", dokIdt)
  if (e1) throw e1
  const { data: jonorivit, error: e2 } = await db
    .from("potential_projects")
    .select("id,url:metadata->>source_url")
    .in("id", jonoIdt)
  if (e2) throw e2

  const dok = new Map((dokumentit ?? []).map((d: any) => [String(d.id), d]))
  const jono = new Map((jonorivit ?? []).map((j: any) => [String(j.id), j]))

  let kirjoitettu = 0
  const mista: Record<string, number> = {}

  for (const h of ilman) {
    /*
     * Dokumentti ensin: se on se josta hanke syntyi. Jonorivi on
     * varareitti, koska sama osoite voi olla kummassakin.
     */
    const d = kelpaa(dok.get(String(h.metadata?.source_document_id))?.document_url)
    const j = kelpaa(jono.get(String(h.metadata?.potential_project_id))?.url)
    const url = d ?? j
    if (!url) continue

    const lahde = d ? "source_document" : "potential_project"
    mista[lahde] = (mista[lahde] ?? 0) + 1
    kirjoitettu++
    console.log(`${APPLY ? "KIRJOITA" : "(kuiva) "} ${String(h.name).slice(0, 44).padEnd(44)} ${url.slice(0, 76)}`)

    if (!APPLY) continue
    const md = {
      ...(h.metadata ?? {}),
      source_url: url,
      field_sources: {
        ...(h.metadata?.field_sources ?? {}),
        source_url: `palautettu kannasta: ${lahde}`,
      },
      takautuvat_ajot: [
        ...new Set([
          ...(Array.isArray(h.metadata?.takautuvat_ajot) ? h.metadata.takautuvat_ajot : []),
          TUNNISTE,
        ]),
      ],
    }
    const { error } = await db.from("projects").update({ metadata: md }).eq("id", h.id)
    if (error) console.log(`   VIRHE: ${error.message}`)
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  console.log(`  osoite loytyi kannasta ${kirjoitettu}/${ilman.length}`)
  console.log(`  mista: ${JSON.stringify(mista)}`)
  console.log(`  verkkohaun varaan jaa ${ilman.length - kirjoitettu}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
