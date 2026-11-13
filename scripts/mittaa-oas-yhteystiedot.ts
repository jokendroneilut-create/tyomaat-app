import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}
/*
 * OAS:IEN YHTEYSTIEDOT, OTOS (D-414).
 *
 * Yksi OAS kustakin lahteesta (enintaan 40), jasennetaan
 * `oasYhteystiedot`illa. EI KIRJOITA MITAAN. Mittaa ennen kuin
 * yhteystietopoiminta kytketaan uuteen lahteeseen: jokainen kunta voi
 * kayttaa omaa OAS-pohjaansa.
 *
 * Mitattu 14.11.2026: 280 OAS:ia 61 lahteessa, otoksesta 40:sta
 * YHTEYSTIEDOT-luku 24:ssa, henkiloita saatiin 11:sta.
 *
 *   npx tsx scripts/mittaa-oas-yhteystiedot.ts
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { valitseOas, haeKaavanLiitteenTekstit } = await import("../lib/agent/kaavanKuvaus")
  const { oasYhteystiedot, osapuoletYhteystiedoista } = await import("../lib/agent/oasYhteystiedot")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const dokut: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db.from("source_documents").select("source_name,title,liitteet:raw_payload->attachments").not("raw_payload->attachments", "is", null).range(a, a + 999)
    if (error) throw error
    dokut.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const nahty = new Set<string>(["Huittisten vireillä olevat asemakaavat", "Hattulan vireillä olevat asemakaavat"])
  let haettu = 0, luku = 0, henkiloita = 0, kehittaja = 0
  const eiLukua: string[] = []
  for (const d of dokut) {
    if (nahty.has(d.source_name) || haettu >= 40) continue
    const linkit = (Array.isArray(d.liitteet) ? d.liitteet : []).map((a: any) => ({ href: a.url ?? a.href, teksti: a.label ?? a.teksti }))
    const oas = valitseOas(linkit)
    if (!oas) continue
    nahty.add(d.source_name); haettu += 1
    const t = (await haeKaavanLiitteenTekstit(oas))?.kaikki ?? ""
    const onLuku = /^\s*(?:\d+\.?\s+)?(YHTEYSTIEDOT|YHTEYSHENKIL[ÖO]T)\s*$/im.test(t)
    const y = oasYhteystiedot(t)
    const o = osapuoletYhteystiedoista(y)
    if (onLuku) luku += 1; else eiLukua.push(d.source_name.replace(/ vireillä olevat asemakaavat/, ""))
    henkiloita += y.length; if (o.developer) kehittaja += 1
    if (!y.length) continue
    console.log(`\n### ${d.source_name.replace(/ vireillä olevat asemakaavat/, "")} — ${String(d.title).slice(0, 50)}`)
    for (const h of y) console.log(`   ${h.name.padEnd(22)} ${String(h.title ?? "-").slice(0, 40).padEnd(42)} ${String(h.phone ?? "-").padEnd(16)} ${String(h.email ?? "-").slice(0, 34).padEnd(36)} [${h.organization ?? "-"}]`)
    if (o.developer || o.related.length) console.log(`   → rakennuttaja: ${o.developer ?? "-"}   liittyvät: ${o.related.join(" // ") || "-"}`)
  }
  console.log(`\n=== OTOS: ${haettu} OAS:ia eri lähteistä`)
  console.log(`  YHTEYSTIEDOT-luku löytyi: ${luku}   henkilöitä yhteensä: ${henkiloita}   rakennuttaja tunnistettu: ${kehittaja}`)
  console.log(`  ei lukua: ${eiLukua.join(", ")}`)
}
main()
