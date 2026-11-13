import { deobfuscateEmails, onMalliosoite } from "./contacts"

/*
 * YHTEYSTIETOLOHKO MONEKSI HENKILÖKSI.
 *
 * Kunnan kaavasivulla "Lisätietoja" on yksi tekstikappale jossa on
 * usein monta ihmistä. Kolme poimijaa teki tästä oman tulkintansa ja
 * kaikki kolme olivat väärässä eri tavalla (mitattu 13.11.2026):
 *
 *   Rovaniemi   otti ensimmäisen osoitteen ja numeron, loput
 *               kahdesta viimeisestä sanasta nimeksi    -> D-409
 *   Lohja       tunnisti vain "(at)"-hämätyn osoitteen, joten
 *               tavallinen osoite jäi nimen sisään      -> 11 riviä
 *   Vesilahti   ei jäsentänyt lainkaan: koko kappale
 *               meni `name`-kenttään                    -> 14 riviä
 *
 * Yksi moduuli kolmen kopion sijaan: sama korjaus pätee kaikkiin.
 *
 * MITÄ TÄMÄ OSAA, jokainen muoto luettu oikealta sivulta:
 *
 *   "Kaavoituspäällikkö Markku Pyhäjärvi, puh. 016 322 8927"
 *   "maankäyttöasiantuntija Niina Alanenpää puh. 016 322 8743"
 *   "Kaavasuunnittelija Elias Ritola, sähköposti: x, puh. +358 40 194 6870"
 *   "Konsultti ja kaavanlaatija Jarmo Lokio / Arkkitehtitoimisto Jarmo Lokio Oy"
 *   "Kunnanjohtaja Mikko Latvala p. 044 431 4340 etunimi.sukunimi@vesilahti.fi"
 *   "kaavasuunnittelija Klaus Seppänen klaus.seppanen(at)lohja.fi p. 040 6867391"
 *   "Seppo Lamppu DI kaavakonsultti puh. 040 867 4451"      <- nimi ensin
 *   "DI Jarmo Mäkelä 0400-220082 jarmo.makela@karttaako.fi" <- ei tunnusta
 *
 * KOLME SÄÄNTÖÄ JOTKA EIVÄT OLE ILMEISIÄ:
 *
 * 1. Osoite kuuluu sille jonka NIMEN JÄLKEEN se on. Osoite voi olla
 *    numeron kummalla puolella tahansa, joten numero ei kelpaa
 *    rajaksi — Ville Pitkänen sai muuten Markku Pyhäjärven osoitteen.
 *
 * 2. Nimike voi olla nimen kummalla puolella tahansa. "Seppo Lamppu DI
 *    kaavakonsultti" hävisi kokonaan, kun nimeksi otettiin kaksi
 *    VIIMEISTÄ isolla alkavaa sanaa: viimeiset olivat nimike.
 *
 * 3. Malliosoitetta ei tallenneta eikä johdeta nimestä.
 *    "etunimi.sukunimi@kunta.fi" on ohje muodosta, ei kenenkään osoite
 *    ([[register-is-worksite-contacts]]). Puhelin säilyy.
 */

export type Yhteyshenkilo = {
  name: string | null
  title: string | null
  phone: string | null
  email: string | null
  organization: string | null
}

const OSOITE = /[\w.+-]+@[\w.-]+\.\w+/g
const ISO_ALKU = /^[A-ZÅÄÖ]/

/* "Lisätietoja", "Lisätiedot", "Yhteyshenkilö(t)", "Yhteystiedot". */
const OTSAKE = /^\s*(lis[äa]tie(?:toja|dot)|yhteyshenkil[öo]t?|yhteystiedot)\s*:?\s*/i

/*
 * Numeron tunnus: "puh.", "p." tai "puhelin". Pelkkä "p." vaatii
 * pisteen, ettei sanan sisältä löytyvä p käynnistä henkilöä.
 */
const HENKILO = /([^]*?)(?:,\s*)?(?:puh\.?|puhelin|p\.)\s*(\+?\d[\d\s()+-]{5,})/gi

