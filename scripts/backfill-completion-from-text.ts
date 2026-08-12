/*
 * Poimii hankkeen valmistumisajan kuvaustekstistä jonoriveille.
 *
 * TÄMÄ AJO ON MAHDOLLINEN VASTA NYT. Aiemmin poimija hyväksyi minkä
 * tahansa päivän jonka lähellä oli "valmis"-vartaloinen sana, ja
 * hankkeiden elinkaaren alussa valmistuu nimenomaan papereita:
 * "kehitys- ja hankesuunnitelmat valmistuvat elokuussa 2026" olisi
 * merkinnyt 45 miljoonan euron sairaalahankkeen valmiiksi ennen kuin
 * rakentaminen edes alkaa.
 *
 * Asiakirjasääntö pudotti ehdokkaat 87:stä 27:ään.
 *
 * MENNYT PÄIVÄ ON ERI ASIA KUIN TULEVA. Tuleva päivä on pelkkä lisätieto
 * kortilla. Mennyt päivä sen sijaan johtaa siihen että
 * auto-complete-cron merkitsee hankkeen valmistuneeksi ja se katoaa
 * asiakkaan listalta, joten menneet raportoidaan erikseen.
 *
 *   npx tsx scripts/backfill-completion-from-text.ts
 *   npx tsx scripts/backfill-completion-from-text.ts --apply
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

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { inferCompletionDateFromText } = await import(
    "../lib/projects/inferCompletionDateFromText"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rows: any[] = []
  const page = async (table: string, cols: string) => {
    const out: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(cols).range(from, from + 999)
      if (error) throw error
      out.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return out
  }

  /*
   * MOLEMMAT TAULUT. Jonorivillä päivä on pelkkää lisätietoa, mutta
   * hyväksytyllä hankkeella se ohjaa auto-complete-cronia - asiakasnäkymä
   * on siis se paikka jossa puuttuva päivä oikeasti maksaa.
   */
  rows.push(
    ...(await page("potential_projects", "id, title, status, metadata")).map((r: any) => ({
      ...r,
      table: "potential_projects",
      label: r.title,
    })),
    ...(
      await page("projects", "id, name, status, estimated_completion, additional_info, metadata")
    ).map((r: any) => ({ ...r, table: "projects", label: r.name }))
  )

  const hits = rows
    .filter((r) =>
      r.table === "potential_projects"
        ? r.status === "new" && !r.metadata?.estimated_completion
        : r.status === "active" && !r.estimated_completion
    )
    .map((r) => ({
      r,
      date: inferCompletionDateFromText(
        String(r.metadata?.description ?? r.additional_info ?? "")
      ),
    }))
    .filter((x): x is { r: any; date: string } => Boolean(x.date))

  const today = new Date().toISOString().slice(0, 10)
  const past = hits.filter((x) => x.date < today)
  const future = hits.filter((x) => x.date >= today)

  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"}\n` +
      `  poimittavissa: ${hits.length}\n` +
      `    tulevia:  ${future.length}\n` +
      `    menneita: ${past.length}  (nama johtavat valmistuneeksi merkitsemiseen)\n`
  )

  for (const { r, date } of past) {
    console.log(`  MENNYT ${date}  [${r.table === "projects" ? "nakyva" : "jono"}] ${String(r.label).slice(0, 50)}`)
  }
  console.log("")
  for (const { r, date } of future.slice(0, 12)) {
    console.log(`  ${date}  [${r.table === "projects" ? "nakyva" : "jono"}] ${String(r.label).slice(0, 50)}`)
  }

  if (!APPLY) return

  let done = 0
  for (const { r, date } of hits) {
    const patch: Record<string, any> =
      r.table === "projects"
        ? { estimated_completion: date, metadata: { ...r.metadata, estimated_completion: date } }
        : { metadata: { ...r.metadata, estimated_completion: date } }

    const { error } = await supabase.from(r.table).update(patch).eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.id}: ${error.message}`)
    else done++
  }
  console.log(`\nkirjoitettu: ${done}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
