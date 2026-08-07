import { sources as legacySources } from "@/lib/agent/sources"
import {
  importCandidate,
  findRecentlySeenSourceUrls,
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

/*
 * Kandidaatit käsitellään rinnakkain, koska kustannus on lähes kokonaan
 * peräkkäisiä tietokantakierroksia: mittauksessa stt_haku vei 216 s
 * ajobudjetista (500 s) 253 kandidaatilla, eli n. 0,85 s per kandidaatti
 * lähes pelkkää odottamista. Haku itse kesti 36 s.
 *
 * Rinnakkaisuus on maltillinen tarkoituksella. Tuonti lukee ja kirjoittaa
 * samoja tauluja, joten kaksi samaa hanketta koskevaa kandidaattia voi
 * teoriassa luoda kaksi ehdokasriviä sen sijaan että jälkimmäinen
 * täsmäisi ensimmäiseen. Se on hyväksytty riski: duplikaattien tunnistus
 * on jo olemassa (scan-duplicates-cron ja TIC:n duplikaattinäkymä), ja
 * vaihtoehto - ajon katkeaminen kesken - hukkaa koko lähteen tuotoksen.
 */
const CANDIDATE_CONCURRENCY = 6

/*
 * Sivuhakuja per ajo. Yksi tiedotesivu on ~50 kB ja vastaa nopeasti, mutta
 * lähde voi palauttaa satoja kandidaatteja - mitattuna stt_haku 253 - ja
 * ajobudjetti on 500 s koko putkelle. 40 riittää tuoreisiin: uusia
 * tiedotteita tulee päivässä selvästi vähemmän, joten rästiä ei kerry.
 */
const ENRICH_PER_RUN = 40

async function processWithConcurrency<T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
): Promise<void> {
  let next = 0

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const index = next++
        if (index >= items.length) return
        await handler(items[index])
      }
    })
  )
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

  /*
   * Sama 24 tunnin ikkuna kuin vanhassa ajossa: jo nähtyä osoitetta ei
   * tuoda uudelleen. Ilman tätä jokainen ajo kirjaisi saman tiedotteen
   * uudelleen project_import_events-tauluun. Haetaan koko erälle kerralla.
   */
  const seenUrls = await findRecentlySeenSourceUrls(
    candidates.map((candidate: any) => candidate?.source_url)
  )

  let saved = 0
  let skipped = 0
  let enriched = 0

  /*
   * Osa lähteistä tarjoaa listauksessa vain otsikon ja tiivistelmän, ja
   * varsinainen sisältö on erillisellä sivulla. Sellaiselle lähteelle
   * määritellään enrich(), jota kutsutaan VAIN vielä näkemättömille
   * kandidaateille - jo tuotua tiedotetta ei haeta uudelleen.
   *
   * Budjetti rajaa ajon keston: yksi sivuhaku per kandidaatti, ja lähde voi
   * palauttaa satoja. Loput tulevat seuraavilla ajoilla, koska niiden
   * osoitteet eivät ole vielä nähtyjen joukossa.
   */
  const enrichBudget = typeof legacy.enrich === "function" ? ENRICH_PER_RUN : 0

  await processWithConcurrency(candidates, CANDIDATE_CONCURRENCY, async (candidate: any) => {
    if (!candidate?.source_url) {
      skipped++
      return
    }

    if (seenUrls.has(candidate.source_url)) {
      skipped++
      return
    }

    let prepared = candidate

    if (enriched < enrichBudget) {
      enriched++
      try {
        prepared = await legacy.enrich!(candidate)
      } catch (error: any) {
        console.error(
          `legacyFetchCollector: täydennys epäonnistui (${legacy.name}):`,
          error?.message ?? error
        )
      }
    }

    try {
      const result = await importCandidate(
        {
          ...prepared,
          source_name: prepared.source_name || legacy.name,
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
  })

  return {
    documentsFound: candidates.length,
    documentsSaved: saved,
    skipped,
  }
}
