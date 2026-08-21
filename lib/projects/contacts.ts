/*
 * YHTEYSHENKILÖT TIEDOTTEEN TEKSTISTÄ.
 *
 * MIKSI TÄMÄ ON KRIITTINEN. Testiasiakkaiden kolmesta syystä olla
 * jättämättä tilausta yksi oli "liian vähän yhteystietoja" (ks.
 * `docs/00_PRODUCT_BLUEPRINT.md`). Hanke ilman yhteyshenkilöä on
 * myyjälle puolivalmis: hän tietää että kohde on olemassa muttei kenelle
 * soittaa.
 *
 * TIETO ON JO KANNASSA. Mitattu 22.8.2026: 566 hankkeella 5 752:sta
 * kuvaustekstissä on sekä sähköposti että puhelinnumero — nimineen ja
 * tehtävineen. Sitä ei vain ole poimittu omaksi kentäkseen, joten se on
 * käyttäjälle proosaa keskellä pitkää tiedotetta.
 *
 * ANKKURI ON SÄHKÖPOSTI. Muoto vaihtelee lähteittäin rajusti:
 *
 *   SRV      "Jani Peltomäki, aluejohtaja, SRV, puh. 044 085 0412, jani.peltomaki@srv.fi"
 *   STT      "Mervi Roiha-Muilu kiinteistöpäällikkö Kela Puh: 020 634 1693 etunimi.sukunimi@kela.fi"
 *   YVA      "Norsk e-Fuel AS, Niko Salonen, nsalonen@norsk-e-fuel.com, p. 050 4680 966"
 *   Pohjola  "Maarit Rauhanen asuntomyyjä, LKV maarit.rauhanen@pohjolarakennus.fi 044 421 0048"
 *
 * Yhteistä on vain sähköposti. Se on yksiselitteinen ja koneellisesti
 * varma, joten poiminta tehdään sen ympäriltä eikä otsikon perusteella.
 */

export type Contact = {
  name: string | null
  title: string | null
  organization: string | null
  email: string
  phone: string | null
  /* Henkilö vai organisaation yleinen laatikko (kirjaamo@, info@). */
  kind: "person" | "organization"
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

/*
 * Suomalainen puhelinnumero. Sallitaan +358 ja 0-alku, väliviivat ja
 * välilyönnit — tiedotteissa esiintyy kaikkia muotoja.
 */
const PHONE_RE =
  /(?:\+358|0)\s?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2,4}(?:[\s-]?\d{1,4})?/

/*
 * Yleiset postilaatikot eivät ole myyntikontakteja: ne ovat kirjaamoja ja
 * palautekanavia. Ne poimitaan silti, mutta merkitään organisaatioksi,
 * jotta käyttöliittymä voi näyttää henkilöt ensin.
 *
 * "etunimi.sukunimi" on erikoistapaus: STT:n tiedotteissa se on
 * kirjaimellisesti tuossa muodossa eikä ole kenenkään osoite.
 */
const ROLE_MAILBOX =
  /^(kirjaamo|info|asiakaspalvelu|palaute|posti|myynti|tiedotus|viestinta|viestintä|kaavoitus|elinvoima|tekninen|hallinto|neuvonta|etunimi\.sukunimi|firstname\.lastname)\b/i

/*
 * Nimi: kaksi tai kolme isolla alkavaa sanaa. Suomalaisissa sukunimissä
 * on väliviivoja ja ääkkösiä, ja etunimi voi olla lyhennetty ("Jan-Erik").
 */
