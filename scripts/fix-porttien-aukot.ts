import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PORTTI JOKA EI EHTINYT AJAA (D-211).
 *
 * Relevanssiportti ja kohdetyypitin ovat fail-open: mallikutsun virhe ei
 * pudota ehdokasta jonosta. Se on oikea saanto - mutta silloin ehdokas
 * jaa jonoon ILMAN porttia, eika siita jaa merkkia muualle kuin lokiin.
 *
 * Ensimmaisessa julkaisijasyotteen ajossa (24.9.2026, 210 ehdokasta
 * kotiyhteydelta) mallikutsu aikakatkaistui osalla: 6 ehdokasta jai ilman
 * relevanssiporttia ja 24 ilman kohdetyyppia.
 *
 * Tama ajaa puuttuvan portin uudelleen. Vain taydentaa: olemassa olevaa
 * metatietoa ei ylikirjoiteta, ja tila muuttuu vain jos portti sanoo
 * "ohita".
 *
 *   npx tsx scripts/fix-porttien-aukot.ts <lahteen_nimi>            (kuivaharjoitus)
 *   npx tsx scripts/fix-porttien-aukot.ts <lahteen_nimi> --apply
 */
const APPLY = process.argv.includes("--apply")
const LAHDE = process.argv.find((a) => !a.startsWith("--") && !a.endsWith(".ts") && !a.includes("node")) ?? "stt_julkaisijat"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { gateCandidateRelevance } = await import("../lib/agent/quality/gateCandidateRelevance")
  const { resolveBuildingType } = await import("../lib/agent/quality/resolveBuildingType")

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data, error } = await db
    .from("potential_projects")
    .select("id, title, status, metadata")
    .eq("metadata->>source_name", LAHDE)
  if (error) throw error

  const rivit = (data ?? []).filter(
    (p: any) => !p.metadata?.llm_relevance || !p.metadata?.building_type
  )
  console.log(`lahde ${LAHDE}: ${data?.length ?? 0} ehdokasta, aukkoja ${rivit.length}\n`)

  let muutettu = 0
  let ohitettu = 0

  for (const p of rivit as any[]) {
    const md = p.metadata ?? {}
    const description = md.description ?? md.operation ?? null

    const [portti, tyyppi] = await Promise.all([
      md.llm_relevance
        ? Promise.resolve({ metadata: {}, ignored: false })
        : gateCandidateRelevance({
            title: p.title,
            description,
            sourceName: LAHDE,
            ruleRecommendedAction: md.recommended_action ?? null,
          }),
      md.building_type
        ? Promise.resolve({ metadata: {} })
        : resolveBuildingType({ title: p.title, description, ruleBuildingType: null }),
    ])

    const uusiTila = portti.ignored && p.status === "new" ? "ignored" : p.status
    const lisat = { ...portti.metadata, ...(tyyppi as any).metadata }

    if (!Object.keys(lisat).length && uusiTila === p.status) {
      ohitettu++
      continue
    }

    console.log(
      `${(uusiTila !== p.status ? `${p.status} -> ${uusiTila}` : p.status).padEnd(16)} ` +
        `${String((lisat as any).building_type ?? md.building_type ?? "-").padEnd(16)} ${String(p.title).slice(0, 56)}`
    )
    muutettu++

    if (!APPLY) continue

    const { error: e } = await db
      .from("potential_projects")
      .update({ status: uusiTila, metadata: { ...md, ...lisat } })
      .eq("id", p.id)
    if (e) throw e
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${muutettu} muutosta, ${ohitettu} ilman muutosta ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
