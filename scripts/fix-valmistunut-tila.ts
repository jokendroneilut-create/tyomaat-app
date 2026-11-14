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
 * VALMISTUNUT / ACTIVE -RIVIT (D-421).
 *
 * 15.11.2026 kannassa oli 30 riviä, joiden vaihe oli Valmistunut mutta
 * tila active. Porthania korjattiin D-420:ssa; loput 29 käytiin läpi
 * lähteestä ja verkosta:
 *
 *   TILA      26 aidosti valmista -> status completed, completed_at
 *             lähteen menneestä valmistumispäivästä tai siitä hetkestä
 *             kun vaihe vaihtui valmiiksi (vaihehistoria)
 *   PALAUTA   3 väärin valmista -> takaisin edelliseen vaiheeseen
 *
 * Kaksoisrivit (Aleksanterinkadun silta, Puustellinmäen päiväkoti)
 * yhdistetään erikseen merge-duplicate-projects.ts:llä.
 *
 *   npx tsx scripts/fix-valmistunut-tila.ts
 *   npx tsx scripts/fix-valmistunut-tila.ts --apply
 */

const TILA: { id: string; nimi: string; peruste: string; valmistui?: string }[] = [
  { id: "f62322c5-52ee-4a7f-bcee-5af0e7f29b15", nimi: "Sunan koulu", valmistui: "2026-08-12", peruste: "Espoo 8/2026: valmistui, koulutyö alkoi 13.8." },
  { id: "a58e8137-911a-4898-94cf-14b3d6a73165", nimi: "Päiväkoti Puustellinmäki (dashboard)", peruste: "Norlandia Leppä toimii Puustellinmäessä; Johanneksen merkintä" },
  { id: "6ee4eb42-42eb-4e3e-83f5-8fe8fc02865a", nimi: "Würth Center Pirkkala", peruste: "Tekovan referenssi; Johanneksen merkintä 9.11." },
  { id: "8a58b461-e2d3-4793-939b-19c7705f3a4f", nimi: "Akun Tehdas", peruste: "Akun Tehdas muuttanut uusiin tiloihin Myllypuroon" },
  { id: "4b210ff7-c0d0-401e-96ef-1c92b423d2d7", nimi: "Sipolantien 9 purku", peruste: "päätöksen valmistumispäivä 31.5.2026 mennyt" },
  { id: "f8f9c2b5-5288-486c-ae88-1574dd87c9e4", nimi: "Pajakylän ja Saarenpuiston leikkipuistot", peruste: "valmistumispäivä 30.9.2026 mennyt" },
  { id: "99caee60-65ed-4a81-83a2-b42eb64435bf", nimi: "Siljotien alueen peruskorjaus", peruste: "valmistumispäivä 30.10.2026 mennyt" },
  { id: "8e144ce4-362d-4d4c-afb8-ed007d0f2ed1", nimi: "Keskusurheilukentän tekonurmi", peruste: "valmistumispäivä 24.5.2026 mennyt" },
  { id: "5af57d59-476a-4e10-8dcf-ab270efce149", nimi: "Ounashallin ilmanvaihto", peruste: "valmistumispäivä 30.9.2024 mennyt" },
  { id: "29911576-128a-4b44-be5e-7985495ad438", nimi: "Reposaaren telakka", peruste: "valmistumispäivä 31.12.2025 mennyt" },
  { id: "819c6f4f-7cf2-4098-9db8-bd86ddefe432", nimi: "Katujen uudelleenpäällystykset 2021", peruste: "vuoden 2021 työt" },
  { id: "6e9b3cbd-c6c1-409c-9e80-39b3b4e406d4", nimi: "Ison Pörrin silta", valmistui: "2026-10-31", peruste: "Yle: korjaus valmistui lokakuun lopulla 2026" },
  { id: "100f0ca1-d7ae-4e18-871d-15dfde0249a2", nimi: "Paavolan kampus", peruste: "Skanskan referenssi" },
  { id: "434b0cc5-19e4-4f17-8173-df6e501e451d", nimi: "Monitoimitalo Lähde", peruste: "Skanskan referenssi" },
  { id: "8356f749-aaa7-4ecb-a1a2-22667aaf5b6a", nimi: "Nokian terveysasema", peruste: "Skanskan referenssi: valmistui" },
  { id: "6472148e-e703-44b0-b22f-38efe25de561", nimi: "Sokos Hotel Ilves", peruste: "Skanskan referenssi" },
  { id: "a1e74fd0-5a5c-4da3-adab-5f794a05cde7", nimi: "Pumptrack Nikkilä", peruste: "Sipoon Sanomat 8/2026: rata jo nuorten käytössä" },
  { id: "8bb69cc4-718d-4e4f-a3e5-dd80e86577dd", nimi: "Jääkärinkankaan monitoimitalo", peruste: "Rakennustehon referenssi menneessä aikamuodossa (10/2026)" },
  { id: "b95d1c78-f741-48d8-b385-6b0386ba0a58", nimi: "Aleksanterinkadun silta (työmaakuulumiset)", valmistui: "2026-08-10", peruste: "Porvoo: avattu liikenteelle 10.8.2026" },
  { id: "77000044-cebf-49ae-978c-36aa187d7606", nimi: "Aleksanterinkadun silta", valmistui: "2026-08-10", peruste: "Porvoo: avattu liikenteelle 10.8.2026" },
  { id: "b89e790a-d76e-4410-8a37-bdbc2552d4e7", nimi: "Koulupolun saneeraus 2026", peruste: "kesän 2026 urakka, lähde merkitsi valmiiksi" },
  { id: "a19f90f9-292b-4a1f-b1b7-f2899ec2fc78", nimi: "Katuvalaistussaneeraus 2026", peruste: "alkoi 5/2026, lähde merkitsi valmiiksi" },
  { id: "fb41c036-e31a-42c6-8056-4ba081a40f92", nimi: "Päiväkoti Puustellinmäki (Toivo)", peruste: "Norlandia Leppä toimii Puustellinmäessä" },
  { id: "bc355ec3-2f3c-493d-a3ee-a4a08024da56", nimi: "Tullikamari", peruste: "Tilapalvelut: uudistettu kulttuurikeskus palvelee" },
  { id: "88b5f137-6f4d-4e50-b708-c6dc02afa718", nimi: "Ruusupuiston päiväkoti", peruste: "Tilapalvelut: talossa jo päiväkotilapsia" },
  { id: "048a761f-d00d-4dcf-b5af-888435c3d7e7", nimi: "S-Market Peltola", valmistui: "2026-10-22", peruste: "HOK-Elanto: avautui 22.10.2026" },
]

