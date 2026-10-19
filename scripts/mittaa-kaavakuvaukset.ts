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
 * KAAVARIVIEN KUVAUSTEN MITTAUS LAHTEITTAIN (D-318).
 *
 * Salon kytkennan (D-317) jalkeen Johannes: *"kay muiden kuntien
 * kaavakeraajat myos lapi."* Kaavajasentimia on 241 ja jokainen on
 * omanlaisensa, joten kytkennan paikka valitaan mittaamalla eika
 * aakkosjarjestyksessa: mika lahde tuottaa paljon rivejä joiden kuvaus
 * on ohut?
 *
 * MITTA ON SE KENTTA JONKA ASIAKAS LUKEE (muisti:
 * measure-the-field-the-user-reads): hankkeella `additional_info`,
 * jonorivilla `metadata.description`.
 *
 * Tulostaa myos sivuosoitteen, koska taydennys on mahdollinen vain jos
 * rivilla on osoite josta liitteet loytyvat.
 *
 *   npx tsx scripts/mittaa-kaavakuvaukset.ts
 *   npx tsx scripts/mittaa-kaavakuvaukset.ts --raja 300
 */

const OHUT = Number(process.argv[process.argv.indexOf("--raja") + 1]) || 300

type Rivi = { lahde: string; pituus: number; sivu: boolean }

function mediaani(luvut: number[]): number {
  if (!luvut.length) return 0
  const j = [...luvut].sort((a, b) => a - b)
  return j[Math.floor(j.length / 2)]
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: Rivi[] = []
  for (const taulu of ["potential_projects", "projects"] as const) {
    const sarakkeet =
      taulu === "projects" ? "id, name, status, additional_info, metadata" : "id, title, status, metadata"
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(taulu).select(sarakkeet).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      for (const r of (data ?? []) as any[]) {
        const md: Record<string, any> = r.metadata ?? {}
        const resolver = String(md.resolver ?? "")
        const lahde = String(md.source_name ?? md.source ?? "(tuntematon)")
        /* Kaavarivi tunnistuu resolverista tai lahteen nimesta. */
        const onKaava = /kaavaresolver/i.test(resolver) || /kaava|asemakaav|yleiskaav/i.test(lahde)
        if (!onKaava) continue
        rivit.push({
          lahde,
          pituus: String(r.additional_info ?? md.description ?? "").length,
          sivu: Boolean(md.documents_url ?? md.source_url ?? md.paatos_url),
        })
      }
      if ((data ?? []).length < 1000) break
    }
  }

  const lahteet = new Map<string, Rivi[]>()
  for (const r of rivit) lahteet.set(r.lahde, [...(lahteet.get(r.lahde) ?? []), r])

  const yhteenveto = [...lahteet.entries()]
    .map(([lahde, rs]) => ({
      lahde,
      rivit: rs.length,
      ohuet: rs.filter((r) => r.pituus < OHUT).length,
      mediaani: mediaani(rs.map((r) => r.pituus)),
      sivulla: rs.filter((r) => r.sivu).length,
    }))
    /* Tyojarjestys: eniten ohuita rivejä, joilla on sivuosoite. */
    .sort((a, b) => b.ohuet - a.ohuet)

  console.log(`Kaavarivejä yhteensä ${rivit.length}, ohuita (<${OHUT} merkkiä) ${rivit.filter((r) => r.pituus < OHUT).length}\n`)
  console.log("ohuet  rivit  med.pit  sivuosoite  lähde")
  for (const y of yhteenveto.slice(0, 40)) {
    if (!y.ohuet) continue
    console.log(
      `${String(y.ohuet).padStart(5)}  ${String(y.rivit).padStart(5)}  ${String(y.mediaani).padStart(7)}  ${String(y.sivulla).padStart(10)}  ${y.lahde.slice(0, 50)}`
    )
  }

  const ohuetYht = yhteenveto.reduce((s, y) => s + y.ohuet, 0)
  const kymmenen = yhteenveto.slice(0, 10).reduce((s, y) => s + y.ohuet, 0)
  console.log(
    `\nLähteitä ${yhteenveto.length}; kymmenen suurinta kattaa ${kymmenen}/${ohuetYht} ohutta riviä (${Math.round((kymmenen / Math.max(1, ohuetYht)) * 100)} %)`
  )
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
