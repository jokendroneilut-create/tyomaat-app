import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * JULKAISIJAN KOTIPAIKKA HANKKEEN KUNTANA (D-267).
 *
 * Yritystiedotteen keraaja otti kunnan listaukselta, ja listaus antaa
 * usein julkaisijan kotipaikan. Mitattu 11.10.2026: 283 rivilla kunta
 * oli tullut lahteesta, ja 49:lla tiedotteen teksti sanoi eri. Kahdeksan
 * kymmenesta sanoi "Helsinki" - esim. Luolavuoren koulu (Turku),
 * Aviapoliksen paakonttori (Vantaa), LUMI-datakeskus (Kajaani).
 *
 * Kirjoittaa vain kun tunnistettu kunta esiintyy hankkeen OMASSA
 * NIMESSA. Pelkka rungon maininta voi olla saman tiedotteen toinen
 * hanke, joten ne vain listataan.
 *
 * Kuivaharjoitus oletuksena; kirjoittaa vain --kirjoita.
 */
const KIRJOITA = process.argv.includes("--kirjoita")
const KASIN_AJO = process.argv.includes("--kasin")

/*
 * KASIN LUETUT RIVIT. Nama yhdeksan jaivat heikkoon luokkaan (kunta ei
 * ole hankkeen nimessa), ja luin jokaisen tiedotteen tekstin erikseen
 * 11.10.2026. Kuudella todiste on yksiselitteinen, joten ne korjataan
 * nimeltä eika saannolla. Kolmea ei korjata: Datakeskus Kajaaniin on
 * kannassa jo oikein, ja CIRCUIT on kansainvalinen tutkimushanke jossa
 * Espoo vain koordinoi.
 */
const KASIN: { id: string; taulu: string; kunta: string; peruste: string }[] = [
  { id: "0cf6605c", taulu: "projects", kunta: "Jyväskylä", peruste: "tuotantolaitos Jyväskylän Seppälänkankaalle" },
  { id: "c5602b9d", taulu: "potential_projects", kunta: "Jyväskylä", peruste: "sama tiedote" },
  { id: "1041b82a", taulu: "projects", kunta: "Turku", peruste: "Luolavuoren koulu on Turussa" },
  { id: "82f270f6", taulu: "potential_projects", kunta: "Turku", peruste: "sama tiedote" },
  { id: "638e3db0", taulu: "potential_projects", kunta: "Kouvola", peruste: "SRV ja Kouvolan kaupunki allekirjoittivat" },
  { id: "1a073715", taulu: "potential_projects", kunta: "Vantaa", peruste: "Äyritie 6, Aviapolis on Vantaalla" },
]

