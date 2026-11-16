import * as cheerio from "cheerio"

/*
 * RAAHEN KAAVASIVU (D-434).
 *
 * Raahen kaavasivuilla on yhteinen Drupal-runko mutta vapaa sisältö:
 *
 *   - kuvaus on `#field-blocknodekaavoitusbody`-lohkossa. Osalla sivuista
 *     on "Ajankohtaista"-osio ja sen jälkeen kaavan oma osio
 *     ("Asemakaavamuutos", "Osayleiskaava"), osalla pelkkä Ajankohtaista
 *     (Pitkäkari), osalla ei väliotsikoita lainkaan (Pattijärvi,
 *     Hummastinvaara). Vanha keräin luki vain Ajankohtaista-otsikon
 *     JÄLKEISEN osion, joten kaksi jälkimmäistä jäivät ilman kuvausta.
 *   - vaihe on erillisessä kaaviossa `#kaavoitusvaiheet .vaihe-active`.
 *     Vanha keräin arvasi sen Ajankohtaista-osion ensimmäisestä
 *     h3:sta ("Vireilletulo ja OAS"), joka puuttuu useimmilta sivuilta.
 *   - yhteyshenkilöt ovat oikean palstan "Lisätietoja"-laatikossa, mutta
 *     merkintä vaihtelee: rooli ja nimi samassa kappaleessa <br>:llä
 *     erotettuina, jokainen henkilö omassa kappaleessaan, tai
 *     "Lisätietoja" omassa kappaleessaan. Vanha keräin luki vain
 *     Lisätietoja-kappaleen ja siitä vain ensimmäisen parin.
 *
 * Sähköpostia ja puhelinta sivuilla ei ole, eikä osoitetta arvata.
 */

export type RaaheYhteys = {
  kind: "person"
  name: string
  title: string | null
  phone: null
  email: null
  organization: string
  role: null
}

export type RaaheKaavasivu = {
  title: string | null
  description: string | null
  phase: string | null
  contacts: RaaheYhteys[]
}

const VAIHEET: Record<string, string> = {
  "vireille tulo": "Vireilletulo",
  vireilletulo: "Vireilletulo",
  luonnos: "Luonnos",
  ehdotus: "Ehdotus",
  "hyväksyminen": "Hyväksyminen",
  voimaantulo: "Voimaantulo",
}

/** Kappaleet, jotka ovat menettelyohjeita eivätkä kerro kaavasta. */
const MENETTELY =
  /palautetta koko kaavaprosessin|Virallinen palaute|Yleisötilaisuus|yleisötilaisuudessa|Teams|kahvitarjoilu|^Kaavatyötä varten on laadittu osallistumis/i

const KAAVAOSIO = /kaava|kaavamuutos|kaavoitus/i
const AJANKOHTAISTA = /^ajankohtaista$/i

const ROOLI =
  /^(kaavoituspäällikkö|kaavasuunnittelija|arkkitehti|kaava-arkkitehti|yleiskaava-arkkitehti|maankäyttöpäällikkö|kaavoitusinsinööri|suunnittelija|projektipäällikkö|maankäyttöinsinööri|kehittämisjohtaja|tekninen johtaja)$/i
const NIMI = /^[A-ZÅÄÖ][a-zåäöé'-]+(?:[ -][A-ZÅÄÖ][a-zåäöé'-]+){1,2}$/

const siisti = (s: string) => s.normalize("NFC").replace(/ /g, " ").replace(/\s+/g, " ").trim()

/** Tunnus nimen lopusta: "… (Akm 233)" → "AKM233", "(Ak 257)" → "AK257". */
export function raahenKaavatunnus(nimi: string): string | null {
  const m = nimi.match(/\b(akm|ak)\s*(\d{2,4})\b/i)
  return m ? `${m[1].toUpperCase()}${m[2]}` : null
}

export function raahenVaihe(html: string): string | null {
  const $ = cheerio.load(html)
  const aktiivinen = siisti($("#kaavoitusvaiheet .vaihe-active").first().text()).toLowerCase()
  return aktiivinen ? (VAIHEET[aktiivinen] ?? aktiivinen.charAt(0).toUpperCase() + aktiivinen.slice(1)) : null
}

