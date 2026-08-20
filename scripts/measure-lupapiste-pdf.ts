import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: saako Lupapisteen kuulutuksen PDF:n, ja mita siina on?
 *
 * Kuulutus poistuu verkosta muutoksenhakuajan paatyttya ("Julkaisu poistuu
 * verkosta"), joten teksti on otettava talteen silloin kun se on saatavilla.
 * Tama skripti mittaa kuinka monelta tallennetulta kuulutukselta PDF viela
 * irtoaa ja kuinka paljon se tuo lisatietoa lyhyeen toimenpidetekstiin
 * verrattuna.
 *
 * Ei kirjoita mitaan.
 */

const SAMPLE = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 25)
const BULLETINS_PAGE = "https://julkipano.lupapiste.fi/app/fi/bulletins"

async function csrf() {
  const r = await fetch(BULLETINS_PAGE, { cache: "no-store" })
  const m = (r.headers.get("set-cookie") ?? "").match(/anti-csrf-token=([^;]+)/)
  if (!m) throw new Error("CSRF-tokenia ei saatu")
  return { token: decodeURIComponent(m[1]), cookie: `anti-csrf-token=${m[1]}` }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { default: pdfParse } = await import("pdf-parse/lib/pdf-parse.js")
  const { cleanBulletinPdfText, extractApplicationDescription } = await import("../lib/agent/lupapisteBulletinPdf")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const docs: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("source_documents")
      .select("id, title, created_at, raw_payload")
      .eq("source_name", "Lupapiste kuulutukset")
      .order("created_at", { ascending: false })
      .range(from, from + 999)
    if (error) throw error
    docs.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  console.log(`Lupapiste-dokumentteja kannassa: ${docs.length}`)

  /* Otos tasavalein vanhimmasta uusimpaan, jotta ikavaikutus nakyy. */
  const step = Math.max(1, Math.floor(docs.length / SAMPLE))
  const sample = docs.filter((_, i) => i % step === 0).slice(0, SAMPLE)
  console.log(`otos: ${sample.length}\n`)

  const { token, cookie } = await csrf()

  let ok = 0, puuttuu = 0, virhe = 0
  let kuvausLoytyi = 0
  let kuvauksia = 0
  const pituudet: number[] = []
  const esimerkit: string[] = []

  for (const d of sample) {
    const bulletinId = String(d.raw_payload?.original?.id ?? "")
    const lyhyt = String(d.raw_payload?.original?.bulletinOpDescription ?? "")
    if (!bulletinId) { virhe++; continue }

    try {
      const res = await fetch(
        `https://julkipano.lupapiste.fi/api/raw/download-bulletin-doc?bulletinId=${encodeURIComponent(bulletinId)}`,
        { headers: { "x-anti-forgery-token": token, cookie }, cache: "no-store" }
      )
      const buf = Buffer.from(await res.arrayBuffer())
      if (!res.ok || buf.slice(0, 4).toString("latin1") !== "%PDF") { puuttuu++; continue }

      const { text } = await pdfParse(buf)
      const teksti = cleanBulletinPdfText(String(text ?? ""))
      const kuvaus = extractApplicationDescription(teksti)
      if (kuvaus) kuvauksia++
      ok++
      pituudet.push(teksti.length)
      if (/Hankkeen kuvaus/i.test(teksti)) kuvausLoytyi++

      if (esimerkit.length < 8) {
        esimerkit.push(
          `  ${String(d.created_at).slice(0, 10)}  pdf ${String(teksti.length).padStart(5)}  lyhyt ${String(lyhyt.length).padStart(4)}  kuvaus ${String(kuvaus?.length ?? 0).padStart(5)}  ${String(d.title).slice(0, 34)}
        ${(kuvaus ?? "(ei poimintaa)").slice(0, 110)}`
        )
      }
    } catch {
      virhe++
    }
  }

  const ka = pituudet.length ? Math.round(pituudet.reduce((a, b) => a + b, 0) / pituudet.length) : 0
  console.log(`pdf saatiin:          ${ok}`)
  console.log(`  sisaltaa "Hankkeen kuvaus": ${kuvausLoytyi}`)
  console.log(`  tekstia keskimaarin:       ${ka} merkkia`)
  console.log(`  hankekuvaus poimittiin:    ${kuvauksia}`)
  console.log(`pdf ei saatavilla:    ${puuttuu}`)
  console.log(`virhe:                ${virhe}`)
  console.log("\nesimerkkeja:")
  for (const e of esimerkit) console.log(e)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
