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
 * KAAVAN TAVOITTEET LIITTEESTA KAIKILLE KUNNILLE (D-318).
 *
 * Johannes 19.10.2026 Salon kytkennan jalkeen: *"kay muiden kuntien
 * kaavakeraajat myos lapi."*
 *
 * Kaavajasentimia on 241 ja jokainen on omanlaisensa, joten niiden
 * kytkeminen yksitellen on eri tyo kuin VANHOJEN RIVIEN korjaaminen.
 * Tama skripti tekee jalkimmaisen ilman kuntakohtaista koodia: rivilla
 * on sivuosoite, sivulla on liitelinkit, ja liitteen jasennys on jo
 * yhteinen (`kaavanKuvaus.ts`). Kerääjiin kytkeminen jaa erikseen.
 *
 * MITTAUS ENSIN (`scripts/mittaa-kaavakuvaukset.ts`): 6 490
 * kaavarivista 2 509:lla kuvaus on alle 300 merkkia, ja ne jakautuvat
 * 241 lahteeseen niin etta kymmenen suurinta kattaa vain 32 %. Hanta on
 * pitka, joten yleinen ajo kannattaa kuntakohtaisen sijaan.
 *
 * SAANNOT:
 *   - vain OHUET rivit (`--raja`, oletus 300 merkkia)
 *   - sivu ja liite haetaan KERRAN per osoite, vaikka rivejä olisi monta
 *   - selostus ensin, OAS vasta jos selostusta ei ole
 *   - kuvaus voi vain KASVAA; lauseet yhdistetaan toistamatta
 *   - `--max` rajaa haettavien sivujen maaran, jotta ajo on katkaistava
 *     ja toistettava; kasitellyt osoitteet merkitaan metadataan
 *     (`tavoitteet_haettu`), joten seuraava ajo jatkaa siita mihin jai
 *
 *   npx tsx scripts/taydenna-kaavatavoitteet.ts --max 60
 *   npx tsx scripts/taydenna-kaavatavoitteet.ts --max 60 --apply
 *   npx tsx scripts/taydenna-kaavatavoitteet.ts --vain "Lahden kaavatyökohteet" --apply
 */

import * as cheerio from "cheerio"
import {
  haeKaavaselostuksenTeksti,
  kaavanKuvausTekstista,
  valitseKaavanAsiakirja,
  yhdistaKuvaukset,
} from "../lib/agent/kaavanKuvaus"

const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"

function argumentti(nimi: string): string | null {
  const i = process.argv.indexOf(nimi)
  return i >= 0 ? (process.argv[i + 1] ?? null) : null
}

const RAJA = Number(argumentti("--raja") ?? 300)
const MAX_SIVUJA = Number(argumentti("--max") ?? 40)
const VAIN = argumentti("--vain")

type Rivi = {
  taulu: "potential_projects" | "projects"
  id: string
  nimi: string
  lahde: string
  status: string | null
  sivu: string
  kuvaus: string
  metadata: Record<string, any>
}

