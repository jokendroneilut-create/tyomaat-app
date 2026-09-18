import { readFileSync } from "node:fs"
import * as cheerio from "cheerio"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HÄMEENLINNAN YHTEYSHENKILÖILLE PUHELIN JA SÄHKÖPOSTI (D-198).
 *
 * Kaavalistassa lukee vain "Yhteyshenkilö: <nimi>", mutta samalla sivulla
 * on kaavoituksen henkilöhakemisto. Yksi sivupyyntö. Vain tyhjät kentät
 * täytetään; titteli vain jos se on paikkamerkki "Kaavoitus".
 *
 *   npx tsx scripts/fix-hameenlinna-yhteystiedot.ts            (kuivaharjoitus)
 *   npx tsx scripts/fix-hameenlinna-yhteystiedot.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const URL = "https://www.hameenlinna.fi/asuminen-ja-ymparisto/kaavoitus/vireilla-olevat-kaavat/"
const LAHDE = "Hämeenlinnan vireillä olevat kaavat"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractContacts } = await import("../lib/projects/contacts")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const $ = cheerio.load(await (await fetch(URL, { headers: { "User-Agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" } })).text())
  $("script, style").remove()
  const hakemisto = extractContacts($("body").text())
  console.log(`hakemistossa ${hakemisto.length} henkilöä`)

  let n = 0
  let eiLoydy = 0
  for (const taulu of ["projects", "potential_projects"] as const) {
    const { data, error } = await db.from(taulu).select("id, metadata").eq("metadata->>source_name", LAHDE)
    if (error) throw error
    for (const r of (data ?? []) as any[]) {
      const nyt: any[] = Array.isArray(r.metadata?.contact_persons) ? r.metadata.contact_persons : []
      let muuttui = false
      const uusi = nyt.map((c) => {
        if (!c?.name || (c.phone && c.email)) return c
        const h = hakemisto.find((x) => (x.name ?? "").trim().toLowerCase() === String(c.name).trim().toLowerCase())
        if (!h) { eiLoydy++; return c }
        muuttui = true
        return {
          ...c,
          phone: c.phone || h.phone || null,
          email: c.email || h.email || null,
          title: !c.title || c.title === "Kaavoitus" ? h.title ?? c.title : c.title,
        }
      })
      if (!muuttui) continue
      n++
      console.log(`${taulu} ${r.id.slice(0, 8)}: ${uusi.map((c) => `${String(c.name).split(" ")[0]} X | ${c.title ?? "-"} | ${c.phone ? "puh" : "-"} | ${c.email ? "email" : "-"}`).join(" ;; ")}`)
      if (APPLY) {
        const { error: e } = await db.from(taulu).update({ metadata: { ...r.metadata, contact_persons: uusi } }).eq("id", r.id)
        if (e) throw e
      }
    }
  }
  console.log(`\nnimeä ei hakemistossa: ${eiLoydy}`)
  console.log(`=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"}: ${n} riviä ===`)
}
main().catch((e) => { console.error(e); process.exit(1) })
