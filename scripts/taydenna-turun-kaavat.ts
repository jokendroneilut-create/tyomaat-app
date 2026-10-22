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
 * TURUN KAAVOJEN KUVAUS JA YHTEYSHENKILOT TAKAUTUVASTI (D-336).
 *
 * Johannes 23.10.2026: *"kuvaus ja yhteyshenkiloita ei ole poimittu.
 * korjataan tama, takautuvasti, jonon muut hankkeet tasta lahteesta ja
 * tulevat hankkeet."*
 *
 * Kerraaja ja resolveri on korjattu (tulevat). Tama ajo hoitaa
 * olemassa olevat rivit MOLEMMISTA tauluista.
 *
 * MIKA OLI VIKANA. Ei valitsin eika jasennin -- molemmat toimivat sivua
 * vasten (kuvaus 474 merkkia, 10 tunnistetietokenttaa). Kaksi syyta:
 *
 *   1. `detailsAttempted` asetettiin vain kun kuvaus LOYTYI, joten
 *      kuollut osoite yritettiin uudelleen joka ajossa ja poltti
 *      `TURKU_MAX_DETAIL_FETCHES_PER_RUN`-budjetin. 24 rivia oli ilman
 *      kuvausta, ja niista 15 on aidosti kuollut osoite -- yhdeksan
 *      tyopaa ei siis saanut koskaan vuoroa.
 *   2. Tunnistetiedot liitettiin KUVAUSTEKSTIIN, ja yleinen
 *      tekstipoimija teki niista rikkinaisia yhteyshenkiloita.
 *
 * YHTEYSHENKILOT KORVATAAN VAIN SAMALLA OSOITTEELLA. Sivulta saatu
 * lista voittaa, mutta rivilla oleva merkinta jota sivulla EI ole jaa
 * koskematta -- se voi olla kasin lisatty ([[manual-parties-linkedin]]).
 *
 * KUVAUS: PIDEMPI KORVAA, JA MYOS LYHYEMPI KUN LOPPU ON KOHINAA.
 * Hyvaksynnassa hankkeelle kopioitiin kuvaus JA kenttarivit perakkain:
 *
 *   "Tavoitteena on lisata pientalotonttitarjontaa Haarlan
 *    kaupunginosaan.
 *    Piirtaja: Ahlqvist Reeta
 *    Kaavatunnus: 46/2005
 *    Vastuuhenkilon sahkoposti: jani.etelakoski@turku.fi"
 *
 * Hankkeen teksti on siis PIDEMPI kuin sivun puhdas kuvaus, joten
 * "vain pidempi korvaa" olisi jattanyt kohinan paikalleen. Kun sivun
 * kuvaus on tallennetun ALKUOSA, loppu on kenttarivit ja se voidaan
 * korvata -- tama on todistettava ehto eika arvaus siita etta
 * lyhyempi olisi parempi.
 *
 *   npx tsx scripts/taydenna-turun-kaavat.ts
 *   npx tsx scripts/taydenna-turun-kaavat.ts --apply
 */

import * as cheerio from "cheerio"
import { turunYhteyshenkilot, type TurkuYhteyshenkilo } from "../lib/agent/turunYhteyshenkilot"

const LAHDE = "Turun vireillä olevat kaavat"
const TAUKO_MS = 300

type Sivu = { kuvaus: string; info: Record<string, string>; henkilot: TurkuYhteyshenkilo[] } | null

const nukut = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function haeSivu(url: string): Promise<Sivu> {
  try {
    const v = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } })
    if (!v.ok) return null
    const $ = cheerio.load(await v.text())
    const kuvaus = $(".city-plan-content").first().children().first().text().replace(/\s+/g, " ").trim()
    const info: Record<string, string> = {}
    $(".map-information__item").each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim()
      const i = t.indexOf(":")
      if (i === -1) return
      const label = t.slice(0, i).trim()
      const value = t.slice(i + 1).trim()
      if (label && value) info[label] = value
    })
    if (!kuvaus && !Object.keys(info).length) return null
    return { kuvaus, info, henkilot: turunYhteyshenkilot(info) }
  } catch {
    return null
  }
}

