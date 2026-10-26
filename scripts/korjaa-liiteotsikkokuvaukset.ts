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
 * LIITEOTSIKKOKUVAUKSET SELOSTUKSESTA, KAIKISSA KUNNISSA (D-352).
 *
 * Johannes 26.10.2026: *"korjaa nuo muutkin samalla"* -- Suonenjoen
 * korjauksen (D-351) jalkeen mitattu 251 rivia, joiden kuvaus on
 * pelkkia liitelinkkien nimia.
 *
 * YKSI YLEINEN KORJAUS, EI KUNTAKOHTAISTA KOODIA. Kuntien sivut ovat
 * erilaisia, mutta kaikilla on sama rakenne: kaavan OTSIKKO ja sen
 * alla sen omat liitteet. Lohko etsitaan otsikon tekstilla
 * (h1-h4 tai mika tahansa elementti jonka oma teksti on otsikko) ja
 * liitteet luetaan vain sen lohkon sisalta -- muuten listaussivulta
 * valikoituisi toisen kaavan selostus
 * ([[listing-page-is-not-project-page]]).
 *
 * Jos lohkoa ei loydy, koko sivun linkit kelpaavat VAIN jos niita on
 * vahan (`LISTAUSRAJA`). Silloin sivu on yhden kaavan oma sivu.
 *
 * BUDJETTI, koska selostukset ovat satoja kilotavuja: `--raja=N`
 * (oletus 40) rajaa montako PDF:aa yhdella ajolla haetaan. Ajo on
 * toistettavissa; jo korjatut rivit eivat tule uudelleen.
 *
 *   npx tsx scripts/korjaa-liiteotsikkokuvaukset.ts
 *   npx tsx scripts/korjaa-liiteotsikkokuvaukset.ts --raja=60 --apply
 *   npx tsx scripts/korjaa-liiteotsikkokuvaukset.ts --lahde="Inarin vireillä olevat asemakaavat"
 */

import {
  haeKaavaselostuksenTeksti,
  kaavanKuvausTekstista,
  valitseKaavanAsiakirja,
} from "../lib/agent/kaavanKuvaus"
import { liitelinkit } from "../lib/agent/kaavanLiite"

/* Sama tunnistus kuin mittarissa (D-351). */
const LIITESANA =
  /kuulutus|selostus|kaavakartta|kartta|osallistumis-?\s*ja\s*arviointisuunnitelma|\boas\b|tonttijako|seurantalomake|liite|luonnos|ehdotus|havainnekuva|asemakaavamuutos|kaavaluonnos|kaavaehdotus|päätös|pöytäkirja|vastine|lausunto|selvitys|kaavamääräykset|merkinnät/gi
const JAANNOS_RAJA = 40
const LISTAUSRAJA = 12

function jaannos(kuvaus: string): string {
  return kuvaus
    .replace(LIITESANA, " ")
    .replace(/\d{1,2}\.\d{1,2}\.\d{2,4}/g, " ")
    .replace(/[^\wåäöÅÄÖ]+/g, " ")
    .trim()
}

function normalisoi(teksti: string): string {
  return String(teksti ?? "")
    .toLowerCase()
    .replace(/[^\wåäö]+/g, " ")
    .trim()
}

/*
 * LIITTEEN ON TUNNISTETTAVA JUURI TAMA KAAVA (D-352).
 *
 * Kuivaharjoitus kahdella eri lohkosaannolla naytti saman virheen:
 * Toholammin *"Datakeskuksen alueen asemakaava"* sai **Ullavan
 * sahkoaseman** OAS:n, koska se sattui olemaan sivun ensimmainen
 * OAS. Lohkon rajaus ei riita, koska osalla kunnista lohkoa ei ole
 * lainkaan -- silloin ainoa todiste on liitteen NIMI.
 *
 * Saanto on sama kuin `taydenna-kaavakuvaukset.ts`:ssa (D-271):
 * otsikon kaavatunnus tai harvinainen sana on loydyttava liitteen
 * nimesta tai linkin tekstista.
 */
const YLEISSANA =
  /^(asemakaava|asemakaavan|asemakaavamuutos|kaava|kaavan|kaavamuutos|muutos|muutoksen|ranta|yleis|yleiskaava|osayleiskaava|osa|osaa|ja|sekä|alue|alueen|alueella|kortteli|korttelin|korttelia|kaupunginosa|vireillä|luonnos|ehdotus|tie|katu|kuja|puisto|laajennus|tonttijaon|tonttijako|koskeva|siihen|liittyvä)$/i

