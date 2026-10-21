import * as cheerio from "cheerio"

import { detectCityFromText } from "./detectCityFromText"
import { PHASE_LABELS } from "@/lib/projects/phases"
import { poimiUrakoitsijat } from "@/lib/agent/poimiUrakoitsija"

/*
 * FINGRIDIN KANTAVERKKOHANKKEET.
 *
 * MIKSI. Tämä on se aukko joka on ollut tiedossa pisimpään: yksityiset
 * ja valtakunnalliset suurhankkeet eivät osu Hilmaan, kunnan päätöksiin
 * eivätkä kaavoihin ([[private-developer-blind-spot]]). Kantaverkon
 * liityntä- ja voimajohtohankkeet ovat juuri niitä — ja ne ennakoivat
 * teollisuusinvestointeja, koska tehdas tarvitsee sähkön ennen seiniä.
 *
 * Fingrid nousi esiin myös lähdekartoituksessa 15.10.2026: se esiintyy
 * rakennuttajana 30 hankkeessamme ja rakentajana yhdessä, enemmän kuin
 * yksikään muu yritys jolla ei ollut lähdettä.
 *
 * MITÄ LÄHDE ANTAA. Mitattu 15.10.2026: listaussivulla 52 hanketta,
 * koko joukon haku 2,8 s. Jokaisella sivulla on nimetyt kentät
 * ("Hankkeen tyyppi", "Hankkeen tila", "Sijainti", "Pituus") ja
 * 2 135-32 123 merkin kuvaus.
 *
 * Tilajakauma: Suunnittelu 17, Rakentaminen 16, Ympäristöselvitys 11,
 * YVA-menettely 6, valmistunut 1. **50 / 52 on kesken** — toisin kuin
 * urakoitsijoiden referenssisivuilla, joissa valtaosa on historiaa.
 *
 * VAIHE TULEE LÄHTEESTÄ, EI ARVAUKSESTA. Fingrid kertoo sen itse, ja
 * se osuu suoraan omiin vaiheisiimme. Valmistuneita ei tuoda: valmis
 * voimajohto ei ole mahdollisuus (sama päätös kuin GRK ja NRC).
 */

const LISTAUS_URL = "https://www.fingrid.fi/kantaverkko/rakentaminen/hankkeet/"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

const CONCURRENCY = 6

/* Kentät jotka sivulla on nimettyinä; tarvitaan myös arvon rajaamiseen. */
const KENTAT = [
  "Hankkeen tyyppi",
  "Hankkeen tila",
  "Hankkeen sijainti",
  "Sijainti",
  "Pituus",
  "Aikataulu",
  "Hankkeen tiedot",
]

export function hankeslugit(html: string): string[] {
  const osumat = [
    ...html.matchAll(/href="\/kantaverkko\/rakentaminen\/hankkeet\/([^"/]+)\//g),
  ].map((m) => m[1])

  return [...new Set(osumat)]
}

/*
 * Arvo luetaan seuraavaan nimettyyn kenttään asti. Lookahead-regex oli
 * tähän liian hauras: se palautti 51 tapauksessa 52:sta tyhjän, koska
 * kenttien välissä ei ole välimerkkiä vaan pelkkä välilyönti.
 */
export function lueKentta(teksti: string, nimi: string): string | null {
  const alku = teksti.indexOf(nimi + ":")
  if (alku < 0) return null

  const loppuun = teksti.slice(alku + nimi.length + 1)
  const seuraavat = KENTAT.map((o) => loppuun.indexOf(o + ":")).filter((i) => i > 0)
  const loppu = seuraavat.length ? Math.min(...seuraavat) : 120

  return loppuun.slice(0, loppu).trim().slice(0, 100) || null
}

/*
 * Fingridin oma tila -> meidän vaiheemme. YVA ja ympäristöselvitys ovat
 * hankkeen aikaisin julkinen vaihe, eli juuri se mitä asiakas haluaa
 * nähdä ennen kilpailutusta.
 */
