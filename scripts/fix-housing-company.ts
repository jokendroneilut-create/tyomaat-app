import { readFileSync } from "node:fs"

/*
 * TALOYHTIÖN NIMI YRITYSLISTAAN, TAKAUTUVASTI.
 *
 * "Asunto Oy Oulun Valoisa" on rekisteröity ja yksilöivä nimi, ja se on
 * asiakkaalle hakukelpoinen. Poimintasääntö on ollut olemassa
 * täsmäytystä varten (`housingCompanyKey`), mutta nimeä ei näytetty
 * missään.
 *
 * Mitattu 6.9.2026: näkyvistä 5 899 hankkeesta 116:lla taloyhtiö lukee
 * otsikossa tai kuvauksen alussa, ja vain 8:lla se on yrityksissä tai
 * osapuolissa.
 *
 * EI YLIKIRJOITA MITÄÄN: lista yhdistetään, ja käsin muokattuun
 * (`metadata.edited_fields`) ei kosketa.
 *
 *   npx tsx scripts/fix-housing-company.ts
 *   npx tsx scripts/fix-housing-company.ts --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")
const NAYTA = Number(process.argv.find((a) => a.startsWith("--nayta="))?.split("=")[1] ?? "40")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { housingCompanyName } = await import("../lib/projects/housingCompanyKey")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* ---------- JONO ---------- */
  const { data: jono, error: jonoErr } = await admin
    .from("potential_projects")
    .select("id,title,metadata")
    .eq("status", "new")
  if (jonoErr) throw jonoErr

  let jonossa = 0
  for (const r of jono ?? []) {
    const md: any = (r as any).metadata ?? {}
    const nimi = housingCompanyName(String((r as any).title ?? ""), md.description ?? null)
    if (!nimi) continue

    const nykyinen: string[] = Array.isArray(md.related_companies) ? md.related_companies : []
    const yhdistetty = mergeCompanyNames(nykyinen, [nimi])
    if (yhdistetty.length === nykyinen.length) continue

    jonossa++
    console.log(`  jono  ${nimi.slice(0, 36).padEnd(37)} ${String((r as any).title ?? "").slice(0, 46)}`)
    if (!APPLY) continue
    await admin
      .from("potential_projects")
      .update({ metadata: { ...md, housing_company: nimi, related_companies: yhdistetty } })
      .eq("id", (r as any).id)
  }
  console.log(`\nJONO: ${jono?.length ?? 0} ehdokasta, taloyhtion sai ${jonossa}\n`)

  /* ---------- HANKKEET ---------- */
  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("projects")
      .select("id,name,developer,builder,additional_info,metadata,status,is_public")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const live = rivit.filter((r) => r.status === "active" && r.is_public !== false)

  const tyo: any[] = []
  for (const r of live) {
    const md: any = r.metadata ?? {}
    if (Array.isArray(md.edited_fields) && md.edited_fields.includes("related_companies")) continue

    const nimi = housingCompanyName(String(r.name ?? ""), r.additional_info ?? md.description ?? null)
    if (!nimi) continue

    const nykyinen: string[] = Array.isArray(md.related_companies) ? md.related_companies : []
    const yhdistetty = mergeCompanyNames(nykyinen, [nimi])

    /* Ei kirjoiteta jos nimi on jo listalla tai osapuolena. */
    const jo = [...nykyinen, String(r.developer ?? ""), String(r.builder ?? "")]
      .join(" | ")
      .toLowerCase()
    if (jo.includes(nimi.toLowerCase())) continue
    if (yhdistetty.length === nykyinen.length) continue

    tyo.push({ r, nimi, lista: yhdistetty })
  }

  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}: ${live.length} nakyvaa, taydennettavia ${tyo.length}\n`)

  for (const { r, nimi } of tyo.slice(0, NAYTA)) {
    console.log(`  ${nimi.slice(0, 36).padEnd(37)} ${String(r.name ?? "").slice(0, 50)}`)
  }
  if (tyo.length > NAYTA) console.log(`  ... ja ${tyo.length - NAYTA} muuta`)

  if (!APPLY) {
    console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
    return
  }

  let ok = 0
  for (const { r, nimi, lista } of tyo) {
    const { error } = await admin
      .from("projects")
      .update({
        metadata: { ...(r.metadata ?? {}), housing_company: nimi, related_companies: lista },
      })
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