/*
 * TYYPPISANA EI YKSILOI KAAVAA (D-352). Kuivaharjoitus 37 rivista:
 * Toholammin *"Takkukankaan tuulivoimapuiston osayleiskaava"* sai
 * **Harjakankaan** OAS:n ja Kannuksen *"Poleenkankaan
 * teollisuusalueen asemakaava"* sai **Eskolan** teollisuusalueen
 * OAS:n -- molemmissa osuma syntyi sanasta joka kertoo hankkeen
 * TYYPIN, ei sen nimen. Erotteleva sana on "Takkukankaan",
 * "Poleenkankaan".
 *
 * Myos kunnan nimi on pois: Inarin *"Ivalon asemakaavan muutos;
 * Vilkontie"* osui Ivalon TOISEN kaavan selostukseen.
 */
const TYYPPISANA =
  /tuulivoima|aurinkovoima|voimapuisto|voimalaitos|teollisuusalue|yritysalue|liikealue|asuinalue|datakeskus|keskusta|kaava|kortteli|tontti|laajennus|muutos|hanke|alue|rakentamis|paloasema|koulu|päiväkoti|satama/i

function tunnisteet(
  otsikko: string,
  kunta?: string | null,
  yleinen?: (sana: string) => boolean
): string[] {
  const ulos: string[] = []
  for (const m of otsikko.matchAll(/\b[A-Za-zÅÄÖåäö]{0,3}\s?\d{2,5}(?:-\d{2,5})?\b/g)) {
    const t = m[0].replace(/\s+/g, "").toLowerCase()
    if (t.length >= 3) ulos.push(t)
  }
  const kuntaNimi = normalisoi(kunta ?? "")
  for (const sana of otsikko.split(/[^\wäöåÄÖÅ-]+/)) {
    if (sana.length < 6 || YLEISSANA.test(sana) || TYYPPISANA.test(sana)) continue
    /* Kunnan nimi ei erota saman kunnan kaavoja toisistaan. */
    const s = sana.toLowerCase()
    if (kuntaNimi && (s.startsWith(kuntaNimi.slice(0, 5)) || kuntaNimi.startsWith(s.slice(0, 5)))) continue
    if (yleinen?.(s)) continue
    ulos.push(s)
  }
  return ulos
}

/*
 * ASEMAKAAVA JA YLEISKAAVA OVAT ERI KAAVA (D-352). Inarin *"Ivalon
 * asemakaavan muutos; Vilkontie"* osui tiedostoon
 * "kaavaselostus-ivalon-alueen-**yk**-muutos-uusijoki", koska sana
 * "ivalon" on molemmissa -- mutta toinen on yleiskaavan muutos
 * toisaalla Ivalossa. Kun otsikko ja liite ovat eri kaavalajia, osuma
 * on vaara riippumatta yhteisesta paikannimesta.
 */
function kaavalaji(teksti: string): "asema" | "yleis" | null {
  const t = teksti.toLowerCase().replace(/[_\s-]+/g, "")
  const yleis = /(osa)?yleiskaav|\byk\b|\boyk\b|oykm|ykmuutos/.test(t)
  const asema = /asemakaav|\bak\b|akm|ranta-?asemakaav/.test(t)
  if (yleis && !asema) return "yleis"
  if (asema && !yleis) return "asema"
  return null
}

function osuukoKaavaan(
  linkki: { teksti: string; href: string },
  otsikko: string,
  kunta?: string | null,
  yleinen?: (sana: string) => boolean
): boolean {
  const nimi = `${decodeURIComponent(linkki.href.split("/").pop() ?? "")} ${linkki.teksti}`
    .toLowerCase()
    .replace(/[_\s-]+/g, "")
  const otsikonLaji = kaavalaji(otsikko)
  const liitteenLaji = kaavalaji(`${linkki.href.split("/").pop() ?? ""} ${linkki.teksti}`)
  if (otsikonLaji && liitteenLaji && otsikonLaji !== liitteenLaji) return false

  for (const t of tunnisteet(otsikko, kunta, yleinen)) {
    /* Kannan alku riittaa: "Kappelinkierron" vs "kappelinkierto". */
    const kanta = (t.length > 7 ? t.slice(0, -2) : t).replace(/[_\s-]+/g, "")
    if (kanta.length >= 3 && nimi.includes(kanta)) return true
  }
  return false
}

