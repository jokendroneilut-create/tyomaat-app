import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SARLININ KUVAUKSET UUDELLEEN ARTIKKELISTA (D-215).
 *
 * RSS-syotteen kuvaus oli HubSpotin kuvakaare ja seurantapikseli, ja
 * entiteetit purettiin vasta tagien poiston jalkeen - jolloin tagin sisus
 * jai tekstiksi. Korjaus on koodissa; tama korjaa jo tuodut rivit.
 *
 *   npx tsx scripts/fix-sarlin-kuvaukset.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-sarlin-kuvaukset.ts --apply
 */
const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { sources } = await import("../lib/agent/sources")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const lahde = (sources as any[]).find((s) => s.name === "sarlin")
  if (!lahde?.enrich) { console.log("sarlin-lahdetta tai rikastusta ei loydy"); return }

  const { data, error } = await db
    .from("potential_projects")
    .select("id, title, municipality, metadata")
    .eq("metadata->>source_name", "sarlin")
  if (error) throw error

  console.log(`sarlin-ehdokkaita ${data?.length ?? 0}\n`)
  let n = 0

  for (const p of data ?? []) {
    const md: any = (p as any).metadata ?? {}
    const rikas = await lahde.enrich({
      name: (p as any).title,
      description: null,
      city: (p as any).municipality,
      region: md.region ?? null,
      developer: md.developer ?? null,
      source_url: md.source_url,
    })

    const uusiKuvaus = String(rikas.description ?? "")
    if (!uusiKuvaus) { console.log(`ei runkoa: ${(p as any).title}`); continue }

    n++
    console.log(`${String((p as any).title).slice(0, 58)}`)
    console.log(`  kuvaus ${String(md.description ?? "").length} -> ${uusiKuvaus.length} merkkia`)
    console.log(`  kaupunki ${(p as any).municipality ?? "-"} -> ${rikas.city ?? "-"}`)
    console.log(`  ${uusiKuvaus.slice(0, 120)}...`)

    if (!APPLY) continue

    const { error: e } = await db
      .from("potential_projects")
      .update({
        ...(rikas.city ? { municipality: rikas.city } : {}),
        metadata: {
          ...md,
          description: uusiKuvaus,
          ...(rikas.region ? { region: rikas.region } : {}),
          ...(rikas.developer ? { developer: rikas.developer } : {}),
        },
      })
      .eq("id", (p as any).id)
    if (e) throw e
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} riviä ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
