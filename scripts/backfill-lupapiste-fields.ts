import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LUPAPISTEEN KUULUTUS-PDF:N LOMAKEKENTAT TAKAUTUVASTI.
 *
 * PDF haettiin 264 dokumentille, mutta kuvaus saatiin vain KOLMEEN.
 * Poimija luki kenttaa "Hankkeen kuvaus", jota on 1 %:ssa. Hyodyllinen
 * teksti on muualla:
 *
 *   Toimenpide        92 %
 *   Lisaselvitykset   43 %
 *
 * Uusi bestBulletinDescription lukee ne, ja mitattuna kuvaus saadaan
 * 244:lle 264:sta.
 *
 * EI LYHENNA: jos hankkeella on jo pidempi kuvaus, sita ei korvata.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { bestBulletinDescription, extractBulletinFields } = await import(
    "../lib/agent/lupapisteBulletinPdf"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id,document_url,raw_payload")
      .eq("source_name", "Lupapiste kuulutukset")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const pdfIla = docs.filter((d: any) => String(d.raw_payload?.bulletin_pdf_text ?? "").length > 0)

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`Lupapiste-dokumentteja: ${docs.length}`)
  console.log(`  PDF-teksti tallessa:  ${pdfIla.length}`)
  console.log(`  kuvaus nyt tallessa:  ${pdfIla.filter((d: any) => d.raw_payload?.bulletin_description).length}\n`)

  /* 1. Lahdedokumentteihin kuvaus ja kentat. */
  let uusiaKuvauksia = 0, poistettuja = 0
  const paivitykset: { id: string; payload: any }[] = []

  for (const d of pdfIla) {
    const teksti = String(d.raw_payload.bulletin_pdf_text)
    const kuvaus = bestBulletinDescription(teksti)
    const kentat = extractBulletinFields(teksti)

    const vanha = d.raw_payload.bulletin_description ?? null
    if (!kuvaus && !kentat.kaavatilanne && !kentat.pintaAla && !vanha) continue
    if (vanha === kuvaus) continue

    if (kuvaus && !vanha) uusiaKuvauksia++
    if (!kuvaus && vanha) poistettuja++

    /*
     * VANHENTUNUT ARVO ON POISTETTAVA. Poimija hylkaa nyt maksurivit ja
     * taulukkovuodot, mutta aiemmin kirjoitettu roska jaisi paikoilleen
     * jos avain vain jatetaan pois - siksi se asetetaan nulliksi.
     */
    paivitykset.push({
      id: d.id,
      payload: {
        ...d.raw_payload,
        bulletin_description: kuvaus ?? null,
        ...(kentat.kaavatilanne ? { bulletin_kaavatilanne: kentat.kaavatilanne } : {}),
        ...(kentat.pintaAla ? { bulletin_pinta_ala: kentat.pintaAla } : {}),
        ...(kentat.kerrosala ? { bulletin_kerrosala: kentat.kerrosala } : {}),
      },
    })
  }

  console.log(`paivitettavia lahdedokumentteja: ${paivitykset.length}`)
  console.log(`  niista uusia kuvauksia:        ${uusiaKuvauksia}`)
  console.log(`  roskakuvauksia poistettu:      ${poistettuja}`)

  /* 2. Nayte luettavaksi. */
  console.log("\nnaytteita:")
  for (const u of paivitykset.slice(0, 12)) {
    console.log(`  ${String(u.payload.bulletin_description ?? "-").slice(0, 108)}`)
  }

  if (!APPLY) { console.log("\n(kuivaharjoitus — aja --apply)"); return }

  let n = 0
  for (const u of paivitykset) {
    const { error } = await supabase
      .from("source_documents")
      .update({ raw_payload: u.payload })
      .eq("id", u.id)
    if (error) throw error
    if (++n % 50 === 0) console.log(`  ...kirjoitettu ${n}/${paivitykset.length}`)
  }
  console.log(`\nkirjoitettu: ${n}`)
  console.log("\nHUOM: hankkeiden kuvaus paivittyy vasta kun putki ajaa dokumentit uudelleen.")
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