/* Sivun henkilot voittavat; rivin omat jaavat jos osoitetta ei ole sivulla. */
function yhdistaHenkilot(vanhat: any[], sivulta: TurkuYhteyshenkilo[]) {
  const sivunOsoitteet = new Set(sivulta.map((h) => (h.email ?? "").toLowerCase()).filter(Boolean))
  const sivunNimet = new Set(sivulta.map((h) => h.name.toLowerCase()))
  const omat = vanhat.filter((c) => {
    const e = String(c?.email ?? "").toLowerCase()
    const n = String(c?.name ?? "").toLowerCase()
    if (e && sivunOsoitteet.has(e)) return false
    if (!e && n && sivunNimet.has(n)) return false
    return true
  })
  return [...sivulta, ...omat]
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  const sivut = new Map<string, Sivu>()
  const luvut = { jonoKuvaus: 0, jonoHenkilot: 0, hankeKuvaus: 0, hankeHenkilot: 0, kuollut: 0, eiUrlia: 0 }

  for (const taulu of ["potential_projects", "projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 500) {
      const { data, error } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id, name, status, additional_info, metadata"
            : "id, title, status, metadata"
        )
        .eq("metadata->>source_name", LAHDE)
        .range(a, a + 499)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 500) break
    }
    const kohteet = taulu === "projects" ? rivit : rivit.filter((p) => p.status !== "ignored")
    console.log(`\n=== ${taulu}: ${kohteet.length} riviä ===\n`)

    for (const p of kohteet as any[]) {
      const nimi = String(p.name ?? p.title ?? "").slice(0, 44)
      const url = String(p.metadata?.documents_url ?? p.metadata?.source_url ?? "")
      if (!/^https?:\/\/.*turku\.fi/.test(url)) {
        luvut.eiUrlia += 1
        continue
      }

      if (!sivut.has(url)) {
        sivut.set(url, await haeSivu(url))
        await nukut(TAUKO_MS)
      }
      const sivu = sivut.get(url)
      if (!sivu) {
        luvut.kuollut += 1
        console.log(`   KUOLLUT OSOITE  ${nimi.padEnd(46)} ${url.replace("https://www.turku.fi", "").slice(0, 52)}`)
        continue
      }

      const vanhaKuvaus =
        taulu === "projects" ? String(p.additional_info ?? "") : String(p.metadata?.description ?? "")
      const vanhatHenkilot = Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []
      const uudetHenkilot = yhdistaHenkilot(vanhatHenkilot, sivu.henkilot)

      /*
       * Sivun kuvaus on tallennetun alkuosa => loppu on kenttarivit.
       * Vertailu tehdaan valilyonnit normalisoiden, koska tallennetussa
       * on rivinvaihtoja ja sivulta tulee yksi rivi.
       */
      const litista = (t: string) => t.replace(/\s+/g, " ").trim()
      const onKohinaPerassa =
        Boolean(sivu.kuvaus) &&
        litista(vanhaKuvaus).startsWith(litista(sivu.kuvaus)) &&
        litista(vanhaKuvaus).length > litista(sivu.kuvaus).length
      const kuvausParanee = sivu.kuvaus.length > vanhaKuvaus.length || onKohinaPerassa
      const henkilotMuuttuu = JSON.stringify(uudetHenkilot) !== JSON.stringify(vanhatHenkilot)
      if (!kuvausParanee && !henkilotMuuttuu) continue

      const osat: string[] = []
      if (kuvausParanee) {
        osat.push(
          `kuvaus ${vanhaKuvaus.length} -> ${sivu.kuvaus.length}${onKohinaPerassa ? " (kenttarivit pois)" : ""}`
        )
        if (taulu === "projects") luvut.hankeKuvaus += 1
        else luvut.jonoKuvaus += 1
      }
      if (henkilotMuuttuu) {
        osat.push(`henkilot ${vanhatHenkilot.length} -> ${uudetHenkilot.length}`)
        if (taulu === "projects") luvut.hankeHenkilot += 1
        else luvut.jonoHenkilot += 1
      }
      console.log(`   ${nimi.padEnd(46)} ${osat.join(" | ")}`)
      if (henkilotMuuttuu && sivu.henkilot.length)
        console.log(`      ${sivu.henkilot.map((h) => `${h.name} (${h.title})`).join(", ").slice(0, 110)}`)

      if (!apply) continue

      const md: Record<string, any> = { ...(p.metadata ?? {}) }
      if (kuvausParanee) md.description = sivu.kuvaus
      if (henkilotMuuttuu) md.contact_persons = uudetHenkilot
      md.identifying_info = sivu.info
      md.turku_taydennetty = new Date().toISOString().slice(0, 10)

      const paivitys: Record<string, any> = { metadata: md }
      if (taulu === "projects" && kuvausParanee) paivitys.additional_info = sivu.kuvaus

      const { error } = await db.from(taulu).update(paivitys).eq("id", p.id)
      if (error) console.error(`      VIRHE: ${error.message}`)
    }
  }

  console.log(
    `\nJono: kuvaus ${luvut.jonoKuvaus}, henkilot ${luvut.jonoHenkilot} | Hankkeet: kuvaus ${luvut.hankeKuvaus}, henkilot ${luvut.hankeHenkilot}`
  )
  console.log(`Kuolleita osoitteita ${luvut.kuollut}, ilman kelvollista osoitetta ${luvut.eiUrlia}, sivuja haettu ${sivut.size}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
