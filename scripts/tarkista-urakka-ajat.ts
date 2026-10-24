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
 * TARKISTA KAIKKI URAKKA-AJASTA KIRJOITETUT PAIVAT (D-342).
 *
 * Johannes 24.10.2026 Pihkapuiston stabilointiurakasta: *"tasta on
 * mainittu 'Urakka-aika on 15.12.2026 - 22.2.2026' mutta poimimme
 * 'Arvioitu valmistuminen: 2026-12-15'. korjataan ja katsotaan onko
 * muita paassyt lapi kantaan."*
 *
 * Vika: avainsanan oma yhdysmerkki luettiin jakson viivaksi, jolloin
 * ALKUPAIVA paatyi valmistumiseksi. Saanto on korjattu; tama ajaa
 * KORJATUN saannon kaikkien merkittyjen rivien yli ja vertaa.
 *
 * Rivit tunnistaa merkista `metadata.valmistuminen_urakka_ajasta`,
 * jonka takautuva ajo kirjoitti -- siksi se kirjoitettiin.
 *
 *   npx tsx scripts/tarkista-urakka-ajat.ts
 *   npx tsx scripts/tarkista-urakka-ajat.ts --apply
 */

import { urakkaAjanLoppu, valmiinaMennessa } from "../lib/agent/urakkaAika"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const luvut = { tarkistettu: 0, sama: 0, muuttuu: 0, poistuu: 0, virheita: 0 }

  for (const taulu of ["potential_projects", "projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, estimated_completion, additional_info, metadata"
            : "id, title, metadata"
        )
        .not("metadata->>valmistuminen_urakka_ajasta", "is", null)
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 500) break
    }

    console.log(`\n=== ${taulu}: ${rivit.length} merkittyä riviä ===\n`)

    for (const p of rivit) {
      luvut.tarkistettu += 1
      const kuvaus =
        taulu === "projects"
          ? String(p.additional_info ?? p.metadata?.description ?? "")
          : String(p.metadata?.description ?? "")

      const vanha = String(p.metadata?.estimated_completion ?? "")
      const uusi = urakkaAjanLoppu(kuvaus) ?? valmiinaMennessa(kuvaus)
      const nimi = String(p.name ?? p.title ?? "").slice(0, 44)

      if (uusi === vanha) {
        luvut.sama += 1
        continue
      }

      if (!uusi) {
        luvut.poistuu += 1
        console.log(`   POISTUU   ${nimi.padEnd(46)} ${vanha} -> (tyhjä)`)
      } else {
        luvut.muuttuu += 1
        console.log(`   MUUTTUU   ${nimi.padEnd(46)} ${vanha} -> ${uusi}`)
      }

      if (!apply) continue

      const md: Record<string, any> = { ...(p.metadata ?? {}) }
      if (uusi) {
        md.estimated_completion = uusi
        md.valmistuminen_urakka_ajasta = new Date().toISOString().slice(0, 10)
      } else {
        delete md.estimated_completion
        delete md.valmistuminen_urakka_ajasta
      }

      const paivitys: Record<string, any> = { metadata: md }
      if (taulu === "projects") paivitys.estimated_completion = uusi ?? null

      const { error } = await db.from(taulu).update(paivitys).eq("id", p.id)
      if (error) {
        luvut.virheita += 1
        console.error(`      VIRHE: ${error.message}`)
      }
    }
  }

  console.log(
    `\nTarkistettu ${luvut.tarkistettu}: ennallaan ${luvut.sama}, muuttuu ${luvut.muuttuu}, poistuu ${luvut.poistuu}, virheitä ${luvut.virheita}`
  )
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
