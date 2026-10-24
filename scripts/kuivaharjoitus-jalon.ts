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
 * JALONIN TYOMAALUETTELO: KUIVAHARJOITUS (D-350).
 *
 * Ajaa keraajan oikeaa sivua vasten ja nayttaa jokaisen ehdokkaan
 * kenttineen seka sen, onko kohde jo kannassa. Ei kirjoita mitaan.
 *
 *   npx tsx scripts/kuivaharjoitus-jalon.ts
 */

import { fetchJalonSource } from "../lib/agent/fetchJalonSource"

/* Loysa vertailu: pelkka nimen runko, jotta osuma loytyy myos eri otsikolla. */
function runko(teksti: string): string {
  return String(teksti ?? "")
    .toLowerCase()
    .replace(/[^\wåäö]+/g, " ")
    .trim()
}

async function main() {
  const alkoi = Date.now()
  const ehdokkaat: any[] = await fetchJalonSource()
  console.log(`Haku ${((Date.now() - alkoi) / 1000).toFixed(1)} s, ehdokkaita ${ehdokkaat.length}\n`)

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,phase,developer,builder,location,metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const jono: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data } = await db.from("potential_projects").select("id,title,status,municipality").range(a, a + 999)
    jono.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`(verrattu ${hankkeet.length} hankkeeseen ja ${jono.length} jonoriviin)\n`)

  let uusia = 0
  for (const e of ehdokkaat) {
    /*
     * VERTAILU VAIN NIMEN RUNGOLLA TAI OSOITTEELLA.
     *
     * Ensimmainen versio hyvaksyi osuman jos YKSI yli viisikirjaiminen
     * sana loytyi samasta kaupungista: silloin "S-Market Peltola"
     * vastasi "K-Supermarketin maanrakennus- ja paikallavalu-urakkaa"
     * ja "S-Market Pihtipudas" tuulivoimapuistoa. Loysa vertailu ei
     * kerro mitaan -- se vain nayttaa kaiken jo tehdyksi.
     */
    const r = runko(e.name)
    const katu = e.location ? runko(String(e.location).split(",")[0]) : null
    /*
     * Lyhyt runko ei kelpaa kumpaankaan suuntaan: "Päiväkoti" sisaltyy
     * melkein mihin tahansa, ja tyhja otsikko ("-") sisaltyy KAIKKEEN,
     * jolloin jokainen ehdokas nayttaa jo olevan jonossa.
     */
    const vertaa = (a: string, b: string) =>
      a.length >= 12 && b.length >= 12 && (a.includes(b) || b.includes(a))
    const osuma =
      hankkeet.find((h) => vertaa(r, runko(h.name))) ??
      (katu && katu.length >= 8
        ? hankkeet.find((h) => h.city === e.city && runko(`${h.location ?? ""} ${h.name}`).includes(katu))
        : null) ??
      null
    const jonossa = jono.find((j) => {
      const t = runko(j.title)
      return vertaa(r, t) || (katu != null && katu.length >= 8 && t.includes(katu))
    })

    console.log(`${e.name}`)
    console.log(`   ${String(e.city ?? "?").padEnd(14)} ${e.phase} | valmistuu ${e.estimated_completion ?? "-"}`)
    console.log(`   tilaaja ${e.developer ?? "-"} | rakentaja ${e.builder}`)
    console.log(`   osoite: ${e.location ?? "-"}`)
    console.log(`   puhelin: ${e.metadata.contact_persons[0]?.phone ?? "-"}  tyyppi: ${e.property_type ?? "-"}`)
    if (osuma) {
      console.log(`   JO KANNASSA: ${String(osuma.name).slice(0, 48)} (${osuma.city}, ${osuma.phase}, rakentaja ${osuma.builder ?? "-"})`)
    } else if (jonossa) {
      console.log(`   JONOSSA: ${String(jonossa.title).slice(0, 48)} (${jonossa.status})`)
    } else {
      console.log(`   UUSI`)
      uusia += 1
    }
    console.log(`   kuvaus (${e.description.length} merkkiä): ${e.description.slice(0, 120)}...`)
    console.log()
  }

  console.log(`Uusia hankkeita: ${uusia} / ${ehdokkaat.length}`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
