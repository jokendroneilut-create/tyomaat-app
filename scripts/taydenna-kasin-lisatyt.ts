import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KASIN LISATTYJEN HANKKEIDEN KUVAUS NIIDEN OMASTA OSOITTEESTA.
 *
 * Johannes lisasi 333 hanketta kasin helmi-huhtikuussa 2026, ennen kuin
 * keraimia oli nykymuodossaan. Niilla ei ole lahdetta eika kuvausta,
 * mutta 166:lla on `metadata.source_url`.
 *
 * MIKSI JUURI NAMA: mitattu 11.10.2026 etta asiakkaan ohuista osumista
 * puolet (245 / 490) kohdistuu naihin riveihin — enemman kuin mihinkaan
 * muuhun lahteeseen. Otos 12 tasavalein: 12/12 osoitetta vastasi ja
 * kaikilla oli 1 455-6 876 merkkia tekstia.
 *
 * Poiminta on sama kuin yritystiedotteilla (`extractReleaseBody`):
 * pisin siivottu lohko, hanta ja sivupohja pois. Se on tarpeen, koska
 * naiden sivujen PISIN KAPPALE on usein yrityksen vakioesittely
 * ("Skanska on yksi maailman johtavista...").
 *
 *   npx tsx scripts/taydenna-kasin-lisatyt.ts
 *   npx tsx scripts/taydenna-kasin-lisatyt.ts --apply
 */

const MIN_KUVAUS = 200
const MAX_KUVAUS = 1500
const VIIVE_MS = 400

/*
 * EVASTEBANNERI ALUSSA. inderes.fi:n tiedote alkoi sanoilla
 * "YksityisyysasetuksetInderes kayttaa evasteita tarjotakseen paremman
 * kayttokokemuksen... Hyvaksy kaikkiVain..." — teksti on oikea, mutta
 * alussa on suostumuslomake.
 */
const EVASTEROSKA =
  /^.{0,600}?(hyvaksy kaikki|hyvaksy valitut|salli kaikki evasteet|hyväksy kaikki|hyväksy valitut|salli kaikki evästeet)[^.]{0,80}?(?=[A-ZÄÖ])/i

/*
 * NAVIGAATIO EI OLE KUVAUS. Kouvolan Dynasty-sivulta tuli
 * "Dynasty tietopalvelu Siirry suoraan paasisaltoon Kouvolan kaupunki
 * RSS Haku RSS-linkkiKokousasiat:https://..." — pelkkaa valikkoa.
 */
const NAVIROSKA =
  /siirry suoraan p(ä|a)(ä|a)sis(ä|a)lt(ö|o)(ö|o)n|dynasty tietopalvelu|rss-linkki|evästeasetukset|hyppää sisältöön|virhe päätöstä ladattaessa|went wrong loading decision|kirjaudu sisään tiedotteet|uutishuoneet tilaa tiedotteita|tietoa palvelusta yhteydenotto/i

