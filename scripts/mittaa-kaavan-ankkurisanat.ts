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
 * MIKA SANA ON YRITYSNIMEN VIERESSA?
 *
 * 346 kaavarivilla on yritysnimi kuvauksessa mutta ei rakennuttajaa, eika
 * nykyinen saanto (kolme ankkuria, D-195) loyda sita. Ankkurit pitaa
 * valita AINEISTOSTA eika arvaamalla: tama laskee nimen EDELLA olevan
 * sanan ja nimen JALKEEN tulevan sanan, jotta naen mitka kuviot toistuvat.
 *
 *   npx tsx scripts/mittaa-kaavan-ankkurisanat.ts
 */

import { extractYvaDeveloper } from "../lib/agent/fetchYvaSource"
import { onKaavalahde } from "../lib/projects/kaavanRakennuttaja"

const COMPANY_NAME =
  /\b([A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*)*\s+(?:Oy|Oyj|Ab|Ky|Ltd))(:\w+)?\b/g

function lisaa(map: Map<string, number>, k: string) {
  map.set(k, (map.get(k) ?? 0) + 1)
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const edella = new Map<string, number>()
  const jalkeen = new Map<string, number>()
  const paatteet = new Map<string, number>()
  let nimia = 0
  let riveja = 0

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
        const kuvaus = (
          taulu === "projects"
            ? String(p.additional_info ?? p.metadata?.description ?? "")
            : String(p.metadata?.description ?? "")
        ).replace(/\s+/g, " ")
        const dev = String((taulu === "projects" ? p.developer : null) ?? p.metadata?.developer ?? "").trim()
        if (dev) continue
        if (extractYvaDeveloper(kuvaus)) continue

        let osui = false
        for (const m of kuvaus.matchAll(COMPANY_NAME)) {
          osui = true
          nimia += 1
          const alku = m.index ?? 0
          const ennen = kuvaus.slice(Math.max(0, alku - 60), alku).trim()
          const sanat = ennen.split(/\s+/).filter(Boolean)
          const edellinen = (sanat[sanat.length - 1] ?? "").toLowerCase().replace(/[^a-zåäö-]/g, "")
          if (edellinen) lisaa(edella, edellinen)
          if (m[2]) lisaa(paatteet, m[2].toLowerCase())
          const jalki = kuvaus.slice(alku + m[0].length).trim().split(/\s+/)[0] ?? ""
          const puhdas = jalki.toLowerCase().replace(/[^a-zåäö-]/g, "")
          if (puhdas) lisaa(jalkeen, puhdas)
        }
        if (osui) riveja += 1
      }
      if ((data ?? []).length < 500) break
    }
  }

  console.log(`=== ${riveja} riviä, ${nimia} nimiesiintymää ===`)

  const tulosta = (nimi: string, map: Map<string, number>, raja: number) => {
    console.log(`\n--- ${nimi} (>= ${raja}) ---`)
    for (const [k, n] of Array.from(map.entries()).sort((a, b) => b[1] - a[1])) {
      if (n < raja) break
      console.log(`${String(n).padStart(4)}  ${k}`)
    }
  }

  tulosta("SANA NIMEN EDELLÄ", edella, 3)
  tulosta("SANA NIMEN JÄLKEEN", jalkeen, 3)
  tulosta("NIMEN PÄÄTE", paatteet, 2)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
