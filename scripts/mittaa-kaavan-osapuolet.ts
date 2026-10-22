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
 * MITA NYKYINEN SAANTO LOYTAA KAAVAKUVAUKSISTA, JA MITA SE JATTAA?
 *
 * Johannes 23.10.2026: Samppalinnan koulutontilta puuttui TKU-Rakennus Oy,
 * joka on kuvauksessa. Syy ei ole puuttuva mekanismi vaan puuttuva
 * ANKKURI: `kaavanRakennuttaja` (D-195) ajetaan kaikille kaavalahteille,
 * mutta `extractYvaDeveloper`in kolme kuviota ovat "hankkeesta vastaa",
 * "hankevastaava" ja "X suunnittelee/selvittaa/hakee/toteuttaa".
 * Samppalinnan teksti sanoo *"Turun kaupungin ja TKU-Rakennus Oy:n
 * valinen ... innovaatiokumppanuus"* -- ei yhtaan niista.
 *
 * Lisaksi `yvaYritykset` (D-192, liittyvat yritykset) ajetaan VAIN
 * YVA-lahteelle, ei kaavoille.
 *
 * Tama mittaa kolme lukua: montako kaavariviä on ilman rakennuttajaa,
 * monelta nykyinen saanto loytaa sen, ja monelta kuvauksessa on
 * yritysnimi jota mikaan kentta ei kanna.
 *
 *   npx tsx scripts/mittaa-kaavan-osapuolet.ts
 *   npx tsx scripts/mittaa-kaavan-osapuolet.ts --puuttuvat
 */

import { extractYvaDeveloper, extractYvaCompanies } from "../lib/agent/fetchYvaSource"
import { onKaavalahde } from "../lib/projects/kaavanRakennuttaja"

const COMPANY_NAME =
  /\b([A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*(?:\s+[A-ZÅÄÖ][\wåäöÅÄÖ&.\-]*)*\s+(?:Oy|Oyj|Ab|Ky|Ltd))\b/g

function onYritysnimi(teksti: string): boolean {
  COMPANY_NAME.lastIndex = 0
  return COMPANY_NAME.test(teksti)
}

async function main() {
  const naytaPuuttuvat = process.argv.includes("--puuttuvat")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const luvut = {
    rivit: 0,
    devPuuttuu: 0,
    yritysKuvauksessa: 0,
    saantoLoytaa: 0,
    liittyviaOlisi: 0,
    liittyviaOnJo: 0,
  }
  const puuttuvat: { id: string; taulu: string; nimi: string; kuvaus: string; liittyvat: string[] }[] = []

  for (const taulu of ["potential_projects", "projects"] as const) {
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, developer, additional_info, metadata"
            : "id, title, status, metadata"
        )
        .like("metadata->>resolver", "%KaavaResolver")
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      for (const p of (data ?? []) as any[]) {
        if (taulu === "potential_projects" && p.status === "ignored") continue
        luvut.rivit += 1

        const lahde = String(p.metadata?.source_name ?? "")
        if (!onKaavalahde(lahde)) continue

        const kuvaus =
          taulu === "projects"
            ? String(p.additional_info ?? p.metadata?.description ?? "")
            : String(p.metadata?.description ?? "")
        const dev = String(
          (taulu === "projects" ? p.developer : null) ?? p.metadata?.developer ?? ""
        ).trim()
        const liittyvatNyt: string[] = Array.isArray(p.metadata?.related_companies)
          ? p.metadata.related_companies
          : []
        if (liittyvatNyt.length) luvut.liittyviaOnJo += 1

        if (!dev) luvut.devPuuttuu += 1
        if (!kuvaus || !onYritysnimi(kuvaus)) continue
        luvut.yritysKuvauksessa += 1

        const loytyy = extractYvaDeveloper(kuvaus)
        if (loytyy) luvut.saantoLoytaa += 1

        const liittyvat = extractYvaCompanies(kuvaus, loytyy ?? dev ?? null)
        if (liittyvat.length) luvut.liittyviaOlisi += 1

        if (!dev && !loytyy) {
          puuttuvat.push({
            id: p.id,
            taulu,
            nimi: String(p.name ?? p.title ?? ""),
            kuvaus,
            liittyvat,
          })
        }
      }
      if ((data ?? []).length < 500) break
    }
  }

  console.log("=== KAAVARIVIT ===")
  console.log(`Rivejä ${luvut.rivit}`)
  console.log(`Rakennuttaja puuttuu: ${luvut.devPuuttuu}`)
  console.log(`Yritysnimi kuvauksessa: ${luvut.yritysKuvauksessa}`)
  console.log(`Niistä nykyinen sääntö löytää rakennuttajan: ${luvut.saantoLoytaa}`)
  console.log(`Ilman rakennuttajaa JA sääntö ei löydä: ${puuttuvat.length}`)
  console.log(`Liittyviä yrityksiä olisi poimittavissa: ${luvut.liittyviaOlisi} (nyt kentässä: ${luvut.liittyviaOnJo})`)

  if (naytaPuuttuvat) {
    console.log(`\n=== PUUTTUVAT (${puuttuvat.length}) ===`)
    for (const p of puuttuvat) {
      console.log(`\n${p.taulu === "projects" ? "HANKE" : "JONO "} ${p.id}  ${p.nimi.slice(0, 55)}`)
      console.log(`   liittyvät olisi: ${p.liittyvat.join(" | ") || "-"}`)
      console.log(`   ${p.kuvaus.replace(/\s+/g, " ").slice(0, 280)}`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
