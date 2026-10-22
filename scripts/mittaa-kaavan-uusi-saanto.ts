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
 * MITA UUSI KAAVA-ANKKURISAANTO LOYTAA? (D-338)
 *
 * Ajetaan `kaavanOsapuoli` KAIKKIEN kaavarivien yli ja tulostetaan
 * jokainen osuma lauseineen, jotta ne voi lukea riveittain
 * ([[dry-run-before-backfill]]). Lisaksi ajetaan hyvaksyttyjen yli
 * joilla rakennuttaja JO on: jos saanto antaa eri nimen, se on
 * merkki vaarasta ankkurista ([[test-filter-against-approved]]).
 *
 *   npx tsx scripts/mittaa-kaavan-uusi-saanto.ts
 */

import { kaavanOsapuoli } from "../lib/projects/kaavanOsapuolet"
import { extractYvaDeveloper } from "../lib/agent/fetchYvaSource"
import { onKaavalahde } from "../lib/projects/kaavanRakennuttaja"

function ymparilta(kuvaus: string, nimi: string): string {
  const i = kuvaus.indexOf(nimi)
  if (i === -1) return kuvaus.slice(0, 160)
  return kuvaus.slice(Math.max(0, i - 90), i + nimi.length + 70)
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const uudet: { id: string; taulu: string; nimi: string; osapuoli: string; lause: string }[] = []
  const ristiriidat: { id: string; nimi: string; kentassa: string; saanto: string; lause: string }[] = []
  let rivit = 0
  let joTiedossa = 0

  for (const taulu of ["potential_projects", "projects"] as const) {
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, developer, additional_info, metadata"
            : "id, title, status, metadata"
        )
        .like("metadata->>resolver", "%KaavaResolver")
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      for (const p of (data ?? []) as any[]) {
        if (taulu === "potential_projects" && p.status === "ignored") continue
        if (!onKaavalahde(String(p.metadata?.source_name ?? ""))) continue
        rivit += 1

        const kuvaus = (
          taulu === "projects"
            ? String(p.additional_info ?? p.metadata?.description ?? "")
            : String(p.metadata?.description ?? "")
        ).replace(/\s+/g, " ")
        if (!kuvaus) continue

        const dev = String((taulu === "projects" ? p.developer : null) ?? p.metadata?.developer ?? "").trim()
        const uusi = kaavanOsapuoli(kuvaus)
        if (!uusi) continue

        if (dev) {
          joTiedossa += 1
          if (dev.toLowerCase() !== uusi.toLowerCase()) {
            ristiriidat.push({
              id: p.id,
              nimi: String(p.name ?? p.title ?? ""),
              kentassa: dev,
              saanto: uusi,
              lause: ymparilta(kuvaus, uusi),
            })
          }
          continue
        }

        /* Nykyinen saanto hoitaa nama jo -- vain uudet kiinnostavat. */
        if (extractYvaDeveloper(kuvaus)) continue

        uudet.push({
          id: p.id,
          taulu,
          nimi: String(p.name ?? p.title ?? ""),
          osapuoli: uusi,
          lause: ymparilta(kuvaus, uusi),
        })
      }
      if ((data ?? []).length < 500) break
    }
  }

  console.log(`=== ${rivit} kaavariviä ===`)
  console.log(`Uusi sääntö löytää rakennuttajan ${uudet.length} rivillä joilta se nyt puuttuu`)
  console.log(`Rivejä joilla rakennuttaja jo on ja sääntö osuu: ${joTiedossa}, niistä ERI nimi: ${ristiriidat.length}`)

  console.log(`\n=== RISTIRIIDAT (${ristiriidat.length}) ===`)
  for (const r of ristiriidat) {
    console.log(`\n${r.id}  ${r.nimi.slice(0, 50)}`)
    console.log(`   kentässä: ${r.kentassa}   sääntö: ${r.saanto}`)
    console.log(`   ...${r.lause}...`)
  }

  console.log(`\n=== UUDET (${uudet.length}) ===`)
  for (const u of uudet) {
    console.log(`\n${u.taulu === "projects" ? "HANKE" : "JONO "} ${u.id}  ${u.nimi.slice(0, 50)}`)
    console.log(`   => ${u.osapuoli}`)
    console.log(`   ...${u.lause}...`)
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
