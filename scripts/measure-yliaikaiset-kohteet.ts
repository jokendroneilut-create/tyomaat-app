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
 * YLIAIKAISTEN TYOLISTA KASIN TARKISTETTAVAKSI (D-220, signaali 1).
 *
 * Kvartaalitarkistus jattaa 12 hanketta, joilla arvioitu
 * valmistumispaiva on mennyt mutta automatiikka ei siirra niita.
 * Naille ei ole valmistumistodistetta kannassa, joten jokainen vaatii
 * lahteen lukemisen. Tama tulostaa kaiken mita meilla niista on, jottei
 * tarkistusta tehda pelkan otsikon varassa.
 *
 *   npx tsx scripts/measure-yliaikaiset-kohteet.ts
 */

const RAKENTEILLA = /rakenteilla|rakentaminen aloitettu|sopimus myonnetty|sopimus myönnetty|valmistumassa/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { evaluateAutoComplete } = await import("../lib/projects/autoCompleteGate")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("*")
      .eq("status", "active")
      .order("id")
      .range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const nyt = new Date()
  const tanaan = nyt.toISOString().slice(0, 10)

  const kohteet = hankkeet
    .filter((p) => p.is_public && RAKENTEILLA.test(String(p.phase)))
    .filter((p) => p.estimated_completion && String(p.estimated_completion).slice(0, 10) < tanaan)
    .map((p) => ({
      p,
      verdikti: evaluateAutoComplete({
        estimatedCompletion: p.estimated_completion,
        createdAt: p.created_at,
        lastSeenAt: p.metadata?.last_seen_at ?? null,
        phase: p.phase,
        now: nyt,
      }),
      vrk: Math.floor((nyt.getTime() - new Date(String(p.estimated_completion).slice(0, 10)).getTime()) / 86_400_000),
    }))
    .filter((r) => r.verdikti !== "wait")
    .sort((a, b) => b.vrk - a.vrk)

  console.log(`YLIAIKAISIA, AUTOMATIIKKA OHITTAA: ${kohteet.length}\n`)

  for (const { p, vrk } of kohteet) {
    console.log("=".repeat(100))
    console.log(`${String(p.name).replace(/​/g, "")}`)
    console.log(`  id              ${p.id}`)
    console.log(`  paikka          ${p.city ?? "-"} / ${p.region ?? "-"}`)
    console.log(`  vaihe           ${p.phase}   (yliaikaa ${vrk} vrk)`)
    console.log(`  arvio valmis    ${String(p.estimated_completion ?? "-").slice(0, 10)}`)
    console.log(`  aloitus         ${String(p.construction_start ?? "-").slice(0, 10)}`)
    console.log(`  loytohetki      ${String(p.created_at ?? "-").slice(0, 10)}`)
    console.log(`  rakentaja       ${p.builder ?? "-"}`)
    console.log(`  rakennuttaja    ${p.developer ?? "-"}`)
    console.log(`  kustannusarvio  ${p.estimated_cost ?? "-"}`)
    console.log(`  lahde           ${p.metadata?.source_name ?? "-"}`)
    console.log(`  lahteen url     ${p.metadata?.source_url ?? "-"}`)
    console.log(`  nahty viimeksi  ${String(p.metadata?.last_seen_at ?? "-").slice(0, 10)}`)
    console.log(`  kuvaus          ${String(p.description ?? "-").replace(/\s+/g, " ").slice(0, 700)}`)

    /* Kannan dokumentit tasta hankkeesta: mita lahde on viimeksi sanonut. */
    const url = String(p.metadata?.source_url ?? "")
    if (url) {
      const { data: dokit } = await db
        .from("source_documents")
        .select("title, published_at, created_at")
        .eq("document_url", url)
        .limit(5)
      for (const d of dokit ?? []) {
        console.log(`  DOKU            ${String(d.published_at ?? d.created_at).slice(0, 10)}  ${String(d.title).slice(0, 76)}`)
      }
    }

    const { data: historia } = await db
      .from("project_phase_history")
      .select("phase, previous_phase, source, source_name, created_at")
      .eq("project_id", p.id)
      .order("created_at", { ascending: false })
      .limit(4)
    for (const h of historia ?? []) {
      console.log(
        `  HISTORIA        ${String(h.created_at).slice(0, 10)}  ${h.previous_phase ?? "-"} -> ${h.phase}  (${h.source}/${h.source_name ?? "-"})`
      )
    }
    console.log()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
