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
 * MIKSI JONOSSA ON RIVEJA JOTKA OVAT JO KANNASSA?
 *
 * Johannes 3.10.2026: *"minusta olisi huomattavasti jarkevampaa tehda
 * tuo duplikaattiskannaus jo tuodessa."*
 *
 * Putki TEKEE tasmayksen tuonnissa (`resolvePotentialProject` ->
 * `findProjectMatchDetailed`, >=70 yhdistaa). Siksi >=70 osuma jonossa
 * on ristiriita, ja sille on vain kaksi mahdollista selitysta:
 *
 *   A) Hanke EI OLLUT OLEMASSA kun jonorivi luotiin. Rivi oli oikein
 *      silloin ja vanheni myohemmin, kun sama hanke hyvaksyttiin
 *      toisesta ehdokkaasta. Korjaus ei ole tuonnissa vaan jonon
 *      uudelleentarkistuksessa.
 *
 *   B) Hanke OLI olemassa eika tasmays loytanyt sita. Silloin vika on
 *      tuonnin tasmayksessa.
 *
 * Ero ratkaisee mihin korjaus kuuluu, eika sita voi paatella muuten
 * kuin vertaamalla luontihetkia.
 *
 *   npx tsx scripts/measure-jonon-duplikaattien-synty.ts
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const jono: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("potential_projects").select("*").eq("status", "new").order("id").range(from, from + 999)
    if (error) throw error
    jono.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("*").eq("status", "active").order("id").range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const osumat = jono
    .map((p) => ({
      p,
      osuma: findProjectMatchDetailed(hankkeet as any, {
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
      }),
    }))
    .filter((r) => r.osuma && (r.osuma.confidence ?? 0) >= 70)
    .sort((a, b) => (b.osuma!.confidence ?? 0) - (a.osuma!.confidence ?? 0))

  console.log(`jonossa ${jono.length}, joista >=70 osuma: ${osumat.length}\n`)

  let aVanhentunut = 0
  let bTasmaysPetti = 0

  for (const { p, osuma } of osumat) {
    const hanke = osuma!.project as any
    const jonoLuotu = String(p.created_at).slice(0, 10)
    const hankeLuotu = String(hanke.created_at ?? "").slice(0, 10)
    const hankeOliJo = hankeLuotu && hankeLuotu <= jonoLuotu

    if (hankeOliJo) bTasmaysPetti++
    else aVanhentunut++

    console.log("=".repeat(96))
    console.log(`${Math.round(osuma!.confidence)}  ${hankeOliJo ? "B) HANKE OLI JO -> tasmays petti" : "A) HANKE SYNTYI VASTA MYOHEMMIN -> jonorivi vanheni"}`)
    console.log(`  JONO  ${jonoLuotu}  ${String(p.title).replace(/\s+/g, " ").slice(0, 74)}`)
    console.log(`        ${p.municipality ?? "-"} | ${p.address ?? "-"} | ${p.metadata?.source_name ?? p.metadata?.source ?? "-"}`)
    console.log(`  HANKE ${hankeLuotu}  ${String(hanke.name).replace(/​/g, "").replace(/\s+/g, " ").slice(0, 74)}`)
    console.log(`        ${hanke.city ?? "-"} | ${hanke.phase} | julkinen=${hanke.is_public}`)
    console.log(`  syyt  ${(osuma!.reasons ?? []).join(", ").slice(0, 86)}`)
    console.log(`  jono  https://app.tyomaat.fi/tic/projects/${p.id}`)
  }

  console.log("\n" + "=".repeat(96))
  console.log(`A) jonorivi vanheni (hanke syntyi myohemmin): ${aVanhentunut}`)
  console.log(`B) tasmays petti tuonnissa (hanke oli jo):    ${bTasmaysPetti}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
