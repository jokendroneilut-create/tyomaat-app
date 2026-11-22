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

    /*
     * PARI KENTÄN NIMESTÄ, EI JÄRJESTYKSESTÄ (D-449). Tunnistetiedot
     * tallentuvat jsonb-kenttään, joka järjestää avaimet uudelleen
     * ("Piirtäjä", "Kaavatunnus", …, "Piirtäjän sähköposti"), joten
     * "seuraava kenttä" ei enää ollut sähköposti: Tuureporinkadun kaavan
     * molemmat henkilöt jäivät ilman sähköpostia 22.11.2026. Pari on
     * genetiivi ("Vastuuhenkilö" -> "Vastuuhenkilön sähköposti"), ja
     * varalla osoitteen nimiosa (fanni.tuomaala@).
     */
    const sahkopostit = kentat.filter(
      ([l, v]) => ON_EPOSTI.test(l) && EPOSTI_ARVO.test(String(v ?? "").trim())
    )
    const omaKentta = sahkopostit.find(([l]) => l.toLowerCase().startsWith(label.toLowerCase()))
    const nimiOsat = nimi.toLowerCase().split(/\s+/)
    const nimestaan = sahkopostit.find(([, v]) =>
      nimiOsat.every((osa) => String(v).toLowerCase().split("@")[0].includes(osa.replace(/[åä]/g, "a").replace(/ö/g, "o")))
    )
    const pari = omaKentta ?? nimestaan ?? (kentat[i + 1] && ON_EPOSTI.test(kentat[i + 1][0]) ? kentat[i + 1] : null)
    const email = pari && EPOSTI_ARVO.test(String(pari[1]).trim()) ? String(pari[1]).trim() : null

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
