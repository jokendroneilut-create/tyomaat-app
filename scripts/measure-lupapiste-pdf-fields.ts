import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: mita kenttia Lupapisteen paatos-PDF:sta oikeasti saisi?
 *
 * Tallennettuja PDF-teksteja on 275 (D-096). Ennen kuin niista aletaan
 * poimia kenttia, mitataan kuinka usein kukin esiintyy ja missa muodossa.
 * Ei kirjoita mitaan.
 */

type Kentta = {
  nimi: string
  /* Otsikko ja sita seuraava arvo samalla rivilla, kuten paatoslomakkeessa. */
  re: RegExp
  /* Milloin poimittu arvo on uskottava? Otsikon loytyminen ei riita. */
  kelpaa: (arvo: string) => boolean
}

const MAARA = /^[0-9][0-9\s.,]*\s*(k-)?m[2-3²³]?$/i
/* Toisen kentan otsikko arvossa = poiminta valui seuraavaan kenttaan. */
const TOINEN_OTSIKKO = /toimenpide|suunnittelija|vaativuus|rakentamism|kerrostalo|paatos|lupatunnu/i

const KENTAT: Kentta[] = [
  {
    nimi: "kaavan kayttotarkoitus",
    re: /Kaavan käyttötarkoitus\s*:?\s*(.{2,90})/i,
    /* Kaavamerkinta alkaa isolla kirjaimella ja on lyhyt tunnus. */
    kelpaa: (v) => /^[A-ZÅÄÖ]{1,3}[-0-9]{0,4}/.test(v) && !TOINEN_OTSIKKO.test(v),
  },
  { nimi: "kerrosala", re: /Kerrosala\s*:?\s*(.{1,40})/i, kelpaa: (v) => MAARA.test(v) },
  { nimi: "rakennusoikeus", re: /Rakennusoikeus\s*:?\s*(.{1,40})/i, kelpaa: (v) => MAARA.test(v) },
  { nimi: "kokonaisala", re: /Kokonaisala\s*:?\s*(.{1,40})/i, kelpaa: (v) => MAARA.test(v) },
  { nimi: "tilavuus", re: /Tilavuus\s*:?\s*(.{1,40})/i, kelpaa: (v) => MAARA.test(v) },
  { nimi: "kerrosluku", re: /Kerrosluku\s*:?\s*(.{1,30})/i, kelpaa: (v) => /^[IVX0-9]{1,4}$/i.test(v.trim()) },
  {
    nimi: "hankkeen vaativuus",
    re: /Hankkeen vaativuus\s*:?\s*(.{2,40})/i,
    kelpaa: (v) => /^(tavanomainen|vaativa|poikkeuksellisen vaativa|vahainen)/i.test(v.trim()),
  },
  {
    nimi: "hankkeeseen ryhtyva",
    re: /Hankkeeseen ryhtyvä\s*:?\s*(.{2,70})/i,
    kelpaa: (v) => !TOINEN_OTSIKKO.test(v) && /[A-ZÅÄÖ]/.test(v),
  },
  {
    nimi: "paasuunnittelija",
    re: /Pääsuunnittelija\s*:?\s*(.{2,70})/i,
    kelpaa: (v) => !TOINEN_OTSIKKO.test(v) && !/^tavanomainen|^vaativa/i.test(v.trim()),
  },
  { nimi: "tontin pinta-ala", re: /Tontin pinta-?ala\s*:?\s*(.{1,40})/i, kelpaa: (v) => MAARA.test(v) },
]

/* Vapaassa tekstissa esiintyvat maarat, joita ei ole omalla otsikollaan. */
const NEULAT: { nimi: string; re: RegExp }[] = [
  { nimi: "neliomaara (m2)", re: /\d[\d\s.,]*\s?m2\b/i },
  { nimi: "kuutiomaara (m3)", re: /\d[\d\s.,]*\s?m3\b/i },
  { nimi: "sana datakeskus", re: /datakeskus/i },
  { nimi: "sana logistiikk", re: /logistiikk/i },
  { nimi: "sana tuotantolaitos", re: /tuotantolaito/i },
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id, title, raw_payload")
      .eq("source_name", "Lupapiste kuulutukset")
      .not("raw_payload->>bulletin_pdf_text", "is", null)
      .range(from, from + 499)
    if (error) throw error
    docs.push(...(data ?? []))
    if (!data || data.length < 500) break
  }

  console.log(`PDF-teksteja kannassa: ${docs.length}\n`)

  const osumat = new Map<string, number>()
  const naytteet = new Map<string, string[]>()
  const kelvolliset = new Map<string, number>()

  for (const d of docs) {
    const text = String(d.raw_payload?.bulletin_pdf_text ?? "")

    for (const k of KENTAT) {
      const m = text.match(k.re)
      if (!m) continue
      const arvo = m[1].trim()
      osumat.set(k.nimi, (osumat.get(k.nimi) ?? 0) + 1)
      if (k.kelpaa(arvo)) kelvolliset.set(k.nimi, (kelvolliset.get(k.nimi) ?? 0) + 1)
      const lista = naytteet.get(k.nimi) ?? []
      if (lista.length < 5) {
        lista.push(`${k.kelpaa(arvo) ? "OK " : "   "} ${arvo.slice(0, 70)}`)
        naytteet.set(k.nimi, lista)
      }
    }

    for (const n of NEULAT) {
      if (n.re.test(text)) osumat.set(n.nimi, (osumat.get(n.nimi) ?? 0) + 1)
    }
  }

  const osuus = (n: number) => `${String(n).padStart(4)}  ${String(Math.round((n / docs.length) * 100)).padStart(3)} %`

  console.log("=== OTSIKOIDUT KENTAT ===")
  console.log(`  ${"kentta".padEnd(24)} otsikko loytyi     arvo kelpaa`)
  for (const k of KENTAT) {
    const n = osumat.get(k.nimi) ?? 0
    const kel = kelvolliset.get(k.nimi) ?? 0
    console.log(`  ${k.nimi.padEnd(24)} ${osuus(n)}      ${osuus(kel)}`)
    for (const s of naytteet.get(k.nimi) ?? []) console.log(`        ${s}`)
  }

  console.log("\n=== VAPAASSA TEKSTISSA ===")
  for (const n of NEULAT) {
    console.log(`  ${n.nimi.padEnd(24)} ${osuus(osumat.get(n.nimi) ?? 0)}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
