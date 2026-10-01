import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HYVINKAA AREENA: VAIHE SUUNNITTELU -> RAKENTEILLA (D-219).
 *
 * Asiakaspalaute 1.10.2026: "on jo pitkastii rakenteilla". Palaute on
 * oikea, ja todiste on OMASSA aineistossamme - SRV:n tiedote 9.9.2026:
 *
 *   "Monitoimiareenan rakennushanke kaynnistyi kehitysvaiheella
 *    lokakuussa 2024 ja RAKENNUSTYOT ALKOIVAT KESAKUUSSA 2025.
 *    ... Tanaan 9.9.2026 ... vietettiin harjannostajaisia."
 *
 * Hanke oli silti vaiheessa "Suunnittelu", koska se tuli Granlundin
 * projektisivulta: suunnittelutoimiston referenssisivu ei kerro vaihetta
 * lainkaan, ja `phase_hint` tuli lahteen tyypista eika todisteesta.
 *
 * Sama areena on kannassa KAHTENA hankkeena, eika tasmaytys yhdista
 * niita (ei osumaa lainkaan): SRV:n rivin otsikko on uutislause
 * "Hyvinkaa Areena saavutti harjakorkeutensa - ...". Pari viedaan
 * duplikaattijonoon; yhdistaminen on Johanneksen paatos.
 *
 *   npx tsx scripts/fix-hyvinkaa-areena.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-hyvinkaa-areena.ts --apply
 */
const APPLY = process.argv.includes("--apply")

const GRANLUND = "868fe187-e9bb-4093-b24b-f6027667687d"
const SRV = "ae429748-c25d-473d-877e-b82cb9a17bef"

/*
 * SRV:n omat tiedotteet, kaikki kannassa:
 *
 *   19.8.2026  "kokonaiskustannusarvio on 45,6 miljoonaa euroa"
 *   19.8.2026  "rakennustyot alkoivat kesakuussa 2025"
 *   19.8.2026  "Rakennustoiden on maara valmistua kevaalla 2027"
 *    9.9.2026  harjannostajaiset
 *
 * Granlundin sivulta tullut valmistumisarvio oli 31.12.2027 - puoli
 * vuotta myohassa paaurakoitsijan omasta aikataulusta.
 */
const RAKENTAMINEN_ALKOI = "2025-06-01"
const VALMISTUMINEN = "2027-05-31"
const KUSTANNUS = 45_600_000
const UUSI_VAIHE = "Rakenteilla"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data, error } = await db
    .from("projects")
    .select("id, name, phase, construction_start, estimated_completion, builder, contractor, metadata")
    .in("id", [GRANLUND, SRV])
  if (error) throw error

  const gran: any = (data ?? []).find((p: any) => p.id === GRANLUND)
  const srv: any = (data ?? []).find((p: any) => p.id === SRV)
  if (!gran) { console.log("Granlund-hanketta ei loydy"); return }

  console.log("=== NYKYTILA ===")
  console.log(` ${gran.name}`)
  console.log(`   vaihe=${gran.phase} rakentaminen alkoi=${gran.construction_start ?? "-"} rakentaja=${gran.builder ?? gran.contractor ?? "-"}`)
  if (srv) console.log(` ${String(srv.name).slice(0, 56)}\n   vaihe=${srv.phase}`)

  console.log("\n=== MUUTOKSET ===")
  const muutokset: Record<string, unknown> = {}
  if (gran.phase !== UUSI_VAIHE) {
    muutokset.phase = UUSI_VAIHE
    console.log(` vaihe: ${gran.phase} -> ${UUSI_VAIHE}`)
  }
  if (!gran.construction_start) {
    muutokset.construction_start = RAKENTAMINEN_ALKOI
    console.log(` rakentaminen alkoi: - -> ${RAKENTAMINEN_ALKOI}`)
  }
  if (!gran.builder && !gran.contractor) {
    muutokset.builder = "SRV"
    console.log(` paaurakoitsija: - -> SRV`)
  }

  /*
   * Valmistuminen KORVATAAN: Granlundin 31.12.2027 on suunnittelijan
   * arvio, SRV:n kevat 2027 paaurakoitsijan oma aikataulu.
   */
  if (gran.estimated_completion !== VALMISTUMINEN) {
    muutokset.estimated_completion = VALMISTUMINEN
    console.log(` valmistuminen: ${gran.estimated_completion ?? "-"} -> ${VALMISTUMINEN}`)
  }

  if (!gran.estimated_cost) {
    muutokset.estimated_cost = KUSTANNUS
    console.log(` kustannusarvio: - -> ${KUSTANNUS}`)
  }

  /* Duplikaattipari jonoon, ei yhdisteta. */
  const [idA, idB] = [GRANLUND, SRV].sort()
  const { data: olemassa } = await db
    .from("project_duplicate_candidates")
    .select("status")
    .eq("project_id_a", idA)
    .eq("project_id_b", idB)
    .maybeSingle()

  const pariPuuttuu = srv && !olemassa
  console.log(
    pariPuuttuu
      ? " duplikaattipari: lisataan jonoon (pending)"
      : ` duplikaattipari: ${olemassa ? `on jo jonossa [${olemassa.status}]` : "SRV-hanketta ei loydy"}`
  )

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  if (Object.keys(muutokset).length) {
    const { error: e1 } = await db
      .from("projects")
      .update({
        ...muutokset,
        metadata: {
          ...(gran.metadata ?? {}),
          phase_evidence:
            "SRV lehdistotiedote 9.9.2026: rakennustyot alkoivat kesakuussa 2025, harjannostajaiset 9.9.2026",
          ...(muutokset.estimated_cost
            ? { cost_source: "manual", estimated_cost: KUSTANNUS }
            : {}),
        },
      })
      .eq("id", GRANLUND)
    if (e1) throw e1

    if (muutokset.phase) {
      await recordPhaseChange({
        supabase: db as any,
        projectId: GRANLUND,
        newPhase: UUSI_VAIHE,
        previousPhase: gran.phase,
        source: "manual_correction",
        sourceName: "srv",
        reason: "Asiakaspalaute + SRV:n tiedote 9.9.2026 (harjannostajaiset)",
      })
    }
  }

  if (pariPuuttuu) {
    const { error: e2 } = await db.from("project_duplicate_candidates").upsert(
      {
        project_id_a: idA,
        project_id_b: idB,
        confidence: 100,
        reasons: ["manual"],
      },
      { onConflict: "project_id_a,project_id_b", ignoreDuplicates: true }
    )
    if (e2) throw e2
  }

  console.log("\n=== AJETTU ===")
}
main().catch((e) => { console.error(e); process.exit(1) })
