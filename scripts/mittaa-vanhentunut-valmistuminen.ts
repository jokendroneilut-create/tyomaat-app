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
 * MITTAUS ENNEN SAANNON MUUTTAMISTA (D-359).
 *
 * `resolvePotentialProject` ohittaa ehdokkaan kun kuvaustekstista
 * poimittu valmistumispaiva on mennyt (`valmistunut_menneisyydessa`).
 * Saanto lukee VAIN tekstia, eika katso lahteen omaa rakenteista
 * valmistumispaivaa -- joten rivi voi olla yhta aikaa "valmistunut
 * 2022" ja "valmistuu 20.12.2028".
 *
 * Tama laskee, montako jonorivia on juuri siina ristiriidassa: ohitettu
 * menneen tekstipaivan takia, vaikka rakenteinen paiva on tulevaisuudessa.
 * Ajetaan ennen muutosta ja sen jalkeen ([[test-filter-against-approved]]).
 *
 *   npx tsx scripts/mittaa-vanhentunut-valmistuminen.ts
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,status,created_at,metadata")
      .range(a, a + 999)
    if (error) throw error
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const tanaan = new Date().toISOString().slice(0, 10)
  console.log(`Jonorivejä yhteensä ${rivit.length}\n`)

  const menneisyys = rivit.filter((r) =>
    String(r.metadata?.auto_ignored_reason ?? "").startsWith("valmistunut_menneisyydessa")
  )
  console.log(`Ohitettu syylla "valmistunut_menneisyydessa": ${menneisyys.length}`)

  const ristiriita = menneisyys.filter((r) => {
    const oma = String(r.metadata?.estimated_completion ?? "").trim()
    return oma && oma > tanaan
  })
  console.log(`  ...joista rakenteinen valmistumispaiva on TULEVAISUUDESSA: ${ristiriita.length}\n`)

  for (const r of ristiriita) {
    const syy = String(r.metadata?.auto_ignored_reason ?? "")
    console.log(`${String(r.status).padEnd(9)} ${String(r.created_at).slice(0, 10)}  ${String(r.title).slice(0, 58)}`)
    console.log(`   lahde ${r.metadata?.source_name ?? "-"} | ${syy} | oma paiva ${r.metadata?.estimated_completion}`)
    const kuvaus = String(r.metadata?.description ?? "").replace(/\s+/g, " ")
    const vuosi = syy.split(":")[1]?.slice(0, 4)
    const kohta = vuosi ? kuvaus.search(new RegExp(`[^.]{0,90}${vuosi}`)) : -1
    if (kohta >= 0) console.log(`   teksti: …${kuvaus.slice(kohta, kohta + 150)}…`)
    console.log()
  }
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
