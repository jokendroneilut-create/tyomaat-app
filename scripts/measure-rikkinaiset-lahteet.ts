import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RIKKINAISET LAHTEET: MIKA JA MIKSI.
 *
 * Health-sivun sääntö (`lahteenTila.onRikki`): lahde on kaytossa ja sen
 * viimeisin tapahtuma on virhe, joka on alle viikon vanha. Lippu putoaa
 * vasta onnistuneesta ajosta.
 *
 * Tama tulostaa samat rivit kuin sivu, mutta lisaksi sen mita sivu ei
 * nayta: milloin lahde viimeksi onnistui, kuinka kauan se on ollut
 * rikki, ja mita se on tuonut. Ilman niita ei voi erottaa "hetken
 * nikottelua" ja "kuollutta lahdetta".
 *
 *   npx tsx scripts/measure-rikkinaiset-lahteet.ts
 */

function ika(aika: string | null, nyt: number): string {
  if (!aika) return "-"
  const vrk = Math.floor((nyt - new Date(aika).getTime()) / 86_400_000)
  if (vrk === 0) return "tänään"
  return `${vrk} vrk sitten`
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { onRikki } = await import("../lib/agent/discovery/lahteenTila")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: lahteet, error } = await db.from("discovery_sources").select("*")
  if (error) throw error

  const nyt = Date.now()
  const kaytossa = (lahteet ?? []).filter((s: any) => s.enabled)
  const rikki = (lahteet ?? [])
    .filter((s: any) => onRikki(s, nyt))
    .sort((a: any, b: any) =>
      String(b.last_error_at ?? "").localeCompare(String(a.last_error_at ?? ""))
    )

  console.log(`lahteita ${lahteet?.length ?? 0}, kaytossa ${kaytossa.length}, RIKKI ${rikki.length}\n`)

  for (const s of rikki) {
    console.log("=".repeat(100))
    console.log(`${s.name}`)
    console.log(`  id              ${s.id}`)
    console.log(`  tyyppi          ${s.type ?? "-"} | prioriteetti ${s.priority ?? "-"}`)
    console.log(`  url             ${s.url ?? s.endpoint ?? "-"}`)
    console.log(`  virhe           ${ika(s.last_error_at, nyt)} (${String(s.last_error_at ?? "-").slice(0, 19).replace("T", " ")})`)
    console.log(`  onnistui        ${ika(s.last_success_at, nyt)} (${String(s.last_success_at ?? "-").slice(0, 19).replace("T", " ")})`)
    console.log(`  viesti          ${String(s.last_error_message ?? "(ei viestia)").replace(/\s+/g, " ").slice(0, 200)}`)

    /* Mita lahde on tuonut: kuollut lahde ei ole sama kuin nikotteleva. */
    const { count: dokumentteja } = await db
      .from("source_documents")
      .select("id", { count: "exact", head: true })
      .eq("source_id", s.id)

    const { data: tuorein } = await db
      .from("source_documents")
      .select("created_at")
      .eq("source_id", s.id)
      .order("created_at", { ascending: false })
      .limit(1)

    console.log(`  dokumentteja    ${dokumentteja ?? 0}, tuorein ${ika(tuorein?.[0]?.created_at ?? null, nyt)}`)

    /* Ajohistoria kertoo onko vika pysyva vai satunnainen. */
    const { data: ajot } = await db
      .from("discovery_runs")
      .select("status, started_at, error_message")
      .eq("source_id", s.id)
      .order("started_at", { ascending: false })
      .limit(8)

    if (ajot?.length) {
      const onnistui = ajot.filter((a: any) => a.status !== "error").length
      console.log(`  8 viime ajoa    ${onnistui} onnistui, ${ajot.length - onnistui} kaatui`)
      for (const a of ajot.slice(0, 4)) {
        console.log(
          `     ${String(a.started_at).slice(0, 16).replace("T", " ")}  ${String(a.status).padEnd(8)} ${String(
            a.error_message ?? ""
          ).replace(/\s+/g, " ").slice(0, 70)}`
        )
      }
    } else {
      console.log(`  8 viime ajoa    (ei ajohistoriaa)`)
    }
    console.log()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
