import { sources as legacySources } from "@/lib/agent/sources"
import {
  importCandidate,
  isSourceUrlSeenRecently,
  loadProjectsForMatching,
} from "@/lib/agent/importCandidate"

/*
 * Sovitin, joka tuo vanhat koodissa määritellyt lähteet (lib/agent/sources.ts)
 * discovery-putken ajastuksen alle.
 *
 * Tausta: vanha putki ajoi kaikki 34 lähdettä peräkkäin yhdessä pyynnössä ja
 * kiersi aloituskohtaa päivän mukaan. Kierto oli rikki - step = ceil(34/2)
 * tarkoitti että aloituskohtia oli vain kaksi (0 ja 17) - ja koska ajo kuoli
 * aikaan ennen loppua, listan viimeiset lähteet eivät päässeet koskaan
 * vuoroon. Mittaus 7 päivältä: pisin ajo ylsi indeksiin 28, uusimmat viisi
 * lähdettä ovat indekseissä 29-33.
 *
 * Discovery-putki valitsee lähteet järjestyksessä priority DESC, last_run_at
 * ASC (nullsFirst) - eli vanhin ajettu ensin. Se on juuri se kursori jota
 * vanha kierto yritti jäljitellä, ja se toimii riippumatta siitä kuinka
 * pitkälle yksittäinen ajo ehtii: kesken jäänyt ajo jättää loput lähteet
 * vanhimmiksi, joten seuraava ajo aloittaa niistä.
 *
 * Kandidaatit viedään samaa tuontipolkua kuin ennenkin (importCandidate),
 * koska sen täsmäytyshaara on vanhan putken päätuotos: 28 000 tapahtumasta
 * 5 778 osui olemassa olevaan hankkeeseen ja päivitti sen, kun taas uusia
 * ehdokkaita syntyi 857. Se haara säilyy tässä muuttumattomana.
 */

/*
 * discovery_sources.parser kertoo minkä vanhan lähteen fetcheriä ajetaan.
 * Nimi täsmää lib/agent/sources.ts:n name-kenttään (esim. "ymparistolupa").
 */
function findLegacySource(key: string | null | undefined) {
  if (!key) return null
  return legacySources.find((source) => source.name === key) ?? null
}

export async function collectLegacySource(source: any) {
  const legacy = findLegacySource(source.parser)

  if (!legacy) {
    throw new Error(
      `Tuntematon vanha lähde: ${source.parser ?? "(parser puuttuu)"}`
    )
  }

  const candidates = (await legacy.fetch()) ?? []

  /*
   * Täsmäytyslista haetaan kerran per lähdeajo. Yksi lähde voi tuottaa
   * satoja kandidaatteja (stt_haku palautti mittauksessa 253), ja ilman
   * tätä jokainen niistä lukisi koko projects-taulun uudelleen.
   */
  const projects = candidates.length > 0 ? await loadProjectsForMatching() : []

  let saved = 0
  let skipped = 0

  for (const candidate of candidates) {
    if (!candidate?.source_url) {
      skipped++
      continue
    }

    /*
     * Sama 24 tunnin ikkuna kuin vanhassa ajossa: jo nähtyä osoitetta ei
     * tuoda uudelleen. Ilman tätä jokainen ajo kirjaisi saman tiedotteen
     * uudelleen project_import_events-tauluun.
     */
    if (await isSourceUrlSeenRecently(candidate.source_url)) {
      skipped++
      continue
    }

    try {
      const result = await importCandidate(
        {
          ...candidate,
          source_name: candidate.source_name || legacy.name,
        },
        { projects }
      )

      /*
       * "saved" tarkoittaa tässä kandidaattia joka johti johonkin: uuteen
       * ehdokkaaseen tai olemassa olevan hankkeen päivitykseen. Ohitukset
       * (duplikaatti, valmistunut, kelvoton nimi) eivät ole virheitä vaan
       * normaalia suodatusta, joten ne eivät kaada ajoa.
       */
      if (result.status === "queued_for_review" || result.status === "matched") {
        saved++
      } else {
        skipped++
      }
    } catch (error: any) {
      /*
       * Yksittäisen kandidaatin virhe ei saa kaataa koko lähteen ajoa -
       * muuten yksi rikkinäinen tiedote estäisi kaikki sen jälkeiset.
       */
      console.error(
        `legacyFetchCollector: kandidaatti epäonnistui (${legacy.name}):`,
        error?.message ?? error
      )
      skipped++
    }
  }

  return {
    documentsFound: candidates.length,
    documentsSaved: saved,
    skipped,
  }
}
