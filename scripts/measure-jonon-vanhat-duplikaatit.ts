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
 * JONON VANHAT UUTISET: ONKO HANKE JO MEILLA?
 *
 * Johannes 3.10.2026: *"en halua hyvaksya kymmenia vuoden vanhoja
 * uutisia jotka meilla jo on ja jotka nakyisivat hetkellisesti
 * kayttajalle uutena tietona ennen kuin duplikaattiskannaus loytaa
 * ne."*
 *
 * Kysymys on kaksiosainen eika kumpikaan yksin riita:
 *
 *   1. Kuinka vanha tiedote on? Paiva on raakatekstissa, koska
 *      `published_at` on tyhja kaikilla dokumenteilla (D-225).
 *   2. Onko hanke jo kannassa? Tahan kaytetaan SAMAA tasmayttajaa
 *      jota putki itse kayttaa (`findProjectMatchDetailed`), ei omaa
 *      sanaosumaa — oma vertailu antoi 2.10. vaaran osuman
 *      Martensbron kohdalle (D-227).
 *
 * EI MUUTA MITAAN. Tulostaa listan luettavaksi.
 *
 *   npx tsx scripts/measure-jonon-vanhat-duplikaatit.ts
 */

/* Kynnys jonka yli kysytaan "onko tama jo meilla". */
const VANHA_KK = 12

