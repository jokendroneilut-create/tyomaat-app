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
 * VANTAAN KAAVASIVUJEN INGRESSI JO KERÄTYILLE (D-444).
 *
 * Keräin luki kuvauksen vain leipätekstistä, joten sivun ensimmäinen
 * kappale (`.text-ingress`, usein hankkeen koko) puuttui kaikilta. Tämä
 * hakee sivut kertaalleen, kirjoittaa ingressin dokumentin kuvaukseen ja
 * lisää sen hankkeen / jonorivin kuvauksen alkuun, jos se ei jo ole siellä.
 *
 * Kuivaharjoitus oletuksena; --apply kirjoittaa.
 */
import { createClient } from "@supabase/supabase-js"
import { kaavasivunIngressi } from "../lib/agent/vantaaKaavaSivu"

const APPLY = process.argv.includes("--apply")
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const odota = (ms: number) => new Promise((r) => setTimeout(r, ms))

function lisaaIngressi(kuvaus: string | null | undefined, ingressi: string, hakijaEnsin = false): string {
  if (!kuvaus) return ingressi
  if (kuvaus.replace(/\s+/g, " ").includes(ingressi)) return kuvaus
  /* Keräimen järjestys: "Lisätietoja hakijasta" ensin, sitten ingressi. */
  if (hakijaEnsin && kuvaus.startsWith("Lisätietoja hakijasta:")) {
    const [eka, ...loput] = kuvaus.split("\n\n")
    return [eka, ingressi, ...loput].join("\n\n")
  }
  return `${ingressi}\n\n${kuvaus}`
}

async function main() {
  const { data: docs, error } = await s
    .from("source_documents")
    .select("id,document_url,raw_payload")
    .eq("source_id", "vantaa-kaavat-vireilla")
  if (error) throw error
  const sivulliset = (docs ?? []).filter((d: any) => String(d.document_url).startsWith("https://www.vantaa.fi/"))
  console.log(`${sivulliset.length} sivullista dokumenttia${APPLY ? "" : " (kuivaharjoitus)"}`)

  let ingresseja = 0, dokPaivitys = 0, hankePaivitys = 0, jonoPaivitys = 0, eiSivua = 0
  for (const d of sivulliset as any[]) {
    await odota(800)
    let html: string | null = null
    try {
      const r = await fetch(d.document_url, { cache: "no-store" })
      html = r.ok ? await r.text() : null
    } catch {}
    if (!html) { eiSivua += 1; console.log(`  EI SIVUA  ${d.document_url}`); continue }
    const ingressi = kaavasivunIngressi(html)
    if (!ingressi) { console.log(`  ei ingressiä  ${d.document_url}`); continue }
    ingresseja += 1

    const rp = d.raw_payload ?? {}
    const uusiDokKuvaus = rp.description !== undefined ? lisaaIngressi(rp.description, ingressi, true) : undefined
    const dokMuuttuu = uusiDokKuvaus !== undefined && uusiDokKuvaus !== rp.description

    const { data: hankkeet } = await s.from("projects").select("id,name,status,metadata").or(
      `metadata->>source_document_id.eq.${d.id},metadata->>documents_url.eq.${d.document_url},metadata->>source_url.eq.${d.document_url}`
    )
    const { data: jono } = await s.from("potential_projects").select("id,title,status,metadata").eq("status", "new").or(
      `metadata->>source_document_id.eq.${d.id},metadata->>documents_url.eq.${d.document_url}`
    )

    console.log(`\n${rp.original?.properties?.kaavanimi1 ?? d.document_url}\n  INGRESSI: ${ingressi}`)
    if (APPLY && rp.description !== undefined) {
      await s.from("source_documents").update({ raw_payload: { ...rp, description: uusiDokKuvaus, ingressi_luettu: true } }).eq("id", d.id)
    }
    if (dokMuuttuu) dokPaivitys += 1

    for (const [taulu, rivit] of [["projects", hankkeet ?? []], ["potential_projects", jono ?? []]] as const) {
      for (const h of rivit as any[]) {
        const md = h.metadata ?? {}
        const uusi = lisaaIngressi(md.description, ingressi)
        if (uusi === md.description) { console.log(`  = ${taulu} ${h.id} ${h.name ?? h.title} (jo mukana)`); continue }
        console.log(`  + ${taulu} ${h.id} ${h.status} ${h.name ?? h.title}`)
        if (taulu === "projects") hankePaivitys += 1; else jonoPaivitys += 1
        if (APPLY) {
          const { error: e } = await s.from(taulu).update({ metadata: { ...md, description: uusi, ingressi_lisatty: new Date().toISOString() } }).eq("id", h.id)
          if (e) console.log(`    VIRHE ${e.message}`)
        }
      }
    }
  }
  console.log(`\nIngressi ${ingresseja} sivulla, sivu puuttui ${eiSivua}. Dokumentteja ${dokPaivitys}, hankkeita ${hankePaivitys}, jonorivejä ${jonoPaivitys} ${APPLY ? "päivitetty" : "päivitettäisiin"}.`)
}
main()
