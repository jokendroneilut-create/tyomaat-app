import { readFileSync, writeFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUIVAHARJOITUS: HELSINGIN KILPAILUTUS-LUOKKA (D-386).
 *
 * Lukee Ahjon Kilpailutus-luokan, ajaa TUOTANNON oman saannon ja
 * TUOTANNON oman ehdokasrakennuksen, ja tasmayttaa tuloksen kannan
 * hankkeisiin tuotannon tasmayttimella. Mikaan saanto ei ole tassa
 * skriptissa: jos se olisi, luettu rivi ei todistaisi mitaan
 * kirjoitettavasta rivista (ks. muisti:
 * metric-shares-parser-blind-spot).
 *
 * Luettavaksi tulostetaan jokaiselta hyvaksytylta rivilta:
 * otsikko -> nimi, paatospaiva, voittaja, hinta, vaihe, osoite seka
 * tasmaytyksen tulos (hanke, varmuus, syyt) -- eli tasan ne kohdat
 * jotka Johannes pyysi tarkistamaan.
 *
 *   npx tsx scripts/kuivaharjoitus-helsingin-kilpailutus.ts
 *   npx tsx scripts/kuivaharjoitus-helsingin-kilpailutus.ts --kuukaudet 12
 *   npx tsx scripts/kuivaharjoitus-helsingin-kilpailutus.ts --asia "HEL 2026-010171"
 */
import {
  KILPAILUTUS_CATEGORY,
  kilpailutusHyvaksytaan,
  onKilpailutusluokka,
  onPoydallePano,
  paatoksenLuokat,
  paatoksestaEhdokas,
  shouldExclude,
} from "../lib/agent/fetchHelsinkiPaatoksetSource"
import { extractCostFromText } from "../lib/projects/extractCostFromText"
import { findProjectMatchDetailed } from "../lib/agent/projectMatcher"

const SEARCH_URL =
  "https://paatokset-elastic-proxy.api.hel.ninja/paatokset_decisions/_search"
const RAPORTTI = "C:/Users/johan/tyomaat-app/.tmp-kilpailutus-kuiva.txt"

const argKuukaudet = process.argv.indexOf("--kuukaudet")
const KUUKAUDET = argKuukaudet > 0 ? Number(process.argv[argKuukaudet + 1]) : 3
const argAsia = process.argv.indexOf("--asia")
const ASIA = argAsia > 0 ? process.argv[argAsia + 1] : null

const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)

async function haeSivu(body: unknown): Promise<any[]> {
  const res = await fetch(SEARCH_URL, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`ES ${res.status}`)
  const json = await res.json()
  return json?.hits?.hits ?? []
}

const KENTAT = [
  "subject",
  "issue_subject",
  "decision_content",
  "decision_motion",
  "decision_url",
  "organization_name",
  "meeting_date",
  "unique_issue_id",
  "category_name",
]

async function haeKilpailutus(): Promise<any[]> {
  if (ASIA) {
    return haeSivu({
      query: { bool: { filter: [{ term: { unique_issue_id: ASIA } }] } },
      _source: KENTAT,
      size: 20,
    })
  }
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - KUUKAUDET)
  const kaikki: any[] = []
  for (let page = 0; page < 20; page++) {
    const hits = await haeSivu({
      query: {
        bool: {
          filter: [
            { terms: { category_name: [KILPAILUTUS_CATEGORY] } },
            { range: { meeting_date: { gte: cutoff.toISOString() } } },
          ],
        },
      },
      _source: KENTAT,
      /* Ratkaisija kuten tuotannossa: ilman sita sivutuksesta katoaa rivi. */
      sort: [
        { meeting_date: "desc" },
        { unique_issue_id: "asc" },
        { decision_url: "asc" },
      ],
      size: 100,
      from: page * 100,
    })
    if (!hits.length) break
    kaikki.push(...hits)
    if (hits.length < 100) break
  }
  return kaikki
}

