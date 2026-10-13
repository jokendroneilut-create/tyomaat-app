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
 * KAHDEN KUSTANNUSARVION KORJAUS (D-275).
 *
 * Yhdeksan hintaa 930:sta oli ristiriidassa oman kuvauksensa kanssa.
 * Lahdelauseiden lukeminen osoitti, etta seitsemassa KANTA ON OIKEASSA
 * ja poimija vaarassa:
 *
 *   Turun raitiotie    465 M€ (koko hanke) vs 33 M€ (1. vaihe)
 *   Vantaan ratikka    280 M€ (itaosa, = tama hanke) vs 750 M€ (koko)
 *   Pysakointilaitos   15,5 M€ (tama urakka) vs 210 M€ (koko Hippos)
 *   Vetylaitos         2 000 M€ vs 150 M€ (= investointiTUKI)
 *   Postipuun koulu    32 M€ vs 75 k€ (= siirtokelpoisen vuokra/vuosi)
 *   Kuusankoski        16 M€ (kattohinta) vs 17,8 M€ (kokonaisarvio)
 *   Peijas             59 M€ (tavoitebudjetti) vs 74 M€ (kokonaisarvio)
 *
 * Kaksi on aitoa virhetta: tuhatkerroin on jaanyt poimimatta. Ne
 * korjataan NIMELTA, ei saannolla.
 *
 *   npx tsx scripts/korjaa-kustannusarviot.ts
 *   npx tsx scripts/korjaa-kustannusarviot.ts --apply
 */

const KORJAUKSET = [
  {
    id: "9e632236",
    nimi: "Kerrostalo opiskelija-asuntosäätiölle",
    vanha: 15_000,
    uusi: 15_000_000,
    peruste: "Sopimuksen arvo YIT:lle on noin 15 miljoonaa euroa",
  },
  {
    id: "f2b3abb7",
    nimi: "FIN04A Datakeskus",
    vanha: 130_000,
    uusi: 130_000_000,
    peruste: "Sopimuksen arvo on 130 miljoonaa euroa",
  },
]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; f < 60000; f += 500) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, estimated_cost, additional_info, metadata")
      .range(f, f + 499)
    if (error) throw error
    if (!data?.length) break
    rivit.push(...data)
    if (data.length < 500) break
  }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  for (const k of KORJAUKSET) {
    const osumat = rivit.filter((r) => String(r.id).startsWith(k.id))
    if (osumat.length !== 1) {
      console.log(`  OHITETTU ${k.id}: ${osumat.length} osumaa`)
      continue
    }
    const r = osumat[0]
    const nyt = Number(r.estimated_cost)
    if (nyt !== k.vanha) {
      console.log(
        `  OHITETTU ${k.id} (${r.name}): kannassa ${nyt}, odotettiin ${k.vanha} — joku on jo muuttanut`
      )
      continue
    }
    /* Peruste on oltava yha kuvauksessa; muuten korjaus ei pade. */
    if (!String(r.additional_info ?? "").includes(k.peruste)) {
      console.log(`  OHITETTU ${k.id}: perustelauseetta ei loydy kuvauksesta`)
      continue
    }

    console.log(
      `  ${String(r.name).slice(0, 46).padEnd(48)} ${(k.vanha / 1000).toFixed(0)} k€ -> ${(k.uusi / 1e6).toFixed(0)} M€`
    )
    console.log(`     "${k.peruste}"`)

    if (!apply) continue

    const { error } = await db
      .from("projects")
      .update({
        estimated_cost: k.uusi,
        metadata: {
          ...(r.metadata ?? {}),
          cost_source: "text",
          cost_corrected_at: new Date().toISOString(),
          cost_corrected_from: k.vanha,
        },
      })
      .eq("id", r.id)
    console.log(error ? `     VIRHE: ${error.message}` : "     TEHTY")
  }

  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
