import * as cheerio from "cheerio"

/*
 * VANTAAN KAAVAN OMA SIVU, KUN RAJAPINTA EI ANNA LINKKIÄ (D-423).
 *
 * Kaavat tulevat karttapalvelun WFS-rajapinnasta, ja kuvaus, hakija ja
 * yhteyshenkilöt luetaan kaavan omalta sivulta kentän `kaavalinkki`
 * kautta. Mitattu 15.11.2026: 5 kaavalla 84:stä kenttä on tyhjä.
 *
 * D-366 (31.10.2026) oletti, että näille ei ole vielä sivua. Se ei pidä:
 * Johanneksen kysymä "002657 Tuomelan koulutontti" (*"miksi tästä ei ole
 * oikein mitään tietoa ja lähde on vain bittejä?"*) oli julkaistu
 * vantaa.fi:ssä jo 23.9.2026 otsikolla "Hämeenkylässä Tuomelan
 * koulutontille pientaloja". Sivu on olemassa; rajapinnasta puuttuu vain
 * linkki.
 *
 * Sivun tunnistaa kaavan numerosta: jokaisella kaavasivulla on kenttä
 * "Kaavan nimi" = "002657 Tuomelan koulutontti", sama merkkijono kuin
 * rajapinnan `kaavanimi1`. Haku tehdään kahdessa vaiheessa:
 *
 *   1. RSS (20 uusinta kaavaa). Linkitön kaava on tyypillisesti uusi,
 *      joten tämä kattaa useimmat: 3/5 mitatuista.
 *   2. Kaavalistaus, jonka otsikoista haetaan kaavan nimen sanoja.
 *      Vanhempi kaava (002640 Raappavuorentie 38, OAS 10/2025) löytyi
 *      vain tätä kautta.
 *
 * Ehdokas hyväksytään vain jos sen sivulla on sama kaavan numero.
 * Otsikko yksin ei riitä: listauksessa on kolme Raappavuori-kaavaa.
 */

export const VANTAA_KAAVA_RSS = "https://www.vantaa.fi/fi/rss/city-plannings"
export const VANTAA_KAAVALISTAUS = "https://www.vantaa.fi/fi/kaavoitus/kaavat"

/* Kaavan numerot sivun "Kaavan nimi" -kentästä, esim. "002494 ja 002494va Väritehdas 1". */
export function kaavanTunnuksetSivulta(html: string): string[] {
  const $ = cheerio.load(html)
  const tunnukset = new Set<string>()
  /*
   * Vantaa vaihtoi pohjan 11/2026: <dt>/<dd> -> <div class="point__term">
   * / <div class="point__description">. Vanha valitsin palautti uudelta
   * pohjalta hiljaa tyhjän, joten linkittömälle kaavalle ei löytynyt sivua
   * (002568 Aviapolis, D-441). Luokka ratkaisee, ei elementti.
   */
  $(".point__term").each((_, el) => {
    if ($(el).text().trim().toLowerCase() !== "kaavan nimi") return
    const arvo = $(el).next(".point__description").text()
    for (const m of arvo.matchAll(/(?<![\dA-Za-z])([A-Z]{0,2}\d{4,6})(?!\d)/g)) tunnukset.add(m[1])
  })
  return [...tunnukset]
}

export function rssLinkit(xml: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true })
  return $("item > link")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
}

export function listauksenLinkit(html: string): { href: string; otsikko: string }[] {
  const $ = cheerio.load(html)
  const linkit = new Map<string, string>()
  $('a[href^="/fi/kaavoitus/kaavat/"]').each((_, el) => {
    const href = `https://www.vantaa.fi${$(el).attr("href")}`
    const otsikko = $(el).text().replace(/\s+/g, " ").trim()
    if (otsikko && !linkit.has(href)) linkit.set(href, otsikko)
  })
  return [...linkit].map(([href, otsikko]) => ({ href, otsikko }))
}