async function main() {
  const hits = await haeKilpailutus()
  console.log(
    `Kilpailutus-luokasta ${hits.length} osumaa (${ASIA ? `asia ${ASIA}` : `${KUUKAUDET} kk`})\n`
  )

  const nahdyt = new Set<string>()
  const lapi: any[] = []
  const pudonneet: { subject: string; syy: string }[] = []

  for (const hit of hits) {
    const s = hit?._source ?? {}
    const subject = String(first(s.subject) ?? "").replace(/\s+/g, " ").trim()
    const relativeUrl = String(first(s.decision_url) ?? "").trim()
    if (!subject || !relativeUrl) continue

    const issueId = String(first(s.unique_issue_id) ?? relativeUrl)
    if (nahdyt.has(issueId)) continue
    nahdyt.add(issueId)

    if (shouldExclude(subject)) {
      pudonneet.push({ subject, syy: "EXCLUDE_PATTERNS" })
      continue
    }
    if (!kilpailutusHyvaksytaan(subject, paatoksenLuokat(s))) {
      pudonneet.push({ subject, syy: "kilpailutussaanto" })
      continue
    }
    if (
      onKilpailutusluokka(s) &&
      onPoydallePano(String(first(s.decision_content) ?? ""))
    ) {
      pudonneet.push({ subject, syy: "poydallepano" })
      continue
    }
    lapi.push({ s, subject, issueId })
  }

  console.log(`LAPI ${lapi.length}, PUDONNEET ${pudonneet.length}\n`)

  /* Tasmayttimen lista haetaan kerran: instanssi on NANO. */
  const { loadProjectsForMatching } = await import("../lib/agent/importCandidate")
  const hankkeet = await loadProjectsForMatching()
  console.log(`tasmaytyslistalla ${hankkeet.length} hanketta\n`)

  const rivit: string[] = []
  const tulosta = (t: string) => {
    console.log(t)
    rivit.push(t)
  }

  let osuvia = 0
  let voittajallisia = 0
  let hinnallisia = 0

  for (const { s, subject, issueId } of lapi) {
    const e: any = paatoksestaEhdokas(s)
    const kuvaus: string = e.description ?? ""
    const sopimusarvo: number | null = e.metadata?.contract_value ?? null
    const tekstihinta = extractCostFromText([kuvaus, e.name].filter(Boolean).join(" "))
    const hinta = sopimusarvo ?? tekstihinta

    /* `winners` on merkkijonolista (extractDecisionWinners). */
    const voittajat: string[] = (e.winners ?? []).map((w: any) =>
      typeof w === "string" ? w : String(w?.name ?? "")
    )
    const osuma = findProjectMatchDetailed(hankkeet, {
      name: e.name ?? null,
      city: e.city ?? null,
      region: e.region ?? null,
      location: e.location ?? null,
      permitNumber: e.permit_number ?? null,
      propertyId: null,
      developer: e.developer ?? null,
      builder: voittajat[0] ?? null,
      buildingType: e.property_type ?? null,
      winners: e.winners ?? null,
      estimatedCompletion: null,
      constructionStart: null,
      description: kuvaus || null,
    } as any)

    const osui = osuma && osuma.confidence >= 70 ? osuma : null
    if (osui) osuvia++
    if (e.winners?.length) voittajallisia++
    if (hinta) hinnallisia++

    tulosta("".padEnd(78, "-"))
    tulosta(`OTSIKKO   ${subject}`)
    tulosta(`NIMI      ${e.name}`)
    tulosta(`ASIA      ${issueId}   paatos ${e.metadata?.decision_date ?? "-"}   ${String(first(s.organization_name) ?? "")}`)
    tulosta(`VOITTAJA  ${voittajat.join(" // ") || "-"}`)
    tulosta(
      `HINTA     ${hinta ? hinta.toLocaleString("fi-FI") + " EUR" : "-"}` +
        `   (sopimusarvo ${sopimusarvo ? sopimusarvo.toLocaleString("fi-FI") : "-"}, tekstista ${tekstihinta ? tekstihinta.toLocaleString("fi-FI") : "-"})`
    )
    tulosta(`VAIHE     ${e.phase}`)
    tulosta(`OSOITE    ${e.location ?? "-"}   tyyppi ${e.property_type ?? "-"}`)
    tulosta(`KUVAUS    ${kuvaus.slice(0, 220)}`)
    if (osuma) {
      tulosta(
        `TASMAYS   ${osui ? "OSUU" : "EI OSU"} ${osuma.confidence} % | ${osuma.project.name} | ${osuma.project.id}`
      )
      tulosta(
        `          syyt: ${(osuma.reasons ?? []).join(", ")} | kannassa vaihe ${osuma.project.phase ?? "-"}, urakoitsija ${osuma.project.builder ?? "-"}`
      )
    } else {
      tulosta(`TASMAYS   ei ehdokasta -> UUSI RIVI jonoon`)
    }
    tulosta(`LAHDE     ${e.source_url}`)
  }

  tulosta("")
  tulosta("=== PUDONNEET ===")
  for (const p of pudonneet) {
    tulosta(`  [${p.syy}] ${p.subject.slice(0, 120)}`)
  }

  tulosta("")
  tulosta("=== YHTEENVETO ===")
  tulosta(`  lapi ${lapi.length}: osuu olemassa olevaan ${osuvia}, uusi rivi ${lapi.length - osuvia}`)
  tulosta(`  voittaja poimittu ${voittajallisia}/${lapi.length}, hinta ${hinnallisia}/${lapi.length}`)

  writeFileSync(RAPORTTI, rivit.join("\n"), "utf8")
  console.log(`\ntuotos ${RAPORTTI}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
