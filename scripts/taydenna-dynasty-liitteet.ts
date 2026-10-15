import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

import { extractItemText, fetchDecoded } from "../lib/agent/fetchDynastySource"

/*
 * KAAVARIVIN LIITE ON PÖYTÄKIRJASIVU, JOTA KUKAAN EI AVANNUT (D-290).
 *
 * Johannes 15.10.2026, Paltamon Ouluntien teollisuusalueen kaavasta:
 * *"tähän pitäisi poimia kuvaukseen ainakin tämä kohta dokumenteista"*.
 *
 * Syy ei ollut jäsennin vaan se, ettei liitettä haettu. Kaavakerääjät
 * kirjoittavat liitelinkit `raw_payload.attachments`-kenttään, ja
 * mitattu 15.10.2026: **kenttää ei lue mikään** (ainoa osuma koko
 * koodipohjassa on `backfill-kaavaselostus-contacts.ts`). Yleinen
 * täydentäjä `taydenna-kaavakuvaukset.ts` hakee vain `.pdf`-linkkejä
 * `document_url`-sivulta, joten HTML-pöytäkirja ohitettiin.
 *
 * Paltamon tapauksessa liite on Dynastyn kokousasiasivu, jolla on koko
 * kaavan päätöshistoria: 8 574 merkkiä, mukana KaiCell Fibersin
 * biotuotetehdas, Suomen Säätöenergian biometanolitehdas ja 12 tontin
 * pinta-alat ja rakennusoikeudet. Kannassa oli 89 merkkiä.
 *
 * LAAJUUS ON KAPEA, JA SE SANOTAAN ETEEN. Mitattu: 349 dokumentilla on
 * attachments-lista, joista 28:lla Dynasty-liite ja **6 on ohuita**
 * (3 Paltamo, 3 Ylitornio). Tämä ei ole iso yleinen aukko vaan halpa.
 * Jäsennin (`extractItemText`) on jaettu 13 päätöslähteen kanssa, joten
 * korjaus siihen vaikutti laajemmin kuin tämä skripti.
 *
 * EI KORVAA PITKÄÄ EIKÄ KÄSIN KIRJOITETTUA. Kirjoitetaan vain jos
 * nykyinen on alle `OHUT_RAJA` ja uusi on aidosti pidempi. Alkuperäinen
 * säilyy metadatassa.
 *
 *   npx tsx scripts/taydenna-dynasty-liitteet.ts
 *   npx tsx scripts/taydenna-dynasty-liitteet.ts --apply
 *   npx tsx scripts/synkronoi-kuvaus-nakyviin.ts --apply   # näkyvä kenttä
 */

const DYNASTY = /page=meetingitem/i
const OHUT_RAJA = 1000
/* Sama katto kuin muilla lahteilla (fingrid, nrc). */
const KUVAUS_KATTO = 4000

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const docs: any[] = []
  for (let alku = 0; ; alku += 1000) {
    const { data, error } = await db
      .from("source_documents")
      .select("id, source_name, title, raw_payload")
      .range(alku, alku + 999)
    if (error) {
      console.error("VIRHE luettaessa dokumentteja:", error.message)
      process.exit(1)
    }
    docs.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const kohteet = docs.filter((d) => {
    const liitteet = d.raw_payload?.attachments
    return Array.isArray(liitteet) && liitteet.some((a: any) => DYNASTY.test(String(a?.url ?? "")))
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`dokumentteja: ${docs.length}, joilla Dynasty-liite: ${kohteet.length}\n`)

  let kirjoitettu = 0
  let ohitettu = 0

  for (const d of kohteet) {
    /* Jonorivi dokumentin kautta; sama tunniste kuin tuonti kirjaa. */
    const { data: ehdokkaat, error: ev } = await db
      .from("potential_projects")
      .select("id, title, metadata")
      .eq("metadata->>source_document_id", d.id)
    if (ev) {
      console.log(`VIRHE ehdokasta haettaessa (${d.id}): ${ev.message}`)
      continue
    }
    if (!ehdokkaat?.length) {
      console.log(`${String(d.title).slice(0, 62)}\n  ei jonoriviä tälle dokumentille — ohitettu`)
      ohitettu++
      continue
    }

    for (const e of ehdokkaat) {
      const md = (e.metadata as any) ?? {}
      const nykyinen = String(md.description ?? "").trim()

      if (nykyinen.length >= OHUT_RAJA) {
        console.log(`${String(e.title).slice(0, 62)}\n  nykyinen ${nykyinen.length} merkkiä — ei ohut, ohitettu`)
        ohitettu++
        continue
      }

      const liite = (d.raw_payload.attachments as any[]).find((a) => DYNASTY.test(String(a?.url ?? "")))
      const html = await fetchDecoded(String(liite.url))
      if (!html) {
        console.log(`${String(e.title).slice(0, 62)}\n  liitettä ei saatu: ${liite.url}`)
        ohitettu++
        continue
      }

      const teksti = extractItemText(html)
      if (!teksti || teksti.length <= nykyinen.length) {
        console.log(
          `${String(e.title).slice(0, 62)}\n  poiminta ${teksti?.length ?? 0} merkkiä ei paranna (${nykyinen.length}) — ohitettu`
        )
        ohitettu++
        continue
      }

      const kuvaus = teksti.slice(0, KUVAUS_KATTO)
      console.log(`${String(e.title).slice(0, 62)}`)
      console.log(`  ${nykyinen.length} -> ${kuvaus.length} merkkiä   [${String(liite.label ?? "").slice(0, 50)}]`)
      console.log(`  NYT:  ${nykyinen.slice(0, 120)}`)
      console.log(`  UUSI: ${kuvaus.slice(0, 220)}…`)

      if (!apply) continue

      const { error: uv } = await db
        .from("potential_projects")
        .update({
          metadata: {
            ...md,
            description: kuvaus,
            /* Tieto ei katoa vaikka kentan sisalto vaihtuu. */
            description_alkuperainen: nykyinen || null,
            description_lahde: String(liite.url),
            description_taydennetty: new Date().toISOString(),
          },
        })
        .eq("id", e.id)

      if (uv) console.log(`  VIRHE: ${uv.message}`)
      else kirjoitettu++
    }
  }

  console.log(`\nkirjoitettu ${kirjoitettu}, ohitettu ${ohitettu}`)
  if (!apply) console.log("Ei muutettu mitään. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e?.message ?? e)
  process.exit(1)
})
