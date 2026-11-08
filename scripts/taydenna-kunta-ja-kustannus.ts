import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PUUTTUVA KUNTA JA KUSTANNUSARVIO TAKAUTUVASTI (D-395).
 *
 * Johannes 8.11.2026 satunnaisotannan osumasta (Merven raiteen
 * ratasuunnitelma): *"korjaa nuo kaksi havaintoa, selvita miksi ne
 * puuttuvat ja korjataan kantaan jos muistakin puuttuu."*
 *
 * Molemmat saannot on korjattu poimijoihin (`kuntaHankkeesta`,
 * `extractCostFromText`), ja tama ajo kay ne lapi kannan yli. Ajo
 * kasittelee seka hankkeet etta jonossa odottavat rivit
 * ([[backfill-skips-queue-rows]]).
 *
 * KUMPIKAAN EI KORVAA OLEMASSA OLEVAA ARVOA: tyhja kentta taytetaan,
 * taytettyyn ei kosketa.
 *
 *   npx tsx scripts/taydenna-kunta-ja-kustannus.ts
 *   npx tsx scripts/taydenna-kunta-ja-kustannus.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const TUNNISTE = "kunta_ja_kustannus_2026_11"

/*
 * LUETTU JA HYLATTY. Kuivaharjoitus luettiin riveittain, ja nama kolme
 * jaavat pois vaikka saanto ne hyvaksyisi
 * ([[finding-signal-not-deciding-signal]]):
 */
const OHITETTAVAT = new Map<string, string>([
  [
    "9edeb986-a5d9-49f0-9464-49efa970056c",
    "kaksi sahkoasemaa: Pyhanselka on Muhoksella, Vuolijoki Kajaanissa -- yksi kunta olisi puolet oikein",
  ],
  [
    "92ebd3ca-c0a6-4312-b2d1-f50cd5e17fee",
    "VE1 350 000 EUR ja VE2 300 000 EUR: kaksi vaihtoehtoa, valittua ei kerrota",
  ],
  [
    "c4631a99-3e26-48da-945b-59145f331dd6",
    "allianssin ENSIMMAISEN TILAUKSEN arvio 30 M EUR, ei hankkeen hinta (NRC:n osuus 12 M EUR)",
  ],
])


