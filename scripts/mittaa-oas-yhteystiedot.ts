import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * OAS:IEN YHTEYSTIEDOT, MITTAUS (D-414, D-415).
 *
 * EI KIRJOITA MITAAN. Mittaa ennen kuin yhteystietopoiminta kytketaan
 * uuteen lahteeseen: jokainen kunta voi kayttaa omaa OAS-pohjaansa.
 *
 *   npx tsx scripts/mittaa-oas-yhteystiedot.ts                 otos, 1 per lahde
 *   npx tsx scripts/mittaa-oas-yhteystiedot.ts --lahde="X"     lahteen kaikki OAS:t
 *
 * Lahdetilassa tulostetaan jokaisesta dokumentista jasennetyt henkilot,
 * ja jos YHTEYSTIEDOT-luku loytyy mutta henkiloita ei, luvun RAAKATEKSTI:
 * siita nakee suoraan mika pohja puuttuu.
 *
 * Mitattu 14.11.2026: 280 OAS:ia 61 lahteessa; otoksesta 40:sta luku
 * 24:ssa, henkiloita saatiin 11:sta.
 */

const LAHTEET = process.argv.filter((a) => a.startsWith("--lahde=")).map((a) => a.slice(8))
const OTSIKKO = /^\s*(?:\d+\.?\s+)?(YHTEYSTIEDOT|YHTEYSHENKIL[ÖO]T|LIS[ÄA]TIETOJA)\s*:?\s*$/im

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { valitseOas, haeKaavanLiitteenTekstit } = await import("../lib/agent/kaavanKuvaus")
  const { oasYhteystiedot, osapuoletYhteystiedoista } = await import("../lib/agent/oasYhteystiedot")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  let kysely = db.from("source_documents").select("source_name,title,liitteet:raw_payload->attachments").not("raw_payload->attachments", "is", null)
  if (LAHTEET.length) kysely = kysely.in("source_name", LAHTEET)
  const { data: dokut, error } = await kysely.limit(2000)
  if (error) throw error

  const nahty = new Set<string>()
  let haettu = 0, luku = 0, henkiloita = 0, dokuHenkiloilla = 0, kehittaja = 0

  for (const d of (dokut ?? []) as any[]) {
    if (!LAHTEET.length && (nahty.has(d.source_name) || haettu >= 40)) continue
    const linkit = (Array.isArray(d.liitteet) ? d.liitteet : []).map((a: any) => ({ href: a.url ?? a.href, teksti: a.label ?? a.teksti }))
    const oas = valitseOas(linkit)
    if (!oas) continue
    nahty.add(d.source_name); haettu += 1

    const t = (await haeKaavanLiitteenTekstit(oas))?.kaikki ?? ""
    const onLuku = OTSIKKO.test(t)
    const y = oasYhteystiedot(t)
    const o = osapuoletYhteystiedoista(y)
    if (onLuku) luku += 1
    henkiloita += y.length
    if (y.length) dokuHenkiloilla += 1
    if (o.developer) kehittaja += 1

    console.log(`\n### [${d.source_name.replace(/ vireillä olevat asemakaavat/, "")}] ${String(d.title).slice(0, 60)}`)
    console.log(`    ${oas.split("/").pop()?.slice(0, 80)}   luku: ${onLuku ? "kyllä" : "EI"}   tekstiä ${t.length}`)
    for (const h of y) {
      console.log(`    ${h.name.padEnd(22)} ${String(h.title ?? "-").slice(0, 42).padEnd(44)} ${String(h.phone ?? "-").padEnd(16)} ${String(h.email ?? "-").slice(0, 34).padEnd(36)} [${h.organization ?? "-"}]`)
    }
    if (o.developer || o.related.length) console.log(`    → rakennuttaja: ${o.developer ?? "-"}   liittyvät: ${o.related.join(" // ") || "-"}`)

    /* Luku loytyi mutta ketaan ei saatu: nayta raakateksti. */
    if (LAHTEET.length && onLuku && !y.length) {
      const rivit = t.split("\n")
      let i = -1
      rivit.forEach((r, j) => { if (OTSIKKO.test(r)) i = j })
      console.log("    --- RAAKA ---")
      for (const r of rivit.slice(i, i + 32)) console.log("    | " + r)
    }
  }

  console.log(`\n=== ${haettu} OAS:ia   luku: ${luku}   henkilöitä saatiin: ${dokuHenkiloilla} dokumentista (${henkiloita})   rakennuttaja: ${kehittaja}`)
}
main()
