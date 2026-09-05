import { readFileSync } from "node:fs"

/*
 * PINTA-ALA TEKSTISTÄ, TAKAUTUVASTI.
 *
 * `floor_area` on ollut olemassa kenttänä muttei kirjoittajaa: mitattu
 * 5.9.2026, näkyvistä 5 871 hankkeesta 601 mainitsee alan kuvauksessaan
 * ja vain 138:lla kenttä on täytetty.
 *
 * Poimintasäännöt ja niiden perustelut:
 * `lib/projects/extractFloorAreaFromText.ts`.
 *
 * EI YLIKIRJOITA MITÄÄN. Vain tyhjä kenttä täytetään, ja käsin
 * muokattuun (`metadata.edited_fields`) ei kosketa.
 *
 *   npx tsx scripts/fix-floor-area.ts
 *   npx tsx scripts/fix-floor-area.ts --apply
 *   npx tsx scripts/fix-floor-area.ts --vain-jono --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")
const VAIN_JONO = process.argv.includes("--vain-jono")
const NAYTA = Number(process.argv.find((a) => a.startsWith("--nayta="))?.split("=")[1] ?? "40")

function teksti(nimi: string, ...osat: any[]) {
  return [...new Set([nimi, ...osat].filter(Boolean).map(String))].join(" ")
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractFloorAreaFromText } = await import("../lib/projects/extractFloorAreaFromText")

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}${VAIN_JONO ? " (vain jono)" : ""}\n`)

  /* ---------- JONO ---------- */
  const { data: jono, error: jonoErr } = await admin
    .from("potential_projects")
    .select("id,title,metadata")
    .eq("status", "new")
  if (jonoErr) throw jonoErr

  let jonossa = 0
  for (const r of jono ?? []) {
    const md: any = (r as any).metadata ?? {}
    if (md.floor_area != null && String(md.floor_area).trim() !== "") continue
    const ala = extractFloorAreaFromText(teksti(String((r as any).title ?? ""), md.description, md.operation))
    if (!ala) continue
    jonossa++
    console.log(`  jono  ${String(ala).padStart(7)} m²  ${String((r as any).title ?? "").slice(0, 56)}`)
    if (!APPLY) continue
    await admin
      .from("potential_projects")
      .update({ metadata: { ...md, floor_area: ala } })
      .eq("id", (r as any).id)
  }
  console.log(`\nJONO: ${jono?.length ?? 0} ehdokasta, alan sai ${jonossa}\n`)

  if (VAIN_JONO) {
    if (!APPLY) console.log("Kuivaharjoitus: mitaan ei kirjoitettu.")
    return
  }

  /* ---------- HANKKEET ---------- */
  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,additional_info,metadata,floor_area,status,is_public")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const live = rivit.filter((r) => r.status === "active" && r.is_public !== false)

  const tyo: any[] = []
  for (const r of live) {
    const md: any = r.metadata ?? {}
    if (r.floor_area != null && String(r.floor_area).trim() !== "") continue
    if (Array.isArray(md.edited_fields) && md.edited_fields.includes("floor_area")) continue
    const ala = extractFloorAreaFromText(teksti(String(r.name ?? ""), r.additional_info, md.description))
    if (!ala) continue
    tyo.push({ r, ala })
  }

  console.log(`HANKKEET: ${live.length} nakyvaa, taydennettavia ${tyo.length}\n`)

  for (const { r, ala } of tyo.slice(0, NAYTA)) {
    console.log(`  ${String(ala).padStart(7)} m²  ${String(r.name ?? "").slice(0, 62)}`)
  }
  if (tyo.length > NAYTA) console.log(`  ... ja ${tyo.length - NAYTA} muuta`)

  /* Jakauma paljastaa jarjettomat luvut nopeammin kuin yksittaiset rivit. */
  const luokat = new Map<string, number>()
  for (const { ala } of tyo) {
    const k =
      ala < 100 ? "alle 100" : ala < 1000 ? "100-999" : ala < 10000 ? "1 000-9 999" : ala < 100000 ? "10 000-99 999" : "yli 100 000"
    luokat.set(k, (luokat.get(k) ?? 0) + 1)
  }
  console.log("\nKOKOJAKAUMA:")
  for (const k of ["alle 100", "100-999", "1 000-9 999", "10 000-99 999", "yli 100 000"]) {
    if (luokat.has(k)) console.log(`  ${k.padEnd(15)} ${luokat.get(k)}`)
  }

  if (!APPLY) {
    console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
    return
  }

  let ok = 0
  for (const { r, ala } of tyo) {
    const { error } = await admin
      .from("projects")
      .update({ floor_area: ala, metadata: { ...(r.metadata ?? {}), floor_area: ala } })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.name}: ${error.message}`)
    else ok++
  }
  console.log(`\nkirjoitettu ${ok} / ${tyo.length}`)
}

main().catch((e) => {
  console.error("VIRHE:", e?.message ?? e)
  process.exit(1)
})
export {}
