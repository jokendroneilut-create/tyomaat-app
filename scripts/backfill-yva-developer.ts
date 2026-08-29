import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YVA-HANKKEIDEN PUUTTUVA RAKENNUTTAJA.
 *
 * Ajaa olemassa olevan yva-rikastajan niille julkisille YVA-hankkeille
 * joilta puuttuu seka rakennuttaja etta urakoitsija. Taydentaa vain
 * tyhjan kentan.
 *
 * Kuivaharjoitus oletuksena; kirjoittaa vasta --apply.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { createYvaEnricher } = await import("../lib/agent/yvaProjectPage")
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const enrich = createYvaEnricher()

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,is_public,developer,builder,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const puuttuu = rivit.filter(
    (h: any) =>
      String(h.metadata?.source_name ?? "").toLowerCase().includes("yva") &&
      h.is_public !== false &&
      !h.developer &&
      !h.builder &&
      h.metadata?.source_url
  )

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}: ${puuttuu.length} hanketta ilman osapuolta\n`)

  let loytyi = 0
  for (const h of puuttuu) {
    let dev: string | null = null
    try {
      const tulos: any = await enrich({ name: h.name, source_url: h.metadata.source_url, metadata: {} })
      dev = tulos?.developer ?? null
    } catch (e: any) {
      console.log(`  ${String(h.name).slice(0, 46).padEnd(48)} VIRHE ${String(e?.message).slice(0, 40)}`)
      continue
    }

    if (!dev) {
      console.log(`  ${String(h.name).slice(0, 46).padEnd(48)} ei sivulla`)
      continue
    }

    loytyi++
    console.log(`  ${String(h.name).slice(0, 46).padEnd(48)} ${dev}`)

    if (!APPLY) continue

    const { error } = await admin
      .from("projects")
      .update({
        developer: dev,
        metadata: {
          ...h.metadata,
          developer: dev,
          field_sources: { ...(h.metadata?.field_sources ?? {}), developer: "lähde" },
        },
      })
      .eq("id", h.id)

    console.log(error ? `     VIRHE: ${error.message}` : "     tallennettu")
  }

  console.log(`\nrakennuttaja loytyi: ${loytyi} / ${puuttuu.length}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
