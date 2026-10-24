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
 * "VALMIINA X MENNESSA" -- MONTAKO JA MISSA MUODOSSA? (D-342 jatko)
 *
 * Johannes 24.10.2026: *"lisaa myos muoto 'sen tulee olla valmiina
 * 30.6.2027 mennessa' ja tarkista kanta."*
 *
 * Muoto loytyi Leppavaaran rivilta, jolta jakso ei kertonut
 * valmistumista. Kumpikaan jasennin ei tunne sita:
 * `parseEstimatedCompletionDate` vaatii oman avainsanansa EIKA osaa
 * paivamuotoa 30.6.2027 lainkaan, ja `urakkaAjanLoppu` etsii jaksoa.
 *
 * Tama laskee muodot ja tulostaa lauseet ennen kuin saanto
 * kirjoitetaan ([[anchor-vocabulary-per-source]]).
 *
 *   npx tsx scripts/mittaa-valmiina-mennessa.ts
 *   npx tsx scripts/mittaa-valmiina-mennessa.ts --rivit
 */

import { parseEstimatedCompletionDate } from "../lib/agent/parseFinnishCompletionDate"
import { urakkaAjanLoppu } from "../lib/agent/urakkaAika"

const MUODOT: [string, RegExp][] = [
  ["valmiina ... mennessä", /valmiina[^.]{0,60}?mennessä/i],
  ["valmis ... mennessä", /valmii?s[^.]{0,60}?mennessä/i],
  ["valmiiksi ... mennessä", /valmiiksi[^.]{0,60}?mennessä/i],
  ["luovutus ... mennessä", /luovut\w+[^.]{0,60}?mennessä/i],
  ["viimeistään <päivä>", /viimeistään\s+\d{1,2}[./]/i],
]

async function main() {
  const naytaRivit = process.argv.includes("--rivit")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const laskut = new Map<string, number>()
  const lauseet: { nimi: string; taulu: string; lause: string }[] = []
  let rivit = 0
  let osui = 0
  let ilmanPaivaa = 0

  for (const taulu of ["potential_projects", "projects"] as const) {
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, estimated_completion, additional_info, metadata"
            : "id, title, status, metadata"
        )
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      for (const p of (data ?? []) as any[]) {
        if (taulu === "potential_projects" && p.status === "ignored") continue
        rivit += 1
        const kuvaus = (
          taulu === "projects"
            ? String(p.additional_info ?? p.metadata?.description ?? "")
            : String(p.metadata?.description ?? "")
        ).replace(/\s+/g, " ")
        if (!kuvaus) continue

        const osuneet = MUODOT.filter(([, re]) => re.test(kuvaus))
        if (!osuneet.length) continue
        osui += 1
        for (const [nimi] of osuneet) laskut.set(nimi, (laskut.get(nimi) ?? 0) + 1)

        const nyt =
          (taulu === "projects" ? p.estimated_completion : null) ??
          p.metadata?.estimated_completion ??
          null
        if (nyt) continue
        if (parseEstimatedCompletionDate(kuvaus, null) || urakkaAjanLoppu(kuvaus)) continue
        ilmanPaivaa += 1

        const i = kuvaus.search(osuneet[0][1])
        lauseet.push({
          nimi: String(p.name ?? p.title ?? "").slice(0, 44),
          taulu,
          lause: kuvaus.slice(Math.max(0, i - 60), i + 110),
        })
      }
      if ((data ?? []).length < 500) break
    }
  }

  console.log(`Rivejä ${rivit}, muoto kuvauksessa ${osui}`)
  console.log(`Niistä ilman valmistumista ja ilman muuta poimintaa: ${ilmanPaivaa}\n`)
  for (const [nimi, n] of [...laskut.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${String(n).padStart(4)}  ${nimi}`)
  }

  if (naytaRivit) {
    console.log(`\n=== LAUSEET (${lauseet.length}) ===`)
    for (const l of lauseet) {
      console.log(`\n${l.taulu === "projects" ? "HANKE" : "JONO "} ${l.nimi}`)
      console.log(`   ...${l.lause}...`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
