import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VALMISTUMISVIHJEET OMISSA DOKUMENTEISSA.
 *
 * Mittaus 1 kertoi ettei arvioitu valmistumispaiva ole kaytettava
 * signaali: 709 rakenteilla-hankkeesta 1 140:sta siita puuttuu paiva
 * kokonaan, ja vain 39:lla paiva on mennyt. Automatiikka ei siis
 * koskaan kosketa valtaosaa.
 *
 * Tama mittaa toisen signaalin: onko kannassa dokumentti joka kertoo
 * hankkeen valmistuneen, ilman etta kenttaa on paivitetty. Juuri nain
 * Hyvinkaan areena loytyi (D-219) - tieto oli meilla, mutta se ei
 * liikkunut hankkeelle.
 *
 *   npx tsx scripts/measure-valmistumisvihjeet.ts
 */

const RAKENTEILLA = /rakenteilla|rakentaminen aloitettu|sopimus myonnetty|sopimus myönnetty|valmistumassa/i
const VALMIS_SANAT =
  /valmistui|valmistunut|valmistuneet|otettiin kayttoon|otettiin käyttöön|vihittiin|avattiin|avasi ovensa|luovutettiin|luovutus/i

/* Yleiset sanat eivat yksiloi hanketta. */
const TYHJAT = new Set([
  "asemakaavan","asemakaava","muutos","kaupungin","kaupunki","uusi","uuden","uutta","rakentaminen",
  "rakennuksen","rakennus","hanke","hankkeen","alue","alueen","kortteli","korttelin","talo","talon",
  "koulu","koulun","paivakoti","päiväkoti","keskus","keskuksen","tie","tien","katu","kadun","as","oy",
  "ja","sekä","seka","osa","osan","valmistui","valmistunut","peruskorjaus","peruskorjauksen","laajennus",
])

function sanat(teksti: string): Set<string> {
  return new Set(
    String(teksti ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((s) => s.length >= 4 && !TYHJAT.has(s))
  )
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const pr: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects").select("id, name, city, phase, status, is_public, construction_start, estimated_completion")
      .eq("status", "active").order("id").range(from, from + 999)
    if (error) throw error
    pr.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const kohteet = pr.filter((p) => p.is_public && RAKENTEILLA.test(String(p.phase)))

  const docs: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("source_documents").select("id, title, document_url, published_at, created_at").order("id").range(from, from + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const valmiit = docs.filter((d) => VALMIS_SANAT.test(String(d.title)))
  console.log(`rakenteilla ${kohteet.length}, dokumentteja ${docs.length}, valmistumisotsikoita ${valmiit.length}\n`)

  /* Hankkeen yksiloivat sanat vs. dokumentin otsikko. */
  const osumat: { p: any; d: any; yhteiset: string[] }[] = []
  const dokSanat = valmiit.map((d) => ({ d, s: sanat(d.title) }))

  for (const p of kohteet) {
    const ps = sanat(p.name)
    if (ps.size < 1) continue
    for (const { d, s } of dokSanat) {
      const yhteiset = [...ps].filter((w) => s.has(w))
      if (yhteiset.length < 2) continue
      osumat.push({ p, d, yhteiset })
    }
  }

  console.log(`=== parit joissa >=2 yksiloivaa yhteista sanaa: ${osumat.length} ===`)
  for (const { p, d, yhteiset } of osumat.slice(0, 40)) {
    console.log(`\nHANKE  ${String(p.city ?? "-")} | ${p.phase} | aloitus ${String(p.construction_start ?? "-").slice(0,10)} | valmis ${String(p.estimated_completion ?? "-").slice(0,10)}`)
    console.log(`       ${String(p.name).replace(/\u200b/g,"").slice(0, 86)}`)
    console.log(`DOKU   ${String(d.published_at ?? d.created_at).slice(0,10)}  ${String(d.title).slice(0, 86)}`)
    console.log(`       yhteiset: ${yhteiset.join(", ")}`)
  }

  /* Kolmas signaali: kuinka kauan rakentaminen on ollut kaynnissa. */
  console.log("\n=== rakentamisen kesto (aloituspaivasta tahan paivaan) ===")
  const nyt = Date.now()
  const kaudet = [
    ["alle 1 v", 0, 365], ["1-2 v", 365, 730], ["2-3 v", 730, 1095],
    ["3-4 v", 1095, 1460], ["yli 4 v", 1460, 99999],
  ] as const
  const ilmanAloitusta = kohteet.filter((p) => !p.construction_start).length
  for (const [nimi, ala, yla] of kaudet) {
    const n = kohteet.filter((p) => {
      if (!p.construction_start) return false
      const vrk = (nyt - new Date(String(p.construction_start).slice(0,10)).getTime()) / 86_400_000
      return vrk >= ala && vrk < yla
    }).length
    console.log(`  ${nimi.padEnd(10)} ${String(n).padStart(4)}`)
  }
  console.log(`  ei aloituspaivaa ${ilmanAloitusta}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
