import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * FCDC:N HANKESIVUT JA AKAAN LUPA KANTAAN (D-440).
 *
 * Hankesivuja (`fcdc.fi/projects/*`) ei kerätä jatkuvasti (neljä sivua,
 * kaikki rakenteilla), vaan niiden tiedot viedään kerran käsin. Lisäksi
 * Akaan rakennuslupatiedote 18.9.2026 viedään "Verda Akaa" -riville
 * (Akaa Point), kuten Johannes pyysi 19.11.2026 (*"tee kaikki kolme"*).
 *
 * Mäntsälä 2 (Graniittitie 6) jätetään: lähteet eivät kerro, onko se
 * Nebiuksen toinen Mäntsälän kohde.
 *
 *   npx tsx scripts/taydenna-fcdc-hankkeet.ts [--apply]
 */

const FCDC = "FCDC Corp Oy"

type Taydennys = {
  id: string
  sijainti?: string
  kerrosala?: number
  vaihe?: string
  lisays: string
  yhteys?: any[]
  liittyvat?: string[]
  lahde: string
  lahdeUrl: string
  liitaPiilotetusta?: string
}

const TAYDENNYKSET: Taydennys[] = [
  {
    id: "12986da3-149b-447d-a37b-25b599868d88",
    liittyvat: [FCDC, "DayOne"],
    lisays:
      "FCDC:n hankesivun mukaan FCDC kehitti Lahden kohteen (entinen teollisuus- ja varastokiinteistö) ja myi sen operaattori DayOnelle: liittymäteho 180 MW, tontti 98 901 m², rakennusoikeus 98 901 k-m², rakentaminen käynnissä.",
    lahde: "FCDC:n hankesivu",
    lahdeUrl: "https://www.fcdc.fi/projects/lahti",
    liitaPiilotetusta: "32a9ac02-1fc6-4ce0-86e6-879744b16659",
  },
  {
    id: "6f68c0b3-9c02-4b85-a451-ac71db65c4d1",
    sijainti: "Gneissitie 3, Mäntsälä",
    kerrosala: 59100,
    liittyvat: [FCDC, "Nivos"],
    lisays:
      "FCDC:n hankesivun mukaan FCDC hankki tontin vuokraoikeuden ja sähköliittymän (Palomäen sähköasema, Nivos) ja myi kohteen operaattori Vernelle: liittymäteho 70 MW, tontti 98 500 m², rakennusoikeus 59 100 k-m², rakentaminen käynnissä.",
    lahde: "FCDC:n hankesivu (Mäntsälä 1)",
    lahdeUrl: "https://www.fcdc.fi/projects/mantsala-1",
  },
  {
    id: "cf55c23a-91f9-4766-8dbe-4161e7fe760d",
    sijainti: "Kuriirintie 7, Vaasa",
    kerrosala: 96000,
    lisays:
      "FCDC:n hankesivun mukaan: liittymäteho 250 MW, tontti 120 000 m², rakennusoikeus 96 000 k-m², operaattoria ei ole julkistettu, rakentaminen käynnissä. Kaukolämpöyhteistyötä ja yliopistokumppanuuksia on selvitetty.",
    lahde: "FCDC:n hankesivu",
    lahdeUrl: "https://www.fcdc.fi/projects/vaasa",
  },
  {
    id: "37c0fadc-0fda-4909-b670-fcef97325506",
    vaihe: "Rakennuslupa",
    liittyvat: [FCDC],
    lisays:
      "Akaan kaupunki myönsi 18.9.2026 rakennusluvan FCDC Corp Oy:n datakeskushankkeelle Akaa Point -yritysalueella. Lupa kattaa noin 44 000 neliömetrin datakeskuskokonaisuuden. (FCDC:n tiedote ei nimeä operaattoria; kytkös tähän Verdan/DataCrunchin riviin perustuu samaan Akaa Point -alueeseen.)",
    yhteys: [
      { kind: "person", name: "Joonas Viita-aho", title: "Teknologiajohtaja", organization: FCDC, phone: null, email: "joonas@fcdc.fi", role: null },
      { kind: "person", name: "Lasse Silván", title: "Kaupunkikehitysjohtaja", organization: "Akaan kaupunki", phone: "040 335 3207", email: "lasse.silvan@akaa.fi", role: null },
    ],
    lahde: "FCDC:n tiedote 18.9.2026",
    lahdeUrl: "https://www.fcdc.fi/news/akaan-kaupunki-on-myontanyt-rakennusluvan-fcdc-n-datakeskushankkeelle",
  },
]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")
  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")
  const { phaseAdvances } = await import("../lib/projects/phases")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  for (const t of TAYDENNYKSET) {
    const { data: h } = await db.from("projects").select("id,name,phase,location,floor_area,additional_info,metadata").eq("id", t.id).single()
    if (!h) { console.log(`EI LÖYDY ${t.id}`); continue }
    const md: any = h.metadata ?? {}
    let kuvaus = String(h.additional_info ?? "").trim()
    if (t.liitaPiilotetusta) {
      const { data: p } = await db.from("projects").select("additional_info").eq("id", t.liitaPiilotetusta).single()
      const lisa = String(p?.additional_info ?? "").trim()
      if (lisa && !kuvaus.includes(lisa.slice(0, 60))) kuvaus = `${kuvaus}\n\n${lisa}`
    }
    if (!kuvaus.includes(t.lisays.slice(0, 50))) kuvaus = `${kuvaus}\n\n${t.lisays} (Lähde: ${t.lahde}.)`.trim()
    const yhteys = [...(Array.isArray(md.contact_persons) ? md.contact_persons : [])]
    for (const y of t.yhteys ?? []) if (!yhteys.some((v: any) => v?.name === y.name)) yhteys.push(y)
    const sarakkeet: any = { additional_info: kuvaus }
    const fs: any = { ...(md.field_sources ?? {}) }
    if (t.sijainti && !h.location) { sarakkeet.location = t.sijainti; fs.location = t.lahde }
    if (t.kerrosala && !h.floor_area) { sarakkeet.floor_area = t.kerrosala; fs.floor_area = `${t.lahde}: rakennusoikeus` }
    const vaiheEtenee = t.vaihe && phaseAdvances(h.phase, t.vaihe)
    if (vaiheEtenee) sarakkeet.phase = t.vaihe
    console.log(`${h.id.slice(0, 8)} ${h.name.padEnd(28)} | kuvaus ${String(h.additional_info ?? "").length} -> ${kuvaus.length}${sarakkeet.location ? ` | sijainti ${sarakkeet.location}` : ""}${sarakkeet.floor_area ? ` | k-m² ${sarakkeet.floor_area}` : ""}${vaiheEtenee ? ` | vaihe ${h.phase} -> ${t.vaihe}` : ""}${t.yhteys ? ` | yhteys +${t.yhteys.length}` : ""}`)
    if (!apply) continue
    const { error } = await db.from("projects").update({
      ...sarakkeet,
      metadata: {
        ...md,
        description: kuvaus,
        contact_persons: yhteys,
        related_companies: mergeCompanyNames(Array.isArray(md.related_companies) ? md.related_companies : [], t.liittyvat ?? []),
        lisalahteet: Array.from(new Set([...(md.lisalahteet ?? []), t.lahdeUrl])),
        field_sources: fs,
      },
    }).eq("id", h.id)
    if (error) { console.log(`  VIRHE ${error.message}`); continue }
    if (vaiheEtenee)
      await recordPhaseChange({ supabase: db as any, projectId: h.id, newPhase: t.vaihe!, previousPhase: h.phase, source: "manual_correction", sourceName: "fcdc", reason: `${t.lahde}: rakennuslupa myönnetty 18.9.2026` } as any)
  }
  if (!apply) console.log("\nKuivaharjoitus. Aja --apply kun rivit on luettu.")
}

main().catch((e) => { console.error(e); process.exit(1) })
