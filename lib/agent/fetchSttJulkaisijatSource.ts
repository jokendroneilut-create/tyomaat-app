import { sttKandidaatti } from "./fetchSttHakuSource"

/*
 * STT-JULKAISIJASYÖTE — YRITYKSEN KAIKKI TIEDOTTEET ILMAN HAKUSANA-ARVAUSTA.
 *
 * `fetchSttHakuSource` hakee 44 hakusanalla KAIKKIEN tiedottajien
 * tiedotteita. Se on oikea työkalu löytämään tuntemattomia rakennuttajia
 * (datakeskukset, tehtaat), mutta hakusana on arvaus siitä mitä
 * tiedotteessa lukee — ja arvaus menee ohi säännöllisesti.
 *
 * MITATTU 24.9.2026. Mittatikkuna STT:n oma julkaisijasyöte
 * (`?publisherId=`), joka palauttaa yhden yrityksen KAIKKI tiedotteet:
 * Kreaten 32 tiedotteesta 12 kuukauden ajalta hakusanamme löysivät 22.
 * Kymmenen jäi kokonaan ulkopuolelle, mukana "Mt 180 Kurkela–Kuusisto
 * -hanke toteutusvaiheeseen" ja "Kreate käynnistää maanalaisen
 * suurhankkeen rakentamisen Tampereella".
 *
 * Koko listalla (17 julkaisijaa, 12 kk): **44 tiedotetta** jotka eivät
 * ole kannassa mistään lähteestä ja jotka läpäisevät saman
 * rakentamissuodattimen kuin hakusanahaku.
 *
 *   julkaisija              tiedotteita  kannassa  uusia hankkeita
 *   Senaatti-kiinteistöt             80        55                9
 *   Kreate Group                     32        17                6
 *   Skanska                          23        12                5
 *   Hartela                          25        13                4
 *   Nimlas                           29         8                4
 *   Jatke / Lapti / Asuntosäätiö  20-23     14-18                3
 *
 * MIKSI MYÖS NE JULKAISIJAT JOILLA AUKKOA EI OLE. Consti, Soimu,
 * K. Tervo, Tekova ja Puolustuskiinteistöt eivät tuottaneet yhtään uutta
 * — hakusanat sattuvat kattamaan ne tänään. Julkaisijasyöte on silti
 * luotettava kanava ja hakusana arpapeli: yksi pyyntö per julkaisija
 * (n. 0,3 s) on halpa vakuutus siitä ettei yhden yrityksen tiedotetyyli
 * pudota sitä pois näkyvistä.
 *
 * MIKSI EI YRITYKSEN OMA SIVU. Kokeilin ensin Kreaten omaa uutisvirtaa
 * (`kreate.fi/wp-json/wp/v2/posts`). Sen 18 hankeuutisesta 12 kk ajalta
 * KAIKKI olivat jo aineistossamme, ja STT julkaisi saman tiedotteen
 * samana päivänä (17.9.2026 molemmat). Yrityksen oma sivu ei siis tuo
 * aikaetua eikä kattavuutta — STT:n oma syöte tuo.
 *
 * KONSULTIT JÄTETTY POIS. Ramboll ja A-Insinöörit tiedottavat hankkeista
 * joissa ovat mukana, mutta rakennuttajaksi ne eivät kelpaa (D-197), ja
 * tiedotteiden hankkeet tulevat meille tilaajan kautta.
 */

/*
 * publisherId luettu STT:n hakurajapinnan palauttamista tiedotteista
 * (`release.publisher.id`). Uuden lisääminen: hae mikä tahansa yrityksen
 * tiedote ja lue id vastauksesta.
 */
export const JULKAISIJAT: { nimi: string; id: string }[] = [
  { nimi: "Kreate Group Oyj", id: "69818424" },
  { nimi: "GRK Infra Oyj", id: "69819211" },
  { nimi: "Jatke Oy", id: "69820730" },
  { nimi: "Hartela", id: "1812" },
  { nimi: "Skanska Oy", id: "69819623" },
  { nimi: "Fira", id: "69819368" },
  { nimi: "Consti Oyj", id: "69818904" },
  { nimi: "Rakennusliike Lapti Oy", id: "55623418" },
  { nimi: "Rakennusliike Soimu Oy", id: "69818770" },
  { nimi: "Rakennustoimisto K.Tervo Oy", id: "69818946" },
  { nimi: "Tekova Oyj", id: "69820639" },
  { nimi: "Mangrove Oy", id: "69819151" },
  { nimi: "Nimlas", id: "69817476" },
  { nimi: "Senaatti-kiinteistöt", id: "69820807" },
  { nimi: "Puolustuskiinteistöt", id: "69820941" },
  { nimi: "Helsingin kaupungin asunnot Oy (Heka)", id: "69818936" },
  { nimi: "Asuntosäätiö", id: "10333333" },
  /*
   * Talotekniikkaurakoitsijat (D-214). Ne tiedottavat hankkeista joissa
   * ovat sivu-urakoitsijana ja nimeavat usein paaurakoitsijan.
   * Mitattu 25.9.2026: Bravidalla 20 tiedotetta 12 kk, joista 11
   * puuttui kannasta. Assemblinilla ja Aito Talotekniikalla ei ole
   * tuoretta aukkoa, mutta pyynto on halpa ja tyyli voi muuttua.
   * Sarlin ei ole listalla: silla on oma uutissyote (sources.ts).
   */
  { nimi: "Bravida Finland Oy", id: "68994337" },
  { nimi: "Assemblin Oy", id: "54794371" },
  { nimi: "Aito Talotekniikka Oy", id: "69820534" },
]

