import { readFileSync, writeFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * SEINAJOEN KAAVASIVUJEN YHTEYSHENKILOT TAKAUTUVASTI (D-390).
 *
 * Kerain on korjattu (`seinajoenYhteyshenkilot`), mutta korjaus ei
 * kosketa jo haettuja sivuja. Tama ajo kay lapi Seinajoen kaavalahteen
 * dokumentit, hakee kortit sivulta ja kirjoittaa ne kolmeen paikkaan:
 *
 *   1. `source_documents.raw_payload.contacts`
 *   2. jonorivin `metadata.contact_persons`
 *   3. hankkeen `metadata.contact_persons` (jos rivi on jo hyvaksytty)
 *
 * YHDISTAA, EI KORVAA. Sama nimi taydennetaan vain tyhjien kenttien
 * osalta; kasin lisatty jaa ([[matched-overwrites-contacts]]).
 *
 * HAKU HITAASTI, kuten Vaylan ajossa: kaksi rinnakkaista ja tauko.
 *
 *   npx tsx scripts/taydenna-seinajoen-yhteyshenkilot.ts
 *   npx tsx scripts/taydenna-seinajoen-yhteyshenkilot.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const LAHDE = "Seinäjoen ajankohtaiset asemakaavat"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const RINNAKKAIN = 2
const TAUKO_MS = 300
const TUNNISTE = "seinajoen_yhteyshenkilot_2026_11"
const RAPORTTI = "C:/Users/johan/tyomaat-app/.tmp-seinajoki-yhteyshenkilot.txt"

const avain = (n: unknown) => String(n ?? "").toLowerCase().replace(/\s+/g, " ").trim()
const tyhja = (v: unknown) => v === null || v === undefined || String(v).trim() === ""

async function hae(url: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const ohjain = new AbortController()
      const kello = setTimeout(() => ohjain.abort(), 25_000)
      const r = await fetch(url, { cache: "no-store", headers: { "user-agent": UA }, signal: ohjain.signal })
      clearTimeout(kello)
      if (r.ok) return await r.text()
    } catch {
      /* uusi yritys */
    }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
  }
  return null
}

/* Yhdistaa poimitut olemassa olevaan listaan. Palauttaa [lista, lisatty, taydennetty]. */
function yhdista(omat: any[], poimitut: any[]): [any[], number, number] {
  const lista = omat.map((k) => ({ ...k }))
  let lisatty = 0
  let taydennetty = 0
  for (const p of poimitut) {
    const osuma = lista.find((k) => avain(k?.name) === avain(p.name))
    if (!osuma) {
      lista.push(p)
      lisatty++
      continue
    }
    let muuttui = false
    for (const kentta of ["title", "email", "phone", "organization"] as const) {
      if (tyhja(osuma[kentta]) && !tyhja(p[kentta])) {
        osuma[kentta] = p[kentta]
        muuttui = true
      }
    }
    if (muuttui) taydennetty++
  }
  return [lista, lisatty, taydennetty]
}

