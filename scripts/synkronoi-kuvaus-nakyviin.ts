import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUVAUS NAKYVIIN: metadata.description -> additional_info (D-270).
 *
 * Hanke nayttaa asiakkaalle sarakkeen `additional_info` ("Lisatietoja"),
 * ei `metadata.description`:a. Hyvaksynta kirjoittaa sen kerran
 * (approve-reitti: additional_info = metadata.description), joten jo
 * hyvaksytyt hankkeet jaavat vanhaan tekstiin vaikka kuvaus taydentyisi
 * myohemmin.
 *
 * EI POISTA MITAAN. Jos nykyinen teksti ei sisally uuteen, se
 * SAILYTETAAN uuden perassa — `additional_info` on myos kentta johon on
 * kasin kirjattu esim. talotekniikkaurakoitsija.
 *
 * Rajattu niihin lahteisiin joiden kuvaukset on juuri taydennetty.
 *
 *   npx tsx scripts/synkronoi-kuvaus-nakyviin.ts
 *   npx tsx scripts/synkronoi-kuvaus-nakyviin.ts --apply
 */

/*
 * Lahteet annetaan argumentteina; ilman niita kaydaan lapi ne joiden
 * kuvaukset on taydennetty (D-268, D-270, D-271). Rajaus on tahallinen:
 * muissa lahteissa `additional_info` voi olla tarkoituksella eri teksti
 * kuin `metadata.description`.
 */
const OLETUSLAHTEET = [
  "Helsingin vireillä olevat asemakaavat (SUKKA)",
  "Euran kaavoitus ja maapolitiikka",
  "Kangasalan vireillä olevat asemakaavat",
  "Kauniaisten vireillä olevat asemakaavat",
  "Kouvolan ajankohtaiset asemakaavat",
  "Inkoon ajankohtainen kaavoitus",
  "Mustasaaren vireillä olevat asemakaavat",
]

const LAHTEET = process.argv.slice(2).filter((a) => !a.startsWith("--"))
const KAYTETYT = LAHTEET.length ? LAHTEET : OLETUSLAHTEET

function normalisoi(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const hankkeet: any[] = []
  for (let f = 0; f < 40000; f += 1000) {
    const { data, error } = await db.from("projects").select("*").range(f, f + 999)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as any[]) {
      const md = r.metadata ?? {}
      if (!KAYTETYT.includes(String(md.source_name ?? ""))) continue
      hankkeet.push(r)
    }
    if (data.length < 1000) break
  }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`hankkeita naista lahteista: ${hankkeet.length}\n`)

  let paivitettavia = 0
  let sailytettyja = 0
  let naytetty = 0

  for (const r of hankkeet) {
    const md = r.metadata ?? {}
    const kuvaus = String(md.description ?? "").trim()
    const nykyinen = String(r.additional_info ?? "").trim()
    if (!kuvaus || kuvaus.length <= nykyinen.length) continue

    /*
     * Vanha teksti on lahteen yhden rivin tiivistelma, ei kasin
     * kirjoitettu muistiinpano — mutta siina on usein faktoja joita
     * pitkasta tekstista puuttuu ("60 000 kem2", "Helen Oy:n"). Siksi
     * se sailytetaan, mutta merkittyna jottei nayta toistolta.
     *
     * Poikkeus: jos vanha teksti on vain hankkeen nimi, se ei ole
     * kuvaus eika sita liiteta.
     */
    const pelkkaNimi = normalisoi(nykyinen) === normalisoi(String(r.name ?? ""))
    const sisaltyy =
      !nykyinen || pelkkaNimi || normalisoi(kuvaus).includes(normalisoi(nykyinen))
    const uusi = sisaltyy ? kuvaus : `${kuvaus}\n\nTiivistelmä lähteestä: ${nykyinen}`
    if (!sisaltyy) sailytettyja += 1
    paivitettavia += 1

    console.log(
      `  ${String(r.name).slice(0, 48).padEnd(50)} ${String(nykyinen.length).padStart(5)} -> ${String(uusi.length).padStart(5)}${sisaltyy ? "" : "  (vanha teksti sailytetty perassa)"}`
    )

    if (!sisaltyy && naytetty < 5) {
      naytetty += 1
      console.log(`     VANHA: ${nykyinen.slice(0, 240)}`)
      console.log(`     UUSI : ${kuvaus.slice(0, 240)}`)
    }

    if (!apply) continue
    const { error } = await db.from("projects").update({ additional_info: uusi }).eq("id", r.id)
    if (error) console.log(`    VIRHE: ${error.message}`)
  }

  console.log(`\npaivitettavia ${paivitettavia}, joista vanha teksti sailytetaan ${sailytettyja}`)
  if (!apply) console.log("Ei muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