const PALAUTA: { id: string; nimi: string; uusi: "construction" | "planning"; peruste: string }[] = [
  {
    id: "a3917e09-322a-4c46-84b4-2cc193576ccd",
    nimi: "OYS L-rakennus, Oulu",
    uusi: "construction",
    peruste: "Väärä täsmäys: Skanskan referenssi merkitsi valmiiksi 5.9.2026, mutta NCC rakentaa L-taloa, alkoi 6/2026, valmis 10/2027 (Pohden tiedote).",
  },
  {
    id: "e2a2442a-1b7f-496d-8bec-125ff88e1303",
    nimi: "Break Sokos Hotel Ruka",
    uusi: "construction",
    peruste: "Hartela: rakennustyöt alkoivat 9/2025, avataan talvikaudeksi 2027-2028. https://www.hartela.fi/fi/tietoa-meista/uutiset/hartelan-rakentaman-break-sokos-hotel-rukan-rakennustyot-kaynnistyneet",
  },
  {
    id: "775b50db-4965-46ce-b690-e13a59a53002",
    nimi: "Runeberginkatu, katusuunnitelma",
    uusi: "planning",
    peruste: "Granlundin projektisivu (suunnittelureferenssi) merkitsi valmiiksi 26.10.2026; kadun rakentamisesta ei näyttöä. Tuntematon näytetään (never-hide-on-missing-data).",
  },
]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { PHASE_LABELS } = await import("../lib/projects/phases")
  const { recordPhaseChange } = await import("../lib/projects/recordPhaseChange")
  const { mennytPaiva } = await import("../lib/projects/completionStatus")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? "=== AJO (--apply) ===\n" : "=== KUIVAHARJOITUS ===\n")

  console.log("--- tila valmiiksi ---")
  for (const t of TILA) {
    const { data: p } = await db
      .from("projects")
      .select("id,name,phase,status,completed_at,estimated_completion")
      .eq("id", t.id)
      .maybeSingle()
    if (!p || p.phase !== PHASE_LABELS.completed || p.status !== "active") {
      console.log(`EI MUUTETA ${t.nimi}: ${p ? `${p.phase}/${p.status}` : "puuttuu"}`)
      continue
    }
    const { data: h } = await db
      .from("project_phase_history")
      .select("created_at")
      .eq("project_id", t.id)
      .eq("phase", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
    const aika = (t.valmistui ? new Date(`${t.valmistui}T12:00:00Z`).toISOString() : null) ?? p.completed_at ?? mennytPaiva(p.estimated_completion) ?? h?.[0]?.created_at ?? new Date().toISOString()
    console.log(`${t.nimi.padEnd(45)} completed_at ${aika.slice(0, 10)}  (${t.peruste})`)
    if (!apply) continue
    const { error } = await db.from("projects").update({ status: "completed", completed_at: aika }).eq("id", t.id)
    if (error) console.log(`  VIRHE ${error.message}`)
  }

  console.log("\n--- palautus ---")
  for (const t of PALAUTA) {
    const { data: p } = await db.from("projects").select("id,name,phase,status,is_public").eq("id", t.id).maybeSingle()
    if (!p || p.phase !== PHASE_LABELS.completed || p.status !== "active") {
      console.log(`EI MUUTETA ${t.nimi}: ${p ? `${p.phase}/${p.status}` : "puuttuu"}`)
      continue
    }
    const uusi = PHASE_LABELS[t.uusi]
    console.log(`${t.nimi.padEnd(45)} ${p.phase} -> ${uusi}${p.is_public ? "" : " (piilotettu)"}\n  ${t.peruste}`)
    if (!apply) continue
    const { error } = await db.from("projects").update({ phase: uusi, completed_at: null }).eq("id", t.id)
    if (error) {
      console.log(`  VIRHE ${error.message}`)
      continue
    }
    await recordPhaseChange({
      supabase: db as any,
      projectId: t.id,
      newPhase: uusi,
      previousPhase: p.phase,
      source: "manual_correction",
      sourceName: "valmistunut-tila",
      reason: t.peruste,
    })
  }
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
