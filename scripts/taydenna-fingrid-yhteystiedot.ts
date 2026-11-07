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
 * FINGRIDIN YHTEYSTIEDOT TAKAUTUVASTI (D-370).
 *
 * Jasennin korjattiin 2.11.2026, mutta korjaus ei kosketa jo
 * hyvaksyttyja hankkeita: lahde saa vuoron mediaanina 5,7 vrk:n valein
 * ([[expiring-sources]]) ja ohittaa viimeisen 14 vrk:n aikana nahdyt
 * osoitteet, joten osa hankkeista odottaisi viikkoja.
 *
 * MITTAUS 2.11.2026 kaikilta 53 sivulta: 169 nimirivia, joista 9 jai
 * saamatta kolmesta eri syysta, ja 46 rivilla oli vaara tyonantaja tai
 * nimikkeeseen valunut sahkoposti. Kolme syyta:
 *   - yksi <p> sisaltaa monta henkiloa (nimi rivi 0, muut nimikkeeseen)
 *   - nimi ei ole rivilla 0 vaan tyonantajan tai saatetekstin jalkeen
 *   - nimikuvio hylkasi "Erkka-Pekka" ja "Ümit"
 *
 * TUNNISTE KIRJOITETAAN AINA. Ilman sita korjatun saannon uudelleenajo
 * on arvailua ([[backfill-marker]]).
 *
 * YHDISTAA, EI KORVAA. Johannes lisaa osapuolia ja yhteyshenkiloita
 * kasin ([[manual-parties-linkedin]]), ja lahteesta puuttuva ei ole
 * vaara. Sama nimi paivitetaan, tuntematon lisataan, kasin lisatty
 * jaa -- toisin kuin tuontireitti, joka korvaa koko listan
 * ([[matched-overwrites-contacts]]).
 *
 *   npx tsx scripts/taydenna-fingrid-yhteystiedot.ts
 *   npx tsx scripts/taydenna-fingrid-yhteystiedot.ts --apply
 */
import { jasennaYhteyshenkilot } from "../lib/agent/fetchFingridProjectsSource"

const APPLY = process.argv.includes("--apply")
const LISTAUS = "https://www.fingrid.fi/kantaverkko/rakentaminen/hankkeet/"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const TUNNISTE = "fingrid_yhteystiedot_2026_11"

type Kontakti = {
  kind: string
  name: string
  title: string | null
  email: string | null
  phone: string | null
  organization: string | null
}

async function hae(u: string): Promise<string | null> {
  try {
    const r = await fetch(u, { cache: "no-store", headers: { "user-agent": UA } })
    return r.ok ? await r.text() : null
  } catch {
    return null
  }
}

const avain = (n: string) => n.toLowerCase().replace(/\s+/g, " ").trim()