export function vaiheTilasta(tila: string | null): string | null {
  const t = String(tila ?? "").toLowerCase()
  if (!t) return null
  if (t.includes("valmistunut")) return null
  if (t.includes("rakentaminen") || t.includes("toteutukse")) return PHASE_LABELS.construction
  if (t.includes("suunnittelu")) return PHASE_LABELS.planning
  /*
   * YVA JA YMPÄRISTÖSELVITYS -> SUUNNITTELU, EI IDEOINTI (18.10.2026).
   *
   * D-289 valitsi näille `idea`-vaiheen, koska YVA on hankkeen
   * varhaisin julkinen vaihe. Johannes kysyi: *"ideointi vaihetta ei
   * minusta enää ole eikä käytetä vaan suunnittelu?"*
   *
   * Mitattu ennen muutosta: **0 / 6 896 hyväksytyssä hankkeessa** oli
   * Ideointi-vaihe, ja jonon viidestä rivistä neljä tuli tästä
   * kuviosta — Fingrid oli käytännössä ainoa lähde joka sitä tuotti.
   *
   * **Vaihe on sittemmin poistettu kokonaan** (`lib/projects/phases.ts`),
   * joten tämän kuvion on pakko osoittaa muualle; `PHASE_LABELS.idea`
   * ei ole enää olemassa.
   */
  if (t.includes("yva") || t.includes("ympäristö")) return PHASE_LABELS.planning
  /* Tuntematon tila ei ole valmistunut, joten se otetaan mukaan. */
  return PHASE_LABELS.planning
}

export function jasennaHankesivu(html: string): {
  otsikko: string
  teksti: string
  tyyppi: string | null
  tila: string | null
  sijainti: string | null
  yhteyshenkilot: FingridYhteyshenkilo[]
} | null {
  /*
   * Yhteyshenkilöt luetaan ALKUPERÄISESTÄ htmlistä, ennen poistoja ja
   * ennen `.content-text`-rajausta: "Lisätietoja"-lohko on sen ulkopuolella.
   */
  const yhteyshenkilot = jasennaYhteyshenkilot(html)

  const $ = cheerio.load(html)
  $("script,style,noscript,nav,header,footer").remove()

  const otsikko = $("h1").first().text().replace(/\s+/g, " ").trim()
  if (!otsikko) return null

  /*
   * `.content-text` on artikkelin oma lohko. Koko `.content` sisältäisi
   * sivupalkin, jossa on kaikkien 52 hankkeen nimet — ne vuotaisivat
   * jokaisen hankkeen kuvaukseen.
   */
  const teksti = $(".content-text").first().text().replace(/\s+/g, " ").trim()
  if (!teksti) return null

  return {
    otsikko,
    teksti,
    tyyppi: lueKentta(teksti, "Hankkeen tyyppi"),
    tila: lueKentta(teksti, "Hankkeen tila"),
    sijainti: lueKentta(teksti, "Hankkeen sijainti") ?? lueKentta(teksti, "Sijainti"),
    yhteyshenkilot,
  }
}

/*
 * YHTEYSHENKILÖT HANKESIVUN "LISÄTIETOJA"-LOHKOSTA.
 *
 * Johannes 18.10.2026 Anttila–Länsisalmi-hankkeesta: *"ei ole poimittu
 * yhteyshenkilöitä vaikka ne ovat saatavilla."* Sivulla on neljä
 * nimeä nimikkeineen ja puhelinnumeroineen, eikä yhtään ollut kannassa.
 *
 * Lohko on `div.well`, jonka `h3.title` on "Lisätietoja". Jokainen
 * henkilö on oma `<p>`, jossa rivit erottaa `<br>`:
 *
 *     <p><strong>Maria Arola</strong><br />
 *        Asiantuntija, ympäristö<br />
 *        puh. 030 395 5562</p>
 *
 * `<br>` ON KORVATTAVA RIVINVAIHDOLLA ennen tekstin lukemista.
 * `.text()` liittää rivit ilman välimerkkiä, jolloin tuloksena on
 * "Maria ArolaAsiantuntija, ympäristöpuh. 030 395 5562" eikä nimeä voi
 * erottaa nimikkeestä.
 *
 * Lohkossa on myös väliotsikoita ("YVA-menettely", "Yleissuunnittelu")
 * omina `<p>`-elementteinään. Ne karsiutuvat nimikuviolla: väliotsikko
 * on yksi sana eikä kaksi isolla alkavaa.
 *
 * SÄHKÖPOSTIA EI PÄÄTELLÄ, vaikka sivu kertoo säännön
 * ("Sähköpostiosoitteemme ovat muotoa etunimi.sukunimi@fingrid.fi").
 * Sääntö ei kerro miten ä ja ö kirjoitetaan osoitteessa, ja väärä
 * osoite on pahempi kuin tyhjä kenttä: viesti menee olemattomaan
 * osoitteeseen tai väärälle henkilölle.
 */
