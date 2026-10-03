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

      loydot.push({ nimi, rooli: puhdas.slice(osuma.index, osuma.index + osuma[0].length) })
    }
  }

  return loydot
}