async function main() {
  const cheerio = await import("cheerio")
  const { createClient } = await import("@supabase/supabase-js")
  const { seinajoenYhteyshenkilot } = await import("../lib/agent/seinajoenYhteystiedot")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data: dokit, error } = await db
    .from("source_documents")
    .select("id,title,document_url,raw_payload")
    .eq("source_name", LAHDE)
  if (error) throw error
  console.log(`${LAHDE}: ${(dokit ?? []).length} dokumenttia\n`)

  /* Jonorivit ja hankkeet dokumentin tunnisteella. */
  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e } = await db
      .from("potential_projects")
      .select("id,title,status,metadata")
      .range(a, a + 999)
    if (e) throw e
    jono.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const jonoDokista = new Map<string, any[]>()
  for (const r of jono) {
    const id = String((r.metadata ?? {}).source_document_id ?? "")
    if (!id) continue
    jonoDokista.set(id, [...(jonoDokista.get(id) ?? []), r])
  }

  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error: e } = await db
      .from("projects")
      .select("id,name,metadata")
      .range(a, a + 999)
    if (e) throw e
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  const hankeOsoitteesta = new Map<string, any[]>()
  for (const r of hankkeet) {
    const md = r.metadata ?? {}
    /*
     * Sama hanke voi olla seka `documents_url`issa etta `source_url`issa,
     * joten lista pidetaan uniikkina tunnisteella — muuten sama hanke
     * nakyisi raportissa kahdesti ("hanketta 2") ja luku olisi vaara.
     */
    for (const u of [...new Set([md.documents_url, md.source_url])]) {
      const s = String(u ?? "")
      if (!s) continue
      const nykyiset = hankeOsoitteesta.get(s) ?? []
      if (nykyiset.some((x: any) => x.id === r.id)) continue
      hankeOsoitteesta.set(s, [...nykyiset, r])
    }
  }

  const rivit: string[] = []
  let haettu = 0
  let kortteja = 0
  let dokumentteja = 0
  let jonoRiveja = 0
  let hankkeita = 0
  let epaonnistui = 0
  const tyojono = [...(dokit ?? [])]

  await Promise.all(
    Array.from({ length: RINNAKKAIN }, async () => {
      while (tyojono.length) {
        const d: any = tyojono.shift()
        if (!d) break
        await new Promise((r) => setTimeout(r, TAUKO_MS))
        const html = await hae(String(d.document_url))
        haettu++
        if (!html) {
          epaonnistui++
          continue
        }
        const $ = cheerio.load(html)
        const poimitut = seinajoenYhteyshenkilot($ as any)
        if (!poimitut.length) continue
        kortteja += poimitut.length

        const hy = d.raw_payload ?? {}
        const vanhat = Array.isArray(hy.contacts) ? hy.contacts : []
        const [dokLista, dokLisatty] = yhdista(vanhat, poimitut)

        const jonorivit = jonoDokista.get(String(d.id)) ?? []
        const hankerivit = hankeOsoitteesta.get(String(d.document_url)) ?? []

        console.log(
          `${APPLY ? "KIRJOITA" : "(kuiva) "} ${String(d.title).slice(0, 42).padEnd(42)} kortteja ${poimitut.length} | jonoriviä ${jonorivit.length} | hanketta ${hankerivit.length}`
        )
        for (const p of poimitut) {
          console.log(`           ${p.name.padEnd(20)} ${String(p.title ?? "-").padEnd(24)} ${p.email ?? "-"} | ${p.phone ?? "-"}`)
          rivit.push(`${d.document_url}\t${d.title}\t${p.name}\t${p.title ?? ""}\t${p.email ?? ""}\t${p.phone ?? ""}`)
        }

        if (!APPLY) continue

        if (dokLisatty || !vanhat.length) {
          const { error: e1 } = await db
            .from("source_documents")
            .update({ raw_payload: { ...hy, contacts: dokLista }, updated_at: new Date().toISOString() })
            .eq("id", d.id)
          if (e1) console.log(`   VIRHE dokumentti: ${e1.message}`)
          else dokumentteja++
        }

        for (const r of jonorivit) {
          const md = r.metadata ?? {}
          const omat = Array.isArray(md.contact_persons) ? md.contact_persons : []
          const [lista, lisatty, taydennetty] = yhdista(omat, poimitut)
          if (!lisatty && !taydennetty) continue
          const { error: e2 } = await db
            .from("potential_projects")
            .update({
              metadata: {
                ...md,
                contact_persons: lista,
                takautuvat_ajot: [
                  ...new Set([...(Array.isArray(md.takautuvat_ajot) ? md.takautuvat_ajot : []), TUNNISTE]),
                ],
              },
            })
            .eq("id", r.id)
          if (e2) console.log(`   VIRHE jonorivi: ${e2.message}`)
          else jonoRiveja++
        }

        for (const r of hankerivit) {
          const md = r.metadata ?? {}
          const omat = Array.isArray(md.contact_persons) ? md.contact_persons : []
          const [lista, lisatty, taydennetty] = yhdista(omat, poimitut)
          if (!lisatty && !taydennetty) continue
          const { error: e3 } = await db
            .from("projects")
            .update({
              metadata: {
                ...md,
                contact_persons: lista,
                field_sources: {
                  ...(md.field_sources ?? {}),
                  contact_persons: "Seinäjoen kaavasivun yhteystietokortit",
                },
                takautuvat_ajot: [
                  ...new Set([...(Array.isArray(md.takautuvat_ajot) ? md.takautuvat_ajot : []), TUNNISTE]),
                ],
              },
            })
            .eq("id", r.id)
          if (e3) console.log(`   VIRHE hanke: ${e3.message}`)
          else hankkeita++
        }
      }
    })
  )

  writeFileSync(RAPORTTI, rivit.join("\n"), "utf8")
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  console.log(`  haettu ${haettu}, haku epaonnistui ${epaonnistui}`)
  console.log(`  yhteystietokortteja ${kortteja}`)
  if (APPLY) {
    console.log(`  kirjoitettu: dokumentteja ${dokumentteja}, jonoriviä ${jonoRiveja}, hanketta ${hankkeita}`)
  }
  console.log(`  tuotos ${RAPORTTI}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
