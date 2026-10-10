import { getMunicipalityByAnyForm } from "@/lib/geo/municipalityFromName"

/*
 * OSAPUOLI HANKKEEN OMASTA TEKSTISTA (D-233).
 *
 * Johannes 3.10.2026 osapuolettomien jonosta: *"se ei ole osapuoleton
 * koska NCC tiedetaan"* — hankkeen kuvauksessa luki "NCC kaynnistaa
 * hoivakodin rakennustyot Turussa", mutta molemmat osapuolikentat olivat
 * tyhjia. Mitattu: 49 hanketta 177:sta on tassa tilassa.
 *
 * NIMEA EI ARVATA, SE TUNNISTETAAN. Haettavat nimet annetaan ulkoa ja ne
 * ovat kannassa jo osapuolena olevia yrityksia. Tekstista ei siis
 * poimita uusia yrityksia — vain tunnistetaan jo tunnettu nimi siita
 * tekstista jossa se lukee.
 *
 * ROOLI JATETAAN AUKI JOS TEKSTI EI SITA KERRO. "X rakentaa" ei erota
 * urakoitsijaa rakennuttajasta: omaperusteisessa tuotannossa tekija
 * rakentaa itselleen (D-214). Silloin palautetaan nimi ilman roolia ja
 * ihminen paattaa. Vaara rooli on asiakkaalle pahempi kuin tyhja kentta.
 */

export type OsapuoliLoydos = {
  nimi: string
  /* null = teksti nimeaa yrityksen mutta ei kerro roolia. */
  rooli: "developer" | "builder" | null
  /* Lause josta loydos tehtiin — ilman todistetta ei hyvaksyta mitaan. */
  lause: string
}

const KIRJAIN = /[0-9a-zA-ZåäöÅÄÖ]/

/*
 * Yleissanoja jotka ovat paatyneet osapuolikenttiin. Mitattu 3.10.2026:
 * kannassa on osapuolina mm. "Muu", "Kiinteisto" ja "Aurinko", ja ne
 * osuvat lahes mihin tahansa tekstiin.
 */
const ROSKANIMET = new Set([
  "muu",
  "muut",
  "kiinteistö",
  "kiinteisto",
  "aurinko",
  "asunto",
  "rakennus",
  "kaupunki",
  "kunta",
  "group",
  "yksityinen",
  "tuntematon",
  /* Maan nimi paatyi kenttaan osana nimea ("wpd Suomi Oy"). */
  "suomi",
  "finland",
])

export function kelpaakoNimi(nimi: string): boolean {
  const puhdas = nimi.trim()
  if (puhdas.length < 3) return false
  if (ROSKANIMET.has(puhdas.toLowerCase())) return false

  /*
   * Yksisanainen kunnan nimi tai sen genetiivi ei ole yritys:
   * "Helsingin" osuu otsikkoon "Asunto Oy Helsingin Jakomaentie 12".
   * Monisanainen "Helsingin kaupunki" sen sijaan on aito rakennuttaja,
   * joten rajaus koskee vain yksittaista sanaa.
   */
  if (!puhdas.includes(" ") && getMunicipalityByAnyForm(puhdas)) return false

  return true
}

/*
 * SALLITUT TAIVUTUSPAATTEET.
 *
 * Nimen peraan saa jaada sijapaate ("Firalle", "Skanskan", "NCC:lle"),
 * mutta ei mielivaltaista kirjainjonoa: ilman tata rajausta "Are" osui
 * sanaan "Areena" — mitattu testissa. Lista on tahallaan suppea, koska
 * vaara yritysnimi on asiakkaalle pahempi kuin puuttuva.
 */
const PAATTEET = new Set([
  "",
  "n", "en", "in", "on", "un", "an", "än",
  "a", "ä", "na", "nä", "ta", "tä",
  "ksi", "kse",
  "lle", "lla", "llä", "lta", "ltä", "lle",
  "ssa", "ssä", "sta", "stä",
  "hin", "seen", "iin",
  "t", "ja", "jä", "jen", "ien",
])

