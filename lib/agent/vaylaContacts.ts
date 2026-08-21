import type { Contact } from "@/lib/projects/contacts"

/*
 * VÄYLÄVIRASTON YHTEYSHENKILÖN SIIVOUS.
 *
 * Hankesivun yhteystietolohko on rakenteinen ja poiminta on ollut
 * olemassa alusta asti (`fetchVaylaProjectDetails`). Mitattu 22.8.2026:
 * 25:stä yhteystiedottomasta hankkeesta 20:llä lohko löytyi ja kaikilla
 * 20:llä oli nimi. Puuttuvien syy ei ollut poiminta vaan se, ettei
 * detaljisivua ehditty hakea (36/188 dokumenttia).
 *
 * Poimittu data ei silti kelpaa sellaisenaan, koska siinä on kaksi ansaa:
 *
 *   1. SÄHKÖPOSTI ON PAIKANPITÄJÄ. Lähes joka sivulla lukee
 *      "etunimi.sukunimi@vayla.fi" — Cloudflaren suojaus purkautuu
 *      oikein, mutta osoite itsessään on malli eikä kenenkään osoite.
 *      Otoksen 14 osoitteesta 13 oli tätä muotoa.
 *
 *   2. NIMIKENTÄSSÄ EI AINA OLE HENKILÖÄ. Esimerkiksi "Siltatyöt
 *      Satakunnassa" antaa nimeksi "Yhteydenotot Palauteväylän kautta
 *      (palautevayla.fi)".
 */

/*
 * Malliosoite tunnistetaan KAHDESSA VAIHEESSA, ja se on olennaista.
 *
 * PLACEHOLDER_HINT kertoo että kyseessä on malli, PLACEHOLDER_LOCAL että
 * malli on tunnistettu tarkalleen. Ensimmäinen versio tarkisti vain
 * jälkimmäisen ja palautti tuntemattoman muodon sellaisenaan — jolloin
 * kuivaharjoitus 22.8.2026 näytti rivin
 *
 *   Vesa Pakarinen | Projektipäällikkö | 029 534 3149 | etunimi.sukuni@vayla.fi
 *
 * eli sivulla ollut kirjoitusvirhe olisi tallentunut asiakkaalle
 * näytettäväksi sähköpostiosoitteeksi. Väärä osoite on pahempi kuin
 * puuttuva: käyttäjä luulee lähettäneensä viestin.
 */
const PLACEHOLDER_HINT = /(etunimi|sukunimi|firstname|lastname|fornamn|efternamn)/i
const PLACEHOLDER_LOCAL = /^(etunimi\.sukunimi|firstname\.lastname|fornamn\.efternamn)$/i

const EMAIL_SHAPE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/* Nimen sana: iso alkukirjain, ääkköset ja väliviiva sallittuja. */
const NAME_WORD = /^[A-ZÅÄÖ][a-zåäöA-ZÅÄÖ]+(?:-[A-ZÅÄÖ][a-zåäö]+)?$/

/*
 * Sana joka paljastaa ettei kyse ole henkilöstä, vaikka muoto kelpaisi.
 * Tehtävänimikkeiden päätteet ja toimielinten nimet kattavat valtaosan.
 */
const NOT_A_PERSON_WORD =
  /^(oy|oyj|ab|ltd|ky|kb|valmistelija|esittelijä|esittelija|yhteyshenkilö|yhteyshenkilo|etunimi|sukunimi|firstname|lastname|fornamn|efternamn)$|(päällikkö|paallikko|johtaja|insinööri|insinoori|arkkitehti|sihteeri|suunnittelija|asiantuntija|lautakunta|valtuusto|hallitus|virasto|kaupunki|kunta|toimisto|yksikkö|yksikko|osasto|palvelut|keskus|kansa|sanomat|uutiset|tuulivoima|energia|rakennus|kiinteistöt|kiinteistot)$/i

/*
 * Nimikenttä on henkilö vain jos siinä on 2-3 nimisanaa eikä mitään
 * muuta. Sulkeet, numerot ja verkko-osoitteet kertovat että kyseessä on
 * ohje ("Yhteydenotot Palauteväylän kautta (palautevayla.fi)").
 */
