import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { inferCompletionDateFromText } = await import("../lib/projects/inferCompletionDateFromText")
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  console.log("1) poimiiko nykyinen 'valmista on vuonna 2028'?")
  console.log(`   -> ${inferCompletionDateFromText("Rakentaminen alkaa elokuussa ja valmista on vuonna 2028.") ?? "EI POIMI"}\n`)

  const rows: any[] = []
  for (const t of ["projects", "potential_projects"]) {
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from(t).select("*").range(from, from + 999)
      if (!data?.length) break
      rows.push(...data.map((r: any) => ({ ...r, __t: t })))
      if (data.length < 1000) break
    }
  }
  const live = rows.filter((r: any) =>
    r.__t === "projects" ? r.status === "active" && r.is_public !== false : r.status === "new")

  /* Pelkka vuosi ilman kuukautta valmis-sanan lahella */
  const YEAR_ONLY = /valmis\w*[^.]{0,40}?\b(20\d{2})\b/i
  const MONTHS = /tammikuu|helmikuu|maaliskuu|huhtikuu|toukokuu|kesäkuu|heinäkuu|elokuu|syyskuu|lokakuu|marraskuu|joulukuu|\d{1,2}\s*(?:kk)?\s*\//i

  let yearOnly = 0, alreadyHas = 0, extractable = 0
  const samples: string[] = []
  for (const r of live) {
    const text = `${r.name ?? r.title ?? ""} ${r.additional_info ?? r.metadata?.description ?? ""}`
    const m = text.match(YEAR_ONLY)
    if (!m) continue
    const near = m[0]
    if (MONTHS.test(near)) continue
    yearOnly++
    if (r.estimated_completion || r.metadata?.estimated_completion) { alreadyHas++; continue }
    if (inferCompletionDateFromText(text)) { extractable++; continue }
    if (samples.length < 10) samples.push(`   ${String(r.name ?? r.title).slice(0,44).padEnd(46)} ...${near.replace(/\s+/g," ").slice(0,60)}...`)
  }
  console.log(`2) 'valmis ... <vuosi>' ilman kuukautta: ${yearOnly} rivia`)
  console.log(`   ...joilla paiva jo kentassa:   ${alreadyHas}`)
  console.log(`   ...jotka nykyinen poimii muuten: ${extractable}`)
  console.log(`   ...jotka jaavat poimimatta:    ${yearOnly - alreadyHas - extractable}\n`)
  for (const s of samples) console.log(s)
}
main().catch((e) => { console.error(e); process.exit(1) })
