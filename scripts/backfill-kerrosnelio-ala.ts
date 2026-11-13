import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PINTA-ALA KERROSNELIOINA TAKAUTUVASTI (D-411).
 *
 * D-411 lisasi yksikot kem2 / k-m2 / kerrosneliometria poimijaan ja
 * esti nelja vaaraa kuviota. Rovaniemen rivi korjattiin heti; tama ajo
 * tekee saman muiden lahteiden jo tallennetuille riveille.
 *
 * RAJAUS: vain rivit joilla POIMITTU LUKU on kerrosneliometreissa.
 *
 * Pelkka "kuvauksessa esiintyy kem2" ei riita rajaukseksi: samassa
 * tekstissa on usein myos brm2, ja silloin poimija otti luvun
 * ANKKURISTA JOKA OLI OLEMASSA JO ENNEN D-411:ta. Ne rivit ovat eri
 * kysymys -- ne ovat jaaneet tyhjiksi muusta syysta, eika niita ole
 * luettu lapi. `--kaikki` ottaa nekin mukaan.
 *
 * Virheellisia kuvioita ei tarvitse suodattaa tassa: poimija itse
 * torjuu ne (EI_RAKENNUS), ja niille on testit.
 *
 * Aja ensin ilman --apply-lippua ja lue tuotos riveittain.
 */

const APPLY = process.argv.includes("--apply")
const KAIKKI = process.argv.includes("--kaikki")
const MERKKI = "kerrosnelio_ala_2026_11"

const KERROSNELIO = /\d[\d\s.,]*\s*(kem2|kem²|k-m2|k-m²|kerrosneliö\w*)/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractFloorAreaFromText } = await import("../lib/projects/extractFloorAreaFromText")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let yhteensa = 0

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

    const muutokset: any[] = []
    for (const r of rivit) {
      const meta = r.metadata ?? {}
      if (String(meta.floor_area ?? "").trim()) continue

      const teksti = String(meta.description ?? "")
      if (!teksti || !KERROSNELIO.test(teksti)) continue

      const ala = extractFloorAreaFromText(teksti)
      if (!ala) continue

      /* Se kohta jonka poimija OIKEASTI otti, ei ensimmainen kem2. */
      const muodot = [String(ala), String(ala).replace(/\B(?=(\d{3})+(?!\d))/g, " ")]
      let kohta = -1
      for (const muoto of muodot) { kohta = teksti.indexOf(muoto); if (kohta >= 0) break }
      const ikkuna = kohta >= 0 ? teksti.slice(Math.max(0, kohta - 72), kohta + 28) : teksti.slice(0, 100)

      /* Oliko juuri TAMAN luvun yksikko kerrosnelio? */
      const perassa = kohta >= 0 ? teksti.slice(kohta, kohta + 40) : ""
      const kerrosneliosta = /^[\d\s.,]+\s*(kem2|kem²|k-m2|k-m²|kerrosneliö\w*)/i.test(perassa)
      if (!kerrosneliosta && !KAIKKI) continue

      muutokset.push({ r, meta, ala, kerrosneliosta, ikkuna: ikkuna.replace(/\s+/g, " ") })
    }

    console.log(`\n=== ${taulu.toUpperCase()}: taytettavia ${muutokset.length} / ${rivit.length}`)
    for (const m of muutokset) {
      console.log(`\n  ${String(m.ala).padStart(7)} m²  [${String(m.meta.source_name ?? "?").slice(0, 22)}]`)
      console.log(`           ${String(m.r[nimiKentta]).slice(0, 62)}`)
      console.log(`           ...${m.ikkuna}...`)
    }

    if (APPLY) {
      for (const m of muutokset) {
        const meta = { ...m.meta, floor_area: m.ala }
        meta.takautuvat_ajot = [...new Set([...(meta.takautuvat_ajot ?? []), MERKKI])]
        const { error } = await db.from(taulu).update({ metadata: meta }).eq("id", m.r.id)
        if (error) throw error
      }
      console.log(`\n  kirjoitettu ${muutokset.length}`)
    }
    yhteensa += muutokset.length
  }

  console.log(`\n${APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS ==="}  rivejä ${yhteensa}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
