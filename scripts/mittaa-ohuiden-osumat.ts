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
 * OSUVATKO ASIAKKAAT OHUISIIN KUVAUKSIIN? (D-269)
 *
 * Tama mittari ratkaisee kannattaako kuvaustyota jatkaa. Kannassa
 * olevien ohuiden rivien MAARA ei kerro sita — vasta se, mihin
 * asiakkaan avaukset osuvat.
 *
 * Mitattu 11.10.2026: 490 avausta 2 467:sta osui ohueen hankkeeseen
 * (19,9 %), eli tasan samassa suhteessa kuin ohuita on kannassa
 * (19,7 %) — asiakkaat eivat vaista niita. Mutta puolet osumista tuli
 * kasin lisatyista riveista ja neljannes Hilmasta, eika kumpikaan
 * korjaannu kaavalahteita kaymalla lapi.
 *
 * KANNATTAAKO JATKAA? Kaksi kysymysta, ei mielipidetta:
 *   1. Osuvatko asiakkaat ohuisiin riveihin vai eivat?
 *   2. Syntyyko ohuita rivia lisaa, ja mista?
 * Ei kirjoita mitaan.
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Hankkeet: pituus ja lahde. */
  const pituus = new Map<string, number>()
  const lahde = new Map<string, string>()
  const luotu = new Map<string, string>()
  const SIVU = 500
  for (let f = 0; f < 60000; f += SIVU) {
    const { data, error } = await db
      .from("projects")
      .select("id, additional_info, created_at, metadata")
      .range(f, f + SIVU - 1)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as any[]) {
      pituus.set(String(r.id), String(r.additional_info ?? "").trim().length)
      lahde.set(String(r.id), String((r.metadata ?? {}).source_name ?? "(ei lahdetta)"))
      luotu.set(String(r.id), String(r.created_at ?? ""))
    }
    if (data.length < SIVU) break
  }
  console.log(`hankkeita ${pituus.size}`)

  /* 1. Avaukset. */
  const avaukset: string[] = []
  for (let f = 0; f < 200000; f += 1000) {
    const { data, error } = await db
      .from("analytics_events")
      .select("project_id, event_type")
      .eq("event_type", "project_open")
      .range(f, f + 999)
    if (error) throw error
    if (!data?.length) break
    for (const e of data as any[]) if (e.project_id) avaukset.push(String(e.project_id))
    if (data.length < 1000) break
  }

  const tunnetut = avaukset.filter((id) => pituus.has(id))
  const ohuetAvaukset = tunnetut.filter((id) => (pituus.get(id) ?? 0) < 200)
  const kaikkiOhuet = [...pituus.values()].filter((p) => p < 200).length

  console.log(`\n1. OSUVATKO ASIAKKAAT OHUISIIN?`)
  console.log(`   avauksia ${avaukset.length}, joista tunnistettuun hankkeeseen ${tunnetut.length}`)
  console.log(
    `   avauksista ohueen hankkeeseen: ${ohuetAvaukset.length} (${((100 * ohuetAvaukset.length) / Math.max(1, tunnetut.length)).toFixed(1)} %)`
  )
  console.log(
    `   vertailu: ohuita hankkeita kannassa ${kaikkiOhuet} / ${pituus.size} (${((100 * kaikkiOhuet) / pituus.size).toFixed(1)} %)`
  )

  /* Avatut hankkeet kertaalleen: kuinka moni eri hanke on ohut. */
  const eriAvatut = new Set(tunnetut)
  const eriOhuet = [...eriAvatut].filter((id) => (pituus.get(id) ?? 0) < 200)
  console.log(
    `   eri hankkeita avattu ${eriAvatut.size}, niista ohuita ${eriOhuet.length} (${((100 * eriOhuet.length) / Math.max(1, eriAvatut.size)).toFixed(1)} %)`
  )

  console.log("   ohuet avaukset lahteittain:")
  const osumaLahde = new Map<string, number>()
  for (const id of ohuetAvaukset) {
    const l = lahde.get(id) ?? "?"
    osumaLahde.set(l, (osumaLahde.get(l) ?? 0) + 1)
  }
  for (const [l, n] of [...osumaLahde.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`     ${String(n).padStart(4)}  ${l}`)
  }

  /* 2. Virtaus: viimeiset 30 ja 90 vrk. */
  const nyt = Date.now()
  for (const vrk of [30, 90]) {
    const raja = nyt - vrk * 24 * 3600 * 1000
    const uudet = [...pituus.keys()].filter((id) => new Date(luotu.get(id) ?? 0).getTime() >= raja)
    const uudetOhuet = uudet.filter((id) => (pituus.get(id) ?? 0) < 200)
    console.log(
      `\n2. VIRTAUS ${vrk} vrk: uusia hankkeita ${uudet.length}, niista ohuita ${uudetOhuet.length} (${((100 * uudetOhuet.length) / Math.max(1, uudet.length)).toFixed(0)} %)`
    )
    if (vrk === 90) {
      const per = new Map<string, number>()
      for (const id of uudetOhuet) per.set(lahde.get(id) ?? "?", (per.get(lahde.get(id) ?? "?") ?? 0) + 1)
      for (const [l, n] of [...per.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
        console.log(`     ${String(n).padStart(3)}  ${l}`)
      }
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
