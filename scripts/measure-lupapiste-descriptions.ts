import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: kuinka moni Lupapiste-kuulutus on tallennettu VANHALLA
 * kuvauslogiikalla?
 *
 * Hanke d0901758 naytti 497 merkin kuvauksen, joka katkesi Toimenpide-
 * kenttaan. Olennainen "Lisaselvitykset" - se joka kertoo mita tontilla
 * oikeasti tapahtuu - puuttui, vaikka se on PDF:ssa ja poimija osaa sen.
 *
 * Syy ei ole poimijassa: bestBulletinDescription tuottaa samasta
 * tekstista 1 853 merkkia. Kannassa oleva raw_payload.bulletin_description
 * on kirjoitettu ennen sen parannusta, eika fact-tyolainen kasittele
 * dokumenttia toista kertaa.
 *
 * Ei kirjoita mitaan.
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { bestBulletinDescription } = await import("../lib/agent/lupapisteBulletinPdf")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id,title,raw_payload")
      .eq("source_name", "Lupapiste kuulutukset")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  let pdfIla = 0, pidentyisi = 0, sama = 0, lyhenisi = 0
  let ennen = 0, jalkeen = 0
  const naytteet: string[] = []

  for (const d of docs) {
    const teksti = String(d.raw_payload?.bulletin_pdf_text ?? "")
    if (!teksti) continue
    pdfIla++

    const vanha = String(d.raw_payload?.bulletin_description ?? "")
    const uusi = String(bestBulletinDescription(teksti) ?? "")

    if (uusi.length > vanha.length) {
      pidentyisi++
      ennen += vanha.length
      jalkeen += uusi.length
      if (naytteet.length < 12) {
        naytteet.push(`  ${String(d.title).slice(0, 34).padEnd(36)} ${String(vanha.length).padStart(5)} -> ${String(uusi.length).padStart(5)}`)
      }
    } else if (uusi.length === vanha.length) sama++
    else lyhenisi++
  }

  console.log(`Lupapiste-dokumentteja PDF-tekstilla: ${pdfIla}`)
  console.log(`  kuvaus PITENISI:  ${pidentyisi}`)
  console.log(`  ennallaan:        ${sama}`)
  console.log(`  LYHENISI:         ${lyhenisi}${lyhenisi ? "  <-- tarkista ennen ajoa" : ""}`)
  if (pidentyisi) {
    console.log(`\n  keskiarvo: ${Math.round(ennen / pidentyisi)} -> ${Math.round(jalkeen / pidentyisi)} merkkia`)
    console.log("\nnaytteita:")
    for (const n of naytteet) console.log(n)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
