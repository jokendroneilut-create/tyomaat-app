import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SALON KAAVOJEN TAVOITTEET LIITTEESTA (D-317).
 *
 * Johannes 19.10.2026 jonorivista `6094c737` (Helenankatu 12): *"tasta
 * pdf:sta olisi pitanyt poimia [Tavoitteet-luku] … korjataan tahan
 * hankkeeseen, aiempiin, jonoon ja tuleviin hankkeisiin."*
 *
 * Kerääjä luki vain kaavasivun ja SUODATTI liitelinkit pois, joten
 * OAS:n tavoiteluku -- ainoa kohta joka kertoo mita alueelle aiotaan
 * rakentaa -- jai kokonaan pois. Kerääjä korjattiin, mutta vanhat rivit
 * eivat korjaannu itsestaan, koska jo tuotua riviä ei kirjoiteta
 * uudelleen.
 *
 * TEKSTIA EI KEKSITA: jokainen kaavasivu haetaan uudelleen, liite
 * valitaan samalla funktiolla kuin kerääjässä (selostus ensin, OAS
 * vasta jos selostusta ei ole) ja kuvaus lasketaan samalla
 * jasentimella. Lauseet yhdistetaan toistamatta sivun omia virkkeitä,
 * eika mitaan poisteta: kuvaus voi vain kasvaa.
 *
 *   npx tsx scripts/taydenna-salon-kaavatavoitteet.ts
 *   npx tsx scripts/taydenna-salon-kaavatavoitteet.ts --apply
 */

import * as cheerio from "cheerio"
import {
  haeKaavaselostuksenTeksti,
  kaavanKuvausTekstista,
  valitseKaavanAsiakirja,
  yhdistaKuvaukset,
} from "../lib/agent/kaavanKuvaus"

const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"
const LAHDE = "Salon ajankohtaiset asemakaavat"

type Rivi = {
  taulu: "potential_projects" | "projects"
  id: string
  nimi: string
  status: string | null
  sivu: string
  kuvaus: string
  metadata: Record<string, any>
}

async function sivunLiitteet(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
    if (!res.ok) return null
    const $ = cheerio.load(await res.text())
    return $("a[href]")
      .toArray()
      .map((a) => ({ href: $(a).attr("href") ?? null, teksti: $(a).text() }))
  } catch {
    return null
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Salon kaavarivit molemmista tauluista --- */
  const rivit: Rivi[] = []
  for (const taulu of ["potential_projects", "projects"] as const) {
    const sarakkeet =
      taulu === "projects" ? "id, name, status, additional_info, metadata" : "id, title, status, metadata"
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db
        .from(taulu)
        .select(sarakkeet)
        .eq("metadata->>source_name", LAHDE)
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      for (const r of (data ?? []) as any[]) {
        const md: Record<string, any> = r.metadata ?? {}
        const sivu = String(md.documents_url ?? md.source_url ?? "")
        if (!sivu) continue
        rivit.push({
          taulu,
          id: r.id,
          nimi: String(r.name ?? r.title ?? ""),
          status: r.status ?? null,
          sivu,
          kuvaus: String(r.additional_info ?? md.description ?? ""),
          metadata: md,
        })
      }
      if ((data ?? []).length < 1000) break
    }
  }
  console.log(`\nSalon kaavarivejä: ${rivit.length}`)

  /* --- 2. Sivu kerran, vaikka samaan sivuun viittaisi monta riviä --- */
  const kuvaukset = new Map<string, { asiakirja: string | null; kuvaus: string | null }>()
  for (const sivu of new Set(rivit.map((r) => r.sivu))) {
    const linkit = await sivunLiitteet(sivu)
    if (!linkit) {
      kuvaukset.set(sivu, { asiakirja: null, kuvaus: null })
      continue
    }
    const asiakirja = valitseKaavanAsiakirja(linkit)
    if (!asiakirja) {
      kuvaukset.set(sivu, { asiakirja: null, kuvaus: null })
      continue
    }
    const teksti = await haeKaavaselostuksenTeksti(asiakirja)
    kuvaukset.set(sivu, { asiakirja, kuvaus: teksti ? kaavanKuvausTekstista(teksti) : null })
    await new Promise((r) => setTimeout(r, 400))
  }
  const liitteella = [...kuvaukset.values()].filter((v) => v.asiakirja).length
  const tuotti = [...kuvaukset.values()].filter((v) => v.kuvaus).length
  console.log(`Sivuja ${kuvaukset.size}, liite löytyi ${liitteella}, kuvaus saatiin ${tuotti}`)

  /* --- 3. Rivi kerrallaan --- */
  let kirjoitetaan = 0
  let ennallaan = 0

  for (const r of rivit) {
    const tulos = kuvaukset.get(r.sivu)
    const otsikko = `${r.taulu === "projects" ? "H" : "J"} ${r.id.slice(0, 8)} ${r.nimi.slice(0, 44)}`
    if (!tulos?.kuvaus) {
      ennallaan += 1
      console.log(`\n${otsikko}\n   EI LIITETTA TAI EI TEKSTIA: ${tulos?.asiakirja ?? r.sivu}`)
      continue
    }

    const uusi = yhdistaKuvaukset(r.kuvaus, tulos.kuvaus) ?? r.kuvaus
    if (uusi.length <= r.kuvaus.length) {
      ennallaan += 1
      console.log(`\n${otsikko}\n   ENNALLAAN: liitteessä ei ollut uutta (${r.kuvaus.length} merkkiä)`)
      continue
    }

    kirjoitetaan += 1
    console.log(`\n${otsikko}  [${r.status}]`)
    console.log(`   liite: ${tulos.asiakirja}`)
    console.log(`   ${r.kuvaus.length} -> ${uusi.length} merkkiä`)
    console.log(`   LISÄYS: ${uusi.slice(r.kuvaus.length).trim().slice(0, 320)}`)

    if (!apply) continue
    const md = { ...r.metadata, description: uusi }
    const paivitys: Record<string, unknown> =
      r.taulu === "projects" ? { additional_info: uusi, metadata: md } : { metadata: md }
    const { error } = await db.from(r.taulu).update(paivitys).eq("id", r.id)
    if (error) console.error(`   VIRHE: ${error.message}`)
    else console.log(`   kirjoitettu`)
  }

  console.log(`\nYhteensä: kirjoitetaan ${kirjoitetaan}, ennallaan ${ennallaan}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
