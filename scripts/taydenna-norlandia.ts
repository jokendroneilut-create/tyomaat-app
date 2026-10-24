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
 * NORLANDIA LIITTYVAKSI YRITYKSEKSI SIELLA MISSA SE MAINITAAN (D-343).
 *
 * Johannes 24.10.2026: *"tasta hankkeesta ei ole poimittu tilaajaa:
 * Norlandia Health & Care ... katso onko se muissa hyvaksytyissa
 * hankkeissa mukana ja jos on niin lisaa se myos vahintaan liittyvana
 * yrityksena."*
 *
 * KOLME ERI YHTIOTA SAMASSA KONSERNISSA. Teksteissa esiintyy
 * "Norlandia Hoiva", "Norlandian", "Norlandia Health & Care" ja
 * "Norlandia Paivakodit Oy". Paivakodit on ERI yhtio kuin hoiva, joten
 * sita ei saa korvata konsernin nimella -- vaarin yhdistetty nimi on
 * pahempi kuin kaksi rivia ([[title-precedence]]).
 *
 * Rooli: KAYTTAJA tai vuokralainen, ei tilaaja eika rakentaja. Siksi
 * liittyva yritys, joka ei vaita roolia.
 *
 *   npx tsx scripts/taydenna-norlandia.ts
 *   npx tsx scripts/taydenna-norlandia.ts --apply
 */

import { mergeCompanyNames } from "../lib/projects/projectCompanies"

const KONSERNI = "Norlandia Health & Care"
const PAIVAKODIT = "Norlandia Päiväkodit Oy"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  let muutettu = 0

  for (const taulu of ["projects", "potential_projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id,name,status,developer,builder,additional_info,metadata"
            : "id,title,status,metadata"
        )
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 500) break
    }

    for (const p of rivit) {
      if (taulu === "potential_projects" && p.status === "ignored") continue

      const teksti = `${p.name ?? p.title ?? ""} ${p.additional_info ?? ""} ${p.metadata?.description ?? ""}`.replace(
        /\s+/g,
        " "
      )
      if (!/norlandia/i.test(teksti)) continue

      const liittyvat: string[] = Array.isArray(p.metadata?.related_companies)
        ? p.metadata.related_companies
        : []
      const kentissa = [
        p.developer,
        p.builder,
        p.metadata?.developer,
        p.metadata?.builder,
        ...liittyvat,
      ]
        .filter(Boolean)
        .join(" | ")
      if (/norlandia/i.test(kentissa)) continue

      /* Paivakodit on eri yhtio kuin hoiva: kaytetaan sita mika tekstissa lukee. */
      const nimi = /norlandia\s+päiväkodit/i.test(teksti) ? PAIVAKODIT : KONSERNI

      const i = teksti.search(/norlandia/i)
      console.log(`\n${taulu === "projects" ? "HANKE" : "JONO "} ${String(p.name ?? p.title).slice(0, 52)}`)
      console.log(`   kentissä: ${kentissa || "-"}`)
      console.log(`   lisätään: ${nimi}`)
      console.log(`   ...${teksti.slice(Math.max(0, i - 110), i + 110)}...`)
      muutettu += 1

      if (!apply) continue

      const md: Record<string, any> = { ...(p.metadata ?? {}) }
      md.related_companies = mergeCompanyNames(liittyvat, [nimi])
      const { error } = await db.from(taulu).update({ metadata: md }).eq("id", p.id)
      if (error) console.error(`      VIRHE: ${error.message}`)
    }
  }

  console.log(`\nRivejä ${muutettu}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
