import { unstable_cache } from "next/cache"
import { createClient } from "@supabase/supabase-js"
import { haeYritysrekisteri } from "@/lib/metrics/yritysrekisteri"

import {
  MITATTAVAT_VAIHEET,
  laskeKattavuus,
  type Kattavuus,
  type MitattavaVaihe,
} from "@/lib/metrics/yhteystiedonKattavuus"
import type { Piste } from "../components/KattavuusTrendi"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * MITTARIT LUKEVAT ELAVAA TILAA, GRAAFIT TILANNEKUVIA (D-239).
 *
 * Neula nayttaa sen mika tilanne on nyt, ei sita mika se oli viime yona
 * — muuten korjaus ei nakyisi mittarissa ennen seuraavaa cronia. Graafi
 * taas voi nayttaa vain mitattuja paivia.
 *
 * EI KAADA /tic-SIVUA. Sivun varsinainen tyo on katselmointijono sen
 * alla; mittarit ovat ylareunassa. Virheessa palautetaan tyhja, jolloin
 * mittarit jaavat pois mutta jono toimii (sama peruste kuin
 * getTicDailySummary).
 */

export type YhteystietoMittarit = {
  kattavuus: Kattavuus[]
  historia: Record<MitattavaVaihe, Piste[]>
  /*
   * Mittaushetki kulkee mukana, koska luku voi tulla valimuistista.
   * Ilman tata sivu nayttaisi 2 tuntia vanhan neulan tuoreena — ja
   * naytolla oleva luku ilman ikaa on juuri se ansa josta D-239 varoitti
   * (ks. muisti: displayed-state-is-not-enforced).
   */
  haettu: number
}

const TYHJA: YhteystietoMittarit = {
  kattavuus: [],
  historia: { construction: [], planning: [] },
  haettu: 0,
}

/* Kuinka monta viimeisinta mittauspaivaa graafiin. */
const PAIVIA = 30

/*
 * VAIN SE KENTTA JOTA MITTARI LUKEE, EI KOKO METADATAA (D-387).
 *
 * Johannes 8.11.2026: *"tämä hyväksyminen hidastuu paljon kun sivun
 * lataus kestää niin kauan."* Mitattu syy oli tassa: kysely haki
 * `metadata`-sarakkeen kokonaisuudessaan, ja se on taulun suurin
 * sarake.
 *
 *   koko metadata            28,53 Mt   5–31 s
 *   vain contact_persons      2,30 Mt   2,4–3,3 s
 *   + status/julkisuus        2,19 Mt   2,1–2,3 s
 *
 * Mittari lukee metadatasta **vain `contact_persons`in**
 * (`onYhteyshenkilo`, `onHankekohtainenYhteyshenkilo`); loput kentat
 * olivat pelkkaa siirtokuormaa. PostgREST osaa poimia JSON-avaimen
 * suoraan, joten rajaus tehdaan kannassa eika Nodessa — muuten luku
 * olisi yha 28 Mt.
 *
 * STATUS JA JULKISUUS MYOS KANNASSA. `laskeKattavuus` suodattaa niilla
 * tasan samoin, joten suodatus kannassa ei muuta lukua — se vain jattaa
 * 355 riviä hakematta. Vaihetta EI suodateta: `normalizeLegacyPhase`
 * tuntee vanhat kirjoitusasut, ja niiden luettelo kyselyyn olisi
 * kaksoiskappale joka ehtisi eriytya.
 */
const MITTARIN_KENTAT =
  "phase, status, is_public, developer, builder, yhteyshenkilot:metadata->contact_persons"

async function laskeMittarit(): Promise<YhteystietoMittarit> {
  try {
    const hankkeet: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select(MITTARIN_KENTAT)
        .eq("status", "active")
        .eq("is_public", true)
        .range(from, from + 999)
      if (error) throw error
      /*
       * Mittari odottaa `metadata.contact_persons`-muotoa, joten
       * poimittu kentta palautetaan siihen muotoon. Nain mittarin oma
       * logiikka pysyy koskemattomana.
       */
      for (const rivi of data ?? []) {
        const r = rivi as any
        hankkeet.push({
          phase: r.phase,
          status: r.status,
          is_public: r.is_public,
          developer: r.developer,
          builder: r.builder,
          metadata: { contact_persons: r.yhteyshenkilot ?? [] },
        })
      }
      if (!data || data.length < 1000) break
    }

    /*
     * Yritysrekisteri mukaan (D-242): harmaa neula nayttaa myos
     * yrityskohtaisen yhteyshenkilon, tumma vain hankekohtaisen.
     */
    const rekisteri = await haeYritysrekisteri()
    const kattavuus = laskeKattavuus(hankkeet, rekisteri)

    const { data: rivit } = await supabaseAdmin
      .from("yhteystieto_kattavuus")
      .select("paiva, vaihe, hankkeita, yhteystiedolla")
      .order("paiva", { ascending: true })
      .limit(PAIVIA * MITATTAVAT_VAIHEET.length)

    const historia: Record<MitattavaVaihe, Piste[]> = { construction: [], planning: [] }
    for (const rivi of rivit ?? []) {
      const vaihe = String(rivi.vaihe) as MitattavaVaihe
      if (!historia[vaihe]) continue
      historia[vaihe].push({
        paiva: String(rivi.paiva),
        osuus: rivi.hankkeita ? rivi.yhteystiedolla / rivi.hankkeita : 0,
      })
    }

    return { kattavuus, historia, haettu: Date.now() }
  } catch (error) {
    console.error("getYhteystietoMittarit:", error)
    return TYHJA
  }
}

