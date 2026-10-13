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
 * LUVAN JATKAMISET JA PUIDEN KAATAMISET POIS KATSELMOINTIJONOSTA.
 *
 * Lähde ei tuo näitä enää (lupapisteResolver + negativeProjects.ts), mutta
 * jonossa olevat rivit jäivät sinne. Poisto on status "ignored" eikä DELETE:
 * rivi ei näy asiakkaille, mutta historia säilyy ja saman kuulutuksen
 * uudelleentuonti tunnistaa sen nähdyksi.
 *
 * Koskee VAIN tilaa "new". Jo hylättyihin ei kosketa — ne ovat jo pois
 * jonosta, ja niiden tilan muuttaminen hävittäisi tiedon siitä että
 * joku on katsonut rivin.
 *
 *   npx tsx scripts/siivoa-ei-hankkeet-jonosta.ts
 *   npx tsx scripts/siivoa-ei-hankkeet-jonosta.ts --apply
 */

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { isNonProjectPermit } = await import("../lib/agent/knowledge/negativeProjects")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; f < 40000; f += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, metadata")
      .range(f, f + 999)
    if (error) throw error
    if (!data?.length) break
    rivit.push(...data)
    if (data.length < 1000) break
  }

  const kohteet = rivit.filter(
    (r) => r.status === "new" && isNonProjectPermit(String(r.title ?? ""))
  )

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`jonossa ${rivit.filter((r) => r.status === "new").length} rivia odottamassa`)
  console.log(`niista ei-hankkeita: ${kohteet.length}\n`)

  for (const r of kohteet) {
    const lahde = String((r.metadata ?? {}).source_name ?? "-")
    console.log(`  ${lahde.slice(0, 22).padEnd(24)} ${String(r.title).slice(0, 62)}`)

    if (!apply) continue

    const { error } = await db
      .from("potential_projects")
      .update({
        status: "ignored",
        updated_at: new Date().toISOString(),
        metadata: {
          ...(r.metadata ?? {}),
          ignored_reason: "ei ole rakennushanke (luvan jatkaminen / puiden kaataminen)",
          ignored_at: new Date().toISOString(),
        },
      })
      .eq("id", r.id)

    console.log(error ? `     VIRHE: ${error.message}` : "     OHITETTU")
  }

  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
