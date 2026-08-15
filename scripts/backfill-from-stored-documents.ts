/*
 * Täydentää hankkeiden puuttuvat lähdelinkit ja lyhyet kuvaukset SIITÄ
 * TIEDOSTA JOKA ON JO KANNASSA. Ei yhtään verkkohakua.
 *
 * TAUSTA. `source_documents.raw_text` sisältää lähteen alkuperäisen
 * vastauksen, ja siellä on usein kunnollinen kuvausteksti — mutta hankkeelle
 * on tallentunut vain otsikonmittainen pätkä. Mitattu 15.8.2026: 1 571
 * hankkeella kuvaus on alle 200 merkkiä, ja 960:lla niistä dokumentissa on
 * vähintään 200 merkkiä tekstiä.
 *
 * RAW_TEXT EI OLE PROOSAA VAAN PAYLOAD. 99 % on JSONia, joten sitä EI saa
 * kopioida sellaisenaan — asiakkaan kortille tulisi `{"item":{"title":...`.
 * Kuvaus poimitaan JSONin sisältä.
 *
 * POIMINTASÄÄNTÖ ON YLEINEN, EI LÄHDEKOHTAINEN. Mitatut kentät ovat
 * `descriptionFi` (Hilma), `description` (Väylävirasto), `details.description`
 * (Lahti, Lappeenranta) ja `properties.description` (Kuopio) — kaikissa
 * esiintyy sana "description". Siksi haetaan pisin merkkijono, jonka
 * avainpolun viimeinen osa sisältää sen, eikä ylläpidetä lähdekohtaista
 * kartoitusta joka ehtisi vanhentua.
 *
 *   npx tsx scripts/backfill-from-stored-documents.ts
 *   npx tsx scripts/backfill-from-stored-documents.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

/* Lyhyempi kuin tämä on otsikonmittainen pätkä, ei kuvaus. */
const MIN_DESCRIPTION = 200

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

const DESCRIPTION_KEY = /description/i

/*
 * Proosaehto. Payloadissa on pitkiä merkkijonoja jotka eivät ole kuvauksia:
 * osoitteita, HTML:ää ja koodattua dataa. Väärä teksti on asiakkaalle
 * huonompi kuin lyhyt teksti, joten ehto on tiukka eikä salliva.
 */
