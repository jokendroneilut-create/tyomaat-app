/*
 * Purkaa TIC-hyväksynnässä väärin yhdistetyn ehdokkaan.
 *
 * Hyväksyntä (app/api/tic/projects/approve/route.ts) yhdistää ehdokkaan
 * olemassa olevaan hankkeeseen kun sumea täsmäytys ylittää 70. Mittauksessa
 * 73 %:n nipussa oli 16 osumaa, joista lähes kaikki olivat vääriä: eri hanke
 * samassa kaupungissa, tai saman rakennuksen eri urakkalaji (jotka pidetään
 * tarkoituksella erillään, ks. lib/projects/contractTrade.ts).
 *
 * Yhdistäminen on onneksi säästeliäs: skalaarikentät kirjoitetaan muodossa
 * `existingProject.X ?? uusiX`, eli olemassa olevan arvot voittavat eikä
 * mitään ylikirjoiteta. Vahinko rajoittuu siihen mitä yhdistäminen LISÄSI:
 *
 *   1. also_known_as sai väärän otsikon  -> tuleva täsmäytys osuu siihen
 *      merkki merkiltä ja antaa 75 pistettä (exact_distinctive_title).
 *      Tämä on vakavin: yksi virhe ruokkii seuraavia.
 *   2. project_identifiers sai ehdokkaan lupanumeron/kiinteistötunnuksen
 *      -> tuleva tuonti osuu VÄÄRÄÄN hankkeeseen 100 %:n varmuudella.
 *   3. source_count kasvoi, last_source_name/last_seen_at osoittavat väärään.
 *   4. Tyhjät sarakkeet täyttyivät ehdokkaan arvoilla.
 *   5. Ehdokas kuitattiin approved -> oikeaa hanketta ei koskaan luotu.
 *
 * Kohdat 1-3 ja 5 puretaan automaattisesti, koska ne ovat yksiselitteisesti
 * yhdistämisen jälkiä. Kohta 4 vain RAPORTOIDAAN: emme tiedä oliko kenttä
 * tyhjä ennen yhdistämistä, joten automaattinen tyhjennys voisi hävittää
 * oikeaa tietoa. Ne kentät käydään käsin.
 *
 * Vaihetta ei palauteta tässä: phaseAdvanced oli näissä pareissa epätosi
 * yhtä lukuun ottamatta, ja vaiheen siirto taaksepäin on oma päätöksensä
 * (vrt. scripts/restore-regressed-phases.ts).
 *
 * Ehdokas palautetaan tilaan "new", jolloin se palaa katselmointijonoon ja
 * voidaan hyväksyä omaksi hankkeekseen. Jonon tila on nimenomaan "new", ei
 * "pending" (ks. app/tic/services/getPotentialProjectsForReview.ts).
 *
 *   npx tsx scripts/unmerge-wrong-matches.ts                 # kuiva-ajo
 *   npx tsx scripts/unmerge-wrong-matches.ts --apply
 *   npx tsx scripts/unmerge-wrong-matches.ts --import=<uuid> --apply
 *   npx tsx scripts/unmerge-wrong-matches.ts --max-confidence=80
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null

const ONLY_IMPORT = arg("import")

/*
 * Oletusraja 74 osuu täsmälleen 73 %:n nippuun (16 kpl) ja jättää ulos
 * Lupapisteen 76 %:n, joka on eri tapaus: siinä sama kiinteistötunnus ja
 * lähes sama otsikko, vain talon numero eroaa (Vipusenkatu 1 vs 3).
 */
const MAX_CONFIDENCE = Number(arg("max-confidence") ?? 74)

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

/*
 * Sarakkeet jotka hyväksyntä täyttää ehdokkaalta jos hankkeella oli tyhjä.
 * Näitä ei pureta automaattisesti, vain raportoidaan.
 *
 * city, region ja location on jätetty pois tarkoituksella: sama kaupunki oli
 * näissä pareissa itse täsmäytyksen peruste, joten arvo on väistämättä sama
 * eikä kerro mitään siitä kirjoittiko yhdistäminen sen. Jäljelle jää ne
 * kentät joissa ehdokkaan arvo on aidosti epäilyttävä - esimerkiksi
 * rakennuttaja "SRV" hankkeella "Skanska rakentaa senioriasuntoja".
 */
