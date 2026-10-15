import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

import { maakuntaNutsKoodista } from "../lib/geo/nutsRegion"
import { detectCityFromText } from "../lib/agent/detectCityFromText"
import { getMunicipalityByName } from "../lib/geo/municipalities"

/*
 * MAAKUNTA NUTS-KOODISTA JA IVALON KUNTA TAKAUTUVASTI (D-292).
 *
 * Korjaus koskee poimintaa, joten jo tuodut rivit taydennetaan talla.
 *
 * KAKSI ERILLISTA KORJAUSTA, ERI VARMUUDELLA:
 *
 *   maakunta  Rakenteinen NUTS-koodi ilmoituksessa. Eksakti; kartta on
 *             johdettu omasta aineistosta 90 %:n yksimielisyydella.
 *             Paljas "FI" ja ulkomainen koodi jatetaan tyhjaksi.
 *
 *   kunta     VAIN Ivalo-rivit. Koko postitoimipaikkakartan kytkeminen
 *             tekstintunnistukseen mitattiin ja HYLATTIIN: 7 uutta
 *             virhetta vastaan 2 aitoa hyotya, koska kylan nimi osuu
 *             vapaassa tekstissa toisen kunnan kaupunginosaan
 *             ("Nummela" on myos Ulvilan kaupunginosa). Siksi tassa
 *             taydennetaan vain se nimi joka on yksikasitteinen.
 *
 * EI YLIKIRJOITA. Vain tyhja kentta taytetaan.
 *
 *   npx tsx scripts/taydenna-maakunta-nutsista.ts
 *   npx tsx scripts/taydenna-maakunta-nutsista.ts --apply
 */

const IVALO = /ivalo/i

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* NUTS-koodit dokumenttitunnisteen mukaan. */
  const docs: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db.from("source_documents").select("id, raw_payload").eq("source_id", "hilma").range(alku, alku + 999)
    if (error) {
      console.error("VIRHE dokumentit:", error.message)
      process.exit(1)
    }
    docs.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const nuts = new Map<string, string>()
  for (const d of docs) {
    const n = (d.raw_payload as any)?.original?.nutsCodes
    if (typeof n === "string" && n.trim()) nuts.set(d.id, n.trim())
  }
  console.log(`Hilma-dokumentteja ${docs.length}, joissa nutsCodes ${nuts.size}\n`)

  /* 1. JONO */
  const ehdokkaat: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db.from("potential_projects").select("id, title, status, municipality, metadata").range(alku, alku + 999)
    if (error) {
      console.error("VIRHE ehdokkaat:", error.message)
      process.exit(1)
    }
    ehdokkaat.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  let jonoMaakunta = 0
  let jonoKunta = 0
  const jonoNaytteet: string[] = []

  for (const e of ehdokkaat) {
    const md = (e.metadata as any) ?? {}
    const muutos: Record<string, unknown> = {}
    let uusiKunta: string | null = null

    /* Kunta: vain Ivalo-rivit. */
    if (!e.municipality) {
      const teksti = `${e.title ?? ""} ${md.description ?? ""}`
      if (IVALO.test(teksti)) {
        uusiKunta = detectCityFromText(teksti)
      }
    }

    /* Maakunta: kunnasta jos se nyt tiedetaan, muuten NUTS-koodista. */
    if (!md.region) {
      const kunnasta = uusiKunta ? getMunicipalityByName(uusiKunta)?.region ?? null : null
      const koodista = maakuntaNutsKoodista(nuts.get(String(md.source_document_id ?? "")))
      const maakunta = kunnasta ?? koodista
      if (maakunta) muutos.region = maakunta
    }

    if (!uusiKunta && !Object.keys(muutos).length) continue

    if (jonoNaytteet.length < 14) {
      jonoNaytteet.push(
        `  [${String(e.status).padEnd(8)}] kunta=${String(e.municipality ?? "–").padEnd(10)}` +
          `${uusiKunta ? ` -> ${uusiKunta}` : ""}  maakunta=${String(md.region ?? "–").padEnd(10)}` +
          `${muutos.region ? ` -> ${muutos.region}` : ""}  ${String(e.title).slice(0, 40)}`
      )
    }
    if (uusiKunta) jonoKunta++
    if (muutos.region) jonoMaakunta++

    if (!apply) continue
    const { error: uv } = await db
      .from("potential_projects")
      .update({
        ...(uusiKunta ? { municipality: uusiKunta } : {}),
        metadata: { ...md, ...(muutos.region ? { region: muutos.region } : {}) },
      })
      .eq("id", e.id)
    if (uv) console.log(`  VIRHE ${e.id}: ${uv.message}`)
  }

  console.log(`JONO: maakunta ${jonoMaakunta}, kunta ${jonoKunta}`)
  for (const n of jonoNaytteet) console.log(n)

  /* 2. KANTA */
  const hankkeet: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db.from("projects").select("id, name, city, region, additional_info, metadata").range(alku, alku + 999)
    if (error) {
      console.error("VIRHE hankkeet:", error.message)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  let kantaMaakunta = 0
  let kantaKunta = 0
  const kantaNaytteet: string[] = []

  for (const p of hankkeet) {
    const md = (p.metadata as any) ?? {}
    const muutos: Record<string, unknown> = {}

    if (!p.city) {
      const teksti = `${p.name ?? ""} ${p.additional_info ?? ""}`
      if (IVALO.test(teksti)) {
        const kunta = detectCityFromText(teksti)
        if (kunta) muutos.city = kunta
      }
    }

    if (!p.region) {
      const kunnasta = muutos.city
        ? getMunicipalityByName(String(muutos.city))?.region ?? null
        : p.city
          ? getMunicipalityByName(String(p.city))?.region ?? null
          : null
      const koodista = maakuntaNutsKoodista(nuts.get(String(md.source_document_id ?? "")))
      const maakunta = kunnasta ?? koodista
      if (maakunta) muutos.region = maakunta
    }

    if (!Object.keys(muutos).length) continue

    if (kantaNaytteet.length < 14) {
      kantaNaytteet.push(
        `  kunta=${String(p.city ?? "–").padEnd(12)}${muutos.city ? ` -> ${muutos.city}` : ""}` +
          `  maakunta=${String(p.region ?? "–").padEnd(10)}${muutos.region ? ` -> ${muutos.region}` : ""}  ${String(p.name).slice(0, 40)}`
      )
    }
    if (muutos.city) kantaKunta++
    if (muutos.region) kantaMaakunta++

    if (!apply) continue
    const { error: uv } = await db.from("projects").update(muutos).eq("id", p.id)
    if (uv) console.log(`  VIRHE ${p.id}: ${uv.message}`)
  }

  console.log(`\nKANTA: maakunta ${kantaMaakunta}, kunta ${kantaKunta}`)
  for (const n of kantaNaytteet) console.log(n)

  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