function looksLikeProse(value: string): boolean {
  if (value.length < MIN_DESCRIPTION) return false
  if (/^https?:\/\//i.test(value.trim())) return false
  if (/<\/?(div|span|html|body|script|p|a)\b/i.test(value)) return false
  if (/^[{[]/.test(value.trim())) return false
  // Proosassa on välilyöntejä ja lauseita; base64/tunniste ei sisällä niitä.
  const spaces = (value.match(/\s/g) ?? []).length
  return spaces >= value.length / 25
}

function findDescription(payload: any): string | null {
  let best: string | null = null

  const visit = (node: any, key: string) => {
    if (node === null || node === undefined) return

    if (typeof node === "string") {
      if (!DESCRIPTION_KEY.test(key)) return
      if (!looksLikeProse(node)) return
      if (!best || node.length > best.length) best = node
      return
    }

    if (typeof node !== "object") return

    for (const childKey of Object.keys(node)) {
      /*
       * Taulukon indeksi ei kerro kentän merkitystä, joten avain periytyy
       * ylemmältä tasolta ("lots.0.descriptionFi" luetaan descriptioniksi).
       */
      visit(node[childKey], Array.isArray(node) ? key : childKey)
    }
  }

  visit(payload, "")
  return best
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { resolveProjectCost } = await import("../lib/projects/resolveProjectCost")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const page = async (table: string, cols: string) => {
    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return rows
  }

  console.log(`${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n`)

  const projects = (
    await page(
      "projects",
      "id, name, status, estimated_cost, additional_info, metadata"
    )
  ).filter((r: any) => r.status === "active")

  const documents = await page(
    "source_documents",
    "id, document_url, source_name, raw_text"
  )

  const docById = new Map(documents.map((d: any) => [d.id, d]))
  const docByUrl = new Map(documents.map((d: any) => [String(d.document_url), d]))

  const urlOf = (metadata: any) => {
    const history = Array.isArray(metadata?.source_history)
      ? metadata.source_history
      : []
    return (
      metadata?.source_url ??
      history.find((h: any) => h?.source_url)?.source_url ??
      null
    )
  }

  /* 1. Lähdelinkki dokumenttitunnuksen kautta. */
  const linkFixes = projects
    .filter((r: any) => !urlOf(r.metadata))
    .map((r: any) => ({
      r,
      url: docById.get(r.metadata?.source_document_id)?.document_url ?? null,
    }))
    .filter((x) => x.url)

  console.log(`LÄHDELINKIT: palautettavissa ${linkFixes.length}`)
  for (const { r, url } of linkFixes.slice(0, 5)) {
    console.log(`   ${String(r.name).slice(0, 42).padEnd(44)} ${String(url).slice(0, 62)}`)
  }

  /* 2. Kuvaus tallennetusta payloadista. */
  const descFixes: { r: any; text: string; source: string; from: number }[] = []

  for (const r of projects as any[]) {
    const current = String(r.additional_info ?? r.metadata?.description ?? "")
    if (current.length >= MIN_DESCRIPTION) continue

    const url = urlOf(r.metadata)
    const document =
      docByUrl.get(String(url)) ?? docById.get(r.metadata?.source_document_id)

    if (!document?.raw_text) continue

    let payload: any
    try {
      payload = JSON.parse(String(document.raw_text))
    } catch {
      continue
    }

    const text = findDescription(payload)
    if (!text || text.length <= current.length) continue

    descFixes.push({
      r,
      text,
      source: String(document.source_name ?? "-"),
      from: current.length,
    })
  }

  const bySource = new Map<string, number>()
  for (const f of descFixes) bySource.set(f.source, (bySource.get(f.source) ?? 0) + 1)

  console.log(`\nKUVAUKSET: poimittavissa ${descFixes.length}`)
  console.log(`  lähteittäin:`)
  for (const [k, v] of [...bySource].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${k.slice(0, 38).padEnd(40)} ${v}`)
  }

  const lengths = descFixes.map((f) => f.text.length).sort((a, b) => a - b)
  if (lengths.length) {
    console.log(
      `  pituus: mediaani ${lengths[Math.floor(lengths.length / 2)]}, lyhin ${lengths[0]}, pisin ${lengths[lengths.length - 1]}`
    )
  }

  console.log(`\n  OTOS (${Math.min(6, descFixes.length)} kpl):`)
  for (const f of descFixes.slice(0, 6)) {
    console.log(`\n  --- ${String(f.r.name).slice(0, 62)}`)
    console.log(`      ${f.from} -> ${f.text.length} merkkiä | ${f.source}`)
    console.log(`      "${f.text.slice(0, 230).replace(/\s+/g, " ")}…"`)
  }

  /* 3. Euromäärä uudesta tekstistä. */
  const costFixes = descFixes
    .map((f) => ({
      f,
      cost: resolveProjectCost({
        contractValue: f.r.metadata?.contract_value,
        text: `${f.r.name} ${f.text}`,
        existingCost: f.r.estimated_cost,
        existingSource: f.r.metadata?.cost_source,
      }),
    }))
    .filter(
      (x) =>
        x.cost && Number(x.cost.estimated_cost) !== Number(x.f.r.estimated_cost ?? 0)
    )

  console.log(`\n\nEUROMÄÄRÄ uudesta tekstistä: ${costFixes.length}`)
  for (const { f, cost } of costFixes.slice(0, 6)) {
    console.log(
      `   ${(cost!.estimated_cost / 1_000_000).toFixed(1).padStart(7)} M€  ${String(f.r.name).slice(0, 50)}`
    )
  }

  if (!APPLY) {
    console.log(`\n(kuivaharjoittelu — mitään ei kirjoitettu)`)
    return
  }

  let links = 0
  for (const { r, url } of linkFixes) {
    const { error } = await supabase
      .from("projects")
      .update({ metadata: { ...(r.metadata ?? {}), source_url: url } })
      .eq("id", r.id)
    if (!error) links++
  }

  let descs = 0
  for (const f of descFixes) {
    const cost = resolveProjectCost({
      contractValue: f.r.metadata?.contract_value,
      text: `${f.r.name} ${f.text}`,
      existingCost: f.r.estimated_cost,
      existingSource: f.r.metadata?.cost_source,
    })
    const costChanged =
      cost !== null &&
      Number(cost.estimated_cost) !== Number(f.r.estimated_cost ?? 0)

    const { error } = await supabase
      .from("projects")
      .update({
        additional_info: f.text,
        ...(costChanged ? { estimated_cost: cost!.estimated_cost } : {}),
        metadata: {
          ...(f.r.metadata ?? {}),
          description: f.text,
          ...(cost
            ? { estimated_cost: cost.estimated_cost, cost_source: cost.cost_source }
            : {}),
          description_recovered_at: new Date().toISOString(),
        },
      })
      .eq("id", f.r.id)
    if (!error) descs++
  }

  console.log(`\nkirjoitettu: lähdelinkkejä ${links}, kuvauksia ${descs}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
