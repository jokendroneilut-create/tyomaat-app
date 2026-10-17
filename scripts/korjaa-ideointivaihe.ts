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
 * IDEOINTI -> SUUNNITTELU VANHOILLE RIVEILLE (D-303).
 *
 * Mitattu 18.10.2026: `Ideointi` on kanoninen vaihe mutta
 * 0 / 6 896 hyvaksytyssa hankkeessa. Jonossa sita on 5 rivilla, joista
 * NELJA tulee Fingridin `vaiheTilasta`-kuviosta (korjattu samana
 * paivana) ja yksi on stt_haku-rivi "Sakylan biokaasulaitoas", jo
 * hyvaksytty. Viidennen vaihevihje on historiallinen eika nay
 * asiakkaalle, mutta se siivotaan samalla ettei vaihe jaa kantaan
 * yhden rivin takia.
 *
 * Vaihemaarittelya EI poisteta: se on isompi muutos eika tarpeen.
 *
 *   npx tsx scripts/korjaa-ideointivaihe.ts
 *   npx tsx scripts/korjaa-ideointivaihe.ts --apply
 */
async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { PHASE_LABELS } = await import("../lib/projects/phases")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(t).select(cols).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${t}: ${error.message}`)
        process.exit(1)
      }
      out.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return out
  }

  const jono = await kaikki("potential_projects", "id, title, status, metadata")
  const osuvat = jono.filter((r: any) => String(r.metadata?.phase_hint ?? "") === "Ideointi")

  /* Hankkeista mitattiin 0, mutta varmistetaan ettei luku ole vanhentunut. */
  const hankkeet = await kaikki("projects", "id, name, phase")
  const hankeOsumat = hankkeet.filter((p: any) => String(p.phase ?? "") === "Ideointi")

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`jonorivejä Ideointi-vaiheessa: ${osuvat.length}`)
  console.log(`hankkeita Ideointi-vaiheessa:  ${hankeOsumat.length}\n`)
  for (const r of osuvat) {
    console.log(`  ${String(r.status).padEnd(9)} ${String(r.metadata?.source_name ?? "-").padEnd(20)} ${String(r.title).slice(0, 46)}`)
  }
  for (const p of hankeOsumat) console.log(`  HANKE  ${String(p.name).slice(0, 56)}`)

  if (!apply) {
    console.log(`\nEi kirjoitettu. Vaihe muuttuisi -> ${PHASE_LABELS.planning}`)
    return
  }

  let tehty = 0
  for (const r of osuvat) {
    const { error } = await db
      .from("potential_projects")
      .update({ metadata: { ...(r.metadata ?? {}), phase_hint: PHASE_LABELS.planning } })
      .eq("id", r.id)
    if (error) {
      console.error(`VIRHE jono ${r.id}: ${error.message}`)
      continue
    }
    tehty++
  }
  for (const p of hankeOsumat) {
    const { error } = await db.from("projects").update({ phase: PHASE_LABELS.planning }).eq("id", p.id)
    if (error) {
      console.error(`VIRHE hanke ${p.id}: ${error.message}`)
      continue
    }
    tehty++
  }
  console.log(`\nKORJATTU ${tehty} riviä.`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
