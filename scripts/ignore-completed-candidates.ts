import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VALMISTUNEET EHDOKKAAT POIS JONOSTA.
 *
 * Referenssiportfoliot (Skanskan ja NCC:n "projektimme", Kreaten
 * kohdeluettelo) tuovat valmiita rakennuksia: Iso Omena, Olkiluodon
 * kapselointilaitos, Sokos Hotel Turun Seurahuone. Valmis rakennus ei ole
 * liidi, eika ihmisen kuulu tehda siita hylkayspaatosta yksi kerrallaan.
 *
 * D-008:n suodatus vaati valmistumisPAIVAN tekstista eika laukennut
 * naissa kertaakaan - vaihe on rakenteinen kentta, ei proosaa.
 *
 * EI POISTA RIVEJA. Status -> "ignored", sama kuin jonosta poistossa:
 * ei nay asiakkaille, historia sailyy, paatos on peruttavissa.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { PHASE_LABELS } = await import("../lib/projects/phases")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from("potential_projects").select("*").range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const valmis = String(PHASE_LABELS.completed).toLowerCase()
  const kohteet = rivit.filter(
    (p: any) =>
      p.status === "new" &&
      String(p.metadata?.phase_hint ?? "").trim().toLowerCase() === valmis
  )

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`jonossa (status=new): ${rivit.filter((p: any) => p.status === "new").length}`)
  console.log(`  niista valmistuneita: ${kohteet.length}\n`)

  const lahteet = new Map<string, number>()
  for (const p of kohteet) lahteet.set(String(p.metadata?.source_name ?? "?"), (lahteet.get(String(p.metadata?.source_name ?? "?")) ?? 0) + 1)
  for (const [k, v] of [...lahteet].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)

  console.log("\nohitettavat:")
  for (const p of kohteet) console.log(`  ${String(p.title).slice(0, 66)}`)

  if (!APPLY) { console.log("\n(kuivaharjoitus)"); return }

  let n = 0
  for (const p of kohteet) {
    const { error } = await supabase
      .from("potential_projects")
      .update({
        status: "ignored",
        metadata: {
          ...(p.metadata ?? {}),
          recommended_action: "ignore",
          auto_ignored_reason: "lahde_ilmoittaa_valmistuneeksi",
        },
      })
      .eq("id", p.id)
    if (error) throw error
    n++
  }
  console.log(`\nohitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
