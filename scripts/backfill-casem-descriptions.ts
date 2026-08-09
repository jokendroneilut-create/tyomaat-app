/*
 * Hakee CaseM-päätösrivien kuvaukset uudelleen sisältöaluerajauksella.
 *
 * VIKA: asiasivun vasemmassa laidassa on viranhaltijavalikko - linkkilista
 * jokaiseen kunnan viranhaltijanimikkeeseen. Rovaniemellä se on 93 riviä ja
 * 2 700 merkkiä, ja HTML:ssä se tulee ennen varsinaista asiaa. Kuvaus alkoi
 * siksi luettelolla "Alueellisten palvelujen päällikkö Apulaisrehtori
 * Korkalovaaran peruskoulu...".
 *
 * Vika ei ollut kosmeettinen: kohdetyyppi luetaan tekstin alusta, ja
 * valikossa on kymmenien koulujen rehtorit. Sipolantien 9 PURKU-URAKKA sai
 * kohdetyypin "Koulu". Kaikilla 11 vuotaneella rivillä kohdetyyppi oli
 * väärä.
 *
 * Kaikki CaseM-rivit haetaan uudelleen, ei vain tunnistetut vuotaneet:
 * tunnistus perustuisi Rovaniemen nimikkeisiin, eikä se kertoisi mitään
 * muiden kuntien valikoista.
 *
 * Kertaluontoinen.
 *
 *   npx tsx scripts/backfill-casem-descriptions.ts
 *   npx tsx scripts/backfill-casem-descriptions.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const CASEM_SOURCES = [
  "tampere_paatokset",
  "jyvaskyla_paatokset",
  "rovaniemi_paatokset",
  "pori_paatokset",
]

const CONCURRENCY = 4

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractItemText } = await import("../lib/agent/fetchCaseMSource")
  const { inferBuildingType } = await import("../lib/agent/buildingType")
  const { extractDecisionWinners } = await import("../lib/agent/decisionWinners")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id, title, status, metadata")
      .range(from, from + 999)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = rows.filter(
    (r: any) => CASEM_SOURCES.includes(r.metadata?.source) && r.metadata?.source_url
  )

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${targets.length} CaseM-riviä\n`
  )

  const stats = { lyheni: 0, tyyppi: 0, voittajat: 0, ennallaan: 0, epaonnistui: 0 }
  const muutokset: string[] = []

  for (let i = 0; i < targets.length; i += CONCURRENCY) {
    await Promise.all(
      targets.slice(i, i + CONCURRENCY).map(async (row: any) => {
        const md = row.metadata
        const res = await fetch(md.source_url, {
          cache: "no-store",
          headers: {
            accept: "text/html,*/*",
            "user-agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)",
          },
        }).catch(() => null)

        const html = res?.ok ? await res.text() : null
        const description = html ? extractItemText(html).text : null

        /*
         * Tyhjä tulos ei saa pyyhkiä olemassa olevaa kuvausta: sivu on
         * voinut siirtyä tai haku epäonnistua. Rivi jätetään ennalleen.
         */
        if (!description) {
          stats.epaonnistui++
          return
        }

        const oldText: string = md.description ?? ""
        const buildingType = inferBuildingType(row.title, description)
        const winners = extractDecisionWinners(description)
        const oldWinners: string[] = Array.isArray(md.winners) ? md.winners : []

        const textChanged = description !== oldText
        const typeChanged = buildingType !== (md.building_type ?? null)
        const winnersChanged = winners.join("|") !== oldWinners.join("|")

        if (!textChanged && !typeChanged && !winnersChanged) {
          stats.ennallaan++
          return
        }

        if (textChanged && description.length < oldText.length) stats.lyheni++
        if (typeChanged) {
          stats.tyyppi++
          muutokset.push(
            `  ${String(row.title).slice(0, 52).padEnd(54)} ${String(md.building_type ?? "(tyhjä)").padEnd(16)} -> ${buildingType ?? "(tyhjä)"}`
          )
        }
        if (winnersChanged) stats.voittajat++

        if (!APPLY) return

        const { error } = await supabase
          .from("potential_projects")
          .update({
            metadata: {
              ...md,
              description,
              /* Uusi laskenta voittaa myös tyhjänä (ks. D-036). */
              building_type: buildingType,
              winners: winners.length ? winners : null,
              builder:
                winners.length === 1
                  ? winners[0]
                  : oldWinners.includes(md.builder)
                    ? null
                    : (md.builder ?? null),
            },
          })
          .eq("id", row.id)

        if (error) stats.epaonnistui++
      })
    )
    process.stdout.write(
      `\r  käsitelty ${Math.min(i + CONCURRENCY, targets.length)}/${targets.length}`
    )
  }

  console.log("\n")
  console.log(`kuvaus lyheni:       ${stats.lyheni}`)
  console.log(`kohdetyyppi muuttui: ${stats.tyyppi}`)
  console.log(`voittajat muuttui:   ${stats.voittajat}`)
  console.log(`ennallaan:           ${stats.ennallaan}`)
  console.log(`epäonnistui:         ${stats.epaonnistui}`)
  if (muutokset.length) {
    console.log("\nKohdetyypin muutokset:")
    for (const m of muutokset) console.log(m)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
