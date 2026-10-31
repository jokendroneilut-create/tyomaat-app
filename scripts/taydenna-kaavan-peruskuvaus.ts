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
 * KAAVAN PERUSKUVAUS TAKAUTUVASTI.
 *
 * Kirjoittaa kuvauksen niille kaavariveille joilta se puuttuu, koska
 * lahteella ei ole kaavan omaa sivua. Kentat luetaan tallennetusta
 * `raw_text`ista, eli yhtaan verkkohakua ei tehda ([[own-data-unread]]).
 *
 * Kuvaus rakennetaan SAMALLA funktiolla kuin resolverissa
 * ([[same-term-two-definitions]]).
 *
 *   npx tsx scripts/taydenna-kaavan-peruskuvaus.ts
 *   npx tsx scripts/taydenna-kaavan-peruskuvaus.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const LAHDE_ID = "vantaa-kaavat-vireilla"
const KUNTA = "Vantaa"

function isoPaiva(arvo: unknown): string | null {
  const s = String(arvo ?? "").trim()
  const m = s.match(/^(\d{4})(\d{2})(\d{2})$/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { kaavanPeruskuvaus } = await import("../lib/agent/kaavanPeruskuvaus")

  /* Lahdedokumentit: niista saa kaavan kentat ilman verkkohakua. */
  const dokumentit: any[] = []
  for (let a = 0; ; a += 500) {
    const { data, error } = await db
      .from("source_documents")
      .select("id,title,raw_text")
      .eq("source_id", LAHDE_ID)
      .range(a, a + 499)
    if (error) throw error
    dokumentit.push(...(data ?? []))
    if ((data ?? []).length < 500) break
  }

  const kentat = new Map<string, any>()
  for (const d of dokumentit) {
    try {
      kentat.set(d.id, JSON.parse(d.raw_text)?.properties ?? {})
    } catch {
      /* Rikkinainen tietue ohitetaan; se ei ole taman ajon asia. */
    }
  }
  console.log(`Lahdedokumentteja ${dokumentit.length}`)

  /*
   * Jonorivit sivutettuna: `.eq("metadata->>...")` on taysi taulunluku
   * ja kaatuu satunnaisesti aikakatkaisuun ([[backfill-run-limits]]).
   */
  const tunnisteet: string[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,dok:metadata->>source_document_id")
      .range(a, a + 999)
    if (error) throw error
    for (const r of (data ?? []) as any[]) if (r.dok && kentat.has(r.dok)) tunnisteet.push(r.id)
    if ((data ?? []).length < 1000) break
  }

  const rivit: any[] = []
  for (let i = 0; i < tunnisteet.length; i += 50) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,status,metadata")
      .in("id", tunnisteet.slice(i, i + 50))
    if (error) throw error
    rivit.push(...(data ?? []))
  }
  console.log(`Jonorivejä tästä lähteestä ${rivit.length}\n`)

  /*
   * HYVAKSYTYLLA RIVILLA JONON KUVAUS EI NAY ASIAKKAALLE.
   *
   * Han lukee hankkeen omaa kenttaa `projects.additional_info`
   * ([[measure-the-field-the-user-reads]]). Mitattu 31.10.2026: nelja
   * naista hankkeista on JULKISIA ja niiden kuvaus on pelkka nimi
   * toistettuna, 16-29 merkkia. Siksi ajo paivittaa molemmat.
   */
  const hankkeet = new Map<string, any>()
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,additional_info")
      .range(a, a + 999)
    if (error) throw error
    for (const h of (data ?? []) as any[]) hankkeet.set(h.id, h)
    if ((data ?? []).length < 1000) break
  }

  /* Kuvaus joka on pelkka nimi ei ole kuvaus. */
  const tyhjaTaiNimi = (kuvaus: unknown, nimi: unknown) => {
    const k = String(kuvaus ?? "").trim()
    if (!k) return true
    const siisti = (s: string) => s.toLowerCase().replace(/[^a-zäöå0-9]/g, "")
    return siisti(k) === siisti(String(nimi ?? ""))
  }

  let muuttuu = 0
  let oliJo = 0
  let hankkeitaMuuttuu = 0

  for (const r of rivit) {
    const metadata = r.metadata ?? {}
    /* Olemassa olevaa kuvausta ei kirjoiteta yli. */
    if (String(metadata.description ?? "").trim()) {
      oliJo++
      continue
    }

    const p = kentat.get(metadata.source_document_id) ?? {}
    const kuvaus = kaavanPeruskuvaus({
      kunta: KUNTA,
      kaavaTunnus: p.kaavatunnus ?? null,
      nimi: p.kaavanimi1 ?? r.title ?? null,
      vaihe: p.vaihe ?? null,
      oasPvm: isoPaiva(p.oas_pvm),
    })
    if (!kuvaus) continue
    muuttuu++

    console.log(`[${r.status}] ${r.title}`)
    console.log(`   ${kuvaus}`)

    /* Hyvaksytyn rivin hanke: asiakas lukee sen kenttaa, ei taman. */
    const hanke = metadata.approved_project_id
      ? hankkeet.get(metadata.approved_project_id)
      : null
    const paivitaHanke = hanke && tyhjaTaiNimi(hanke.additional_info, hanke.name)
    if (hanke && !paivitaHanke) {
      console.log(`   HANKE: kuvaus on jo (${String(hanke.additional_info).length} merkkiä), ei kosketa`)
    }
    if (paivitaHanke) {
      hankkeitaMuuttuu++
      console.log(`   HANKE: "${String(hanke.additional_info ?? "").trim()}" -> peruskuvaus`)
    }
    console.log()

    if (!APPLY) continue
    const { error } = await db
      .from("potential_projects")
      .update({ metadata: { ...metadata, description: kuvaus } })
      .eq("id", r.id)
    if (error) console.error(`   VIRHE: ${error.message}`)

    if (paivitaHanke) {
      const { error: e2 } = await db
        .from("projects")
        .update({ additional_info: kuvaus })
        .eq("id", hanke.id)
      if (e2) console.error(`   HANKEVIRHE: ${e2.message}`)
    }
  }

  console.log("=== YHTEENVETO ===")
  console.log(`${APPLY ? "KIRJOITETTU" : "KUIVAHARJOITUS"}`)
  console.log(`  jonorivin kuvaus      ${muuttuu}`)
  console.log(`  hankkeen kuvaus       ${hankkeitaMuuttuu}`)
  console.log(`  kuvaus oli jo         ${oliJo}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
