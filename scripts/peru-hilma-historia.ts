import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TAKAUTUVAN HAUN RAJAUS JALKIKATEEN (D-297).
 *
 * Takautuva haku toi 528 uutta ilmoitusta 120 vuorokauden ikkunalla.
 * Johannes 17.10.2026: *"tuo 500 kpl katselmoitavaksi on todella iso
 * maara"* — ja oli oikeassa. Valittu rajaus: pidetaan vain se osa joka
 * on AIDON VUODON paikkausta, eli keruuikkunamme sisalta (elokuusta
 * alkaen), ja pudotetaan sita vanhempi historia.
 *
 *   kesakuu   137  ennen keruutamme   -> pois
 *   heinakuu  215  ennen keruutamme   -> pois
 *   elo-loka  176  keruuikkunassa     -> JAA
 *
 * Lisaksi poistetaan kaksoiskappaleet: haku loi 126 dokumenttia
 * ilmoituksille jotka olivat jo kannassa VANHALLA osoitemuodolla
 * (`/public/procurement/<id>/notice/overview/overview` vs.
 * `/public/procedure/<p>/enotice/<id>/`). Keraain dedupaa
 * `document_url`-avaimella eika tunnista niita samoiksi.
 *
 * EI KOSKE VANHOJA RIVEJA. Poistetaan vain taman ajon luomia, eli
 * `created_at` on tama paiva JA kyseessa on hilma-lahde.
 *
 *   npx tsx scripts/peru-hilma-historia.ts
 *   npx tsx scripts/peru-hilma-historia.ts --apply
 */

/* Keruuikkunamme alkoi heinakuun alussa; elokuusta alkaen on "aito vuoto". */
const SAILYTA_ALKAEN = "2026-08-01"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const rivit: any[] = []
  for (let a = 0; ; a += 500) {
    const { data, error } = await db
      .from("source_documents")
      .select(
        "id, document_url, created_at, facts_extracted_at, identity_resolved_at, " +
          "noticeId:raw_payload->noticeId, paiva:raw_payload->datePublished"
      )
      .eq("source_id", "hilma")
      .range(a, a + 499)
    if (error) {
      console.error("VIRHE:", error.message)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 500) break
  }

  const TANAAN = new Date().toISOString().slice(0, 10)
  const tanaan = rivit.filter((r) => String(r.created_at).slice(0, 10) === TANAAN)
  const vanhat = rivit.filter((r) => String(r.created_at).slice(0, 10) !== TANAAN)
  const vanhojenIdt = new Set(vanhat.map((r) => String(r.noticeId ?? "")))

  console.log(`Hilma-dokumentteja ${rivit.length}, joista tanaan luotuja ${tanaan.length}\n`)

  /* A) Historia: tanaan luotu JA julkaistu ennen sailytysrajaa. */
  const historia = tanaan.filter((r) => String(r.paiva ?? "").slice(0, 10) < SAILYTA_ALKAEN)

  /* B) Kaksoiskappale: tanaan luotu, mutta ilmoitus oli jo vanhalla osoitteella. */
  const tuplat = tanaan.filter(
    (r) => !historia.includes(r) && vanhojenIdt.has(String(r.noticeId ?? ""))
  )

  /*
   * Dokumentti jolle on jo syntynyt jonorivi JAA, vaikka se osuisi
   * rajaukseen: poistaminen jattaisi ehdokkaan ilman lahdetta.
   *
   * Kysely hakee vain viitetunnisteen, ei koko metadataa — koko kentan
   * lukeminen 10 000 rivilta aikakatkaistiin.
   */
  const viitteet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("docId:metadata->>source_document_id")
      .range(a, a + 999)
    if (error) {
      console.error("VIRHE viitteet:", error.message)
      process.exit(1)
    }
    viitteet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const kaytossa = new Set(viitteet.map((v) => String(v.docId ?? "")).filter(Boolean))

  const ehdokkaana = [...historia, ...tuplat].filter((r) => kaytossa.has(String(r.id)))
  const poistettavat = [...historia, ...tuplat].filter((r) => !kaytossa.has(String(r.id)))
  const jaa = tanaan.length - poistettavat.length

  console.log(`A) historia (julkaistu ennen ${SAILYTA_ALKAEN}): ${historia.length}`)
  console.log(`B) kaksoiskappale vanhalla osoitteella:        ${tuplat.length}`)
  console.log(`   POISTETAAN yhteensa:                        ${poistettavat.length}`)
  console.log(`   JAA (aidon vuodon paikkaus):                ${jaa}`)

  /* Varmistus: onko poistettavista jo tehty faktoja tai ehdokkaita? */
  const kasitellyt = poistettavat.filter((r) => r.facts_extracted_at || r.identity_resolved_at)
  console.log(`\n   joista jo kasiteltyja (faktat/tunnistus tehty): ${kasitellyt.length}`)

  const idt = new Set(poistettavat.map((r) => String(r.id)))
  console.log(`   sailytetaan koska jonorivi viittaa niihin:   ${ehdokkaana.length}`)

  /* Kuukausijakauma luettavaksi. */
  const kk = new Map<string, number>()
  for (const r of poistettavat) kk.set(String(r.paiva ?? "").slice(0, 7), (kk.get(String(r.paiva ?? "").slice(0, 7)) ?? 0) + 1)
  console.log(`\n   poistettavat kuukausittain:`)
  for (const [k, v] of [...kk].sort()) console.log(`     ${k}  ${v}`)

  if (!apply) {
    console.log(`\nEi poistettu mitaan. Aja --apply kun rivit on luettu.`)
    return
  }

  let poistettu = 0
  const lista = [...idt]
  for (let i = 0; i < lista.length; i += 100) {
    const pala = lista.slice(i, i + 100)
    const { error } = await db.from("source_documents").delete().in("id", pala)
    if (error) {
      console.error(`VIRHE poistossa: ${error.message}`)
      process.exit(1)
    }
    poistettu += pala.length
  }
  console.log(`\nPOISTETTU ${poistettu} dokumenttia.`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
