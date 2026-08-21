import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: kuinka monella hankkeella on yhteystiedot jo tallessa
 * kuvaustekstissa, ilman etta niita on poimittu omiksi kentikseen?
 *
 * Taustaa: testiasiakkaiden kolme syyta olla jattamatta tilausta olivat
 * liian vahan hankkeita, liian myohaan ja LIIAN VAHAN YHTEYSTIETOJA.
 * Yrityslahteiden tiedotteet paattyvat lahes aina "Lisatiedot:"-lohkoon,
 * jossa on nimi, tehtava, puhelin ja sahkoposti.
 *
 * Ei kirjoita mitaan.
 */

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
/* Suomalainen puhelinnumero vapaassa tekstissa, valilyonnit sallien. */
const PHONE = /(?:puh\.?|p\.|tel\.?)?\s*(?:\+358|0)\s?\d{1,3}[\s-]?\d{3}[\s-]?\d{3,4}\b/g
const CONTACT_LABEL = /lis[äa]tie(?:toja|dot)|yhteystiedot|yhteyshenkil|mediayhteydet|further information/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const projects: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await s.from("projects")
      .select("id,name,city,is_public,additional_info,metadata").range(f, f + 999)
    if (error) throw error
    projects.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const cands: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("potential_projects")
      .select("id,title,status,metadata").eq("status", "new").range(f, f + 999)
    cands.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const analysoi = (nimi: string, rivit: any[], teksti: (r: any) => string) => {
    let onTeksti = 0, label = 0, email = 0, phone = 0, molemmat = 0
    const lahteet = new Map<string, number>()
    const naytteet: string[] = []

    for (const r of rivit) {
      const t = teksti(r)
      if (!t) continue
      onTeksti++
      const e = [...new Set(t.match(EMAIL) ?? [])]
      const p = [...new Set((t.match(PHONE) ?? []).map((x) => x.trim()))]
      const l = CONTACT_LABEL.test(t)
      if (l) label++
      if (e.length) email++
      if (p.length) phone++
      if (e.length && p.length) {
        molemmat++
        const src = String(r.metadata?.source_name ?? "(kasin)")
        lahteet.set(src, (lahteet.get(src) ?? 0) + 1)
        if (naytteet.length < 6) {
          naytteet.push(`    ${String(r.name ?? r.title).slice(0, 42).padEnd(44)} ${e.length} sposti, ${p.length} puh  [${src}]`)
        }
      }
    }

    console.log(`\n=== ${nimi} (${rivit.length}) ===`)
    console.log(`  kuvausteksti olemassa:      ${onTeksti}`)
    console.log(`  "Lisatiedot"-tyylinen otsikko: ${label}`)
    console.log(`  sisaltaa sahkopostin:       ${email}`)
    console.log(`  sisaltaa puhelinnumeron:    ${phone}`)
    console.log(`  MOLEMMAT (poimittavissa):   ${molemmat}   = ${Math.round(molemmat / rivit.length * 100)} % kaikista`)
    if (lahteet.size) {
      console.log("  lahteittain:")
      for (const [k, v] of [...lahteet].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`    ${String(v).padStart(4)}  ${k}`)
    }
    if (naytteet.length) { console.log("  esimerkkeja:"); for (const n of naytteet) console.log(n) }
  }

  analysoi("HANKKEET, kuvaus metadatassa", projects, (r) => String(r.metadata?.description ?? ""))
  analysoi("JONON EHDOKKAAT", cands, (r) => String(r.metadata?.description ?? ""))

  /* Nakyyko tieto asiakkaalle? additional_info on se kentta jonka kayttaja nakee. */
  const julkiset = projects.filter((p) => p.is_public)
  const kuvauksessaYhteys = julkiset.filter((p) => {
    const t = String(p.metadata?.description ?? "")
    return (t.match(EMAIL) ?? []).length > 0 && (t.match(PHONE) ?? []).length > 0
  })
  const naissaLisatiedoissa = kuvauksessaYhteys.filter((p) =>
    (String(p.additional_info ?? "").match(EMAIL) ?? []).length > 0
  )
  console.log(`\n=== NAKYVYYS ASIAKKAALLE ===`)
  console.log(`  julkisia hankkeita:                       ${julkiset.length}`)
  console.log(`  joilla yhteystiedot kuvauksessa:          ${kuvauksessaYhteys.length}`)
  console.log(`  joilla ne myos lisatiedoissa (nakyvissa): ${naissaLisatiedoissa.length}`)
  console.log(`  -> piilossa: ${kuvauksessaYhteys.length - naissaLisatiedoissa.length}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