/*
 * KAKSI TUNTIA VALIMUISTIA, MUTTA VAIN MITTAREILLE (D-387).
 *
 * Johannes 8.11.2026: *"pystytkö tekemään tälle sivulle välimuistin
 * esim myös 2 tuntia kuten karttasivulla on. tämä hyväksyminen hidastuu
 * paljon kun sivun lataus kestää niin kauan."*
 *
 * MITATTU ENNEN JA JALKEEN (`scripts/mittaa-tic-lataus.ts`, 3 kierrosta):
 *
 *   ennen         sivun data 26 802 ms  (15 436–48 855)
 *   kenttarajaus  sivun data  2 700 ms  (2 452–2 857)
 *   + valimuisti  mittarit     ~0 ms toisesta latauksesta alkaen
 *
 * MIKSI VAIN MITTARIT. Sivulla on nelja palvelua, ja ne eivat ole
 * samanarvoisia valimuistin kannalta:
 *
 *   katselmointijono    ei saa vanhentua: juuri hyvaksytty rivi palaisi
 *                       nakyviin ja se nakyisi virheena
 *   jonon laskurit      sama syy, ne ovat jonon lukuja
 *   mittarit            saa vanhentua: luku muuttuu hitaasti, ja
 *                       hyvaksynta siirtaa yhden hankkeen tuhannesta
 *
 * TAMA ON TIETOINEN POIKKEUS D-239:AAN, joka sanoo etta neula nayttaa
 * nykytilan eika viime yota. Perustelu: neula on nyt sivun hitain osa,
 * ja sen tuoreus maksoi 2,5 sekuntia jokaisesta hyvaksynnasta. Siksi
 * `haettu` kulkee mukana ja sivu kertoo luvun ian — vanhentunut luku
 * ilman ikaa olisi eri asia kuin vanhentunut luku joka sanoo olevansa
 * vanhentunut.
 *
 * KAKSI KERROSTA, kuten karttasivulla (getTodayProjects): `unstable_cache`
 * on jaettu ja pysyva tuotannossa muttei pida kehityspalvelimella, joten
 * edessa on prosessin muistivalimuisti joka toimii molemmissa.
 */
const VALIMUISTI_SEKUNTIA = 2 * 60 * 60

/* Avaimen versio: nosta kun mittarin laskenta muuttuu. */
const MITTARIN_VERSIO = "v1-2026-11-08"

let muisti: YhteystietoMittarit | null = null

export async function getYhteystietoMittarit(): Promise<YhteystietoMittarit> {
  if (muisti && Date.now() - muisti.haettu < VALIMUISTI_SEKUNTIA * 1000) {
    return muisti
  }

  const hae = unstable_cache(laskeMittarit, ["tic-yhteystietomittarit", MITTARIN_VERSIO], {
    revalidate: VALIMUISTI_SEKUNTIA,
    tags: ["yhteystietomittarit"],
  })

  /*
   * NEXT:N VALIMUISTIA EI OLE PYYNNON ULKOPUOLELLA. `unstable_cache`
   * heittaa *"Invariant: incrementalCache missing"* kun sama funktio
   * kutsutaan skriptista — ja juuri nain mittausskripti
   * (`scripts/mittaa-tic-lataus.ts`) sita kutsuu. Ilman tata vartijaa
   * valimuistin lisaaminen olisi rikkonut sen tyokalun, jolla muutos
   * mitataan. Muistikerros toimii molemmissa.
   */
  let tulos: YhteystietoMittarit
  try {
    tulos = await hae()
  } catch {
    tulos = await laskeMittarit()
  }

  /*
   * Virhetilanteen tyhjaa tulosta ei jateta muistiin: muuten yksi
   * aikakatkaisu piilottaisi mittarit kahdeksi tunniksi.
   */
  if (tulos.kattavuus.length > 0) muisti = tulos

  return tulos
}