/**
 * Kuvaus rungon kappaleista. Osioiden järjestys:
 *   1. kaavan oma osio ("Asemakaavamuutos", "Osayleiskaava") — se kertoo
 *      mitä kaavalla tehdään; useita osioita on vain vaiheittain
 *      päivitetyillä sivuilla, ja silloin viimeinen on kaavan kuvaus
 *      (Vanha kaupunki: "Osittainen voimaantulo" → "Asemakaavamuutos")
 *   2. otsikoton runko tai pelkkä Ajankohtaista-osio
 * Linkkikappaleet ja menettelyohjeet jätetään pois.
 */
export function raahenKuvaus(html: string): string | null {
  const $ = cheerio.load(html)
  const runko = $("#field-blocknodekaavoitusbody .field__item").first()
  if (!runko.length) return null

  type Osio = { otsikko: string | null; kappaleet: string[] }
  const osiot: Osio[] = [{ otsikko: null, kappaleet: [] }]
  runko.children().each((_, el) => {
    const tag = (el as any).tagName?.toLowerCase()
    if (tag === "h2") {
      osiot.push({ otsikko: siisti($(el).text()), kappaleet: [] })
      return
    }
    if (tag !== "p") return
    const p = $(el)
    const teksti = siisti(p.text())
    if (!teksti) return
    const linkkiteksti = siisti(p.find("a").text())
    if (linkkiteksti && linkkiteksti.length >= teksti.length - 3) return
    if (MENETTELY.test(teksti)) return
    osiot[osiot.length - 1].kappaleet.push(teksti)
  })

  const sisallolliset = osiot.filter((o) => o.kappaleet.length > 0)
  const kaavaosiot = sisallolliset.filter(
    (o) => o.otsikko && !AJANKOHTAISTA.test(o.otsikko) && KAAVAOSIO.test(o.otsikko)
  )
  const valittu = kaavaosiot.length
    ? kaavaosiot[kaavaosiot.length - 1]
    : (sisallolliset.find((o) => !o.otsikko) ?? sisallolliset[0])
  if (!valittu) return null

  const kuvaus = valittu.kappaleet.join(" ")
  return kuvaus.length > 2500 ? `${kuvaus.slice(0, 2500).replace(/\s\S*$/, "")} …` : kuvaus
}

/** Oikean palstan Lisätietoja-laatikon kaikki rooli–nimi-parit. */
export function raahenYhteyshenkilot(html: string): RaaheYhteys[] {
  const $ = cheerio.load(html)
  const palsta = $(".field-name-field-right-column .field__item").first()
  if (!palsta.length) return []
  const kopio = palsta.clone()
  kopio.find(".hoxbox2, a").remove()
  kopio.find("br").replaceWith("\n")
  kopio.find("p, div").each((_, el) => {
    $(el).append("\n")
  })
  const rivit = kopio
    .text()
    .split("\n")
    .map(siisti)
    .filter((r) => r && !/^lisätietoja$/i.test(r) && !/henkilöstöhaku/i.test(r))

  const tulos: RaaheYhteys[] = []
  const lisaa = (nimi: string, rooli: string) => {
    if (tulos.some((t) => t.name === nimi)) return
    tulos.push({
      kind: "person",
      name: nimi,
      title: rooli.charAt(0).toUpperCase() + rooli.slice(1),
      phone: null,
      email: null,
      organization: "Raahen kaupunki",
      role: null,
    })
  }
  for (let i = 0; i < rivit.length; i++) {
    const rivi = rivit[i]
    if (ROOLI.test(rivi) && NIMI.test(rivit[i + 1] ?? "")) {
      lisaa(rivit[i + 1], rivi)
      i++
      continue
    }
    const samalla = rivi.match(/^(\S+)\s+(.+)$/)
    if (samalla && ROOLI.test(samalla[1]) && NIMI.test(samalla[2])) lisaa(samalla[2], samalla[1])
  }
  return tulos
}

export function raahenKaavasivu(html: string): RaaheKaavasivu {
  const $ = cheerio.load(html)
  const title = siisti($("h1").last().text()) || null
  return {
    title,
    description: raahenKuvaus(html),
    phase: raahenVaihe(html),
    contacts: raahenYhteyshenkilot(html),
  }
}
