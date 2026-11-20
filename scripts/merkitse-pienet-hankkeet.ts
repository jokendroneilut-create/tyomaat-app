import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PIENET HANKKEET TAKAUTUVASTI (D-442).
 *
 * TIC:n hyväksynnän valinta "⏳ Aseta vanhenemaan vuoden kuluttua (pienet
 * hankkeet: maalaus, maalämpö, katon uusinta…)" asetti ennen tätä vain
 * `metadata.expire_at`-päivän. Sen asettavat ainoastaan tämä valinta ja
 * TIC:n käsin muokkaus — lähteet eivät — joten expire_at tunnistaa
 * Johanneksen pieniksi merkitsemät hankkeet. Mitattu 20.11.2026: 325
 * hanketta, joista 324 hyväksytty TIC:ssä.
 *
 *   npx tsx scripts/merkitse-pienet-hankkeet.ts [--apply]
 */

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const rivit: any[] = []
  for (let i = 0; ; i += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,metadata")
      .not("metadata->>expire_at", "is", null)
      .range(i, i + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const merkittavat = rivit.filter((r) => r.metadata?.pieni_hanke !== true)
  console.log(`expire_at asetettu ${rivit.length}, merkitään pieneksi ${merkittavat.length}`)
  if (!apply) return console.log("Kuivaharjoitus. Aja --apply.")
  let n = 0
  for (const r of merkittavat) {
    const { error } = await db
      .from("projects")
      .update({ metadata: { ...r.metadata, pieni_hanke: true } })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
    else n++
  }
  console.log(`merkitty ${n}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
