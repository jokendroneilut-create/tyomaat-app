import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LUPATUNNUS PUHELINNUMERONA — SIIVOUS (D-249).
 *
 * `isPhone` paastaa lapi 10-numeroisen lupatunnuksen `049-2026-725`,
 * joten 22 hankkeella on puhelinnumerona tunnus jota ei voi soittaa.
 * Hahmo on nyt korjattu, mutta vanhat rivit eivat korjaannu itsestaan.
 *
 * POISTETAAN VAIN NUMERO, EI KONTAKTIA. Nimi ja titteli ovat oikeita
 * (Espoon rakennustarkastajia), ja ne ovat edelleen arvokkaita. Tyhja
 * puhelinkentta on parempi kuin vaara numero — tama on se poikkeus
 * saantoon "yhteystiedoista ei poisteta mitaan".
 *
 *   npx tsx scripts/korjaa-lupatunnus-puhelimina.ts          (kuivaharjoitus)
 *   npx tsx scripts/korjaa-lupatunnus-puhelimina.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const TUNNUKSEN_HAHMO = /-\d{4}-/

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const korjattavat: { id: string; name: string; contacts: any[]; ennen: string[] }[] = []

  for (let f = 0; f < 20000; f += 1000) {
    const { data, error } = await db.from("projects").select("id,name,metadata").range(f, f + 999)
    if (error) throw error
    if (!data?.length) break

    for (const p of data as any[]) {
      const cs = p.metadata?.contact_persons
      if (!Array.isArray(cs)) continue
      const ennen: string[] = []
      const jalkeen = cs.map((c: any) => {
        if (c?.phone && TUNNUKSEN_HAHMO.test(String(c.phone))) {
          ennen.push(`${c.name ?? "(nimeton)"} -> ${c.phone}`)
          return { ...c, phone: null }
        }
        return c
      })
      if (ennen.length) korjattavat.push({ id: p.id, name: p.name, contacts: jalkeen, ennen })
    }
    if (data.length < 1000) break
  }

  console.log(`korjattavia hankkeita: ${korjattavat.length}`)
  for (const k of korjattavat) {
    console.log(`  ${String(k.name).slice(0, 60)}`)
    for (const e of k.ennen) console.log(`      poistetaan puhelin: ${e}`)
  }

  /* Jaako kontakti tyhjaksi? Nimi sailyy, joten ei pitaisi. */
  const tyhjiksi = korjattavat.filter((k) => k.contacts.every((c: any) => !c.name && !c.email && !c.phone))
  console.log(`\nkontakteja jotka jaisivat taysin tyhjiksi: ${tyhjiksi.length}`)

  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  let n = 0
  for (const k of korjattavat) {
    const { data: tuore } = await db.from("projects").select("metadata").eq("id", k.id).maybeSingle()
    const { error } = await db
      .from("projects")
      .update({ metadata: { ...((tuore as any)?.metadata ?? {}), contact_persons: k.contacts } })
      .eq("id", k.id)
    if (error) throw error
    n++
  }
  console.log(`\n=== KORJATTU ${n} hanketta ===`)
}
main().catch(e => { console.error(e); process.exit(1) })