function kohdat(teksti: string, nimi: string): number[] {
  const t = teksti.toLowerCase()
  const n = nimi.toLowerCase()
  const osumat: number[] = []

  let i = t.indexOf(n)
  while (i !== -1) {
    const ennen = i === 0 ? "" : t[i - 1]
    const esiintyma = teksti.slice(i, i + nimi.length)

    /* Edessa ei saa olla kirjainta eika numeroa lainkaan. */
    if (!KIRJAIN.test(ennen)) {
      const loppu = t.slice(i + n.length)
      /* Kaksoispiste katkaisee sanan: "NCC:lle" on osuma. */
      const paate = loppu.startsWith(":") ? "" : (loppu.match(/^[a-zåäö]*/i)?.[0] ?? "")

      /*
       * ESIINTYMAN ON NOUDATETTAVA NIMEN KIRJAINKOKOA. Ilman tata "Varte"
       * osui sanaan "varten" ja "Are" sanaan "areena" — molemmat mitattu
       * kuivaharjoituksessa 3.10.2026. Pelkka sananraja ei riita, koska
       * suomen sijapaatteet ovat samoja kirjaimia kuin sanojen jatkot.
       *
       * Ehto on nimen kirjainkoko, EI "iso alkukirjain": jalkimmainen
       * hylkasi "wpd Suomi Oy":n, jolloin tilalle jai pelkka "Suomi"
       * (mitattu 4.10.2026). Pienella kirjoitettu yritysnimi on itsessaan
       * sen verran omaleimainen ettei se osu yleissanaan.
       */
      const nimiIsolla = nimi.slice(0, 1) === nimi.slice(0, 1).toUpperCase()
      const esiintymaIsolla = esiintyma.slice(0, 1) === esiintyma.slice(0, 1).toUpperCase()
      const alkaaIsolla = nimiIsolla ? esiintymaIsolla : true

      /*
       * Lyhenne vaatii oman kirjainkokonsa: "ARE" ja "NCC" kirjoitetaan
       * tekstissa versaalilla, eika "Are" saa osua sanaan "are".
       */
      const lyhenneOk =
        nimi.length > 4 || esiintyma === nimi || esiintyma === esiintyma.toUpperCase()

      if (PAATTEET.has(paate.toLowerCase()) && alkaaIsolla && lyhenneOk) osumat.push(i)
    }
    i = t.indexOf(n, i + 1)
  }
  return osumat
}

function lauseKohdasta(teksti: string, kohta: number): string {
  const alku = Math.max(
    teksti.lastIndexOf(".", kohta) + 1,
    teksti.lastIndexOf("!", kohta) + 1,
    teksti.lastIndexOf("?", kohta) + 1,
    0
  )
  const loppuKandidaatit = [teksti.indexOf(".", kohta), teksti.indexOf("!", kohta), teksti.indexOf("?", kohta)]
    .filter((n) => n !== -1)
  const loppu = loppuKandidaatit.length ? Math.min(...loppuKandidaatit) + 1 : teksti.length
  return teksti.slice(alku, loppu).trim()
}

/*
 * ROOLIN KERTOVAT SANAT.
 *
 * Urakoitsija: urakan voi vastaanottaa vain urakoitsijana, ja
 * "urakoitsijana X" sanoo sen suoraan. Rakennuttaja: teettaminen ja
 * tilaaminen ovat rakennuttajan tekoja, samoin kaavan hankevastaavuus.
 *
 * Pelkka "rakentaa" EI ole kummassakaan listassa. Se on juuri se sana
 * joka ei erota rooleja.
 */
/*
 * ROOLIVIHJEET ON LAAJENNETTU MITATUSTA TEKSTISTA (D-257).
 *
 * Attendon tiedote Oulun hoivakodista: *"Hankkeen kehittajana ja
 * omistajana toimii Plus Hoivakodit Oy ja urakoinnista vastaa Pajala
 * Pohjois-Suomi Oy."* Molemmat roolit lukevat lauseessa selvasti, mutta
 * kumpikaan vihje ei ollut listassa: vanhat hahmot odottivat sanaa
 * "urakoitsijana" tai "rakennuttajana" nimen vieressa, eivat verbia
 * ("vastaa", "toimii").
 *
 * Vaara rooli on asiakkaalle pahempi kuin tyhja, joten vihjeet ovat
 * yha tasmallisia sanontoja eivatka yleisia verbeja.
 */
const URAKOITSIJA_ENNEN = /\b(urakoitsija(?:na|ksi)?|paaurakoitsija(?:na|ksi)?|pääurakoitsija(?:na|ksi)?|urakoi|urakoinnista\s+vastaa|urakasta\s+vastaa|urakan\s+toteuttaa)\s*:?\s*$/i
const URAKOITSIJA_JALKEEN = /^\s*(?:on\s+)?(?:valittu\s+)?(?:sai|saa|voitti|urakoi|toteuttaa\s+urakan)\b/i
const RAKENNUTTAJA_ENNEN = /\b(rakennuttaja(?:na|ksi)?|tilaaja(?:na|ksi)?|hankevastaava(?:na)?|hankkeesta\s+vastaa|omistajana\s+toimii|kehittäjänä\s+toimii|rakennuttajana\s+toimii)\s*:?\s*$/i
const RAKENNUTTAJA_JALKEEN = /^\s*(?:on\s+)?(?:rakennuttaa|teettaa|teettää|tilaa|vuokraa|investoi)\b/i

