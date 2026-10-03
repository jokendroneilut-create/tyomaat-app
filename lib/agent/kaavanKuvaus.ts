/*
 * KAAVAN KUVAUS SELOSTUKSESTA (D-217).
 *
 * Kuulutus kertoo vain menettelyn: "Osallistumis- ja arviointisuunnitelma
 * sekä kaavaluonnos ovat nähtävillä 25.9.–2.11.2026 … palvelupisteiden
 * asiakaspäätteillä." Siinä ei ole sanaakaan siitä mitä alueelle
 * rakennetaan. Selostuksen luvussa "Kaavan tarkoitus" on:
 *
 *   "Tavoitteena on tehostaa maankäyttöä ja mahdollistaa nopeasti
 *    kasvaneen teknologiakeskittymän kehittyminen ja laajentuminen.
 *    Kaupunki on ostanut noin hehtaarin laajuisen määräalan Andritzilta
 *    joulukuussa 2023."
 *
 * KOKO TEKSTI EI KUULU KANTAAN. `kaavaselostusPdf.ts` rajasi aikanaan
 * poimintaan eikä tekstiin, koska selostukset ovat 229 000–884 000
 * merkkiä. Sama rajaus pätee tässä: talteen otetaan vain kaksi lukua,
 * yhteensä korkeintaan `MAX_PITUUS` merkkiä.
 *
 * KAKSI LUKUA, KOSKA NE VASTAAVAT ERI KYSYMYKSEEN. "Kaava-alue" kertoo
 * MISSÄ ja kuinka iso, "Kaavan tarkoitus" kertoo MITÄ ja MIKSI. Asiakas
 * tarvitsee molemmat; kumpikaan yksin ei riitä.
 */

/* Kuvaus on tiivistelmä, ei selostus. */
const MAX_PITUUS = 1200

/*
 * Numeroitu otsikko aloittaa luvun. Selostusten rakenne on vakiintunut
 * (1 PERUS- JA TUNNISTETIEDOT, 1.1 Kaava-alue, 1.2 Kaavan tarkoitus),
 * joten luvun raja on seuraava numeroitu otsikko.
 */
const OTSIKKORIVI = /^\s*(\d+(?:\.\d+)*)\.?\s+(\S.{1,70})$/

/* Halutut luvut. Sanamuoto vaihtelee kunnittain. */
const HALUTUT: { avain: string; kuvio: RegExp }[] = [
  { avain: "alue", kuvio: /^(kaava-?alue|suunnittelualue|sijainti)\b/i },
  {
    avain: "tarkoitus",
    kuvio:
      /^(kaavan\s+tarkoitus|kaavan\s+tavoit|tavoitteet|suunnittelun\s+tavoit|kaavan\s+tarkoitus\s+ja\s+tavoit|tiivistelm)/i,
  },
]

/*
 * PDF katkaisee sanat rivin lopussa tavuviivalla ("joulu-\nkuussa").
 * Ilman yhdistämistä kuvaukseen jää katkonaisia sanoja.
 *
 * Vain pieni kirjain molemmin puolin: "Lypsyniemenkadun lounais-" +
 * "puolelta" yhdistyy, mutta yhdysmerkillinen erisnimi
 * ("Hirvivaara-\nMurtiovaara") säilyy.
 */
function yhdistaTavutus(teksti: string): string {
  return teksti.replace(/([a-zåäö])-\n([a-zåäö])/g, "$1$2")
}

function siisti(teksti: string): string {
  return teksti
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim()
}

/*
 * Ylä- ja alatunnisteet toistuvat joka sivulla ja katkaisevat lauseen
 * keskeltä. Ne tunnistaa siitä että sama rivi esiintyy monta kertaa.
 */
function poistaToistuvatRivit(teksti: string): string {
  const rivit = teksti.split("\n")
  const laskut = new Map<string, number>()

  for (const rivi of rivit) {
    const avain = rivi.trim()
    if (avain.length < 4) continue
    laskut.set(avain, (laskut.get(avain) ?? 0) + 1)
  }

  return rivit
    .filter((rivi) => {
      const avain = rivi.trim()
      if (/^sivu\s+\d+\s*\/\s*\d+$/i.test(avain)) return false
      return (laskut.get(avain) ?? 0) < 3
    })
    .join("\n")
}

