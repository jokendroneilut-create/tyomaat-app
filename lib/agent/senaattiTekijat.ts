import * as cheerio from "cheerio"

/*
 * SENAATIN HANKESIVUN "TEKIJAT"-LOHKO OSAPUOLIKSI (D-355).
 *
 * Johannes 27.10.2026: *"miksi tasta lahteesta ei ole poimittu kaikkia
 * hankkeeseen liittyvia yrityksia jotka on annettu? Sama toistuu
 * lahteen muissakin hankkeissa."*
 *
 * Senaatin hankesivulla on lohko, jossa jokainen osapuoli on omalla
 * rivillaan roolinsa kanssa:
 *
 *   <p><strong>Rakennuttajakonsultti: </strong>A-insinoorit Rakennuttaminen Oy</p>
 *   <p><strong>Paaurakoitsija / Paatoteuttaja: </strong>Rakennustyo Salminen Oy</p>
 *   <p><strong>LVIA-suunnittelu</strong>: Ramboll Finland Oy</p>
 *
 * Keraaja luki sivulta vain otsikon, kuvauksen, vaiheen, sijainnin ja
 * yhteyshenkilot -- koko tekijalohko jai lukematta, vaikka se on
 * tallessa omassa datassamme (`raw_payload.original.content.rendered`).
 *
 * KAKSOISPISTE ON JOSKUS <strong>:IN SISALLA JA JOSKUS ULKOPUOLELLA,
 * joten rooli luetaan `<strong>`-elementista ja arvo kappaleen lopusta
 * -- ei tekstista pilkkomalla. Pelkalla tekstilla roolit menevat
 * sekaisin ("Senaatti-kiinteistot Rakennuttajapaallikko"), koska
 * rivinvaihtoa ei ole.
 */

export type SenaatinTekija = { rooli: string; nimi: string }

/*
 * ARVO ON NIMI, EI KAPPALE (D-355).
 *
 * Osalla sivuista roolirivin perassa jatkuu leipateksti samassa
 * kappaleessa: Kansallisarkiston arkkitehdiksi tuli *"Sarc + Sigge
 * Arkkitehdit Oy Kansallisarkiston paarakennus on tullut
 * peruskorjausikaan. Rakennuksessa on tehty..."* -- 600 merkkia
 * kuvausta yrityskenttaan. Katkaistaan ensimmaiseen virkkeen loppuun
 * ja rajataan pituus.
 */
const ARVON_ENIMMAISPITUUS = 160

export function katkaiseArvo(arvo: string): string {
  let t = String(arvo ?? "").trim()

  /*
   * Virkkeen loppu katkaisee -- mutta NIMIKIRJAIMEN piste ei ole
   * virkkeen loppu: "Rakennus Oy Antti J. Ahola" ja
   * "Arkkitehtitoimisto J. Teppo Oy" katkesivat ensimmaisessa
   * versiossa muotoon "...Antti J". Sama lookbehind kuin muualla
   * virkejaossa.
   */
  const piste = t.search(/(?<!(?:^|\s)[A-ZÄÖÅ])\.\s+[A-ZÄÖÅ]/)
  if (piste > 0) t = t.slice(0, piste)

  /*
   * Yhtiomuodon jalkeen jatkuva pitka teksti on leipatekstia, ei nimea:
   * "Sarc + Sigge Arkkitehdit Oy Kansallisarkiston paarakennus on
   * tullut peruskorjausikaan" -> katkaistaan "Oy":n jalkeen. Lyhyt
   * jatko jaa, koska se kuuluu nimeen ("Rakennus Oy Antti J. Ahola").
   */
  const muoto = [...t.matchAll(/\b(oy|oyj|ab|abp|ky)\b\.?/gi)].at(-1)
  if (muoto?.index != null) {
    const loppu = muoto.index + muoto[0].length
    if (t.length - loppu > 20) t = t.slice(0, loppu)
  }

  /*
   * Katkennut sulkulauseke pois: "YIT Business Premises Oy (ent. YIT
   * Suomi Oy)" katkesi virkesaannosta muotoon "...Oy (ent". Aukeava
   * sulku ilman sulkevaa paria on aina roska.
   */
  const sulku = t.lastIndexOf("(")
  if (sulku > 0 && !t.slice(sulku).includes(")")) t = t.slice(0, sulku)

  if (t.length > ARVON_ENIMMAISPITUUS) t = t.slice(0, ARVON_ENIMMAISPITUUS).replace(/\s+\S*$/, "")
  return t.replace(/[\s.,;:(-]+$/, "").trim()
}

/* Lohkon viimeinen kappale jatkuu sivupohjan shortcodeilla. */
const SHORTCODE = /\[\/?\w+[^\]]*\]/g

