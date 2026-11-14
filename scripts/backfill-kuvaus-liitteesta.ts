import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KAAVAN KUVAUS JA YHTEYSTIEDOT LIITTEESTA, LAHDE KERRALLAAN
 * (D-412 Hattula, D-413 Huittinen).
 *
 * Keraaja kytketaan `kaavanLiitteenSisalto`on (kaavanLiite.ts); tama
 * ajo tekee saman jo tallennetuille riveille. SAMA FUNKTIO kuin
 * keraajassa, jotteivat ne ehdi eriytya.
 *
 *   npx tsx scripts/backfill-kuvaus-liitteesta.ts --lahde="Huittisten vireillä olevat asemakaavat"
 *   ... --apply
 *
 * KUVAUS korvataan vain jos se on tyhja tai keraajan oma teksti.
 * Keraajan teksti tunnistetaan ALUSTA: sivun teksti elaa versioittain,
 * ja ehdokasrivin metadataa ei paivity kun lahde muuttuu. Kasin
 * kirjoitettu kuvaus ei ala samalla 120 merkin menettelylauseella.
 *
 * YRITYKSET (D-414): rakennuttaja vain jos kentta on tyhja (jonorivilla
 * metadata.developer, hankkeella developer-sarake); muut yritykset
 * related_companies-listaan, ei kahdesti eika rakennuttajaa uudelleen.
 *
 * YHTEYSTIEDOT LISATAAN, EI KORVATA. Uudet nimetyt henkilot ensin,
 * olemassa olevat peraan; sama henkilo (sahkoposti tai nimi) ei tule
 * kahdesti. Kasin lisatty osapuoli sailyy.
 *
 * Aja ensin ilman --apply-lippua ja lue tuotos riveittain.
 */

const APPLY = process.argv.includes("--apply")
const LAHDE = process.argv.find((a) => a.startsWith("--lahde="))?.slice("--lahde=".length)
/*
 * --vain-yhteystiedot (D-415): kuvaukseen ei kosketa. OAS-yhteystietojen
 * kayttoonotossa lahde kerrallaan kuvaukset ovat eri muutos, jota ei ole
 * luettu lapi.
 */
const VAIN_YHTEYSTIEDOT = process.argv.includes("--vain-yhteystiedot")
const MERKKI = "kuvaus_liitteesta_2026_11"

const siisti = (t: unknown) => String(t ?? "").replace(/\s+/g, " ").trim()
const avain = (c: any) => [String(c?.email ?? "").toLowerCase().trim(), String(c?.name ?? "").toLowerCase().trim()]

