import { onMalliosoite } from "@/lib/projects/contacts"

/*
 * OAS:N "YHTEYSTIEDOT"-LUKU HENKILOIKSI (D-413).
 *
 * Johannes 14.11.2026 Huittisten Hiukkamaen teollisuusalueesta:
 * *"myos yhteystiedot ovat pdf liitteessa, ne pitaa poimia."*
 *
 * OAS-pohjassa yhteystiedot ovat VIIMEISENA lukuna, rivi kerrallaan:
 *
 *   6. YHTEYSTIEDOT
 *   Kaavaa laativa asiantuntija                       <- rooli
 *   Arkkitehti Markus Makkonen, NOAR Oy               <- nimike, nimi, yritys
 *   Olympiastadion, Paavo Nurmen tie 1, 00250 Helsinki <- osoite
 *   p. +358 40 582 41 34
 *   markus.makkonen@noar.fi
 *   Hanketoimija                                      <- rooli
 *   Juha Pontinen, FCDC Corp Oy                       <- nimi ilman nimiketta
 *   ...
 *   Huittisten kaupunki                               <- organisaatio
 *   Kaavoitusarkkitehti Annamaria Puumala
 *
 * MIKSI OMA JASENNIN. `kaavanYhteyshenkilot` (D-230) poimii nimen vain
 * nimikkeen perasta, joten "Juha Pontinen, FCDC Corp Oy" jaisi pois --
 * ja juuri han on hanketoimija eli rakennuttaja. Taalla nimike tulee
 * usein EDELTAVALTA rivilta. `parseYhteystietolohko` taas lukee
 * kappaletta eika riveja, ja osoiterivit valuivat nimikkeeseen.
 *
 * RAJAUS: vain otsikon "YHTEYSTIEDOT" alta, ei muualta tekstista.
 * Sisallysluettelon rivi ("6. YHTEYSTIEDOT ........ 18") ei kelpaa
 * otsikoksi, koska rivilla on pisteita ja sivunumero.
 *
 * Kaupungin yleinen postilaatikko ("kaupunki@huittinen.fi") ennen
 * ensimmaista henkiloa ei kuulu kenellekaan, joten se ohitetaan.
 */

export type OasYhteystieto = {
  name: string
  title: string | null
  phone: string | null
  email: string | null
  organization: string | null
}

const OTSIKKO = /^\s*(?:\d+\.?\s+)?(YHTEYSTIEDOT|YHTEYSHENKIL[ÖO]T)\s*:?\s*$/i

/* Seuraava numeroitu luku paattaa luvun. */
const SEURAAVA_LUKU = /^\s*\d{1,2}(?:\.\d+)*\.?\s+[A-ZÄÖÅ]{3}/

/* "Puh. vaihde 0207 911 888" (Lintukangas): vaihde merkitaan numeron perään. */
const PUHELIN = /^(?:p|puh|puhelin|tel|gsm)\.?\s*:?\s*(vaihde\s+)?(\+?\d[\d\s()-]{5,}\d)/i

/* Tutkintolyhenteet, jotka aloittavat nimikkeen pilkun jalkeen. */
const TUTKINTO = /^(FM|DI|KTM|MMM|FT|FL|TkT|TkL|YTM|HTM|ETM|LuK|KTK|insinööri|ins\.|rkm)(?![A-Za-zÅÄÖåäö])/

/* Merkityksettomat valiotsikot, jotka eivat ole rooli eika organisaatio. */
const TYHJA_OTSIKKO = /^(muut\s+)?yhteystiedot$|^lis[äa]tietoja$|^tai(\s+postitse)?$/i
const OSOITE = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i
const VERKKOSIVU = /^(?:www\.|https?:\/\/)/i

/* Postinumero tai katuosoite: "00250 Helsinki", "Mikonkatu 9". */
const KATUOSOITE = /\b\d{5}\b|\b\S*(?:katu|tie|kuja|polku|väylä|vayla|tori|kaari|rinne)\s+\d/i

/* Organisaatiota tarkoittava rivi, ei henkiloa eika roolia. */
/*
 * "kaupunki" ja "kunta" KOKONAISINA SANOINA (D-415): muuten
 * "Kaupunkisuunnittelupäällikkö Marko Luukkonen" (Loviisa) tulkittiin
 * organisaatioksi, koska sanassa on "kaupunki".
 */
const ORGANISAATIO =
  /((?<![A-Za-zÅÄÖåäö])(?:kaupunki|kunta)(?![A-Za-zÅÄÖåäö])|\boy\b|\boyj\b|\bab\b|\bky\b|\bry\b|yhtym[äa]|liitto|virasto|keskus)/i

/*
 * Nimen sana: iso alkukirjain ja sen perassa pienia, valissa sallittu
 * yksi yhdysmerkki ("Anna-Liisa"). Lintukankaan OAS:ssa yrityksen nimi
 * "A-  Insinöörit" tulkittiin ensin henkiloksi, koska "A-" alkaa isolla.
 */
const NIMISANA = /^[A-ZÄÖÅ][a-zåäö]+(?:-[A-ZÄÖÅ][a-zåäö]+)?$/

