import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * JONON PARIHAKU.
 *
 * Etsii jonossa olevista ehdokkaista ne, jotka ovat todennakoisesti sama
 * hanke kuin jo hyvaksytty hanke TAI toinen jonon ehdokas. Kaytetaan samoja
 * signaaleja kuin ehdotuslistassa, mutta kaydaan koko jono kerralla lapi:
 *
 *   1. sama katuosoite (+ sama kaupunki)
 *   2. otsikkokattavuus >= 0,6 ja vahintaan 2 yhteista sanaa (ei kuntanimia)
 *   3. calculateMatch >= 30 (nakyy jo ehdotuksena, mutta listataan silti)
 *
 * Ei kirjoita mitaan. Tulos on luettava riveittain.
 */

const MATCH_THRESHOLD = 30
const COVERAGE_THRESHOLD = 0.6

type Signal = "osoite" | "otsikko" | "pisteet"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { calculateMatch, titleCoverage, findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const { streetKey } = await import("../lib/projects/streetKey")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,city,region,location,phase,status,completed_at,developer,builder,property_type,is_public,metadata")
      .range(from, from + 999)
    if (error) throw error
    projects.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const cands: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("potential_projects")
      .select("id,title,address,municipality,permit_number,property_id,metadata,status,created_at")
      .eq("status", "new").range(from, from + 999)
    if (error) throw error
    cands.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  console.log(`jonossa: ${cands.length} ehdokasta   hankkeita: ${projects.length}\n`)

  const normalize = (c: any) => {
    const meta: any = c.metadata ?? {}
    return {
      name: meta.operation ?? c.title ?? null,
      sourceTitle: meta.source_title ?? null,
      city: c.municipality ?? null,
      region: meta.region ?? null,
      location: c.address ?? meta.project_address ?? null,
      permitNumber: c.permit_number ?? null,
      propertyId: c.property_id ?? null,
      developer: meta.developer ?? null,
      buildingType: meta.building_type ?? null,
      description: meta.description ?? null,
    }
  }

  const cityOf = (x: any) => String(x.city ?? x.municipality ?? "").trim().toLowerCase()

  /* ---------- 1. ehdokas <-> hyvaksytty hanke ---------- */
  const hits: {
    candidate: any
    other: any
    signals: Signal[]
    confidence: number | null
    shared: string[]
    kind: "hanke" | "ehdokas"
  }[] = []

  for (const c of cands) {
    const n = normalize(c)
    const city = cityOf(c)
    if (!city) continue

    const key = streetKey(n.location)
    const sameCity = projects.filter((p) => cityOf(p) === city)

    for (const p of sameCity) {
      const signals: Signal[] = []

      if (key && streetKey(p.location) === key) signals.push("osoite")

      const { coverage, sharedWords } = titleCoverage(n.name, p.name)
      if (sharedWords.length >= 2 && coverage >= COVERAGE_THRESHOLD) signals.push("otsikko")

      const match = calculateMatch(p as any, n as any)
      const confidence = match?.confidence ?? null
      if (confidence != null && confidence >= MATCH_THRESHOLD) signals.push("pisteet")

      if (!signals.length) continue
      hits.push({ candidate: c, other: p, signals, confidence, shared: sharedWords, kind: "hanke" })
    }
  }

  /* ---------- 2. ehdokas <-> ehdokas ---------- */
  const seen = new Set<string>()
  for (let i = 0; i < cands.length; i++) {
    for (let j = i + 1; j < cands.length; j++) {
      const a = cands[i], b = cands[j]
      if (cityOf(a) !== cityOf(b) || !cityOf(a)) continue

      const key = `${a.id}:${b.id}`
      if (seen.has(key)) continue
      seen.add(key)

      const na = normalize(a), nb = normalize(b)
      const signals: Signal[] = []

      const ka = streetKey(na.location)
      if (ka && streetKey(nb.location) === ka) signals.push("osoite")

      const { coverage, sharedWords } = titleCoverage(na.name, nb.name)
      if (sharedWords.length >= 2 && coverage >= COVERAGE_THRESHOLD) signals.push("otsikko")

      if (!signals.length) continue
      hits.push({ candidate: a, other: b, signals, confidence: null, shared: sharedWords, kind: "ehdokas" })
    }
  }

  const all = hits.filter((h) => h.kind === "hanke")
  const toCandidate = hits.filter((h) => h.kind === "ehdokas")

  /*
   * Kolme luokkaa, koska ne vaativat eri toimet:
   *
   *   NAKYMATON = osoite tai otsikko osuu, mutta pisteita alle 30. Tama on
   *               se luokka johon Herttoniemen kirkko kuului: ei nakynyt
   *               ehdotuksena eika olisi loytynyt skannauksessa.
   *   VAHVA     = pisteet >= 60, eli nakyy jo ehdotuksena korkealla.
   *   heikko    = pisteet 30-59, jatetaan pois: naita on satoja ja ne ovat
   *               jo listalla katselmoinnissa.
   */
  const nakymaton = all.filter((h) => !h.signals.includes("pisteet"))
  const vahva = all.filter((h) => (h.confidence ?? 0) >= 60)
  const heikko = all.length - nakymaton.length - vahva.length

  console.log(`pareja yhteensa: ${all.length}`)
  console.log(`  nakymattomia (osoite/otsikko, alle 30 pistetta): ${nakymaton.length}`)
  console.log(`  vahvoja (>= 60 pistetta):                        ${vahva.length}`)
  console.log(`  heikkoja 30-59 (jo ehdotuslistalla, ohitetaan):  ${heikko}\n`)

  const toProject = [...nakymaton, ...vahva]

  console.log(`=== EHDOKAS <-> HYVAKSYTTY HANKE (naytetaan ${toProject.length}) ===\n`)
  for (const h of toProject.sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))) {
    console.log(`  [${h.signals.join("+")}]${h.confidence != null ? ` pisteet ${h.confidence}` : ""}`)
    console.log(`    ehdokas: ${String(h.candidate.title).slice(0, 76)}`)
    console.log(`             ${h.candidate.address ?? "-"}  | ${(h.candidate.metadata as any)?.source_name ?? "-"}`)
    console.log(`    hanke:   ${String(h.other.name).slice(0, 76)}`)
    console.log(`             ${h.other.location ?? "-"}  | vaihe ${h.other.phase ?? "-"} | ${h.other.is_public ? "nakyva" : "piilotettu"}`)
    if (h.shared.length) console.log(`    yhteiset sanat: ${h.shared.join(" ")}`)
    console.log(`    /tic/projects/${h.candidate.id}`)
    console.log("")
  }

  /*
   * AUTOMAATTISESTI YHDISTYVAT. Hyvaksynnassa vain PARAS osuma ratkaisee, ja
   * >= 70 yhdistaa ilman kysymysta (approve/route.ts: fuzzyMatchedProjectId).
   * Nama on syyta katsoa ennen kuin painaa hyvaksy.
   */
  console.log(`=== AUTOMAATTISESTI YHDISTYVAT HYVAKSYNNASSA (paras osuma >= 70) ===\n`)

  let autoCount = 0
  for (const c of cands) {
    const n = normalize(c)
    const best = findProjectMatchDetailed(projects as any, n as any)
    if (!best || best.confidence < 70) continue

    autoCount++
    console.log(`  ${best.confidence}  ${String(c.title).slice(0, 72)}`)
    console.log(`       ehdokkaan osoite: ${c.address ?? "-"}   (${(c.metadata as any)?.source_name ?? "-"})`)
    console.log(`    -> ${String(best.project.name).slice(0, 72)}`)
    console.log(`       hankkeen osoite:  ${best.project.location ?? "-"}`)
    console.log(`       perusteet: ${best.reasons.join(", ")}`)
    console.log(`       /tic/projects/${c.id}`)
    console.log("")
  }
  console.log(`  yhteensa: ${autoCount}\n`)

  console.log(`=== EHDOKAS <-> EHDOKAS: ${toCandidate.length} paria ===\n`)
  for (const h of toCandidate) {
    console.log(`  [${h.signals.join("+")}]`)
    console.log(`    a: ${String(h.candidate.title).slice(0, 76)}`)
    console.log(`       ${h.candidate.address ?? "-"}  | ${(h.candidate.metadata as any)?.source_name ?? "-"}`)
    console.log(`    b: ${String(h.other.title).slice(0, 76)}`)
    console.log(`       ${h.other.address ?? "-"}  | ${(h.other.metadata as any)?.source_name ?? "-"}`)
    if (h.shared.length) console.log(`    yhteiset sanat: ${h.shared.join(" ")}`)
    console.log("")
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
