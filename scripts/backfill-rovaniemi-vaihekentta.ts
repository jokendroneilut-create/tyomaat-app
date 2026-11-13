import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YHTEYSTIETO VAIHEKENTASTA JA PINTA-ALA KUVAUKSESTA (D-411).
 *
 * Rovaniemen Aittatien kaavamuutoksessa oli kaksi vikaa samalla rivilla:
 *
 *   1. "Lisatietoja: Kaupunginarkkitehti Sipi Hintsanen, 050 ..." oli
 *      kokonaisuudessaan `decision_status`-kentassa, koska kerain etsi
 *      sita vain "Kasittelyvaiheet"-lohkosta ja vain kappaleesta joka
 *      ALKAA sanalla "Lisatietoja".
 *   2. "kokonaiskerrosalaltaan 13200 kem2" ei poimiutunut, koska
 *      yksikko "kem2" puuttui tunnistettavien listalta.
 *
 * Molemmat on korjattu koodiin. Tama ajo korjaa jo tallennetut rivit.
 *
 * Mitattu 13.11.2026: 190 Rovaniemen rivista ja 144 lahdedokumentista
 * TASMALLEEN YKSI kummassakin. Skripti on silti saantopohjainen eika
 * id-kohtainen, jotta sama ajo kelpaa jos muoto toistuu.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const MERKKI = "rovaniemi_vaihekentta_2026_11"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseYhteystietolohko } = await import("../lib/projects/yhteystietolohko")
  const { extractFloorAreaFromText } = await import("../lib/projects/extractFloorAreaFromText")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Yhteystieto vaihetekstin perasta; vaihe jaa ilman sita. */
  const irrota = (teksti: string) => {
    const kohta = teksti.search(/Lisätietoja/i)
    if (kohta < 0) return null
    const henkilot = parseYhteystietolohko(teksti.slice(kohta))
    if (!henkilot.length) return null
    return { henkilot, vaihe: teksti.slice(0, kohta).trim() || null }
  }

  let muutoksia = 0

  for (const [taulu, nimiKentta] of [
    ["potential_projects", "title"],
    ["projects", "name"],
  ] as const) {
    const rivit: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await db.from(taulu).select(`id,${nimiKentta},metadata`).range(f, f + 999)
      if (error) throw error
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }

    const roi = rivit.filter((r) => /Rovaniem/i.test(String(r.metadata?.source_name ?? "")))
    const muutokset: any[] = []

    for (const r of roi) {
      const meta = r.metadata ?? {}
      const paivitys: Record<string, unknown> = {}

      if (!(meta.contact_persons ?? []).length) {
        const osuma = irrota(String(meta.decision_status ?? ""))
        if (osuma) {
          paivitys.contact_persons = osuma.henkilot.map((h: any) => ({
            kind: "person",
            name: h.name,
            title: h.title ?? null,
            phone: h.phone ?? null,
            email: h.email ?? null,
            organization: h.organization ?? null,
          }))
          paivitys.decision_status = osuma.vaihe
        }
      }

      if (!String(meta.floor_area ?? "").trim()) {
        const ala = extractFloorAreaFromText(String(meta.description ?? ""))
        if (ala) paivitys.floor_area = ala
      }

      if (Object.keys(paivitys).length) muutokset.push({ r, meta, paivitys })
    }

    console.log(`\n=== ${taulu.toUpperCase()}: korjattavia ${muutokset.length} / ${roi.length}`)
    for (const m of muutokset) {
      console.log(`\n  ${String(m.r[nimiKentta]).slice(0, 58)}`)
      for (const [k, v] of Object.entries(m.paivitys)) {
        console.log(`    ${k}`)
        console.log(`      ennen:   ${JSON.stringify(m.meta[k] ?? null)}`.slice(0, 150))
        console.log(`      jälkeen: ${JSON.stringify(v)}`.slice(0, 150))
      }
    }

    if (APPLY) {
      for (const m of muutokset) {
        const meta = { ...m.meta, ...m.paivitys }
        meta.takautuvat_ajot = [...new Set([...(meta.takautuvat_ajot ?? []), MERKKI])]
        const { error } = await db.from(taulu).update({ metadata: meta }).eq("id", m.r.id)
        if (error) throw error
      }
      console.log(`\n  kirjoitettu ${muutokset.length}`)
    }
    muutoksia += muutokset.length
  }

  /* Lahdedokumentti samaan muotoon, muuten kerain lukee vanhan uudelleen. */
  const { data: dokut, error: dokuVirhe } = await db
    .from("source_documents")
    .select("id,title,raw_payload")
    .ilike("source_name", "%Rovaniem%")
  if (dokuVirhe) throw dokuVirhe

  const dokuMuutokset = (dokut ?? [])
    .map((d: any) => ({ d, osuma: (d.raw_payload?.contacts ?? []).length ? null : irrota(String(d.raw_payload?.phase ?? "")) }))
    .filter((x) => x.osuma)

  console.log(`\n=== SOURCE_DOCUMENTS: korjattavia ${dokuMuutokset.length} / ${(dokut ?? []).length}`)
  for (const x of dokuMuutokset) {
    console.log(`  ${String(x.d.title).slice(0, 56)}`)
    console.log(`    vaihe:  ${JSON.stringify(x.osuma!.vaihe)}`)
    console.log(`    henkilöt: ${JSON.stringify(x.osuma!.henkilot)}`.slice(0, 150))
  }

  if (APPLY) {
    for (const x of dokuMuutokset) {
      const payload = { ...(x.d.raw_payload ?? {}), contacts: x.osuma!.henkilot, phase: x.osuma!.vaihe }
      const { error } = await db.from("source_documents").update({ raw_payload: payload }).eq("id", x.d.id)
      if (error) throw error
    }
    console.log(`\n  kirjoitettu ${dokuMuutokset.length}`)
  }

  console.log(`\n${APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS ==="}  rivejä ${muutoksia}, dokumentteja ${dokuMuutokset.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