async function sivunLinkit(url: string) {
  try {
    const res = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
    if (!res.ok) return null
    const tyyppi = res.headers.get("content-type") ?? ""
    /* Osa riveista osoittaa suoraan PDF:aan: se ON liite. */
    if (/pdf/i.test(tyyppi) || /\.pdf($|\?)/i.test(url)) return [{ href: url, teksti: "" }]
    const $ = cheerio.load(await res.text())
    return $("a[href]")
      .toArray()
      .map((a) => {
        const href = $(a).attr("href") ?? ""
        const taysi = href.startsWith("http") ? href : href.startsWith("/") ? new URL(href, url).toString() : href
        return { href: taysi, teksti: $(a).text() }
      })
  } catch {
    return null
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`raja ${RAJA} merkkiä, enintään ${MAX_SIVUJA} sivua${VAIN ? `, vain "${VAIN}"` : ""}\n`)

  /* --- 1. Ohuet kaavarivit --- */
  const rivit: Rivi[] = []
  for (const taulu of ["potential_projects", "projects"] as const) {
    const sarakkeet =
      taulu === "projects" ? "id, name, status, additional_info, metadata" : "id, title, status, metadata"
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(taulu).select(sarakkeet).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      for (const r of (data ?? []) as any[]) {
        const md: Record<string, any> = r.metadata ?? {}
        const lahde = String(md.source_name ?? md.source ?? "")
        const onKaava = /kaavaresolver/i.test(String(md.resolver ?? "")) || /kaava|asemakaav|yleiskaav/i.test(lahde)
        if (!onKaava) continue
        if (VAIN && lahde !== VAIN) continue
        if (md.tavoitteet_haettu) continue
        const kuvaus = String(r.additional_info ?? md.description ?? "")
        if (kuvaus.length >= RAJA) continue
        const sivu = String(md.documents_url ?? md.source_url ?? md.paatos_url ?? "")
        if (!/^https?:\/\//.test(sivu)) continue
        rivit.push({
          taulu,
          id: r.id,
          nimi: String(r.name ?? r.title ?? ""),
          lahde,
          status: r.status ?? null,
          sivu: sivu.split("#")[0],
          kuvaus,
          metadata: md,
        })
      }
      if ((data ?? []).length < 1000) break
    }
  }

  /*
   * LISTASIVU EI OLE HANKKEEN SIVU (D-318).
   *
   * Osalla lahteista `documents_url` on koko kunnan KAAVALISTA, ei
   * hankkeen oma sivu. Kuivaharjoitus paljasti mihin se johtaa: yksi
   * selostus olisi kirjoitettu 77 eri Nokian hankkeelle, 46
   * Hameenlinnan ja 36 Pelkosenniemen hankkeelle -- eli ensimmaisen
   * kaavan teksti kaikkien muiden paalle.
   *
   * Portti: jos samaan osoitteeseen osuu useampi ERI hanke, osoite on
   * listasivu ja se ohitetaan. Sama hanke kahdessa taulussa (jonorivi
   * ja hanke) on sallittu, koska nimi on sama.
   */
  const nimetOsoitteella = new Map<string, Set<string>>()
  for (const r of rivit) {
    const avain = r.nimi.toLowerCase().replace(/\s+/g, " ").trim()
    nimetOsoitteella.set(r.sivu, (nimetOsoitteella.get(r.sivu) ?? new Set()).add(avain))
  }
  const listasivut = new Set(
    [...nimetOsoitteella.entries()].filter(([, nimet]) => nimet.size > 1).map(([osoite]) => osoite)
  )
  const omatSivut = rivit.filter((r) => !listasivut.has(r.sivu))

  console.log(`Ohuita kaavarivejä ${rivit.length}, eri sivuosoitteita ${nimetOsoitteella.size}`)
  console.log(
    `Listasivuja (sama osoite monella eri hankkeella) ${listasivut.size}; ne ohitetaan, jolloin käsiteltäviä rivejä jää ${omatSivut.length}`
  )

  const osoitteet = [...new Set(omatSivut.map((r) => r.sivu))].slice(0, MAX_SIVUJA)
  console.log(`Haetaan tällä ajolla ${osoitteet.length} sivua\n`)

  /* --- 2. Sivu ja liite kerran per osoite --- */
  const tulokset = new Map<string, { asiakirja: string | null; kuvaus: string | null }>()
  let eiLiitetta = 0
  let eiTekstia = 0
  for (const osoite of osoitteet) {
    const linkit = await sivunLinkit(osoite)
    const asiakirja = linkit ? valitseKaavanAsiakirja(linkit) : null
    if (!asiakirja) {
      tulokset.set(osoite, { asiakirja: null, kuvaus: null })
      eiLiitetta += 1
      continue
    }
    const teksti = await haeKaavaselostuksenTeksti(asiakirja)
    const kuvaus = teksti ? kaavanKuvausTekstista(teksti) : null
    if (!kuvaus) eiTekstia += 1
    tulokset.set(osoite, { asiakirja, kuvaus })
    await new Promise((r) => setTimeout(r, 400))
  }
  console.log(
    `Sivuja ${osoitteet.length}: liitettä ei löytynyt ${eiLiitetta}, liite löytyi mutta tekstiä ei saatu ${eiTekstia}, kuvaus saatiin ${osoitteet.length - eiLiitetta - eiTekstia}\n`
  )

  /* --- 3. Rivi kerrallaan --- */
  let kirjoitetaan = 0
  let ennallaan = 0

  for (const r of omatSivut) {
    if (!tulokset.has(r.sivu)) continue
    const tulos = tulokset.get(r.sivu)!
    const otsikko = `${r.taulu === "projects" ? "H" : "J"} ${r.id.slice(0, 8)} ${r.nimi.slice(0, 40).padEnd(42)} ${r.lahde.slice(0, 28)}`

    const uusi = tulos.kuvaus ? (yhdistaKuvaukset(r.kuvaus, tulos.kuvaus) ?? r.kuvaus) : r.kuvaus
    if (uusi.length <= r.kuvaus.length) {
      ennallaan += 1
      console.log(`\n${otsikko}\n   EI LISÄYSTÄ (${r.kuvaus.length} merkkiä) ${tulos.asiakirja ? "liite ei tuottanut tekstiä" : "ei liitettä sivulla"}`)
    } else {
      kirjoitetaan += 1
      console.log(`\n${otsikko}  [${r.status}]`)
      console.log(`   liite: ${tulos.asiakirja}`)
      console.log(`   ${r.kuvaus.length} -> ${uusi.length} merkkiä`)
      console.log(`   LISÄYS: ${uusi.slice(r.kuvaus.length).trim().slice(0, 300)}`)
    }

    if (!apply) continue
    /*
     * Merkinta tehdaan MYOS silloin kun lisaysta ei tullut, jotta sama
     * sivu ei tule haetuksi joka ajolla uudelleen.
     */
    const md: Record<string, any> = {
      ...r.metadata,
      tavoitteet_haettu: new Date().toISOString().slice(0, 10),
    }
    if (uusi.length > r.kuvaus.length) md.description = uusi
    const paivitys: Record<string, unknown> =
      r.taulu === "projects" && uusi.length > r.kuvaus.length
        ? { additional_info: uusi, metadata: md }
        : { metadata: md }
    const { error } = await db.from(r.taulu).update(paivitys).eq("id", r.id)
    if (error) console.error(`   VIRHE: ${error.message}`)
  }

  console.log(`\nYhteensä: kirjoitetaan ${kirjoitetaan}, ei lisäystä ${ennallaan}`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
