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
 * S2-LAITURI ON RAKENTEILLA, EI "SOPIMUS MYONNETTY" (D-331).
 *
 * Johannes 22.10.2026: *"korjaa vaihe rakenteilla tilaan."*
 *
 * Lohkare Infran tiedote 21.10.2026: *"Syys-lokakuun vaihteessa
 * kaynnistynyt urakka on merkittava osa Turun matkustajasataman
 * uudistamista."* Rivilla on lisaksi aloituspaiva 11.9.2026 Hilmasta,
 * eli kaksi lahdetta kertoo saman.
 *
 * VAIHEHISTORIA KIRJATAAN. Pelkka sarakepaivitys jattaisi
 * `project_phase_history`-tauluun aukon, ja vaihehistoria on se mista
 * halytysmaara johdetaan ([[alert-volume-follows-approvals]]).
 * Lahteeksi `manual_correction`, joka on olemassa juuri talle.
 *
 * TAMA NAKYY ASIAKKAALLE KAHDESTI: vaihe on hankekortilla ja
 * suodattimessa, ja `phase` on myos muutoslokin seuraama kentta, joten
 * muutos menee hakuvahtien koosteeseen ("Vaihe"). Se on oikein --
 * hanke todella alkoi.
 *
 *   npx tsx scripts/korjaa-s2-laiturin-vaihe.ts
 *   npx tsx scripts/korjaa-s2-laiturin-vaihe.ts --apply
 */

const HANKE = "e367dc88-b350-4684-b4c5-2e8a66aa7729"
const UUSI_VAIHE = "Rakenteilla"
const TIEDOTE =
  "https://lohkare.fi/lohkare-infraan-kuuluva-oteran-toteuttaa-turun-sataman-mittavan-s2-laituriurakan/"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data, error } = await db
    .from("projects")
    .select("id, name, phase, construction_start, estimated_completion, builder, status, is_public")
    .eq("id", HANKE)
    .maybeSingle()
  if (error || !data) {
    console.error(`VIRHE: ${error?.message ?? "ei rivia"}`)
    process.exit(1)
  }
  const p = data as any

  console.log(`\n${p.name}`)
  console.log(`   vaihe              ${p.phase}  ->  ${UUSI_VAIHE}`)
  console.log(`   aloitus            ${p.construction_start}`)
  console.log(`   valmistuminen      ${p.estimated_completion}`)
  console.log(`   rakentaja          ${p.builder}`)
  console.log(`   tila               ${p.status}, julkinen ${p.is_public}`)

  if (p.phase === UUSI_VAIHE) {
    console.log("\nVaihe on jo oikein, ei tehda mitaan.")
    return
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivi on luettu.")
    return
  }

  const { error: kirjoitus } = await db.from("projects").update({ phase: UUSI_VAIHE }).eq("id", HANKE)
  if (kirjoitus) {
    console.error(`VIRHE: ${kirjoitus.message}`)
    process.exit(1)
  }

  await recordPhaseChange({
    supabase: db,
    projectId: HANKE,
    newPhase: UUSI_VAIHE,
    previousPhase: p.phase,
    source: "manual_correction",
    sourceName: "lohkare",
    reason: "Tiedote 21.10.2026: urakka kaynnistyi syys-lokakuun vaihteessa",
    metadata: { tiedote: TIEDOTE, aloitus_kannassa: p.construction_start },
  })

  console.log(`\nKirjoitettu: ${p.phase} -> ${UUSI_VAIHE}, vaihehistoria kirjattu.`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
