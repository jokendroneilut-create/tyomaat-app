/*
 * KÄYTÖN YHTEENVETO analytics_events-taulusta.
 *
 * Taulu on ollut olemassa 14.7.2026 alkaen ja sisältää jo kaiken mitä
 * tarvitaan: `login`- ja `pageview`-tapahtumat, ja sivulatauksilla
 * `duration_seconds`. Puuttui vain esitys.
 *
 * ISTUNTO ON PÄÄTELTÄVÄ, EI KIRJATTU. Taulussa ei ole istuntotunnusta,
 * joten istunto rajataan tauosta: uusi istunto alkaa kun edellisestä
 * tapahtumasta on yli 30 minuuttia. Sama sääntö kuin Google
 * Analyticsissä, ja se on tässä tarkoituksella sama — luvut on
 * tarkoitus lukea samalla tavalla kuin GA:ta.
 *
 * KESTO LASKETAAN SIVULATAUSTEN SUMMASTA, ei istunnon alusta ja
 * lopusta. Viimeisen sivun kesto on aina epävarma (käyttäjä ei "kirjaudu
 * ulos" sivulta), joten summa aliarvioi hieman. Se on oikea suunta:
 * mieluummin liian pieni kuin keksitty.
 */

export type Tapahtuma = {
  user_id?: string | null
  event_type?: string | null
  path?: string | null
  duration_seconds?: number | null
  created_at?: string | null
}

/* Tauko joka aloittaa uuden istunnon. */
export const ISTUNTO_TAUKO_MIN = 30

export type PaivaRivi = {
  paiva: string
  kirjautumisia: number
  sivulatauksia: number
  istuntoja: number
  sekunteja: number
}

function paivastaAvain(iso: string | null | undefined): string {
  return String(iso ?? "").slice(0, 10)
}

/*
 * Yhden käyttäjän päiväkohtainen käyttö, uusin ensin.
 *
 * Tämä on se näkymä jota myyjä tarvitsee: "kirjautui 1.9., 2.9. ja 3.9.,
 * oli 5 min, 6 min ja 9 min".
 */
export function paivittainenKaytto(tapahtumat: Tapahtuma[]): PaivaRivi[] {
  const jarjestetyt = [...tapahtumat]
    .filter((t) => t.created_at)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))

  const per = new Map<string, PaivaRivi>()
  let edellinen: number | null = null

  for (const t of jarjestetyt) {
    const paiva = paivastaAvain(t.created_at)
    const rivi = per.get(paiva) ?? {
      paiva,
      kirjautumisia: 0,
      sivulatauksia: 0,
      istuntoja: 0,
      sekunteja: 0,
    }

    const hetki = new Date(String(t.created_at)).getTime()
    const uusiIstunto =
      edellinen === null || hetki - edellinen > ISTUNTO_TAUKO_MIN * 60_000
    if (uusiIstunto) rivi.istuntoja++
    edellinen = hetki

    if (t.event_type === "login") rivi.kirjautumisia++
    if (t.event_type === "pageview") {
      rivi.sivulatauksia++
      rivi.sekunteja += Math.max(0, Number(t.duration_seconds ?? 0))
    }

    per.set(paiva, rivi)
  }

  return [...per.values()].sort((a, b) => b.paiva.localeCompare(a.paiva))
}

export type JaksonLuvut = {
  kayttajia: number
  istuntoja: number
  sivulatauksia: number
  sekunteja: number
  /* Keskimääräinen istunnon kesto sekunteina. */
  keskiIstuntoSek: number
}

export type PaivaSarja = {
  paiva: string
  kayttajia: number
  istuntoja: number
  sivulatauksia: number
  sekunteja: number
}

/*
 * Koko joukon päiväsarja: montako eri käyttäjää, istuntoa ja minuuttia
 * kunakin päivänä. Tämä on se aikasarja jonka GA piirtää ylimmäksi.
 *
 * Päivät täytetään myös silloin kun tapahtumia ei ole, jotta käyrässä
 * näkyy kuoppa eikä katkos.
 */
export function paivasarja(
  tapahtumat: Tapahtuma[],
  input: { alku: string; loppu: string }
): PaivaSarja[] {
  const perPaiva = new Map<string, { kayttajat: Set<string>; sivut: number; sek: number }>()
  const istunnot = new Map<string, number>()
  const viimeisin = new Map<string, number>()

  const jarjestetyt = [...tapahtumat]
    .filter((t) => t.created_at)
    .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))

  for (const t of jarjestetyt) {
    const paiva = paivastaAvain(t.created_at)
    if (paiva < input.alku || paiva > input.loppu) continue

    const r = perPaiva.get(paiva) ?? { kayttajat: new Set<string>(), sivut: 0, sek: 0 }
    if (t.user_id) r.kayttajat.add(String(t.user_id))
    if (t.event_type === "pageview") {
      r.sivut++
      r.sek += Math.max(0, Number(t.duration_seconds ?? 0))
    }
    perPaiva.set(paiva, r)

    /* Istunto lasketaan käyttäjäkohtaisesta tauosta. */
    const kayttaja = String(t.user_id ?? "tuntematon")
    const hetki = new Date(String(t.created_at)).getTime()
    const edellinen = viimeisin.get(kayttaja)
    if (edellinen === undefined || hetki - edellinen > ISTUNTO_TAUKO_MIN * 60_000) {
      istunnot.set(paiva, (istunnot.get(paiva) ?? 0) + 1)
    }
    viimeisin.set(kayttaja, hetki)
  }

  const sarja: PaivaSarja[] = []
  for (let d = new Date(`${input.alku}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const paiva = d.toISOString().slice(0, 10)
    if (paiva > input.loppu) break
    const r = perPaiva.get(paiva)
    sarja.push({
      paiva,
      kayttajia: r?.kayttajat.size ?? 0,
      istuntoja: istunnot.get(paiva) ?? 0,
      sivulatauksia: r?.sivut ?? 0,
      sekunteja: r?.sek ?? 0,
    })
  }

  return sarja
}

/* Jakson kokonaisluvut sarjasta, keskikesto istuntoa kohden. */
export function jaksonLuvut(sarja: PaivaSarja[], tapahtumat: Tapahtuma[], jakso: { alku: string; loppu: string }): JaksonLuvut {
  const kayttajat = new Set<string>()
  for (const t of tapahtumat) {
    const paiva = paivastaAvain(t.created_at)
    if (paiva < jakso.alku || paiva > jakso.loppu) continue
    if (t.user_id) kayttajat.add(String(t.user_id))
  }

  const istuntoja = sarja.reduce((s, r) => s + r.istuntoja, 0)
  const sekunteja = sarja.reduce((s, r) => s + r.sekunteja, 0)

  return {
    kayttajia: kayttajat.size,
    istuntoja,
    sivulatauksia: sarja.reduce((s, r) => s + r.sivulatauksia, 0),
    sekunteja,
    keskiIstuntoSek: istuntoja > 0 ? Math.round(sekunteja / istuntoja) : 0,
  }
}

/*
 * Muutos edelliseen yhtä pitkään jaksoon. GA näyttää tämän jokaisen
 * luvun vieressä, ja se on koko sivun ainoa kohta joka kertoo suunnan.
 * Nollasta kasvu on ääretön, joten se palautetaan null:ina eikä
 * prosenttina.
 */
export function muutosProsentti(nyt: number, ennen: number): number | null {
  if (ennen === 0) return null
  return Math.round(((nyt - ennen) / ennen) * 100)
}
