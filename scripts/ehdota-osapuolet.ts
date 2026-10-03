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
 * KUIVAHARJOITUS: OSAPUOLI HANKKEEN OMASTA TEKSTISTA (D-233).
 *
 * Johannes 3.10.2026: *"tee kuivaharjoitus noille 49:lle."*
 *
 * Tulostaa jokaiselta rivilta TODISTEEN eli sen lauseen josta nimi
 * loytyi. Rivi on luettava yksitellen: mittari kertoo vain etta nimi
 * osui, ei etta se on oikea osapuoli.
 *
 * EI KIRJOITA MITAAN.
 *
 *   npx tsx scripts/ehdota-osapuolet.ts
 */

const VAIHEET = ["Suunnittelussa", "Suunnittelu", "Rakenteilla", "Rakentaminen aloitettu"]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { osapuoletTekstista, kelpaakoNimi } = await import("../lib/agent/osapuoliTekstista")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kaikki: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, phase, status, is_public, developer, builder, additional_info, source_name:metadata->>source_name")
      .range(from, from + 999)
    if (error) throw error
    kaikki.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const onOsapuoli = (p: any) => Boolean(String(p.developer ?? "").trim() || String(p.builder ?? "").trim())
  const jono = kaikki.filter(
    (p) => p.status === "active" && p.is_public === true && !onOsapuoli(p) && VAIHEET.includes(String(p.phase))
  )

  /*
   * Haettavat nimet ovat kannassa jo osapuolena olevia. Mukaan otetaan
   * myos yhtiomuodoton muoto ja lyhenne, koska teksti kayttaa niita:
   * kentassa on "NCC Suomi Oy", tekstissa lukee "NCC".
   */
  const nimet = new Set<string>()
  for (const p of kaikki) {
    for (const kentta of [p.developer, p.builder]) {
      const raaka = String(kentta ?? "").trim()
      if (!raaka) continue
      /*
       * KENTTA VOI OLLA LISTA. Mitattu 3.10.2026: urakoitsijakentassa on
       * arvoja kuten "Are Oy (0989493-6), ISS Palvelut Oy (0906333-1)".
       * Ilman pilkun ja y-tunnuksen purkua "Are" ei ollut haettavien
       * nimien joukossa lainkaan — eli juuri sen lahteen yritys jonka
       * tiedotteesta hanke tuli.
       */
      for (const osa of raaka.split(",")) {
        const v = osa.replace(/\([^)]*\)/g, "").trim()
        if (v.length < 3) continue
        nimet.add(v)
        const ilman = v.replace(/\s+(oy|oyj|ab|ky|ltd)\.?$/i, "").trim()
        if (ilman.length >= 3) nimet.add(ilman)
        const eka = ilman.split(/\s+/)[0]
        if (eka.length >= 3 && eka === eka.toUpperCase()) nimet.add(eka)
      }
    }
  }
  const haettavat = [...nimet].filter(kelpaakoNimi).sort((a, b) => b.length - a.length)

  console.log("=== KUIVAHARJOITUS: osapuoli hankkeen omasta tekstista ===")
  console.log(`osapuolettomia jonossa ${jono.length}, haettavia nimia ${haettavat.length}\n`)

  let rooliTiedossa = 0
  let rooliAuki = 0
  let eiOsumaa = 0
  const rivit: string[] = []

  for (const p of jono) {
    const teksti = `${p.name ?? ""}. ${p.additional_info ?? ""}`
    const loydot = osapuoletTekstista(teksti, haettavat)
    if (!loydot.length) {
      eiOsumaa++
      continue
    }

    rivit.push("=".repeat(104))
    rivit.push(`${String(p.name).slice(0, 72)}`)
    rivit.push(`  ${String(p.city ?? "-")} · ${p.phase} · lahde ${p.source_name ?? "-"}`)
    for (const l of loydot) {
      const rooli = l.rooli === "builder" ? "URAKOITSIJA" : l.rooli === "developer" ? "RAKENNUTTAJA" : "ROOLI AUKI "
      if (l.rooli) rooliTiedossa++
      else rooliAuki++
      rivit.push(`  ${rooli}  ${l.nimi}`)
      rivit.push(`     todiste: ${l.lause.slice(0, 150)}`)
    }
    rivit.push("")
  }

  console.log(rivit.join("\n"))
  console.log("=".repeat(104))
  console.log(`\nhankkeita joilta loytyi nimi: ${jono.length - eiOsumaa}/${jono.length}`)
  console.log(`  rooli luettavissa tekstista: ${rooliTiedossa} nimea`)
  console.log(`  rooli jaa auki:              ${rooliAuki} nimea`)
  console.log(`hankkeita ilman osumaa:        ${eiOsumaa}`)
  console.log("\nEi kirjoitettu mitaan.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
