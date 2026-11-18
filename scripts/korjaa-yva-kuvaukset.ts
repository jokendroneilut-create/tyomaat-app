import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YVA-HANKKEIDEN VANHENTUNEET KUVAUKSET JA DIAARINUMEROT (D-437).
 *
 * Osumapolku ei paivittanyt kuvausta (korjattu: kuvauksenPaivitys.ts), ja
 * YVA-sivu julkaistaan usein tynkana. Mitattu 18.11.2026: 26 YVA-rivia,
 * joiden kuvaus on moninkertaisesti lyhyempi kuin sivu nyt; 24 niista
 * koskemattomia (kuvaus = lahteen alkuperainen teksti).
 *
 * Kaksi asiaa:
 *   1. diaarinumero `yva_diaarinumero`-tunnisteeksi jokaiselle hankkeelle
 *      jonka sivu on haussa, jotta uudelleen nimetty sivu osuu oikeaan
 *      riviin;
 *   2. kuvaus samalla saannolla kuin osumapolku (`paivitettyKuvaus`):
 *      vain koskematon tai tynka, vain sama lahde, ei lyhennysta.
 *
 * Uudelleen nimetty sivu tunnistetaan diaarinumerosta, joka on jo
 * hankkeen tekstissa. Silloin myos lahdelinkki siirtyy uuteen osoitteeseen.
 *
 * Kosketut rivit saavat merkinnan `metadata.yva_kuvaus_korjattu`
 * (muisti: backfill-marker).
 *
 *   npx tsx scripts/korjaa-yva-kuvaukset.ts           # kuivaharjoitus
 *   npx tsx scripts/korjaa-yva-kuvaukset.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const MERKINTA = "2026-11-18"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { fetchYvaSource, yvaDiaarinumerot } = await import("../lib/agent/fetchYvaSource")
  const { paivitettyKuvaus } = await import("../lib/projects/kuvauksenPaivitys")
  const { kanoninenLahdeUrl } = await import("../lib/projects/lahdeUrl")
  const { linkIdentifier } = await import("../lib/projects/identity")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const sivut: any[] = await fetchYvaSource()
  console.log(`YVA-haku: ${sivut.length} sivua`)

  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db.from("projects").select("id,name,is_public,additional_info,metadata").eq("metadata->>source_name", "yva").range(a, a + 999)
    if (error) throw error
    hankkeet.push(...(data ?? [])); if ((data ?? []).length < 1000) break
  }
  console.log(`YVA-hankkeita kannassa: ${hankkeet.length}\n`)

  const urlilla = new Map(hankkeet.map((h) => [kanoninenLahdeUrl(h.metadata?.source_url ?? ""), h]))
  const diaarilla = new Map<string, any>()
  for (const h of hankkeet)
    for (const d of yvaDiaarinumerot(`${h.additional_info ?? ""} ${h.metadata?.description ?? ""}`)) diaarilla.set(d, h)

  let tunnisteita = 0, kuvauksia = 0, siirtoja = 0
  for (const s of sivut) {
    const diaarit: string[] = (s.identifiers ?? []).map((t: any) => t.value)
    let h = urlilla.get(kanoninenLahdeUrl(s.source_url))
    let tunnisteella = false
    if (!h) {
      h = diaarit.map((d) => diaarilla.get(d)).find(Boolean)
      tunnisteella = !!h
    }
    if (!h) continue

    const uusi = paivitettyKuvaus({
      nykyinen: h.additional_info,
      lahteenEdellinen: h.metadata?.description,
      uusi: s.description,
      samaLahde: true,
    })

    tunnisteita += diaarit.length
    if (uusi) kuvauksia++
    if (uusi && tunnisteella) siirtoja++
    if (uusi || tunnisteella)
      console.log(
        `${uusi ? "KUVAUS" : "      "} ${tunnisteella ? "SIIRTO" : "      "} ${h.is_public ? "näkyvä" : "piilo "} | ${String(h.additional_info ?? "").length} -> ${uusi ? uusi.length : "-"} | ${h.name.slice(0, 60)}${tunnisteella ? `\n        ${h.metadata?.source_url}\n     -> ${s.source_url}` : ""}`
      )

    if (!APPLY) continue
    for (const d of diaarit) {
      await linkIdentifier({ type: "yva_diaarinumero", value: d, projectId: h.id, sourceName: "yva", supabase: db as any })
    }
    if (uusi || tunnisteella) {
      const metadata = {
        ...(h.metadata ?? {}),
        ...(uusi ? { description: uusi, kuvaus_paivitetty: new Date().toISOString() } : {}),
        yva_kuvaus_korjattu: MERKINTA,
        ...(diaarit.length ? { yva_diaarinumerot: diaarit } : {}),
        /* Uudelleen nimetty sivu: linkki uuteen osoitteeseen kuvauksesta riippumatta. */
        ...(tunnisteella ? { source_url: s.source_url, aiempi_source_url: h.metadata?.source_url ?? null } : {}),
      }
      const { error } = await db.from("projects").update({ ...(uusi ? { additional_info: uusi } : {}), metadata }).eq("id", h.id)
      if (error) throw error
    }
  }

  console.log(`\nkuvauksia päivitettäisiin ${kuvauksia}, joista osoite vaihtunut ${siirtoja}; diaarinumeroita linkitettäisiin ${tunnisteita}`)
  if (!APPLY) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
