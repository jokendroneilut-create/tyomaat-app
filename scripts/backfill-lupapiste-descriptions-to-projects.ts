import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUULUTUKSEN KUVAUS HANKKEISIIN ASTI.
 *
 * Edellinen ajo kirjoitti kuvauksen LAHDEDOKUMENTTEIHIN, mutta se ei
 * siirry hankkeisiin itsestaan: faktapoimija valitsee dokumentit ehdolla
 * `.is("facts_extracted_at", null)`, eli kasittelee jokaisen tasan
 * kerran. Jo kasitellyt jaisivat ilman.
 *
 * Kuvausta ei korvata vaan TAYDENNETAAN: nykyisessa tekstissa on
 * kiinteistotunnus ja osoite, ja uusi teksti on hakijan oma kuvaus
 * tyosta. Molemmat ovat tarpeen, eika mitaan haviä.
 *
 * projects-taulussa additional_info paivitetaan vain jos se vastaa
 * nykyista kuvausta - kasin taydennettya ei ylikirjoiteta.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("document_url,raw_payload")
      .eq("source_name", "Lupapiste kuulutukset")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const kuvaukset = new Map<string, string>()
  for (const d of docs) {
    const k = String(d.raw_payload?.bulletin_description ?? "").trim()
    if (k) kuvaukset.set(String(d.document_url), k)
  }
  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`kuulutuskuvauksia tarjolla: ${kuvaukset.size}\n`)

  const lataa = async (t: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select("*").range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  for (const [taulu, nimiSarake] of [["potential_projects", "title"], ["projects", "name"]] as const) {
    const rivit = (await lataa(taulu)).filter((p: any) =>
      /lupapiste/i.test(String(p.metadata?.source_name ?? ""))
    )

    let muuttuu = 0, ohitettu = 0
    let merkitEnnen = 0, merkitJalkeen = 0
    const naytteet: string[] = []
    const paivitykset: any[] = []

    for (const p of rivit) {
      const uusi = kuvaukset.get(String(p.metadata?.source_url ?? ""))
      if (!uusi) continue

      const nykyinen = String(p.metadata?.description ?? "").trim()

      /* Jo mukana - ei tehda mitaan. */
      if (nykyinen.includes(uusi.slice(0, Math.min(40, uusi.length)))) { ohitettu++; continue }

      const yhdistetty = nykyinen ? `${nykyinen}\n\n${uusi}` : uusi

      muuttuu++
      merkitEnnen += nykyinen.length
      merkitJalkeen += yhdistetty.length

      if (naytteet.length < 10) {
        naytteet.push(`  ${String(p[nimiSarake]).slice(0, 34).padEnd(36)} ${String(nykyinen.length).padStart(4)} -> ${String(yhdistetty.length).padStart(4)}   ${uusi.slice(0, 54)}`)
      }

      paivitykset.push({ id: p.id, nykyinen, yhdistetty, additional_info: p.additional_info })
    }

    console.log(`=== ${taulu} ===`)
    console.log(`  lupapiste-rivja:     ${rivit.length}`)
    console.log(`  paivitettavia:       ${muuttuu}`)
    console.log(`  jo mukana:           ${ohitettu}`)
    if (muuttuu) console.log(`  teksti keskimaarin:  ${Math.round(merkitEnnen / muuttuu)} -> ${Math.round(merkitJalkeen / muuttuu)}`)
    for (const n of naytteet) console.log(n)
    console.log()

    if (!APPLY) continue

    let n = 0
    for (const u of paivitykset) {
      const { data: nyt } = await supabase.from(taulu).select("metadata").eq("id", u.id).maybeSingle()
      const meta: any = nyt?.metadata ?? {}

      const paivitys: any = { metadata: { ...meta, description: u.yhdistetty } }

      /*
       * Asiakkaalle nakyva teksti paivitetaan vain jos se on sama kuin
       * kuvaus - kasin taydennettya tai toisesta lahteesta tullutta ei
       * ylikirjoiteta.
       */
      if (taulu === "projects") {
        const ai = String(u.additional_info ?? "").trim()
        if (!ai || ai === u.nykyinen) paivitys.additional_info = u.yhdistetty
      }

      await supabase.from(taulu).update(paivitys).eq("id", u.id)
      n++
    }
    console.log(`  kirjoitettu: ${n}\n`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
