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
 * TILAAJA TOIVON TIEDOTTEESTA (D-343).
 *
 * Johannes 24.10.2026: *"tasta ei ole poimittu tilaajaa VAV Yhtyma Oy"*
 * ja *"siis vav yhtyma on tassa tilaaja"*.
 *
 * Teksti nimeaa tilaajan kahdesti:
 *
 *   "allekirjoittanut KVR-urakkasopimuksen VAV Yhtyma Oy:n kanssa"
 *   "toteuttamisesta VAV Yhtyma Oy:lle Vantaan Aviapolikseen"
 *
 * Kumpikaan ei ole `extractExplicitClient`in kahdessa kuviossa
 * ("tilaajana toimii X", "rakennuttajana on X"). Yleista saantoa EI
 * lisatty: A/B-mittaus 24.10.2026 naytti etta se tuo yha paikannimia
 * tilaajiksi (Myllykoske, Karhinkankaa, Niinivaara, Tapiola) ja
 * kaantaa roolin vaarin silloin kun julkaisija onkin tilaaja ("Espoon
 * Asunnot on solminut urakkasopimuksen SSA Rakennus Oy:n kanssa").
 * Siksi tama rivi korjataan kasin.
 *
 *   npx tsx scripts/korjaa-vav-tilaaja.ts
 *   npx tsx scripts/korjaa-vav-tilaaja.ts --apply
 */

const ID = "fcc3e7c3-4580-4412-8010-42de09bb583d"
const TILAAJA = "VAV Yhtymä Oy"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data: p, error } = await db
    .from("potential_projects")
    .select("id, title, metadata")
    .eq("id", ID)
    .maybeSingle()
  if (error || !p) {
    console.error(`Riviä ei löytynyt: ${error?.message ?? "ei riviä"}`)
    process.exit(1)
  }

  console.log(`\n${p.title}`)
  console.log(`   rakentaja    ${p.metadata?.builder ?? "-"}`)
  console.log(`   tilaaja      ${p.metadata?.developer ?? "-"}  ->  ${TILAAJA}`)

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivi on luettu.")
    return
  }

  const md = { ...(p.metadata ?? {}), developer: TILAAJA }
  const { error: e } = await db.from("potential_projects").update({ metadata: md }).eq("id", ID)
  if (e) {
    console.error(`VIRHE: ${e.message}`)
    process.exit(1)
  }
  console.log("\nPäivitetty.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
