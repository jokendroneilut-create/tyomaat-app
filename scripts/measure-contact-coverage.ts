import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: kuinka moni ASIAKKAILLE NAKYVA hanke on ilman yhteystietoa?
 *
 * Tavoite (00_PRODUCT_BLUEPRINT.md 1.1): jokaisella nakyvalla hankkeella
 * on oltava vahintaan yksi yhteystieto. Tama skripti mittaa puutteen ja
 * erittelee sen lahteittain, jotta tyo voidaan kohdistaa.
 *
 * Ei kirjoita mitaan.
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { hasPersonContact } = await import("../lib/projects/contacts")

  const s = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await s
      .from("projects")
      .select("id,name,city,phase,is_public,developer,builder,additional_info,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const nakyvat = rivit.filter((p) => p.is_public)
  const kontaktit = (p: any) =>
    Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []

  const onKontakti = nakyvat.filter((p) => kontaktit(p).length > 0)
  const onHenkilo = nakyvat.filter((p) => hasPersonContact(kontaktit(p) as any))
  const onPuhelinTaiSposti = nakyvat.filter((p) =>
    kontaktit(p).some((c: any) => c?.email || c?.phone)
  )
  const puuttuu = nakyvat.filter((p) => kontaktit(p).length === 0)

  const os = (n: number) => `${String(n).padStart(5)}   ${String(Math.round((n / nakyvat.length) * 1000) / 10).padStart(5)} %`

  console.log(`kaikkia hankkeita:            ${rivit.length}`)
  console.log(`ASIAKKAILLE NAKYVIA:          ${nakyvat.length}\n`)
  console.log(`  ainakin yksi yhteystieto:   ${os(onKontakti.length)}`)
  console.log(`  siita tavoitettava (sposti tai puh): ${os(onPuhelinTaiSposti.length)}`)
  console.log(`  nimetty henkilo:            ${os(onHenkilo.length)}`)
  console.log(`\n  EI YHTAAN YHTEYSTIETOA:     ${os(puuttuu.length)}   <- tavoitteen puute`)

  /* Mista puuttuvat tulevat? Tyo kannattaa kohdistaa isoimpiin. */
  const lahteet = new Map<string, number>()
  for (const p of puuttuu) {
    const l = String(p.metadata?.source_name ?? "(kasin)")
    lahteet.set(l, (lahteet.get(l) ?? 0) + 1)
  }
  console.log("\npuuttuvat lahteittain:")
  for (const [k, v] of [...lahteet].sort((a, b) => b[1] - a[1]).slice(0, 18)) {
    console.log(`  ${String(v).padStart(5)}   ${String(Math.round((v / puuttuu.length) * 100)).padStart(3)} %   ${k}`)
  }

  /* Onko puuttuvilla edes tekstia josta poimia? */
  const ilmanTekstia = puuttuu.filter(
    (p) => !String(p.metadata?.description ?? "").trim() && !String(p.additional_info ?? "").trim()
  )
  const onOsapuoli = puuttuu.filter((p) => p.developer || p.builder)
  console.log(`\npuuttuvista:`)
  console.log(`  ei kuvausta eika lisatietoja: ${ilmanTekstia.length}  (naista ei voi poimia mitaan)`)
  console.log(`  osapuoli tiedossa:            ${onOsapuoli.length}  (yritys tiedossa, henkilo ei)`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