/* Mahdollinen tunnus + numeromainen jono, tunnuksen lisäämistä varten. */
const NUMEROJONO = /(puh\.|puhelin|p\.|puh)?[\s:]*(\+?\d[\d\s()-]{5,}\d)/gi

/*
 * Lyhenne ei ole nimi. "DI", "FM", "SAFA" kirjoitetaan isolla, joten
 * pelkkä iso alkukirjain ei riitä nimen tunnusmerkiksi.
 */
const LYHENNE = /^[A-ZÅÄÖ]{1,4}\.?$/

function pakene(teksti: string): string {
  return teksti.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/*
 * Numero ilman tunnusta: Lohjan "DI Jarmo Mäkelä 0400-220082".
 * Tunnus lisätään ennen jäsennystä, jotta jatko näkee vain yhden
 * muodon. Suomalainen numero alkaa nollalla tai plussalla ja siinä on
 * 6-13 numeroa, joten kaavatunnus ("L125") tai päivämäärä ei kelpaa.
 */
function lisaaPuhTunnus(teksti: string): string {
  return teksti.replace(NUMEROJONO, (koko, tunnus, numero) => {
    if (tunnus) return koko
    const siisti = String(numero).trim()
    const maara = siisti.replace(/\D/g, "").length
    if (!/^(\+|0)/.test(siisti) || maara < 6 || maara > 13) return koko
    return " puh. " + siisti
  })
}

function siivoa(teksti: string): string {
  return teksti
    .replace(OSOITE, " ")
    .replace(/\b(s[äa]hk[öo]posti|email|e-mail)\s*:?/gi, " ")
    .replace(/^[\s,;:]*(?:ja|tai|sek[äa])\b/i, " ")
    .replace(/\b(tai|ja|sek[äa])\b\s*$/i, " ")
    .replace(/[\s,;:|]+/g, " ")
    .trim()
}

/* Nimikkeen reunoilta jäävä välimerkki: "kaavoitusarkkitehti ." */
function siistiNimike(teksti: string | null): string | null {
  const siisti = String(teksti ?? "").replace(/^[\s.,;:\-]+|[\s.,;:\-]+$/g, "").trim()
  return siisti || null
}

/*
 * YRITYSMUOTO ERISTÄÄ ORGANISAATION.
 *
 * Vesilahdella luki "kaavan laatija Juri Pelkonen, Suomen
 * Aluerakennuttaja Oy -SARA": PILKKU erottaa henkilön yrityksestä, ja
 * kun pilkut vaihdettiin välilyönneiksi, nimeksi tuli "Aluerakennuttaja
 * Oy" ja oikea nimi Juri Pelkonen valui nimikkeeseen. Raja on siis
 * luettava ennen pilkkujen poistoa — "/" oli vain yksi erotin kahdesta.
 */
const YHTIOMUOTO = /(^|[\s\-])(oy|oyj|ab|ltd|ky|k[äa]o|as)\b\.?/i

function erotaOrganisaatio(teksti: string): { henkilo: string; organization: string | null } {
  const osat = teksti.split(/[/,]/)
  const kohta = osat.findIndex((o) => YHTIOMUOTO.test(o))
  if (kohta < 0) return { henkilo: teksti, organization: null }

  return {
    henkilo: osat.slice(0, kohta).join(" ").trim(),
    organization: osat.slice(kohta).join(", ").replace(/\s+/g, " ").trim() || null,
  }
}

function onNimisana(sana: string): boolean {
  return ISO_ALKU.test(sana) && !LYHENNE.test(sana)
}

function jaaNimeen(teksti: string): {
  name: string | null
  title: string | null
  organization: string | null
} {
  /* Organisaatio irti ennen pilkkujen poistoa, ks. erotaOrganisaatio. */
  const { henkilo, organization } = erotaOrganisaatio(
    teksti.replace(OSOITE, " ").replace(/\b(s[äa]hk[öo]posti|email|e-mail)\s*:?/gi, " ")
  )

  const sanat = siivoa(henkilo).split(" ").filter(Boolean)

  /*
   * Häntä pois ensin: nimen JÄLKEEN tuleva nimike. Ilman tätä
   * "Seppo Lamppu DI kaavakonsultti" ei tuottanut nimeä lainkaan.
   */
  const hanta: string[] = []
  while (sanat.length && !onNimisana(sanat[sanat.length - 1])) {
    hanta.unshift(sanat.pop() as string)
  }

  const nimiOsat: string[] = []
  while (sanat.length && nimiOsat.length < 2 && onNimisana(sanat[sanat.length - 1])) {
    nimiOsat.unshift(sanat.pop() as string)
  }

  const nimike = siistiNimike([...sanat, ...hanta].join(" "))

  /* Yksi sana ei yksilöi ketään: parempi jättää nimi tyhjäksi. */
  if (nimiOsat.length < 2) {
    const kaikki = siistiNimike([...sanat, ...nimiOsat, ...hanta].join(" "))
    return { name: null, title: kaikki, organization }
  }

  return { name: nimiOsat.join(" "), title: nimike, organization }
}

function nimenKohta(lohko: string, name: string): number {
  const sukunimi = name.split(" ").pop() as string
  return lohko.search(new RegExp(pakene(sukunimi)))
}

function osoiteAlueelta(lohko: string): string | null {
  return (lohko.match(OSOITE) ?? []).find((e) => !onMalliosoite(e)) ?? null
}

export function parseYhteystietolohko(text: string | null | undefined): Yhteyshenkilo[] {
  if (!text) return []

  /* "klaus.seppanen(at)lohja.fi" -> oikea osoite ennen jäsennystä. */
  const runko = lisaaPuhTunnus(deobfuscateEmails(String(text)).replace(OTSAKE, ""))
  const osumat = [...runko.matchAll(HENKILO)]
  const tulos: Yhteyshenkilo[] = []

  for (const osuma of osumat) {
    const lohko = osuma[1] ?? ""
    const { name, title, organization } = jaaNimeen(lohko)
    if (!name) continue

    const kohta = nimenKohta(lohko, name)
    const omaOsoite = kohta >= 0 ? osoiteAlueelta(lohko.slice(kohta)) : null
    const edellisen = kohta > 0 ? osoiteAlueelta(lohko.slice(0, kohta)) : null

    if (edellisen && tulos.length && !tulos[tulos.length - 1].email) {
      tulos[tulos.length - 1].email = edellisen
    }

    tulos.push({
      name,
      title,
      phone: osuma[2].trim().replace(/[\s,.]+$/, "").replace(/\s+/g, " "),
      email: omaOsoite,
      organization,
    })
  }

  /* Viimeisen osoite voi olla vielä viimeisen numeron jälkeen. */
  if (tulos.length && !tulos[tulos.length - 1].email && osumat.length) {
    const viimeinen = osumat[osumat.length - 1]
    const hanta = runko.slice((viimeinen.index ?? 0) + viimeinen[0].length)
    const osoite = osoiteAlueelta(hanta)
    if (osoite) tulos[tulos.length - 1].email = osoite
  }

  /*
   * Ei numeroa lainkaan: tulkitaan koko lohko yhdeksi henkilöksi —
   * mutta vain jos osoite löytyy.
   *
   * OSOITE TAI NUMERO ON PAKKO OLLA. Ilman kumpaakaan jäljellä on
   * pelkkä isolla alkavien sanojen pari, ja sellainen on useimmiten
   * kaavan otsikko: "L125 Virkkalantien alikulkusilta" meni tästä
   * läpi henkilönä nimeltä "L125 Virkkalantien". Yhteystieto jota ei
   * voi ottaa yhteyttä ei ole yhteystieto.
   */
  if (!tulos.length) {
    const osoitteet = (runko.match(OSOITE) ?? []).filter((e) => !onMalliosoite(e))
    const { name, title, organization } = jaaNimeen(runko)
    if (name && osoitteet.length === 1) {
      tulos.push({ name, title, phone: null, email: osoitteet[0], organization })
    }
  }

  return tulos
}