function paivaTekstista(teksti: string | null | undefined): string | null {
  const m = String(teksti ?? "").match(/\b(\d{1,2})\.(\d{1,2})\.(20\d\d)\b/)
  if (!m) return null
  const p = `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`
  return Number.isFinite(new Date(p).getTime()) ? p : null
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* Jono. */
  const jono: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("*")
      .eq("status", "new")
      .order("created_at", { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    jono.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  /* Olemassa olevat hankkeet tasmaytysta varten. */
  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("*")
      .eq("status", "active")
      .order("id")
      .range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(`jonossa ${jono.length}, aktiivisia hankkeita ${hankkeet.length}\n`)

  /*
   * Tiedotteiden tekstit. Jonossa on kaksi muotoa: osa rivesta viittaa
   * dokumenttiin tunnuksella (`source_document_id`), osa osoitteella.
   * Molemmat luetaan, muuten ikaa ei saa suurimmalle osalle.
   */
  const tekstit = new Map<string, string>()

  const tunnukset = [...new Set(jono.map((p) => String(p.metadata?.source_document_id ?? "")).filter(Boolean))]
  for (let i = 0; i < tunnukset.length; i += 50) {
    const { data } = await db.from("source_documents").select("id, raw_text").in("id", tunnukset.slice(i, i + 50))
    for (const d of data ?? []) tekstit.set(String(d.id), String(d.raw_text ?? ""))
  }

  const osoitteet = [...new Set(jono.map((p) => String(p.metadata?.source_url ?? "")).filter(Boolean))]
  for (let i = 0; i < osoitteet.length; i += 50) {
    const { data } = await db
      .from("source_documents")
      .select("document_url, raw_text")
      .in("document_url", osoitteet.slice(i, i + 50))
    for (const d of data ?? []) tekstit.set(String(d.document_url), String(d.raw_text ?? ""))
  }

  const teksti = (p: any) =>
    tekstit.get(String(p.metadata?.source_document_id ?? "")) ??
    tekstit.get(String(p.metadata?.source_url ?? "")) ??
    ""

  const nyt = Date.now()
  const rivit: { p: any; paiva: string | null; kk: number | null; osuma: any }[] = []

  for (const p of jono) {
    const paiva = paivaTekstista(teksti(p))
    const kk = paiva ? Math.floor((nyt - new Date(paiva).getTime()) / (30.44 * 86_400_000)) : null

    /*
     * Kentat ovat SARAKKEISSA, eivat metadatassa: `municipality`,
     * `address`, `property_id`, `permit_number`. Ensimmainen versio luki
     * ne metadatasta ja sai nolla osumaa 163:sta — tasmayttaja ei
     * valehdellut, sille vain annettiin tyhjat.
     */
    const osuma = findProjectMatchDetailed(hankkeet as any, {
      name: p.title,
      sourceTitle: p.metadata?.source_title ?? null,
      city: p.municipality ?? null,
      region: p.metadata?.region ?? null,
      location: p.address ?? null,
      permitNumber: p.permit_number ?? null,
      propertyId: p.property_id ?? null,
      developer: p.metadata?.developer ?? null,
      buildingType: p.metadata?.building_type ?? null,
      description: p.metadata?.description ?? null,
    })

    rivit.push({ p, paiva, kk, osuma })
  }

  const ika = (kk: number | null) => (kk === null ? "?" : `${kk} kk`)
  const vanhat = rivit.filter((r) => r.kk !== null && r.kk >= VANHA_KK)
  const tuoreet = rivit.filter((r) => r.kk !== null && r.kk < VANHA_KK)
  const tuntematon = rivit.filter((r) => r.kk === null)

  console.log(`=== JONON IKAJAKAUMA ===`)
  console.log(`  alle ${VANHA_KK} kk      ${tuoreet.length}`)
  console.log(`  yli ${VANHA_KK} kk       ${vanhat.length}`)
  console.log(`  ikaa ei saa    ${tuntematon.length}`)

  const osuvia = (joukko: typeof rivit, raja: number) =>
    joukko.filter((r) => r.osuma && (r.osuma.confidence ?? 0) >= raja).length

  console.log(`\n=== TASMAYS OLEMASSA OLEVIIN HANKKEISIIN ===`)
  console.log(`  (>=70 = putki yhdistaisi automaattisesti, 40-69 = duplikaattivihje)`)
  console.log(`  yli ${VANHA_KK} kk:  >=70 ${osuvia(vanhat, 70)},  40-69 ${osuvia(vanhat, 40) - osuvia(vanhat, 70)}`)
  console.log(`  alle ${VANHA_KK} kk: >=70 ${osuvia(tuoreet, 70)},  40-69 ${osuvia(tuoreet, 40) - osuvia(tuoreet, 70)}`)

  /*
   * Johanneksen huoli on "meilla on jo", ei pelkka ika. Vahvat osumat
   * listataan siksi iasta riippumatta: juuri ne nakyisivat asiakkaalle
   * uutena ennen kuin duplikaattiskannaus loytaa ne.
   */
  const vahvat = rivit
    .filter((r) => r.osuma && (r.osuma.confidence ?? 0) >= 70)
    .sort((a, b) => (b.osuma.confidence ?? 0) - (a.osuma.confidence ?? 0))

  console.log("")
  console.log(`=== JO KANNASSA: TASMAYS >=70 (${vahvat.length}) ===`)
  console.log("(putki yhdistaisi nama automaattisesti - juuri nama nakyisivat hetken uutena)")
  console.log("")
  for (const r of vahvat) {
    console.log(`  ${String(Math.round(r.osuma.confidence)).padStart(3)}  ${String(ika(r.kk)).padStart(6)}  ${String(r.p.title).replace(/\s+/g, " ").slice(0, 62)}`)
    console.log(`       -> ${String(r.osuma.project?.name ?? "-").replace(/\s+/g, " ").slice(0, 70)}`)
    console.log(`          ${(r.osuma.reasons ?? []).join(", ").slice(0, 78)}`)
    console.log(`       ${r.p.id}`)
  }

  /* Mista rivit ilman ikaa tulevat? */
  const lahteittain = new Map<string, number>()
  for (const r of tuntematon) {
    const k = String(r.p.metadata?.source_name ?? r.p.metadata?.source ?? r.p.metadata?.firstSourceName ?? "-")
    lahteittain.set(k, (lahteittain.get(k) ?? 0) + 1)
  }
  console.log("")
  console.log(`=== IKAA EI SAA TEKSTISTA (${tuntematon.length}) ===`)
  console.log("(ei paivamaaraa muodossa p.k.vvvv - useimmat kuulutuksia ja hankintailmoituksia)")
  console.log("")
  for (const [k, n] of [...lahteittain].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(n).padStart(4)}  ${k.slice(0, 50)}`)
  }

  console.log(`\n=== YLI ${VANHA_KK} KK VANHAT (${vanhat.length}), vanhin ensin ===\n`)
  for (const r of vanhat.sort((a, b) => (b.kk ?? 0) - (a.kk ?? 0))) {
    const pisteet = r.osuma ? Math.round(r.osuma.confidence ?? 0) : 0
    const merkki = pisteet >= 70 ? "ON JO MEILLA" : pisteet >= 40 ? "ehka sama   " : "ei osumaa   "
    console.log(`${String(ika(r.kk)).padStart(6)}  ${r.paiva}  ${merkki} ${pisteet ? `(${pisteet})` : "    "}  ${String(r.p.title).replace(/\s+/g, " ").slice(0, 60)}`)
    if (pisteet >= 40) {
      console.log(`         -> ${String(r.osuma.project?.name ?? "-").replace(/\s+/g, " ").slice(0, 72)}`)
      console.log(`            ${(r.osuma.reasons ?? []).join(", ").slice(0, 80)}`)
    }
    console.log(`         ${r.p.id}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