const NAME_RE =
  /\b([A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?)\s+([A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?)\b/g

/*
 * Sanoja jotka eivät ole nimiä vaikka näyttävät siltä. Ilman tätä
 * "Lisätiedot Jani" ja "Puh Mervi" tuottaisivat roskaa.
 */
const NOT_A_NAME =
  /^(Lisätiedot|Lisätietoja|Yhteyshenkilöt|Yhteystiedot|Puh|Tel|Sähköposti|Media|Jakelu|Liite|Kuva|Tiedotteen)$/i

/* Organisaatiomuodot joista tunnistaa yrityksen nimen tekstistä. */
const ORG_RE =
  /\b([A-ZÅÄÖ][\wåäöÅÄÖ&.\- ]{2,40}?(?:Oy|Oyj|Ab|Ltd|AS|ry|säätiö|kaupunki|kunta|hyvinvointialue|seurakunta|yhtymä))\b/

const WINDOW_BEFORE = 170
const WINDOW_AFTER = 60

function clean(value: string): string {
  return value.replace(/\s+/g, " ").replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "").trim()
}

/*
 * Nimi ikkunasta: VIIMEINEN kelvollinen nimi ennen sähköpostia, koska
 * lähin nimi kuuluu tälle osoitteelle. Aiemmat kuuluvat edellisille
 * yhteyshenkilöille tai leipätekstin sitaateille.
 */
function findName(before: string): string | null {
  let last: string | null = null

  for (const m of before.matchAll(NAME_RE)) {
    if (NOT_A_NAME.test(m[1]) || NOT_A_NAME.test(m[2])) continue
    last = `${m[1]} ${m[2]}`
  }

  return last
}

/*
 * Sähköpostista pääteltävä nimi, kun tekstistä ei löydy:
 * "jani.peltomaki@srv.fi" -> "Jani Peltomaki". Ei käytetä
 * roolilaatikoihin eikä lyhenteisiin ("nsalonen@").
 */
function nameFromEmail(email: string): string | null {
  const local = email.split("@")[0]
  if (ROLE_MAILBOX.test(local)) return null

  const parts = local.split(".").filter((p) => p.length >= 2 && /^[a-zåäö-]+$/i.test(p))
  if (parts.length < 2) return null

  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ")
}

/*
 * Tehtävänimike: nimen ja sähköpostin/puhelimen välissä oleva teksti.
 * Karsitaan numerot ja täytesanat, jotta jäljelle jää "aluejohtaja" eikä
 * "aluejohtaja, SRV, puh. 044 085 0412".
 */
function findTitle(between: string, organization: string | null): string | null {
  let text = clean(between)
  if (organization) text = text.replace(organization, " ")

  /*
   * Yhden kirjaimen "p" on poistettava VAIN pisteen kanssa ("p. 050…").
   * Ilman sitä `\bp\b` osui sanan "päällikkö" alkuun, koska ä ei ole
   * JS:n regexissä sanamerkki — tuloksena "viestintä äällikkö".
   */
  text = text
    .replace(PHONE_RE, " ")
    .replace(/\bp\.\s*/gi, " ")
    .replace(/\b(puh|puhelin|tel|gsm|s-posti|sähköposti|email)\b\.?:?/gi, " ")
    .replace(/[|/]+/g, " ")

  const osat = text
    .split(/[,;]/)
    .map(clean)
    .filter((o) => o.length >= 3 && o.length <= 60 && !/\d/.test(o))

  return osat.length ? osat.join(", ").slice(0, 120) : null
}

/*
 * Sama nimi tarkkeet sivuuttaen: "Peltomaki" = "Peltomäki".
 * Sähköpostiosoitteissa ä ja ö on korvattu a:lla ja o:lla, joten
 * vertailu on tehtävä ilman niitä.
 */
function sameName(a: string, b: string): boolean {
  const riisu = (x: string) =>
    x.toLowerCase().replace(/[äå]/g, "a").replace(/ö/g, "o").replace(/[^a-z ]/g, "")
  return riisu(a) === riisu(b)
}

/*
 * Lähin puhelinnumero sähköpostiin nähden. Ikkunan alusta luettu numero
 * kuuluu usein EDELLISELLE yhteyshenkilölle, joten etsitään sekä ennen
 * että jälkeen ja otetaan lähempi.
 */
/*
 * Suomalaisessa numerossa on 9-12 numeroa suuntanumero mukaan lukien.
 * Ilman tätä tarkistusta diaarinumero meni puhelimesta: mitattu
 * 22.8.2026, "Kai Vaisto (026-1401)". Väärä numero on käyttäjälle
 * pahempi kuin puuttuva, koska hän soittaa sen.
 */
function isPhone(value: string): boolean {
  const numerot = value.replace(/\D/g, "").length
  return numerot >= 9 && numerot <= 12
}

function nearestPhone(before: string, after: string): string | null {
  let edellinen: string | null = null
  let etaisyys = Infinity

  for (const m of before.matchAll(new RegExp(PHONE_RE, "g"))) {
    if (!isPhone(m[0])) continue
    const d = before.length - ((m.index ?? 0) + m[0].length)
    if (d < etaisyys) {
      etaisyys = d
      edellinen = m[0]
    }
  }

  const jalkeen = after.match(PHONE_RE)
  if (jalkeen && isPhone(jalkeen[0]) && (jalkeen.index ?? 0) < etaisyys) {
    return clean(jalkeen[0]) || null
  }

  return edellinen ? clean(edellinen) || null : null
}

/*
 * Organisaatio ensisijaisesti SÄHKÖPOSTIN DOMAINISTA, koska tekstistä
 * luettuna se osui mitatusti katkelmiin ("Vireillä Rauma Satakun",
 * "Voimalaitokset Valoa N"). Domain on lyhyt ja aina oikea.
 *
 * Yleiset postilaatikkopalvelut jätetään pois: gmail ei ole organisaatio.
 */
const FREE_MAIL = /^(gmail|hotmail|outlook|live|icloud|yahoo|suomi24|luukku|elisanet|pp|kolumbus)\./i

function organizationFor(email: string, before: string): string | null {
  const domain = email.split("@")[1] ?? ""

  if (domain && !FREE_MAIL.test(domain)) {
    /* "srv.fi" -> "srv", "norsk-e-fuel.com" -> "norsk-e-fuel" */
    const nimi = domain.replace(/\.(fi|com|net|org|eu|se|no|dk)$/i, "").split(".").pop() ?? ""
    if (nimi.length >= 2) return nimi
  }

  return clean(before.match(ORG_RE)?.[1] ?? "") || null
}

export function extractContacts(text: string | null | undefined): Contact[] {
  const source = String(text ?? "")
  if (!source) return []

  const contacts: Contact[] = []
  const seen = new Set<string>()

  for (const match of source.matchAll(EMAIL_RE)) {
    const email = match[0]
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)

    const start = Math.max(0, (match.index ?? 0) - WINDOW_BEFORE)
    const before = source.slice(start, match.index)
    const after = source.slice((match.index ?? 0) + email.length, (match.index ?? 0) + email.length + WINDOW_AFTER)

    /*
     * LÄHIN puhelin, ei ensimmäinen. Ikkunassa on usein edellisen
     * yhteyshenkilön numero: mitattu 22.8.2026, SRV:n tiedotteessa
     * Heidi Tetteh sai Jani Peltomäen numeron, koska se osui ikkunaan
     * ensin. Lähin osuma kuuluu tälle sähköpostille.
     */
    const phone = nearestPhone(before, after)

    /*
     * SÄHKÖPOSTI ON PAREMPI NIMEN LÄHDE KUIN TEKSTI, kun se on muotoa
     * etunimi.sukunimi. Mitattu 22.8.2026: tekstistä luettuna kolme
     * Taalerin yhteyshenkilöä sai kaikki nimekseen "Taaleri
     * Kiinteistöt", koska lähin isolla alkava sanapari oli yrityksen
     * nimi. Sähköposti antoi jokaiselle oikean nimen.
     *
     * Teksti on varalla niille joiden osoite on lyhenne
     * ("nsalonen@norsk-e-fuel.com").
     */
    const nameFromText = findName(before)
    const nameFromAddress = nameFromEmail(email)

    /*
     * ÄÄKKÖSET OTETAAN TEKSTISTÄ. Sähköposti on ASCII, joten siitä
     * luettuna nimi on "Jani Peltomaki" ja "Tiia Jarvi". Kun tekstin nimi
     * vastaa samaa nimeä ilman tarkkeita, teksti voittaa — se on sama
     * henkilö oikein kirjoitettuna. Muuten sähköposti voittaa, koska se
     * osoittautui mitatusti luotettavammaksi (ks. yllä).
     */
    const name =
      nameFromAddress && nameFromText && sameName(nameFromAddress, nameFromText)
        ? nameFromText
        : nameFromAddress ?? nameFromText

    const organization = organizationFor(email, before)

    /*
     * Nimi tekstistä on luotettavampi kuin sähköpostista pääteltu, joten
     * tehtävänimike luetaan vain silloin kun nimi oikeasti löytyi.
     */
    const ankkuri = nameFromText && before.includes(nameFromText) ? nameFromText : null
    const title = ankkuri
      ? findTitle(before.slice(before.lastIndexOf(ankkuri) + ankkuri.length), organization)
      : null

    const local = email.split("@")[0]
    const kind: Contact["kind"] =
      ROLE_MAILBOX.test(local) || !name ? "organization" : "person"

    contacts.push({ name, title, organization, email, phone, kind })
  }

  /* Henkilöt ensin: myyjälle nimetty kontakti on arvokkaampi. */
  return contacts.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "person" ? -1 : 1))
}

