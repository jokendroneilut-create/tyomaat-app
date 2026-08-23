import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RAKENNUSLEHDEN EHDOKKAILLE PUUTTUVA KUNTA.
 *
 * Sarake on `municipality`, EI `city`. Ensimmainen mittaus luki
 * olematonta `city`-kenttaa ja paatteli siita, etta kaikilta 50
 * ehdokkaalta puuttuu kunta. Oikea luku on 11.
 *
 * Niista 11:sta vain KOLME on korjattavissa. Loput kahdeksan ovat
 * oikein tyhjia:
 *
 *   Viro, Liettua (x2)   ulkomailla, ei suomalaista kuntaa
 *   viisi markkinauutista ("Datakeskusbuumi nakyy tukkukaupassa",
 *   "Skanska-pomo varoittaa") joilla ei ole tyomaata lainkaan
 *
 * TAMA LISTA ON LUETTU RIVEITTAIN 23.8.2026, ei paatelty ajossa.
 * Automaattinen paattely olisi tuottanut virheita: "Varte rakentaa
 * hoivakotia Nokialle" antoi Tampereen, koska kuvauksessa lukee
 * yrityksen nimi "Varte Tampere". Vaara kunta on pahempi kuin puuttuva -
 * se siirtaa hankkeen vaaran asiakkaan hakuvahtiin.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

/* Luettu ja tarkistettu yksitellen otsikkoa ja kuvausta vasten. */
const VERIFIED: Record<string, string> = {
  /* "Paraisten keskustaan suunniteltu hirsikerrostalohanke" */
  "1c779037-442c-4778-9598-df4cf6051f68": "Parainen",
  /* "Rovaniemen uuden paapoliisiaseman tyot Verstaantiella" */
  "140b8fe9-3f2b-4c01-b293-2fac06d7dc95": "Rovaniemi",
  /* "Fira ... Lappeenrannan Pajarilan teollisuusalueelle" */
  "16c664db-b121-4921-a769-292f302fdc9d": "Lappeenranta",
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { getMunicipalityByName } = await import("../lib/geo/municipalities")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`luettuja rivja: ${Object.keys(VERIFIED).length}\n`)

  let kirjoitettavia = 0
  const varoitukset: string[] = []

  for (const [id, kaupunki] of Object.entries(VERIFIED)) {
    const { data: p, error } = await supabase
      .from("potential_projects")
      .select("*")
      .eq("id", id)
      .maybeSingle()
    if (error) throw error

    if (!p) { varoitukset.push(`  rivia ei loydy: ${id}`); continue }

    /* Kunnan on oltava oikea kunta, ei kirjoitusvirhe. */
    if (!getMunicipalityByName(kaupunki)) {
      varoitukset.push(`  tuntematon kunta "${kaupunki}" (${id})`)
      continue
    }

    /* Jos kaupunki on ehtinyt tulla muuta kautta, sita ei ylikirjoiteta. */
    const nykyinen = String(p.municipality ?? "").trim()
    if (nykyinen) {
      varoitukset.push(`  kunta jo asetettu "${nykyinen}", ei kosketa (${String(p.title).slice(0, 40)})`)
      continue
    }

    kirjoitettavia++
    console.log(`  ${kaupunki.padEnd(13)} ${String(p.title).slice(0, 66)}`)

    if (!APPLY) continue

    const { error: e } = await supabase
      .from("potential_projects")
      .update({
        municipality: kaupunki,
        metadata: { ...(p.metadata ?? {}), city_source: "kasin_luettu_2026-08-23" },
      })
      .eq("id", id)
    if (e) throw e
  }

  console.log(`\nkirjoitettavia: ${kirjoitettavia}`)
  if (varoitukset.length) { console.log("\nhuomiot:"); for (const v of varoitukset) console.log(v) }
  if (!APPLY) console.log("\n(kuivaharjoitus — aja --apply)")
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
