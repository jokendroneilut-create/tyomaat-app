import { readFileSync } from "node:fs"

/*
 * KUSTANNUSARVIO JA VALMISTUMISAIKA TAKAUTUVASTI.
 *
 * Kaksi eri vikaa, jotka loytyivat samasta hankkeesta (Kivenlahden
 * pukutilat, 1.9.2026):
 *
 * 1. KUSTANNUS. Poimija katsoi vain tekstin 1 200 ensimmaista merkkia,
 *    mika on oikein tiedotteelle mutta vaarin paatosasiakirjalle -
 *    siina summa on syvalla "Selostus"-osiossa. Mitattu: 905 nakyvaa
 *    hanketta mainitsee summan, poimittu oli 77, ja 524:lla summa on
 *    vasta 1 200 merkin jalkeen. Lisaksi puuttui nelja mitattua
 *    ankkuria (rakennuskustannukset, enimmaishinta, rakentamisen
 *    kustannukset, "varattu ... M€").
 *
 * 2. VALMISTUMISAIKA. Poimija toimi, mutta arvo kirjoitettiin metadatan
 *    alkuun ja lahteen `estimated_completion: null` levitettiin sen
 *    paalle. Kentta oli siis tyhja vaikka paiva oli luettu oikein.
 *
 * EI YLIKIRJOITA MITAAN. Vain tyhja kentta taytetaan, ja kasin
 * muokattuun (`metadata.edited_fields`) ei kosketa.
 *
 *   npx tsx scripts/fix-cost-and-completion.ts
 *   npx tsx scripts/fix-cost-and-completion.ts --apply
 *   npx tsx scripts/fix-cost-and-completion.ts --vain-jono --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")
const VAIN_JONO = process.argv.includes("--vain-jono")
const NAYTA = Number(process.argv.find((a) => a.startsWith("--nayta="))?.split("=")[1] ?? "40")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractCostFromText } = await import("../lib/projects/extractCostFromText")
  const { inferCompletionDateFromText } = await import("../lib/projects/inferCompletionDateFromText")

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const kasin = (md: any, kentta: string) =>
    Array.isArray(md?.edited_fields) && md.edited_fields.includes(kentta)

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}${VAIN_JONO ? " (vain jono)" : ""}\n`)

  /* ---------- JONO ---------- */
  const { data: jono, error: jonoErr } = await admin
    .from("potential_projects")
    .select("id,title,metadata")
    .eq("status", "new")
  if (jonoErr) throw jonoErr

  let jHinta = 0
  let jPaiva = 0
  for (const r of jono ?? []) {
    const md: any = (r as any).metadata ?? {}
    const teksti = [...new Set(
      [String((r as any).title ?? ""), md.description, md.operation]
        .filter(Boolean)
        .map((x: any) => String(x))
    )].join(" ")
    const hinta = String(md.estimated_cost ?? "").trim() ? null : extractCostFromText(teksti)
    const paiva = String(md.estimated_completion ?? "").trim() ? null : inferCompletionDateFromText(teksti)
    if (!hinta && !paiva) continue
    console.log(
      `  jono  ${String(hinta ?? "-").padStart(10)}  ${String(paiva ?? "-").padEnd(11)} ${String((r as any).title ?? "").slice(0, 52)}`
    )
    if (hinta) jHinta++
    if (paiva) jPaiva++
    if (!APPLY) continue
    await admin
      .from("potential_projects")
      .update({
        metadata: {
          ...md,
          ...(hinta ? { estimated_cost: hinta, cost_source: "text" } : {}),
          ...(paiva ? { estimated_completion: paiva } : {}),
        },
      })
      .eq("id", (r as any).id)
  }
  console.log(`\nJONO: ${jono?.length ?? 0} ehdokasta; kustannus ${jHinta}, valmistuminen ${jPaiva}\n`)

  if (VAIN_JONO) {
    if (!APPLY) console.log("Kuivaharjoitus: mitaan ei kirjoitettu.")
    return
  }

  /* ---------- HANKKEET ---------- */
  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,city,additional_info,estimated_cost,estimated_completion,status,is_public,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const live = rivit.filter((r) => r.status === "active" && r.is_public !== false)

  const tyo: any[] = []
  for (const r of live) {
    const md: any = r.metadata ?? {}
    /*
     * Sama teksti esiintyy usein seka `additional_info`- etta
     * `metadata.description`-kentassa. Kahdesti liitettyna se ei tuo
     * uutta tietoa mutta luo saumoja joissa kaksi eri asiaa paatyy
     * vierekkain - mitattu tapaus: nimen ja kiinteistotunnuksen sauma,
     * josta valmistumisvuodeksi luettiin 2081.
     */
    const teksti = [...new Set(
      [String(r.name ?? ""), r.additional_info, md.description, md.operation]
        .filter(Boolean)
        .map((x: any) => String(x))
    )].join(" ")
    const onHinta = r.estimated_cost != null && String(r.estimated_cost).trim() !== ""
    const onPaiva = String(r.estimated_completion ?? "").trim() !== ""
    const hinta = onHinta || kasin(md, "estimated_cost") ? null : extractCostFromText(teksti)
    const paiva = onPaiva || kasin(md, "estimated_completion") ? null : inferCompletionDateFromText(teksti)
    if (!hinta && !paiva) continue
    tyo.push({ r, hinta, paiva })
  }

  /*
   * MENNYT PAIVA EI OLE PELKKA KENTTA. `auto-complete-projects` siirtaa
   * yollisessa ajossa hankkeen vaiheeseen "Valmistunut" ja tilaan
   * "completed", jos arvioitu valmistumispaiva on mennyt - eli hanke
   * katoaa asiakkaan listalta. Se on kentan tarkoitus, mutta se on iso
   * seuraus taydennysajolle, joten menneet paivat erotellaan omaksi
   * joukokseen ja kirjoitetaan vain lipulla `--menneet`.
   */
  const TANAAN = new Date().toISOString().slice(0, 10)
  const MENNEET = process.argv.includes("--menneet")

  const mennyt = tyo
    .filter((t) => t.paiva && t.paiva < TANAAN)
    .map((t) => ({ ...t, alkuperainen: t.paiva }))
  if (!MENNEET) {
    for (const t of tyo) if (t.paiva && t.paiva < TANAAN) t.paiva = null
  }

  const hinnat = tyo.filter((t) => t.hinta).length
  const paivat = tyo.filter((t) => t.paiva).length
  console.log(
    `  menneita valmistumispaivia ${mennyt.length} - ${MENNEET ? "KIRJOITETAAN (--menneet)" : "ohitetaan, aja --menneet jos haluat ne"}
`
  )
  for (const { r, alkuperainen } of mennyt.slice(0, 40)) {
    console.log(`  mennyt  ${alkuperainen}  ${String(r.name ?? "").slice(0, 62)}`)
  }
  if (mennyt.length > 40) console.log(`  ... ja ${mennyt.length - 40} muuta mennytta
`)

  console.log(`HANKKEET: ${live.length} nakyvaa; taydennettavia ${tyo.length} (kustannus ${hinnat}, valmistuminen ${paivat})\n`)

  const kirjoitettavat = tyo.filter((t) => t.hinta || t.paiva)
  for (const { r, hinta, paiva } of kirjoitettavat.slice(0, NAYTA)) {
    console.log(
      `  ${String(hinta ?? "-").padStart(10)}  ${String(paiva ?? "-").padEnd(11)} ${String(r.name ?? "").slice(0, 56)}`
    )
  }
  if (kirjoitettavat.length > NAYTA) console.log(`  ... ja ${kirjoitettavat.length - NAYTA} muuta`)

  if (!APPLY) {
    console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
    return
  }

  let ok = 0
  for (const { r, hinta, paiva } of kirjoitettavat) {
    const { error } = await admin
      .from("projects")
      .update({
        ...(hinta ? { estimated_cost: hinta } : {}),
        ...(paiva ? { estimated_completion: paiva } : {}),
        metadata: {
          ...(r.metadata ?? {}),
          ...(hinta ? { estimated_cost: hinta, cost_source: "text" } : {}),
          ...(paiva ? { estimated_completion: paiva } : {}),
        },
      })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE ${r.name}: ${error.message}`)
    else ok++
  }
  console.log(`\nkirjoitettu ${ok} / ${tyo.length}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