async function main() {
  const apply = process.argv.includes("--apply")
  const raja = Number(process.argv.find((a) => a.startsWith("--raja="))?.split("=")[1] ?? 40)
  const vainLahde = process.argv.find((a) => a.startsWith("--lahde="))?.split("=")[1]

  const cheerio = await import("cheerio")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? `=== AJO (--apply), budjetti ${raja} ===` : `=== KUIVAHARJOITUS, budjetti ${raja} ===`)

  type Rivi = {
    taulu: "projects" | "potential_projects"
    id: string
    otsikko: string
    kuvaus: string
    sivu: string
    lahde: string
    kunta: string | null
    metadata: any
  }
  const rivit: Rivi[] = []
  const kaikkiOtsikot = new Map<string, Set<string>>()

  for (const taulu of ["projects", "potential_projects"] as const) {
    const data: any[] = []
    for (let a = 0; ; a += 1000) {
      /*
       * VAIN KAAVALAHTEET, EI KOKO TAULUA (D-352).
       *
       * Ensimmainen versio luki `projects`- ja `potential_projects`-taulut
       * KOKONAAN joka ajolla (~17 000 rivia), ja ajoin sita toistakymmenta
       * kertaa tunnissa saantoa viritellessani. Kanta kaatui 26.10.2026
       * klo 22:5x -- en tieda oliko tama syy, mutta se on uskottava
       * myotavaikuttaja eika tallaista kuormaa tarvita: vika on
       * kaavalahteissa, ja ne voi rajata palvelimella
       * ([[supabase-outage-history]]).
       */
      let kysely = db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "id,name,city,additional_info,metadata"
            : "id,title,municipality,status,metadata"
        )
      if (!process.argv.includes("--kaikki")) {
        kysely = kysely.ilike("metadata->>source_name", "%kaav%")
      }
      const { data: era, error } = await kysely.range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      data.push(...(era ?? []))
      if ((era ?? []).length < 1000) break
    }
    for (const r of data) {
      if (taulu === "potential_projects" && (r.status === "ignored" || r.status === "rejected")) continue
      /*
       * Otsikot kerataan KAIKISTA lahteen riveista, ei vain
       * korjattavista: sanan erottelukyky on lahteen ominaisuus. Jos
       * laskenta tehdaan vain korjattavista, "Ivalon" nayttaa
       * harvinaiselta vaikka se on joka toisen Inarin kaavan nimessa.
       */
      const lahdeNimi = String(r.metadata?.source_name ?? r.metadata?.source ?? "")
      if (lahdeNimi) {
        const otsikot = kaikkiOtsikot.get(lahdeNimi) ?? new Set<string>()
        otsikot.add(String(r.name ?? r.title ?? ""))
        kaikkiOtsikot.set(lahdeNimi, otsikot)
      }
      const kuvaus = String(r.additional_info ?? r.metadata?.description ?? "").replace(/\s+/g, " ").trim()
      if (!kuvaus || kuvaus.length >= 400) continue
      if (jaannos(kuvaus).length >= JAANNOS_RAJA) continue
      const lahde = String(r.metadata?.source_name ?? r.metadata?.source ?? "")
      if (vainLahde && lahde !== vainLahde) continue
      const sivu = String(r.metadata?.documents_url ?? r.metadata?.source_url ?? "")
      if (!/^https?:\/\//i.test(sivu)) continue
      rivit.push({
        taulu,
        id: r.id,
        otsikko: String(r.name ?? r.title ?? ""),
        kuvaus,
        sivu,
        lahde,
        kunta: (r.city ?? r.municipality ?? null) as string | null,
        metadata: r.metadata ?? {},
      })
    }
  }

  console.log(`Korjattavia rivejä: ${rivit.length}\n`)

  /*
   * YLEINEN SANA LAHTEEN SISALLA EI OLE TUNNISTE (D-352).
   *
   * Inarin sivulla joka toisen kaavan nimi alkaa sanalla "Ivalon",
   * joten se osuu toisen kaavan liitteeseen yhta hyvin kuin omaan:
   * *"Ivalon asemakaavan muutos; Perasaajo"* sai Ivalon AMPUMARADAN
   * selostuksen. Kolme aiempaa saantoa (lohkon rajaus, kaavalaji,
   * enintaan kolme osumaa) paastivat sen lapi, koska kaikki katsoivat
   * vain yhta rivia kerrallaan.
   *
   * Erottelukyky on LAHDEKOHTAINEN: sana joka esiintyy saman lahteen
   * monessa otsikossa ei erota niita toisistaan. Lasketaan se
   * aineistosta ([[anchor-vocabulary-per-source]]).
   */
  const lahteenSanat = new Map<string, Map<string, number>>()
  /* Sama kaava on usein seka jonossa etta kannassa; laske otsikot kerran. */
  for (const [lahde, otsikot] of kaikkiOtsikot) {
    const laskuri = new Map<string, number>()
    const nahdyt = new Set<string>()
    for (const otsikko of otsikot) {
      const avain = normalisoi(otsikko)
      if (nahdyt.has(avain)) continue
      nahdyt.add(avain)
      for (const sana of new Set(otsikko.toLowerCase().split(/[^\wäöåÄÖÅ-]+/))) {
        if (sana.length < 6) continue
        laskuri.set(sana, (laskuri.get(sana) ?? 0) + 1)
      }
    }
    lahteenSanat.set(lahde, laskuri)
  }
  const YLEINEN_LAHTEESSA = 2
  const yleinenLahteessa = (lahde: string, sana: string) =>
    (lahteenSanat.get(lahde)?.get(sana) ?? 0) > YLEINEN_LAHTEESSA


  /* Sivu haetaan kerran, vaikka silta tulisi monta riviä. */
  const sivut = new Map<string, any>()
  const syyt = new Map<string, number>()
  const syy = (s: string) => syyt.set(s, (syyt.get(s) ?? 0) + 1)
  let haettu = 0
  let korjattu = 0

  for (const r of rivit) {
    if (haettu >= raja) {
      syy("budjetti täynnä")
      continue
    }

    const osoite = r.sivu.split("#")[0]
    if (!sivut.has(osoite)) {
      try {
        const res = await fetch(osoite, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" })
        sivut.set(osoite, res.ok ? cheerio.load(await res.text()) : null)
      } catch {
        sivut.set(osoite, null)
      }
    }
    const $ = sivut.get(osoite)
    if (!$) {
      syy("sivua ei saatu")
      continue
    }

    /*
     * LOHKO OTSIKON PERUSTEELLA. Otsikkoelementti etsitaan tekstin
     * perusteella, ja liitteet luetaan sen LAHIMMASTA sailiosta --
     * se on kaavan oma lohko riippumatta siita onko se <section>,
     * <div> vai <li>.
     */
    const haluttu = normalisoi(r.otsikko)
    let lohko: any = null
    if (haluttu.length >= 10) {
      /*
       * VAIN OTSIKKOELEMENTTI KELPAA ANKKURIKSI, ja lohkossa saa olla
       * VAIN YKSI otsikko. Ensimmainen versio hyvaksyi myos <a>- ja
       * <strong>-elementit ja minka tahansa sailion jossa on
       * pdf-linkkeja -- ja kuivaharjoitus naytti mihin se johti:
       * Toholammin "Datakeskuksen alueen asemakaava" sai **Ullavan
       * sahkoaseman** OAS:n ja Nivalan opiskelija-asuntola 95 hehtaarin
       * sahkoasema-alueen selostuksen. Kaksi viidesta oli vaaran kaavan
       * tekstia ([[listing-page-is-not-project-page]]).
       *
       * Jos sailiossa on useampi otsikko, se kattaa monta kaavaa eika
       * ole taman kaavan lohko.
       */
      $("h1, h2, h3, h4, summary").each((_: any, el: any) => {
        if (lohko) return
        const t = normalisoi($(el).text())
        if (!t || (t !== haluttu && !t.startsWith(haluttu.slice(0, 40)) && !haluttu.startsWith(t.slice(0, 40)))) return
        let p = $(el).parent()
        for (let i = 0; i < 5 && p.length; i++) {
          if (p.find('a[href*=".pdf"], a[href*=".PDF"]').length) {
            const otsikoita = p.find("h1, h2, h3, h4, summary").length
            if (otsikoita <= 1) lohko = p
            return
          }
          p = p.parent()
        }
      })
    }

    let linkit = lohko ? liitelinkit($, osoite, lohko) : liitelinkit($, osoite)
    linkit = linkit.filter((l) => /\.pdf(\?|$)/i.test(l.href))

    if (!linkit.length) {
      syy(lohko ? "lohkossa ei pdf-liitteitä" : "sivulla ei pdf-liitteitä")
      continue
    }
    /*
     * TIUKKA LOHKO = yksi otsikko ja vahan liitteita. Silloin liitteet
     * ovat varmasti taman kaavan. Muuten nimen on tunnistettava kaava.
     */
    const tiukkaLohko = Boolean(lohko) && linkit.length <= 6
    if (!tiukkaLohko) {
      /*
       * TUNNISTEEN ON EROTELTAVA, EI VAIN OSUTTAVA (D-352). Inarin
       * *"Ivalon asemakaavan muutos; Vilkontie"* osui ensin Ivalon
       * yleiskaavaan ja kaavalajiveton jalkeen Ivalon AMPUMARADAN
       * selostukseen: kylan nimi "Ivalon" on sivun joka toisessa
       * tiedostossa. Jos sama tunniste osuu moneen eri liitteeseen, se
       * ei yksiloi kaavaa -- erotteleva sana ("Vilkontie") ei loydy
       * mistaan, ja oikea vastaus on tyhja.
       */
      const omat = linkit.filter((l) =>
        osuukoKaavaan(l, r.otsikko, r.kunta, (sana) => yleinenLahteessa(r.lahde, sana))
      )
      if (!omat.length) {
        syy(`liitteen nimi ei tunnista kaavaa (${linkit.length} linkkiä)`)
        continue
      }
      if (omat.length > 3) {
        syy(`tunniste ei erottele (${omat.length} liitettä osuu)`)
        continue
      }
      linkit = omat
    }

    const asiakirja = valitseKaavanAsiakirja(linkit)
    if (!asiakirja) {
      syy("ei selostusta eikä OAS:ia")
      continue
    }

    haettu += 1
    const teksti = await haeKaavaselostuksenTeksti(asiakirja)
    if (!teksti) {
      syy("liitettä ei saatu luettua")
      continue
    }
    const uusi = kaavanKuvausTekstista(teksti)
    if (!uusi) {
      syy("selostuksesta ei lukua")
      if (process.argv.includes("--tutki")) {
        const otsikot = teksti
          .split("\n")
          .filter((x) => /^\s*\d+(\.\d+)*\.?\s+\S/.test(x))
          .slice(0, 8)
          .map((x) => x.trim().slice(0, 48))
        console.log(`EI LUKUA  ${r.otsikko.slice(0, 40)}  [${r.lahde.slice(0, 26)}]`)
        console.log(`          ${decodeURIComponent(asiakirja.split("/").pop() ?? "").slice(0, 60)}`)
        console.log(`          otsikot: ${otsikot.join(" | ") || "(ei numeroituja otsikoita)"}`)
      }
      continue
    }
    if (uusi.length < 120) {
      syy("luku liian lyhyt")
      continue
    }
    /*
     * MERKISTORIKKO POIS (D-352). Kannuksen Tuohirameen OAS purkautui
     * muodossa "Tuohir‰meen tuulivoimapuiston" -- fontin merkkikartta
     * puuttuu, ja teksti on asiakkaalle lukukelvotonta
     * ([[unreadable-pdf-fonts]]). Tyhja on parempi kuin rikki.
     */
    const rikki = (uusi.match(/[‰ÃÂ¤¶•�]/g) ?? []).length
    if (rikki > 0 && rikki / uusi.length > 0.002) {
      syy("merkistö rikki")
      continue
    }

    korjattu += 1
    console.log(`\n${r.taulu === "projects" ? "HANKE" : "JONO "} [${r.lahde.slice(0, 34)}] ${r.otsikko.slice(0, 48)}`)
    console.log(`   vanha (${r.kuvaus.length}): ${r.kuvaus.slice(0, 70)}`)
    console.log(`   liite: ${decodeURIComponent(asiakirja.split("/").pop() ?? "").slice(0, 60)}${lohko ? "  [lohko]" : "  [koko sivu]"}`)
    console.log(`   UUSI (${uusi.length}): ${uusi.slice(0, 240)}`)

    if (!apply) continue

    const md = {
      ...r.metadata,
      description: uusi,
      kuvaus_selostuksesta: { liite: asiakirja, milloin: new Date().toISOString().slice(0, 10) },
    }
    const paivitys: Record<string, any> = { metadata: md }
    if (r.taulu === "projects") paivitys.additional_info = uusi

    const { error } = await db.from(r.taulu).update(paivitys).eq("id", r.id)
    if (error) console.error(`   VIRHE: ${error.message}`)
  }

  console.log(`\n=== Korjattu ${korjattu} / ${rivit.length}, PDF-hakuja ${haettu} ===`)
  for (const [s, n] of [...syyt.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(4)}  ${s}`)
  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
