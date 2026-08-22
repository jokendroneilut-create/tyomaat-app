/*
 * Yhdistää kaksi samaa hanketta tarkoittavaa riviä.
 *
 * TIC:n duplikaattinäkymä osaa vain merkitä parin ja piilottaa toisen; itse
 * yhdistämiselle ei ole työkalua, joten tieto jäi säilyvältä hankkeelta pois.
 *
 * Poistettavaa riviä EI poisteta vaan piilotetaan (is_public = false), sama
 * kuin duplikaattinäkymän "Piilota tämä". Näin päätös on peruttavissa ja
 * historia jää talteen.
 *
 * Säilyvän arvot voittavat aina — poistettavalta täydennetään vain tyhjät.
 *
 *   npx tsx scripts/merge-duplicate-projects.ts --keep=<uuid> --remove=<uuid>
 *   npx tsx scripts/merge-duplicate-projects.ts --keep=<uuid> --remove=<uuid> --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null

const KEEP = arg("keep")
const REMOVE = arg("remove")

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
 * Sarakkeet joita täydennetään poistettavalta jos säilyvällä on tyhjä.
 * Nimeä, kaupunkia, maakuntaa tai vaihetta ei kosketa: ne ovat säilyvän
 * identiteetti, ja vaiheen siirtäminen ohittaisi phaseAdvances-säännön.
 */
const FILLABLE_COLUMNS = [
  "location",
  "developer",
  "builder",
  "property_type",
  "apartments",
  "floor_area",
  "estimated_cost",
  "construction_start",
  "estimated_completion",
  "latitude",
  "longitude",
  "additional_info",
  "structural_design",
  "hvac_design",
  "electrical_design",
  "architectural_design",
  "geotechnical_design",
  "earthworks_contractor",
]

