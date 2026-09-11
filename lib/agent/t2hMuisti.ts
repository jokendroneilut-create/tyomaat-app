import { createClient } from "@supabase/supabase-js"

/*
 * T2H: MITKÄ KOHDESIVUT ON JO HAETTU, JA MILLOIN (D-186).
 *
 * T2H sallii yhden sivupyynnön 15 sekunnin välein (robots.txt) ja lähteen
 * ajon katto on 90 s, joten ajossa ehtii kaksi kohdesivua. Lähde tulee
 * vuoroon 4-6 vrk:n välein. Ensimmäinen versio kiersi kaikki 63 sivua
 * sokeasti, joten uusi kohde saattoi odottaa vuoroaan kuukausia - ja
 * pyyntöbudjetti meni jo tunnettujen, muuttumattomien sivujen lukemiseen.
 *
 * SITEMAP KERTOO KAIKEN YHDELLÄ PYYNNÖLLÄ: jokaisen kohdesivun osoitteen ja
 * sen milloin sivua on viimeksi muutettu (`lastmod`). Uusi kohde on
 * sitemapissa uusi osoite, joten sen löytämiseen ei tarvita yhtään
 * kohdesivun hakua. Muistiin kirjataan jokaisesta haetusta sivusta sen
 * `lastmod` hakuhetkellä - myös hylätyistä (valmistuneet kohteet), koska
 * muuten ne näyttäisivät joka ajolla uusilta ja veisivät paikat.
 *
 * MUISTI ON `alert_watermarks`-TAULUSSA avaimilla `t2h:<url>` (hyväksytty
 * tai vielä hakematon) ja `t2h-hylatty:<url>`. Taulu on avain -> aikaleima
 * ja palvelinpuolen käytössä; uutta taulua ei tarvittu. `source_documents`
 * ei kelpaa: faktajono poimii sieltä jokaisen käsittelemättömän rivin, ja
 * hylätyt sivut jäisivät jonoon roikkumaan.
 */

export type SitemapSivu = { url: string; lastmod: string | null }

export type MuistiRivi = {
  url: string
  /* Sitemapin lastmod hakuhetkellä; HAKEMATON = tiedetään mutta ei haettu. */
  kasiteltyLastmod: string
  hylatty: boolean
  paivitetty: string
}

export type Syy = "uusi" | "hakematon" | "muuttunut" | "muuttunut-hylatty"

export type Valinta = { url: string; lastmod: string | null; syy: Syy }

/* Sentinelli: lastmod ei voi olla 1970, joten tämä tarkoittaa "ei haettu". */
export const HAKEMATON = "1970-01-01T00:00:00.000Z"

const aika = (arvo: string | null | undefined) => {
  const t = arvo ? Date.parse(arvo) : NaN
  return Number.isFinite(t) ? t : null
}

/*
 * JÄRJESTYS:
 *
 *   1. uusi         osoite ei ole muistissa lainkaan -> sitemapiin
 *                   ilmestynyt kohde. Tämän takia koko muutos tehtiin.
 *   2. hakematon    tiedossa mutta ei vielä haettu (ensimmäisen ajon
 *                   aloitusvaranto).
 *   3. muuttunut    haettu, hyväksytty, ja sivua on muutettu sen jälkeen:
 *                   tunnetun kohteen tila voi olla vaihtunut.
 *   4. muuttunut-hylatty  haettu ja hylätty, mutta muutettu sen jälkeen.
 *                   Viimeisenä: valmistunut kohde tuskin palaa.
 *
 * Muuttumatonta sivua ei haeta. Ilman lastmodia muutosta ei voi todeta,
 * joten sellainen sivu ei vie paikkaa.
 *
 * Kunkin ryhmän sisällä uusin lastmod ensin.
 */
export function valitseHaettavat(
  sivut: SitemapSivu[],
  muisti: Map<string, MuistiRivi>,
  koko: number
): Valinta[] {
  const ryhmat: Record<Syy, Valinta[]> = {
    uusi: [],
    hakematon: [],
    muuttunut: [],
    "muuttunut-hylatty": [],
  }

  for (const sivu of sivut) {
    const rivi = muisti.get(sivu.url)

    if (!rivi) {
      ryhmat.uusi.push({ ...sivu, syy: "uusi" })
      continue
    }

    if (rivi.kasiteltyLastmod === HAKEMATON) {
      ryhmat.hakematon.push({ ...sivu, syy: "hakematon" })
      continue
    }

    const nyt = aika(sivu.lastmod)
    const silloin = aika(rivi.kasiteltyLastmod)
    if (nyt == null || silloin == null || nyt <= silloin) continue

    const syy: Syy = rivi.hylatty ? "muuttunut-hylatty" : "muuttunut"
    ryhmat[syy].push({ ...sivu, syy })
  }

  const uusinEnsin = (a: Valinta, b: Valinta) => (aika(b.lastmod) ?? 0) - (aika(a.lastmod) ?? 0)

  return [
    ...ryhmat.uusi.sort(uusinEnsin),
    ...ryhmat.hakematon.sort(uusinEnsin),
    ...ryhmat.muuttunut.sort(uusinEnsin),
    ...ryhmat["muuttunut-hylatty"].sort(uusinEnsin),
  ].slice(0, Math.max(0, koko))
}