export function isPersonName(value: string | null | undefined): boolean {
  const nimi = String(value ?? "").trim()
  if (!nimi || nimi.length > 60) return false
  if (/[\d()@/]|www\.|\.fi\b/i.test(nimi)) return false

  const sanat = nimi.split(/\s+/)
  if (sanat.length < 2 || sanat.length > 3) return false

  return sanat.every((s) => NAME_WORD.test(s))
}

/*
 * "Kari Partiainen" + "etunimi.sukunimi@vayla.fi" -> "kari.partiainen@vayla.fi".
 *
 * Tämä ei ole arvaus: paikanpitäjä on organisaation oma ilmoitus siitä,
 * missä muodossa sen osoitteet ovat. Laajennus tehdään silti vain
 * KAKSIOSAISESTA nimestä — kolmiosaisessa ("Anna Maria Virtanen") ei voi
 * tietää kumpi etunimistä on käytössä.
 */
export function expandPlaceholderEmail(
  email: string | null | undefined,
  name: string | null | undefined
): string | null {
  const osoite = String(email ?? "").trim()
  if (!osoite || !EMAIL_SHAPE.test(osoite)) return null

  const [local, domain] = osoite.split("@")

  /* Oikea osoite: ei viitettä malliin. */
  if (!PLACEHOLDER_HINT.test(local)) return osoite

  /* Malli, jota ei tunnisteta tarkalleen — siitä ei voi päätellä mitään. */
  if (!PLACEHOLDER_LOCAL.test(local)) return null

  /*
   * NIMEN ON OLTAVA HENKILÖN NIMI. Mitattu 22.8.2026: ilman tätä porttia
   * laajennus tuotti osoitteet "lapin.kansa@rovaniemi.fi" (sanomalehti),
   * "tekninen.lautakunta@rovaniemi.fi" (lautakunta) ja
   * "kaavoituspaallikko.markku@rovaniemi.fi" (nimike + etunimi).
   */
  if (!isPersonName(name)) return null

  const sanat = String(name ?? "").trim().split(/\s+/)
  if (sanat.length !== 2) return null
  if (sanat.some((s) => NOT_A_PERSON_WORD.test(s))) return null

  const riisu = (s: string) =>
    s
      .toLowerCase()
      .replace(/[äå]/g, "a")
      .replace(/ö/g, "o")
      .replace(/[^a-z-]/g, "")

  const etu = riisu(sanat[0])
  const suku = riisu(sanat[1])
  if (etu.length < 2 || suku.length < 2) return null

  return `${etu}.${suku}@${domain}`
}

export type VaylaContactBox = {
  organization: string | null
  title: string | null
  name: string | null
  phone: string | null
  email: string | null
}

/*
 * Palauttaa tyhjän kun lohkossa ei ole henkilöä. Organisaation yleisohje
 * ("ota yhteyttä Palauteväylän kautta") ei ole myyntikontakti eikä sitä
 * kannata näyttää sellaisena.
 */
export function normalizeVaylaContact(box: VaylaContactBox | null | undefined): Contact[] {
  if (!box) return []

  const name = isPersonName(box.name) ? String(box.name).trim() : null
  if (!name) return []

  const email = expandPlaceholderEmail(box.email, name)
  const phone = String(box.phone ?? "").trim() || null

  /* Ilman numeroa ja osoitetta jäljelle jää pelkkä nimi — ei yhteystieto. */
  if (!email && !phone) return []

  /*
   * Nimike on sivuilla milloin milläkin kirjasinkoolla
   * ("PROJEKTIPÄÄLLIKKÖ", "Projektipäällikkö", "projektipäällikkö").
   * Isot kirjaimet ovat taittoa, eivät sisältöä.
   */
  const rawTitle = String(box.title ?? "").trim()
  const title = rawTitle === rawTitle.toUpperCase() && rawTitle.length > 3
    ? rawTitle.charAt(0) + rawTitle.slice(1).toLowerCase()
    : rawTitle || null

  return [
    {
      name,
      title: title || null,
      organization: String(box.organization ?? "").trim() || null,
      email: email ?? "",
      phone,
      kind: "person",
    },
  ]
}
