import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAAVAN RAKENNUTTAJA JA PUOLUSTUSKIINTEISTOJEN PAAURAKOITSIJA (D-195).
 *
 * Sama saanto kuin uusille ehdokkaille (`kaavanRakennuttaja`,
 * `puolustuskiinteistotResolver`), ajettuna jo loydettyihin. Vain
 * tyhjaan kenttaan: lahteen tai ihmisen arvoa ei korvata.
 *
 *   npx tsx scripts/fix-kaavan-rakennuttaja.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-kaavan-rakennuttaja.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const tiivis = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { kaavanRakennuttaja } = await import("../lib/projects/kaavanRakennuttaja")
  const { extractBuilderFromText } = await import("../lib/agent/fetchSttHakuSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const laskurit = { rakennuttaja: 0, paaurakoitsija: 0 }

  for (const table of ["potential_projects", "projects"] as const) {
    const columns = table === "projects" ? "id, name, developer, builder, metadata" : "id, title, status, metadata"
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error

      for (const r of (data ?? []) as any[]) {
        const m = r.metadata ?? {}
        const nimi = tiivis(r.name ?? r.title).slice(0, 60)
        const lahde = String(m.source_name ?? "")

        const developer = kaavanRakennuttaja({
          sourceName: lahde,
          description: m.description,
          nykyinen: r.developer ?? m.developer,
        })

        const builder =
          lahde === "Puolustuskiinteistöt uutiset" && !tiivis(r.builder ?? m.builder)
            ? extractBuilderFromText(r.title ?? r.name ?? m.operation ?? null, m.description ?? null)
            : null

        if (!developer && !builder) continue
        if (developer) laskurit.rakennuttaja++
        if (builder) laskurit.paaurakoitsija++
        console.log(
          `${table} ${r.status ?? ""} [${lahde}] ${nimi}` +
            (developer ? `\n    rakennuttaja -> ${developer}` : "") +
            (builder ? `\n    pääurakoitsija -> ${builder}` : "")
        )

        if (!APPLY) continue

        const metadata = {
          ...m,
          ...(developer ? { developer } : {}),
          ...(builder ? { builder } : {}),
        }
        const { error: e } = await supabase
          .from(table)
          .update(
            table === "projects"
              ? { metadata, ...(developer ? { developer } : {}), ...(builder ? { builder } : {}) }
              : { metadata }
          )
          .eq("id", r.id)
        if (e) throw e
      }
      if (!data || data.length < 1000) break
    }
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(laskurit)
}

main().catch((e) => { console.error(e); process.exit(1) })