const FILLED_COLUMNS = [
  "developer",
  "builder",
  "earthworks_contractor",
  "property_type",
  "estimated_completion",
] as const

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let query = supabase
    .from("project_imports")
    .select(
      "id, created_at, source_name, potential_project_id, project_id, changes, metadata"
    )
    .eq("action", "matched_existing_project")
    .order("created_at", { ascending: false })

  if (ONLY_IMPORT) query = query.eq("id", ONLY_IMPORT)

  const { data: imports, error } = await query
  if (error) throw error

  const targets = (imports ?? []).filter((row) => {
    const confidence = row.changes?.matched_existing_project?.confidence
    if (confidence == null) return false // tunnistetäsmäytys, ei sumea
    return confidence < MAX_CONFIDENCE
  })

  console.log(
    `${APPLY ? "PURETAAN" : "KUIVA-AJO"} — ${targets.length} yhdistymistä (varmuus < ${MAX_CONFIDENCE} %)\n`
  )

  for (const row of targets) {
    const [{ data: candidate }, { data: project }] = await Promise.all([
      supabase
        .from("potential_projects")
        .select("id, title, status, municipality, address, property_id, permit_number, metadata")
        .eq("id", row.potential_project_id)
        .maybeSingle(),
      supabase
        .from("projects")
        .select("*")
        .eq("id", row.project_id)
        .maybeSingle(),
    ])

    if (!candidate || !project) {
      console.log(`!! ${row.id}: ehdokas tai hanke puuttuu, ohitetaan\n`)
      continue
    }

    const confidence = row.changes?.matched_existing_project?.confidence
    console.log(`[${confidence} %] ${row.source_name} — ${row.created_at.slice(0, 10)}`)
    console.log(`   ehdokas: ${candidate.title}`)
    console.log(`   hanke:   ${project.name}`)

    /* 1. also_known_as */
    const aka: string[] = Array.isArray(project.metadata?.also_known_as)
      ? project.metadata.also_known_as
      : []
    const akaAfter = aka.filter((name) => name !== candidate.title)
    const akaRemoved = aka.length !== akaAfter.length

    /* 2. tunnisteet */
    const identifierValues = [candidate.permit_number, candidate.property_id].filter(
      Boolean
    ) as string[]
    let identifiers: { id: string; identifier_type: string; identifier_value: string }[] = []
    if (identifierValues.length) {
      const { data } = await supabase
        .from("project_identifiers")
        .select("id, identifier_type, identifier_value")
        .eq("project_id", project.id)
        .in("identifier_value", identifierValues)
      identifiers = data ?? []
    }

    /* 3. source_count */
    const sourceCount = Number(project.metadata?.source_count ?? 1)

    /* 4. vain raportointi */
    const filled = FILLED_COLUMNS.filter((column) => {
      const candidateValue =
        (candidate.metadata as Record<string, unknown>)?.[column] ?? null
      return (
        candidateValue &&
        project[column] &&
        String(project[column]).toLowerCase() === String(candidateValue).toLowerCase()
      )
    })

    console.log(`   alias poistuu:  ${akaRemoved ? `kyllä ("${candidate.title}")` : "ei ollut"}`)
    console.log(
      `   tunnisteita irti: ${identifiers.length}${
        identifiers.length
          ? ` (${identifiers.map((i) => `${i.identifier_type}=${i.identifier_value}`).join(", ")})`
          : ""
      }`
    )
    console.log(`   source_count:   ${sourceCount} -> ${Math.max(1, sourceCount - 1)}`)
    if (filled.length) {
      console.log(
        `   TARKISTA KÄSIN: ${filled
          .map((c) => `${c}="${project[c]}"`)
          .join(", ")} — sama arvo kuin ehdokkaalla`
      )
    }

    if (!APPLY) {
      console.log("")
      continue
    }

    const metadata = { ...(project.metadata ?? {}) }
    metadata.also_known_as = akaAfter
    metadata.source_count = Math.max(1, sourceCount - 1)
    /*
     * Jälki purusta itse hankkeelle, jotta myöhemmin näkee miksi alias
     * katosi ilman että joutuu kaivamaan project_imports-taulua.
     */
    metadata.unmerged_history = [
      ...(Array.isArray(metadata.unmerged_history) ? metadata.unmerged_history : []),
      {
        potential_project_id: candidate.id,
        candidate_title: candidate.title,
        confidence,
        unmerged_at: new Date().toISOString(),
      },
    ]

    const { error: updateError } = await supabase
      .from("projects")
      .update({ metadata })
      .eq("id", project.id)
    if (updateError) throw updateError

    if (identifiers.length) {
      const { error: identifierError } = await supabase
        .from("project_identifiers")
        .delete()
        .in(
          "id",
          identifiers.map((i) => i.id)
        )
      if (identifierError) throw identifierError
    }

    if (row.metadata?.source_url) {
      await supabase
        .from("project_sources")
        .delete()
        .eq("project_id", project.id)
        .eq("source_url", row.metadata.source_url)
    }

    /* 5. ehdokas takaisin jonoon */
    const candidateMetadata = { ...(candidate.metadata ?? {}) }
    delete candidateMetadata.approved_at
    delete candidateMetadata.approved_project_id
    delete candidateMetadata.matched_existing_project_id
    candidateMetadata.unmerged_from_project_id = project.id
    candidateMetadata.unmerged_reason = `Väärä sumea täsmäytys (${confidence} %)`

    const { error: candidateError } = await supabase
      .from("potential_projects")
      .update({
        status: "new",
        updated_at: new Date().toISOString(),
        metadata: candidateMetadata,
      })
      .eq("id", candidate.id)
    if (candidateError) throw candidateError

    /*
     * Tuontirivi jää historiaan mutta poistuu Yhdistymiset-sivulta, joka
     * suodattaa action = matched_existing_project.
     */
    const { error: importError } = await supabase
      .from("project_imports")
      .update({
        action: "reverted_match",
        metadata: {
          ...(row.metadata ?? {}),
          reverted_at: new Date().toISOString(),
          reverted_reason: `Väärä sumea täsmäytys (${confidence} %)`,
        },
      })
      .eq("id", row.id)
    if (importError) throw importError

    console.log("   -> purettu, ehdokas palautettu jonoon\n")
  }

  if (!APPLY) {
    console.log("Aja --apply kun tulos näyttää oikealta.")
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
