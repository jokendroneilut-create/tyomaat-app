import https from "node:https"

/*
 * KERAVAN KAUPUNGIN UUTISET (D-247).
 *
 * Johannes 7.10.2026 antoi lahteeksi sivun jolla Kauppakaaren kavelykadun
 * suunnittelukilpailu ratkeaa. Keravan KAAVAhankkeet olivat jo lahteena
 * (`keravaKaavaParser`), mutta uutiset eivat — ja juuri uutisissa
 * kerrotaan KUKA kilpailun voitti. Kaavasivu ei kerro sita koskaan.
 *
 * MIKSI TAMA ON OMA LAHTEENSA EIKA KAAVALAHTEEN LAAJENNUS. Kaavasivu on
 * WP:n `project`-sisaltotyyppi, uutinen on `posts`. Eri rakenne, eri
 * kentat, eri suodatus — ja eri kysymys: kaava kertoo mita kaavoitetaan,
 * uutinen kertoo mita on paatetty.
 *
 * UNDICI EI TOIMI KERAVAA VASTAAN. Node.js:n fetch saa jarjestelmallisesti
 * HTTP 500:n Keravan esto-kaytannosta, vaikka sama pyynto onnistuu
 * https-moduulilla. Sama ratkaisu kuin apiCollectorin kaavakeraimessa.
 *
 * KATEGORIAT ON VALITTU MITTAAMALLA, EI ARVAAMALLA. Nelja ehdokasta
 * kaytiin lapi 7.10.2026 (12 tuoreinta otsikkoa kustakin):
 *
 *   kaupunkisuunnittelu (56)  ~5/12 hanketta   -> mukaan
 *   rakentaminen        (52)  ~5/12 hanketta   -> mukaan
 *   kadut-ja-liikenne   (54)  ~2/12, 125 juttua -> EI: tilapaisia
 *                                                 liikennejarjestelyja
 *   puistot            (169)  ~1/12            -> EI: avajaisia ja
 *                                                 tapahtumia
 *
 * Kaksi jalkimmaista olisivat tuoneet eniten volyymia ja vahiten
 * hankkeita. Ks. [[company-source-filtering]]: suodatus on koko tyo.
 */

const KATEGORIAT = "52,56"
const SIVUKOKO = 100
const MAX_SIVUT = 3

const OTSAKKEET = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
}

/*
 * SUODATIN POISTAA VAIN SEN MIKA EI KOSKAAN OLE HANKE.
 *
 * Ensimmainen versio oli toisin pain: 35 hanketermia, joista yhden piti
 * osua. Se mitattiin 7.10.2026 kaikilla 127 jutulla ja EPAONNISTUI
 * MOLEMPIIN SUUNTIIN — 85 lapi, joista ~30 roskaa, ja 42 hylattya,
 * joista yhdeksan oli oikeita hankkeita:
 *
 *   "Pihkaniityn omakotitontit myynnissa"       (tontit myyntiin)
 *   "Keravan kartanolle etsitaan kilpailulla kehittajaa"
 *   "Rajaytystyot maauimalan tyomaalla jatkuvat"
 *   "Sompion paivakodin uusi rakennus kayttoon"
 *   "Hulevesijarjestelman kunnostustyot alkavat"
 *   "Asfaltointi-, kivetys- ja vihertyot alkavat Kaskelassa"
 *   "Keravan kaupunki teettaa maaperatutkimuksia"
 *   "Lentoradan alustava linjaus siirrettiin"
 *   "Sompiossa valmistaudutaan tulevaan skeittipuistoon"
 *
 * Kunta ei kirjoita hankkeesta sanaa "rakennushanke". Se kirjoittaa
 * "asfaltointityot alkavat". Hanketermiluettelo on siis arvaus siita
 * miten kunta sattuu sanomaan asian, ja se vanhenee jokaisen uuden
 * kunnan kohdalla.
 *
 * MENETETTY HANKE ON KALLIIMPI VIRHE KUIN TURHA RIVI JONOSSA.
 * Poissulku paastaa lapi 103/127 eli se suodattaa vain vahan — ja se on
 * tarkoitus. Tama portti ei paata mika on hanke; se saastaa LLM-kulua
 * siita mika ei varmasti ole. Paatoksen tekee jasennys ja lopulta
 * ihminen TIC:issa. Ks. [[review-queue-not-bottleneck]].
 *
 * Osuma vaaditaan OTSIKOSTA, ei leipatekstista (D-241): kyselyn
 * mainitseminen jutun lopussa ei tee jutusta kyselya.
 */
const EI_KOSKAAN_HANKE = [
  /* Osallistuminen ja mielipiteen kysyminen */
  "aanesta",
  "äänestä",
  "nimiaanestys",
  "nimiäänestys",
  "kysely",
  "kyselyyn",
  "kyselya",
  "kyselyä",
  "ilmoittaudu",
  "etsimme",
  "lahde mukaan",
  "lähde mukaan",
  "kylakavely",
  "kyläkävely",

  /* Tilaisuudet */
  "seminaari",
  "asukastilaisuus",
  "asukasilta",
  "asukasiltaan",
  "infotilaisuu",
  "yleisotilaisuu",
  "yleisötilaisuu",
  "festivaal",
  "ohjelmaa",
  "vietetaan",
  "vietetään",
  "tunnustus",

  /* Saadokset ja hallinto — koskevat kaikkia, eivat yhta hanketta */
  "rakentamislaki",
  "rakennusjarjestys",
  "rakennusjärjestys",
  "rakennusjarjestyksen",
  "rakennusjärjestyksen",
  "arvonlisavero",
  "arvonlisävero",
  "kayttokatko",
  "käyttökatko",
]

