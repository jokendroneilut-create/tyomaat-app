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
 * MIKSI YHTEYSHENKILOT JAIVAT POIMIMATTA (D-329).
 *
 * Johannes 22.10.2026 Murtopera-Pysayspera-rivista: *"yhteystiedot
 * poimimatta. korjataan ja tarkista kaikki fingridin muutkin hankkeet
 * onko poimittu ja selvita syy miksi tasta ei poimittu."*
 *
 * SYY: sama "Lisatietoja"-lohko kayttaa KAHTA eri muotoa eri sivuilla,
 * ja jasennin tuntee vain toisen.
 *
 *   MUOTO A (tunnettu): yksi <p> per henkilo, nimi <strong>-elementissa
 *   omalla rivillaan, nimike toisella, puhelin kolmannella "puh."-sanan
 *   jalkeen.
 *
 *   MUOTO B (tuntematon): yksi <p>, henkilot <br>-eroteltuina, ja koko
 *   tieto samalla rivilla muodossa
 *   "Fingrid Oyj, asiantuntija, maankaytto ja ymparisto: Maria Arola,
 *   p. 030 395 5562". Puhelimen etuliite on "p." eika "puh.".
 *
 * Jasennin lukee <p>:n ensimmaisen rivin NIMEKSI, joten muodossa B
 * nimitarkistus hylkaa koko lohkon eika kukaan paady listalle.
 *
 * Tama ajo EI KIRJOITA MITAAN. Se luokittelee jokaisen sivun lohkon ja
 * kertoo paljonko henkiloita jaa saamatta.
 *
 *   npx tsx scripts/mittaa-fingridin-yhteyshenkilot.ts
 */

import * as cheerio from "cheerio"
import { jasennaYhteyshenkilot } from "../lib/agent/fetchFingridProjectsSource"

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

async function hae(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  }
}

/*
 * Lohkon muoto rivien rakenteesta. Muoto B tunnistuu kaksoispisteesta
 * ja sita seuraavasta nimesta samalla rivilla.
 */
const MUOTO_B = /:\s*[A-ZÅÄÖ][a-zåäö-]+\s+[A-ZÅÄÖ][a-zåäö-]+\s*,?\s*(?:p\.|puh\.)/

function luokitteleLohko(html: string): { muoto: string; rivit: string[] } {
  const $ = cheerio.load(html)
  let tulos = { muoto: "ei lohkoa", rivit: [] as string[] }

  $("div.well").each((_, el) => {
    const otsikko = $(el).find("h3.title").first().text().trim()
    if (!/lis[äa]tietoj/i.test(otsikko)) return

    const rivit: string[] = []
    $(el)
      .find("p")
      .each((__, pp) => {
        for (const r of ($(pp).html() ?? "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .split("\n")
          .map((x) => x.replace(/\s+/g, " ").trim())
          .filter(Boolean))
          rivit.push(r)
      })

    if (!rivit.length) {
      tulos = { muoto: "lohko tyhja", rivit }
      return
    }
    tulos = { muoto: rivit.some((r) => MUOTO_B.test(r)) ? "B" : "A", rivit }
  })

  return tulos
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* Osoitteet molemmista tauluista, duplikaatit pois. */
  const osoitteet = new Map<string, { nimi: string; kannassa: number; mista: string }>()

  for (const taulu of ["projects", "potential_projects"] as const) {
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db
        .from(taulu)
        .select(taulu === "projects" ? "name, metadata" : "title, metadata")
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      for (const r of (data ?? []) as any[]) {
        if (String(r.metadata?.source_name ?? "") !== "fingrid_hankkeet") continue
        const url = String(r.metadata?.source_url ?? "")
        if (!url) continue
        const n = Array.isArray(r.metadata?.contact_persons) ? r.metadata.contact_persons.length : 0
        const vanha = osoitteet.get(url)
        osoitteet.set(url, {
          nimi: String(r.name ?? r.title ?? ""),
          kannassa: Math.max(vanha?.kannassa ?? 0, n),
          mista: vanha ? `${vanha.mista}+${taulu}` : taulu,
        })
      }
      if ((data ?? []).length < 1000) break
    }
  }

  console.log(`Fingrid-sivuja: ${osoitteet.size}\n`)

  const laskuri = new Map<string, number>()
  let poimittuJasentimella = 0
  let saatavillaRiveja = 0
  const bSivut: { nimi: string; url: string; kannassa: number; rivit: string[] }[] = []

  for (const [url, tieto] of osoitteet) {
    const html = await hae(url)
    if (!html) {
      laskuri.set("haku ei vastannut", (laskuri.get("haku ei vastannut") ?? 0) + 1)
      continue
    }
    const { muoto, rivit } = luokitteleLohko(html)
    const poimitut = jasennaYhteyshenkilot(html)
    laskuri.set(muoto, (laskuri.get(muoto) ?? 0) + 1)
    poimittuJasentimella += poimitut.length
    saatavillaRiveja += rivit.length

    console.log(
      `   muoto ${muoto.padEnd(12)} jasennin ${String(poimitut.length).padStart(2)} | kannassa ${String(tieto.kannassa).padStart(2)} | rivia ${String(rivit.length).padStart(2)}  ${tieto.nimi.slice(0, 40)}`
    )
    if (muoto === "B") bSivut.push({ nimi: tieto.nimi, url, kannassa: tieto.kannassa, rivit })
  }

  console.log(`\nmuodot: ${[...laskuri.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}`)
  console.log(`jasennin poimii yhteensa ${poimittuJasentimella} henkiloa, lohkoissa on ${saatavillaRiveja} rivia`)

  console.log(`\n=== MUOTO B -SIVUT (${bSivut.length}) JA NIIDEN RIVIT ===`)
  for (const s of bSivut) {
    console.log(`\n   ${s.nimi.slice(0, 50)}  (kannassa ${s.kannassa})`)
    for (const r of s.rivit) console.log(`      "${r.slice(0, 120)}"`)
  }
  console.log("\nEi kirjoitettu mitaan.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
