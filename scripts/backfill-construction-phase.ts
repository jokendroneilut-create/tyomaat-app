import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TAKAUTUVA VAIHEEN KORJAUS.
 *
 * `CONSTRUCTION_PATTERNS` ei tuntenut muotoja "työt ovat tontilla jo
 * täydessä vauhdissa", "työt alkoivat" tai "rakennustyöt on aloitettu",
 * joten käynnissä oleva työmaa jäi suunnitteluvaiheeseen. Kuviot lisättiin
 * 18.8.2026; tämä vie saman korjauksen jo tallennettuihin riveihin.
 *
 * VAIHE SAA VAIN EDETÄ. Suunnittelu -> rakentaminen on etenemistä, joten
 * korjaus on turvallinen. Skripti ei koske riveihin, jotka ovat jo
 * rakentamisessa tai sitä pidemmällä — eikä valmistuneisiin, joiden
 * palauttaminen rakentamiseen olisi askel taaksepäin.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

/* Vain nämä siirretään. Muut vaiheet ovat jo yhtä pitkällä tai edempänä. */
const PLANNING = /^(suunnittelu|suunnittelussa|kaavoitus)$/i

/*
 * VALMISTUMINEN SAMASSA VIRKKEESSÄ KUMOAA OSUMAN.
 *
 * Kuivaharjoitus 18.8.2026 paljasti kolme tapausta, joissa teksti sanoo
 * "Rakentaminen on alkanut vuoden 2019 tammikuussa ja VALMISTUNUT
 * käyttöönotettavaksi toukokuussa 2021". Rakentamisen merkki osuu, mutta
 * hanke on ollut valmis vuosia — siirto rakentamiseen näyttäisi
 * asiakkaalle valmiin kohteen avoimena mahdollisuutena.
 *
 * Tarkistus rajataan osuman JÄLKEISEEN ikkunaan, koska aiempi
 * "valmistui"-maininta viittaa yleensä eri kohteeseen (sama syy, jonka
 * takia `inferCompanyPhase` lukee valmistumisen vain otsikosta).
 */
const COMPLETION_WINDOW = 160
const COMPLETED_NEARBY = /valmistunut|valmistui|valmistuu|otettu käyttöön|luovutettu/i

function completedNearMatch(body: string, index: number): boolean {
  return COMPLETED_NEARBY.test(body.slice(index, index + COMPLETION_WINDOW))
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { PHASE_LABELS } = await import("../lib/projects/phases")

  /* Sama lista kuin companyRelease.ts:ssä — pidetään synkassa käsin. */
  const CONSTRUCTION_PATTERNS = [
    /rakennustyöt\s+(?:ovat\s+)?(?:alkaneet|käynnissä)/i,
    /rakentaminen\s+on\s+(?:alkanut|käynnissä)/i,
    /harjannostajaisia/i,
    /peruskivi/i,
    /työt\s+(?:ovat\s+)?(?:tontilla\s+)?(?:jo\s+)?(?:täydessä\s+vauhdissa|käynnissä|alkaneet|alkoivat)/i,
    /rakennustyöt\s+(?:on\s+)?aloitettu/i,
    /työmaa\s+on\s+käynnissä/i,
  ]

  /*
   * VAIN LÄHTEET JOILLA ON RIKASTUSKOUKKU.
   *
   * Uudet kuviot elävät yrityksen tiedotteen lukijassa, eikä kuntapäätöksiä
   * ajeta sen läpi lainkaan. Ilman tätä rajausta takautuva ajo soveltaisi
   * niihin logiikkaa, joka ei koskaan koske niitä jatkossa — ja
   * kuntapäätöksen teksti kuvaa usein YMPÄRISTÖÄ eikä hankkeen omaa tilaa.
   * Kuivaharjoitus 18.8.2026: "Nopsasiiventie, katusuunnitelmien
   * hyväksyminen" olisi siirtynyt rakentamiseen, koska teksti sanoo
   * Honkasuon ALUEEN olevan rakenteilla.
   */
  const { sources: legacySources } = await import("../lib/agent/sources")
  const ENRICHED = new Set(
    (legacySources as any[])
      .filter((x) => typeof x.enrich === "function")
      .map((x) => x.name)
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let queueMoved = 0
  let projectsMoved = 0
  const samples: string[] = []

  /* --- Jonossa olevat ehdokkaat --- */
  const queue: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, metadata")
      .range(from, from + 999)
    if (error) throw error
    queue.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  for (const row of queue) {
    const phase = String(row.metadata?.phase_hint ?? "")
    if (!PLANNING.test(phase)) continue
    if (!ENRICHED.has(String(row.metadata?.source_name ?? ""))) continue

    const body = String(row.metadata?.description ?? "")
    const index = CONSTRUCTION_PATTERNS.map((re) => body.search(re)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
    if (index === undefined) continue

    /* Valmistuminen samassa virkkeessä kumoaa osuman. */
    if (completedNearMatch(body, index)) continue

    const hit = body.slice(index, index + 40).split(/[.,]/)[0]

    queueMoved++
    if (samples.length < 8) {
      samples.push(`jono   ${String(row.title).slice(0, 46).padEnd(48)} "${hit}"`)
    }

    if (!APPLY) continue

    await supabase
      .from("potential_projects")
      .update({
        metadata: {
          ...(row.metadata ?? {}),
          phase_hint: PHASE_LABELS.construction,
          phase_corrected_at: new Date().toISOString(),
          phase_corrected_from: phase,
        },
      })
      .eq("id", row.id)
  }

  /* --- Hyväksytyt hankkeet --- */
  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name, phase, additional_info, metadata")
      .range(from, from + 999)
    if (error) throw error
    projects.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  for (const row of projects) {
    if (!PLANNING.test(String(row.phase ?? ""))) continue
    if (!ENRICHED.has(String(row.metadata?.source_name ?? ""))) continue

    const body = String(row.additional_info ?? row.metadata?.description ?? "")
    const index = CONSTRUCTION_PATTERNS.map((re) => body.search(re)).filter((i) => i >= 0).sort((a, b) => a - b)[0]
    if (index === undefined) continue

    /* Valmistuminen samassa virkkeessä kumoaa osuman. */
    if (completedNearMatch(body, index)) continue

    const hit = body.slice(index, index + 40).split(/[.,]/)[0]

    projectsMoved++
    if (samples.length < 8) {
      samples.push(`hanke  ${String(row.name).slice(0, 46).padEnd(48)} "${hit}"`)
    }

    if (!APPLY) continue

    await supabase
      .from("projects")
      .update({
        phase: PHASE_LABELS.construction,
        metadata: {
          ...(row.metadata ?? {}),
          phase_corrected_at: new Date().toISOString(),
          phase_corrected_from: row.phase,
        },
      })
      .eq("id", row.id)
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`jonossa siirtyisi rakentamiseen:      ${queueMoved}`)
  console.log(`hyväksytyistä siirtyisi:              ${projectsMoved}`)
  console.log("\nnäytteitä:")
  for (const s of samples) console.log(`  ${s}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
