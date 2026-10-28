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
 * SATUNNAISOTOS KORJATUISTA KAAVAKUVAUKSISTA (D-356).
 *
 * Johannes 29.10.2026 valitsi vaihtoehdon 2: *"aja loput kerralla ja
 * luen jalkikateen satunnaisotos"*. Tama poimii otoksen niista
 * riveista jotka ajo on merkinnyt (`metadata.kuvaus_selostuksesta`) ja
 * tulostaa otsikon, lahteen, liitteen nimen ja koko kuvauksen.
 *
 * OTOS ON TASAVALI, EI ENSIMMAISET N. Taulun alku painottuu vanhoihin
 * riveihin ja yhteen lahteeseen, jolloin otos ei kerro ajosta mitaan
 * ([[sample-must-be-representative]]).
 *
 *   npx tsx scripts/tarkista-otos-kaavakuvaukset.ts            (20 riviä)
 *   npx tsx scripts/tarkista-otos-kaavakuvaukset.ts --koko=40
 *   npx tsx scripts/tarkista-otos-kaavakuvaukset.ts --paiva=2026-10-29
 */

async function main() {
  const koko = Number(process.argv.find((a) => a.startsWith("--koko="))?.split("=")[1] ?? 20)
  const paiva = process.argv.find((a) => a.startsWith("--paiva="))?.split("=")[1] ?? null

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  type Rivi = { taulu: string; otsikko: string; lahde: string; liite: string; kuvaus: string; milloin: string }
  const korjatut: Rivi[] = []

  for (const taulu of ["projects", "potential_projects"] as const) {
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "name,additional_info,metadata"
            : "title,metadata"
        )
        .not("metadata->>kuvaus_selostuksesta", "is", null)
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      for (const r of (data ?? []) as any[]) {
        const merkinta = r.metadata?.kuvaus_selostuksesta ?? {}
        if (paiva && String(merkinta.milloin ?? "") !== paiva) continue
        korjatut.push({
          taulu,
          otsikko: String(r.name ?? r.title ?? ""),
          lahde: String(r.metadata?.source_name ?? r.metadata?.source ?? "-"),
          liite: decodeURIComponent(String(merkinta.liite ?? "").split("/").pop() ?? ""),
          kuvaus: String(r.additional_info ?? r.metadata?.description ?? "").replace(/\s+/g, " "),
          milloin: String(merkinta.milloin ?? "-"),
        })
      }
      if ((data ?? []).length < 1000) break
    }
  }

  console.log(`Korjattuja rivejä: ${korjatut.length}${paiva ? ` (päivä ${paiva})` : ""}`)
  if (!korjatut.length) return

  /* Tasavali: joka n:s rivi, ei ensimmaiset. */
  const askel = Math.max(1, Math.floor(korjatut.length / koko))
  const otos = korjatut.filter((_, i) => i % askel === 0).slice(0, koko)
  console.log(`Otos: joka ${askel}. rivi, ${otos.length} kpl\n`)

  const pituudet = korjatut.map((r) => r.kuvaus.length).sort((a, b) => a - b)
  const mediaani = pituudet[Math.floor(pituudet.length / 2)]
  console.log(`Kuvauksen pituus: mediaani ${mediaani}, lyhin ${pituudet[0]}, pisin ${pituudet.at(-1)}\n`)

  for (const r of otos) {
    console.log(`${r.taulu === "projects" ? "HANKE" : "JONO "} ${r.otsikko.slice(0, 60)}`)
    console.log(`   lähde: ${r.lahde.slice(0, 40)}   liite: ${r.liite.slice(0, 50)}`)
    console.log(`   ${r.kuvaus.slice(0, 300)}${r.kuvaus.length > 300 ? "…" : ""}`)
    console.log()
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