async function kasinAjo(db: any, getMunicipalityByName: any) {
  for (const r of KASIN) {
    /* uuid-sarakkeelle ei voi tehda like-hakua, joten tunnus ratkaistaan koko joukosta. */
    const kaikki: any[] = []
    for (let f = 0; f < 20000; f += 1000) {
      const { data, error } = await db
        .from(r.taulu)
        .select("id,metadata" + (r.taulu === "projects" ? ",name,city" : ",title,municipality"))
        .range(f, f + 999)
      if (error) throw error
      if (!data?.length) break
      kaikki.push(...data)
      if (data.length < 1000) break
    }
    const osumat = kaikki.filter((x) => String(x.id).startsWith(r.id))
    if (osumat.length !== 1) {
      console.log(`  OHITETTU ${r.id}: ${osumat.length} osumaa`)
      continue
    }
    const rivi = osumat[0]
    const nyt = rivi.city ?? rivi.municipality
    const kunta = getMunicipalityByName(r.kunta)
    console.log(
      `  ${r.id} ${String(nyt).padEnd(12)} -> ${r.kunta.padEnd(12)} | ` +
        `${String(rivi.name ?? rivi.title).slice(0, 46)} (${r.peruste})`
    )
    if (!KIRJOITA) continue
    const paivitys: any =
      r.taulu === "projects"
        ? { city: r.kunta, region: kunta.region }
        : { municipality: r.kunta }
    paivitys.metadata = {
      ...(rivi.metadata ?? {}),
      region: kunta.region,
      field_sources: { ...(rivi.metadata?.field_sources ?? {}), city: "luettu" },
      city_corrected_from: nyt,
    }
    const { error: kirj } = await db.from(r.taulu).update(paivitys).eq("id", rivi.id)
    if (kirj) throw kirj
  }
  console.log(KIRJOITA ? "\nKirjoitettu." : "\nKuivaharjoitus. Ei kirjoitettu mitaan.")
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { detectCityFromText } = await import("../lib/agent/detectCityFromText")
  const { getMunicipalityByName } = await import("../lib/geo/municipalities")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  if (KASIN_AJO) {
    console.log("KASIN LUETUT RIVIT:")
    await kasinAjo(db, getMunicipalityByName)
    return
  }

  const vahva: any[] = []
  const heikko: any[] = []

  for (const taulu of ["projects", "potential_projects"]) {
    for (let f = 0; f < 20000; f += 1000) {
      const { data, error } = await db.from(taulu).select("*").range(f, f + 999)
      if (error) throw error
      if (!data?.length) break
      for (const r of data as any[]) {
        const md = r.metadata ?? {}
        if (md.field_sources?.city !== "lähde") continue
        const teksti = String(r.additional_info ?? md.description ?? "")
        const otsikko = String(r.name ?? r.title ?? "")
        const nyt = String(r.city ?? r.municipality ?? "")
        const uusi = detectCityFromText(teksti)
        if (!uusi || uusi.toLowerCase() === nyt.toLowerCase()) continue
        const kunta = getMunicipalityByName(uusi)
        if (!kunta) continue
        const otsikossa = detectCityFromText(otsikko) === uusi
        const i = teksti.toLowerCase().indexOf(uusi.slice(0, 4).toLowerCase())
        const ympari = teksti.slice(Math.max(0, i - 55), i + 60).replace(/\s+/g, " ")
        const rivi = { taulu, id: r.id, otsikko, nyt, uusi, kunta, ympari }
        ;(otsikossa ? vahva : heikko).push(rivi)
      }
      if (data.length < 1000) break
    }
  }

  const tulosta = (nimi: string, lista: any[]) => {
    console.log(`\n${nimi} (${lista.length}):`)
    for (const r of lista) {
      console.log(
        `  ${r.taulu === "projects" ? "hanke  " : "ehdokas"} ${String(r.id).slice(0, 8)} ` +
          `${r.nyt.padEnd(12)} -> ${r.uusi.padEnd(12)} | ${r.otsikko.slice(0, 60)}`
      )
      console.log(`           ...${r.ympari}...`)
    }
  }
  tulosta("NIMESSA SAMA KUNTA - korjattaisiin", vahva)
  tulosta("VAIN RUNGOSSA - jatetaan ennalleen", heikko)

  if (!KIRJOITA) {
    console.log("\nKuivaharjoitus. Ei kirjoitettu mitaan.")
    return
  }

  let n = 0
  for (const r of vahva) {
    const paivitys: any =
      r.taulu === "projects"
        ? { city: r.uusi, region: r.kunta.region }
        : { municipality: r.uusi }
    const { data: vanha, error: lue } = await db
      .from(r.taulu)
      .select("metadata")
      .eq("id", r.id)
      .single()
    if (lue) throw lue
    paivitys.metadata = {
      ...(vanha?.metadata ?? {}),
      region: r.kunta.region,
      field_sources: { ...((vanha?.metadata as any)?.field_sources ?? {}), city: "teksti" },
      city_corrected_from: r.nyt,
    }
    const { error } = await db.from(r.taulu).update(paivitys).eq("id", r.id)
    if (error) throw error
    n++
  }
  console.log(`\nPaivitetty ${n} rivia.`)
}

main().catch((e) => { console.error(e); process.exit(1) })
