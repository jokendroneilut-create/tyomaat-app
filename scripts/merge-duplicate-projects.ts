import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAHDEN HANKKEEN YHDISTÄMINEN NIIN, ETTÄ TIETO SIIRTYY.
 *
 * Olemassa oleva duplikaattikäsittely (`/api/tic/duplicates/hide-project`)
 * vain piilottaa hävinneen rivin — se EI siirrä mitään. Jos rivit tietävät
 * eri asioita, piilotus siis hävittää sen mitä vain hävinnyt tiesi.
 *
 * Mitattu tapaus 18.8.2026: Espoon Prismakeskus oli kannassa kahtena.
 * Toisella oli oikea kaupunki (Espoo), tyyppi (Kauppa) ja rakennuttajan
 * oikea kirjoitusasu; toisella pääurakoitsija (Skanska Oy). Pelkkä
 * piilotus olisi hävittänyt Skanskan.
 *
 * SÄÄNTÖ: säilyvälle riville täytetään VAIN TYHJÄT kentät. Olemassa olevaa
 * ei ylikirjoiteta, koska säilyväksi valitaan se rivi jonka tiedot ovat
 * oikein — muuten valinta olisi tehty väärin päin.
 *
 * Käyttö:
 *   npx tsx scripts/merge-duplicate-projects.ts <säilyvä> <hävinnyt> [--apply]
 */

const [keepId, dropId] = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const APPLY = process.argv.includes("--apply")

/* Kentät jotka voidaan periä hävinneeltä, jos säilyvältä puuttuu. */
const INHERITABLE = [
  "developer",
  "builder",
  "location",
  "property_type",
  "estimated_cost",
  "estimated_completion",
  "region",
  "city",
] as const

async function main() {
  if (!keepId || !dropId) {
    console.error("Anna kaksi tunnistetta: <säilyvä> <hävinnyt>")
    process.exit(1)
  }

  const { createClient } = await import("@supabase/supabase-js")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabase.from("projects").select("*").in("id", [keepId, dropId])
  if (error) throw error

  const keep: any = (data ?? []).find((r: any) => r.id === keepId)
  const drop: any = (data ?? []).find((r: any) => r.id === dropId)

  if (!keep || !drop) {
    console.error("Hanketta ei löydy")
    process.exit(1)
  }

  /*
 * Kirjoitusasultaan lähes sama nimi on sama yritys.
 *
 * Kuivaharjoitus 18.8.2026: hävinneellä rivillä rakennuttaja oli
 * "HOK-Elanno" (allatiivin "HOK-Elannolle" väärä perusmuoto) ja
 * säilyvällä oikein "HOK-Elanto". Ilman tätä tarkistusta väärä
 * kirjoitusasu olisi lisätty liittyväksi yritykseksi omana rivinään.
 */
function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-zåäö0-9]/g, "")
}

function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }
  return d[a.length][b.length]
}

function isNearDuplicateName(name: string, existing: (string | null)[]): boolean {
  const a = normalizeName(name)
  if (!a) return true
  return existing.some((other) => {
    if (!other) return false
    const b = normalizeName(other)
    return b.length > 0 && editDistance(a, b) <= 2
  })
}

const empty = (v: any) => v === null || v === undefined || String(v).trim() === ""

  const updates: Record<string, unknown> = {}
  for (const field of INHERITABLE) {
    if (empty(keep[field]) && !empty(drop[field])) updates[field] = drop[field]
  }

  /*
   * Hävinneen osapuolet talteen liittyvinä yrityksinä myös silloin kun ne
   * eivät mahtuneet omiin kenttiinsä — muuten tieto katoaisi hiljaa.
   */
  const related = mergeCompanyNames(
    Array.isArray(keep.metadata?.related_companies) ? keep.metadata.related_companies : [],
    Array.isArray(drop.metadata?.related_companies) ? drop.metadata.related_companies : [],
    [drop.developer, drop.builder].filter(Boolean)
  ).filter(
    (name) =>
      !isNearDuplicateName(name, [
        keep.developer,
        keep.builder,
        updates.developer as string,
        updates.builder as string,
      ])
  )

  /* Pisin kuvaus voittaa, kuten runkotyöntekijässäkin. */
  const description =
    String(drop.additional_info ?? "").length > String(keep.additional_info ?? "").length
      ? drop.additional_info
      : keep.additional_info

  console.log(APPLY ? "=== YHDISTETÄÄN ===" : "=== KUIVAHARJOITUS ===")
  console.log(`säilyy:   ${keep.name}`)
  console.log(`          ${keep.city} · ${keep.property_type} · ${keep.developer ?? "-"} / ${keep.builder ?? "-"}`)
  console.log(`häviää:   ${drop.name}`)
  console.log(`          ${drop.city} · ${drop.property_type} · ${drop.developer ?? "-"} / ${drop.builder ?? "-"}`)
  console.log(`\nperitään säilyvälle:`)
  if (Object.keys(updates).length === 0) console.log("   (ei mitään — säilyvällä on jo kaikki)")
  for (const [k, v] of Object.entries(updates)) console.log(`   ${k.padEnd(22)} ${v}`)
  console.log(`liittyvät yritykset:   ${related.length ? related.join(", ") : "-"}`)
  console.log(`kuvaus:                ${String(description ?? "").length} merkkiä (oli ${String(keep.additional_info ?? "").length})`)

  if (!APPLY) return

  const nowIso = new Date().toISOString()

  const { error: keepError } = await supabase
    .from("projects")
    .update({
      ...updates,
      additional_info: description,
      metadata: {
        ...(keep.metadata ?? {}),
        ...(related.length ? { related_companies: related } : {}),
        merged_from: [
          ...(Array.isArray(keep.metadata?.merged_from) ? keep.metadata.merged_from : []),
          { project_id: dropId, name: drop.name, merged_at: nowIso, inherited: Object.keys(updates) },
        ],
      },
    })
    .eq("id", keepId)

  if (keepError) throw keepError

  /* Hävinnyt piilotetaan mutta säilytetään: se estää saman tuonnin uudelleen. */
  const { error: dropError } = await supabase
    .from("projects")
    .update({
      is_public: false,
      metadata: {
        ...(drop.metadata ?? {}),
        merged_into_project_id: keepId,
        hidden_at: nowIso,
        hidden_reason: `Yhdistetty hankkeeseen ${keepId}`,
      },
    })
    .eq("id", dropId)

  if (dropError) throw dropError

  console.log("\nvalmis.")
}

main().catch((e) => { console.error(e); process.exit(1) })
