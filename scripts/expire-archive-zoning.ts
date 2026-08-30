import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LÄHTEEN ARKISTO-OSIOSTA SYNTYNEET HANKKEET POIS NÄKYVISTÄ.
 *
 * Pornaisten kaavasivulla on kaksi osiota, "Vireillä oleva asemakaavan
 * muutos / asemakaava" ja "Hyväksytyt / voimaan tulleet asemakaavat".
 * Kerääjä luki molemmat samalla tavalla, joten arkistosta syntyi
 * hankkeita joiden kaava on tullut voimaan 2004–2022. Ne eivät ole
 * koskaan olleet liidejä.
 *
 * Kerääjä merkitsee arkistorivit nyt osion perusteella (`arkisto: true`)
 * eikä tee niistä ehdokasta. Tämä skripti siivoaa sen mikä ehti syntyä.
 *
 * KYNNYS ON SAMA 24 KUUKAUTTA kuin vaiheen siirrossa (D-148). Vasta
 * arkistoon siirtynyt kaava on yhä liidi — se tarkoittaa että kaavoitus
 * juuri päättyi ja rakentaminen voi alkaa. Vain vanha arkistorivi
 * poistuu näkyvistä.
 *
 * ILMAN PÄIVÄÄ EI VANHENNETA. Jos voimaantulopäivää ei ole poimittu, ei
 * tiedetä kumpi tapaus on kyseessä.
 *
 * Vanheneminen ei ole poisto: rivi ja historia säilyvät, ja hanke
 * palautuu jos se joskus palaa vireillä olevaksi.
 *
 * Kuivaharjoitus oletuksena; kirjoittaa vasta --apply.
 */

const APPLY = process.argv.includes("--apply")
const KUUKAUDET = 24
const SYY = "lahteen_arkisto_osio"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* 1. Arkistoriveiksi merkityt dokumentit. */
  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await admin
      .from("source_documents")
      .select("id,source_name,title,document_url,raw_payload")
      .eq("raw_payload->>arkisto", "true")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const docByUrl = new Map(docs.map((d) => [String(d.document_url), d]))
  console.log(`${APPLY ? "AJO" : "KUIVAHARJOITUS"}: arkistodokumentteja ${docs.length}\n`)

  if (!docs.length) {
    console.log("Ei arkistoriveja. Aja lahde ensin uudelleen, jotta merkinta syntyy.")
    return
  }

  /* 2. Hankkeet jotka ovat syntyneet niista. */
  const hankkeet: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await admin
      .from("projects")
      .select("id,name,city,phase,status,is_public,metadata")
      .range(f, f + 999)
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const raja = new Date()
  raja.setMonth(raja.getMonth() - KUUKAUDET)

  const vanhennettavat: any[] = []
  const sailytettavat: any[] = []

  for (const h of hankkeet) {
    if (h.status !== "active" || h.is_public === false) continue
    const doc = docByUrl.get(String(h.metadata?.source_url))
    if (!doc) continue

    const paiva = h.metadata?.kaava_voimaantulo ?? doc.raw_payload?.voimaantulo ?? null
    if (!paiva) {
      sailytettavat.push({ h, syy: "ei voimaantulopaivaa" })
      continue
    }
    if (new Date(`${paiva}T00:00:00Z`) > raja) {
      sailytettavat.push({ h, syy: `tuore (${paiva})` })
      continue
    }
    vanhennettavat.push({ h, paiva })
  }

  vanhennettavat.sort((a, b) => String(a.paiva).localeCompare(String(b.paiva)))

  for (const { h, paiva } of vanhennettavat) {
    console.log(`  vanhennetaan  ${paiva}  ${String(h.city).slice(0, 12).padEnd(13)} ${String(h.name).slice(0, 46)}`)
  }
  for (const { h, syy } of sailytettavat) {
    console.log(`  SAILYTETAAN   ${String(syy).padEnd(24)} ${String(h.name).slice(0, 46)}`)
  }

  console.log(`\nvanhennettavia ${vanhennettavat.length} | sailytettavia ${sailytettavat.length}`)

  if (!APPLY) {
    console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
    return
  }

  let ok = 0
  for (const { h, paiva } of vanhennettavat) {
    const { error } = await admin
      .from("projects")
      .update({
        status: "expired",
        metadata: {
          ...(h.metadata ?? {}),
          expired_at: new Date().toISOString(),
          expired_reason: SYY,
          expired_detail: `Kaava on lahteen arkisto-osiossa, voimaan ${paiva}`,
        },
      })
      .eq("id", h.id)
    if (error) console.log(`  VIRHE ${h.name}: ${error.message}`)
    else ok++
  }
  console.log(`\nvanhennettu ${ok} / ${vanhennettavat.length}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
