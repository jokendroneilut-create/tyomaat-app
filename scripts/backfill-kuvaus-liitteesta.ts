import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * HATTULAN KAAVOJEN KUVAUS SELOSTUKSESTA (D-412).
 *
 * Johannes 14.11.2026: Vihtolan asemakaavan kuvaus oli pelkka
 * menettelylause ja liitteiden nimet. Hanke on kuvattu selostuksessa.
 * Keraaja korjattiin; tama ajo tekee saman jo tallennetuille riveille.
 *
 * Sama logiikka kuin keraajassa: selostuksen sisalto ENSIN, haitarin
 * menettelylause peraan, liitteiden nimet pois.
 *
 * KASIN MUOKATTU SAILYY. Rivin kuvaus korvataan vain jos se on yha
 * tasmalleen keraajan alkuperainen haitariteksti. Jos joku on
 * muokannut sita, rivi ohitetaan ja naytetaan.
 *
 * Aja ensin ilman --apply-lippua ja lue tuotos riveittain.
 */

const APPLY = process.argv.includes("--apply")
const LAHDE = "Hattulan vireillä olevat asemakaavat"
const MERKKI = "hattula_kuvaus_2026_11"

const siisti = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { omaSisalto, onVainLiiteotsikot, taydennaKuvausLiitteesta } = await import("../lib/agent/kaavanLiite")
  const { yhdistaKuvaukset } = await import("../lib/agent/kaavanKuvaus")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data: dokut, error } = await db
    .from("source_documents")
    .select("id,title,document_url,raw_payload")
    .eq("source_name", LAHDE)
  if (error) throw error
  console.log(`lähdedokumentteja: ${dokut?.length ?? 0}`)

  /* Uusi kuvaus dokumenteittain. Budjetti riittää kaikille, ajo on kertaluonteinen. */
  const budjetti = { haettu: 0, raja: 60 }
  const uusiKuvaus = new Map<string, { vanha: string; uusi: string; otsikko: string; url: string }>()

  for (const d of dokut ?? []) {
    const p = (d as any).raw_payload ?? {}
    const haitari = siisti(p.description)
    const linkit = (p.attachments ?? []).map((a: any) => ({ href: a.url, teksti: a.label }))
    const menettely = onVainLiiteotsikot(haitari, linkit) ? "" : omaSisalto(haitari, linkit)
    const liitteesta = await taydennaKuvausLiitteesta("", linkit, budjetti)
    const uusi = liitteesta ? yhdistaKuvaukset(liitteesta, menettely) ?? liitteesta : menettely

    if (!liitteesta) {
      console.log(`  EI SELOSTUSTA  ${String((d as any).title).slice(0, 60)}`)
      continue
    }
    uusiKuvaus.set((d as any).id, { vanha: haitari, uusi, otsikko: (d as any).title, url: (d as any).document_url })
  }
  console.log(`selostuksesta kuvaus: ${uusiKuvaus.size} / ${dokut?.length ?? 0}   (PDF-hakuja ${budjetti.haettu})`)

  let kirjoitettu = 0

  for (const [taulu, nimiKentta] of [["potential_projects", "title"], ["projects", "name"]] as const) {
    const { data: rivit, error: e2 } = await db
      .from(taulu)
      .select(`id,${nimiKentta},status,kuvaus:metadata->>description,doku:metadata->>source_document_id,url:metadata->>documents_url`)
      .eq("metadata->>source_name", LAHDE)
    if (e2) throw e2

    const muutokset: any[] = []
    const ohitetut: any[] = []

    for (const r of (rivit ?? []) as any[]) {
      const osuma =
        uusiKuvaus.get(r.doku) ??
        [...uusiKuvaus.values()].find((u) => u.url === r.url)
      if (!osuma) continue

      const nykyinen = siisti(r.kuvaus)
      if (nykyinen === siisti(osuma.uusi)) continue

      /*
       * Kasin muokattu: ei koske.
       *
       * Keraajan teksti tunnistetaan ALUSTA, ei tasmaavasta
       * kokonaisuudesta: sivun haitariteksti elaa versioittain (uusi
       * paatos lisataan peraan), ja ehdokasrivin metadataa ei paivity
       * kun lahde muuttuu. Sattulantie 68:n rivi alkoi merkki merkilta
       * samoin kuin lahdedokumentti mutta hanta erosi, ja tasmavertailu
       * luokitteli sen virheellisesti kasin muokatuksi. Kasin kirjoitettu
       * kuvaus ei ala samalla 120 merkin menettelylauseella.
       */
      const alku = osuma.vanha.slice(0, 120)
      const keraajanTekstia = nykyinen === osuma.vanha || (alku.length >= 60 && nykyinen.startsWith(alku))
      if (nykyinen && !keraajanTekstia) {
        ohitetut.push({ r, nykyinen })
        continue
      }
      muutokset.push({ r, osuma, nykyinen })
    }

    console.log(`\n=== ${taulu.toUpperCase()}: korjattavia ${muutokset.length} / ${rivit?.length ?? 0}`)
    for (const m of muutokset) {
      console.log(`\n  ${String(m.r[nimiKentta]).slice(0, 60)}${m.r.status ? "   [" + m.r.status + "]" : ""}`)
      console.log(`    ENNEN:   ${m.nykyinen.slice(0, 170)}`)
      console.log(`    JÄLKEEN: ${m.osuma.uusi.slice(0, 600)}`)
    }
    if (ohitetut.length) {
      console.log(`\n  ohitettu ${ohitetut.length} (kuvausta on muokattu, ei kosketa):`)
      for (const o of ohitetut) console.log(`    ${String(o.r[nimiKentta]).slice(0, 50).padEnd(52)}${o.nykyinen.slice(0, 70)}`)
    }

    if (APPLY) {
      for (const m of muutokset) {
        const { data: rivi, error: e3 } = await db.from(taulu).select("metadata").eq("id", m.r.id).single()
        if (e3) throw e3
        const meta = { ...(rivi?.metadata ?? {}), description: m.osuma.uusi }
        meta.takautuvat_ajot = [...new Set([...(meta.takautuvat_ajot ?? []), MERKKI])]
        const { error: e4 } = await db.from(taulu).update({ metadata: meta }).eq("id", m.r.id)
        if (e4) throw e4
      }
      console.log(`\n  kirjoitettu ${muutokset.length}`)
    }
    kirjoitettu += muutokset.length
  }

  console.log(`\n${APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS ==="}  rivejä ${kirjoitettu}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
