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
 * HYVAKSYTTY JONORIVI EI ENAA TAVOITA ASIAKASTA (D-334).
 *
 * `taydenna-kokemaen-kaavakuvaukset.ts` korjasi neljan jonorivin
 * kuvauksen, mutta kolme niista on tilassa `approved`: niista on jo
 * hanke `projects`-taulussa, ja asiakas lukee sen
 * `additional_info`-saraketta ([[measure-the-field-the-user-reads]]).
 * Jonorivin metadata ei siirry hyvaksynnan JALKEEN mihinkaan.
 *
 * Tama ajo siirtaa korjatun kuvauksen hankeriville. Taysmays tehdaan
 * jonorivin `matched_existing_project_id`-kentalla jos se on, muuten
 * otsikolla ja kunnalla -- ja jos osumaa ei ole yksi, rivi jatetaan
 * raportoiduksi eika arvata ([[matched-overwrites-fields]]).
 *
 * VAIN PIDEMPI KORVAA. Jos hankkeella on jo pidempi kuvaus, sita ei
 * ylikirjoiteta: se voi olla toisesta lahteesta tai kasin kirjoitettu.
 *
 *   npx tsx scripts/taydenna-kokemaen-hankekuvaukset.ts
 *   npx tsx scripts/taydenna-kokemaen-hankekuvaukset.ts --apply
 */

const LAHDE = "Kokemäen vireillä olevat asemakaavat"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const { data: jono, error } = await db
    .from("potential_projects")
    .select("id, title, status, municipality, metadata")
    .eq("metadata->>source_name", LAHDE)
  if (error) {
    console.error(`VIRHE: ${error.message}`)
    process.exit(1)
  }

  const hyvaksytyt = (jono ?? []).filter((p: any) => p.status === "approved")
  console.log(`\nHyvaksyttyja jonorivejä ${hyvaksytyt.length} / ${(jono ?? []).length}\n`)

  let muutettu = 0
  for (const p of hyvaksytyt as any[]) {
    const uusi = String(p.metadata?.description ?? "")
    const nimi = String(p.title)
    const matched = p.metadata?.matched_existing_project_id ?? null

    /* Hankerivi: tunnisteella jos on, muuten nimella ja kunnalla. */
    let hanke: any = null
    if (matched) {
      const { data } = await db.from("projects").select("id, name, additional_info, metadata").eq("id", matched).maybeSingle()
      hanke = data ?? null
    }
    if (!hanke) {
      const { data } = await db
        .from("projects")
        .select("id, name, additional_info, metadata")
        .eq("name", nimi)
        .eq("city", p.municipality)
      if ((data ?? []).length === 1) hanke = (data ?? [])[0]
      else {
        console.log(`   EI YKSI OSUMA  ${nimi.slice(0, 46).padEnd(48)} osumia ${(data ?? []).length} -- jatetaan`)
        continue
      }
    }

    const vanha = String(hanke.additional_info ?? "")
    if (uusi.length <= vanha.length) {
      console.log(`   EI PAREMPI     ${nimi.slice(0, 46).padEnd(48)} ${vanha.length} -> ${uusi.length}`)
      continue
    }

    console.log(`\n   ${nimi.slice(0, 52)}   (${hanke.id.slice(0, 8)})`)
    console.log(`      additional_info ${vanha.length} -> ${uusi.length} merkkia`)
    console.log(`      "${uusi.slice(0, 200)}…"`)
    muutettu += 1

    if (!apply) continue

    const md: Record<string, any> = { ...(hanke.metadata ?? {}) }
    md.description = uusi
    if (p.metadata?.maanomistus_selostuksesta) md.maanomistus_selostuksesta = p.metadata.maanomistus_selostuksesta
    md.kuvaus_liitteesta = {
      jonorivi: p.id,
      edellinen_pituus: vanha.length,
      edellinen: vanha,
      milloin: new Date().toISOString().slice(0, 10),
    }
    const { error: kirjoitus } = await db
      .from("projects")
      .update({ additional_info: uusi, metadata: md })
      .eq("id", hanke.id)
    if (kirjoitus) console.error(`      VIRHE: ${kirjoitus.message}`)
  }

  console.log(`\nHankerivejä taydennetaan ${muutettu}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