/*
 * KAATUNEEN AJON MERKINNÄT PERUTAAN.
 *
 * Sivu kirjataan muistiin hakuhetkellä, mutta ehdokas tuodaan vasta
 * haun jälkeen. Jos ajo kaatuu aikakatkaisuun välissä, muisti väittäisi
 * sivun käsitellyksi vaikka hanketta ei koskaan tuotu - ja uusi kohde
 * putoaisi pois uusien joukosta.
 *
 * Siksi ajon alussa: jos edellinen ajo kaatui (viimeisin virhe on
 * viimeisintä onnistumista uudempi), kaikki viimeisimmän onnistumisen
 * jälkeen tehdyt merkinnät poistetaan. Sivut palaavat "uusiksi" ja
 * haetaan heti uudelleen. Palauttaa rajan, tai nullin jos ei tarvita.
 */
export function peruutusRaja(lahde?: {
  last_error_at?: string | null
  last_success_at?: string | null
} | null): string | null {
  const virhe = aika(lahde?.last_error_at)
  if (virhe == null) return null

  const onnistui = aika(lahde?.last_success_at)
  if (onnistui != null && onnistui >= virhe) return null

  return lahde?.last_success_at ?? HAKEMATON
}

/* ----------------------------------------------------------------------
 * Tietokanta. Kaikki fail-open: virhe palauttaa nullin/falsen, jolloin
 * kerääjä palaa vanhaan kiertoon eikä jää tyhjän päälle.
 * ------------------------------------------------------------------- */

const ETULIITE = "t2h:"
const ETULIITE_HYLATTY = "t2h-hylatty:"

function asiakas() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const avain = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && avain ? createClient(url, avain, { auth: { persistSession: false } }) : null
}

export async function lataaMuisti(): Promise<Map<string, MuistiRivi> | null> {
  const db = asiakas()
  if (!db) return null

  const { data, error } = await db
    .from("alert_watermarks")
    .select("key,last_processed_at,updated_at")
    .like("key", "t2h%")
  if (error) return null

  const muisti = new Map<string, MuistiRivi>()
  for (const r of data ?? []) {
    const hylatty = String(r.key).startsWith(ETULIITE_HYLATTY)
    const url = String(r.key).slice(hylatty ? ETULIITE_HYLATTY.length : ETULIITE.length)
    const rivi: MuistiRivi = {
      url,
      kasiteltyLastmod: new Date(r.last_processed_at).toISOString(),
      hylatty,
      paivitetty: r.updated_at,
    }
    /* Jos sivu on vaihtanut ryhmää, tuorein merkintä voittaa. */
    const vanha = muisti.get(url)
    if (!vanha || (aika(rivi.paivitetty) ?? 0) > (aika(vanha.paivitetty) ?? 0)) muisti.set(url, rivi)
  }
  return muisti
}

/* Ensimmäinen ajo: kaikki nykyiset sivut tiedetyiksi mutta hakemattomiksi. */
export async function rekisteroiHakemattomat(urls: string[]): Promise<boolean> {
  const db = asiakas()
  if (!db || !urls.length) return false

  const nyt = new Date().toISOString()
  const { error } = await db.from("alert_watermarks").upsert(
    urls.map((url) => ({ key: ETULIITE + url, last_processed_at: HAKEMATON, updated_at: nyt })),
    { onConflict: "key" }
  )
  return !error
}

export async function kirjaaHaettu(url: string, lastmod: string | null, hylatty: boolean): Promise<void> {
  const db = asiakas()
  if (!db) return

  const nyt = new Date().toISOString()
  await db.from("alert_watermarks").upsert(
    {
      key: (hylatty ? ETULIITE_HYLATTY : ETULIITE) + url,
      /* Ilman lastmodia kirjataan hakuhetki: muutosta ei voi todeta. */
      last_processed_at: lastmod ?? nyt,
      updated_at: nyt,
    },
    { onConflict: "key" }
  )
  await db
    .from("alert_watermarks")
    .delete()
    .eq("key", (hylatty ? ETULIITE : ETULIITE_HYLATTY) + url)
}

export async function peruMerkinnatJalkeen(raja: string): Promise<void> {
  const db = asiakas()
  if (!db) return
  await db.from("alert_watermarks").delete().like("key", "t2h%").gt("updated_at", raja)
}