const VALMIS_TERMIT = [
  "valmistui",
  "valmistunut",
  "otettu kayttoon",
  "otettu käyttöön",
  "avattiin",
  "avattu",
  "vihittiin",
]

function keravaGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: OTSAKKEET }, (res) => {
        let body = ""
        res.setEncoding("utf8")
        res.on("data", (c) => (body += c))
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body }))
      })
      .on("error", reject)
  })
}

async function haeJson(url: string, yrityksia = 4): Promise<any> {
  let viimeisin: unknown = null
  for (let i = 0; i < yrityksia; i++) {
    try {
      const { status, body } = await keravaGet(url)
      if (status === 200) return JSON.parse(body)
      viimeisin = new Error(`HTTP ${status}`)
    } catch (error) {
      viimeisin = error
    }
    await new Promise((r) => setTimeout(r, 400 + i * 200))
  }
  throw viimeisin instanceof Error ? viimeisin : new Error("Keravan uutishaku epaonnistui")
}

const NIMETYT_ENTITEETIT: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  ndash: "-",
  mdash: "-",
  hellip: "...",
}

/*
 * HTML pois ja entiteetit auki — vertailu tehdaan puhtaasta tekstista.
 *
 * NUMEROENTITEETIT ON PAKKO PURKAA. Ensimmainen versio poisti vain
 * nimetyt (`&[a-z]+;`), ja WordPressin tuottama `&#8211;` jai otsikkoon
 * sellaisenaan: "Loitsutie 1 &#8211; asemakaavamuutos" olisi mennyt
 * jonoon nakyvana roskana. Yksikkotesti loysi taman.
 */
export function puhdistaTeksti(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (osuma, nimi) => NIMETYT_ENTITEETIT[nimi.toLowerCase()] ?? osuma)
    .replace(/\s+/g, " ")
    .trim()
}

export type KeravaUutinen = { title: string; link: string; teksti: string; date: string }

/* Suodatus erillaan hausta, jotta sen voi mitata ilman verkkoa. */
export function lapaiseeSuodatuksen(uutinen: { title: string }): boolean {
  const otsikko = uutinen.title.toLowerCase()
  return !EI_KOSKAAN_HANKE.some((k) => otsikko.includes(k))
}

export async function haeKeravanUutiset(): Promise<KeravaUutinen[]> {
  const kaikki: KeravaUutinen[] = []

  for (let sivu = 1; sivu <= MAX_SIVUT; sivu++) {
    const url =
      `https://www.kerava.fi/wp-json/wp/v2/posts?categories=${KATEGORIAT}` +
      `&per_page=${SIVUKOKO}&page=${sivu}&_fields=id,title,link,date,content`

    let erä: any[]
    try {
      erä = await haeJson(url)
    } catch {
      /* Sivu yli viimeisen palauttaa virheen; se on normaali lopetus. */
      break
    }

    if (!Array.isArray(erä) || erä.length === 0) break

    for (const p of erä) {
      const title = puhdistaTeksti(p?.title?.rendered ?? "")
      const link = p?.link ?? ""
      if (!title || !link) continue
      kaikki.push({
        title,
        link,
        teksti: puhdistaTeksti(p?.content?.rendered ?? ""),
        date: p?.date ?? "",
      })
    }

    if (erä.length < SIVUKOKO) break
  }

  return kaikki
}

export async function fetchKeravaUutisetSource() {
  const uutiset = await haeKeravanUutiset()
  const tulokset: any[] = []

  for (const uutinen of uutiset) {
    if (!lapaiseeSuodatuksen(uutinen)) continue

    const kaikki = `${uutinen.title} ${uutinen.teksti}`.toLowerCase()
    const valmis = VALMIS_TERMIT.some((k) => kaikki.includes(k))

    tulokset.push({
      name: uutinen.title,
      /*
       * Kuvaukseksi alku leipatekstista. Koko teksti ei mahdu eika auta:
       * hankkeen tunnistava tieto on kunnan tiedotteessa alussa.
       */
      description: uutinen.teksti.slice(0, 1200) || null,
      city: "Kerava",
      region: "Uusimaa",
      location: null,
      phase: valmis ? "Valmistunut" : "Suunnittelussa",
      source_url: uutinen.link,
      /*
       * Sama 0.45 kuin Helsingin uutisvirrassa: uutinen on heikompi ja
       * vapaamuotoisempi signaali kuin kaava tai Hilma. Ihminen
       * tarkistaa TIC:issa.
       */
      confidence: 0.45,
      completed: valmis,
      source_name: "kerava_uutiset",
    })
  }

  return tulokset
}
