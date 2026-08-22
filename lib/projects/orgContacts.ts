import type { Contact } from "@/lib/projects/contacts"

/*
 * KUNNAN YLEINEN YHTEYSTIETO.
 *
 * MIKSI. 2 483 asiakkaille näkyvää hanketta on ilman yhteystietoa, ja
 * jokaisesta tiedetään joko osapuoli tai kunta — ei yhdestäkään puutu
 * molempia. Jakauma on äärimmäisen keskittynyt, ja valtaosa puutteesta
 * on kunnallisia hankkeita (kaavat, päätökset, luvat).
 *
 * MIKÄ EI TOIMI — kolme mitattua epäonnistumista 22.8.2026:
 *
 *   1. "Sama osapuoli → sama yhteystieto." Hankkeelle tallennettu
 *      yhteystieto ei ole osapuolen vaan sen viranomaisen tai
 *      konsultin, joka sattui olemaan tekstissä:
 *        Tampereen kaupunki -> kirjaamo.pirkanmaa@ely-keskus.fi
 *
 *   2. "Kunta varalle kun osapuolelle ei löydy." Yksityisen hankkeen
 *      yhteystiedoksi tuli kunnan kaavoitus:
 *        Atria -> kaavoitus@seinajoki.fi
 *
 *   3. "Verkkotunnus sisältää nimen sanan." Yleissana osuu väärään
 *      tunnukseen — ja tämä tuotti 794 väärää paria:
 *        Tampereen kaupunki -> kaavoitus@uusi[kaupunki].fi
 *        SRV ja CSC         -> kirjaamo.pohjois-pohjanmaa@ely-[keskus].fi
 *
 * MIKÄ TOIMII. Rajaus kuntiin ja TÄSMÄLLINEN verkkotunnus. Kunnan
 * verkkotunnus on käytännössä aina kunnan nimi sellaisenaan
 * (tampere.fi, tohmajarvi.fi, rovaniemi.fi), joten osittaisosumaa ei
 * tarvita eikä sallita. Poikkeukset ovat lyhyt, mitattu lista.
 *
 * Yrityksiä tämä ei kata tarkoituksella: yrityksen verkkotunnusta ei voi
 * päätellä nimestä (Tampereen Tilapalvelut Oy -> tilapa.fi).
 *
 * ARVO ON RAJALLINEN JA TIEDOSTETTU. Kirjaamo ei ole myyjälle yhtä
 * arvokas kuin nimetty henkilö (vrt. D-102, jossa Lupapiste hylättiin
 * viranomaislaatikoiden takia). Nämä merkitään aina
 * `kind: "organization"`, jolloin käyttöliittymä näyttää henkilöt ensin
 * ja mittarit erottavat ne toisistaan.
 */

/*
 * Roolilaatikko: palvelee koko organisaatiota, ei ketään yksittäistä.
 * Siksi sen siirtäminen hankkeesta toiseen ei väitä mitään väärää.
 */
/*
 * Osa kunnista kirjoittaa roolin nimen JÄLKEEN pisteen: Helsingin
 * kirjaamo on "helsinki.kirjaamo@hel.fi". Ankkuri on siksi pisteraja,
 * ei paikallisosan alku — muuten Helsinki (579 hanketta, suurin
 * yksittäinen puute) jäisi kokonaan tunnistamatta.
 */
const ROLE_LOCAL =
  /(^|\.)(kirjaamo|registratur|registrator|info|asiakaspalvelu|palaute|neuvonta|kaavoitus|planlaggning|rakennusvalvonta|byggnadstillsyn|tekninen|tilapalvelu|tilapalvelut|yhdyskunta|kaupunkiymparisto|kaupunkiympäristö|kaupunkisuunnittelu|elinvoima|maankaytto|maankäyttö|kaupunki|kunta|stad|kommun)(\.|$)/i

const EMAIL_SHAPE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

/*
 * Verkkotunnuksen pääte on tarkistettava. Tiedotetekstissä osoite tarttuu
 * kiinni seuraavaan sanaan, koska rivinvaihto katoaa: mitattu 22.8.2026,
 * "kirjaamo@vaala.fiosallistumis" olisi mennyt läpi viidelle hankkeelle.
 */
const TLD = /\.(fi|ax|com|net|org|eu|se|no|dk|io|info)$/

export function isRoleMailbox(email: string | null | undefined): boolean {
  const osoite = String(email ?? "").trim().toLowerCase()
  if (!EMAIL_SHAPE.test(osoite)) return false

  const domain = osoite.split("@")[1] ?? ""
  if (!TLD.test(domain)) return false

  return ROLE_LOCAL.test(osoite.split("@")[0])
}

export function asciiName(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[äå]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]/g, "")
}

/*
 * Kunnat joiden verkkotunnus ei ole nimi sellaisenaan. Lista täydennetään
 * vain mitatusti — arvattu tunnus on juuri se virhe jota tämä moduuli
 * yrittää estää.
 */
export const MUNICIPALITY_DOMAIN_ALIASES: Record<string, string> = {
  helsinki: "hel",
}

/*
 * Verkkotunnuksen isäntäosa on täsmälleen kunnan nimi. Ei sisältymistä,
 * ei etuliitteitä: "uusikaupunki" ei ole "kaupunki" eikä "tampere".
 */
export function domainIsMunicipality(
  domain: string | null | undefined,
  municipalityName: string | null | undefined
): boolean {
  const isanta = String(domain ?? "").toLowerCase().split(".")[0].replace(/[^a-z0-9-]/g, "")
  const nimi = asciiName(municipalityName)
  if (!isanta || nimi.length < 3) return false

  const puhdas = isanta.replace(/-/g, "")
  return puhdas === nimi || puhdas === MUNICIPALITY_DOMAIN_ALIASES[nimi]
}

export function isMunicipalityContact(
  email: string | null | undefined,
  municipalityName: string | null | undefined
): boolean {
  if (!isRoleMailbox(email)) return false
  return domainIsMunicipality(String(email).split("@")[1], municipalityName)
}

export function orgContact(email: string, organization: string): Contact {
  return {
    name: null,
    title: null,
    organization,
    email: email.trim().toLowerCase(),
    phone: null,
    /* Aina organisaatio — ei koskaan henkilö. */
    kind: "organization",
  }
}
