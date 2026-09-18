import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RAKENNUTTAJAKENTTAAN KERTYNEET LISTAT (D-197).
 *
 * Osa 1 - STT: rivit joiden nykyinen rakennuttaja on VANHAN saannon
 * tuotos ("kolme ensimmaista yhtionimea"), lasketaan uudelleen uudella
 * saannolla. Rakentaja taytetaan vain tyhjaan kenttaan.
 *
 * Osa 2 - kasin luetut sekalistat, joissa rakentaja on rakennuttajan
 * seassa. Jokainen rivi luettu 19.9.2026; poistettava nimi siirtyy
 * liittyviin yrityksiin, jottei osapuolitieto katoa.
 *
 *   npx tsx scripts/fix-rakennuttajalistat.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-rakennuttajalistat.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const COMPANY_NAME = /\b([A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*)*\s+(?:Oy|Oyj|Ab|Ky|Ltd))\b/g
function vanhaSaanto(title: string, description: string): string | null {
  const found = new Map<string, string>()
  for (const m of `${title} ${description}`.matchAll(COMPANY_NAME)) {
    const n = m[1].replace(/:n$/i, "").trim()
    if (n.length >= 4) found.set(n.toLowerCase(), n)
  }
  const names = [...found.values()].slice(0, 3)
  return names.length ? names.join(", ") : null
}

type Kasin = { nimi: string; nykyinen: string; developer: string | null; builder?: string; liittyvat: string[]; miksi: string }
const KASIN: Kasin[] = [
  { nimi: "Oulun elämysareena", nykyinen: "Oulun kaupunki, SRV ja Trevian", developer: "Oulun kaupunki", liittyvat: ["SRV", "Trevian"], miksi: "rakentaja Raksila 2.0 = SRV + Trevian" },
  { nimi: "Linnakaupungin monitoimitalo", nykyinen: "Hartela, Turun kaupunki ja Lukkaroinen Arkkitehdit", developer: "Turun kaupunki", liittyvat: ["Lukkaroinen Arkkitehdit"], miksi: "rakentaja Hartela, arkkitehti" },
  { nimi: "Oulun yliopistollisen sairaalan C-rakennus", nykyinen: "Allianssiurakkana NCC:n ja Pohde", developer: "Pohde", liittyvat: [], miksi: "NCC allianssin rakentaja (builder)" },
  { nimi: "Datakeskus Kajaaniin", nykyinen: "SRV ja CSC – Tieteen tietotekniikan keskus Oy", developer: "CSC – Tieteen tietotekniikan keskus Oy", builder: "SRV", liittyvat: [], miksi: "SRV rakentaja" },
]
/* KSBR tiedottaa omista urakoistaan ("KSBR on ... uusi paaurakoitsija"). */
const KSBR = "KSBR, Keski-Suomen Betonirakenne Oy"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { resolveParties } = await import("../lib/agent/fetchSttHakuSource")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const muutokset: { taulu: string; r: any; developer: string | null; builder: string | null; liittyvat: string[]; syy: string }[] = []

  for (const taulu of ["projects", "potential_projects"] as const) {
    const cols = taulu === "projects" ? "id, name, developer, builder, metadata" : "id, title, status, metadata"
    const rivit: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(taulu).select(cols).range(from, from + 999)
      if (error) throw error
      rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    for (const r of rivit) {
      const m = r.metadata ?? {}
      const nimi = String(r.name ?? r.title ?? "")
      const dev = String(r.developer ?? m.developer ?? "").trim()
      const builderNyt = String(r.builder ?? m.builder ?? "").trim()
      if (!dev) continue

      const k = KASIN.find((x) => x.nimi === nimi && x.nykyinen === dev)
      if (k) {
        muutokset.push({ taulu, r, developer: k.developer, builder: !builderNyt && k.builder ? k.builder : null, liittyvat: k.liittyvat, syy: `käsin: ${k.miksi}` })
        continue
      }
      if (dev === KSBR) {
        muutokset.push({ taulu, r, developer: null, builder: builderNyt ? null : "KSBR", liittyvat: [], syy: "KSBR on urakoitsija omissa tiedotteissaan" })
        continue
      }
      if (m.source_name !== "stt_haku") continue
      const desc = String(m.description ?? "")
      if (vanhaSaanto(nimi, desc) !== dev) continue
      const uusi = resolveParties(null, nimi, desc)
      if (uusi.developer === dev) continue
      muutokset.push({ taulu, r, developer: uusi.developer, builder: !builderNyt && uusi.builder ? uusi.builder : null, liittyvat: [], syy: "STT: uusi sääntö" })
    }
  }

  for (const x of muutokset) {
    const nimi = String(x.r.name ?? x.r.title).slice(0, 60)
    const dev = x.r.developer ?? x.r.metadata?.developer
    console.log(`${x.taulu} ${x.r.status ?? ""} | ${nimi}\n    rakennuttaja: ${dev} -> ${x.developer ?? "(tyhjä)"}` +
      (x.builder ? `\n    rakentaja (tyhjä) -> ${x.builder}` : "") +
      (x.liittyvat.length ? `\n    liittyviin: ${x.liittyvat.join(", ")}` : "") + `\n    (${x.syy})`)
    if (!APPLY) continue
    const m = x.r.metadata ?? {}
    const metadata = {
      ...m,
      developer: x.developer,
      ...(x.builder ? { builder: x.builder } : {}),
      ...(x.liittyvat.length ? { related_companies: mergeCompanyNames(m.related_companies ?? [], x.liittyvat) } : {}),
    }
    const paivitys = x.taulu === "projects"
      ? { metadata, developer: x.developer, ...(x.builder ? { builder: x.builder } : {}) }
      : { metadata }
    const { error } = await db.from(x.taulu).update(paivitys).eq("id", x.r.id)
    if (error) throw error
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${muutokset.length} riviä ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
