import { asiakkaanTunniste } from "./asiakastunniste"

/*
 * KUUKAUSILASKUTUS JA ARR KAYTTAJALISTALTA (D-223).
 *
 * Summa lasketaan ASIAKKAISTA, ei tunnuksista: yksi laskutusrivi on
 * yksi asiakas riippumatta siita montako tunnusta silla on. Ks.
 * `asiakastunniste.ts` siita miksi avain on domain tai sahkoposti.
 *
 * ARR = MRR x 12, koska kaikki maksavat kuukausihintaa (Johannes
 * 1.10.2026). Jos joskus tulee vuosilaskutusta, se on oma kenttansa
 * eika kerroin.
 *
 * LUKU ON NIIN OIKEIN KUIN KASIN SYOTETYT HINNAT. Siksi tama palauttaa
 * myos `ilmanHintaa` ja `vanhinPaivitys`: vajaa MRR ei saa nayttaa
 * tasmalliselta. Sama periaate kuin D-184:ssa — mittarin premissi voi
 * vanheta ilman etta mittari huomaa.
 */

export type LaskutusRivi = {
  tunniste: string
  tila: string | null
  kuukausihinta_eur: number | string | null
  updated_at?: string | null
}

export type LaskutusKayttaja = {
  email: string | null
  /* "admin" ja "seller" eivat ole asiakkaita. */
  role?: string | null
  /* Valittu yritys voittaa sahkopostista paattelyn (D-224). */
  yritys?: string | null
}

/*
 * TRIAL-ASIAKKAAN OLETUSHINTA POTENTIAALISSA (D-224).
 *
 * Johannes 2.10.2026: potentiaaliluvut laskevat mukaan myos trialit
 * 149 EUR kuukausihinnalla. Luku on ASIAKASKOHTAINEN kuten kaikki muukin
 * hinnoittelu: Koneunionin 13 tunnusta ovat yksi asiakas, eivat
 * kolmetoista.
 *
 * OLETUS VAISTYY TIEDETYN HINNAN TIELTA. Hinnat ovat yrityskohtaisia
 * (Sarlin 99, Etuputsarit 149), joten jos trialille on jo kirjattu
 * hinta, potentiaali kayttaa sita. Oletus on vain arvaus niille joille
 * hintaa ei viela ole sovittu, eika arvaus saa yliajaa tietoa.
 */
export const TESTIASIAKKAAN_HINTA = 149

export type LaskutusYhteenveto = {
  /* Kuukausilaskutus euroina. */
  mrr: number
  /* Vuosilaskutus = mrr x 12. */
  arr: number
  /* Maksavia asiakkaita (ei tunnuksia). */
  maksaviaAsiakkaita: number
  /* Maksavien asiakkaiden tunnukset yhteensa. */
  maksaviaTunnuksia: number
  /*
   * Asiakkaita yhteensa, MYOS trialit.
   *
   * Luku jatti trialit pois 2.10.2026 asti, jolloin kortti luki
   * "21 asiakasta yhteensa" vaikka asiakkaita oli 84. Sana "yhteensa"
   * lupaa kokonaismaaran, eika rajausta voi paatella kortilta.
   * Trialeilla on oma korttinsa, joten rajaus ei ollut edes tarpeen.
   */
  asiakkaitaYhteensa: number
  /* Testiksi merkittyja tunnuksia. */
  testitunnuksia: number
  /*
   * Maksavaksi merkityt joilta puuttuu hinta. Naiden takia MRR on
   * vajaa, ja se on sanottava ennen kuin lukua katsotaan.
   */
  ilmanHintaa: number
  /* Vanhin laskutusrivin paivitys: kertoo milloin hinnat on tarkistettu. */
  vanhinPaivitys: string | null

  /* Testiksi merkityt asiakkaat (ei tunnukset). */
  testiasiakkaita: number
  /*
   * MRR jos testiasiakkaat maksaisivat `TESTIASIAKKAAN_HINTA`.
   * Sisaltaa nykyisen MRR:n.
   */
  potentiaalinenMrr: number
  potentiaalinenArr: number
}

function hinta(arvo: number | string | null | undefined): number {
  const n = typeof arvo === "string" ? Number(arvo) : arvo
  return Number.isFinite(n) ? Number(n) : 0
}

export function laskeLaskutus(
  kayttajat: LaskutusKayttaja[],
  rivit: LaskutusRivi[]
): LaskutusYhteenveto {
  const laskutus = new Map<string, LaskutusRivi>()
  for (const r of rivit) {
    const avain = String(r.tunniste ?? "").trim().toLowerCase()
    if (avain) laskutus.set(avain, r)
  }

  /* Tunnukset asiakkaittain. Myyja ja admin eivat ole asiakkaita. */
  const tunnuksia = new Map<string, number>()
  for (const u of kayttajat) {
    if (u.role === "admin" || u.role === "seller") continue
    const tunniste = asiakkaanTunniste(u.email, u.yritys)
    if (!tunniste) continue
    tunnuksia.set(tunniste, (tunnuksia.get(tunniste) ?? 0) + 1)
  }

  let mrr = 0
  let maksaviaAsiakkaita = 0
  let maksaviaTunnuksia = 0
  let testitunnuksia = 0
  let testiasiakkaita = 0
  let trialPotentiaali = 0
  let ilmanHintaa = 0
  let asiakkaitaYhteensa = 0
  let vanhinPaivitys: string | null = null

  for (const [tunniste, maara] of tunnuksia) {
    const rivi = laskutus.get(tunniste)

    asiakkaitaYhteensa++

    if (rivi?.tila === "testi") {
      testitunnuksia += maara
      testiasiakkaita++
      trialPotentiaali += hinta(rivi.kuukausihinta_eur) || TESTIASIAKKAAN_HINTA
      continue
    }

    if (rivi?.tila !== "maksava") continue

    maksaviaAsiakkaita++
    maksaviaTunnuksia += maara

    const kuukausi = hinta(rivi.kuukausihinta_eur)
    if (!kuukausi) ilmanHintaa++
    mrr += kuukausi

    const paivitetty = rivi.updated_at ?? null
    if (paivitetty && (!vanhinPaivitys || paivitetty < vanhinPaivitys)) vanhinPaivitys = paivitetty
  }

  /* Sentit pyoristetaan vasta summan jalkeen. */
  mrr = Math.round(mrr * 100) / 100

  const potentiaalinenMrr = Math.round((mrr + trialPotentiaali) * 100) / 100

  return {
    mrr,
    arr: Math.round(mrr * 12 * 100) / 100,
    testiasiakkaita,
    potentiaalinenMrr,
    potentiaalinenArr: Math.round(potentiaalinenMrr * 12 * 100) / 100,
    maksaviaAsiakkaita,
    maksaviaTunnuksia,
    asiakkaitaYhteensa,
    testitunnuksia,
    ilmanHintaa,
    vanhinPaivitys,
  }
}

export function muotoileEuro(arvo: number): string {
  return new Intl.NumberFormat("fi-FI", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(arvo)
}