async function main() {
  if (!KEEP || !REMOVE || KEEP === REMOVE) {
    console.log("Anna --keep=<uuid> ja --remove=<uuid> (eri hankkeet)")
    process.exit(1)
  }

  const { createClient } = await import("@supabase/supabase-js")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")
  const { mergeContacts } = await import("../lib/projects/contacts")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: rows, error } = await supabase
    .from("projects")
    .select("*")
    .in("id", [KEEP, REMOVE])

  if (error) throw error

  const keep = rows?.find((r) => r.id === KEEP)
  const remove = rows?.find((r) => r.id === REMOVE)

  if (!keep || !remove) {
    console.log("Hanketta ei löydy:", !keep ? KEEP : REMOVE)
    process.exit(1)
  }

  console.log(`SÄILYY:    "${keep.name}" (${keep.city ?? "-"}, ${keep.phase ?? "-"})`)
  console.log(`POISTUU:   "${remove.name}" (${remove.city ?? "-"}, ${remove.phase ?? "-"})\n`)

  // 1. Tyhjät sarakkeet
  const columnFills: Record<string, any> = {}
  for (const column of FILLABLE_COLUMNS) {
    const current = (keep as any)[column]
    const incoming = (remove as any)[column]
    const isEmpty = current == null || String(current).trim() === ""
    if (isEmpty && incoming != null && String(incoming).trim() !== "") {
      columnFills[column] = incoming
    }
  }

  console.log(`täydennettäviä sarakkeita: ${Object.keys(columnFills).length}`)
  for (const [k, v] of Object.entries(columnFills)) {
    console.log(`  ${k.padEnd(24)} <- ${String(v).slice(0, 70)}`)
  }

  // 2. Metadata: säilyvän arvot voittavat
  const keepMeta = keep.metadata ?? {}
  const removeMeta = remove.metadata ?? {}

  const metaFills: Record<string, any> = {}
  for (const [k, v] of Object.entries(removeMeta)) {
    if (k === "source_history" || k === "related_companies" || k === "also_known_as") continue
    /* Yhteyshenkilöt yhdistetään, ei täydennetä — ks. alla. */
    if (k === "contact_persons") continue
    const current = (keepMeta as any)[k]
    if (current == null || current === "" ) metaFills[k] = v
  }

  /*
   * YHTEYSHENKILÖT YHDISTETÄÄN, EI TÄYDENNETÄ TYHJÄÄN.
   *
   * Muut metadata-avaimet täydennetään vain jos säilyvällä on tyhjä, mutta
   * contact_persons on vain-lisäävä (D-101). Täydennyssääntö olisi
   * hävittänyt poistettavan kontaktit aina kun säilyvällä oli edes yksi:
   * mitattu 22.8.2026 Espoonlahden parissa, jossa säilyvällä oli 2 ja
   * poistettavalla 3 — ja poistettava piilotetaan, joten ne olisivat
   * kadonneet näkyvistä kokonaan.
   *
   * Yhteystiedot ovat yksi kolmesta syystä joiden takia testiasiakkaat
   * eivät jääneet maksaviksi; niitä ei hävitetä yhdistämisessä.
   */
  const mergedContacts = mergeContacts(
    Array.isArray(keepMeta.contact_persons) ? keepMeta.contact_persons : [],
    Array.isArray(removeMeta.contact_persons) ? removeMeta.contact_persons : []
  )

  const sourceHistory = [
    ...(Array.isArray(keepMeta.source_history) ? keepMeta.source_history : []),
    ...(Array.isArray(removeMeta.source_history) ? removeMeta.source_history : []),
  ]

  const relatedCompanies = mergeCompanyNames(
    keepMeta.related_companies,
    removeMeta.related_companies
  )

  /*
   * Poistettavan nimi talteen: matcher lukee also_known_as -kenttää, joten
   * saman uutisen toinen otsikkomuoto osuu jatkossa säilyvään hankkeeseen
   * eikä synnytä duplikaattia uudelleen.
   */
  const alsoKnownAs = [
    ...new Set(
      [
        ...(Array.isArray(keepMeta.also_known_as) ? keepMeta.also_known_as : []),
        remove.name,
      ]
        .map((n: unknown) => String(n ?? "").trim())
        .filter(Boolean)
        .filter((n) => n !== keep.name)
    ),
  ]

  console.log(`\nmetadata-avaimia täydennetään: ${Object.keys(metaFills).length}`)
  console.log(
    `yhteyshenkilöt: säilyvällä ${(keepMeta.contact_persons ?? []).length} + ` +
      `poistettavalla ${(removeMeta.contact_persons ?? []).length} -> ${mergedContacts.length}`
  )
  console.log(`lähdehistoria: ${(keepMeta.source_history ?? []).length} + ${(removeMeta.source_history ?? []).length} = ${sourceHistory.length}`)
  console.log(`liittyvät yritykset: ${relatedCompanies.length}`)
  console.log(`also_known_as: ${JSON.stringify(alsoKnownAs)}`)

  // 3. Käyttäjädata
  const { data: favs } = await supabase
    .from("user_project_favorites")
    .select("*")
    .eq("project_id", REMOVE)

  const { data: assignments } = await supabase
    .from("project_assignments")
    .select("*")
    .eq("project_id", REMOVE)

  const { data: keepAssignments } = await supabase
    .from("project_assignments")
    .select("*")
    .eq("project_id", KEEP)

  console.log(`\nsuosikkeja siirrettävänä:  ${favs?.length ?? 0}`)
  console.log(`vastuutuksia poistettavalla: ${assignments?.length ?? 0}`)
  console.log(`vastuutuksia säilyvällä:     ${keepAssignments?.length ?? 0}`)

  /*
   * Vastuutusta ei siirretä jos säilyvällä on jo omistaja — hankkeella on
   * yksi vastuullinen, eikä skripti valitse ihmisten välillä. Poistettavan
   * vastuutus poistetaan, ja tieto jää metadataan.
   */
  const droppedAssignments = (keepAssignments?.length ?? 0) > 0 ? assignments ?? [] : []
  const movedAssignments = (keepAssignments?.length ?? 0) > 0 ? [] : assignments ?? []

  if (droppedAssignments.length > 0) {
    console.log(`  -> säilyvällä on jo omistaja, poistettavan ${droppedAssignments.length} vastuutus(ta) poistetaan`)
  }
  if (movedAssignments.length > 0) {
    console.log(`  -> siirretään ${movedAssignments.length} vastuutus(ta) säilyvälle`)
  }

  if (!APPLY) {
    console.log("\nkuivaharjoitus — aja --apply kirjoittaaksesi")
    return
  }

  const nowIso = new Date().toISOString()

  const { error: keepError } = await supabase
    .from("projects")
    .update({
      ...columnFills,
      last_verified_at: nowIso,
      metadata: {
        ...metaFills,
        ...keepMeta,
        /* Yhdistetty lista voittaa säilyvän oman — se sisältää molemmat. */
        ...(mergedContacts.length > 0 ? { contact_persons: mergedContacts } : {}),
        source_history: sourceHistory,
        ...(relatedCompanies.length > 0 ? { related_companies: relatedCompanies } : {}),
        ...(alsoKnownAs.length > 0 ? { also_known_as: alsoKnownAs } : {}),
        merged_from_project_ids: [
          ...(Array.isArray(keepMeta.merged_from_project_ids)
            ? keepMeta.merged_from_project_ids
            : []),
          REMOVE,
        ],
      },
    })
    .eq("id", KEEP)

  if (keepError) throw keepError

  for (const fav of favs ?? []) {
    await supabase
      .from("user_project_favorites")
      .upsert({ ...fav, id: undefined, project_id: KEEP }, { onConflict: "user_id,project_id", ignoreDuplicates: true })
  }
  if ((favs?.length ?? 0) > 0) {
    await supabase.from("user_project_favorites").delete().eq("project_id", REMOVE)
  }

  for (const assignment of movedAssignments) {
    await supabase
      .from("project_assignments")
      .update({ project_id: KEEP })
      .eq("id", assignment.id)
  }

  for (const assignment of droppedAssignments) {
    await supabase.from("project_assignments").delete().eq("id", assignment.id)
  }

  const { error: removeError } = await supabase
    .from("projects")
    .update({
      is_public: false,
      metadata: {
        ...removeMeta,
        merged_into_project_id: KEEP,
        merged_at: nowIso,
        dropped_assignments: droppedAssignments.map((a) => ({
          owner_id: a.owner_id,
          team_id: a.team_id,
          assigned_at: a.assigned_at,
        })),
      },
    })
    .eq("id", REMOVE)

  if (removeError) throw removeError

  // Kirjataan pari käsitellyksi, jottei skanneri nosta sitä uudelleen.
  const [idA, idB] = [KEEP, REMOVE].sort()
  await supabase.from("project_duplicate_candidates").upsert(
    {
      project_id_a: idA,
      project_id_b: idB,
      confidence: 100,
      reasons: ["manual_merge"],
      status: "confirmed_duplicate",
      reviewed_at: nowIso,
    },
    { onConflict: "project_id_a,project_id_b" }
  )

  console.log("\nvalmis:")
  console.log(`  säilyi   ${KEEP}`)
  console.log(`  piilotettu ${REMOVE} (is_public = false, ei poistettu)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