function onNimisana(sana: string): boolean {
  return NIMISANA.test(sana)
}

/* "kaavaa laativa konsultti" -> "Kaavaa..." ; "YVA-konsultti" sailyy. */
function isoAlku(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1)
}
function pieniAlku(t: string): string {
  return /^[A-ZÄÖÅ][a-zåäö]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t
}

/* "A-  Insinöörit" -> "A-Insinöörit" */
function siistiOrganisaatio(t: string): string {
  return t.replace(/-\s+(?=[A-ZÄÖÅ])/g, "-").replace(/,.*$/, "").replace(/\s+/g, " ").trim()
}

/*
 * RIVI SOLUIKSI (D-415).
 *
 * Kaksipalstainen OAS (Pelkosenniemi, KimmoKaava) yhdistaa palstat
 * samalle riville: "KUNTA:  Emmi Mäkelä     Pelkosenniemen kunta".
 * Kaksi tai useampi valilyonti erottaa solut -- paitsi yhdysmerkin
 * jalkeen, koska Lintukankaassa yrityksen nimi on "A-  Insinöörit".
 * Luettelomerkki ("✓ ") pois alusta.
 */
const LUETTELO = /^[\s✓✔•▪◦*–]+(?=\S)/

function solut(rivi: string): string[] {
  return rivi
    .replace(LUETTELO, "")
    .trim()
    .split(/(?<!-)\s{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/*
 * PUHELIN MISSA KOHTAA SOLUA TAHANSA (D-415): alussa ("Puh. 044 560
 * 4341"), sulkeissa nimen perassa ("(puh. 044 700 2155)", Lokio),
 * keskella ilman valilyontia ("Sari Niemi puh.040-4809187,") tai
 * pilkkulistan lopussa ("Tapani Honkanen, ..., YKS 282, puh. 0400-391
 * 468"). Irrotetaan ennen nimen tulkintaa.
 */
const SISAPUHELIN =
  /\(?\s*(?<![A-Za-zÅÄÖåäö])(?:p|puh|puhelin|tel|gsm)\.?\s*:?\s*(vaihde\s+)?(\+?\d[\d\s\-–]{5,}\d)\s*\)?/i

/* Patevyystunnus ei ole nimike eika yritys: "YKS 282", "YKS-562". */
const PATEVYYS = /^YKS[\s-]?\d+$/i

/* Pelkka numero omassa solussaan ilman "puh."-tunnusta (KimmoKaava). */
const PALJAS_NUMERO = /^(?:\+358|0)[\d\s-]{5,}\d$/

/* Otsikko kaksoispisteella: "Kaavanlaatija:", "KUNTA:", "Pelkosenniemen kunta:". */
const NIMIO = /^([A-Za-zÄÖÅäöå][A-Za-zÄÖÅäöå\s-]{1,40}):$/
const PELKKA_NIMIO = /^(kunta|kaupunki|palaute|yhteystiedot|lis[äa]tietoja)$/i

/* Kunnan yleinen postilaatikko ei ole kenenkaan henkilon osoite. */
const YLEISLAATIKKO = /^(kirjaamo|kunta|kaupunki|info|asiakaspalvelu|palaute|kaavoitus|tekninen|maankaytto|ymparisto)@/i

/* Osoitelohkon sanat eivat ole etu- eika sukunimia: "Kotipaikka Helsinki" (FCG). */
const NIMI_EI = /^(kotipaikka|osoite|postiosoite|k[äa]yntiosoite|puhelin|s[äa]hk[öo]posti|avoinna|tiedustelut|lis[äa]tietoja|asiakaspalvelu|asiakaspalvelupiste|kirjaamo|palvelupiste|vaihde)$/i

/* Nimikkeeksi ei kelpaa lause: "Lisätietoja antaa Emmi Mäkelä". */
const VERBI =
  /(?<![A-Za-zÅÄÖåäö])(antaa|antavat|vastaa|vastaavat|toimii|toimivat|on|ovat|hoitaa|hoitavat|laaditaan|laatii|palvelee|palvelevat)(?![A-Za-zÅÄÖåäö])/i

/*
 * Sanallinen rooli siistiin muotoon: "Konsulttina ja kaavan laatijana
 * toimii" -> "kaavan laatija". ISOLLA kirjoitettu nimio ("KAAVOITTAJA")
 * -> "Kaavoittaja".
 */
function siistiRooli(rivi: string): string | null {
  const t = rivi.replace(/:$/, "").trim()
  if (VERBI.test(t)) {
    if (/kaavan\s*laatij/i.test(t)) return "kaavan laatija"
    if (/konsult/i.test(t)) return "konsultti"
    return null
  }
  if (t === t.toUpperCase()) return t.charAt(0) + t.slice(1).toLowerCase()
  return t
}

/*
 * NUMERO SOITETTAVAAN MUOTOON (D-415), tai null jos se ei voi olla oikea.
 *
 *   "358 40 575 61 07" (Ikaalinen) -> "+358 40 575 61 07"
 *   "05067757" (Katinala)          -> null: matkapuhelinnumero (04x,
 *                                     050) on 9-10 numeroa, tama 8.
 *
 * Vaara numero on pahempi kuin puuttuva: asiakas soittaa sen.
 */
function siistiPuhelin(numero: string): string | null {
  const siisti = numero.replace(/\s+/g, " ").trim().replace(/^358(?=[\s\d])/, "+358")
  const numerot = siisti.replace(/\D/g, "").replace(/^358/, "0")
  if (/^(04|050)/.test(numerot) && numerot.length < 9) return null
  return siisti
}

function onPuhelinnumero(t: string): boolean {
  const numeroita = t.replace(/\D/g, "").length
  return PALJAS_NUMERO.test(t) && numeroita >= 7 && numeroita <= 13
}

/*
 * NIMI SOLUSTA (D-413, D-415).
 *
 * Solu jaetaan pilkuista osiin, ja jokainen osa luokitellaan:
 *
 *   "Juha Pöntinen, FCDC Corp Oy"                    henkilo, yritys
 *   "Seija Holmi, tekninen johtaja"                  henkilo, nimike
 *   "Masi Mailammi, FM, johtava konsultti"           henkilo, tutkinto, nimike
 *   "Arkkitehtitoimisto Jarmo Lokio Oy, arkkitehti Jarmo Lokio"
 *                                                    yritys, henkilo nimikkeineen
 *   "Kimmo Mustonen KimmoKaava"                      henkilo, perassa yritys
 *
 * Nimi on osan VIIMEINEN kahden nimisanan pari. Osa jossa on
 * yhtiomuoto tai kunta on yritys, ei henkilo -- muuten "Myrsky Energia
 * Oy" olisi henkilo nimelta "Energia Oy".
 */
function etsiNimi(osa: string): { nimi: string; ennen: string; jalkeen: string } | null {
  if (ORGANISAATIO.test(osa)) return null
  const sanat = osa.split(/\s+/).filter(Boolean)
  if (sanat.length < 2 || sanat.length > 6) return null
  for (let i = sanat.length - 2; i >= 0; i--) {
    if (NIMI_EI.test(sanat[i]) || NIMI_EI.test(sanat[i + 1])) continue
    if (onNimisana(sanat[i]) && onNimisana(sanat[i + 1])) {
      return {
        nimi: `${sanat[i]} ${sanat[i + 1]}`,
        ennen: sanat.slice(0, i).join(" "),
        jalkeen: sanat.slice(i + 2).join(" "),
      }
    }
  }
  return null
}

function nimisolu(solu: string): { name: string; title: string | null; organization: string | null } | null {
  const osat = solu.split(",").map((o) => o.trim()).filter(Boolean)
  let henkilo: { nimi: string; ennen: string; jalkeen: string } | null = null
  const nimikkeet: string[] = []
  let organisaatio: string | null = null

  for (const osa of osat) {
    if (PATEVYYS.test(osa)) continue
    if (!henkilo) {
      const h = etsiNimi(osa)
      if (h) {
        henkilo = h
        if (h.ennen && !VERBI.test(h.ennen)) nimikkeet.push(h.ennen)
        /* "Markku Niemi DI" (Katinala): tutkinto nimen perassa on nimike, ei yritys. */
        if (h.jalkeen && (TUTKINTO.test(h.jalkeen) || NIMIKE_LYHENNE.test(h.jalkeen))) nimikkeet.push(h.jalkeen)
        else if (h.jalkeen) organisaatio ??= h.jalkeen
        continue
      }
    }
    /* "Lisätietoja: tekninen johtaja" (Inari): nimion jalkeen nimike. */
    const ilmanNimiota = osa.replace(/^[^:]{1,30}:\s*/, "")
    if (ilmanNimiota !== osa && siistiNimike(ilmanNimiota)) {
      nimikkeet.push(ilmanNimiota)
      continue
    }
    if (ORGANISAATIO.test(osa)) {
      organisaatio ??= osa
    } else if (/^[a-zåäö]/.test(osa) || TUTKINTO.test(osa)) {
      nimikkeet.push(osa)
    } else if (henkilo) {
      organisaatio ??= osa
    }
  }

  if (!henkilo) return null
  return { name: henkilo.nimi, title: nimikkeet.join(", ") || null, organization: organisaatio }
}

/*
 * TARKKUUSKERROS (D-415).
 *
 * Kahdeksan lahteen mittaus 14.11.2026: noin puolessa poimituista
 * riveista oli roskaa -- lause nimikkeena ("Kaavoituspaallikko,
 * kaavamuutos laaditaan Paraist..."), henkilo organisaationa
 * ("Kaupunkisuunnittelupaallikko Marko Luukkonen"), osoitelohko
 * henkilona ("Kotipaikka Helsinki"). Asiakkaalle nakyvaan kenttaan
 * paasee vain se mika nayttaa nimikkeelta tai organisaatiolta; muu
 * jatetaan tyhjaksi. Tyhja on parempi kuin vaara.
 */
const NIMIKE_VARSI =
  /(insin[öo][öo]ri|arkkitehti|p[äa][äa]llikk[öo]|johtaja|suunnittelija|kaavoittaja|konsultti|asiantuntija|assistentti|teknikko|vastaava|tarkastaja|sihteeri|koordinaattori|kehitt[äa]j[äa]|projekti|neuvos|toimija|laatija|ekologi|maanmittari|lakimies|juristi|dipl\.?\s*ins|\bDI\b|\bFM\b)/i

/* Sana joka PAATTYY nimikkeeseen: "Maankäyttöpäällikkö" (ei "A-Insinöörit"). */
const NIMIKE_PAATE =
  /(insin[öo][öo]ri|arkkitehti|p[äa][äa]llikk[öo]|johtaja|suunnittelija|kaavoittaja|konsultti|asiantuntija|assistentti|teknikko|vastaava|tarkastaja|sihteeri|koordinaattori)$/i

/* Isolla kirjoitetut sanat jotka sallitaan nimikkeen keskella. */
const NIMIKE_LYHENNE = /^(Vt\.?|Vs\.?|vt\.?|vs\.?|DI|FM|SAFA|FISE|AMK|YAMK|KTM|MMM|FT|TkT|TkL|YTM|Dipl\.ins\.?|\(AMK\)|\(YAMK\)|YKS(?:-\d+)?|\d+)$/

function siistiNimike(t: string | null): string | null {
  if (!t) return null
  /* "Lisätietoja: tekninen johtaja" -> palat; nimioton osa jaa pois (D-415). */
  const palat = t
    .split(/[,:]/)
    .map((p) => p.replace(/^(ja|tai|sek[äa])\s+/i, "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((p) => {
      if (p.length > 60 || p.split(" ").length > 6) return false
      if (VERBI.test(p) || /@/.test(p)) return false
      if (/\d/.test(p.replace(/YKS[\s-]?\d+/gi, ""))) return false
      if (!NIMIKE_VARSI.test(p)) return false
      /*
       * Vain ensimmainen VARSINAINEN sana saa alkaa isolla, muut ovat
       * lyhenteita. "Vt. Maankäyttöpäällikkö" (Taraskallio): etuliitteen
       * jalkeinen sana on ensimmainen.
       */
      const sanat = p.split(" ")
      return sanat.every(
        (s, i) => !/^[A-ZÄÖÅ]/.test(s) || NIMIKE_LYHENNE.test(s) || sanat.slice(0, i).every((e) => NIMIKE_LYHENNE.test(e))
      )
    })
  return palat.length ? isoAlku(palat.join(", ")) : null
}

function siistiOrg(o: string | null): string | null {
  if (!o) return null
  let t = o.replace(/-\s+(?=[A-ZÄÖÅ])/g, "-").replace(/\s+/g, " ").trim()

  /* "Toimeksi: kaavoitus" (Inari): nimio pois, jaljelle jaava tarkistetaan. */
  if (t.includes(":")) t = t.slice(t.lastIndexOf(":") + 1).trim()

  /* "Myrsky Energia Oy/ Hankevastaava", "Saarijärven kaupunki / Kaavoitus" */
  if (t.includes("/")) {
    const pala = t.split("/").map((s) => s.trim()).find((s) => ORGANISAATIO.test(s))
    if (pala) t = pala
  }
  /* Roolietuliite pois: "Kaavaa laativa konsultti Sweco Finland Oy" */
  const yhtio = t.match(/((?:[A-ZÄÖÅ0-9][\wÄÖÅäöå&.-]*\s+){0,4}(?:Oy|Oyj|Ab|Ky|Ltd)\b\.?)/)
  if (yhtio) t = yhtio[1].trim()
  t = t.replace(/,.*$/, "").trim()

  if (!t || /^[a-zåäö]/.test(t) || PATEVYYS.test(t) || /@|\d{3,}|\bpuh/i.test(t)) return null
  if (!ORGANISAATIO.test(t)) {
    /* Pelkka nimike ("Kaavoitusassistentti") tai henkilo nimikkeineen. */
    if (NIMIKE_VARSI.test(t) && /^[A-ZÄÖÅ][a-zäöå]+$/.test(t)) return null
    if (etsiNimi(t) && NIMIKE_VARSI.test(t)) return null
    /*
     * ILMAN YHTIOMUOTOA ORGANISAATION ON NAYTETTAVA NIMELTA (D-415).
     * Taraskallion taulukosta tuli "Vt. Maankäyttöpäällikkö" ja
     * "Seurantaryhmän koordinointi": viimeinen sana pienella tai
     * nimikkeen paate. "Metsähallitus", "KimmoKaava", "A-Insinöörit"
     * kelpaavat.
     */
    const viimeinen = t.split(" ").pop() ?? ""
    if (/^[a-zåäö]/.test(viimeinen)) return null
    if (NIMIKE_PAATE.test(viimeinen)) return null
  }
  return t
}

/* Sahkoposti henkilolle nimen perusteella: "emmi.makela@" <-> "Emmi Mäkelä". */
function normalisoi(s: string): string {
  return s.toLowerCase().replace(/[äå]/g, "a").replace(/ö/g, "o").replace(/[^a-z.-]/g, "")
}
function onHenkiloOsoite(email: string): boolean {
  return /^[a-zåäö-]+[._][a-zåäö.-]+$/i.test(email.split("@")[0])
}
function sopiiNimeen(email: string, nimi: string): boolean {
  const paikallinen = normalisoi(email.split("@")[0].replace(/_/g, "."))
  const [etu, suku] = nimi.split(" ").map(normalisoi)
  if (!etu || !suku) return false
  return paikallinen === `${etu}.${suku}` || (paikallinen.startsWith(etu.split("-")[0]) && paikallinen.endsWith(suku))
}

/* Valilyonneilla kirjoitettu osoite: "Matti.piispanen @ saarijarvi.fi" (Saarijarvi). */
function korjaaOsoitteet(t: string): string {
  return t.replace(/([\w.-])\s+@\s+([\w-]+\.)/g, "$1@$2")
}

function luvunRivit(teksti: string): string[] {
  const rivit = teksti.split("\n")
  /* Viimeinen osuma: sisallysluettelo on alussa, luku itse lopussa. */
  let alku = -1
  rivit.forEach((r, i) => {
    if (OTSIKKO.test(r)) alku = i
  })
  if (alku < 0) return []

  const tulos: string[] = []
  for (const rivi of rivit.slice(alku + 1, alku + 80)) {
    if (SEURAAVA_LUKU.test(rivi)) break
    tulos.push(korjaaOsoitteet(rivi))
  }
  return tulos
}

/*
 * PROOSATILA (D-415).
 *
 * Kittilassa yhteystiedot ovat virkkeena, ja rivi katkeaa sanan
 * keskelta: "Kittilän kunta, maanmittausinsinööri Mika Palovaara, puh.
 * 040 7622 917 tekninen johtaja Roni Jän-/kälä, puh. 040 5406 357 ja
 * maanmittausteknikko Veli-Matti Virtanen, puh. ...". Rivipohjainen
 * jasennin antoi Roni Jänkälän numeron Veli-Matti Virtaselle -- pahin
 * mahdollinen virhe, koska asiakas soittaa vaaralle ihmiselle.
 *
 * Proosassa jokainen henkilo PAATTYY numeroonsa, joten teksti jaetaan
 * numeroiden kohdalta (sama periaate kuin D-410:n
 * `parseYhteystietolohko`). Proosaksi tulkitaan luku, jossa rivilla on
 * kaksi numeroa tai numeron jalkeen jatkuu nimike tai nimi.
 */
const PUH_G = /(?<![A-Za-zÅÄÖåäö])(?:p|puh|puhelin|tel|gsm)\.?\s*:?\s*(?:vaihde\s+)?(\+?\d[\d\s\-–]{5,}\d)/gi

function onProosaa(rivit: string[]): boolean {
  /*
   * SOLUITTAIN, ei riveittain: "p. 044 5604 195   p. 044 5604 386"
   * (Huittisten Kallo) on kaksipalstainen taulukko, ei proosaa --
   * palstavali erottaa numerot eri henkiloille.
   */
  return rivit.flatMap(solut).some((r) => {
    const osumat = [...r.matchAll(PUH_G)]
    if (osumat.length >= 2) return true
    const m = osumat[0]
    if (!m) return false
    const perassa = r.slice((m.index ?? 0) + m[0].length)
    return NIMIKE_VARSI.test(perassa) || /[A-ZÄÖÅ][a-zäöå]+ [A-ZÄÖÅ][a-zäöå]+/.test(perassa)
  })
}

function proosa(rivit: string[]): OasYhteystieto[] {
  let teksti = rivit
    .join("\n")
    .replace(/([a-zåäö])-\n([a-zåäö])/g, "$1$2")
    .replace(/\s*\n\s*/g, " ")
  /* Allekirjoitus pois: "Kittilässä, 23.9.2026 Mika Palovaara". */
  const allekirjoitus = teksti.search(/\b[A-ZÄÖÅ][a-zäöå]+(?:ssa|ssä|lla|llä),?\s+\d{1,2}\.\s?\d{1,2}\.\s?\d{4}/)
  if (allekirjoitus > 0) teksti = teksti.slice(0, allekirjoitus)

  const tulos: OasYhteystieto[] = []
  let org: string | null = null
  let edellinenLoppu = 0
  for (const m of teksti.matchAll(PUH_G)) {
    const ennen = teksti.slice(edellinenLoppu, m.index).replace(/^[\s,;.]+|[\s,;]+$/g, "")
    edellinenLoppu = (m.index ?? 0) + m[0].length
    /* Vain viimeinen virke ennen numeroa. */
    const nimi = nimisolu(ennen.split(/(?<=\.)\s+(?=[A-ZÄÖÅ])/).pop() ?? ennen)
    if (!nimi) continue
    if (nimi.organization) org = nimi.organization
    tulos.push({
      name: nimi.name,
      title: nimi.title,
      phone: siistiPuhelin(m[1]),
      email: null,
      organization: nimi.organization ?? org,
    })
  }
  for (const osoite of teksti.match(new RegExp(OSOITE.source, "gi")) ?? []) {
    const h = tulos.find((x) => !x.email && sopiiNimeen(osoite, x.name))
    if (h) h.email = osoite
  }
  return tulos
}

function rakenteiset(rivit: string[]): OasYhteystieto[] {
  const tulos: OasYhteystieto[] = []
  /* Henkilon osoite jota ei voitu liittaa nimeen heti: kaksipalstaiset. */
  const avoimet: string[] = []
  let nykyinen: OasYhteystieto | null = null
  let rooli: string | null = null
  let organisaatio: string | null = null

  /*
   * KAKSIPALSTAINEN RIVI (D-415). Huittisten Kallon OAS:ssa:
   *
   *   Kaavoitusinsinööri Katariina Viiri   Suunnitteluavustaja Anne Rämö
   *   p. 044 5604 195                      p. 044 5604 386
   *
   * Molemmat henkilot syntyvat samalta rivilta, ja ensimmainen numero
   * meni viimeksi luodulle -- Anne Rämö sai Katariina Viirin numeron.
   * Kun rivilta syntyy useampi henkilo, seuraavien rivien numerot
   * jaetaan PALSTOITTAIN: ensimmainen numero ensimmaiselle.
   */
  let palstat: OasYhteystieto[] = []
  let puhelinPalsta = 0

  /*
   * NIMIKERIVI TAULUKOSSA (D-415). Taraskallion FCG-pohja:
   *
   *   Tekninen johtaja    Maankäyttöpäällikkö
   *   Ulla Ojala          Seija Holmi
   *
   * Kun rivin KAIKKI solut ovat nimikkeita, ne talletetaan ja jaetaan
   * palstoittain seuraavan rivin henkiloille -- muuten jalkimmainen
   * tulkittiin organisaatioksi.
   */
  let palstaNimikkeet: (string | null)[] = []

  const asetaPuhelin = (numero: string, vaihde = false) => {
    const kohde = palstat.length >= 2 ? palstat[puhelinPalsta++] ?? null : nykyinen
    if (!kohde || kohde.phone) return
    const siisti = siistiPuhelin(numero)
    if (!siisti) return
    kohde.phone = vaihde ? `${siisti} (vaihde)` : siisti
  }
  /*
   * HENKILON OSOITE NIMEN MUKAAN. "matti.piispanen@" kuuluu Matti
   * Piispaselle, vaikka kaksipalstainen asettelu toisi sen toisen
   * henkilon kohdalle (Saarijarvi). Yrityksen yleinen osoite
   * ("maankayttopesonen@") liitetaan kuten ennenkin nykyiselle.
   */
  const asetaOsoite = (osoitteet: string[]) => {
    for (const o of osoitteet) {
      if (onMalliosoite(o) || YLEISLAATIKKO.test(o)) continue
      const h = nykyinen as OasYhteystieto | null
      if (onHenkiloOsoite(o)) {
        if (h && !h.email && sopiiNimeen(o, h.name)) h.email = o
        else avoimet.push(o)
      } else if (h && !h.email) {
        h.email = o
      }
    }
  }
  const uusiHenkilo = (nimi: { name: string; title: string | null; organization: string | null }) => {
    /*
     * Oma nimike ja edeltavan rivin rooli yhteen:
     * "Arkkitehti" + "Kaavaa laativa asiantuntija".
     */
    const yhdessa = nimi.title && rooli ? `${nimi.title}, ${pieniAlku(rooli)}` : nimi.title ?? rooli
    nykyinen = {
      name: nimi.name,
      /*
       * Suodatus JO TASSA, ei vasta lopussa: Loviisassa roska-rooli
       * "Avoinna" (aukioloajoista) vei nimikepaikan, jolloin oikea
       * nimike nimen alla valui seuraavalle henkilolle.
       */
      title: siistiNimike(yhdessa),
      phone: null,
      email: null,
      organization: nimi.organization ? siistiOrganisaatio(nimi.organization) : organisaatio,
    }
    tulos.push(nykyinen)
  }
  const kaikkiOsoitteet = new RegExp(OSOITE.source, "gi")

  for (const rivi of rivit) {
    const ennenRivia = tulos.length
    puhelinPalsta = 0

    const rivinSolut = solut(rivi)
    if (
      rivinSolut.length >= 2 &&
      rivinSolut.every((x) => !SISAPUHELIN.test(x) && !OSOITE.test(x) && !nimisolu(x) && siistiNimike(x))
    ) {
      palstaNimikkeet = rivinSolut.map((x) => siistiNimike(x))
      continue
    }

    for (let solu of rivinSolut) {
      if (TYHJA_OTSIKKO.test(solu)) continue

      /*
       * PUHELIN JA SAHKOPOSTI IRTI ENSIN. Jaljelle jaavasta katsotaan
       * onko siina uusi henkilo ("Elinvoimajohtaja Sari Niemi
       * puh.040-..."); jos ei, ne kuuluvat nykyiselle ("Puh. 040 704
       * 4508, s.posti: emmi.makela@..."). Kun solussa oli yhteystieto,
       * loppua ei tulkita otsikoksi: "Sähköposti: x@y" ei ole nimio.
       */
      const p = solu.match(SISAPUHELIN)
      if (p) solu = solu.replace(p[0], " ")
      const osoitteet = solu.match(kaikkiOsoitteet) ?? []
      if (osoitteet.length) solu = solu.replace(kaikkiOsoitteet, " ")
      solu = solu.replace(/\s+/g, " ").trim()

      let puhelin: { numero: string; vaihde: boolean } | null = p ? { numero: p[2], vaihde: Boolean(p[1]) } : null
      if (!puhelin && !osoitteet.length && onPuhelinnumero(solu)) {
        puhelin = { numero: solu, vaihde: false }
        solu = ""
      }

      if (puhelin || osoitteet.length) {
        const nimi = solu ? nimisolu(solu) : null
        if (nimi) {
          /* Henkilo ja numero samassa solussa: numero on hanen, ei palstan. */
          palstat = []
          uusiHenkilo(nimi)
        } else if (solu && /^[a-zåäö]/.test(solu)) {
          /* "kaupunkisuunnittelupäällikkö  puh. 0440 555 403" (Loviisa) */
          const h = nykyinen as OasYhteystieto | null
          if (h && !h.title) h.title = siistiNimike(solu)
        }
        if (puhelin) asetaPuhelin(puhelin.numero, puhelin.vaihde)
        asetaOsoite(osoitteet)
        continue
      }
      if (!solu) continue
      if (VERKKOSIVU.test(solu)) continue

      /* Osoiterivin alussa voi olla nimike: "maankäyttöinsinööri Sodankyläntie 1 A". */
      if (KATUOSOITE.test(solu)) {
        const alkuNimike = solu.match(/^([a-zåäö][a-zåäö-]+(?:\s+[a-zåäö][a-zåäö-]+)*)\s+[A-ZÄÖÅ]/)
        /* Sulkeuma muuttaa `nykyinen`-muuttujaa, joten TS:n kaventuminen ei pade: luetaan kopiona. */
        const h = nykyinen as OasYhteystieto | null
        if (h && !h.title && alkuNimike) h.title = isoAlku(alkuNimike[1])
        continue
      }

      /* Otsikko kaksoispisteella. */
      const nimio = solu.match(NIMIO)
      if (nimio) {
        nykyinen = null
        rooli = null
        organisaatio = null
        palstat = []
        if (PELKKA_NIMIO.test(nimio[1].trim())) continue
        if (ORGANISAATIO.test(nimio[1])) organisaatio = siistiOrganisaatio(nimio[1])
        else rooli = siistiRooli(nimio[1])
        continue
      }

      const nimi = nimisolu(solu)
      if (nimi) {
        uusiHenkilo(nimi)
        continue
      }

      /*
       * NIMIKE NIMEN ALLA (Loviisa): "Perttu Huhtiniemi  puh. ..." ->
       * "kaavoitusinsinööri". Pienella alkava nimike heti henkilon
       * jalkeen on HANEN nimikkeensa, ei seuraavan roolirivi -- muuten
       * se siirtyi seuraavalle henkilolle.
       */
      const edellinen = nykyinen as OasYhteystieto | null
      if (edellinen && !edellinen.title && /^[a-zåäö]/.test(solu) && siistiNimike(solu)) {
        edellinen.title = siistiNimike(solu)
        continue
      }

      /*
       * Yritys HENKILON JALKEEN, ennen taman yhteystietoja: henkilon oma
       * (Pelkosenniemi: "Johanna Ilola-Pesonen" -> "Maankäyttö Pesonen Oy"
       * -> puhelin). Henkilo jolla jo on yhteystieto on valmis, joten
       * silloin yritysrivi aloittaa uuden lohkon.
       */
      if (
        ORGANISAATIO.test(solu) &&
        edellinen &&
        !edellinen.phone &&
        !edellinen.email &&
        !edellinen.organization &&
        solu.split(/\s+/).length <= 6
      ) {
        edellinen.organization = siistiOrganisaatio(solu)
        continue
      }

      /*
       * Lyhyt solu ilman nimea on valiotsikko: rooli tai organisaatio.
       * Pitka solu on johdantoa ja ohitetaan.
       *
       * LOHKO = valiotsikot + henkilo. Henkilon jalkeen tuleva valiotsikko
       * aloittaa uuden lohkon, joten edellinen rooli ja organisaatio
       * nollataan -- muuten kaupungin osoite liittyisi seuraavalle.
       *
       * Roolin JALKEEN tuleva toinen valiotsikko on organisaatio, vaikka
       * siina ei olisi yhtiomuotoa: Lintukankaassa "Kaavaa laativa
       * konsultti" -> "A-  Insinöörit" -> henkilo.
       */
      const sanoja = solu.split(/\s+/).length
      if (sanoja <= 6 && !/\d/.test(solu) && !solu.endsWith(":")) {
        if (nykyinen) {
          rooli = null
          organisaatio = null
        }
        nykyinen = null
        palstat = []
        if (ORGANISAATIO.test(solu) || (rooli !== null && organisaatio === null)) {
          organisaatio = siistiOrganisaatio(solu)
        } else {
          rooli = siistiRooli(solu)
          organisaatio = null
        }
      }
    }

    /* Rivi jolta syntyi useampi henkilo: seuraavat numerot palstoittain. */
    const rivinHenkilot = tulos.slice(ennenRivia)
    if (palstaNimikkeet.length && palstaNimikkeet.length === rivinHenkilot.length) {
      rivinHenkilot.forEach((h, i) => {
        if (palstaNimikkeet[i]) h.title = palstaNimikkeet[i]
      })
    } else if (rivinHenkilot.length >= 2 && rooli) {
      /*
       * Saman rivin henkilot ilman palstanimikkeita: roolista peritty
       * nimike ei voi koskea kaikkia palstoja. Taraskalliossa Juha
       * Mustanoja (vt. maankayttopaallikko) sai Seija Holmin nimikkeen
       * "Tekninen johtaja". Tyhja on parempi kuin vaara.
       */
      const roolista = siistiNimike(rooli)
      for (const h of rivinHenkilot) if (h.title === roolista) h.title = null
    }
    if (rivinSolut.length) palstaNimikkeet = []
    if (rivinHenkilot.length >= 2) palstat = rivinHenkilot
    else if (rivinHenkilot.length === 1) palstat = []
  }

  /* Nimeen sopivat osoitteet joita ei voitu liittaa heti. */
  for (const o of avoimet) {
    const h = tulos.find((x) => !x.email && sopiiNimeen(o, x.name))
    if (h) h.email = o
  }
  return tulos
}

export function oasYhteystiedot(teksti: string | null | undefined): OasYhteystieto[] {
  const rivit = luvunRivit(String(teksti ?? ""))
  if (!rivit.length) return []

  let tulos = rakenteiset(rivit)
  if (onProosaa(rivit)) {
    const p = proosa(rivit)
    if (p.length) tulos = p
  }

  /*
   * KUNTA EI OLE KONSULTIN ORGANISAATIO (D-415). Lohkon otsikko
   * "Loviisan kaupunki" periytyi Heta Tuunaselle, vaikka hanen
   * osoitteensa on @alustaconsulting.fi. Kun organisaatio on kunta ja
   * sahkoposti toisen talon, organisaatio jatetaan tyhjaksi.
   */
  const kunnanVarsi = (org: string | null): string | null => {
    const m = String(org ?? "").match(/^([A-ZÄÖÅ][a-zäöå]+)\s+(kaupunki|kunta)$/i)
    return m ? normalisoi(m[1]).slice(0, 5) : null
  }

  /* Tarkkuuskerros kaikille: ks. siistiNimike, siistiOrg. */
  const nahty = new Set<string>()
  return tulos
    .map((h) => {
      let organization = siistiOrg(h.organization)
      const varsi = kunnanVarsi(organization)
      if (varsi && h.email && !normalisoi(h.email.split("@")[1] ?? "").includes(varsi)) organization = null
      return { ...h, title: siistiNimike(h.title), organization }
    })
    /* Ilman puhelinta ja sahkopostia nimi ei ole yhteystieto. */
    .filter((h) => h.phone || h.email)
    .filter((h) => {
      const k = h.name.toLowerCase()
      if (nahty.has(k)) return false
      nahty.add(k)
      return true
    })
}

/*
 * YRITYKSET ROOLEINEEN YHTEYSTIEDOISTA (D-414).
 *
 * Johannes 14.11.2026: *"liittyvat yritykset pitaisi viela poimia esim
 * fcdc ja noar."* OAS kertoo roolin sanatarkasti, joten yritys menee
 * ROOLISARAKKEESEEN eika "Liittyva yritys" -listaan
 * ([[party-role-fields]]):
 *
 *   "Hanketoimija" / "Hankkeesta vastaava"  -> developer (Rakennuttaja)
 *   kaavakonsultti, YVA-konsultti            -> related_companies
 *
 * Kaavakonsultille ei ole roolisaraketta: kaavan laatija ei ole
 * rakennuksen arkkitehtisuunnittelija, joten `architectural_design`
 * olisi vaara. Rooli nakyy yhteyshenkilon nimikkeessa.
 *
 * Kunta ja kaupunki eivat ole yrityksia vaan viranomainen.
 */
/*
 * Sanasto: Huittinen ("Hanketoimija"), Lintukangas ja Niinimaki
 * ("Hankkeesta vastaava") seka 40 OAS:n otos 14.11.2026: Ahtari
 * ("Hankevastaava", Energiequelle Oy), Hameenkyro
 * ("Hankekehityspaallikko", Ilmatar Energy Oy).
 */
const KEHITTAJA =
  /hanketoimija|hankkeesta\s+vastaava|hankevastaava|hankekehit|hankkeen\s+(?:toteuttaja|vastuutaho|kehitt[äa]j[äa])|rakennuttaja|toiminnanharjoittaja|hakija/i
const VIRANOMAINEN = /(kaupunki|kunta|kuntayhtym[äa]|ely-keskus|maakuntaliitto|virasto)\b/i

export function osapuoletYhteystiedoista(yhteystiedot: OasYhteystieto[]): {
  developer: string | null
  related: string[]
} {
  let developer: string | null = null
  const related: string[] = []

  for (const h of yhteystiedot) {
    const org = String(h.organization ?? "").trim()
    if (!org || VIRANOMAINEN.test(org)) continue

    if (!developer && KEHITTAJA.test(h.title ?? "")) {
      developer = org
      continue
    }
    if (org !== developer && !related.includes(org)) related.push(org)
  }

  return { developer, related: related.filter((r) => r !== developer) }
}
