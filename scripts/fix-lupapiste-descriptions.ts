import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KORJAA PILALLE MENNEET PDF-KUVAUKSET.
 *
 * Ensimmainen versio poimi kuvauksen myos ilman lainausmerkkeja, seuraavaan
 * tyhjaan riviin asti. Kuusamon paatoksissa ei ole tyhjia riveja, joten
 * poiminta jatkui paatosmaarayksiin ja sivunumeroon asti. Poiminta on nyt
 * rajattu lainausmerkkeihin; tama skripti ajaa uuden poiminnan tallennetun
 * PDF-tekstin yli ja poistaa kuvaukset jotka eivat enaa kelpaa.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const LABEL = "Hankkeen kuvaus hakemuksella:"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractApplicationDescription } = await import("../lib/agent/lupapisteBulletinPdf")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id, title, raw_payload")
      .eq("source_name", "Lupapiste kuulutukset")
      .not("raw_payload->>bulletin_description", "is", null)
      .range(from, from + 999)
    if (error) throw error
    docs.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`poimintoja kannassa: ${docs.length}\n`)

  let sailyy = 0, poistuu = 0, ehdokkaita = 0

  for (const d of docs) {
    const vanha = String(d.raw_payload?.bulletin_description ?? "")
    const uusi = extractApplicationDescription(String(d.raw_payload?.bulletin_pdf_text ?? ""))

    if (uusi === vanha) { sailyy++; continue }

    poistuu++
    console.log(`  ${uusi ? "MUUTTUU" : "POISTUU"}  ${String(d.title).slice(0, 48)}`)
    console.log(`     vanha ${vanha.length} merkkia: ...${vanha.slice(-90)}`)
    if (uusi) console.log(`     uusi  ${uusi.length} merkkia`)

    /* Ehdokkaat joiden kuvaukseen vanha teksti liitettiin. */
    const { data: cands } = await supabase
      .from("potential_projects")
      .select("id, title, metadata")
      .eq("metadata->>source_document_id", d.id)

    for (const c of cands ?? []) {
      const kuvaus = String((c as any).metadata?.description ?? "")
      if (!kuvaus.includes(LABEL)) continue
      ehdokkaita++
      console.log(`     ehdokas: ${String((c as any).title).slice(0, 56)}`)

      if (!APPLY) continue

      /* Liitetty lohko pois; uusi liitetaan vain jos poiminta kelpaa. */
      const puhdas = kuvaus.split(`\n\n${LABEL}`)[0].trim()
      const meta: any = { ...((c as any).metadata ?? {}) }
      delete meta.bulletin_description

      await supabase
        .from("potential_projects")
        .update({
          metadata: {
            ...meta,
            description: uusi ? `${puhdas}\n\n${LABEL}\n${uusi}`.trim() : puhdas,
            ...(uusi ? { bulletin_description: uusi } : {}),
          },
        })
        .eq("id", (c as any).id)
    }

    if (!APPLY) continue

    const payload: any = { ...(d.raw_payload ?? {}) }
    if (uusi) payload.bulletin_description = uusi
    else delete payload.bulletin_description

    await supabase.from("source_documents").update({ raw_payload: payload }).eq("id", d.id)
  }

  console.log(`\nsailyy ennallaan:      ${sailyy}`)
  console.log(`muuttuu tai poistuu:   ${poistuu}`)
  console.log(`ehdokkaita korjataan:  ${ehdokkaita}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