/* Tyhja kentta taytetaan, olemassa olevaa ei ylikirjoiteta. */
function yhdista(vanha: Kontakti[], uusi: Kontakti[]): { lista: Kontakti[]; lisatty: number; taydennetty: number } {
  const lista = vanha.map((k) => ({ ...k }))
  let lisatty = 0
  let taydennetty = 0

  for (const u of uusi) {
    const osuma = lista.find((v) => avain(String(v.name ?? "")) === avain(u.name))
    if (!osuma) {
      lista.push(u)
      lisatty++
      continue
    }
    let muuttui = false
    for (const kentta of ["title", "email", "phone", "organization"] as const) {
      const nyt = osuma[kentta]
      if ((nyt === null || nyt === undefined || nyt === "") && u[kentta]) {
        osuma[kentta] = u[kentta]
        muuttui = true
      }
    }
    if (muuttui) taydennetty++
  }
  return { lista, lisatty, taydennetty }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const listaus = await hae(LISTAUS)
  if (!listaus) throw new Error("listausta ei saatu")
  const slugit = [
    ...new Set(
      [...listaus.matchAll(/\/kantaverkko\/rakentaminen\/hankkeet\/([a-z0-9-]+)\//g)].map((m) => m[1])
    ),
  ]

  /* Sivutettu luku; WHERE JSON-kenttaan on taysi taulunluku ([[backfill-run-limits]]). */
  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,metadata")
      .range(a, a + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  const sivulta = new Map<string, any[]>()
  const lisaaSivulle = (slug: string, hanke: any) => {
    const lista = sivulta.get(slug) ?? []
    if (!lista.some((h) => h.id === hanke.id)) lista.push(hanke)
    sivulta.set(slug, lista)
  }
  const slugista = (teksti: unknown): string | null =>
    String(teksti ?? "").match(/\/kantaverkko\/rakentaminen\/hankkeet\/([a-z0-9-]+)\//)?.[1] ?? null

  /*
   * KOLME REITTIA SIVULTA HANKKEESEEN, koska `source_url` ei riita.
   *
   * Mitattu 2.11.2026: 12 sivua 53:sta ei loytanyt hankettaan
   * osoitteella. Syy ei ollut puuttuva hanke vaan se, etta hyvaksytty
   * jonorivi LIITETTIIN olemassa olevaan hankkeeseen -- jolloin
   * hankkeen `source_url` on sen ENSIMMAISEN lahteen osoite ja Fingrid
   * jaa `source_history`-listaan ([[own-data-unread]]).
   */
  const hankeTunnisteella = new Map<string, any>(hankkeet.map((h) => [h.id, h]))
  for (const h of hankkeet) {
    const suora = slugista(h.metadata?.source_url)
    if (suora) lisaaSivulle(suora, h)

    const historia = Array.isArray(h.metadata?.source_history) ? h.metadata.source_history : []
    for (const merkinta of historia) {
      const s = slugista(typeof merkinta === "string" ? merkinta : merkinta?.url)
      if (s) lisaaSivulle(s, h)
    }
  }

  /*
   * JONOSTA POISTETTUA EI HERATETA. `ignored` tarkoittaa etta rivi on
   * poistettu jonosta tarkoituksella ([[queue-removal-ignored]]), joten
   * sen sivua ei kateta -- vain `approved` kertoo hankkeesta.
   */
  const jonorivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,status,title,metadata,url:metadata->>source_url,hanke:metadata->>matched_existing_project_id")
      .range(a, a + 999)
    if (error) throw error
    jonorivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  /*
   * KATSELMOINTIA ODOTTAVA RIVI TAYDENNETAAN MYOS (D-391).
   *
   * Aiemmin tama ajo kosketti vain hankkeita, joten uusi sivu jonka
   * rivi on vielä jonossa jai ilman yhteyshenkiloita -- ja juuri siita
   * Johannes huomautti: *"tasta on yhteyshenkilot poimimatta."*
   * Hyvaksynta kopioi metadatan sellaisenaan, joten jonoriville
   * kirjoitettu lista siirtyy hankkeelle ilman eri ajoa.
   */
  const odottavatSivulta = new Map<string, any[]>()
  for (const rivi of jonorivit) {
    if (rivi.status !== "new") continue
    const s2 = slugista(rivi.url)
    if (!s2) continue
    odottavatSivulta.set(s2, [...(odottavatSivulta.get(s2) ?? []), rivi])
  }

  let jononKautta = 0
  for (const rivi of jonorivit) {
    if (rivi.status !== "approved" || !rivi.hanke) continue
    const s = slugista(rivi.url)
    const hanke = hankeTunnisteella.get(String(rivi.hanke))
    if (!s || !hanke) continue
    if (!(sivulta.get(s) ?? []).some((h) => h.id === hanke.id)) jononKautta++
    lisaaSivulle(s, hanke)
  }

  console.log(
    `Fingrid-sivuja ${slugit.length}, hanke loytyy ${sivulta.size}:lle ` +
      `(joista ${jononKautta} vain hyvaksytyn jonorivin kautta)\n`
  )

  let yhtLisatty = 0
  let yhtTaydennetty = 0
  let kosketut = 0
  let jonoKosketut = 0
  const ilmanHanketta: string[] = []

  for (const slug of slugit) {
    const kohteet = sivulta.get(slug) ?? []
    const odottavat = odottavatSivulta.get(slug) ?? []
    /*
     * SIVU KASITELLAAN MYOS ILMAN HANKETTA, jos sen rivi odottaa
     * katselmointia (D-391). Ennen tama `continue` ohitti juuri ne
     * sivut joiden rivi on vielä jonossa — eli uudet hankkeet, joilta
     * yhteyshenkilot puuttuvat kaikkein todennakoisimmin.
     */
    if (!kohteet.length && !odottavat.length) {
      ilmanHanketta.push(slug)
      continue
    }
    if (!kohteet.length) ilmanHanketta.push(slug)
    const html = await hae(`${LISTAUS}${slug}/`)
    if (!html) {
      console.log(`  HAKU EPAONNISTUI: ${slug}`)
      continue
    }
    const poimitut: Kontakti[] = jasennaYhteyshenkilot(html).map((h) => ({
      kind: "person",
      name: h.nimi,
      title: h.nimike,
      email: h.sahkoposti,
      phone: h.puhelin,
      organization: h.organisaatio,
    }))
    if (!poimitut.length) continue

    for (const hanke of kohteet) {
      const vanha: Kontakti[] = Array.isArray(hanke.metadata?.contact_persons)
        ? hanke.metadata.contact_persons
        : []
      const { lista, lisatty, taydennetty } = yhdista(vanha, poimitut)
      if (!lisatty && !taydennetty) continue

      kosketut++
      yhtLisatty += lisatty
      yhtTaydennetty += taydennetty
      console.log(
        `${slug} -> ${String(hanke.name).slice(0, 44)}\n` +
          `   ${vanha.length} -> ${lista.length} yhteyshenkiloa (uusia ${lisatty}, taydennetty ${taydennetty})`
      )
      for (const k of lista.slice(vanha.length)) {
        console.log(`     + ${k.name} | ${k.title ?? "-"} | ${k.phone ?? "-"} | ${k.organization ?? "(tyhja)"} | ${k.email ?? "-"}`)
      }

      if (!APPLY) continue
      const md = {
        ...(hanke.metadata ?? {}),
        contact_persons: lista,
        field_sources: {
          ...(hanke.metadata?.field_sources ?? {}),
          contact_persons: "Fingridin hankesivun Lisatietoja-lohko",
        },
        takautuvat_ajot: [
          ...new Set([
            ...(Array.isArray(hanke.metadata?.takautuvat_ajot) ? hanke.metadata.takautuvat_ajot : []),
            TUNNISTE,
          ]),
        ],
      }
      const { error } = await db.from("projects").update({ metadata: md }).eq("id", hanke.id)
      if (error) console.log(`   VIRHE: ${error.message}`)
    }

    /* Katselmointia odottavat jonorivit samalta sivulta. */
    for (const rivi of odottavatSivulta.get(slug) ?? []) {
      const md0 = rivi.metadata ?? {}
      const vanha: Kontakti[] = Array.isArray(md0.contact_persons) ? md0.contact_persons : []
      const { lista, lisatty, taydennetty } = yhdista(vanha, poimitut)
      if (!lisatty && !taydennetty) continue

      jonoKosketut++
      console.log(
        `${slug} -> JONORIVI ${String(rivi.title ?? "").slice(0, 40)}
` +
          `   ${vanha.length} -> ${lista.length} yhteyshenkiloa (uusia ${lisatty}, taydennetty ${taydennetty})`
      )
      for (const k of lista.slice(vanha.length)) {
        console.log(`     + ${k.name} | ${k.title ?? "-"} | ${k.phone ?? "-"} | ${k.organization ?? "(tyhja)"} | ${k.email ?? "-"}`)
      }

      if (!APPLY) continue
      const { error } = await db
        .from("potential_projects")
        .update({
          metadata: {
            ...md0,
            contact_persons: lista,
            takautuvat_ajot: [
              ...new Set([
                ...(Array.isArray(md0.takautuvat_ajot) ? md0.takautuvat_ajot : []),
                TUNNISTE,
              ]),
            ],
          },
        })
        .eq("id", rivi.id)
      if (error) console.log(`   VIRHE jonorivi: ${error.message}`)
    }
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  console.log(`  hankkeita kosketettu ${kosketut}, jonoriveja ${jonoKosketut}`)
  console.log(`  uusia yhteyshenkiloita ${yhtLisatty}, taydennettyja ${yhtTaydennetty}`)
  /*
   * SYY KERROTAAN RIVEITTAIN. Pelkka luku "12 sivua ilman hanketta"
   * nayttaisi aukolta, mutta `ignored` on tahallinen poisto ja `new` on
   * viela katselmoinnissa -- vain tyhja tai hyvaksytty ilman loytyvaa
   * hanketta on oikeasti selvitettava.
   */
  console.log(`  sivuja ilman hanketta ${ilmanHanketta.length}:`)
  const jonoSivulta = new Map<string, string>()
  for (const rivi of jonorivit) {
    const s = slugista(rivi.url)
    if (s) jonoSivulta.set(s, rivi.status)
  }
  /*
   * LISTA EI SAA YLI-ILMOITTAA (D-391 jatko).
   *
   * Osuma etsittiin vain LAHDEOSOITTEELLA, joten sama Fingridin hanke
   * nayttaa hankkeettomalta silloin kun se on tullut kantaan toista
   * reittia (YVA tai ELY-keskuksen tiedote) ja sen `source_url` on eri.
   * Mitattu 8.11.2026: viidesta "ilman hanketta" -sivusta kaksi
   * (lieto-raisio, seinajoki-hirvisuo) OLI kannassa, loydettavissa
   * nimella. Vaara tyolista on yhta haitallinen kuin puuttuva: se vie
   * aikaa selvityksiin joita ei tarvita.
   *
   * Nimiosuma on tassa vain RAPORTIN tarkennus, ei kirjoitusperuste:
   * yhteyshenkiloita ei kirjoiteta nimiosuman perusteella, koska
   * samankaltainen nimi ei todista samaa hanketta
   * ([[proximity-needs-same-kind]]).
   */
  const nimiOsuu = (slug: string): any | null => {
    const sanat = slug.split("-").filter((x) => x.length >= 5)
    /*
     * KAKSI PITKAA SANAA, EI YKSI. Yhdella sanalla "aurora-line" osui
     * hankkeeseen "Auroran alueen paihdepalveluiden rakennus" — eri
     * hanke, eri kunta, eri toimiala. Voimajohtohankkeen nimi on
     * kaytannossa aina kaksiosainen (paatepisteet), joten kahden sanan
     * vaatimus ei hukkaa aitoja osumia mutta torjuu taman.
     */
    if (sanat.length < 2) return null
    for (const h of hankkeet) {
      const nimi = String(h.name ?? "")
        .toLowerCase()
        .replace(/[äå]/g, "a")
        .replace(/ö/g, "o")
      if (sanat.every((x) => nimi.includes(x))) return h
    }
    return null
  }

  for (const slug of ilmanHanketta) {
    const tila = jonoSivulta.get(slug)
    const nimella = nimiOsuu(slug)
    const selite = nimella
      ? `hanke on kannassa NIMELLA: ${nimella.id} (${String(nimella.name).slice(0, 46)})`
      : tila === "ignored"
        ? "jonosta poistettu tarkoituksella"
        : tila === "new"
          ? "odottaa katselmointia"
          : tila === "approved"
            ? "HYVAKSYTTY mutta hanketta ei loydy -- selvitettava"
            : "ei koskaan tullut jonoon"
    console.log(`     ${slug.padEnd(40)} ${selite}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
