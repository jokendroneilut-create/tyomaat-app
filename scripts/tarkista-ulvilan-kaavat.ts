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
 * ULVILAN KAAVALAHTEEN KAIKKI RIVIT (D-362).
 *
 * Johannes: *"tarkista myos muut tuon lahteen hankkeet jo
 * hyvaksytyista ja jonosta"*. Listaa molemmat taulut ja kertoo kummalla
 * on ohut kuvaus ja kummalta puuttuu yhteyshenkilo, jotta korjattavat
 * nakee yhdella silmayksella.
 *
 * Ohuen raja on `kaavanLiite.ts`:n oma 300 merkkia -- EI oma luku
 * ([[same-term-two-definitions]]).
 *
 *   npx tsx scripts/tarkista-ulvilan-kaavat.ts
 */
const OHUEN_RAJA = 300

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const osuu = (r: any) => {
    const lahde = `${r.metadata?.source_name ?? ""} ${r.metadata?.source_url ?? ""} ${r.metadata?.documents_url ?? ""}`
    return /ulvila/i.test(lahde)
  }

  /*
   * KAKSI VAIHETTA, EI YKSI. Ensimmainen versio luki `additional_info`n
   * kaikilta 7 164 rivilta ja kaatui kannan aikakatkaisuun: kuvaus on
   * iso sarake eika sita tarvita kuin Ulvilan riveilta
   * ([[backfill-run-limits]]).
   */
  const kevyet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,phase,is_public,metadata,created_at")
      .range(a, a + 999)
    if (error) throw error
    kevyet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const omat = kevyet.filter(osuu)
  const { data: kuvaukset, error: kErr } = await db
    .from("projects")
    .select("id,additional_info")
    .in("id", omat.map((r) => r.id))
  if (kErr) throw kErr
  const kuvausById = new Map((kuvaukset ?? []).map((r: any) => [r.id, r.additional_info]))
  const hankkeet = omat.map((r) => ({ ...r, additional_info: kuvausById.get(r.id) ?? null }))

  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,status,municipality,metadata,created_at")
      .range(a, a + 999)
    if (error) throw error
    jono.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const nayta = (otsikko: string, rivit: any[], nimiKentta: string, kuvausKentta: (r: any) => string) => {
    console.log(`\n=== ${otsikko} (${rivit.length}) ===`)
    for (const r of rivit) {
      const kuvaus = kuvausKentta(r)
      const kontaktit = Array.isArray(r.metadata?.contact_persons) ? r.metadata.contact_persons : []
      const henkilo = kontaktit.find((c: any) => c.kind === "person")
      const merkitty = r.metadata?.kuvaus_selostuksesta ? " [korjattu]" : ""
      const lippu = kuvaus.length < OHUEN_RAJA ? "OHUT " : "     "
      console.log(`${lippu}${String(r.status ?? r.phase ?? "-").padEnd(14)} ${String(r[nimiKentta]).slice(0, 62)}${merkitty}`)
      console.log(`        kuvaus ${String(kuvaus.length).padStart(5)} | yhteyshenkilö ${henkilo ? `${henkilo.name} ${henkilo.phone ?? ""} ${henkilo.email || ""}`.trim() : "PUUTTUU"}`)
      console.log(`        ${r.id}`)
    }
  }

  const h = hankkeet
  const j = jono.filter(osuu)
  nayta("HYVÄKSYTYT (projects)", h, "name", (r) => String(r.additional_info ?? r.metadata?.description ?? ""))
  nayta("JONOSSA (potential_projects)", j, "title", (r) => String(r.metadata?.description ?? ""))

  const ohuet = [
    ...h.filter((r) => String(r.additional_info ?? r.metadata?.description ?? "").length < OHUEN_RAJA),
    ...j.filter((r) => String(r.metadata?.description ?? "").length < OHUEN_RAJA),
  ]
  const ilmanHenkiloa = [...h, ...j].filter(
    (r) => !(Array.isArray(r.metadata?.contact_persons) ? r.metadata.contact_persons : []).some((c: any) => c.kind === "person")
  )
  console.log(`\n=== YHTEENVETO ===`)
  console.log(`Ulvilan rivejä yhteensä ${h.length + j.length} (hyväksytyt ${h.length}, jonossa ${j.length})`)
  console.log(`  kuvaus alle ${OHUEN_RAJA} merkkiä: ${ohuet.length}`)
  console.log(`  ilman nimettyä yhteyshenkilöä: ${ilmanHenkiloa.length}`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