export type FingridYhteyshenkilo = {
  nimi: string
  nimike: string | null
  puhelin: string | null
  /* null kun nimike paljastaa toisen tyonantajan, ks. MUU_TYONANTAJA. */
  organisaatio: string | null
}

/*
 * MAATUNNUS ON SALLITTAVA. Ensimmäinen versio vaati numeron heti
 * "puh."-sanan jälkeen, joten muoto "puh. +358 30 395 5190" ei
 * osunut — ja silloin numero jäi NIMIKKEESEEN ("Vanhempi
 * projektipäällikkö puh. +358303955…") ja puhelinkenttä tyhjäksi.
 * Mitattu kolmella rivillä seitsemästä.
 */
const PUHELIN = /\bpuh\.?\s*(\+?[0-9][0-9\s\-()]{6,})/i

/*
 * TOISEN YHTIÖN TYÖNTEKIJÄ EI OLE FINGRIDIN YHTEYSHENKILÖ.
 *
 * Mitattu: Huittinen–Forssa-sivulla on "Jaakko Marttila,
 * Electromontaj S.A. projektipäällikkö" — urakoitsijan väkeä.
 * Organisaatioksi ei saa kirjata Fingridiä, koska se olisi väärä
 * tieto; nimike kertoo oikean työnantajan.
 */
const MUU_TYONANTAJA = /\b(?:Oy|Oyj|Ab|Abp|S\.?A\.?|GmbH|AS|A\/S|Ltd|Group)\b/

/* Kaksi tai kolme isolla alkavaa sanaa: "Maria Arola", "Eero Kujanen". */
const HENKILONIMI = /^[A-ZÅÄÖ][a-zåäö-]+(?:\s+[A-ZÅÄÖ][a-zåäö-]+){1,2}$/

/*
 * YRITYS EI OLE HENKILÖ.
 *
 * Mittaus 52 sivun yli antoi 154 henkilöä, joista kolme oli muuta:
 * "Destia Oy", "Eltel Networks Oy" ja "Rakennuttaja Fingrid Oyj".
 * Nimikuvio hyväksyi ne, koska "Oy" kelpaa isolla alkavaksi sanaksi.
 */
const EI_HENKILO = /\b(?:Oy|Oyj|Ab|Abp|Ky|Ltd|Group)\b|^(?:Rakennuttaja|Urakoitsija|Tilaaja|Pääurakoitsija|Toimittaja)\b/i

export function jasennaYhteyshenkilot(html: string): FingridYhteyshenkilo[] {
  const $ = cheerio.load(html)
  const out: FingridYhteyshenkilo[] = []
  const nahdyt = new Set<string>()

  $("div.well").each((_, el) => {
    const otsikko = $(el).find("h3.title").first().text().trim()
    if (!/lis[äa]tietoj/i.test(otsikko)) return

    $(el)
      .find("p")
      .each((__, pp) => {
        const rivit = ($(pp).html() ?? "")
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&auml;/g, "ä")
          .replace(/&ouml;/g, "ö")
          .replace(/&aring;/g, "å")
          .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
          .split("\n")
          .map((r) => r.replace(/\s+/g, " ").trim())
          .filter(Boolean)

        if (!rivit.length) return
        const nimi = rivit[0]
        if (!HENKILONIMI.test(nimi)) return
        if (EI_HENKILO.test(nimi)) return
        if (nahdyt.has(nimi)) return

        const loput = rivit.slice(1).join(" ")
        const puh = loput.match(PUHELIN)
        const nimike = loput.replace(PUHELIN, "").replace(/[\s,;.]+$/, "").trim()

        /*
         * PELKKA NIMI EI OLE YHTEYSTIETO. Ilman nimiketta ja numeroa
         * rivi ei kerro mitaan eika ole varmasti yhteyshenkilo; mitattu
         * yksi tallainen seitsemasta ("Jari Heikkila", ei muuta).
         */
        if (!nimike && !puh) return

        nahdyt.add(nimi)
        out.push({
          nimi,
          nimike: nimike || null,
          puhelin: puh ? puh[1].replace(/\s+/g, " ").trim() : null,
          organisaatio: nimike && MUU_TYONANTAJA.test(nimike) ? null : "Fingrid Oyj",
        })
      })
  })

  return out
}