function onNavigaatiota(teksti: string): boolean {
  if (NAVIROSKA.test(teksti.slice(0, 400))) return true
  /* Kaksi osoitetta alussa = linkkilista, ei leipatekstia. */
  return (teksti.slice(0, 400).match(/https?:\/\//g) ?? []).length >= 2
}

/*
 * TIEDOTTEEN ALOITUSSANA ON PAREMPI ANKKURI KUIN EVASTELISTA.
 *
 * inderes.fi:n sivulla ennen varsinaista tekstia on evastebanneri,
 * vastuuvapauslauseke JA tekijanoikeusrivi — niita ei saa kiinni
 * yhdella hahmolla. Sen sijaan tiedote alkaa lahes aina sanalla
 * "Lehdistotiedote", "Tiedote" tai vastaavalla. Leikataan kaikki
 * VIIMEISEN aloitussanan edelta, jos sellainen on alkupaassa.
 */
const ALOITUSSANA =
  /(lehdist(ö|o)tiedote|pressmeddelande|press release|sijoittajauutinen|artikkeli julkaistu:?|tiedote)\s*/gi

function leikkaaAlkuroska(teksti: string): string {
  let viimeinen = -1
  let loppu = -1
  /*
   * IKKUNA ON KAPEA TAHALLAAN. 800 merkin ikkuna soi oikeaa tekstia:
   * Hartelan tiedote alkoi "Rakentaminen on alkanut maaliskuussa 2025,
   * ja kohde valmistuu alkusyksysta 2026..." ja sana "tiedote" esiintyi
   * vasta myohemmin — leikkaus vei alun pois. Sivupohja on lyhyt, joten
   * 150 merkkia riittaa.
   */
  for (const osuma of teksti.slice(0, 150).matchAll(ALOITUSSANA)) {
    viimeinen = osuma.index!
    loppu = osuma.index! + osuma[0].length
  }
  if (viimeinen < 0) return teksti
  const jaljella = teksti.slice(loppu).trim()
  /* Tyhja on pahempi kuin roskainen alku. */
  return jaljella.length >= MIN_KUVAUS ? jaljella : teksti
}

/*
 * Sivun kategorialinkit tekstina: "Ajankohtaista Rakentaminen
 * Toimitilarakentaminen Fira Oy ja Tokmanni ovat..."
 *
 * TARKISTUS ON KOODISSA, EI KUVIOSSA. Regexin `i`-lippu tekee
 * lookaheadista `(?=[A-ZÄÖÅ])` hyodyttoman, koska se osuu myos pieniin
 * kirjaimiin — ja silloin saanto soi virkkeen alun: "Rakentaminen on
 * alkanut maaliskuussa 2025" -> "on alkanut maaliskuussa 2025".
 * Kategoriasana poistetaan vain jos SEURAAVA sana alkaa isolla.
 */
const KATEGORIASANAT = new Set([
  "ajankohtaista",
  "uutiset",
  "tiedotteet",
  "media",
  "projektit",
  "kodit",
  "takaisin",
  "rakentaminen",
  "toimitilarakentaminen",
  "asuntorakentaminen",
  "asuntokirjasto",
  "vieraskynä",
  "kategoriat",
])

function poistaKategoriat(teksti: string): string {
  let t = teksti
  for (let i = 0; i < 4; i++) {
    const osat = t.split(/\s+/)
    if (osat.length < 3) break
    const eka = osat[0].replace(/[|›>-]$/, "").toLowerCase()
    if (!KATEGORIASANAT.has(eka)) break
    const seuraava = osat[1] ?? ""
    if (!/^[A-ZÄÖÅ]/.test(seuraava)) break
    t = osat.slice(1).join(" ")
  }
  return t
}

/*
 * Aloitussanan jalkeen jaa viela pikkuroskaa: pilkku ja kellonaika
 * ("...Lehdistotiedote, 30.1.2026 kello 14:00Toivo Group Oyj"),
 * jakonappi ("share") tai pelkka paivays. Siistitaan kaksi kierrosta,
 * koska ne esiintyvat perakkain.
 */
function siistiAlku(teksti: string): string {
  let t = poistaKategoriat(teksti)
  for (let i = 0; i < 2; i++) {
    t = poistaKategoriat(t)
    t = t
      .replace(/^[\s,.:;|–-]+/, "")
      /* Murupolku: "Etusivu > Ajankohtaista > Tiedotteet > ..." */
      .replace(/^(etusivu|home|frontpage)\s*[>|›/]\s*([^>|›/]{1,40}[>|›/]\s*){0,4}/i, "")
      /* Videokehotteet ja ePressin sivupalkki. */
      .replace(/^(selaimesi ei tue videota|your browser does not support the video tag\.?)+\s*/i, "")
      .replace(/^kooste\s+sosiaalinen media[\s\S]{0,180}?twitter(\s+facebook\s+twitter)?\s*/i, "")
      /* "Olli Urpela Viestintapaallikko ..." — kirjoittajarivi ilman otsikkoa. */
      .replace(
        /^[A-ZÄÖÅ][a-zäöå]+\s+[A-ZÄÖÅ][a-zäöå]+\s+(viestint(ä|a)|markkinointi|tiedotus)[a-zäöå-]*(p(ä|a)(ä|a)llikk(ö|o)|johtaja)\s+/,
        ""
      )
      /* "Kirjoittaja X Viestintapaallikko Kategoriat Ajankohtaista ..." */
      .replace(/^(kirjoittaja|vieraskynä)\s+[A-ZÄÖÅ][^.]{0,60}?(kategoriat|ajankohtaista|rakentaminen)\s+/i, "")
      .replace(/^(share|jaa|tulosta|print|kopioi linkki)\s+/i, "")
      .replace(/^\d{1,2}\.\d{1,2}\.\d{4}(\s+kello\s+\d{1,2}[:.]\d{2})?\s*/, "")
      .trim()
  }
  return t
}

/* Katkaisu virkkeen rajalta, kuten muissakin poimijoissa. */
function rajaaPituus(teksti: string): string {
  if (teksti.length <= MAX_KUVAUS) return teksti
  const leikattu = teksti.slice(0, MAX_KUVAUS)
  const piste = leikattu.lastIndexOf(". ")
  return piste > MAX_KUVAUS * 0.5 ? leikattu.slice(0, piste + 1) : `${leikattu.trim()}…`
}

/*
 * OSUUKO TEKSTI TAHAN HANKKEESEEN? Sivakan "Tulevia kohteita"
 * -listaussivu antoi tekstia, muttei tasta kohteesta. Vaaditaan etta
 * hankkeen kunta tai nimen harvinainen sana esiintyy tekstissa.
 */
const YLEISSANA =
  /^(kerrostalo|rivitalo|asuinkerrostalo|hanke|rakennus|uusi|uudet|asunnot|asuntoja|koteja|laajennus|peruskorjaus|saneeraus|toimitilat|alue|alueen|keskus)$/i

function osuukoHankkeeseen(teksti: string, nimi: string, kunta: string): boolean {
  const matala = teksti.toLowerCase()
  if (kunta && matala.includes(kunta.toLowerCase().slice(0, Math.max(4, kunta.length - 2))))
    return true
  for (const sana of nimi.split(/[^\wäöåÄÖÅ-]+/)) {
    if (sana.length < 6 || YLEISSANA.test(sana)) continue
    const kanta = sana.length > 7 ? sana.slice(0, -2) : sana
    if (matala.includes(kanta.toLowerCase())) return true
  }
  return false
}

/* Sovitut rajaukset: naihin isantiin ei kohdisteta pyyntoja. */
const KIELLETYT =
  /mfiles\.lappeenranta\.fi|asiakirjat\.ouka\.fi|tweb|hyvinkaa\.fi|vantaa\.fi\/paatokset/i

function normalisoi(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}

async function main() {
  const apply = process.argv.includes("--apply")
  const raja = Number(process.argv.find((a) => /^--raja=\d+$/.test(a))?.split("=")[1] ?? 0)

  const { createClient } = await import("@supabase/supabase-js")
  const { extractReleaseBody } = await import("../lib/agent/companyRelease")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  const SIVU = 500
  for (let f = 0; f < 60000; f += SIVU) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, additional_info, metadata")
      .range(f, f + SIVU - 1)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as any[]) {
      const md = r.metadata ?? {}
      if (md.source_name || md.source) continue
      if (String(r.additional_info ?? "").trim().length >= MIN_KUVAUS) continue
      const url = String(md.source_url ?? md.last_source_url ?? "").trim()
      if (!/^https?:\/\//.test(url)) continue
      if (KIELLETYT.test(url)) continue
      rivit.push({ ...r, url })
    }
    if (data.length < SIVU) break
  }

  const kohteet = raja ? rivit.slice(0, raja) : rivit
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`kasin lisattyja ohuita joilla osoite: ${rivit.length}, kasitellaan ${kohteet.length}\n`)

  /*
   * SAMA TEKSTI KOLMELLE ERI HANKKEELLE = SIVU EI KERRO HANKKEESTA.
   *
   * Pohjola Rakennuksen "Ihanat kodit" -brandisivu ("Kohtaa luonnonvalo
   * jo ulko-ovella, Horisontti-filosofiamme mukaan...") olisi mennyt
   * viiden eri hankkeen kuvaukseksi. Kahden hankkeen jakama teksti on
   * yha kelvollinen: Caverionin tiedote kattaa aidosti kaksi
   * sahkoasemaa.
   */
  const SAMA_RAJA = 3
  const tekstiLaskuri = new Map<string, number>()
  const ehdotukset: {
    r: any
    nykyinen: string
    teksti: string
    uusi: string
    sisaltyy: boolean
    avain: string
  }[] = []

  let parani = 0
  let sailytetty = 0
  const syyt = new Map<string, number>()
  const syy = (s: string) => syyt.set(s, (syyt.get(s) ?? 0) + 1)

  for (const r of kohteet) {
    const nykyinen = String(r.additional_info ?? "").trim()

    let html = ""
    try {
      const ohjain = new AbortController()
      const kello = setTimeout(() => ohjain.abort(), 20000)
      const vastaus = await fetch(r.url, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: ohjain.signal,
      })
      clearTimeout(kello)
      if (!vastaus.ok) {
        syy(`HTTP ${vastaus.status}`)
        continue
      }
      html = await vastaus.text()
    } catch {
      syy("haku epaonnistui")
      continue
    } finally {
      await new Promise((r) => setTimeout(r, VIIVE_MS))
    }

    const raaka = extractReleaseBody(html)
    if (!raaka) {
      syy("sivulta ei saatu tekstia")
      continue
    }
    if (onNavigaatiota(raaka)) {
      syy("navigaatiota tai linkkilista")
      continue
    }
    const teksti = rajaaPituus(siistiAlku(leikkaaAlkuroska(raaka.replace(EVASTEROSKA, "").trim())))
    if (teksti.length < MIN_KUVAUS || teksti.length <= nykyinen.length) {
      syy("teksti liian lyhyt")
      continue
    }
    if (!osuukoHankkeeseen(teksti, String(r.name ?? ""), String(r.city ?? ""))) {
      syy("teksti ei liity tahan hankkeeseen")
      continue
    }

    /*
     * Vanhaa ei poisteta. Jos se ei sisally uuteen eika ole pelkka
     * hankkeen nimi, se sailyy merkittyna perassa (sama saanto kuin
     * scripts/synkronoi-kuvaus-nakyviin.ts).
     */
    const pelkkaNimi = normalisoi(nykyinen) === normalisoi(String(r.name ?? ""))
    const sisaltyy =
      !nykyinen || pelkkaNimi || normalisoi(teksti).includes(normalisoi(nykyinen))
    const uusi = sisaltyy ? teksti : `${teksti}\n\nAiempi merkintä: ${nykyinen}`

    const avain = normalisoi(teksti).slice(0, 300)
    tekstiLaskuri.set(avain, (tekstiLaskuri.get(avain) ?? 0) + 1)
    ehdotukset.push({ r, nykyinen, teksti, uusi, sisaltyy, avain })
  }

  for (const e of ehdotukset) {
    const { r, nykyinen, teksti, uusi, sisaltyy } = e
    if ((tekstiLaskuri.get(e.avain) ?? 0) >= SAMA_RAJA) {
      syy(`sama teksti ${tekstiLaskuri.get(e.avain)} hankkeelle — ei hankekohtainen sivu`)
      continue
    }
    if (!sisaltyy) sailytetty += 1

    parani += 1
    console.log("=".repeat(98))
    console.log(`${String(r.name).slice(0, 70)}`)
    console.log(`  ${nykyinen.length} -> ${uusi.length} merkkia  ${String(r.url).slice(0, 72)}`)
    console.log(`  ${teksti.slice(0, 260)}${teksti.length > 260 ? "…" : ""}`)
    if (!sisaltyy) console.log(`  (aiempi merkintä säilytetty: ${nykyinen.slice(0, 80)})`)

    if (!apply) continue

    const { error } = await db
      .from("projects")
      .update({
        additional_info: uusi,
        metadata: {
          ...(r.metadata ?? {}),
          description: uusi,
          description_from_url_at: new Date().toISOString(),
        },
      })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE: ${error.message}`)
  }

  console.log("=".repeat(98))
  console.log(`parani ${parani} / ${kohteet.length}, aiempi merkinta sailytetty ${sailytetty}`)
  console.log("syyt joilla ei parantunut:")
  for (const [s, n] of [...syyt.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${s}`)
  }
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
