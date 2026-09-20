import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YHTEYSHENKILOT KUVAUKSESTA JONOSSA OLEVIIN EHDOKKAISIIN (D-207).
 *
 * `resolvePotentialProject` poimii ne nyt kaikille UUSILLE ehdokkaille,
 * mutta jo jonossa olevat on kirjoitettu ennen muutosta. Niita ei ole
 * monta - jono purkautuu nopeasti - mutta juuri ne ovat niita joita
 * katselmoidaan seuraavaksi.
 *
 * EI YLIKIRJOITA (D-101): `mergeContacts` on vain-lisaava, eika
 * ehdokasta kosketa jos tulos on sama kuin nykyinen.
 *
 * ROOLIT MERKITAAN, EI PUDOTETA (ks. `lib/projects/contactRole.ts`).
 *
 *   npx tsx scripts/backfill-ehdokkaiden-yhteyshenkilot.ts            # kuivaharjoitus
 *   npx tsx scripts/backfill-ehdokkaiden-yhteyshenkilot.ts --apply    # kirjoittaa
 *
 * Sahkopostit peitetaan tulosteessa: repo on julkinen.
 */

function peita(email: string | null | undefined): string {
  const s = String(email ?? "")
  if (!s.includes("@")) return ""
  const [local, domain] = s.split("@")
  return `${local.slice(0, 2)}***@${domain}`
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { extractContacts, mergeTekstipoiminta } = await import("../lib/projects/contacts")
  const { merkitseRoolit } = await import("../lib/projects/contactRole")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, metadata")
      .eq("status", "new")
      .range(from, from + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  console.log(`${apply ? "KIRJOITUS" : "KUIVAHARJOITUS"} - jonossa ${rivit.length} ehdokasta\n`)

  let muuttuu = 0
  let ennallaan = 0

  for (const r of rivit) {
    const meta = (r.metadata ?? {}) as Record<string, any>
    const teksti = [meta.description, meta.operation].filter(Boolean).join("\n")
    if (!teksti) { ennallaan++; continue }

    const nykyiset = Array.isArray(meta.contact_persons) ? meta.contact_persons : []
    const poimitut = merkitseRoolit(extractContacts(teksti), teksti)
    if (!poimitut.length) { ennallaan++; continue }

    const yhdistetty = mergeTekstipoiminta(nykyiset as any, poimitut)

    /*
     * VAIN KUN POIMINTA LISAA JONKUN - sama vartija kuin
     * `resolvePotentialProject`issa. `mergeContacts` yhdistaa myos
     * listassa jo olevat kaksoisrivit, jolloin suora numero voi vaihtua
     * vaihteeseen. Vanhojen kaksoisrivien siivous on eri tehtava.
     */
    if (yhdistetty.length <= nykyiset.length) { ennallaan++; continue }

    muuttuu++
    console.log(`--- ${r.id}  ${String(r.title ?? "").slice(0, 70)}`)
    console.log(`    lahde: ${meta.source_name ?? "-"}   ${nykyiset.length} -> ${yhdistetty.length} yhteyshenkiloa`)
    for (const c of yhdistetty) {
      const uusi = !nykyiset.some((v: any) => v?.email && c.email && String(v.email).toLowerCase() === c.email.toLowerCase())
      console.log(
        `    ${uusi ? "+" : " "} [${c.kind}${c.role ? `/${c.role}` : ""}] ${c.name ?? "-"} | ${c.title ?? "-"} | ${c.phone ?? "-"} | ${peita(c.email) || "-"}`
      )
    }

    if (apply) {
      const { error } = await db
        .from("potential_projects")
        .update({ metadata: { ...meta, contact_persons: yhdistetty } })
        .eq("id", r.id)
      if (error) throw error
      console.log("    kirjoitettu")
    }
  }

  console.log(`\nmuuttuu: ${muuttuu}   ennallaan: ${ennallaan}`)
  if (!apply && muuttuu) console.log("Aja --apply kun rivit on luettu.")
}
main().catch((e) => { console.error(e); process.exit(1) })
