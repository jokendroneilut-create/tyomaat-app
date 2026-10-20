/*
 * HILMAN SOPIMUSKAUDEN ALKU RAKENTAMISEN ALOITUSPÄIVÄKSI (D-325).
 *
 * MIKSI. Johannes 21.10.2026 kysyi tuleeko aloituspäivästä järkevän
 * kattava. Mittaus: rakentamisvaiheiden 1 879 julkisesta hankkeesta
 * aloituspäivä oli 251:llä (13,4 %), ja niistä 906 on Hilmasta
 * aloituspäivä 5:llä (0,6 %). Koko puute oli yhdessä lähteessä.
 *
 * REITTI. `plannedPeriod` EI ole siinä oliossa jonka tallennamme
 * (`raw_payload.original` on hakurajapinnan litteä olio). Se on samassa
 * julkisessa päätepisteessä jota liite- ja suorituspaikkahaku jo
 * kutsuvat:
 *
 *   GET /web/api/public/procedure/{procedureId}/enotice/{noticeId}
 *       -> eForm.procurementProjectLot[].procurementProject.plannedPeriod
 *
 * Mitattu 21.10.2026 otoksella 25 tasavälein: jakso löytyi 19:lta
 * (76 %), ja kaikki osumat tulivat samasta polusta.
 *
 * KOLME ANSAA, JOTKA ILMOITUS ITSE PALJASTAA. Yritin ensin karsia
 * otsikon sanoista, mutta eForm kertoo saman eksaktisti:
 *
 *   1. `contract-nature` = works | supplies | services.
 *      "Urheilupuiston uimahallin irtokalustehankinta" oli `supplies`:
 *      sopimuskausi on toimitusaika, ei rakentamista. Vain `works`
 *      kelpaa.
 *   2. `framework-agreement` -koodi. Puitesopimuksen "alku" on
 *      sopimuskauden alku, eikä mitään rakenneta sinä päivänä.
 *      Arvo `none` tarkoittaa ettei kyse ole puitesopimuksesta.
 *   3. `dps-usage`. Dynaaminen hankintajärjestelmä on sama ongelma.
 *
 * Otsikkoregexiä ei käytetä karsintaan: se tuomitsi "Sähkötöiden
 * tuntityötarjous 2026-2028" puitesopimukseksi, kun ilmoitus itse
 * sanoo `works` ja `framework-agreement: none`. Ilmoittaja tietää
 * paremmin kuin otsikon sanat ([[check-before-calling-it-intended]]).
 *
 * MIKSI ALKU ON TURVALLISEMPI KUIN LOPPU. Sopimuskauden loppu
 * todettiin 17.10.2026 vaaralliseksi: se syöttäisi
 * `lib/projects/autoCompleteGate.ts`-porttia, joka 90 vrk:n jälkeen
 * piilottaisi hankkeen asiakkaalta. `construction_start` ei ole
 * minkään portin syöte -- se vain näytetään. Siksi alku kirjoitetaan
 * ja loppu jätetään omaan metadata-kenttäänsä.
 */

export type Sopimuskausi = {
  alku: string | null
  loppu: string | null
  /** works | supplies | services, tai null jos ilmoitus ei kerro. */
  luonne: string | null
  /** Ilmoitettu puitesopimukseksi tai dynaamiseksi hankintajärjestelmäksi. */
  puitesopimus: boolean
  /** CPV-pääluokka, esim. "45" = rakennustyöt. */
  cpv: string | null
}

export const TYHJA: Sopimuskausi = {
  alku: null,
  loppu: null,
  luonne: null,
  puitesopimus: false,
  cpv: null,
}

/*
 * eForms pakkaa jokaisen arvon `{ value }` -olioon, ja päivässä on
 * aikavyöhyke mukana kahdessa eri muodossa ("2026-11-30Z",
 * "2026-12-01+02:00"). Vain kalenteripäivä kiinnostaa.
 */
