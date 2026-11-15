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
 * RAKENNUSLEHDEN SUUNNITTELUVAIHEEN RIVIT UUDELLA RIKASTUKSELLA (D-425).
 *
 * Syöte asetti vaiheeksi "Suunnittelussa" aina kun otsikko ei kertonut
 * valmistumisesta. Rikastus lukee nyt ingressin, pääkuvan kuvatekstin ja
 * avoimen kappaleen ja päättelee vaiheen niistä (vain eteenpäin, ei
 * valmistumista). Tämä ajaa saman julkisille hankkeille ja jonon uusille
 * riveille, jotka ovat yhä suunnitteluvaiheessa.
 *
 * Mitattu 15.11.2026: 42 riviä, joista 6 muuttuu.
 *
 *   npx tsx scripts/korjaa-rakennuslehti-vaiheet.ts
 *   npx tsx scripts/korjaa-rakennuslehti-vaiheet.ts --apply
 */

const SUUNNITTELU = ["Suunnittelussa", "Suunnittelu"]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { enrichRakennuslehtiCandidate } = await import("../lib/agent/fetchRakennuslehtiSource")
  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? "=== AJO (--apply) ===\n" : "=== KUIVAHARJOITUS ===\n")

  const { data: hankkeet } = await db
    .from("projects")
    .select("id,name,phase,url:metadata->>source_url")
    .eq("metadata->>source_name", "rakennuslehti")
    .in("phase", SUUNNITTELU)
    .eq("is_public", true)
  const { data: jono } = await db
    .from("potential_projects")
    .select("id,title,metadata")
    .eq("metadata->>source_name", "rakennuslehti")
    .eq("status", "new")

  let muutoksia = 0
  for (const h of hankkeet ?? []) {
    if (!h.url) continue
    const e = await enrichRakennuslehtiCandidate({ name: h.name, description: null, source_url: h.url, phase: h.phase })
    await new Promise((s) => setTimeout(s, 800))
    if (e.phase === h.phase) continue
    muutoksia++
    console.log(`hanke ${h.id.slice(0, 8)} ${h.phase} -> ${e.phase} | ${h.name.slice(0, 90)}`)
    if (!apply) continue
    const { error } = await db.from("projects").update({ phase: e.phase }).eq("id", h.id).eq("phase", h.phase)
    if (error) {
      console.log(`  VIRHE ${error.message}`)
      continue
    }
    await recordPhaseChange({
      supabase: db as any,
      projectId: h.id,
      newPhase: e.phase,
      previousPhase: h.phase,
      source: "manual_correction",
      sourceName: "rakennuslehti-vaiheet",
      reason: `Artikkelin avoin teksti (ingressi, kuvateksti, ensimmäinen kappale): ${h.url}`,
    })
  }

  for (const j of jono ?? []) {
    const md = j.metadata ?? {}
    if (!SUUNNITTELU.includes(md.phase_hint) || !md.source_url) continue
    const e = await enrichRakennuslehtiCandidate({
      name: j.title,
      description: md.description ?? null,
      source_url: md.source_url,
      phase: md.phase_hint,
    })
    await new Promise((s) => setTimeout(s, 800))
    if (e.phase === md.phase_hint) continue
    muutoksia++
    console.log(`jono  ${j.id.slice(0, 8)} ${md.phase_hint} -> ${e.phase} | ${j.title.slice(0, 90)}`)
    if (!apply) continue
    const { error } = await db
      .from("potential_projects")
      .update({
        metadata: {
          ...md,
          phase_hint: e.phase,
          ...(String(e.description ?? "").length > String(md.description ?? "").length ? { description: e.description } : {}),
        },
      })
      .eq("id", j.id)
    if (error) console.log(`  VIRHE ${error.message}`)
  }

  console.log(`\nmuutoksia ${muutoksia}`)
  if (!apply) console.log("Ei muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
