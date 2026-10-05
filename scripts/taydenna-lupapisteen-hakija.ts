import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim(); const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HAKIJA TAKAUTUVASTI KUULUTUKSEN PAATOS-PDF:STA (D-237).
 *
 * Kaksi tyota samassa ajossa:
 *   1. Dokumentit joilta PDF-teksti puuttuu: haetaan se nyt, jos
 *      kuulutus on viela verkossa. Poistunut kuulutus vastaa 404:lla,
 *      eika sita voi enaa saada.
 *   2. Dokumentit joilta teksti on: poimitaan hakija ja taydennetaan
 *      hankkeen rakennuttaja, jos se on tyhja.
 *
 * EI YLIKIRJOITA tunnettua rakennuttajaa eika kosketa yksityishenkiloon
 * — poimija palauttaa vain organisaation.
 *
 *   npx tsx scripts/taydenna-lupapisteen-hakija.ts
 *   npx tsx scripts/taydenna-lupapisteen-hakija.ts --apply
 *   npx tsx scripts/taydenna-lupapisteen-hakija.ts --apply --hae-pdf 60
 */

async function main() {
  const apply = process.argv.includes("--apply")
  const haeArg = process.argv.indexOf("--hae-pdf")
  const haeBudjetti = haeArg >= 0 ? Number(process.argv[haeArg + 1] ?? 0) : 0

  const { createClient } = await import("@supabase/supabase-js")
  const {
    extractBulletinApplicant,
    extractBulletinFields,
    bestBulletinDescription,
    fetchLupapisteCsrf,
    fetchLupapisteBulletinPdfText,
  } = await import("../lib/agent/lupapisteBulletinPdf")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const dokit: any[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db
      .from("source_documents")
      .select("id, document_url, raw_payload, raw_text, created_at")
      .eq("source_name", "Lupapiste kuulutukset")
      .order("created_at", { ascending: false })
      .range(from, from + 499)
    if (error) throw error
    dokit.push(...(data ?? []))
    if (!data || data.length < 500) break
  }

  const ilmanPdf = dokit.filter((d) => !(d.raw_payload ?? {}).bulletin_pdf_text)
  console.log(`dokumentteja ${dokit.length}, ilman PDF-tekstia ${ilmanPdf.length}\n`)

  /* 1. Puuttuvat PDF:t, uusimmat ensin. */
  let haettu = 0
  let saatu = 0
  if (haeBudjetti > 0) {
    const csrf = await fetchLupapisteCsrf()
    if (!csrf) {
      console.log("CSRF-tokenia ei saatu, PDF-haku ohitetaan")
    } else {
      for (const d of ilmanPdf.slice(0, haeBudjetti)) {
        const bulletinId = String(d.document_url).split("/bulletin/")[1] ?? ""
        if (!bulletinId) continue
        haettu++
        const teksti = await fetchLupapisteBulletinPdfText(bulletinId, csrf)
        if (!teksti) continue
        saatu++
        const kentat = extractBulletinFields(teksti)
        const kuvaus = bestBulletinDescription(teksti)
        console.log(`  PDF saatu: ${bulletinId.slice(0, 22)}  hakija=${kentat.hakija ?? "-"}  kuvaus ${kuvaus?.length ?? 0} merkkia`)
        if (!apply) continue
        await db
          .from("source_documents")
          .update({
            raw_payload: {
              ...(d.raw_payload ?? {}),
              bulletin_pdf_text: teksti,
              ...(kuvaus ? { bulletin_description: kuvaus } : {}),
              bulletin_fields: kentat,
              bulletin_pdf_fetched_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", d.id)
      }
      console.log(`\nPDF-haku: yritetty ${haettu}, saatu ${saatu}, poistunut verkosta ${haettu - saatu}\n`)
    }
  }

  /* 2. Hakija hankkeille ja ehdokkaille. */
  const { data: tuoreet } = await db
    .from("source_documents")
    .select("id, document_url, raw_payload")
    .eq("source_name", "Lupapiste kuulutukset")
    .limit(2000)

  const hakijat = new Map<string, string>()
  for (const d of tuoreet ?? []) {
    const teksti = (d.raw_payload ?? {}).bulletin_pdf_text
    if (!teksti) continue
    const hakija = extractBulletinApplicant(String(teksti))
    if (hakija) hakijat.set(String(d.document_url), hakija)
  }
  console.log(`hakija poimittavissa ${hakijat.size} dokumentista`)

  const urlit = [...hakijat.keys()]
  let paivitetty = 0

  for (const taulu of ["projects", "potential_projects"] as const) {
    for (let i = 0; i < urlit.length; i += 50) {
      const pala = urlit.slice(i, i + 50)
      const { data } = await db
        .from(taulu)
        .select(taulu === "projects" ? "id, name, developer, metadata" : "id, title, metadata")
        .in("metadata->>source_url", pala)

      for (const r of data ?? []) {
        const md = ((r as any).metadata ?? {}) as any
        const hakija = hakijat.get(String(md.source_url))
        if (!hakija) continue

        const nykyinen =
          taulu === "projects" ? String((r as any).developer ?? "").trim() : String(md.developer ?? "").trim()
        if (nykyinen) continue

        const nimi = String((r as any).name ?? (r as any).title ?? "").slice(0, 52)
        console.log(`  ${taulu.padEnd(18)} ${nimi.padEnd(54)} -> ${hakija}`)
        if (!apply) continue

        const paivitys: any = {
          metadata: {
            ...md,
            developer: hakija,
            description: md.description
              ? String(md.description).includes("Hakija:")
                ? md.description
                : `${md.description}\n\nHakija: ${hakija}`
              : `Hakija: ${hakija}`,
          },
        }
        if (taulu === "projects") paivitys.developer = hakija

        const { error } = await db.from(taulu).update(paivitys).eq("id", (r as any).id)
        if (error) console.log(`    VIRHE: ${error.message}`)
        else paivitetty++
      }
    }
  }

  console.log(apply ? `\npaivitetty ${paivitetty} rivia.` : "\nEi kirjoitettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
