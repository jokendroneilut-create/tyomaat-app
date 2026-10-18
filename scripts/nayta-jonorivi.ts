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
 * NAYTA YKSI JONORIVI KOKONAAN.
 *
 * TIC-sivu nayttaa jonorivista vain osan kentista, joten rivin
 * tarkistaminen vaatii kaikki kentat ja koko metadatan. Tulostaa
 * jokaisen metadata-avaimen omana lohkonaan pituuden kanssa, jotta
 * pitka kuvaus ja lyhyt vihje erottuvat.
 *
 *   npx tsx scripts/nayta-jonorivi.ts <uuid>
 */

async function main() {
  const id = process.argv[2]
  if (!id) {
    console.error("Anna jonorivin uuid: npx tsx scripts/nayta-jonorivi.ts <uuid>")
    process.exit(1)
  }
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data, error } = await db.from("potential_projects").select("*").eq("id", id).maybeSingle()
  if (error || !data) {
    console.error(`VIRHE: ${error?.message ?? "ei rivia"}`)
    process.exit(1)
  }
  const { metadata, ...muu } = data as any
  console.log("=== RIVI ===")
  console.log(JSON.stringify(muu, null, 2))
  console.log("\n=== METADATA ===")
  for (const [k, v] of Object.entries(metadata ?? {})) {
    const s = typeof v === "string" ? v : JSON.stringify(v)
    console.log(`\n--- ${k} (${s?.length ?? 0}) ---\n${s}`)
  }
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
