import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * EHDOKKAAN KUVAUS RIKASTUI HYVAKSYNNAN JALKEEN (D-208).
 *
 * Takautuvat ajot korjaavat `potential_projects`-taulua, koska ehdokas
 * on se joka on rikki. Jo HYVAKSYTTY ehdokas on kuitenkin kopioitu
 * `projects`-tauluun, eika kopio paivity - joten asiakas nakee yha sen
 * tekstin joka oli olemassa hyvaksyntahetkella.
 *
 * Mitattu 21.9.2026: 5 698 hyvaksytysta hankkeesta **80:lla ehdokkaan
 * kuvaus on pidempi JA sisaltaa hankkeen kuvauksen kokonaan** - yhteensa
 * noin 273 000 merkkia tekstia joka on kannassa muttei asiakkaalla.
 * 29:lla niista hanke saisi myos yhteyshenkilon.
 *
 * Suurin yksittainen syy on `scripts/backfill-yva-details.ts` (ajettu
 * 8.8.2026): se taydensi YVA-ehdokkaiden 78 merkin tiivistelmat koko
 * hankekuvauksiksi, mutta kirjoitti vain `potential_projects`-tauluun.
 * Edellisina paivina hyvaksytyt 28 hanketta jaivat tiivistelman varaan.
 *
 * TURVARAJA: kuvaus korvataan VAIN jos vanha sisaltyy uuteen kokonaan
 * (sama saanto kuin `fix-sivun-kuvaus-alusta.ts`:ssa). Uusi on siis aina
 * vanha + lisaa, eika mitaan voi kadota.
 *
 * `additional_info` korvataan vain jos se on tyhja tai sama kuin vanha
 * kuvaus. Muuten se on kasin muokattu teksti (D-101), johon ei kosketa.
 *
 * Yhteyshenkilot: `mergeTekstipoiminta` + roolimerkinta (D-207), ja vain
 * kun poiminta lisaa jonkun.
 *
 *   npx tsx scripts/backfill-hyvaksytyn-kuvaus-ehdokkaalta.ts            # kuivaharjoitus
 *   npx tsx scripts/backfill-hyvaksytyn-kuvaus-ehdokkaalta.ts --apply
 *
 * Sahkopostit peitetaan tulosteessa: repo on julkinen.
 */

const APPLY = process.argv.includes("--apply")
const tiivis = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim()

