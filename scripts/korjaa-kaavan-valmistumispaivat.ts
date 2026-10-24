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
 * KAAVAN VALMISTUMINEN POIS HANKKEEN VALMISTUMISKENTASTA (D-348).
 *
 * Jasenninkorjaus estaa uudet, tama siivoaa jo kirjoitetut. Kaikki 939
 * Hilma- ja muut rivit kaytiin lapi: vain KAKSI oli tata, eika
 * kumpaakaan ollut kasin muokattu.
 *
 *   48011f56  Suovu-Palosen osayleiskaava, valm 2026-11-30
 *             "Kaavaehdotuksen tavoiteltu valmistumisaika on syksylla
 *             2026" -- kaavaehdotus, ei hanke. Olisi piilottanut rivin
 *             helmikuussa 2027 (D-298).
 *   9a73c6d2  Pursialan asemakaavan muutos (955), valm 2013-12-31
 *             Mennyt paiva kaavoitusvaiheen rivilla; teksti puhuu
 *             selvityksesta. Paiva on jo kolmetoista vuotta vanha.
 *
 * TYHJA ON OIKEA VASTAUS, ei arvaus: tuntematon valmistuminen nayttaa
 * hankkeen listalla ([[never-hide-on-missing-data]]).
 *
 *   npx tsx scripts/korjaa-kaavan-valmistumispaivat.ts
 *   npx tsx scripts/korjaa-kaavan-valmistumispaivat.ts --apply
 */

const RIVIT = ["48011f56-c06b-4c95-b255-8e08b8be44d9", "9a73c6d2-9ac2-4e63-b4bd-8e4ad552f194"]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("projects")
    .select("id,name,phase,estimated_completion,metadata")
    .in("id", RIVIT)
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }

  for (const p of data ?? []) {
    if (p.metadata?.manually_edited_at) {
      console.log(`   OHI (käsin muokattu) ${String(p.name).slice(0, 50)}`)
      continue
    }
    console.log(`   ${p.estimated_completion} -> tyhjä   ${String(p.phase).padEnd(12)} ${String(p.name).slice(0, 50)}`)
    if (!apply) continue
    const md = {
      ...(p.metadata ?? {}),
      estimated_completion_poistettu: {
        oli: p.estimated_completion,
        syy: "kaavan/selvityksen valmistuminen, ei hankkeen (D-348)",
        milloin: new Date().toISOString().slice(0, 10),
      },
    }
    const { error: e } = await db
      .from("projects")
      .update({ estimated_completion: null, metadata: md })
      .eq("id", p.id)
    if (e) console.error(`      VIRHE: ${e.message}`)
  }

  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