function siivoa(teksti: string): string {
  return teksti
    .replace(SHORTCODE, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&#8212;/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[\s:.-]+|[\s:.;,-]+$/g, "")
    .trim()
}

/*
 * Lohko alkaa otsikosta "Tekijat" ja paattyy seuraavaan otsikkoon.
 * Kappaleet luetaan vasta sen jalkeen, jottei sivun muista kappaleista
 * poimita roolin nakoisia rivejä.
 */
export function senaatinTekijat(html: string | null | undefined): SenaatinTekija[] {
  const sisalto = String(html ?? "")
  if (!sisalto.trim()) return []

  const $ = cheerio.load(sisalto)
  const otsikko = $("h1, h2, h3, h4")
    .toArray()
    .find((el) => /^tekij[äa]t/i.test($(el).text().replace(/\s+/g, " ").trim()))
  if (!otsikko) return []

  const tekijat: SenaatinTekija[] = []
  let n = $(otsikko).next()
  let askel = 0
  while (n.length && askel < 40) {
    const tagi = (n[0] as any).tagName?.toLowerCase() ?? ""
    if (/^h[1-4]$/.test(tagi)) break

    for (const kappale of (tagi === "p" ? [n] : n.find("p").toArray().map((el) => $(el)))) {
      const vahva = kappale.find("strong, b").first()
      if (!vahva.length) continue
      const rooli = siivoa(vahva.text())
      /* Arvo on kappaleen teksti ilman roolia. */
      const nimi = katkaiseArvo(siivoa(kappale.text().replace(vahva.text(), "")))
      if (!rooli || !nimi || rooli.length > 60) continue
      tekijat.push({ rooli, nimi })
    }

    n = n.next()
    askel += 1
  }

  return tekijat
}

/*
 * ROOLI OMAAN SARAKKEESEENSA (D-355).
 *
 * Sanasto on laskettu aineistosta, ei arvattu: 52 hankedokumenttia,
 * joista 47:ssa on tekijalohko ja yhteensa 382 osapuolta
 * ([[anchor-vocabulary-per-source]]). Lahteen omat kirjoitusvirheet
 * ("Rakennesuunittelu") ovat mukana, koska ne ovat datassa.
 *
 * Mika EI mene sarakkeeseen, menee liittyviin yrityksiin -- mutta vain
 * jos arvo nayttaa yritykselta. Rakennuttajakonsultti on usein
 * HENKILO ("Kimmo Puttonen"), eika henkilon nimi kuulu
 * yrityskenttaan ([[party-role-fields]]).
 */
const KENTTA: { kuvio: RegExp; kentta: string }[] = [
  { kuvio: /^(p[äa][äa]urakoitsija|p[äa][äa]toteuttaja|urakoitsija|projektinjohtourakoitsija|k[äa]rkihankeallianssin)/i, kentta: "builder" },
  { kuvio: /^(rakennesuun|rakennesuunittelu)/i, kentta: "structural_design" },
  { kuvio: /^(lvi|lvia|lvias|talotekninen)/i, kentta: "hvac_design" },
  { kuvio: /^(s[äa]hk[öo]suunnittelu)/i, kentta: "electrical_design" },
  { kuvio: /^(geo-?suunnittelu|pohjarakenne)/i, kentta: "geotechnical_design" },
  { kuvio: /^(p[äa][äa]suunnittelu|p[äa][äa]suunnittelija|arkkitehti|p[äa][äa]-\s*ja\s*arkkitehti)/i, kentta: "architectural_design" },
  { kuvio: /^(rakennuttaja$|tilaaja)/i, kentta: "developer" },
]

/* Kayttajaorganisaatio: ei rooli-saraketta, mutta arvokas tieto. */
const KAYTTAJA = /^(k[äa]ytt[äa]j[äa]|k[äa]ytt[äa]j[äa]t|p[äa][äa]k[äa]ytt[äa]j[äa])$/i

/* Rooli joka on aina henkilo, ei yritys. */
const HENKILOROOLI = /(p[äa][äa]llikk[öo]|johtaja|vastaava|yhteyshenkil)/i

/*
 * LUETTELO ON MONTA NIMEA, EI YKSI (D-355).
 *
 * Kayttajakentassa on usein koko talon vuokralaislista: *"Business
 * Finland, Digi- ja vaestotietovirasto, Elinvoimakeskus, Fimea, ...
 * seka Puolustuskiinteistot ja Senaatti-kiinteistot"* -- viisitoista
 * organisaatiota yhtena merkkijonona. Yhtena nimena se on
 * kayttokelvoton: se ei osu hakuun eika kerro kenellekaan mitaan.
 *
 * PROOSA EI OLE NIMI: *"toteutettiin Lapin poliisilaitoksen Inarin
 * poliisiasema..."* alkaa pienella ja on kokonainen lause. Pudotetaan.
 */
export function pilkoLuettelo(arvo: string): string[] {
  const osat = String(arvo ?? "")
    .split(/,| sek[äa] | ja (?=[A-ZÄÖÅ])/)
    .map((o) => o.trim().replace(/^[\s.-]+|[\s.,;-]+$/g, ""))
    .filter(Boolean)

  /*
   * VAIN AITO LUETTELO PILKOTAAN. Kaksi osaa on yleensa yksi nimi
   * tarkenteineen ("Geologian tutkimuskeskus, GTK Mintec", "Sarc +
   * Sigge Arkkitehdit Oy, Helsinki"), ja sen pilkkominen tuottaisi
   * puolikkaita. Kolmesta ylospain kyse on vuokralaislistasta.
   */
  if (osat.length < 3) {
    const kokonaan = String(arvo ?? "").trim()
    return kelpaaNimeksi(kokonaan) ? [kokonaan] : []
  }
  return osat.filter((o) => kelpaaNimeksi(o))
}

function kelpaaNimeksi(nimi: string): boolean {
  if (nimi.length < 3 || nimi.length > 90) return false
  /* Nimi alkaa isolla; pieni alkukirjain kertoo lauseesta. */
  if (!/^[A-ZÄÖÅ0-9]/.test(nimi)) return false
  /* Yli kahdeksan sanaa ilman yhtiomuotoa on kuvausta, ei nimi. */
  const sanoja = nimi.split(/\s+/).length
  return sanoja <= 8 || /\b(oy|oyj|ab|ky|ry|säätiö|saatio)\b/i.test(nimi)
}

export type SenaatinOsapuolet = {
  kentat: Record<string, string>
  liittyvat: string[]
  henkilot: SenaatinTekija[]
  /* Roolit joissa sivulla on monta eri arvoa (osahankkeita). */
  monta: string[]
}

function normalisoiNimi(nimi: string): string {
  return String(nimi ?? "").toLowerCase().replace(/[^\wåäö]+/g, " ").trim()
}

export function senaatinOsapuolet(
  tekijat: SenaatinTekija[],
  onYritys: (nimi: string) => boolean
): SenaatinOsapuolet {
  const kentat: Record<string, string> = {}
  const liittyvat: string[] = []
  const henkilot: SenaatinTekija[] = []
  /* Roolit joihin sivu antaa monta eri arvoa -- sarake jaa tyhjaksi. */
  const monta = new Set<string>()

  for (const { rooli, nimi } of tekijat) {
    if (rooli.length < 3 || nimi.length < 3) continue

    if (HENKILOROOLI.test(rooli)) {
      henkilot.push({ rooli, nimi })
      continue
    }

    const osuma = KENTTA.find((k) => k.kuvio.test(rooli))
    if (osuma) {
      /*
       * MONTA ERI ARVOA SAMAAN ROOLIIN = MONTA OSAHANKETTA (D-355).
       *
       * Immolan kasarmialueen sivulla on kolme osahanketta ja kolme
       * paaurakoitsijaa (Jurvanen Ky, Pallas Rakennus, Evalahti).
       * Ensimmaisen valitseminen sarakkeeseen olisi arvaus, joten
       * sarake jatetaan tyhjaksi ja kaikki menevat liittyviin
       * yrityksiin ([[contractor-from-text]]: yksi sarakkeeseen,
       * monta omaan kenttaansa).
       */
      const aiempi = kentat[osuma.kentta]
      if (aiempi && normalisoiNimi(aiempi) !== normalisoiNimi(nimi)) {
        monta.add(osuma.kentta)
        if (!liittyvat.includes(nimi)) liittyvat.push(nimi)
        if (!liittyvat.includes(aiempi)) liittyvat.push(aiempi)
        continue
      }
      /* Ensimmainen voittaa: "LVI- ja sahkosuunnittelu" ei saa korvata omaa. */
      if (!kentat[osuma.kentta]) kentat[osuma.kentta] = nimi
      /*
       * EI MYOS LIITTYVIIN. Rooli on sarakkeessa, ja sama nimi
       * molemmissa on toistoa jonka Johannes huomasi GTK Mintecissa
       * ([[party-role-fields]]).
       */
      continue
    }

    if (KAYTTAJA.test(rooli) || onYritys(nimi)) {
      for (const osa of pilkoLuettelo(nimi)) {
        if (!liittyvat.includes(osa)) liittyvat.push(osa)
      }
    } else {
      henkilot.push({ rooli, nimi })
    }
  }

  for (const kentta of monta) delete kentat[kentta]
  return { kentat, liittyvat, henkilot, monta: [...monta] }
}