function peita(email: string | null | undefined): string {
  const s = String(email ?? "")
  if (!s.includes("@")) return ""
  const [local, domain] = s.split("@")
  return `${local.slice(0, 2)}***@${domain}`
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractContacts, mergeTekstipoiminta } = await import("../lib/projects/contacts")
  const { merkitseRoolit } = await import("../lib/projects/contactRole")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const ehdokkaat: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, metadata")
      .eq("status", "approved")
      .range(from, from + 999)
    if (error) throw error
    ehdokkaat.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const idt = ehdokkaat.map((r) => r.metadata?.approved_project_id).filter(Boolean)
  const hankkeet = new Map<string, any>()
  for (let i = 0; i < idt.length; i += 80) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, additional_info, metadata")
      .in("id", idt.slice(i, i + 80))
    if (error) throw error
    for (const p of data ?? []) hankkeet.set(p.id, p)
  }

  console.log(`${APPLY ? "KIRJOITUS" : "KUIVAHARJOITUS"} - ${hankkeet.size} hyvaksyttya hanketta\n`)

  let muuttuu = 0, lisatietoOhitettu = 0, kontakteja = 0, merkkeja = 0

  for (const e of ehdokkaat) {
    const p = hankkeet.get(e.metadata?.approved_project_id)
    if (!p) continue

    const uusi = String(e.metadata?.description ?? "")
    const vanha = String(p.metadata?.description ?? "")
    if (tiivis(uusi).length <= tiivis(vanha).length) continue

    /* TURVARAJA: vanha on sisallyttava uuteen kokonaan. */
    if (!tiivis(uusi).includes(tiivis(vanha))) continue

    const meta: any = { ...(p.metadata ?? {}), description: uusi }
    const paivitys: any = { metadata: meta }

    /* Kasin muokattuun lisatietokenttaan ei kosketa. */
    const ai = tiivis(p.additional_info)
    if (!ai || ai === tiivis(vanha)) paivitys.additional_info = uusi
    else lisatietoOhitettu++

    const nykyiset = Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []
    const poimitut = merkitseRoolit(extractContacts(uusi), uusi)
    const yhdistetty = mergeTekstipoiminta(nykyiset, poimitut)
    const saaKontaktin = yhdistetty.length > nykyiset.length
    if (saaKontaktin) {
      meta.contact_persons = yhdistetty
      kontakteja++
    }

    muuttuu++
    merkkeja += tiivis(uusi).length - tiivis(vanha).length

    console.log(`--- ${p.id}  ${String(p.name ?? "").slice(0, 62)}`)
    console.log(
      `    lahde=${e.metadata?.source_name ?? "-"}  kuvaus ${tiivis(vanha).length} -> ${tiivis(uusi).length} merkkia` +
        `  lisatieto=${paivitys.additional_info ? "paivitetaan" : "KASIN MUOKATTU, ei kosketa"}`
    )
    if (saaKontaktin) {
      for (const c of yhdistetty.slice(nykyiset.length)) {
        console.log(`    + [${c.kind}${c.role ? `/${c.role}` : ""}] ${c.name ?? "-"} | ${c.title ?? "-"} | ${c.phone ?? "-"} | ${peita(c.email) || "-"}`)
      }
    }

    if (APPLY) {
      const { error } = await db.from("projects").update(paivitys).eq("id", p.id)
      if (error) throw error
      console.log("    kirjoitettu")
    }
  }

  console.log(`\nmuuttuu: ${muuttuu}   yhteyshenkilon saa: ${kontakteja}   lisatieto sailytetaan kasin muokattuna: ${lisatietoOhitettu}`)
  console.log(`asiakkaalle palautuva teksti: ${merkkeja.toLocaleString("fi-FI")} merkkia`)

  /*
   * TOINEN VAIHE: YHTEYSHENKILO ILMAN KUVAUKSEN KORVAAMISTA.
   *
   * Osalla hankkeista kuvaus EI ole ehdokkaan kuvauksen osajoukko - se
   * on kasin kirjoitettu tai peraisin toisesta lahteesta - joten
   * turvaraja yllä estaa korvaamisen perustellusti. Yhteyshenkilo on
   * silti sama hanke ja sama ehdokas, joten se voidaan poimia vaikka
   * teksti jaa ennalleen. Juuri nain hyvaksyntareitti tekee.
   *
   * Koskee vain hankkeita joilla EI ole yhtaan yhteyshenkiloa: olemassa
   * olevaan listaan ei kosketa.
   */
  console.log("\n=== VAIHE 2: yhteyshenkilo ilman kuvauksen korvaamista ===")
  let vaihe2 = 0
  for (const e of ehdokkaat) {
    const p = hankkeet.get(e.metadata?.approved_project_id)
    if (!p) continue

    const nykyiset = Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []
    if (nykyiset.filter((x: any) => x && (x.email || x.phone || x.name)).length) continue

    const teksti = [e.metadata?.description, e.metadata?.operation].filter(Boolean).join("\n")
    if (!teksti) continue

    const poimitut = merkitseRoolit(extractContacts(teksti), teksti)
    if (!poimitut.some((c) => c.kind === "person")) continue

    const yhdistetty = mergeTekstipoiminta(nykyiset, poimitut)
    if (yhdistetty.length <= nykyiset.length) continue

    vaihe2++
    console.log(`--- ${p.id}  ${String(p.name ?? "").slice(0, 62)}`)
    console.log(`    lahde=${e.metadata?.source_name ?? "-"}  kuvausta ei korvata`)
    for (const c of yhdistetty) {
      console.log(`    + [${c.kind}${c.role ? `/${c.role}` : ""}] ${c.name ?? "-"} | ${c.title ?? "-"} | ${c.phone ?? "-"} | ${peita(c.email) || "-"}`)
    }

    if (APPLY) {
      const { error } = await db
        .from("projects")
        .update({ metadata: { ...(p.metadata ?? {}), contact_persons: yhdistetty } })
        .eq("id", p.id)
      if (error) throw error
      console.log("    kirjoitettu")
    }
  }
  console.log(`\nvaihe 2 muuttuu: ${vaihe2}`)

  if (!APPLY && (muuttuu || vaihe2)) console.log("\nAja --apply kun rivit on luettu.")
}
main().catch((e) => { console.error(e); process.exit(1) })
