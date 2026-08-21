import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: onko Helsingin paatossivulla yhteyshenkilo, ja onko se
 * kaytettava?
 *
 * 512 nakyvaa helsinki_paatokset-hanketta on ilman yhteystietoa.
 * Tallennetussa tekstissa ei ole yhtaan sahkopostia eika sanaa
 * "Lisatiedot" - mutta teksti on KATKAISTU: sivulla on 22 000 merkkia,
 * kannassa 12 000. Yhteystieto voi siis olla katkaistussa osassa.
 *
 * Ei kirjoita mitaan.
 */

const SAMPLE = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 30)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

const EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractContacts } = await import("../lib/projects/contacts")

  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("projects").select("name,is_public,metadata").range(f, f + 999)
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const kohteet = rivit.filter(
    (p) =>
      p.is_public &&
      String(p.metadata?.source_name ?? "") === "helsinki_paatokset" &&
      !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length) &&
      p.metadata?.source_url
  )

  console.log(`helsinki_paatokset ilman yhteystietoa: ${kohteet.length}`)
  const otos = kohteet.slice(0, SAMPLE)
  console.log(`otos: ${otos.length}\n`)

  let haettu = 0, virhe = 0, lisatiedot = 0, kontakteja = 0, nimella = 0
  const nimikkeet = new Map<string, number>()
  const naytteet: string[] = []

  for (const p of otos) {
    try {
      const r = await fetch(String(p.metadata.source_url), { headers: { "User-Agent": UA } })
      if (!r.ok) { virhe++; continue }
      const html = await r.text()
      haettu++

      const txt = html
        .replace(/<script[\s\S]*?<\/script>/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&[a-z]+;/g, " ")
        .replace(/\s+/g, " ")

      const i = txt.search(/Lisätiedot/i)
      if (i < 0) continue
      lisatiedot++

      /* Lohko otsikon jalkeen: siina on nimi, nimike, puhelin, sposti. */
      const lohko = txt.slice(i, i + 400)
      const c = extractContacts(lohko)
      if (!c.length) continue
      kontakteja += c.length

      for (const x of c) {
        if (x.name) nimella++
        const nimike = String(x.title ?? "").toLowerCase().split(",")[0].trim()
        if (nimike) nimikkeet.set(nimike, (nimikkeet.get(nimike) ?? 0) + 1)
      }

      if (naytteet.length < 12) {
        naytteet.push(
          `  ${String(p.name).slice(0, 30).padEnd(32)} ${c
            .slice(0, 2)
            .map((x) => `${x.name ?? "-"} / ${x.title ?? "-"} / ${x.phone ?? "-"}`)
            .join("  |  ")
            .slice(0, 96)}`
        )
      }
    } catch {
      virhe++
    }
  }

  console.log(`haettu:                ${haettu}`)
  console.log(`virhe:                 ${virhe}`)
  console.log(`\n  sivulla "Lisatiedot": ${lisatiedot}   ${Math.round(lisatiedot / Math.max(1, haettu) * 100)} %`)
  console.log(`  poimittuja kontakteja: ${kontakteja}`)
  console.log(`  niista nimella:        ${nimella}`)

  if (nimikkeet.size) {
    console.log("\nyleisimmat nimikkeet:")
    for (const [k, v] of [...nimikkeet].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`  ${String(v).padStart(3)}  ${k.slice(0, 50)}`)
    }
  }
  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
