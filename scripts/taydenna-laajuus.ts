import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HANKKEEN LAAJUUS TAKAUTUVASTI (D-274).
 *
 * Approve-reitti kirjoittaa sen nyt uusille hankkeille; tama taydentaa
 * olemassa olevat. Kirjoitetaan `metadata.laajuus`, ei uutta saraketta
 * — kannan rakennetta ei muuteta ohjelmallisesti.
 *
 *   npx tsx scripts/taydenna-laajuus.ts
 *   npx tsx scripts/taydenna-laajuus.ts --apply
 */

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { hankkeenLaajuus } = await import("../lib/projects/hankkeenLaajuus")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; f < 60000; f += 500) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, status, is_public, metadata")
      .range(f, f + 499)
    if (error) throw error
    if (!data?.length) break
    rivit.push(...data)
    if (data.length < 500) break
  }

  const kohteet = rivit.filter((r) => !(r.metadata ?? {}).laajuus)
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`hankkeita ${rivit.length}, ilman laajuutta ${kohteet.length}\n`)

  const jakauma = new Map<string, number>()
  let tehty = 0
  for (const r of kohteet) {
    const laajuus = hankkeenLaajuus(r.name)
    if (!laajuus) continue
    tehty += 1
    jakauma.set(laajuus, (jakauma.get(laajuus) ?? 0) + 1)

    if (!apply) continue
    const { error } = await db
      .from("projects")
      .update({ metadata: { ...(r.metadata ?? {}), laajuus } })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
  }

  for (const [l, n] of [...jakauma.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${l}`)
  }

  const nakyvat = rivit.filter((r) => r.status === "active" && r.is_public !== false)
  const saisi = nakyvat.filter((r) => hankkeenLaajuus(r.name)).length
  console.log(
    `\ntaydennettavia ${tehty}; asiakkaalle nakyvista ${saisi} / ${nakyvat.length} (${((100 * saisi) / nakyvat.length).toFixed(1)} %) saa laajuuden`
  )
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