function rooliKohdasta(teksti: string, kohta: number, nimi: string): "developer" | "builder" | null {
  /* Ikkuna 60 merkkia: "kehittajana ja omistajana toimii " ei mahdu 40:aan. */
  const ennen = teksti.slice(Math.max(0, kohta - 60), kohta)
  const jalkeen = teksti.slice(kohta + nimi.length, kohta + nimi.length + 40)

  if (URAKOITSIJA_ENNEN.test(ennen) || URAKOITSIJA_JALKEEN.test(jalkeen)) return "builder"
  if (RAKENNUTTAJA_ENNEN.test(ennen) || RAKENNUTTAJA_JALKEEN.test(jalkeen)) return "developer"
  return null
}

/*
 * Palauttaa korkeintaan yhden loydoksen per nimi, ja roolillinen loydos
 * voittaa roolittoman: sama yritys voi esiintya tekstissa useasti ja vain
 * yhdessa kohdassa rooli lukee.
 */
/*
 * LAUSEEN ON KERROTTAVA TEKEMISESTA, EI VAIN SISALTAA NIMEA.
 *
 * Ensimmainen versio luki vain tekstin 700 ensimmaista merkkia, koska
 * kaavinnan loppuosassa on valikkoja ja naapuriartikkeleita (Sonkajarven
 * tuulivoimakaavasta poimiutui "Sonkakoti Oy" kunnan navigaatiovalikosta).
 *
 * SE RAJAUS OLI VAARA. Johannes 4.10.2026 Harmalanojan sillasta:
 * osapuolet luetellaan vasta 1 500 merkin kohdalla — *"Allianssin
 * muodostavat Tampereen Raitiotie oy, Tampereen kaupunki, Pirkkalan
 * kunta, Afry Finland, Sweco Finland, NRC Group Finland ja YIT Infra"* —
 * eli juuri se lause jonka vuoksi koko poimija on olemassa jai rajauksen
 * taakse. Sijainti ei erota valikkoa osapuolilauseesta.
 *
 * Erottava tekija on lause itse: osapuolesta kerrotaan aina jotain
 * tekemista ("rakentaa", "suunnittelee", "allianssin muodostavat"),
 * valikossa on vain substantiiveja. Teksti luetaan siksi kokonaan ja
 * lause vaaditaan asialliseksi.
 */
/*
 * VALIKKO EI OLE LAUSE.
 *
 * Kunnan sivun navigaatio paatyy kaavinnassa yhdeksi pitkaksi jaksoksi
 * ilman valimerkkeja, ja koska valikossa lukee "Rakentaminen" ja
 * "Kaavoitus", se lapaisee asialause-ehdon. Pituus erottaa sen:
 * Sonkajarven valikko oli yli 600 merkkia, kun taas se lause jonka
 * vuoksi poimija on olemassa — "Allianssin muodostavat Tampereen
 * Raitiotie oy, ..." — on 140.
 */
const PISIN_LAUSE = 350

const ASIALAUSE =
  /rakent|rakenn|urak|suunnittel|toteut|saneera|peruskorja|laajen|korjau|purku|purkaa|allians|konsorti|tilaa|vastaa|kehitt|investoi|vuokraa|hake|myonn|myönn|valit|sopimu|kaavoit|kilpailut|aloitt|kaynnist|käynnist/i

export function osapuoletTekstista(
  teksti: string | null | undefined,
  tunnetutNimet: string[]
): OsapuoliLoydos[] {
  const puhdas = String(teksti ?? "")
    .replace(/\s+/g, " ")
    .trim()
  if (!puhdas) return []

  const loydokset = new Map<string, OsapuoliLoydos>()

  for (const nimi of tunnetutNimet) {
    if (!kelpaakoNimi(nimi)) continue

    for (const kohta of kohdat(puhdas, nimi)) {
      const lause = lauseKohdasta(puhdas, kohta)
      if (lause.length > PISIN_LAUSE) continue
      if (!ASIALAUSE.test(lause)) continue

      const rooli = rooliKohdasta(puhdas, kohta, nimi)
      const edellinen = loydokset.get(nimi.toLowerCase())
      if (edellinen && (edellinen.rooli || !rooli)) continue
      loydokset.set(nimi.toLowerCase(), { nimi, rooli, lause })
    }
  }

  /*
   * Pisin nimi voittaa paallekkaiset: "Jatke Uusimaa Oy" ja "Jatke" ovat
   * sama yritys, eika asiakkaalle nayteta kahta riviä.
   */
  const kaikki = [...loydokset.values()].sort((a, b) => b.nimi.length - a.nimi.length)
  const valitut: OsapuoliLoydos[] = []
  for (const l of kaikki) {
    const sisaltyy = valitut.some((v) => v.nimi.toLowerCase().includes(l.nimi.toLowerCase()))
    if (!sisaltyy) valitut.push(l)
  }

  return valitut
}
