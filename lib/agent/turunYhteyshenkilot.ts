/*
 * YHTEYSHENKILOT TURUN KAAVAN TUNNISTETIEDOISTA (D-336).
 *
 * MIKSI. Johannes 23.10.2026 Kaharin puistotien rivista: *"kuvaus ja
 * yhteyshenkiloita ei ole poimittu."*
 *
 * Tunnistetietolaatikko (`.map-information__item`) antaa roolin, nimen
 * ja sahkopostin erillisina kenttina sivun jarjestyksessa:
 *
 *   Diaarinumero:                      2019-2019
 *   Kaavatunnus:                       4/2019
 *   Hyvaksyva taho:                    Valtuusto
 *   Vastuuhenkilo:                     Christiane Eskolin
 *   Vastuuhenkilon sahkoposti:         christiane.eskolin@turku.fi
 *   Piirtaja:                          Karin Kekkonen
 *   Piirtajan sahkoposti:              karin.kekkonen@turku.fi
 *
 * Ennen nama liitettiin KUVAUSTEKSTIIN "Label: Value" -riveina, ja
 * yleinen tekstipoimija teki niista rikkinaisia yhteyshenkiloita:
 *
 *   {"name":"Jani Etelakoski","title":"Vastuuhenkilon"}
 *   {"name":"Harry Jaakkola","title":"Vastuuhenkilon jani.etelakoski@ .fi
 *     Liikennesuunnittelijan"}
 *
 * Nimista katosivat a-umlautit ja nimikkeiksi tuli katkelmia. Mitattu
 * 23.10.2026: kaikilla 72 Turun hankkeella oli tallaisia merkintoja.
 *
 * PARIT LUETAAN SIVUN JARJESTYKSESSA. Sahkopostikentta seuraa aina omaa
 * roolikenttaansa, joten suomen genetiivia ei tarvitse mallintaa
 * ("Liikennesuunnittelija" -> "Liikennesuunnittelijan sahkoposti").
 *
 * OMA MODUULI, koska resolveri luo Supabase-asiakkaan moduulitasolla
 * eika sita voi ladata testissa ([[scripts-break-the-build]] sukuinen
 * ansa: testattavuus katoaa sivutuotteena).
 */

export type TurkuYhteyshenkilo = {
  kind: "person"
  name: string
  title: string | null
  email: string | null
  phone: null
  organization: string
}

const ON_EPOSTI = /s[äa]hk[öo]posti/i
const EPOSTI_ARVO = /^[\w.\-]+@[\w.\-]+\.[a-z]{2,}$/i

/* Kaksi tai kolme isolla alkavaa sanaa, kuten muissa nimipoimijoissa. */
const HENKILONIMI = /^[A-ZÅÄÖ][a-zåäö-]+(?:\s+[A-ZÅÄÖ][a-zåäö-]+){1,2}$/

export function turunYhteyshenkilot(
  identifyingInfo: Record<string, string> | null | undefined
): TurkuYhteyshenkilo[] {
  const kentat = Object.entries(identifyingInfo ?? {})
  const ulos: TurkuYhteyshenkilo[] = []

  for (const [i, [label, value]] of kentat.entries()) {
    if (ON_EPOSTI.test(label)) continue
    const nimi = String(value ?? "").trim()
    if (!HENKILONIMI.test(nimi)) continue

    const seuraava = kentat[i + 1]
    const email =
      seuraava && ON_EPOSTI.test(seuraava[0]) && EPOSTI_ARVO.test(String(seuraava[1]).trim())
        ? String(seuraava[1]).trim()
        : null

    ulos.push({
      kind: "person",
      name: nimi,
      title: label,
      email,
      phone: null,
      organization: "Turun kaupunki",
    })
  }

  return ulos
}