export function kaavanKuvausTekstista(raaka: string | null | undefined): string | null {
  const teksti = poistaToistuvatRivit(siisti(yhdistaTavutus(String(raaka ?? ""))))
  if (!teksti) return null

  const rivit = teksti.split("\n")
  const luvut: { otsikko: string; sisalto: string[] }[] = []

  for (const rivi of rivit) {
    const otsikko = rivi.match(OTSIKKORIVI)
    if (otsikko) {
      luvut.push({ otsikko: otsikko[2].trim(), sisalto: [] })
      continue
    }
    if (luvut.length) luvut[luvut.length - 1].sisalto.push(rivi)
  }

  const osat: string[] = []

  for (const { avain, kuvio } of HALUTUT) {
    const luku = luvut.find((l) => kuvio.test(l.otsikko))
    if (!luku) continue

    const sisalto = luku.sisalto
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    /*
     * Liian lyhyt luku on otsikko ilman sisältöä (esim. viittaus
     * liitteeseen), liian pitkä on väärä luku tai jäsennysvirhe.
     */
    if (sisalto.length < 40) continue

    osat.push(avain === "alue" ? sisalto.slice(0, 400) : sisalto)
  }

  if (!osat.length) return null

  const kuvaus = osat.join(" ").replace(/\s+/g, " ").trim()
  if (kuvaus.length <= MAX_PITUUS) return kuvaus

  /* Katkaisu virkkeen rajalta, ei keskeltä sanaa. */
  const leikattu = kuvaus.slice(0, MAX_PITUUS)
  const piste = leikattu.lastIndexOf(". ")
  return piste > MAX_PITUUS * 0.5 ? leikattu.slice(0, piste + 1) : `${leikattu.trim()}…`
}

/*
 * Selostus on iso: mitattu Savonlinnan teknologiapuistossa 7,1 MB ja 42
 * sivua. Luetaan vain alkusivut ja rajataan koko, samoin kuin
 * `kaavaselostusPdf.ts`:ssä.
 */
const MAX_SIVUJA = 6
const MAX_TAVUJA = 25 * 1024 * 1024
const AIKAKATKAISU_MS = 30_000
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

/*
 * Selostuksen teksti kerran, jotta samasta hausta saadaan seka kuvaus
 * etta yhteyshenkilot (D-230). Molemmat mahtuvat `MAX_SIVUJA`:n sisaan:
 * mitattu Lieksan Brahean selostuksesta, jossa yhteyshenkilot ovat
 * sivulla 4 ja tiivistelma sivulla 6.
 */
export async function haeKaavaselostuksenTeksti(url: string): Promise<string | null> {
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)

  try {
    const vastaus = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ohjain.signal,
    })
    if (!vastaus.ok) return null

    const ilmoitettu = Number(vastaus.headers.get("content-length") ?? 0)
    if (ilmoitettu > MAX_TAVUJA) return null

    const buf = Buffer.from(await vastaus.arrayBuffer())
    if (buf.length > MAX_TAVUJA) return null

    /* Paketin juuri ajaa debug-tilassa oman testitiedostonsa ja kaatuu. */
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as any
    const jasennetty = await pdfParse(buf, { max: MAX_SIVUJA })

    return String(jasennetty?.text ?? "") || null
  } catch {
    return null
  } finally {
    clearTimeout(kello)
  }
}

export async function haeKaavanKuvaus(url: string): Promise<string | null> {
  return kaavanKuvausTekstista(await haeKaavaselostuksenTeksti(url))
}

/*
 * KUULUTUKSEN MENETTELYTEKSTI POIS, MUU SISALTO TALTEEN (D-217).
 *
 * Kuulutus on enimmakseen boilerplatea ("nahtavilla 25.9.-2.11.2026 ...
 * palvelupisteiden asiakaspaatteilla"), mutta ei aina pelkastaan: osassa
 * on virke jota selostuksessa ei ole.
 *
 *   "Asemakaavan muutos koskee kiinteistoja 740-2-8-4, 740-2-8-7 ja osaa
 *    kiinteistosta 740-3-9901-99 (kaupunginosa 2, Keskusta)."
 *   "... Savolan aluetta Brahenkadun ja Piispanmaen valissa seka
 *    Hevonpaanlahtea."
 *
 * Kiinteistotunnus on lisaksi tasmaytyksen tunniste. Siksi kuulutusta ei
 * heiteta pois vaan siita karsitaan menettelyvirkkeet.
 */
const MENETTELYVIRKE =
  /n(?:ä|a)ht(?:ä|a)vill(?:ä|a)|n(?:ä|a)ht(?:ä|a)v(?:ä|a)n(?:ä|a)|asiakasp(?:ä|a)(?:ä|a)ttei|kotisivuilla osoitteessa|mielipite|muistutu|palautetta voi|jätet(?:ä|a)(?:ä|a)n/i

export function kuulutuksenOmaSisalto(teksti: string | null | undefined): string | null {
  const puhdas = String(teksti ?? "").trim()
  if (!puhdas) return null

  const virkkeet = puhdas
    .split(/(?<=[.!?])\s+/)
    .map((v) => v.trim())
    .filter((v) => v.length >= 25 && !MENETTELYVIRKE.test(v))

  if (!virkkeet.length) return null
  return virkkeet.join(" ")
}
