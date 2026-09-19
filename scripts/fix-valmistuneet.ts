import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LÄHTEEN MUKAAN VALMISTUNEET, JOTKA OLIVAT "RAKENTEILLA" (D-201).
 *
 * Löytyivät lähteettömien hankkeiden haussa (D-200). Mukana vain ne,
 * joiden lähdesivu TOTEAA valmistumisen menneessä muodossa - suunniteltu
 * aikataulu vanhassa tiedotteessa ei riitä, koska kesken oleva hanke
 * piilotettuna on pahempi kuin valmistunut listalla. Todiste luettu
 * sivulta 19.9.2026 ja kirjataan vaihehistorian syyksi.
 *
 * Vaihehistoriaan lähteellä manual_correction, jota hälytys ei lue:
 * vanha valmistuminen ei ole uusi tapahtuma.
 *
 *   npx tsx scripts/fix-valmistuneet.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-valmistuneet.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const VALMISTUNEET: { id: string; todiste: string; lahde: string }[] = [
  { id: "b3de5071", todiste: "urakka valmistui puoli vuotta etuajassa vuoden 2025 lopulla; Tila: Valmis", lahde: "kreate.fi" },
  { id: "526bbcf9", todiste: "Finnoonniityn linja-autovarikko luovutettiin tilaajalle (31.7.2026)", lahde: "asura.fi" },
  { id: "74e8d32b", todiste: "Valmistumisen myötä kiinteistön omistus siirtyi 1.9.2026", lahde: "tekova.fi" },
  { id: "ce8f4c66", todiste: "Nyt valmistuneet kodit (18.6.2026)", lahde: "epressi.com" },
  { id: "2f2219ca", todiste: "kohde luovutettiin tilaajalle elokuussa 2026", lahde: "epressi.com" },
  { id: "b02ea8e1", todiste: "Ahvenisjärven uusi koulu valmistui", lahde: "tampereentilapalvelut.fi" },
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { PHASE_LABELS } = await import("../lib/projects/phases")
  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("id, name, phase, status").range(from, from + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  let n = 0
  for (const v of VALMISTUNEET) {
    const osumat = rivit.filter((r) => r.id.startsWith(v.id))
    if (osumat.length !== 1) { console.log(`OHITETAAN ${v.id}: ${osumat.length} osumaa`); continue }
    const p = osumat[0]
    if (p.phase === PHASE_LABELS.completed) { console.log(`jo valmis: ${p.name}`); continue }
    n++
    console.log(`${p.name} [${p.phase}/${p.status}] -> ${PHASE_LABELS.completed}\n   ${v.lahde}: "${v.todiste}"`)
    if (!APPLY) continue
    const { error } = await db
      .from("projects")
      .update({ phase: PHASE_LABELS.completed, status: "completed", completed_at: new Date().toISOString() })
      .eq("id", p.id)
    if (error) throw error
    await recordPhaseChange({
      supabase: db as any,
      projectId: p.id,
      newPhase: PHASE_LABELS.completed,
      previousPhase: p.phase,
      source: "manual_correction",
      sourceName: v.lahde,
      reason: `Lähde toteaa valmistumisen: "${v.todiste}" (D-201)`,
    })
  }
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} hanketta ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