async function haeHtml(url: string): Promise<string | null> {
  try {
    const vastaus = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
    if (!vastaus.ok) return null
    return await vastaus.text()
  } catch {
    return null
  }
}

export async function fetchFingridProjectsSource() {
  const listaus = await haeHtml(LISTAUS_URL)
  if (!listaus) return []

  const jono = hankeslugit(listaus)
  const results: any[] = []

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (jono.length) {
        const slug = jono.shift()
        if (!slug) break

        const url = `${LISTAUS_URL}${slug}/`
        const html = await haeHtml(url)
        if (!html) continue

        const sivu = jasennaHankesivu(html)
        if (!sivu) continue

        const vaihe = vaiheTilasta(sivu.tila)
        /* Valmistunut voimajohto ei ole mahdollisuus. */
        if (!vaihe) continue

        results.push({
          name: sivu.otsikko,
          /*
           * Sijainti on usein maakunta ("Lappi, Pohjois-Pohjanmaa") tai
           * jopa toinen maa, joten kaupunki varmistetaan kuntatunnistuksella.
           */
          city:
            detectCityFromText(sivu.sijainti ?? "") ??
            detectCityFromText(sivu.otsikko) ??
            detectCityFromText(sivu.teksti),
          region: null,
          location: null,
          phase: vaihe,
          description: sivu.teksti.slice(0, 4000),
          /* Kantaverkkoyhtiö on hankkeen tilaaja omilla sivuillaan. */
          developer: "Fingrid Oyj",
          /*
           * URAKOITSIJA LUETAAN TEKSTISTA (D-328).
           *
           * Fingrid kertoo urakoitsijan hankesivulla ("Urakoitsijaksi on
           * valittu Leonhard Weiss Oü"), mutta kenttä oli aina null.
           * Mitattu 22.10.2026: nimi löytyi 5 hyväksytystä hankkeesta ja
           * 6 jonorivistä, eikä yhdelläkään ollut sitä missään kentässä.
           *
           * POIMINTA KOKO TEKSTISTA, ei `description`-kentästä: se
           * katkaistaan 4 000 merkkiin, ja Lakeuslinjan kuvaus oli
           * täsmälleen rajassa -- osuuskohtainen urakoitsija voi olla
           * katkaisun takana.
           *
           * YKSI nimi on pääurakoitsija ja menee `builder`-kenttään,
           * joka on myös hankehaun kenttä. MONTA nimeä on
           * osuuskohtaisia, eikä niistä voi päätellä pääurakoitsijaa,
           * joten ne menevät `winners`-kenttään (rooli "Urakoitsija").
           */
          ...(() => {
            const urakoitsijat = poimiUrakoitsijat(sivu.teksti)
            if (urakoitsijat.length === 1) return { builder: urakoitsijat[0], winners: null }
            if (urakoitsijat.length > 1) return { builder: null, winners: urakoitsijat }
            return { builder: null }
          })(),
          property_type: sivu.tyyppi ?? "Sähköverkko",
          /*
           * AVAIN ON `metadata.contact_persons`, EI ylatason kentta.
           * `importCandidate` kokoaa jonorivin metadatan muodossa
           * `{ ...(body.metadata ?? {}), ... }`, joten ylatasolle jatetty
           * arvo menisi `normalized_payload`-lokiin mutta ei koskaan
           * jonoriville. Tarkistettu importCandidate.ts:sta ennen
           * kirjoittamista.
           */
          ...(sivu.yhteyshenkilot.length
            ? {
                metadata: {
                  contact_persons: sivu.yhteyshenkilot.map((h) => ({
                    kind: "person" as const,
                    name: h.nimi,
                    title: h.nimike,
                    /* Ks. jasennaYhteyshenkilot: osoitetta ei paatella. */
                    email: null,
                    phone: h.puhelin,
                    organization: h.organisaatio,
                  })),
                },
              }
            : {}),
          source_url: url,
          confidence: 0.7,
          completed: false,
          source_name: "fingrid_hankkeet",
        })
      }
    })
  )

  return results
}
