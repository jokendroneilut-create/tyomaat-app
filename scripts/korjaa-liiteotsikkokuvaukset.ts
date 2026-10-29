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
import { liitelinkit, lohkonLinkit, OHUEN_KUVAUKSEN_RAJA } from "../lib/agent/kaavanLiite"

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
 * Saanto siirrettiin `lib/agent/kaavanLiite.ts`:aan D-362:ssa, jotta
 * myos yhden rivin korjaustyokalu kayttaa samaa — se kirjoitti ilman
 * sita vaaran kaavan kuvauksen ([[same-term-two-definitions]]).
 */
import { osuukoKaavaan, tunnisteet } from "../lib/agent/kaavanLiite"

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

  /*
   * SIVU KERRALLAAN, EI KASAAMISTA (D-356).
   *
   * Edellinen versio keräsi kaikki rivit muistiin ennen suodatusta ja
   * Node kaatui `JavaScript heap out of memory` -virheeseen: 17 000
   * riviä metadatoineen ei mahdu. Nyt jokainen sivu kasitellaan heti ja
   * vain ehdokkaat jaavat muistiin -- sama kevennys kuin kyselyssa.
   */
  for (const taulu of ["projects", "potential_projects"] as const) {
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
      /*
       * EI ILIKE JSON-KENTTAAN (D-356). `ilike("metadata->>source_name",
       * "%kaav%")` on taulun taysi skannaus ilman indeksia, ja
       * `projects`-taulussa se kaatui kannan aikakatkaisuun
       * (statement timeout). Haetaan sivuttaen ja suodatetaan
       * JavaScriptissa -- yksi kevyt lapikaynti per ajo, ei
       * indeksoimatonta hakua.
       */
      const { data: era, error } = await kysely.range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      for (const r of (era ?? []) as any[]) {
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
      /*
       * KYNNYS ON MODUULIN OMA, EI VAIN LIITEOTSIKKOTESTI (D-356).
       *
       * Johannes 29.10.2026 Muuramen Kiuastiesta: *"tasta ei ole
       * poimittu tarkoitusta"*. Rivin kuvaus oli 118 merkkia OIKEAA
       * tekstia (kaava-alueen sijainti), joten liiteotsikkotesti ei
       * poiminut sita -- mutta selostuksen tarkoitusluku puuttui silti.
       * `kaavanLiite.ts` pitaa alle 300 merkin kuvausta ohuena, ja sama
       * kynnys patee tassa.
       */
      if (!kuvaus) continue
      /*
       * JO KASITELTY EI PALAA JONOON (D-356). Osa selostuksista antaa
       * alle 300 merkin luvun, jolloin rivi jaa kynnyksen alle ja
       * valikoituu uudelleen joka ajolla -- toinen erä poltti 40
       * PDF-hakua kahteen riviin, jotka oli jo korjattu. Tunniste
       * kertoo etta juuri tama ajo on kasitellyt rivin
       * ([[backfill-marker]]).
       */
      if (r.metadata?.kuvaus_selostuksesta) continue
      const liiteotsikot = jaannos(kuvaus).length < JAANNOS_RAJA && kuvaus.length < 400
      if (!liiteotsikot && kuvaus.length >= OHUEN_KUVAUKSEN_RAJA) continue
      const lahde = String(r.metadata?.source_name ?? r.metadata?.source ?? "")
      if (!process.argv.includes("--kaikki") && !/kaav/i.test(lahde)) continue
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
      if ((era ?? []).length < 1000) break
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
  /*
   * VAIN YKSI SIVU KERRALLAAN MUISTISSA (D-356). Sivut pidettiin
   * Mapissa, ja cheerio-dokumentti on megatavuja: sadan sivun jalkeen
   * Node kaatui vaikka rivit itse oli jo kevennetty. Rivit jarjestetaan
   * sivun mukaan, jolloin jokainen sivu haetaan tasan kerran ja
   * vapautuu kun osoite vaihtuu.
   */
  rivit.sort((a, b) => a.sivu.split("#")[0].localeCompare(b.sivu.split("#")[0]))
  let avoinOsoite: string | null = null
  let avoinSivu: any = null
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
    if (avoinOsoite !== osoite) {
      avoinSivu = null
      avoinOsoite = osoite
      try {
        const res = await fetch(osoite, { headers: { "user-agent": "Mozilla/5.0" }, cache: "no-store" })
        avoinSivu = res.ok ? cheerio.load(await res.text()) : null
      } catch {
        avoinSivu = null
      }
    }
    const $ = avoinSivu
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
    /*
     * LOHKO OTSIKOSTA ETEENPAIN (D-353). Kaavan liitteet ovat otsikon
     * JALKEEN, ja lohko loppuu seuraavaan samantasoiseen otsikkoon.
     * Aiempi yritys etsi lohkoa otsikon isannasta ylospain ja osui joko
     * liian laajaan sailioon tai ei mihinkaan.
     */
    const haluttu = normalisoi(r.otsikko)
    const lohkoLinkit =
      haluttu.length >= 10
        ? lohkonLinkit($, osoite, r.otsikko, (sivulla, haettu) => {
            const a = normalisoi(sivulla)
            const b = normalisoi(haettu)
            return (
              a.length >= 10 &&
              b.length >= 10 &&
              (a === b || a.startsWith(b.slice(0, 40)) || b.startsWith(a.slice(0, 40)))
            )
          })
        : null
    const lohko = null

    let linkit = lohkoLinkit ?? liitelinkit($, osoite).filter((l) => /\.pdf(\?|$)/i.test(l.href))

    if (!linkit.length) {
      syy(lohkoLinkit ? "lohkossa ei pdf-liitteitä" : "sivulla ei pdf-liitteitä")
      continue
    }
    /*
     * TIUKKA LOHKO = yksi otsikko ja vahan liitteita. Silloin liitteet
     * ovat varmasti taman kaavan. Muuten nimen on tunnistettava kaava.
     */
    /* Lohko on kaavan oma, joten nimen tunnistusta ei tarvita. */
    const tiukkaLohko = Boolean(lohkoLinkit) && linkit.length <= 8
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
    /*
     * TAUKO HAKUJEN VALIIN. Rivit on jarjestetty sivun mukaan, joten
     * perakkaiset haut osuvat samaan kuntaan. Puoli sekuntia pitaa
     * tahdin inhimillisena pitkassakin ajossa.
     */
    if (haettu > 1) await new Promise((r) => setTimeout(r, 500))
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
    console.log(`   liite: ${decodeURIComponent(asiakirja.split("/").pop() ?? "").slice(0, 60)}${lohkoLinkit ? "  [lohko]" : "  [koko sivu]"}`)
    console.log(`   UUSI (${uusi.length}): ${uusi.slice(0, 240)}`)

    if (!apply) continue

    /*
     * METADATA HAETAAN VASTA KIRJOITETTAESSA (D-356). Ehdokkaita on yli
     * 2 000, ja niiden metadatan pitaminen muistissa kaatoi Noden
     * (`JavaScript heap out of memory`). Kirjoitettavia on enintaan
     * budjetin verran, joten yksi lisahaku per rivi on halpa.
     */
    const { data: nykyinenRivi } = await db.from(r.taulu).select("metadata").eq("id", r.id).single()
    const md = {
      ...((nykyinenRivi as any)?.metadata ?? {}),
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
