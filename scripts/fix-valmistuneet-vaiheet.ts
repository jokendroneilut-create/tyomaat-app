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
 * KOLME VALMISTUNUTTA HANKETTA RAKENTEILLA-LISTALTA (D-220).
 *
 * Kvartaalitarkistus 1.10.2026 loysi kolme hanketta, jotka ovat
 * valmistuneet mutta seisovat yha rakenteilla-vaiheessa. Todiste on
 * omassa aineistossamme kussakin tapauksessa.
 *
 * VALMISTUMISPAIVA EI OLE AJOHETKI. `auto-complete-projects` kirjaa
 * `completed_at = new Date()`, koska se ei tieda todellista paivaa.
 * Tassa se tiedetaan tiedotteesta, joten se kirjataan sellaisena.
 *
 * PAIVA LUETAAN TIEDOTTEEN TEKSTISTA, EI TUONTIPAIVASTA. Ensimmainen
 * kuivaharjoitus 1.10.2026 paljasti etta kahdella kolmesta oli vaara
 * paiva: Nokian tiedote on 14.10.2025 vaikka se tuotiin kantaan
 * 17.8.2026, ja Kampin rakennus valmistui 15.9. vaikka tiedote on 20.9.
 * `published_at` oli molemmilla tyhja, joten paiva on vain tekstissa.
 *
 * KUIVAHARJOITUS ENSIN. Ilman `--apply` tulostaa vain mita tekisi, ja
 * tarkistaa ETTA TODISTE ON YHA LAHTEESSA - vaite luetaan kannasta
 * uudelleen eika luoteta tahan tiedostoon kirjoitettuun muistiin.
 *
 *   npx tsx scripts/fix-valmistuneet-vaiheet.ts
 *   npx tsx scripts/fix-valmistuneet-vaiheet.ts --apply
 */

type Korjaus = {
  id: string
  nimi: string
  /* Paiva tiedotteesta, ei ajohetkesta. */
  valmistui: string
  /* Virke jonka pitaa loytya dokumentin tekstista, muuten ei muuteta. */
  todiste: RegExp
  /* Haku kannasta: karsii dokumentit ennen kuin todiste tarkistetaan. */
  hakusana: string
  perustelu: string
}

const KORJAUKSET: Korjaus[] = [
  {
    id: "ad42dad3-62e8-4dbf-ba9f-b41451d5533f",
    nimi: "Kampin terveys- ja hyvinvointikeskus",
    valmistui: "2026-09-15",
    todiste: /Kampin uusi terveys- ja hyvinvointikeskus/i,
    hakusana: "Kampin",
    perustelu:
      "Tiedote: rakennus on 15.9.2026 valmistunut yli vuoden etuajassa. Metroaseman sisaankaynti avataan 12.10.2026, palvelut kaynnistyvat kevaalla 2027.",
  },
  {
    id: "079ea3a4-320a-47d0-963b-bc4e2d632954",
    nimi: "F-35-havittajien moottorien kokoonpano- ja huoltohalli (Nokia)",
    valmistui: "2025-10-14",
    todiste: /kokoonpano- ja huoltokiinteist(?:ö|o) valmistui/i,
    hakusana: "huoltokiinteist",
    perustelu:
      "Senaatti-kiinteistojen tiedote 14.10.2025: kiinteisto on valmistunut suunnitellussa aikataulussa ja tilat luovutettu Patrialle.",
  },
  {
    id: "98f430cd-6575-4fa4-b595-feeb1e673dea",
    nimi: "Vanhan Vaasan sairaalan uudisrakennus",
    valmistui: "2025-12-31",
    todiste: /valmistui aikataulussa ja budjetissa loppuvuodesta 2025/i,
    hakusana: "Vanhan Vaasan sairaalan",
    perustelu:
      "Senaatti-kiinteistojen tiedote: hanke valmistui aikataulussa loppuvuodesta 2025 ja tilat otettiin kayttoon helmikuussa 2026.",
  },
]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { PHASE_LABELS } = await import("../lib/projects/phases")
  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`kohdevaihe "${PHASE_LABELS.completed}", status "completed"\n`)

  for (const k of KORJAUKSET) {
    const { data: p, error } = await db
      .from("projects")
      .select("id, name, city, phase, status, estimated_completion, completed_at")
      .eq("id", k.id)
      .maybeSingle()

    if (error) throw error
    if (!p) {
      console.log(`PUUTTUU  ${k.nimi} (${k.id}) - ei kannassa, ohitetaan\n`)
      continue
    }

    /* Todiste luetaan lahteesta uudelleen, ei muistista. */
    const { data: dokit, error: dokVirhe } = await db
      .from("source_documents")
      .select("title, document_url, raw_text")
      .ilike("raw_text", `%${k.hakusana}%`)
      .limit(200)
    if (dokVirhe) throw dokVirhe

    const todistava = (dokit ?? []).find((d) => k.todiste.test(`${d.title} ${d.raw_text ?? ""}`))

    console.log(`${p.name?.replace(/​/g, "").slice(0, 70)}`)
    console.log(`  ${p.city ?? "-"} | vaihe "${p.phase}" | status "${p.status}" | arvio ${String(p.estimated_completion ?? "-").slice(0, 10)}`)

    if (!todistava) {
      console.log(`  TODISTE EI LOYDY (${k.todiste}) - EI MUUTETA\n`)
      continue
    }

    console.log(`  todiste: ${String(todistava.title).slice(0, 78)}`)
    console.log(`           ${todistava.document_url ?? "-"}`)
    console.log(`  -> vaihe "${PHASE_LABELS.completed}", status "completed", completed_at ${k.valmistui}`)

    if (!apply) {
      console.log()
      continue
    }

    const { error: paivitysVirhe } = await db
      .from("projects")
      .update({
        phase: PHASE_LABELS.completed,
        status: "completed",
        completed_at: new Date(`${k.valmistui}T12:00:00Z`).toISOString(),
      })
      .eq("id", k.id)

    if (paivitysVirhe) {
      console.log(`  VIRHE: ${paivitysVirhe.message}\n`)
      continue
    }

    await recordPhaseChange({
      supabase: db as any,
      projectId: k.id,
      newPhase: PHASE_LABELS.completed,
      previousPhase: p.phase,
      source: "manual_correction",
      sourceName: "kvartaalitarkistus-rakenteilla",
      reason: k.perustelu,
    })

    console.log(`  TEHTY\n`)
  }

  if (!apply) console.log("Ei muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