const tyhja = (v: unknown) => v === null || v === undefined || String(v).trim() === ""

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { kuntaHankkeesta } = await import("../lib/geo/kuntaHankkeesta")
  const { getMunicipalityByName } = await import("../lib/geo/municipalities")
  const { extractCostFromText } = await import("../lib/projects/extractCostFromText")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  /* --- HANKKEET --- */
  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,region,status,is_public,estimated_cost,additional_info,lahde:metadata->source_name")
      .range(a, a + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const nakyvat = hankkeet.filter((r) => r.status === "active" && r.is_public)

  const kuntaKorjaukset: any[] = []
  for (const r of nakyvat) {
    if (!tyhja(r.city)) continue
    const paattely = kuntaHankkeesta({
      name: r.name,
      description: r.additional_info,
      region: r.region ?? null,
    })
    if (!paattely) continue
    if (OHITETTAVAT.has(r.id)) { console.log(`  OHITETAAN ${String(r.name).slice(0, 50)}: ${OHITETTAVAT.get(r.id)}`); continue }
    kuntaKorjaukset.push({ ...r, ...paattely })
  }

  const kustannusKorjaukset: any[] = []
  for (const r of nakyvat) {
    if (!tyhja(r.estimated_cost)) continue
    const summa = extractCostFromText(String(r.additional_info ?? ""))
    if (!summa) continue
    if (OHITETTAVAT.has(r.id)) { console.log(`  OHITETAAN ${String(r.name).slice(0, 50)}: ${OHITETTAVAT.get(r.id)}`); continue }
    kustannusKorjaukset.push({ ...r, summa })
  }

  console.log(`HANKKEET: asiakkaalle nakyvia ${nakyvat.length}`)
  console.log(`  kunta tyhja ${nakyvat.filter((r) => tyhja(r.city)).length}, ehdotus ${kuntaKorjaukset.length}`)
  console.log(`  kustannus tyhja ${nakyvat.filter((r) => tyhja(r.estimated_cost)).length}, ehdotus ${kustannusKorjaukset.length}\n`)

  console.log("--- KUNTA ---")
  for (const k of kuntaKorjaukset) {
    console.log(`  ${k.kunta.padEnd(14)} (${k.peruste.padEnd(8)}) ${String(k.region ?? "-").padEnd(18)} ${String(k.lahde ?? "-").slice(0, 20).padEnd(20)} ${String(k.name).slice(0, 60)}`)
  }
  console.log("\n--- KUSTANNUSARVIO ---")
  for (const k of kustannusKorjaukset) {
    console.log(`  ${(Number(k.summa).toLocaleString("fi-FI") + " €").padStart(16)}  ${String(k.lahde ?? "-").slice(0, 20).padEnd(20)} ${String(k.name).slice(0, 60)}`)
  }

  /* --- JONORIVIT --- */
  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,municipality,status,metadata")
      .range(a, a + 999)
    if (error) throw error
    jono.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const avoimet = jono.filter((r) => r.status === "new")
  const jonoKunnat: any[] = []
  for (const r of avoimet) {
    if (!tyhja(r.municipality)) continue
    const md = r.metadata ?? {}
    const paattely = kuntaHankkeesta({
      name: r.title,
      description: md.description,
      region: md.region ?? null,
    })
    if (!paattely) continue
    jonoKunnat.push({ ...r, ...paattely })
  }
  console.log(`\nJONO: avoimia ${avoimet.length}, ilman kuntaa ${avoimet.filter((r) => tyhja(r.municipality)).length}, ehdotus ${jonoKunnat.length}`)
  for (const k of jonoKunnat) {
    console.log(`  ${k.kunta.padEnd(14)} (${k.peruste.padEnd(8)}) ${String(k.title).slice(0, 70)}`)
  }

  if (!APPLY) {
    console.log("\n=== KUIVAHARJOITUS ===")
    return
  }

  let kirjoitettu = { kunta: 0, kustannus: 0, jono: 0 }
  for (const k of kuntaKorjaukset) {
    const { data: nyt } = await db.from("projects").select("metadata,region").eq("id", k.id).maybeSingle()
    const md = (nyt as any)?.metadata ?? {}
    const { error } = await db
      .from("projects")
      .update({
        city: k.kunta,
        /* Maakunta johdetaan kunnasta, jos se on tyhja. */
        region: (nyt as any)?.region || getMunicipalityByName(k.kunta)?.region || null,
        metadata: {
          ...md,
          field_sources: { ...(md.field_sources ?? {}), city: k.peruste },
          takautuvat_ajot: [...new Set([...(Array.isArray(md.takautuvat_ajot) ? md.takautuvat_ajot : []), TUNNISTE])],
        },
      })
      .eq("id", k.id)
    if (error) console.log(`   VIRHE kunta ${k.id}: ${error.message}`)
    else kirjoitettu.kunta += 1
  }
  for (const k of kustannusKorjaukset) {
    const { data: nyt } = await db.from("projects").select("metadata").eq("id", k.id).maybeSingle()
    const md = (nyt as any)?.metadata ?? {}
    const { error } = await db
      .from("projects")
      .update({
        estimated_cost: k.summa,
        metadata: {
          ...md,
          estimated_cost: k.summa,
          field_sources: { ...(md.field_sources ?? {}), estimated_cost: "kuvauksen rakentamiskustannukset" },
          takautuvat_ajot: [...new Set([...(Array.isArray(md.takautuvat_ajot) ? md.takautuvat_ajot : []), TUNNISTE])],
        },
      })
      .eq("id", k.id)
    if (error) console.log(`   VIRHE kustannus ${k.id}: ${error.message}`)
    else kirjoitettu.kustannus += 1
  }
  for (const k of jonoKunnat) {
    const md = k.metadata ?? {}
    const { error } = await db
      .from("potential_projects")
      .update({
        municipality: k.kunta,
        metadata: {
          ...md,
          region: md.region ?? getMunicipalityByName(k.kunta)?.region ?? null,
          field_sources: { ...(md.field_sources ?? {}), city: k.peruste },
          takautuvat_ajot: [...new Set([...(Array.isArray(md.takautuvat_ajot) ? md.takautuvat_ajot : []), TUNNISTE])],
        },
      })
      .eq("id", k.id)
    if (error) console.log(`   VIRHE jonorivi ${k.id}: ${error.message}`)
    else kirjoitettu.jono += 1
  }

  console.log(`\n=== AJETTU === kunta ${kirjoitettu.kunta}, kustannus ${kirjoitettu.kustannus}, jonoriviä ${kirjoitettu.jono}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
