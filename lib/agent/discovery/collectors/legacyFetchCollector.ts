import { createClient } from "@supabase/supabase-js"
import { sources as legacySources } from "@/lib/agent/sources"
import {
  importCandidate,
  findRecentlySeenSourceUrls,
  loadProjectsForMatching,
} from "@/lib/agent/importCandidate"

/*
 * Lähteen jo tallennettujen kuvausten pituudet osoitteittain.
 *
 * Käytetään vain täydennysjärjestyksen valintaan, joten epäonnistuminen ei
 * saa kaataa ajoa - tyhjä kartta tarkoittaa "ei tietoa", jolloin järjestys
 * on sama kuin ennenkin.
 */
async function loadStoredDescriptionLengths(
  sourceName: string
): Promise<Map<string, number>> {
  const lengths = new Map<string, number>()

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("potential_projects")
        .select("metadata")
        .eq("metadata->>source_name", sourceName)
        .range(from, from + 999)

      if (error) throw error
      for (const row of data ?? []) {
        const url = (row as any).metadata?.source_url
        if (!url) continue
        lengths.set(url, String((row as any).metadata?.description ?? "").length)
      }
      if (!data || data.length < 1000) break
    }
  } catch {
    return new Map()
  }

  return lengths
}

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

/*
 * TUONNIN AIKABUDJETTI.
 *
 * Lähdeajolla on 90 sekunnin aikakatkaisu (sourceWorker). Kun se
 * ylittyy, koko ajo kirjautuu virheeksi eikä lähde saa yhtään
 * onnistumista - vaikka se olisi ehtinyt tuoda satoja kandidaatteja.
 *
 * Mitattu 14.8.2026: stt_haku palautti 863 kandidaattia, ja sen
 * ONNISTUNEET ajot kestivät 209-216 s. Aikakatkaisu tehtiin sen jälkeen,
 * joten lähde ei voinut enää onnistua kertaakaan: kahdeksan perakkaista
 * virhetta.
 *
 * Sama ratkaisu kuin putken ajobudjetissa: tuonti lopetetaan siististi
 * ennen katkaisua ja ajo kirjataan onnistuneeksi sillä mitä ehdittiin.
 * Loput tulevat seuraavalla ajolla, koska järjestys on lyhin kuvaus
 * ensin ja NÄKEMÄTTÖMÄN kuvauspituus on 0 - uudet kandidaatit ovat siis
 * aina jonon kärjessä.
 */
const IMPORT_BUDGET_MS = 70 * 1000

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

  /*
   * Budjetti lasketaan AJON ALUSTA, ei haun jälkeen: aikakatkaisu koskee
   * koko ajoa. Haku on osa sitä ja voi yksinään viedä kymmeniä sekunteja
   * (stt_haku 13-31 s mitattuna), joten haun jälkeen aloitettu budjetti
   * ylittäisi katkaisun juuri niillä lähteillä joita se on tarkoitettu
   * suojaamaan.
   */
  const importDeadline = Date.now() + IMPORT_BUDGET_MS

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
  let deferred = 0

  /*
   * Osa lähteistä tarjoaa listauksessa vain otsikon ja tiivistelmän, ja
   * varsinainen sisältö on erillisellä sivulla. Sellaiselle lähteelle
   * määritellään enrich(), jota kutsutaan VAIN vielä näkemättömille
   * kandidaateille - jo tuotua tiedotetta ei haeta uudelleen.
   *
   * Budjetti rajaa ajon keston: yksi sivuhaku per kandidaatti, ja lähde voi
   * palauttaa satoja.
   *
   * BUDJETTI ANNETAAN NIILLE JOILTA KUVAUS PUUTTUU. Aiemmin kandidaatit
   * käsiteltiin lähteen omassa järjestyksessä, joka on ajosta toiseen sama,
   * joten budjetti kului aina samoihin ensimmäisiin ja häntä jäi ikuisesti
   * täydentämättä. Mitattu 12.8.2026: 186 jonoriviä ja 66 hyväksyttyä
   * hanketta oli yhä pelkän hakurajapinnan metadescriptionin varassa
   * (alle 400 merkkiä), vaikka tiedotteen leipätekstissä on kustannusarvio,
   * aikataulu ja osalliset yritykset.
   *
   * Järjestys tehdään tallennetun kuvauksen pituuden mukaan: lyhin ensin.
   * Näin jokainen ajo vie jonoa eteenpäin ja jo täydennetyt jäävät rauhaan.
   */
  const enrichBudget = typeof legacy.enrich === "function" ? ENRICH_PER_RUN : 0

  const storedDescriptionLength =
    enrichBudget > 0 ? await loadStoredDescriptionLengths(legacy.name) : new Map()

  const ordered =
    enrichBudget > 0
      ? [...candidates].sort(
          (a: any, b: any) =>
            (storedDescriptionLength.get(a?.source_url) ?? 0) -
            (storedDescriptionLength.get(b?.source_url) ?? 0)
        )
      : candidates

  await processWithConcurrency(ordered, CANDIDATE_CONCURRENCY, async (candidate: any) => {
    /*
     * Budjetti tarkistetaan ennen työtä, ei kesken sen: keskeytetty
     * tuonti jättäisi rivin puolitiehen.
     */
    if (Date.now() > importDeadline) {
      deferred++
      return
    }

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

  /*
   * Kesken jäänyt osuus kirjataan lokiin. Ilman merkintää osittainen ajo
   * näyttäisi samalta kuin täysi, ja hiljainen katkaisu on juuri se vika
   * josta ajokohtainen aikabudjetti aikanaan syntyi.
   */
  if (deferred > 0) {
    console.warn(
      `legacyFetchCollector: aikabudjetti tayttyi (${legacy.name}), ` +
        `${deferred} kandidaattia siirtyi seuraavaan ajoon`
    )
  }

  return {
    documentsFound: candidates.length,
    documentsSaved: saved,
    skipped,
    deferred,
  }
}