function paiva(v: unknown): string | null {
  const s = String((v as any)?.value ?? v ?? "").trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const kuukausi = Number(m[2])
  const pv = Number(m[3])
  if (kuukausi < 1 || kuukausi > 12 || pv < 1 || pv > 31) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

function koodi(o: unknown): { listName: string; value: string } | null {
  const l = String((o as any)?.listName ?? "").trim()
  const v = String((o as any)?.value ?? "").trim()
  if (!l && !v) return null
  return { listName: l, value: v }
}

/*
 * Ilmoituksessa on `procurementProjectLot`-lista: yksi osa-alue per
 * rivi. Jaettu urakka on monessa osassa, ja osa-alueilla voi olla eri
 * jaksot. Otetaan AIKAISIN alku ja viimeisin loppu: hanke alkaa kun
 * sen ensimmäinen osa alkaa.
 */
export function poimiSopimuskausi(eForm: unknown): Sopimuskausi {
  const lohkot = (eForm as any)?.procurementProjectLot
  const lista = Array.isArray(lohkot) ? lohkot : lohkot ? [lohkot] : []
  if (!lista.length) return TYHJA

  const alut: string[] = []
  const loput: string[] = []
  const luonteet: string[] = []
  const cpvt: string[] = []
  let puitesopimus = false

  for (const lohko of lista) {
    const projekti = lohko?.procurementProject
    const jakso = projekti?.plannedPeriod
    const a = paiva(jakso?.startDate)
    const l = paiva(jakso?.endDate)
    if (a) alut.push(a)
    if (l) loput.push(l)

    const luonne = koodi(projekti?.procurementTypeCode)
    if (luonne?.listName === "contract-nature" && luonne.value) luonteet.push(luonne.value)

    const luokat = projekti?.mainCommodityClassification
    for (const lk of Array.isArray(luokat) ? luokat : luokat ? [luokat] : []) {
      const k = koodi(lk?.itemClassificationCode)
      if (k?.listName === "cpv" && /^\d{2}/.test(k.value)) cpvt.push(k.value.slice(0, 2))
    }

    /*
     * `framework-agreement` ja `dps-usage` tulevat samasta listasta,
     * ja arvo `none` tarkoittaa ettei kyse ole kumpaisestakaan.
     */
    const jarjestelmat = lohko?.tenderingProcess?.contractingSystem
    for (const j of Array.isArray(jarjestelmat) ? jarjestelmat : jarjestelmat ? [jarjestelmat] : []) {
      const k = koodi(j?.contractingSystemTypeCode)
      if (!k) continue
      if ((k.listName === "framework-agreement" || k.listName === "dps-usage") && k.value && k.value !== "none") {
        puitesopimus = true
      }
    }
  }

  alut.sort()
  loput.sort()
  return {
    alku: alut[0] ?? null,
    loppu: loput[loput.length - 1] ?? null,
    /* Eri luonteet eri osa-alueilla: ei väitetä mitään. */
    luonne: [...new Set(luonteet)].length === 1 ? luonteet[0] : null,
    puitesopimus,
    cpv: [...new Set(cpvt)].length === 1 ? cpvt[0] : null,
  }
}

export type Kelpaa = { kelpaa: boolean; syy: string }

/*
 * PITKÄ JAKSO + PUITESANA = ILMOITTAMATON PUITESOPIMUS.
 *
 * Otoksessa 60 (21.10.2026) kaksi riviä läpäisi kaikki ilmoitetut
 * kentät, vaikka ne eivät ole yhden rakennuksen urakoita:
 *
 *   "TIETOPYYNTÖ: Asfaltointitöiden puitejärjestely"  2027-06-01 -> 2031-05-31
 *   "Lapin yliopisto ... Vuosikorjaustyöt"            2027-01-01 -> 2030-12-31
 *
 * Molemmat on ilmoitettu `works` ja `framework-agreement: none`.
 * Erottava tekijä on kesto: otoksen mediaani on 198 vrk, nämä 1 460.
 *
 * Kesto EI YKSIN riitä hylkäykseen -- sairaala tai metroasema voi
 * aidosti kestää neljä vuotta. Siksi vaaditaan kaksi merkkiä:
 * jakso yli kahden vuoden JA otsikossa puite- tai vuosisopimussana.
 * Otsikko on tässä toissijainen varmistus, ei ensisijainen karsin
 * ([[check-before-calling-it-intended]]).
 */
const PITKA_VRK = 730

/*
 * Heikko merkki: vaatii pitkän jakson rinnalleen. "Tuntityötarjous"
 * oli ilmoitettu works-urakaksi eikä puitesopimukseksi, joten sana
 * yksin ei riitä hylkäykseen. "Työkonepalveluiden hankinta 2027-2029"
 * on sama tapaus: ilmoitettu works, mutta kolme vuotta konepalvelua.
 */
const PUITESANA = /tuntity[öo]|pienurakat|ty[öo]konepalvelu/i

/*
 * Vahva merkki: tilaaja on itse nimennyt hankinnan puitesopimukseksi
 * otsikossa. Silloin `framework-agreement: none` on täyttämätön kenttä
 * eikä tieto. Hylätään jakson pituudesta riippumatta --
 * "KAUKOLÄMPÖVERKON RAKENTAMISEN VUOSIURAKKA 2026" ei ilmoittanut
 * loppua lainkaan, joten kestosääntö ei olisi osunut siihen.
 */
const VAHVA_PUITESANA =
  /puitesopimu|puitej[äa]rjest|vuosiurakka|vuosisopimu|vuosikorjau|dynaaminen hankintaj[äa]rjestel/i

/*
 * VUOKRAMALLI: JAKSO ON VUOKRAKAUSI, EI RAKENTAMISAIKA.
 *
 * "Ylämyllyn päiväkoti vuokramallilla" 2028-01-01 -> 2047-12-31 ja
 * "Virtain pelastusasema vuokramallilla" 2028-10-01 -> 2048-09-30:
 * kaksikymmentä vuotta. Vuokra alkaa kun rakennus LUOVUTETAAN, joten
 * jakson alku on lähempänä valmistumista kuin aloitusta -- virhe menisi
 * väärään suuntaan, ei vain ohi.
 *
 * Tämä ei kumoa sitä että vuokramallihanke on aito rakennushanke
 * ([[vuokramalli-is-construction]]): hanketta ei hylätä, vain tämä
 * päivä jätetään ottamatta.
 */
const VUOKRAMALLI = /vuokramalli|vuokrausmalli|leasingmalli/i

/*
 * Yli kahdeksan vuoden jakso ei ole rakentamisaika vaan vuokra-,
 * käyttö- tai ylläpitokausi. Pisin osuma oli 2026-09-01 -> 2053-12-31
 * (27 vuotta). Raja on tarkoituksella väljä: Malmin uuden sairaalan
 * yhdeksän vuotta menetetään, mutta se on halvempi hinta kuin
 * kahdenkymmenen vuoden vuokrakauden alku aloituspäivänä.
 */
const LIIAN_PITKA_VRK = 2920

function kestoVuorokausina(k: Sopimuskausi): number | null {
  if (!k.alku || !k.loppu) return null
  const d = Math.round(
    (new Date(`${k.loppu}T00:00:00Z`).getTime() - new Date(`${k.alku}T00:00:00Z`).getTime()) / 86400000
  )
  return Number.isFinite(d) ? d : null
}

/*
 * KELPAAKO ALOITUSPÄIVÄKSI. Palauttaa syyn myös kun kelpaa, jotta
 * kuivaharjoituksen tuotos on luettavissa riveittäin.
 */
export function kelpaaAloitukseksi(k: Sopimuskausi, otsikko?: string | null): Kelpaa {
  if (!k.alku) return { kelpaa: false, syy: "ei jaksoa" }
  if (k.puitesopimus) return { kelpaa: false, syy: "puitesopimus tai DPS" }
  if (k.luonne && k.luonne !== "works") return { kelpaa: false, syy: `luonne ${k.luonne}` }
  if (!k.luonne) return { kelpaa: false, syy: "luonnetta ei ilmoitettu" }

  const nimi = String(otsikko ?? "")
  if (VUOKRAMALLI.test(nimi)) return { kelpaa: false, syy: "vuokramalli: jakso on vuokrakausi" }
  if (VAHVA_PUITESANA.test(nimi)) return { kelpaa: false, syy: "otsikko kertoo puitesopimukseksi" }

  const kesto = kestoVuorokausina(k)
  if (kesto != null && kesto > LIIAN_PITKA_VRK) return { kelpaa: false, syy: `jakso ${kesto} vrk` }
  if (kesto != null && kesto > PITKA_VRK && PUITESANA.test(nimi)) {
    return { kelpaa: false, syy: `puitesana ja ${kesto} vrk` }
  }

  return { kelpaa: true, syy: "works" }
}

export function sopimuskaudenOsoite(procedureId: string | number, noticeId: string | number): string {
  return `https://www.hankintailmoitukset.fi/web/api/public/procedure/${procedureId}/enotice/${noticeId}`
}

const UA = "tyomaat.fi/1.0 (+https://www.tyomaat.fi)"
const TIMEOUT_MS = 20000

/*
 * Palauttaa tyhjän myös virheessä: aloituspäivä on lisätieto eikä sen
 * hakeminen saa kaataa ilmoituksen käsittelyä.
 */
export async function fetchHilmaSopimuskausi(
  procedureId: unknown,
  noticeId: unknown
): Promise<Sopimuskausi> {
  const procedure = String(procedureId ?? "").trim()
  const notice = String(noticeId ?? "").trim()
  if (!procedure || !notice) return TYHJA

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(sopimuskaudenOsoite(procedure, notice), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    })
    if (!response.ok) return TYHJA
    const json = await response.json()
    return poimiSopimuskausi((json as any)?.eForm ?? json)
  } catch {
    return TYHJA
  } finally {
    clearTimeout(timer)
  }
}
