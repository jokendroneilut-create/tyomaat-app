import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TAKAUTUVA KORJAUS GRANLUNDIN SIVUKALUSTEESEEN.
 *
 * `parseGranlundDescription` leikkasi kuvauksen vasta "Paikkakunta"-
 * kohdasta, mutta yhteyshenkilölaatikko ("Kysy lisää") ja kuvaajan
 * krediitti ("Kuvat:") ovat kuvauksen JA kenttälohkon välissä. Niinpä
 * jokainen kuvaus päättyi nimettyyn henkilöön, tehtävänimikkeeseen,
 * puhelinnumeroon ja sähköpostiosoitteeseen. Samasta syystä "Muut
 * hankkeen toimijat" jatkui linkkilaatikkoon asti.
 *
 * EI UUTTA VERKKOHAKUA. Sivun HTML on tallessa `raw_payload`ssa, joten
 * uusi jäsennys tehdään siihen.
 *
 * Aja ensin ilman --apply-lippua: se ei kirjoita mitään.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseGranlundDescription, parseGranlundFields } = await import(
    "../lib/agent/granlundProject"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: docs, error } = await supabase
    .from("source_documents")
    .select("id, title, raw_payload")
    .eq("source_name", "Granlund projektit")
  if (error) throw error

  /* Uusi kuvaus ja toimijat dokumentin tunnuksella. */
  const uudet = new Map<string, { kuvaus: string | null; toimijat: string[] }>()
  for (const d of docs ?? []) {
    const html = (d as any).raw_payload?.original?.content?.rendered
    if (!html) continue
    uudet.set(d.id, {
      kuvaus: parseGranlundDescription(html),
      toimijat: parseGranlundFields(html).otherCompanies,
    })
  }
  console.log(`Granlund-dokumentteja: ${uudet.size}`)

  let kuvauksia = 0
  let toimijoita = 0

  for (const table of ["potential_projects", "projects"] as const) {
    const isQueue = table === "potential_projects"
    const columns = isQueue ? "id, title, metadata" : "id, name, additional_info, metadata"

    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    for (const row of rows) {
      const uusi = uudet.get(row.metadata?.source_document_id)
      if (!uusi) continue

      const kuvaus = String(row.metadata?.description ?? "")
      const kuvausMuuttuu = !!uusi.kuvaus && uusi.kuvaus !== kuvaus

      /*
       * Granlundin oma rooli säilytetään sellaisenaan: se rakennetaan
       * palveluista, joita tämä korjaus ei kosketa.
       */
      const vanhatToimijat: string[] = Array.isArray(row.metadata?.related_companies)
        ? row.metadata.related_companies
        : []
      const omaRooli = vanhatToimijat.filter((c) => /^Granlund \(/.test(c))
      const uudetToimijat = [...omaRooli, ...uusi.toimijat]
      const toimijatMuuttuvat =
        JSON.stringify(uudetToimijat) !== JSON.stringify(vanhatToimijat)

      if (!kuvausMuuttuu && !toimijatMuuttuvat) continue
      if (kuvausMuuttuu) kuvauksia++
      if (toimijatMuuttuvat) toimijoita++

      console.log(`\n### ${table} ${row.title ?? row.name}`)
      if (kuvausMuuttuu) {
        console.log(`  kuvaus ${kuvaus.length} → ${uusi.kuvaus!.length} merkkiä`)
        console.log(`  jää:     …${uusi.kuvaus!.slice(-80)}`)
        console.log(`  poistuu: ${kuvaus.slice(uusi.kuvaus!.length).slice(0, 160)}`)
      }
      if (toimijatMuuttuvat) {
        console.log(`  toimijat: ${JSON.stringify(vanhatToimijat)}`)
        console.log(`         →  ${JSON.stringify(uudetToimijat)}`)
      }

      if (!APPLY) continue

      const metadata = {
        ...(row.metadata ?? {}),
        ...(kuvausMuuttuu ? { description: uusi.kuvaus } : {}),
        related_companies: uudetToimijat,
        description_cleaned_at: new Date().toISOString(),
      }

      await supabase
        .from(table)
        .update(
          isQueue
            ? { metadata }
            : {
                metadata,
                ...(kuvausMuuttuu && row.additional_info ? { additional_info: uusi.kuvaus } : {}),
              }
        )
        .eq("id", row.id)
    }
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`kuvauksia siivottu:  ${kuvauksia}`)
  console.log(`toimijoita siivottu: ${toimijoita}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
