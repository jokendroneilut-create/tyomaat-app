import { readFileSync, writeFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * URAKOITSIJA JA KUSTANNUS VAYLAN KENTTALOHKOSTA (D-377).
 *
 * Johannes 7.11.2026 avattuaan Kirjalansalmen lahteen: *"kreate puuttuu
 * seka kustannusarvio."* Sivulla lukee "Urakoitsija: Kreate Oy" ja
 * "Kustannukset: 128 miljoonaa euroa", eika `fetchVaylaProjectDetails`
 * lukenut sita lohkoa lainkaan.
 *
 * LOHKO ON HARVINAINEN: tasavalinen 24 sivun otos antoi 2 osumaa.
 * Tama ajo kay silti kaikki lapi, koska otos ei kerro MITKA sivut --
 * ja juuri isot nimetyt hankkeet ovat arvokkaimpia.
 *
 * VAIN TYHJA TAYTETAAN. Kasin annettu urakoitsija tai kustannus ei saa
 * havita ([[manual-parties-linkedin]]).
 *
 * TILAAJAA EI KIRJOITETA. Se on naissa aina "Vaylavirasto", mika on jo
 * `developer`-kentassa -- kirjoittaminen vain lisaisi riskia ilman
 * hyotya.
 *
 *   npx tsx scripts/taydenna-vaylan-kenttalohko.ts
 *   npx tsx scripts/taydenna-vaylan-kenttalohko.ts --apply
 */
import { parseVaylaInfoFields, vaylanUrakoitsijat } from "../lib/agent/vaylaInfoFields"

const APPLY = process.argv.includes("--apply")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
/*
 * HITAASTI JA UUDELLEEN. Ensimmainen ajo viidella rinnakkaisella
 * epaonnistui 107 kertaa 272:sta (39 %). Joka kolmas sivu tuskin on
 * poissa -- kyse on kuristuksesta, ja epaonnistunut haku nayttaisi
 * samalta kuin puuttuva lohko ([[failed-fetch-burns-budget]]).
 */
const RINNAKKAIN = 2
const TAUKO_MS = 350
const YRITYKSET = 3
const TUNNISTE = "vaylan_kenttalohko_2026_11"
const RAPORTTI = "C:/Users/johan/tyomaat-app/.tmp-vayla-kenttalohko.txt"

async function hae(url: string): Promise<string | null> {
  try {
    const ohjain = new AbortController()
    const kello = setTimeout(() => ohjain.abort(), 25_000)
    const r = await fetch(url, { cache: "no-store", headers: { "user-agent": UA }, signal: ohjain.signal })
    clearTimeout(kello)
    return r.ok ? await r.text() : null
  } catch {
    return null
  }
}

async function haeYrittaen(url: string): Promise<string | null> {
  for (let i = 0; i < YRITYKSET; i++) {
    const teksti = await hae(url)
    if (teksti !== null) return teksti
    await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
  }
  return null
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,builder,estimated_cost,is_public,status,metadata")
      .range(a, a + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const jono = hankkeet.filter(
    (h) =>
      h.is_public &&
      h.status === "active" &&
      /(^|\/\/)(www\.)?vayla\.fi/.test(String(h.metadata?.source_url ?? ""))
  )
  console.log(`vayla.fi-osoitteellisia hankkeita ${jono.length}\n`)

  const rivit: string[] = []
  let lohkollisia = 0
  let urakoitsijaUusi = 0
  let kustannusUusi = 0
  let haku = 0
  const tyojono = [...jono]

  await Promise.all(
    Array.from({ length: RINNAKKAIN }, async () => {
      while (tyojono.length) {
        const h = tyojono.shift()
        if (!h) break
        await new Promise((r) => setTimeout(r, TAUKO_MS))
        const html = await haeYrittaen(String(h.metadata.source_url))
        if (html === null) {
          haku++
          continue
        }
        const k = parseVaylaInfoFields(html)
        if (!k.urakoitsija && !k.kustannusEur) continue
        lohkollisia++

        const tyhjaUrakoitsija = !String(h.builder ?? "").trim()
        const tyhjaKustannus = !h.estimated_cost
        /* Kuntalista ja tilakuvaus karsiutuvat; kaksi nimea erotellaan //:lla. */
        const urakoitsijat = vaylanUrakoitsijat(k.urakoitsija)
        const lisaaUrakoitsija = tyhjaUrakoitsija && urakoitsijat.length > 0
        const lisaaKustannus = tyhjaKustannus && k.kustannusEur

        if (lisaaUrakoitsija) urakoitsijaUusi++
        if (lisaaKustannus) kustannusUusi++

        const merkki = lisaaUrakoitsija || lisaaKustannus ? (APPLY ? "KIRJOITA" : "(kuiva) ") : "on jo   "
        const rivi =
          `${merkki} ${String(h.name).slice(0, 40).padEnd(40)} | ` +
          `urakoitsija ${String(urakoitsijat.join(" // ") || (k.urakoitsija ? `HYLATTY: ${k.urakoitsija}` : "-")).slice(0, 34).padEnd(34)}${tyhjaUrakoitsija ? "" : ` (meilla: ${h.builder})`} | ` +
          `kustannus ${k.kustannusEur ?? "-"}${tyhjaKustannus ? "" : ` (meilla: ${h.estimated_cost})`}`
        console.log(rivi)
        rivit.push(`${h.id}\t${h.name}\t${k.urakoitsija ?? ""}\t${k.kustannusteksti ?? ""}\t${k.kustannusEur ?? ""}\t${h.builder ?? ""}\t${h.estimated_cost ?? ""}`)

        if (!APPLY || (!lisaaUrakoitsija && !lisaaKustannus)) continue

        const md = {
          ...(h.metadata ?? {}),
          field_sources: {
            ...(h.metadata?.field_sources ?? {}),
            ...(lisaaUrakoitsija ? { builder: "Vaylaviraston hankesivun kenttalohko" } : {}),
            ...(lisaaKustannus ? { estimated_cost: "Vaylaviraston hankesivun kenttalohko" } : {}),
          },
          ...(lisaaKustannus ? { cost_source: "vayla_kenttalohko" } : {}),
          takautuvat_ajot: [
            ...new Set([
              ...(Array.isArray(h.metadata?.takautuvat_ajot) ? h.metadata.takautuvat_ajot : []),
              TUNNISTE,
            ]),
          ],
        }
        const paivitys: any = { metadata: md }
        if (lisaaUrakoitsija) paivitys.builder = urakoitsijat.join(" // ")
        if (lisaaKustannus) paivitys.estimated_cost = k.kustannusEur
        const { error } = await db.from("projects").update(paivitys).eq("id", h.id)
        if (error) console.log(`   VIRHE ${String(h.name).slice(0, 30)}: ${error.message}`)
      }
    })
  )

  writeFileSync(RAPORTTI, rivit.join("\n"), "utf8")
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  console.log(`  haettu ${jono.length}, haku epaonnistui ${haku}`)
  console.log(`  kenttalohko loytyi ${lohkollisia}`)
  console.log(`  urakoitsija lisattaisiin ${urakoitsijaUusi}, kustannus ${kustannusUusi}`)
  console.log(`  tuotos ${RAPORTTI}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
