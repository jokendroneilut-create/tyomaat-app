import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUVAUSTEN PITUUSJAKAUMA (D-269). Ei kirjoita mitaan.
 *
 * Mittaa SEN KENTAN jonka asiakas lukee: hankkeilla `additional_info`
 * ("Lisatietoja"), ehdokkailla `metadata.description`. Nama ovat eri
 * kenttia, ja vain edellinen nakyy hankenakymassa (D-270).
 *
 * Jakauma eika keskiarvo: keskiarvo piilottaa hannan, ja hanta on juuri
 * se mika asiakkaalle nakyy.
 *
 *   npx tsx scripts/mittaa-kuvausten-pituus.ts
 *   npx tsx scripts/mittaa-kuvausten-pituus.ts --ehdokkaat
 */

const RAJAT = [0, 40, 100, 200, 400, 800, Infinity]

function lokero(n: number): string {
  for (let i = 0; i < RAJAT.length - 1; i++) {
    if (n >= RAJAT[i] && n < RAJAT[i + 1]) return nimi(i)
  }
  return "?"
}

function nimi(i: number): string {
  return `${RAJAT[i]}-${RAJAT[i + 1] === Infinity ? "" : RAJAT[i + 1]}`.padStart(9)
}

async function main() {
  const ehdokkaat = process.argv.includes("--ehdokkaat")
  const taulu = ehdokkaat ? "potential_projects" : "projects"
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: { lahde: string; pituus: number }[] = []
  /* Vain tarvittavat sarakkeet ja pienempi sivu: metadata on raskas. */
  const SIVU = 500
  for (let f = 0; f < 60000; f += SIVU) {
    const { data, error } = await db
      .from(taulu)
      .select(ehdokkaat ? "metadata" : "additional_info, metadata")
      .range(f, f + SIVU - 1)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as any[]) {
      const md = r.metadata ?? {}
      const teksti = ehdokkaat
        ? String(md.description ?? "")
        : String(r.additional_info ?? "")
      rivit.push({
        lahde: String(md.source_name ?? md.source ?? "(ei lahdetta)"),
        pituus: teksti.trim().length,
      })
    }
    if (data.length < SIVU) break
  }

  console.log(
    `${taulu}: ${rivit.length} rivia, kentta ${ehdokkaat ? "metadata.description" : "additional_info"}\n`
  )

  const laskuri = new Map<string, number>()
  for (const r of rivit) laskuri.set(lokero(r.pituus), (laskuri.get(lokero(r.pituus)) ?? 0) + 1)
  for (let i = 0; i < RAJAT.length - 1; i++) {
    const avain = nimi(i)
    const n = laskuri.get(avain) ?? 0
    const osuus = Math.round((100 * n) / rivit.length)
    console.log(
      `  ${avain} merkkia ${String(n).padStart(5)}  ${String(osuus).padStart(3)} %  ${"#".repeat(Math.round(osuus / 2))}`
    )
  }
  const jarj = [...rivit].sort((a, b) => a.pituus - b.pituus)
  console.log(`  mediaani ${jarj[Math.floor(jarj.length / 2)]?.pituus ?? 0} merkkia`)
  const alle200 = rivit.filter((r) => r.pituus < 200).length
  console.log(
    `  alle 200 merkkia: ${alle200} (${Math.round((100 * alle200) / rivit.length)} %)\n`
  )

  console.log("ALLE 200 MERKKIA, LAHTEITTAIN (20 suurinta):")
  const ohuet = new Map<string, { alle40: number; alle200: number; yht: number }>()
  for (const r of rivit) {
    const o = ohuet.get(r.lahde) ?? { alle40: 0, alle200: 0, yht: 0 }
    o.yht += 1
    if (r.pituus < 40) o.alle40 += 1
    else if (r.pituus < 200) o.alle200 += 1
    ohuet.set(r.lahde, o)
  }
  const jono = [...ohuet.entries()]
    .map(([lahde, o]) => ({ lahde, ...o, ohut: o.alle40 + o.alle200 }))
    .filter((o) => o.ohut > 0)
    .sort((a, b) => b.ohut - a.ohut)
  console.log("  ohut  (alle40)  kaikki  lahde")
  for (const o of jono.slice(0, 20)) {
    console.log(
      `  ${String(o.ohut).padStart(4)}  ${String(o.alle40).padStart(7)}  ${String(o.yht).padStart(6)}  ${o.lahde}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
