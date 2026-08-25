import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PAATTYNEET LUJATALON REFERENSSIKOHTEET OIKEAAN VAIHEESEEN.
 *
 * Listasivu merkitsi kohteen kaynnissa olevaksi, mutta kohdesivulla lukee
 * "Rakentamisen aikataulu 2019 - 2021". Valmis kohde tuli jonoon
 * rakenteilla olevana.
 *
 * Kerooja lukee aikataulun nyt itse, mutta jo kannassa olevia se ei
 * korjaa - fact-tyolainen kasittelee dokumentin vain kerran.
 *
 * VAIN LISAYS metadataan: olemassa olevat avaimet sailyvat.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

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

  const nyt = new Date().getUTCFullYear()
  const odota = (ms: number) => new Promise((r) => setTimeout(r, ms))
  const paivitykset: any[] = []

  for (const p of rivit) {
    const r = await fetch(String(p.metadata.source_url), { headers: { "User-Agent": UA } })
    await odota(400)
    if (!r.ok) continue

    const $ = cheerio.load(await r.text())
    $("script, style, noscript").remove()

    let teksti: string | null = null
    $("h3").each((_, el) => {
      if ($(el).text().replace(/\s+/g, " ").trim().toLowerCase() === "rakentamisen aikataulu") {
        teksti = $(el).next("p").text().trim()
      }
    })

    const a = parseLujataloSchedule(teksti)
    if (!a || a.end >= nyt) continue

    paivitykset.push({
      taulu: p.taulu,
      id: p.id,
      nimi: p.nimi,
      teksti,
      loppu: `${a.end}-12-31`,
      vanhaVaihe: p.phase ?? p.metadata?.phase_hint ?? null,
    })
  }

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`tarkistettu: ${rivit.length}   korjattavia: ${paivitykset.length}\n`)
  for (const u of paivitykset) {
    console.log(`  ${u.taulu === "projects" ? "NAKYVA" : "jono  "}  ${String(u.nimi).slice(0, 40).padEnd(42)} ${u.teksti}`)
    console.log(`      vaihe ${u.vanhaVaihe} -> Valmistunut,  valmistuminen -> ${u.loppu}`)
  }

  if (!APPLY) { console.log("\n(kuivaharjoitus — aja --apply)"); return }

  let n = 0
  for (const u of paivitykset) {
    const { data: nyky } = await supabase.from(u.taulu).select("metadata").eq("id", u.id).maybeSingle()
    const meta: any = nyky?.metadata ?? {}

    const paivitys: any = {
      metadata: {
        ...meta,
        phase_hint: "Valmistunut",
        estimated_completion: u.loppu,
        rakentamisen_aikataulu: u.teksti,
      },
    }
    /* projects-taulussa vaihe on oma sarakkeensa. */
    if (u.taulu === "projects") {
      paivitys.phase = "Valmistunut"
      paivitys.estimated_completion = u.loppu
    }

    await supabase.from(u.taulu).update(paivitys).eq("id", u.id)
    n++
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
