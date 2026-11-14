import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * ROVANIEMEN KAAVATORI: TYHJAT JONORIVIT JA PUUTTUVAT YRITYKSET (D-417).
 *
 * Johannes 14.11.2026: *"jonossa on tama hanke ja kymmenia rovaniemi
 * lahteen hankkeita joista puuttuu kuvaus ja liittyva yritys esimerkiksi
 * tassa Arctic Lapland Investment Oy. Tassa kerrotaan myos arkkitehti
 * Arkkitehtitoimisto Jarmo Lokio Oy."*
 *
 * 12.11.2026 jonoon syntyi 31 rivia ilman faktoja: kuvaus, kaavatunnus,
 * vaihe ja yhteystiedot tyhjia, vaikka kaikki lukee dokumentin
 * raw_payloadissa. Tama tayttaa ne dokumentista, ja kaikille Rovaniemen
 * riveille (jono ja nakyvat hankkeet):
 *
 *   - rakennuttaja kuvauksesta (`kaavanRakennuttaja`), vain tyhjaan
 *   - kaavan laatija liittyviin yrityksiin (`kaavanLaatija`)
 *   - liimattu kuvaus "kaupunginosa nro 20Arctic ..." irti
 *
 * Olemassa olevaa tietoa ei korvata, paitsi liimattu kuvaus.
 *
 *   npx tsx scripts/korjaa-rovaniemen-kaavatori.ts          kuiva
 *   npx tsx scripts/korjaa-rovaniemen-kaavatori.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const LAHDE = "Rovaniemen Kaavatori"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { korjaaLiimattuKuvaus } = await import("../lib/agent/rovaniemenKuvaus")
  const { kaavanRakennuttaja } = await import("../lib/projects/kaavanRakennuttaja")
  const { kaavanLaatija } = await import("../lib/projects/kaavanOsapuolet")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: dokut, error } = await db
    .from("source_documents")
    .select("id,raw:raw_payload")
    .eq("source_name", LAHDE)
  if (error) throw error
  const raw = new Map<string, any>((dokut ?? []).map((d: any) => [d.id, d.raw ?? {}]))

  let muutettu = 0
  const yhteenveto = { kuvaus: 0, liimattu: 0, rakennuttaja: 0, laatija: 0, yhteystiedot: 0 }

  /* ---------- JONO ---------- */
  const { data: jono, error: e1 } = await db
    .from("potential_projects")
    .select("id,title,status,metadata")
    .eq("metadata->>source_name", LAHDE)
  if (e1) throw e1

  for (const r of (jono ?? []) as any[]) {
    const md = r.metadata ?? {}
    const d = raw.get(md.source_document_id) ?? {}
    const muutos: Record<string, unknown> = {}
    const loki: string[] = []

    let kuvaus: string | null = md.description ?? null
    if (!kuvaus) {
      const perus = korjaaLiimattuKuvaus(d.description)
      kuvaus = [perus, d.processing_steps ? `Käsittelyvaiheet: ${d.processing_steps}` : null].filter(Boolean).join(" ") || null
      if (kuvaus) {
        muutos.description = kuvaus
        loki.push(`KUVAUS: ${kuvaus.slice(0, 110)}…`)
        yhteenveto.kuvaus++
      }
    } else {
      const korjattu = korjaaLiimattuKuvaus(kuvaus)
      if (korjattu && korjattu !== kuvaus) {
        muutos.description = korjattu
        kuvaus = korjattu
        loki.push(`LIIMATTU: ${korjattu.slice(0, 80)}…`)
        yhteenveto.liimattu++
      }
    }
    if (!md.kaava_tunnus && d.kaava_tunnus) muutos.kaava_tunnus = d.kaava_tunnus
    if (!md.decision_number && d.decision_number) muutos.decision_number = d.decision_number
    if (!md.decision_status && d.phase) muutos.decision_status = d.phase

    const nykyiset = Array.isArray(md.contact_persons) ? md.contact_persons : []
    const dokusta = (Array.isArray(d.contacts) ? d.contacts : []).filter((c: any) => c?.name)
    /* Vain jonossa olevat: hyvaksytyn rivin yhteystiedot ovat jo hankkeessa (D-409). */
    if (r.status === "new" && !nykyiset.length && dokusta.length) {
      muutos.contact_persons = dokusta.map((c: any) => ({ name: c.name, title: c.title, phone: c.phone, email: c.email }))
      loki.push(`YHTEYSTIEDOT: ${dokusta.map((c: any) => `${c.name} ${c.phone ?? ""}`).join("; ")}`)
      yhteenveto.yhteystiedot++
    }

    const developer = kaavanRakennuttaja({ sourceName: LAHDE, description: kuvaus, nykyinen: md.developer })
    if (developer) {
      muutos.developer = developer
      loki.push(`RAKENNUTTAJA: ${developer}`)
      yhteenveto.rakennuttaja++
    }
    const laatija = kaavanLaatija(kuvaus)
    const vanhat: string[] = Array.isArray(md.related_companies) ? md.related_companies : []
    if (laatija) {
      const lista = mergeCompanyNames(vanhat, [laatija])
      if (lista.length > vanhat.length) {
        muutos.related_companies = lista
        loki.push(`LIITTYVÄ YRITYS: +${laatija}`)
        yhteenveto.laatija++
      }
    }

    if (!Object.keys(muutos).length) continue
    muutettu++
    console.log(`JONO  [${r.status}] ${String(r.title).slice(0, 70)}`)
    for (const l of loki) console.log(`    ${l}`)
    if (APPLY) {
      const ajot = [...new Set([...(md.takautuvat_ajot ?? []), "rovaniemen_kaavatori_2026_11"])]
      const { error: e } = await db
        .from("potential_projects")
        .update({ metadata: { ...md, ...muutos, takautuvat_ajot: ajot }, updated_at: new Date().toISOString() })
        .eq("id", r.id)
      if (e) throw e
    }
  }

  /* ---------- NAKYVAT HANKKEET ---------- */
  const { data: hankkeet, error: e2 } = await db
    .from("projects")
    .select("id,name,developer,additional_info,metadata")
    .eq("metadata->>source_name", LAHDE)
  if (e2) throw e2

  for (const r of (hankkeet ?? []) as any[]) {
    const md = r.metadata ?? {}
    const sarakkeet: Record<string, unknown> = {}
    const meta: Record<string, unknown> = {}
    const loki: string[] = []

    let kuvaus: string | null = r.additional_info ?? md.description ?? null
    const korjattu = korjaaLiimattuKuvaus(kuvaus)
    if (kuvaus && korjattu && korjattu !== kuvaus) {
      sarakkeet.additional_info = korjattu
      loki.push(`LIIMATTU: ${korjattu.slice(0, 80)}…`)
      yhteenveto.liimattu++
      kuvaus = korjattu
    }
    if (md.description) {
      const mk = korjaaLiimattuKuvaus(md.description)
      if (mk && mk !== md.description) meta.description = mk
    }

    const developer = kaavanRakennuttaja({ sourceName: LAHDE, description: kuvaus, nykyinen: r.developer ?? md.developer })
    if (developer) {
      sarakkeet.developer = developer
      meta.developer = developer
      loki.push(`RAKENNUTTAJA: ${developer}`)
      yhteenveto.rakennuttaja++
    }
    const laatija = kaavanLaatija(kuvaus)
    const vanhat: string[] = Array.isArray(md.related_companies) ? md.related_companies : []
    if (laatija) {
      const lista = mergeCompanyNames(vanhat, [laatija])
      if (lista.length > vanhat.length) {
        meta.related_companies = lista
        loki.push(`LIITTYVÄ YRITYS: +${laatija}`)
        yhteenveto.laatija++
      }
    }

    if (!Object.keys(sarakkeet).length && !Object.keys(meta).length) continue
    muutettu++
    console.log(`HANKE ${String(r.name).slice(0, 70)}`)
    for (const l of loki) console.log(`    ${l}`)
    if (APPLY) {
      const ajot = [...new Set([...(md.takautuvat_ajot ?? []), "rovaniemen_kaavatori_2026_11"])]
      const { error: e } = await db
        .from("projects")
        .update({ ...sarakkeet, metadata: { ...md, ...meta, takautuvat_ajot: ajot } })
        .eq("id", r.id)
      if (e) throw e
    }
  }

  console.log(`\n${APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS ==="}  rivejä ${muutettu}`, yhteenveto)
}
main()
