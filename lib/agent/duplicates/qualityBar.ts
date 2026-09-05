import type { ProjectMatchResult } from "@/lib/agent/projectMatcher"

/*
 * calculateMatch on viritetty yhden discovery-ehdokkaan täsmäytykseen
 * koko hankejoukkoa vasten, jossa sattumanvarainen "sama sijainti/
 * kaupunki/rakennuttaja" -osuma on harvinainen. Tässä pareittaisessa
 * koko-datan läpikäynnissä sama koodi tuotti paljon vääriä osumia,
 * koska moni hanke on tallennettu vain kaupungin/kaupunginosan
 * tarkkuudella location-kenttään (esim. "Oulu" tai "Nihti") — moni eri
 * hanke jakaa saman arvon ilman että ne ovat sama hanke. Vaaditaan siis
 * lisäksi joko vahva tunniste tai nimi-todiste, ja nimi-todisteen
 * tapauksessa vielä sama kaupunki (ei pelkkä sama maakunta), jotta
 * yleisnimiset hankkeet ("Kerrostalo", "Datakeskus") eri kaupungeissa
 * eivät osu toisiinsa.
 */
export function passesDuplicateQualityBar(match: ProjectMatchResult): boolean {
  /*
   * TALOYHTIÖ ON VAHVA TUNNISTE (D-171). "Asunto Oy Oulun Valoisa" on
   * rekisteröity nimi, ei kuvaileva otsikko: kaksi hanketta samalla
   * yhtiöllä on käytännössä sama hanke kahdesta lähteestä.
   *
   * Rajaus on mitattu ennen avaimen käyttöönottoa (D-152): koko
   * kuvauksesta poimittuna vääriä pareja oli 472, otsikkoon ja kahteen
   * ensimmäiseen virkkeeseen rajattuna kaksi.
   */
  const hasStrongIdentifier =
    match.reasons.includes("same_permit_number") ||
    match.reasons.includes("same_property_id") ||
    match.reasons.includes("same_housing_company")

  /*
   * TUNNISTE TARKISTETAAN ENNEN PISTERAJAA, ei sen jälkeen.
   *
   * Lupanumerolla ja kiinteistötunnuksella järjestyksellä ei ollut
   * väliä: kumpikin lisää 100 pistettä, joten pari on aina yli rajan.
   * Taloyhtiö tulee skannauksesta eikä pisteytyksestä, ja mitatut parit
   * jäivät 58-65 pisteeseen - pisteraja ensin olisi pudottanut neljä
   * viidestä (mitattu 6.9.2026).
   */
  if (hasStrongIdentifier) return true

  if (match.confidence < 70) return false

  /*
   * NAME_IN_DESCRIPTION KELPAA VASTA 95 PISTEESTÄ YLÖSPÄIN.
   *
   * Se oli aiemmin kokonaan pois, koska vaikutusta pareittaisessa
   * läpikäynnissä ei ollut mitattu. Mitattu 1.9.2026 koko julkisella
   * joukolla (5 954 hanketta, 732 092 vertailtua paria): kaista
   * "luottamus >= 70 ja name_in_description" on 47 paria, ja se jakautuu
   * jyrkästi pisteen mukaan.
   *
   *   >= 95   10 paria, kaikki aitoja
   *   70-78   37 paria, enimmäkseen eri hankkeita
   *
   * Ne kymmenen ovat samaa tuuli- tai aurinkovoimahanketta kahdesta
   * lähteestä — YVA-hanke ja saman puiston osayleiskaava:
   * "Halmemäen alueen tuulivoimapuisto" || "Halmemäen tuulivoimahanke,
   * Kärsämäki". Asiakkaalle ne näkyvät kahtena rivinä samasta puistosta.
   *
   * Alempi kaista on aidosti sekainen — "Ruskeasuon alueen kadut" ja
   * "Koirasaarentie, Köökarinkuja" ovat molemmat Helsingin
   * katusuunnitelmia mutta eri hankkeita — joten sitä ei päästetä läpi
   * säännöllä. Otos on pieni (10), mutta yksimielinen ja kaista kapea.
   */
  const DESCRIPTION_EVIDENCE_MIN = 95

  const hasDescriptionEvidence =
    match.reasons.includes("name_in_description") &&
    match.confidence >= DESCRIPTION_EVIDENCE_MIN

  const hasTitleEvidence =
    match.reasons.includes("exact_title") ||
    match.reasons.includes("exact_distinctive_title") ||
    match.reasons.includes("similar_title")

  return (hasTitleEvidence || hasDescriptionEvidence) && match.reasons.includes("same_city")
}
