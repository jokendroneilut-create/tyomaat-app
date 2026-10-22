import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TAMPEREEN 404-SIVULTA LUETUT OTSIKOT (D-337).
 *
 * Keraaja otti `details.title` myos epaonnistuneesta hausta, joten
 * kolmen kuolleen kaavan otsikoksi tuli Tampereen 404-sivun otsikko
 * "Harmi - sivua ei loytynyt". Keraaja on korjattu (ei ota mitaan
 * kenttaa epaonnistuneesta hausta), ja seuraava ajo laskee otsikon
 * varasaannolla UUDELLEEN -- mutta vain jos kaava on viela WFS-syotteessa.
 * Tama korjaa rivit nyt, jottei vaara otsikko jaa roikkumaan jos kaava
 * on poistunut syotteesta.
 *
 * Rivit eivat ole koskaan tuottaneet ehdokasta (status "downloaded"),
 * joten mikaan asiakkaalle nakyva ei muutu.
 *
 *   npx tsx scripts/korjaa-tampereen-404-otsikot.ts
 *   npx tsx scripts/korjaa-tampereen-404-otsikot.ts --apply
 */

const LAHDE = "Tampereen vireillä olevat kaavat"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data: src } = await db.from("discovery_sources").select("id").eq("name", LAHDE).maybeSingle()
  if (!src) {
    console.error("Lähdettä ei löytynyt")
    process.exit(1)
  }

  const { data: rivit, error } = await db
    .from("source_documents")
    .select("id, title, document_url, raw_payload")
    .eq("source_id", src.id)
    .ilike("title", "%sivua ei löytynyt%")
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }

  for (const r of rivit ?? []) {
    const p: any = r.raw_payload ?? {}
    const tunnus = p.kaava_tunnus ?? p.original?.properties?.ID ?? null
    if (!tunnus) {
      console.log(`   OHITETAAN (ei tunnusta)  ${r.document_url}`)
      continue
    }
    const uusi = `Asemakaava nro ${tunnus}`
    console.log(`   "${r.title}" -> "${uusi}"   ${r.document_url}`)
    if (!apply) continue
    const { error: e } = await db.from("source_documents").update({ title: uusi }).eq("id", r.id)
    if (e) console.error(`      VIRHE: ${e.message}`)
  }

  console.log(`\nRivejä ${(rivit ?? []).length}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
