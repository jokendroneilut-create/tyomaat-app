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
 * YRITYSTIEDOTTEIDEN IKA: MITA 12 KUUKAUDEN IKKUNA KARSISI?
 *
 * Johannes 2.10.2026: kirista ikkuna 24 kuukaudesta 12:een. Ennen
 * muutosta on tiedettava mita se maksaa — eli montako JONOSSA OLEVAA
 * ehdokasta olisi jaanyt tulematta.
 *
 * PAIVA ON TEKSTISSA, EI KENTASSA. `published_at` on tyhja kaikilla
 * 9 541 dokumentilla (D-225), joten ika luetaan raakatekstista. Se on
 * epatarkempaa kuin kentta, joten rivit tulostetaan luettavaksi eika
 * pelkkana lukuna.
 *
 *   npx tsx scripts/measure-tiedotteiden-ika.ts
 */

/* Lahteet joilla on 24 kk:n ikkuna: yritystiedotteet. */
const YRITYSLAHTEET = [
  "srv", "ncc", "peab", "lujatalo", "fira", "varte", "hausia", "mangrove",
  "marvea", "marttilan", "rakennusteho", "kas", "brand_toimitilat",
  "hc_hoivakodit", "ysaatio", "lujakoti",
]

/* "29.1.2026" tai "29.01.2026" tekstista. Ensimmainen osuma riittaa. */
function paivaTekstista(teksti: string | null | undefined): string | null {
  const m = String(teksti ?? "").match(/\b(\d{1,2})\.(\d{1,2})\.(20\d\d)\b/)
  if (!m) return null
  return `${m[3]}-${String(m[2]).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const ehdokkaat: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, created_at, metadata")
      .order("created_at", { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    ehdokkaat.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const yritys = ehdokkaat.filter((p) =>
    YRITYSLAHTEET.includes(String(p.metadata?.source ?? p.metadata?.source_name ?? "").toLowerCase())
  )

  console.log(`ehdokkaita ${ehdokkaat.length}, yrityslahteista ${yritys.length}\n`)

  /* Dokumenttien tekstit kerralla: osoite -> raw_text. */
  const osoitteet = yritys.map((p) => String(p.metadata?.source_url ?? "")).filter(Boolean)
  const tekstit = new Map<string, string>()

  for (let i = 0; i < osoitteet.length; i += 50) {
    const pala = osoitteet.slice(i, i + 50)
    const { data } = await db.from("source_documents").select("document_url, raw_text").in("document_url", pala)
    for (const d of data ?? []) tekstit.set(String(d.document_url), String(d.raw_text ?? ""))
  }

  const nyt = Date.now()
  const kaudet = new Map<string, number>()
  const yli12: { p: any; paiva: string; kk: number }[] = []
  let ilmanPaivaa = 0

  for (const p of yritys) {
    const paiva = paivaTekstista(tekstit.get(String(p.metadata?.source_url ?? "")))
    if (!paiva) {
      ilmanPaivaa++
      continue
    }
    const kk = Math.floor((nyt - new Date(paiva).getTime()) / (30.44 * 86_400_000))
    const kausi = kk < 0 ? "tuleva?" : kk < 3 ? "0-3 kk" : kk < 6 ? "3-6 kk" : kk < 12 ? "6-12 kk" : kk < 24 ? "12-24 kk" : "yli 24 kk"
    kaudet.set(kausi, (kaudet.get(kausi) ?? 0) + 1)
    if (kk >= 12) yli12.push({ p, paiva, kk })
  }

  console.log("=== YRITYSLAHTEIDEN EHDOKKAAT IAN MUKAAN ===")
  for (const k of ["0-3 kk", "3-6 kk", "6-12 kk", "12-24 kk", "yli 24 kk", "tuleva?"]) {
    if (kaudet.has(k)) console.log(`  ${k.padEnd(10)} ${String(kaudet.get(k)).padStart(4)}`)
  }
  console.log(`  ${"ei paivaa".padEnd(10)} ${String(ilmanPaivaa).padStart(4)}  (ikaa ei voi lukea tekstista)`)

  /*
   * TARKEIN KYSYMYS: tuliko vanhoista koskaan hyvaksyttyja hankkeita?
   * Jos ei, ikkunan kiristys ei maksa mitaan.
   */
  const tilat = (joukko: { p: any }[]) => {
    const m = new Map<string, number>()
    for (const { p } of joukko) m.set(String(p.status), (m.get(String(p.status)) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")
  }

  const alle12: { p: any }[] = []
  for (const p of yritys) {
    const paiva = paivaTekstista(tekstit.get(String(p.metadata?.source_url ?? "")))
    if (!paiva) continue
    const kk = Math.floor((nyt - new Date(paiva).getTime()) / (30.44 * 86_400_000))
    if (kk >= 0 && kk < 12) alle12.push({ p })
  }

  console.log("")
  console.log("=== TILAJAKAUMA ===")
  console.log(`  alle 12 kk (${alle12.length}):  ${tilat(alle12)}`)
  console.log(`  yli 12 kk  (${yli12.length}):  ${tilat(yli12)}`)

  console.log(`\n=== 12 KK:N IKKUNA OLISI KARSINUT: ${yli12.length} ===`)
  const jonossa = yli12.filter((x) => x.p.status === "new")
  console.log(`  niista jonossa viela (status=new): ${jonossa.length}`)
  console.log(`  muut on jo kasitelty (hyvaksytty tai ohitettu)\n`)

  for (const { p, paiva, kk } of yli12.sort((a, b) => b.kk - a.kk).slice(0, 25)) {
    console.log(
      `  ${String(kk).padStart(2)} kk  ${paiva}  ${String(p.status).padEnd(8)} ${String(p.title).replace(/\s+/g, " ").slice(0, 62)}`
    )
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
