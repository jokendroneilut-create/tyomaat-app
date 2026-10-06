/*
 * HELSINGIN PAATOKSEN YHTEYSHENKILO (D-240).
 *
 * Johannes 6.10.2026: *"nyt meidan pitaa alkaa tutkimaan ja lisaamaan
 * noita yhteystietoja ... se on suurin syy miksi nykyiset trialit eivat
 * jaa maksaviksi asiakkaiksi."*
 *
 * MITATTU: helsinki_paatokset on kannan suurin yksittainen puute —
 * 500 hanketta 505:sta ilman yhteyshenkiloa. Ainoa talletettu kontakti
 * oli `helsinki.kirjaamo@hel.fi`, nimeton postilaatikko.
 *
 * 20 SIVUN OTOS: **jokaisella** oli henkilon nimi, nimike, puhelin ja
 * sahkoposti. Rakenne on vakio:
 *
 *   Paattaja Nimi Rikhard Manninen Titteli Maankayttojohtaja
 *   Lisatietojen antaja Nimi Katariina Verkamo Titteli Projektinjohtaja
 *   Puhelinnumero 09 310 20706(Linkki aloittaa puhelun)
 *   Sahkoposti katariina.verkamo@hel.fi(Linkki avaa oletussahkopostin)
 *
 * VAIN "LISATIETOJEN ANTAJA", EI PAATTAJA. Paattaja on maankaytto- tai
 * toimialajohtaja joka hyvaksyy suunnitelman; lisatietojen antaja on
 * projektipaallikko joka hanketta tekee. Jalkimmainen on se jolle
 * urakoitsija soittaa. Paattaja ei ole tassa mielessa viranomainen
 * jota vastaan hanke tehdaan (kaupunki on itse rakennuttaja), mutta han
 * ei myoskaan tieda hankkeen yksityiskohtia — ja yksi oikea nimi on
 * parempi kuin kaksi joista toinen on vaara.
 *
 * Rajapinnassa tata ei ole: hakuindeksissa on 29 kenttaa eika yhtaan
 * yhteystietoa (tarkistettu 6.10.2026). Tieto on vain sivulla.
 */

export type PaatoksenYhteyshenkilo = {
  nimi: string
  nimike: string | null
  puhelin: string | null
  sahkoposti: string | null
}

/*
 * KAKSI KIELTA, SAMA RAKENNE.
 *
 * Ruotsinkielinen paatossivu kayttaa tasmalleen samaa jasennysta mutta
 * ruotsalaisin otsikoin. Kuivaharjoitus 6.10.2026: 25 sivusta 3 jai
 * ilman, ja kaksi niista oli ruotsinkielisia ("Projektplan för
 * nybyggnaden för daghemmet Pelimanni och Tiuku"). Kieli ei ole
 * poikkeus vaan toinen tavallinen tapaus — Helsinki on kaksikielinen.
 */
type Otsikot = {
  osio: string
  nimi: string
  nimike: string
  puhelin: string
  sahkoposti: string
}

const SUOMI: Otsikot = {
  osio: "Lisätietojen antaja",
  nimi: "Nimi",
  nimike: "Titteli",
  puhelin: "Puhelinnumero",
  sahkoposti: "Sähköposti",
}

const RUOTSI: Otsikot = {
  osio: "Mer information",
  nimi: "Namn",
  nimike: "Titel",
  puhelin: "Telefonnummer",
  sahkoposti: "E-post",
}

const KIELET = [SUOMI, RUOTSI]

/* Kentan arvo: otsikon jalkeen seuraavaan tunnettuun otsikkoon asti. */
const OTSIKOT = [
  ...KIELET.flatMap((k) => [k.nimi, k.nimike, k.puhelin, k.sahkoposti, k.osio]),
  "Päättäjä",
  "Esittelijä",
  "Beslutsfattare",
  "Föredragande",
  "Ladda ner",
  "Lataa",
]

function kentta(lohko: string, otsikko: string): string | null {
  const i = lohko.indexOf(otsikko)
  if (i < 0) return null

  let arvo = lohko.slice(i + otsikko.length)
  let loppu = arvo.length
  for (const muu of OTSIKOT) {
    const j = arvo.indexOf(muu)
    if (j > 0 && j < loppu) loppu = j
  }
  arvo = arvo.slice(0, loppu)

  /*
   * Sivun linkkiteksti tarttuu arvoon kiinni ilman valilyontia:
   * "09 310 20706(Linkki aloittaa puhelun)". Sulkeet ja niiden sisalto
   * pois.
   */
  const sulku = arvo.indexOf("(")
  if (sulku >= 0) arvo = arvo.slice(0, sulku)

  const siisti = arvo.split(/\s+/g).join(" ").trim()
  return siisti || null
}

export function helsinginYhteyshenkilot(sivunTeksti: string | null | undefined): PaatoksenYhteyshenkilo[] {
  const teksti = String(sivunTeksti ?? "")
  if (!teksti) return []

  const loydot: PaatoksenYhteyshenkilo[] = []
  const nahdyt = new Set<string>()

  for (const kieli of KIELET) {
    let alku = teksti.indexOf(kieli.osio)
    while (alku >= 0) {
      const seuraava = teksti.indexOf(kieli.osio, alku + kieli.osio.length)
      const lohko = teksti.slice(alku + kieli.osio.length, seuraava < 0 ? alku + 400 : seuraava)
      alku = seuraava

      const nimi = kentta(lohko, kieli.nimi)
      if (!nimi || nimi.length < 4) continue

      const avain = nimi.toLowerCase()
      if (nahdyt.has(avain)) continue
      nahdyt.add(avain)

      loydot.push({
        nimi,
        nimike: kentta(lohko, kieli.nimike),
        puhelin: kentta(lohko, kieli.puhelin),
        sahkoposti: kentta(lohko, kieli.sahkoposti),
      })
    }
  }

  return loydot
}
