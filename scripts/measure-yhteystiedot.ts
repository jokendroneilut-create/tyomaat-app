import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YHTEYSTIETOJEN KATTAVUUS ASIAKKAALLE NÄKYVISSÄ HANKKEISSA.
 *
 * Asiakas näkee yhteystiedot vain `metadata.contact_persons`-kentästä
 * (hankelista ja Tänään-modaali). Mittaa kattavuuden lähteittäin,
 * vaiheittain ja arvoluokittain sekä kuvaustekstiin jääneen potentiaalin
 * (`extractContacts`), jota ei ole nostettu kenttään.
 *
 *   npx tsx scripts/measure-yhteystiedot.ts
 */
async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractContacts } = await import("../lib/projects/contacts")
  const { normalizeLegacyPhase } = await import("../lib/projects/phases")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("id, name, phase, status, is_public, additional_info, created_at, metadata").eq("is_public", true).range(from, from + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }
  const aktiiviset = rivit.filter((r) => r.status !== "expired" && r.status !== "archived" && normalizeLegacyPhase(r.phase) !== "completed")

  const luokka = (r: any) => {
    const c: any[] = Array.isArray(r.metadata?.contact_persons) ? r.metadata.contact_persons : []
    const kelpo = c.filter((x) => x && (x.email || x.phone))
    if (!kelpo.length) return "ei"
    const henkilo = kelpo.some((x) => x.kind !== "organization" && x.name)
    return henkilo ? "henkilö" : "vain org"
  }
  const potentiaali = (r: any) => {
    if (luokka(r) !== "ei") return false
    const teksti = [r.metadata?.description, r.additional_info].filter(Boolean).join("\n")
    return extractContacts(teksti).some((c: any) => c.kind === "person" && !c.authority)
  }

  const yht = (joukko: any[], otsikko: string) => {
    const n = joukko.length || 1
    const h = joukko.filter((r) => luokka(r) === "henkilö").length
    const o = joukko.filter((r) => luokka(r) === "vain org").length
    const p = joukko.filter(potentiaali).length
    console.log(`${otsikko.padEnd(34)} ${String(joukko.length).padStart(5)}  henkilö ${String(h).padStart(5)} (${((h / n) * 100).toFixed(1)}%)  vain org ${String(o).padStart(4)}  ei mitään ${String(joukko.length - h - o).padStart(5)} (${(((joukko.length - h - o) / n) * 100).toFixed(1)}%)  tekstissä poimimatta ${p}`)
  }

  console.log("=== KOKONAISUUS ===")
  yht(rivit, "kaikki julkiset")
  yht(aktiiviset, "aktiiviset (ei valmis/vanhentunut)")
  const tuoreet = aktiiviset.filter((r) => Date.now() - Date.parse(r.created_at) < 30 * 86400000)
  yht(tuoreet, "aktiiviset, lisätty 30 pv")

  console.log("\n=== ARVOLUOKITTAIN (aktiiviset) ===")
  for (const v of ["high", "medium", "low"]) yht(aktiiviset.filter((r) => r.metadata?.business_value === v), `business_value ${v}`)

  console.log("\n=== VAIHEITTAIN (aktiiviset) ===")
  const vaiheet = new Map<string, any[]>()
  for (const r of aktiiviset) { const k = normalizeLegacyPhase(r.phase) ?? String(r.phase); if (!vaiheet.has(k)) vaiheet.set(k, []); vaiheet.get(k)!.push(r) }
  for (const [k, v] of [...vaiheet].sort((a, b) => b[1].length - a[1].length)) yht(v, k)

  console.log("\n=== LÄHTEITTÄIN, 25 suurinta (aktiiviset) ===")
  const lahteet = new Map<string, any[]>()
  for (const r of aktiiviset) { const k = String(r.metadata?.source_name ?? "(ei lähdettä)"); if (!lahteet.has(k)) lahteet.set(k, []); lahteet.get(k)!.push(r) }
  for (const [k, v] of [...lahteet].sort((a, b) => b[1].length - a[1].length).slice(0, 25)) yht(v, k.slice(0, 34))
  const kaava = aktiiviset.filter((r) => /kaav|planl|detaljplan/i.test(r.metadata?.source_name ?? ""))
  console.log("")
  yht(kaava, "KAIKKI kaavalähteet yhteensä")
}
main().catch((e) => { console.error(e); process.exit(1) })