function perusmuoto(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
}

/*
 * Kaavan nimen sanojen alut, joilla listauksen otsikoita ja osoitteita
 * verrataan. Taivutus vaihtelee ("Raappavuorentie" vs.
 * "raappavuorentiella"), joten verrataan kuuden merkin alkuun.
 */
export function nimenVartalot(kaavanimi: string): string[] {
  return [
    ...new Set(
      perusmuoto(kaavanimi)
        .replace(/\d+/g, " ")
        .split(/[^a-z]+/)
        .filter((w) => w.length >= 5)
        .map((w) => w.slice(0, 6))
    ),
  ]
}

export function osuuOtsikkoon(kaavanimi: string, linkki: { href: string; otsikko: string }): boolean {
  const kohde = perusmuoto(`${linkki.otsikko} ${linkki.href}`)
  return nimenVartalot(kaavanimi).some((v) => kohde.includes(v))
}

export type PuuttuvaKaava = { tunnus: string; nimi: string }

/*
 * Etsii puuttuville kaavoille sivun. `hae` palauttaa tekstin (tai null);
 * `budjetti` rajaa kaavasivujen haut, koska keruu ajetaan tiukassa
 * aikaraja-ajossa. RSS ja listaussivut eivät kuluta budjettia.
 */
export async function etsiKaavasivut(input: {
  puuttuvat: PuuttuvaKaava[]
  tunnetutSivut: Set<string>
  hae: (url: string) => Promise<string | null>
  budjetti: number
  listaussivuja?: number
}): Promise<Map<string, string>> {
  const loydetyt = new Map<string, string>()
  const avoimet = () => input.puuttuvat.filter((k) => !loydetyt.has(k.tunnus))
  let budjetti = input.budjetti
  const tarkistettu = new Set<string>()

  async function tarkista(href: string) {
    if (budjetti <= 0 || tarkistettu.has(href)) return
    tarkistettu.add(href)
    budjetti--
    const html = await input.hae(href)
    if (!html) return
    for (const t of kaavanTunnuksetSivulta(html)) {
      if (input.puuttuvat.some((k) => k.tunnus === t) && !loydetyt.has(t)) loydetyt.set(t, href)
    }
  }

  if (!input.puuttuvat.length) return loydetyt

  /*
   * NIMEEN OSUVAT ENSIN (D-441). Budjetti kului syötteen neljään
   * ensimmäiseen linkkiin, joten myöhemmin syötteessä ollut Aviapolis
   * (002568) ei löytynyt kolmella ajolla. Kaikkia ei voi suodattaa
   * nimellä, koska osoite voi poiketa kaavan nimestä (Koivukylänväylä 66 ->
   * "paivittaistavarakaupan-laajennus-ilolaan"), joten muut tulevat perään.
   */
  const xml = await input.hae(VANTAA_KAAVA_RSS)
  const rss = xml ? rssLinkit(xml) : []
  const osuu = (href: string) => avoimet().some((k) => osuuOtsikkoon(k.nimi, { href, otsikko: "" }))
  for (const href of [...rss.filter(osuu), ...rss.filter((h) => !osuu(h))]) {
    if (!avoimet().length) break
    if (input.tunnetutSivut.has(href)) continue
    await tarkista(href)
  }

  const sivuja = input.listaussivuja ?? 10
  for (let s = 0; s < sivuja && avoimet().length && budjetti > 0; s++) {
    const html = await input.hae(s === 0 ? VANTAA_KAAVALISTAUS : `${VANTAA_KAAVALISTAUS}?page=${s}`)
    const linkit = html ? listauksenLinkit(html) : []
    if (!linkit.length) break
    for (const linkki of linkit) {
      if (input.tunnetutSivut.has(linkki.href)) continue
      if (!avoimet().some((k) => osuuOtsikkoon(k.nimi, linkki))) continue
      await tarkista(linkki.href)
    }
  }

  return loydetyt
}
