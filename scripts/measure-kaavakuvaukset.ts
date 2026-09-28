import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAAVALAHTEIDEN KUVAUSTEN LAATU.
 *
 * Kuulutus kertoo menettelyn, selostus kertoo hankkeen (D-217). Tama
 * mittaa kuinka monella kaavarivilla kuvaus on pelkkaa menettelytekstia
 * tai puuttuu kokonaan - eli mista Savonlinnan korjaus kannattaa toistaa.
 *
 *   npx tsx scripts/measure-kaavakuvaukset.ts
 */

/* Menettelyteksti: kertoo milloin paperit ovat nahtavilla, ei hankkeesta. */
const MENETTELY =
  /n(?:ä|a)ht(?:ä|a)vill(?:ä|a)|n(?:ä|a)ht(?:ä|a)v(?:ä|a)n(?:ä|a)|asiakasp(?:ä|a)(?:ä|a)ttei|kuulutus|osallistumis- ja arviointisuunnitelma|mielipite|muistutus/i

/* Hankesisalto: kertoo mita alueelle tulee. */
const SISALTO =
  /rakennusoikeu|kerrosala|k-m2|k-m²|asunto|kerrostalo|rivitalo|teollisuus|toimitila|liikerakenn|hoiva|koulu|p(?:ä|a)iv(?:ä|a)koti|tavoitteena|tarkoituksena|mahdollista(?:a|an)|pinta-ala|hehtaar|\bha\b/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(t).select(cols).range(from, from + 999)
      if (error) throw error
      out.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return out
  }

  const pp: any[] = await kaikki("potential_projects", "id, title, status, metadata")
  const pr: any[] = await kaikki("projects", "id, name, status, is_public, metadata, additional_info")

  type Rivi = { n: number; ohut: number; menettely: number; pituudet: number[] }
  const lahteet = new Map<string, Rivi>()

  const lisaa = (lahde: string, kuvaus: string) => {
    const r = lahteet.get(lahde) ?? { n: 0, ohut: 0, menettely: 0, pituudet: [] }
    r.n++
    r.pituudet.push(kuvaus.length)
    if (kuvaus.length < 120) r.ohut++
    else if (MENETTELY.test(kuvaus) && !SISALTO.test(kuvaus)) r.menettely++
    lahteet.set(lahde, r)
  }

  /* Kaavalahde tunnistetaan vaiheesta tai lahteen nimesta. */
  const onKaava = (md: any, otsikko: string) =>
    /kaava/i.test(String(md?.source_name ?? "")) ||
    /kaava/i.test(String(md?.phase_hint ?? "")) ||
    /asemakaava|yleiskaava|kaavamuutos/i.test(otsikko)

  for (const p of pp) {
    const md = p.metadata ?? {}
    if (!onKaava(md, String(p.title))) continue
    lisaa(String(md.source_name ?? "-"), String(md.description ?? md.operation ?? ""))
  }
  for (const p of pr) {
    const md = p.metadata ?? {}
    if (!onKaava(md, String(p.name))) continue
    lisaa(String(md.source_name ?? "-"), String(p.additional_info ?? md.description ?? ""))
  }

  const rivit = [...lahteet].map(([nimi, r]) => {
    const jarj = [...r.pituudet].sort((a, b) => a - b)
    return {
      nimi,
      n: r.n,
      huono: r.ohut + r.menettely,
      ohut: r.ohut,
      menettely: r.menettely,
      mediaani: jarj[Math.floor(jarj.length / 2)] ?? 0,
    }
  })

  const yhteensa = rivit.reduce((s, r) => s + r.n, 0)
  const huonoja = rivit.reduce((s, r) => s + r.huono, 0)
  console.log(`kaavarivejä ${yhteensa}, joilla kuvaus ohut tai pelkkää menettelyä: ${huonoja} (${((huonoja / yhteensa) * 100).toFixed(0)} %)\n`)

  console.log("   n  huono   ohut  menett.  med.  lähde")
  for (const r of rivit.sort((a, b) => b.huono - a.huono).slice(0, 25)) {
    console.log(
      `${String(r.n).padStart(4)} ${String(r.huono).padStart(6)} ${String(r.ohut).padStart(6)} ${String(r.menettely).padStart(8)} ${String(r.mediaani).padStart(5)}  ${r.nimi}`
    )
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