/*
 * Onko poiminnassa mitään myyjälle arvokasta? Pelkkä kirjaamon osoite ei
 * ole yhteyshenkilö.
 */
export function hasPersonContact(contacts: Contact[]): boolean {
  return contacts.some((c) => c.kind === "person")
}

/*
 * Kahden lähteen yhteyshenkilöt yhteen. Avain on sähköposti: sama
 * henkilö ei tule kahdesti, mutta uusi tulee aina mukaan.
 *
 * Tyhjät kentät täydennetään uudesta: ensimmäinen lähde saattoi antaa
 * pelkän osoitteen ja toinen nimen ja puhelimen.
 */
/*
 * Avain: sähköposti kun se on, muuten nimi ja puhelin.
 *
 * PELKKÄ SÄHKÖPOSTI EI RIITÄ. Kaavalähteistä tulleilla yhteyshenkilöillä
 * osoite on usein tyhjä ("Valtteri Tupala, 044 740 1408, email: null").
 * Ensimmäinen versio ohitti ne kokonaan, jolloin takautuva ajo olisi
 * PUDOTTANUT olemassa olevia kontakteja: kuivaharjoitus 22.8.2026 näytti
 * rivejä 2 -> 1 ja 1 -> 0.
 */
function contactKey(c: Contact): string | null {
  if (c?.email) return `e:${c.email.toLowerCase()}`

  const nimi = String(c?.name ?? "").trim().toLowerCase()
  const puh = String(c?.phone ?? "").replace(/\D/g, "")
  if (!nimi && !puh) return null

  return `n:${nimi}|${puh}`
}

export function mergeContacts(
  existing: Contact[] | null | undefined,
  incoming: Contact[] | null | undefined
): Contact[] {
  const byEmail = new Map<string, Contact>()

  for (const c of existing ?? []) {
    const key = contactKey(c)
    if (key) byEmail.set(key, c)
  }

  for (const c of incoming ?? []) {
    const key = contactKey(c)
    if (!key) continue
    const vanha = byEmail.get(key)

    byEmail.set(
      key,
      vanha
        ? {
            ...vanha,
            email: vanha.email ?? c.email,
            name: vanha.name ?? c.name,
            title: vanha.title ?? c.title,
            organization: vanha.organization ?? c.organization,
            phone: vanha.phone ?? c.phone,
            kind: vanha.kind === "person" || c.kind === "person" ? "person" : "organization",
          }
        : c
    )
  }

  return [...byEmail.values()].sort((a, b) =>
    a.kind === b.kind ? 0 : a.kind === "person" ? -1 : 1
  )
}
