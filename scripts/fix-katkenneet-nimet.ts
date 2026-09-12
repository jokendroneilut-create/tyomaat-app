import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KATKENNEET RAKENNUTTAJANIMET (D-188).
 *
 * Allatiivin perusmuoto pääteltiin päätteestä, ja päättely meni väärin kun
 * vartalo poikkeaa nominatiivista: "Tullille" -> "Tull",
 * "Kattokeskukselle" -> "Kattokeskukse". Mitattu 12.9.2026: 18 riviä.
 *
 * TUNNISTUS ON KOKO AINEISTON TASOLLA, EI RIVIKOHTAINEN. Aito katkennut
 * nimi ei esiinny omana sanana YHDESSÄKÄÄN kuvauksessa; oikea nimi
 * esiintyy monessa. Rivikohtainen sääntö leimasi oikeat nimet
 * ("Väylävirasto" esiintyy tekstissä muodossa "Väyläviraston").
 *
 * Nimi lasketaan uudelleen samasta tekstistä korjatulla poiminnalla. Jos
 * sitä ei saada yksikäsitteisesti, kenttä TYHJENNETÄÄN: väärä nimi on
 * huonompi kuin tyhjä, ja se näkyy asiakkaalle sellaisenaan.
 *
 * EI UUTTA VERKKOHAKUA - teksti on tallessa.
 *
 *   npx tsx scripts/fix-katkenneet-nimet.ts
 *   npx tsx scripts/fix-katkenneet-nimet.ts --apply
 */

const APPLY = process.argv.includes("--apply")

function omanaSanana(sana: string, teksti: string): boolean {
  const turva = sana.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(^|[^\\wÄÖÅäöå])${turva}([^\\wÄÖÅäöå]|$)`, "i").test(teksti)
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractClientFromText } = await import("../lib/agent/fetchSttHakuSource")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (const table of ["potential_projects", "projects"] as const) {
    const columns =
      table === "potential_projects"
        ? "id, title, metadata"
        : "id, name, developer, additional_info, metadata"
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
      if (error) throw error
      rivit.push(...(data ?? []).map((r: any) => ({ ...r, _taulu: table })))
      if (!data || data.length < 1000) break
    }
  }

  /* Koko aineiston sanasto: esiintyykö arvo jossain omana sananaan. */
  const sanasto = new Set<string>()
  for (const r of rivit) {
    const teksti = String(r.additional_info ?? r.metadata?.description ?? "")
    for (const sana of teksti.match(/[A-Za-zÄÖÅäöå][\wÄÖÅäöå&-]*/g) ?? []) {
      sanasto.add(sana.toLowerCase())
    }
  }

  let korjattu = 0
  let tyhjennetty = 0

  for (const r of rivit) {
    const nyky = String(r.developer ?? r.metadata?.developer ?? "").trim()
    if (!nyky || nyky.includes(" ") || nyky.length < 3) continue

    /*
     * VAIN KIRJAIMISTA KOOSTUVAT NIMET. Sanasto pilkkoo tekstin
     * kirjainjonoihin, joten "re:mount" ei löydy siitä koskaan omana
     * sananaan - ja kuivaharjoitus olisi tyhjentänyt sen, vaikka se on
     * aito nimi. Sama koskee pisteellisiä ja numerollisia muotoja.
     */
    if (!/^[A-Za-zÄÖÅäöå][\wÄÖÅäöå-]*$/.test(nyky)) continue

    const teksti = String(r.additional_info ?? r.metadata?.description ?? "")
    if (teksti.length < 60) continue

    /* Oikea nimi esiintyy jossain omana sananaan; katkennut ei missään. */
    if (sanasto.has(nyky.toLowerCase())) continue

    /* Varmistus: katkennut nimi on jonkin tämän tekstin sanan alku. */
    if (!new RegExp(`${nyky.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\wÄÖÅäöå]`, "i").test(teksti)) {
      continue
    }

    const uusi = extractClientFromText(String(r.title ?? r.name ?? ""), teksti)

    if (uusi && uusi === nyky) continue

    if (uusi) korjattu++
    else tyhjennetty++

    console.log(
      `${r._taulu} ${String(r.title ?? r.name).slice(0, 46)}\n` +
        `    rakennuttaja "${nyky}" -> ${uusi ? `"${uusi}"` : "(tyhjennetään)"}`
    )

    if (!APPLY) continue

    const metadata = { ...(r.metadata ?? {}) }
    if (uusi) metadata.developer = uusi
    else delete metadata.developer

    await supabase
      .from(r._taulu)
      .update(
        r._taulu === "projects" ? { metadata, developer: uusi ?? null } : { metadata }
      )
      .eq("id", r.id)
  }

  console.log(APPLY ? "\n=== AJETTU ===" : "\n=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`nimi korjattu:  ${korjattu}`)
  console.log(`kentta tyhjennetty: ${tyhjennetty}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
