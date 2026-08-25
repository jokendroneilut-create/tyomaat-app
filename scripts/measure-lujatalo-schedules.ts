import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: kuinka moni Lujatalon referenssikohde on jo valmistunut?
 *
 * Listasivu merkitsee kohteen kaynnissa olevaksi, mutta merkinta voi olla
 * vanhentunut. "Varkauden Sote-keskus" tuli jonoon rakenteilla olevana
 * vaikka kohdesivulla lukee "Rakentamisen aikataulu 2019 - 2021".
 *
 * Haetaan kohdesivut ja luetaan aikataulu. Lahde on yrityksen oma
 * julkinen sivusto, ja pyynnot tahdistetaan.
 *
 * Ei kirjoita mitaan.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const DELAY_MS = 400

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { parseLujataloSchedule } = await import("../lib/agent/fetchLujataloProjectsSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const lataa = async (t: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  const rivit = [
    ...(await lataa("potential_projects")).map((p: any) => ({ ...p, taulu: "potential_projects", nimi: p.title })),
    ...(await lataa("projects")).map((p: any) => ({ ...p, taulu: "projects", nimi: p.name })),
  ].filter(
    (p: any) =>
      /luja/i.test(String(p.metadata?.source_name ?? "")) &&
      String(p.metadata?.source_url ?? "").includes("/referenssit/") &&
      p.status !== "rejected" && p.status !== "ignored"
  )

  console.log(`Lujatalon referenssikohteita (ei hylattyja): ${rivit.length}\n`)

  const odota = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const nyt = new Date().getUTCFullYear()

  let haettu = 0, aikatauluja = 0, menneita = 0, eiSaatu = 0
  const menneet: string[] = []

  for (const p of rivit) {
    try {
      const r = await fetch(String(p.metadata.source_url), { headers: { "User-Agent": UA } })
      await odota(DELAY_MS)
      haettu++
      if (!r.ok) { eiSaatu++; continue }

      const $ = cheerio.load(await r.text())
      $("script, style, noscript").remove()

      let teksti: string | null = null
      $("h3").each((_, el) => {
        const label = $(el).text().replace(/\s+/g, " ").trim().toLowerCase()
        if (label === "rakentamisen aikataulu") teksti = $(el).next("p").text().trim()
      })

      const a = parseLujataloSchedule(teksti)
      if (!a) continue
      aikatauluja++
      if (a.end >= nyt) continue

      menneita++
      menneet.push(`  ${p.taulu === "projects" ? "NAKYVA" : "jono  "}  ${String(p.nimi).slice(0, 38).padEnd(40)} ${teksti}   vaihe: ${p.phase ?? p.metadata?.phase_hint ?? "-"}`)
    } catch {
      eiSaatu++
    }
  }

  console.log(`haettu: ${haettu}   ei saatu: ${eiSaatu}`)
  console.log(`  aikataulu loytyi:        ${aikatauluja}`)
  console.log(`  PAATTYNYT jo aiemmin:    ${menneita}\n`)
  for (const m of menneet) console.log(m)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