/*
 * TUOREUSIKKUNA ON VUOSI, EI KUUKAUSI.
 *
 * Hakusanahaussa ikkuna on 30 vrk, koska 44 hakusanaa x 10 sivua on
 * kymmeniä sekunteja (D-...: ikkunan kavennus pelasti ajon). Täällä
 * kustannus on toinen: yksi julkaisija tiedottaa 1-7 kertaa kuukaudessa,
 * joten koko vuosi mahtuu kahteen sivuun.
 *
 * Vuoden ikkuna on myös tämän lähteen koko pointti — aukko jota se
 * paikkaa on kertynyt kuukausien ajalta, ei viime viikolta. Jo tuotu
 * osoite karsiutuu tuonnissa kahdella kyselyllä ilman mallikutsuja
 * (`importCandidate`, "source_url already imported").
 */
const TUOREUSIKKUNA_PAIVAA = 365

const SIVUKOKO = 50
const MAX_SIVUJA = 2

/* Sama kuin hakusanahaussa: lähde ei saa jumittaa lähdeajon budjettia. */
const PYYNNON_AIKAKATKAISU_MS = 15 * 1000

const RINNAKKAISUUS = 6

async function haeJulkaisijanTiedotteet(id: string, raja: Date): Promise<any[]> {
  const tulokset: any[] = []

  for (let sivu = 0; sivu < MAX_SIVUJA; sivu++) {
    const ohjain = new AbortController()
    const kello = setTimeout(() => ohjain.abort(), PYYNNON_AIKAKATKAISU_MS)

    let data: any = null
    try {
      const vastaus = await fetch(
        `https://www.sttinfo.fi/public-website-api/releases` +
          `?publisherId=${encodeURIComponent(id)}&language=fi&size=${SIVUKOKO}&page=${sivu}`,
        {
          signal: ohjain.signal,
          headers: {
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (compatible; TyomaatBot/1.0; +https://tyomaat.fi)",
          },
        }
      )
      if (!vastaus.ok) break
      data = await vastaus.json()
    } catch {
      break
    } finally {
      clearTimeout(kello)
    }

    const tiedotteet = data?.releases ?? []
    if (!tiedotteet.length) break

    tulokset.push(...tiedotteet)

    /*
     * Tulokset ovat uusimmasta vanhimpaan, joten sivun viimeinen on sen
     * vanhin: kun se on rajan takana, loput sivut ovat vielä vanhempia.
     */
    const vanhin = tiedotteet[tiedotteet.length - 1]?.date
    if (vanhin && new Date(vanhin) < raja) break
    if (tiedotteet.length < SIVUKOKO) break
  }

  return tulokset
}

export async function fetchSttJulkaisijatSource() {
  const raja = new Date()
  raja.setDate(raja.getDate() - TUOREUSIKKUNA_PAIVAA)

  /*
   * Julkaisijat rinnakkain mutta tulokset järjestyksessä: lopputulos ei
   * saa riippua siitä missä järjestyksessä pyynnöt palasivat.
   */
  const perJulkaisija: any[][] = new Array(JULKAISIJAT.length)
  let kursori = 0

  await Promise.all(
    Array.from({ length: RINNAKKAISUUS }, async () => {
      while (kursori < JULKAISIJAT.length) {
        const index = kursori++
        perJulkaisija[index] = await haeJulkaisijanTiedotteet(
          JULKAISIJAT[index].id,
          raja
        )
      }
    })
  )

  const nahdyt = new Set<string>()
  const tulokset: any[] = []

  for (const tiedotteet of perJulkaisija) {
    for (const tiedote of tiedotteet ?? []) {
      const id = String(tiedote?.id ?? "")
      if (!id || nahdyt.has(id)) continue

      const kandidaatti = sttKandidaatti(tiedote, {
        cutoffDate: raja,
        sourceName: "stt_julkaisijat",
      })
      if (!kandidaatti) continue

      nahdyt.add(id)
      tulokset.push(kandidaatti)
    }
  }

  return tulokset
}
