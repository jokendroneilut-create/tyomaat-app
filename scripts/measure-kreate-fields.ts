import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: mita Kreaten lahteesta jaa poimimatta?
 *
 * Hanke "Uusi Mahkonsilta..." nayttaa sivulla vain otsikon (70 merkkia)
 * eika arvioitua valmistumista lainkaan, vaikka lahdetekstissa lukee
 * "Uusi Lieksanjoen ylittava silta otetaan kayttoon viimeistaan
 * marraskuun lopussa 2026".
 *
 * Sisalto ON jo kannassa: collector tallentaa koko WordPress-postin
 * raw_payload.original-kenttaan. Resolveri ei vain lue sita.
 *
 * VAROITUS SAANNOLLISISTA LAUSEKKEISTA: alkuperainen versio kaytti
 * hahmoa /[^.]*(valmistu)[^.]*\./ lauseen poimintaan. Se rajahtaa
 * takaisinperaytymiseen pitkassa tekstissa - ajo jumittui yli 5
 * minuutiksi. Teksti pilkotaan nyt lauseiksi ENSIN, ja hahmoja
 * sovelletaan vain lyhyeen lauseeseen.
 *
 * Ei kirjoita mitaan.
 */

function htmlToText(html: string): string {
  return String(html ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&#039;|&#8216;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

const lauseet = (t: string) => t.split(". ").map((s) => s.trim()).filter(Boolean)

/* Infrassa valmistuminen sanotaan usein muuten kuin "valmistuu". */
const LISAHAHMO = /(otetaan\s+k[aä]ytt[oö][oö]n|avataan\s+liikenteelle|luovutetaan)/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { parseEstimatedCompletionDate } = await import("../lib/agent/parseFinnishCompletionDate")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id,title,raw_payload")
      .ilike("source_name", "%kreate%")
      .range(f, f + 999)
    if (error) throw error
    docs.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  console.log(`Kreate-lahdedokumentteja: ${docs.length}\n`)

  let onSisalto = 0, onPaiva = 0
  const pituudet: number[] = []
  const osumat: string[] = []
  const laajennus: string[] = []

  for (const d of docs) {
    const teksti = htmlToText(d.raw_payload?.original?.content?.rendered ?? "")
    if (!teksti) continue
    onSisalto++
    pituudet.push(teksti.length)

    const pvm = parseEstimatedCompletionDate(teksti)
    const nimi = String(d.title).slice(0, 30).padEnd(32)

    if (pvm) {
      onPaiva++
      const l = lauseet(teksti).find((s) => /valmistu/i.test(s)) ?? ""
      if (osumat.length < 8) osumat.push(`  ${pvm}  ${nimi} "${l.slice(0, 74)}"`)
    } else {
      const l = lauseet(teksti).find((s) => LISAHAHMO.test(s))
      if (l) laajennus.push(`  ${nimi} "${l.slice(0, 92)}"`)
    }
  }

  pituudet.sort((a, b) => a - b)
  console.log(`sisaltoteksti tallessa:  ${onSisalto} / ${docs.length}`)
  console.log(`  mediaani:              ${pituudet[Math.floor(pituudet.length / 2)] ?? 0} merkkia`)
  console.log(`  lyhin / pisin:         ${pituudet[0] ?? 0} / ${pituudet[pituudet.length - 1] ?? 0}`)
  console.log(`valmistumisaika nyt:     ${onPaiva} / ${onSisalto}  (${Math.round(onPaiva / Math.max(1, onSisalto) * 100)} %)\n`)

  console.log("nykyiset osumat:")
  for (const o of osumat) console.log(o)

  console.log(`\nLAAJENNUSEHDOKKAAT (ei nykyosumaa, mutta lause loytyy): ${laajennus.length}`)
  for (const l of laajennus) console.log(l)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