async function main() {
  if (!LAHDE) throw new Error('anna lähde: --lahde="..."')

  const { createClient } = await import("@supabase/supabase-js")
  const { kaavanLiitteenSisalto, omaSisalto } = await import("../lib/agent/kaavanLiite")

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
  console.log(`[${LAHDE}] lähdedokumentteja: ${dokut?.length ?? 0}`)

  const budjetti = { haettu: 0, raja: 60 }
  const tulokset = new Map<string, { vanha: string; uusi: string; yht: any[]; url: string; linkit: any[]; osapuolet: { developer: string | null; related: string[] } }>()

  for (const d of (dokut ?? []) as any[]) {
    const p = d.raw_payload ?? {}
    const sivu = siisti(p.description)
    const linkit = (p.attachments ?? []).map((a: any) => ({ href: a.url, teksti: a.label }))
    const liite = await kaavanLiitteenSisalto(sivu, linkit, budjetti)

    const uusiKuvaus = liite.kuvaus !== sivu ? liite.kuvaus : ""
    if (!uusiKuvaus && !liite.yhteystiedot.length) {
      console.log(`  EI LIITTEESTÄ  ${String(d.title).slice(0, 60)}`)
      continue
    }
    tulokset.set(d.id, { vanha: sivu, uusi: uusiKuvaus, yht: liite.yhteystiedot, url: d.document_url, linkit, osapuolet: liite.osapuolet })
  }
  console.log(`liitteestä tietoa: ${tulokset.size} / ${dokut?.length ?? 0}   (PDF-hakuja ${budjetti.haettu})`)

  let kirjoitettu = 0

  for (const [taulu, nimiKentta] of [["potential_projects", "title"], ["projects", "name"]] as const) {
    const { data: rivit, error: e2 } = await db
      .from(taulu)
      .select(`id,${nimiKentta},status,kuvaus:metadata->>description,yht:metadata->contact_persons,doku:metadata->>source_document_id,url:metadata->>documents_url,liittyvat:metadata->related_companies,${taulu === "projects" ? "kehittaja:developer" : "kehittaja:metadata->>developer"}`)
      .eq("metadata->>source_name", LAHDE)
    if (e2) throw e2

    const muutokset: any[] = []
    const ohitetut: any[] = []

    for (const r of (rivit ?? []) as any[]) {
      const osuma = tulokset.get(r.doku) ?? [...tulokset.values()].find((u) => u.url === r.url)
      if (!osuma) continue

      const paivitys: Record<string, unknown> = {}

      /* Kuvaus: vain tyhja tai keraajan oma teksti. */
      const nykyinen = siisti(r.kuvaus)
      if (!VAIN_YHTEYSTIEDOT && osuma.uusi && nykyinen !== siisti(osuma.uusi)) {
        const alku = osuma.vanha.slice(0, 120)

        /*
         * VAIHEOTSIKKO JA LIITTEIDEN NIMET (D-413). Huittisissa rivin
         * kuvaus oli "Vireilletulovaihe Osallistumis- ja arviointi-
         * suunnitelma 18.05.2026 (pdf, 1 Mt)" -- keraajan tuottama, mutta
         * alku ei tasmannyt lahdedokumenttiin, koska kaava oli sen
         * jalkeen edennyt seuraavaan vaiheeseen. Kun liitteiden nimet
         * poistetaan ja jaljelle jaa VAIN vaiheen nimi, teksti on
         * keraajan eika kenenkaan kirjoittama.
         */
        const jaannos = omaSisalto(nykyinen, osuma.linkit)
        const vainVaihe = jaannos.length <= 60 && /^[A-Za-zÅÄÖåäö\s-]*vaihe[A-Za-zÅÄÖåäö\s-]*$/i.test(jaannos)

        /*
         * TIEDOSTOKOKOMERKINTA "(pdf, 8 Mt)" (D-413). Greenskyn rivilla
         * oli myos sivun omaa proosaa ("Aloitusvaiheen yleisotilaisuus
         * pidettiin 10.06.2026"), joten "vain vaihe" ei tayttynyt. Mutta
         * tiedostokoon kirjoittaa vain keraaja liitelinkin nimesta --
         * kukaan ei kirjoita sita kasin.
         */
        const tiedostokoko = /\((?:pdf|docx?|xlsx?),\s*[\d,.]+\s*(?:mt|kt|mb|kb)\)/i.test(nykyinen)

        const keraajanTekstia =
          !nykyinen ||
          nykyinen === osuma.vanha ||
          (alku.length >= 60 && nykyinen.startsWith(alku)) ||
          vainVaihe ||
          tiedostokoko
        if (keraajanTekstia) paivitys.description = osuma.uusi
        else ohitetut.push({ r, nykyinen })
      }

      /* Yhteystiedot: lisataan, ei korvata. */
      const vanhat: any[] = Array.isArray(r.yht) ? r.yht : []
      const tunnetut = new Set(vanhat.flatMap(avain).filter(Boolean))
      const uudet = osuma.yht
        .filter((h) => !avain(h).some((k) => k && tunnetut.has(k)))
        .map((h) => ({ kind: "person", ...h }))
      if (uudet.length) paivitys.contact_persons = [...uudet, ...vanhat]

      /* Yritykset rooleineen (D-414). */
      const sarakkeet: Record<string, unknown> = {}
      const nykyKehittaja = String(r.kehittaja ?? "").trim()
      const uusiKehittaja = !nykyKehittaja && osuma.osapuolet.developer ? osuma.osapuolet.developer : null
      if (uusiKehittaja) {
        if (taulu === "projects") sarakkeet.developer = uusiKehittaja
        else paivitys.developer = uusiKehittaja
      }
      const kehittaja = (nykyKehittaja || uusiKehittaja || "").toLowerCase()
      const vanhatYritykset: string[] = Array.isArray(r.liittyvat) ? r.liittyvat : []
      const tunnetutYritykset = new Set([kehittaja, ...vanhatYritykset.map((x) => String(x).toLowerCase())])
      const uudetYritykset = osuma.osapuolet.related.filter((x) => !tunnetutYritykset.has(x.toLowerCase()))
      if (uudetYritykset.length) paivitys.related_companies = [...vanhatYritykset, ...uudetYritykset]

      if (Object.keys(paivitys).length || Object.keys(sarakkeet).length)
        muutokset.push({ r, paivitys, sarakkeet, nykyinen, vanhat, uudet, uusiKehittaja, uudetYritykset })
    }

    console.log(`\n=== ${taulu.toUpperCase()}: korjattavia ${muutokset.length} / ${rivit?.length ?? 0}`)
    for (const m of muutokset) {
      console.log(`\n  ${String(m.r[nimiKentta]).slice(0, 60)}   [${m.r.status}]`)
      if (m.paivitys.description) {
        console.log(`    KUVAUS ENNEN:   ${m.nykyinen ? m.nykyinen.slice(0, 160) : "(tyhjä)"}`)
        console.log(`    KUVAUS JÄLKEEN: ${String(m.paivitys.description).slice(0, 700)}`)
      }
      if (m.uusiKehittaja) console.log(`    RAKENNUTTAJA: ${m.uusiKehittaja}`)
      if (m.uudetYritykset.length) console.log(`    LIITTYVÄT YRITYKSET: +${m.uudetYritykset.join(" // ")}`)
      if (m.uudet.length) {
        console.log(`    YHTEYSTIEDOT: ${m.vanhat.length} olemassa, +${m.uudet.length} uutta:`)
        for (const h of m.uudet) {
          console.log(`      + ${String(h.name).padEnd(20)} ${String(h.title ?? "-").slice(0, 36).padEnd(38)} ${String(h.phone ?? "-").padEnd(18)} ${h.email ?? "-"}   [${h.organization ?? "-"}]`)
        }
      }
    }
    if (ohitetut.length) {
      console.log(`\n  kuvaus ohitettu ${ohitetut.length} (kuvausta on muokattu, ei kosketa):`)
      for (const o of ohitetut) console.log(`    ${String(o.r[nimiKentta]).slice(0, 50).padEnd(52)}${o.nykyinen.slice(0, 70)}`)
    }

    if (APPLY) {
      for (const m of muutokset) {
        const { data: rivi, error: e3 } = await db.from(taulu).select("metadata").eq("id", m.r.id).single()
        if (e3) throw e3
        const meta = { ...(rivi?.metadata ?? {}), ...m.paivitys }
        meta.takautuvat_ajot = [...new Set([...(meta.takautuvat_ajot ?? []), MERKKI])]
        const { error: e4 } = await db.from(taulu).update({ ...m.sarakkeet, metadata: meta }).eq("id", m.r.id)
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
