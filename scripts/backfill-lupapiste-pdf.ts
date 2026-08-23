import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LUPAPISTEEN PAATOS-PDF TAKAUTUVASTI.
 *
 * Kuulutus poistuu verkosta muutoksenhakuajan paatyttya, joten tama on
 * kertaluontoinen pelastusoperaatio: otetaan talteen se mita on viela
 * saatavilla. Mitattu 21.8.2026: otoksesta 25 PDF irtosi 15:lta.
 *
 * Paivittaa kaksi asiaa:
 *   1. source_documents.raw_payload.bulletin_pdf_text (+ bulletin_description)
 *   2. ehdokkaan kuvauksen, jos PDF:sta saatiin hankekuvaus
 *
 * Ehdokkaan kuvaus paivitetaan vain jos siina EI viela ole PDF:n kuvausta.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0)
/*
 * Otsikko jolla kuvaus erottuu hankkeen muusta tekstista. Sama merkkijono
 * toimii myos tunnisteena: sen perusteella tiedetaan onko kuvaus jo lisatty.
 */
const LABEL = "Hankkeen kuvaus hakemuksella:"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  /*
   * bestBulletinDescription eika extractApplicationDescription: jalkimmainen
   * lukee vain kenttaa "Hankkeen kuvaus", jota on 1 %:ssa kuulutuksista.
   * Mitattu 23.8.2026 - ks. changelog.
   */
  const { fetchLupapisteCsrf, fetchLupapisteBulletinPdfText, bestBulletinDescription } =
    await import("../lib/agent/lupapisteBulletinPdf")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id, title, created_at, raw_payload")
      .eq("source_name", "Lupapiste kuulutukset")
      .order("created_at", { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    docs.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const puuttuu = docs.filter((d) => !d.raw_payload?.bulletin_pdf_text)
  const targets = LIMIT > 0 ? puuttuu.slice(0, LIMIT) : puuttuu

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`Lupapiste-dokumentteja:   ${docs.length}`)
  console.log(`  ilman pdf-tekstia:      ${puuttuu.length}`)
  console.log(`  haetaan nyt:            ${targets.length}\n`)

  const csrf = await fetchLupapisteCsrf()
  if (!csrf) throw new Error("CSRF-tokenia ei saatu")

  let saatiin = 0, eiSaatu = 0, kuvauksia = 0, ehdokkaita = 0
  const rivit: string[] = []

  for (const [i, d] of targets.entries()) {
    if (i > 0 && i % 50 === 0) console.log(`  ...kasitelty ${i}/${targets.length}`)

    const bulletinId = String(d.raw_payload?.original?.id ?? "")
    if (!bulletinId) { eiSaatu++; continue }

    const text = await fetchLupapisteBulletinPdfText(bulletinId, csrf)
    if (!text) { eiSaatu++; continue }

    saatiin++
    const kuvaus = bestBulletinDescription(text)
    if (kuvaus) kuvauksia++

    /* Ehdokas jolle tama dokumentti synnytti rivin. */
    const { data: cands } = await supabase
      .from("potential_projects")
      .select("id, title, metadata")
      .eq("metadata->>source_document_id", d.id)

    const paivitettavat = (cands ?? []).filter(
      (c: any) => kuvaus && !String(c.metadata?.description ?? "").includes(LABEL)
    )
    ehdokkaita += paivitettavat.length

    if (kuvaus && rivit.length < 15) {
      rivit.push(
        `  ${String(d.title).slice(0, 44).padEnd(46)} pdf ${String(text.length).padStart(5)}  kuvaus ${String(kuvaus.length).padStart(4)}  ehdokkaita ${paivitettavat.length}\n        ${kuvaus.slice(0, 120)}`
      )
    }

    if (!APPLY) continue

    await supabase
      .from("source_documents")
      .update({
        raw_payload: {
          ...(d.raw_payload ?? {}),
          bulletin_pdf_text: text,
          ...(kuvaus ? { bulletin_description: kuvaus } : {}),
          bulletin_pdf_fetched_at: new Date().toISOString(),
        },
      })
      .eq("id", d.id)

    for (const c of paivitettavat) {
      const vanha = String((c as any).metadata?.description ?? "")
      await supabase
        .from("potential_projects")
        .update({
          metadata: {
            ...((c as any).metadata ?? {}),
            description: `${vanha}\n\n${LABEL}\n${kuvaus}`.trim(),
            bulletin_description: kuvaus,
          },
        })
        .eq("id", (c as any).id)
    }
  }

  console.log(`\npdf saatiin:              ${saatiin}`)
  console.log(`  hankekuvaus poimittiin: ${kuvauksia}`)
  console.log(`pdf ei enaa saatavilla:   ${eiSaatu}`)
  console.log(`ehdokkaita paivitetaan:   ${ehdokkaita}`)
  if (rivit.length) { console.log("\nesimerkkeja:"); for (const r of rivit) console.log(r) }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
