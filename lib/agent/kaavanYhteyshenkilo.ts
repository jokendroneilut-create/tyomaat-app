/*
 * KAAVAN VALMISTELIJA SELOSTUKSESTA (D-230).
 *
 * Johannes 3.10.2026 Lieksan Brahean korttelin 2027 kaavasta:
 * *"myos yhteyshenkilo puuttuu ja se pitaisi olla."*
 *
 * MITATTU: yhteystietoa EI OLE sivulla eika kaavoitussivulla — ei
 * sahkopostia, ei nimea. Ainoa lahde on selostuksen oma teksti:
 *
 *   "Kaavanlaatija Lieksan kaupunki / kaupunkiymparistot palvelualue /
 *    maankayton suunnittelija Reino Hirvonen
 *    Kaava-asiakirjat
 *    Kaavasuunnittelija Maria Hyvarinen"
 *
 * NIMI POIMITAAN VAIN NIMIKKEEN PERASTA. Pelkka "kaksi isoa
 * alkukirjainta" osuisi paikannimiin ja organisaatioihin ("Lieksan
 * kaupunki", "Pohjois-Karjalan maakuntaliitto"). Nimike on se mika
 * tekee loydosta yhteyshenkilon, joten ilman sita ei poimita mitaan.
 *
 * EI ARVAUKSIA. Jos nimiketta ei ole, palautetaan tyhja lista — tyhja
 * yhteystieto on parempi kuin vaara, ja sama saanto koskee kaikkea
 * poimintaa.
 */

export type KaavanYhteyshenkilo = {
  nimi: string
  /* Nimike sellaisena kuin se tekstissa lukee. */
  rooli: string
  /* Vain kun ne ovat nimen vieressa, ks. YHTEYSTIETO-ikkuna alla. */
  puhelin?: string | null
  sahkoposti?: string | null
}

/*
 * Kaavoituksen nimikkeet. Jarjestys merkitsee: pidempi ennen lyhyempaa,
 * jotta "maankayton suunnittelija" ei katkea sanaan "suunnittelija".
 */
const NIMIKKEET = [
  "maankäytön suunnittelija",
  "maankäyttöpäällikkö",
  "kaavoituspäällikkö",
  "kaavoitusarkkitehti",
  "kaava-arkkitehti",
  "asemakaava-arkkitehti",
  "yleiskaavasuunnittelija",
  "asemakaavasuunnittelija",
  "kaavasuunnittelija",
  "suunnitteluarkkitehti",
  "kaavoitusinsinööri",
  "kaavoittaja",
  "kaavanlaatija",
]

/*
 * Suomalainen etu- ja sukunimi. Yhdysnimi ("Aki-Lassi") ja kahden sanan
 * sukunimi ("von Bell") eivat ole tassa mukana: ne ovat harvinaisempia
 * kuin vaarat osumat joita vapaampi kuvio toisi.
 */
const NIMI = "[A-ZÅÄÖ][a-zåäö]+(?:-[A-ZÅÄÖ][a-zåäö]+)?"
const NIMIPARI = new RegExp(`^\\s*[:,-]?\\s*(${NIMI}\\s+${NIMI})\\b`)

/* Sanat jotka nayttavat nimelta mutta eivat ole. */
const EI_NIMI = /^(Lieksan|Kaupungin|Kaupunki|Kunnan|Kunta|Pohjois|Etelä|Länsi|Itä|Suomen)\b/

/*
 * PUHELIN JA SAHKOPOSTI, KUN NE OVAT NIMEN VIERESSA (D-362).
 *
 * Alkuperainen muistiinpano sanoi ettei niita ole selostuksessa. Se
 * piti paikkansa Lieksassa, muttei yleisesti: Ulvilan selostuksen
 * kansilehdella lukee *"Asiaa hoitaa: Kaavoitusarkkitehti Mikko
 * Toivanen puh. 0400 134 777 mikko.toivanen@ulvila.fi"*. Premissi oli
 * siis kirjattu faktana ([[check-before-calling-it-intended]]).
 *
 * Kaksi rajausta, jotta toisen ihmisen numero ei tartu nimeen:
 *
 * 1. IKKUNA. Vain 120 merkkia nimen jalkeen. Selostuksessa on muitakin
 *    numeroita (kaupungin vaihde, ELY-keskus), ja ne ovat kauempana.
 * 2. SAHKOPOSTIN ON VASTATTAVA NIMEA. Yhteinen laatikko
 *    (`kaupunkikehitys@`, `kirjaamo@`) EI ole taman henkilon osoite,
 *    eika sita saa kirjata hanen nimiinsa. Vaaditaan etu- tai
 *    sukunimi osoitteen paikallisosassa.
 *
 * Puhelin vaatii `puh.`/`p.`-merkinnan: paljas numerosarja voi olla
 * kaavatunnus, diaarinumero tai kiinteistotunnus.
 */
const YHTEYSTIETO_IKKUNA = 120
const PUHELIN = /\b(?:puh\.?|p\.|puhelin)\s*:?\s*((?:\+358|0)[\d\s-]{6,16}\d)/i
const SAHKOPOSTI = /([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/

const skandit = (s: string) =>
  s.toLowerCase().replace(/å/g, "a").replace(/ä/g, "a").replace(/ö/g, "o")

export function yhteystiedotNimenVierelta(
  jatko: string,
  nimi: string
): { puhelin: string | null; sahkoposti: string | null } {
  const ikkuna = jatko.slice(0, YHTEYSTIETO_IKKUNA)

  const puh = ikkuna.match(PUHELIN)?.[1]?.replace(/\s+/g, " ").trim() ?? null

  const posti = ikkuna.match(SAHKOPOSTI)
  let sahkoposti: string | null = null
  if (posti) {
    const paikallinen = skandit(posti[1])
    const osat = skandit(nimi).split(/\s+/).filter((o) => o.length >= 3)
    if (osat.some((o) => paikallinen.includes(o))) sahkoposti = `${posti[1]}@${posti[2]}`
  }

  return { puhelin: puh, sahkoposti }
}

export function kaavanYhteyshenkilot(teksti: string | null | undefined): KaavanYhteyshenkilo[] {
  const puhdas = String(teksti ?? "").replace(/\s+/g, " ")
  if (!puhdas) return []

  const loydot: KaavanYhteyshenkilo[] = []
  const nahdyt = new Set<string>()

  for (const nimike of NIMIKKEET) {
    const kuvio = new RegExp(nimike.replace(/[-]/g, "\\-"), "gi")
    let osuma: RegExpExecArray | null

    while ((osuma = kuvio.exec(puhdas))) {
      const jatko = puhdas.slice(osuma.index + osuma[0].length)
      const nimi = jatko.match(NIMIPARI)?.[1]
      if (!nimi) continue
      if (EI_NIMI.test(nimi)) continue

      const avain = nimi.toLowerCase()
      if (nahdyt.has(avain)) continue
      nahdyt.add(avain)

      const { puhelin, sahkoposti } = yhteystiedotNimenVierelta(
        jatko.slice(jatko.indexOf(nimi) + nimi.length),
        nimi
      )

      loydot.push({
        nimi,
        rooli: puhdas.slice(osuma.index, osuma.index + osuma[0].length),
        puhelin,
        sahkoposti,
      })
    }
  }

  return loydot
}
