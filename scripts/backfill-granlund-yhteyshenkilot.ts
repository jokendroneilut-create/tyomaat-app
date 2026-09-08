import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * GRANLUNDIN YHTEYSHENKILÖT OMAAN KENTTÄÄNSÄ (D-182).
 *
 * Tieto oli sivulla koko ajan mutta valui kuvauksen sekaan tekstinä, ja
 * D-181 leikkasi sen sieltä pois. Nyt se luetaan rakenteesta
 * `contact_persons`-kenttään, jonka sekä katselmointinäkymä että
 * hankekortti osaavat näyttää.
 *
 * EI UUTTA VERKKOHAKUA. Sivun HTML on tallessa `raw_payload`ssa.
 *
 * YKSIKÄÄN RIVI EI KATOA. Yhteystietokentästä ei poisteta mitään.
 *
 * SAMA HENKILÖ TUNNISTETAAN PUHELINNUMEROSTA, EI NIMESTÄ. Kannassa oli
 * jo Granlundin yhteyshenkilöitä, mutta ne oli poimittu kuvauksen
 * litteästä tekstistä ja nimet olivat rikki: "Granlund Oulu" (yksikkö,
 * ei henkilö), sukunimi ja nimike yhteen liimattuna, sekä "Arkkitehti
 * Granlund" (nimike nimenä). Puhelinnumerot olivat oikein.
 * Nimellä vertaaminen olisi siis lisännyt saman ihmisen toiseen kertaan
 * ja jättänyt rikkinäisen rivin näkyviin sen viereen.
 *
 * Kun numero täsmää, rivin nimi ja nimike korjataan rakenteesta luetuiksi
 * eikä uutta riviä lisätä. Sähköposti säilyy, jos rakenteesta ei saada
 * parempaa: tyhjä ei saa korvata olemassa olevaa osoitetta.
 *
 * Aja ensin ilman --apply-lippua: se ei kirjoita mitään.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseGranlundContacts } = await import("../lib/agent/granlundProject")

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

  const kontaktit = new Map<string, any[]>()
  for (const d of docs ?? []) {
    const html = (d as any).raw_payload?.original?.content?.rendered
    if (!html) continue
    const luetut = parseGranlundContacts(html)
    if (luetut.length) kontaktit.set(d.id, luetut)
  }
  console.log(`Granlund-dokumentteja yhteyshenkilöineen: ${kontaktit.size}`)

  let rivit = 0
  let lisatty = 0
  let korjattu = 0
  let ohitettu = 0

  const numero = (arvo: unknown) => String(arvo ?? "").replace(/\D/g, "")

  for (const table of ["potential_projects", "projects"] as const) {
    const columns = table === "potential_projects" ? "id, title, metadata" : "id, name, metadata"

    const rows: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rows.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    for (const row of rows) {
      const uudet = kontaktit.get(row.metadata?.source_document_id)
      if (!uudet) continue

      const olemassa: any[] = Array.isArray(row.metadata?.contact_persons)
        ? row.metadata.contact_persons
        : []

      const lista = olemassa.map((c) => ({ ...c }))
      const rivinLoki: string[] = []

      for (const uusi of uudet) {
        const vanha = uusi.phone
          ? lista.find((c) => numero(c?.phone) && numero(c.phone) === numero(uusi.phone))
          : undefined

        if (vanha) {
          const samaNimi = String(vanha.name ?? "").trim() === uusi.name
          if (samaNimi && String(vanha.title ?? "") === String(uusi.title ?? "")) {
            ohitettu++
            continue
          }
          rivinLoki.push(
            `  ~ ${JSON.stringify(vanha.name)} → ${JSON.stringify(uusi.name)}` +
              `\n      nimike ${JSON.stringify(vanha.title)} → ${JSON.stringify(uusi.title)}`
          )
          vanha.name = uusi.name
          vanha.title = uusi.title
          vanha.organization = uusi.organization
          /* Tyhjä ei saa korvata olemassa olevaa osoitetta. */
          vanha.email = uusi.email || vanha.email || ""
          korjattu++
          continue
        }

        /* Nimellä varmistus, jos numeroa ei ole kummallakaan. */
        if (lista.some((c) => String(c?.name ?? "").trim().toLowerCase() === uusi.name.toLowerCase())) {
          ohitettu++
          continue
        }

        rivinLoki.push(
          `  + ${uusi.name} | ${uusi.title ?? "-"} | ${uusi.phone || "-"} | ${uusi.email || "(ei osoitetta)"}`
        )
        lista.push(uusi)
        lisatty++
      }

      if (rivinLoki.length === 0) continue

      rivit++
      console.log(`\n### ${table} ${row.title ?? row.name}  (ennestään ${olemassa.length} kpl)`)
      for (const r of rivinLoki) console.log(r)

      if (!APPLY) continue

      await supabase
        .from(table)
        .update({
          metadata: {
            ...(row.metadata ?? {}),
            contact_persons: lista,
            contacts_backfilled_at: new Date().toISOString(),
          },
        })
        .eq("id", row.id)
    }
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`hankerivejä täydennetty:   ${rivit}`)
  console.log(`yhteyshenkilöitä lisätty:  ${lisatty}`)
  console.log(`nimiä korjattu numeron perusteella: ${korjattu}`)
  console.log(`jo kunnossa, ohitettu:     ${ohitettu}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
