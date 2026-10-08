import { normalizeLegacyPhase, phaseOrder } from "@/lib/projects/phases"

import { hankkeenYritykset, type YritysRooli } from "./hankkeenYritykset"
import { yritysavain } from "./yritysavain"

/*
 * YRITYSVERKOSTO ADMINILLE (D-253).
 *
 * Johannes 8.10.2026: *"tee sellainen nakyma jolla voimme avata
 * yrityksen ja nahda keta siella toimii ja heidan yhteystiedot seka
 * hankkeet joihin he ovat osallistuneet meidan tietojen mukaan."*
 *
 * Yritys on mukana jos se on rekisterissa TAI jossain hankkeessa
 * rakennuttajana, paaurakoitsijana tai osapuolena. Ryhmittely tehdaan
 * samalla `yritysavain`illa kuin rekisterin liitos, joten naky vastaa
 * sita mita asiakas saa — myos sen virheet (ks. D-252, "Pohjola
 * Rakennus Oy Suomi").
 *
 * Hankkeen yhteyshenkilot (`metadata.contact_persons`) liitetaan
 * yritykseen organisaation nimen avaimella. Henkilo ei tuo yritysta
 * listalle yksinaan: kunnan rakennustarkastaja on kunnan ihminen,
 * mutta kunta on listalla vain jos se on hankkeen osapuoli.
 *
 * Kaikki tassa on puhdasta laskentaa. Kannan luku on
 * `lib/admin/yritysverkostoData.ts`:ssa.
 */

export type VerkostoHanke = {
  id: string
  developer?: string | null
  builder?: string | null
  related_companies?: unknown
  aliurakoitsijat?: unknown
  contact_persons?: unknown
}

export type RekisteriRivi = {
  avain: string
  yritys: string
  nimi: string
  nimike: string | null
  email: string | null
  puhelin: string | null
  lahde: string | null
}

export type YrityksenHanke = {
  projectId: string
  rooli: YritysRooli
  tyo: string | null
}

export type HankkeenHenkilo = {
  nimi: string
  nimike: string | null
  email: string | null
  puhelin: string | null
  projectId: string
  viranomainen: boolean
}

export type VerkostoYritys = {
  avain: string
  /* Yleisin kirjoitusasu. */
  nimi: string
  rekisteri: RekisteriRivi[]
  hankehenkilot: HankkeenHenkilo[]
  hankkeet: YrityksenHanke[]
  rooleittain: Record<YritysRooli, number>
  /* Eri hankkeiden maara — sama hanke kahdessa roolissa lasketaan kerran. */
  hankkeita: number
  /* Eri ihmisten maara rekisterista ja hankkeilta yhteensa. */
  henkiloita: number
}

function teksti(arvo: unknown): string | null {
  if (typeof arvo !== "string") return null
  const t = arvo.trim()
  return t ? t : null
}

function uusi(avain: string): VerkostoYritys {
  return {
    avain,
    nimi: avain,
    rekisteri: [],
    hankehenkilot: [],
    hankkeet: [],
    rooleittain: { rakennuttaja: 0, paaurakoitsija: 0, osapuoli: 0 },
    hankkeita: 0,
    henkiloita: 0,
  }
}

export function kokoaYritykset(
  hankkeet: VerkostoHanke[],
  rekisteri: RekisteriRivi[]
): Map<string, VerkostoYritys> {
  const yritykset = new Map<string, VerkostoYritys>()
  const nimet = new Map<string, Map<string, number>>()
  const hae = (avain: string) => {
    let y = yritykset.get(avain)
    if (!y) {
      y = uusi(avain)
      yritykset.set(avain, y)
      nimet.set(avain, new Map())
    }
    return y
  }
  const laskeNimi = (avain: string, nimi: string, paino = 1) => {
    const laskuri = nimet.get(avain)!
    laskuri.set(nimi, (laskuri.get(nimi) ?? 0) + paino)
  }

  for (const rivi of rekisteri) {
    const avain = String(rivi.avain ?? "").trim()
    if (!avain) continue
    const y = hae(avain)
    if (y.rekisteri.length === 0) laskeNimi(avain, String(rivi.yritys).trim())
    y.rekisteri.push(rivi)
  }

  const hankkeetPerYritys = new Map<string, Set<string>>()
  for (const hanke of hankkeet) {
    const id = String(hanke.id)
    const roolit = hankkeenYritykset({
      developer: hanke.developer,
      builder: hanke.builder,
      metadata: {
        related_companies: hanke.related_companies,
        aliurakoitsijat: hanke.aliurakoitsijat,
      },
    })
    for (const r of roolit) {
      const y = hae(r.avain)
      laskeNimi(r.avain, r.nimi)
      y.hankkeet.push({ projectId: id, rooli: r.rooli, tyo: r.tyo })
      y.rooleittain[r.rooli] += 1
      const joukko = hankkeetPerYritys.get(r.avain) ?? new Set<string>()
      joukko.add(id)
      hankkeetPerYritys.set(r.avain, joukko)
    }
  }

  /*
   * Hankkeen henkilot vasta kun yritykset ovat tiedossa: henkilo
   * liitetaan olemassa olevaan yritykseen, se ei luo uutta.
   */
  for (const hanke of hankkeet) {
    if (!Array.isArray(hanke.contact_persons)) continue
    for (const k of hanke.contact_persons as Record<string, unknown>[]) {
      if (!k || typeof k !== "object") continue
      /* Rekisterista kopioitu rivi ei ole hankkeen oma henkilo (D-241). */
      if (k.level === "company") continue
      const nimi = teksti(k.name)
      const organisaatio = teksti(k.organization)
      if (!nimi || !organisaatio) continue
      const y = yritykset.get(yritysavain(organisaatio))
      if (!y) continue
      y.hankehenkilot.push({
        nimi,
        nimike: teksti(k.title),
        email: teksti(k.email),
        puhelin: teksti(k.phone),
        projectId: String(hanke.id),
        viranomainen: k.role === "authority",
      })
    }
  }

  for (const [avain, y] of yritykset) {
    let paras = y.nimi
    let parasLuku = 0
    for (const [nimi, luku] of nimet.get(avain)!) {
      if (nimi && luku > parasLuku) {
        paras = nimi
        parasLuku = luku
      }
    }
    y.nimi = paras
    y.hankkeita = hankkeetPerYritys.get(avain)?.size ?? 0
    y.henkiloita = yrityksenHenkilot(y).length
  }

  return yritykset
}

/*
 * YKSI HENKILO KERRAN. Sama ihminen esiintyy rekisterissa ja usealla
 * hankkeella; tunnisteena sahkoposti jos on, muuten nimi. Rekisterin
 * rivi on pohja, ja hankkeet joilla han esiintyy kertyvat sen alle.
 */
export type YrityksenHenkilo = {
  nimi: string
  nimike: string | null
  email: string | null
  puhelin: string | null
  /* Rekisterin `lahde`; null jos henkilo on vain hankkeilta. */
  lahde: string | null
  rekisterissa: boolean
  viranomainen: boolean
  hankkeilta: string[]
}

function henkilonTunniste(nimi: string, email: string | null): string {
  return email ? `e:${email.toLowerCase()}` : `n:${nimi.toLowerCase().replace(/\s+/g, " ")}`
}

export function yrityksenHenkilot(
  y: Pick<VerkostoYritys, "rekisteri" | "hankehenkilot">
): YrityksenHenkilo[] {
  const tulos: YrityksenHenkilo[] = []
  const tunnisteet = new Map<string, YrityksenHenkilo>()
  const nimella = new Map<string, YrityksenHenkilo>()

  const lisaa = (h: YrityksenHenkilo, projectId: string | null) => {
    const avain = henkilonTunniste(h.nimi, h.email)
    const nimiAvain = henkilonTunniste(h.nimi, null)
    /* Sahkopostiton rivi osuu samannimiseen jolla sahkoposti on. */
    const olemassa = tunnisteet.get(avain) ?? (h.email ? undefined : nimella.get(nimiAvain))
    if (olemassa) {
      olemassa.nimike ??= h.nimike
      olemassa.email ??= h.email
      olemassa.puhelin ??= h.puhelin
      if (projectId && !olemassa.hankkeilta.includes(projectId)) olemassa.hankkeilta.push(projectId)
      return
    }
    const uusiHenkilo = { ...h, hankkeilta: projectId ? [projectId] : [] }
    tulos.push(uusiHenkilo)
    tunnisteet.set(avain, uusiHenkilo)
    if (!nimella.has(nimiAvain)) nimella.set(nimiAvain, uusiHenkilo)
  }

  for (const r of y.rekisteri) {
    lisaa(
      {
        nimi: String(r.nimi).trim(),
        nimike: teksti(r.nimike),
        email: teksti(r.email),
        puhelin: teksti(r.puhelin),
        lahde: teksti(r.lahde),
        rekisterissa: true,
        viranomainen: false,
        hankkeilta: [],
      },
      null
    )
  }
  for (const h of y.hankehenkilot) {
    lisaa(
      {
        nimi: h.nimi,
        nimike: h.nimike,
        email: h.email,
        puhelin: h.puhelin,
        lahde: null,
        rekisterissa: false,
        viranomainen: h.viranomainen,
        hankkeilta: [],
      },
      h.projectId
    )
  }

  return tulos
}

/*
 * HAKU JA JARJESTYS. Haku osuu nakyvaan nimeen tai avaimeen, joten
 * "YIT Suomi Oy" loytaa myos rivin jonka yleisin nimi on "YIT".
 * Jarjestys: eniten hankkeita ensin.
 */
export function suodataYritykset(
  yritykset: Iterable<VerkostoYritys>,
  haku: string | null | undefined
): VerkostoYritys[] {
  const q = String(haku ?? "").trim().toLowerCase()
  const qAvain = yritysavain(q)
  const lista = [...yritykset].filter(
    (y) =>
      !q ||
      y.nimi.toLowerCase().includes(q) ||
      (qAvain.length > 0 && y.avain.includes(qAvain))
  )
  return lista.sort(
    (a, b) =>
      b.hankkeita - a.hankkeita ||
      b.henkiloita - a.henkiloita ||
      a.nimi.localeCompare(b.nimi, "fi")
  )
}

/* ---------------------------------------------------------------- */

export type ProjektinTiedot = {
  id: string
  name: string | null
  city: string | null
  phase: string | null
  status: string | null
  is_public: boolean | null
  estimated_completion: string | null
}

export type RyhmanRivi = ProjektinTiedot & {
  tyo: string | null
  valmistunut: boolean
}

export type Rooliryhma = {
  rooli: YritysRooli
  otsikko: string
  rivit: RyhmanRivi[]
}

export const ROOLIN_OTSIKKO: Record<YritysRooli, string> = {
  rakennuttaja: "Rakennuttaja",
  paaurakoitsija: "Pääurakoitsija",
  osapuoli: "Osapuoli",
}

const ROOLIEN_JARJESTYS: YritysRooli[] = ["rakennuttaja", "paaurakoitsija", "osapuoli"]

export function onValmistunut(p: Pick<ProjektinTiedot, "status" | "phase">): boolean {
  return p.status === "completed" || normalizeLegacyPhase(p.phase) === "completed"
}

/*
 * Hankkeet rooleittain. Kaynnissa olevat ensin pisimmalle edenneesta
 * alkaen (Rakenteilla ennen Kaavoitusta), valmistuneet ryhman loppuun:
 * ne kertovat verkostosta, mutta myyjalle ne ovat historiaa.
 */
export function ryhmitteleHankkeet(
  hankkeet: YrityksenHanke[],
  tiedot: Map<string, ProjektinTiedot>
): Rooliryhma[] {
  return ROOLIEN_JARJESTYS.map((rooli) => {
    const rivit: RyhmanRivi[] = []
    const nahty = new Set<string>()
    for (const h of hankkeet) {
      if (h.rooli !== rooli || nahty.has(h.projectId)) continue
      const t = tiedot.get(h.projectId)
      if (!t) continue
      nahty.add(h.projectId)
      rivit.push({ ...t, tyo: h.tyo, valmistunut: onValmistunut(t) })
    }
    rivit.sort(
      (a, b) =>
        Number(a.valmistunut) - Number(b.valmistunut) ||
        (phaseOrder(b.phase) ?? 0) - (phaseOrder(a.phase) ?? 0) ||
        String(a.name ?? "").localeCompare(String(b.name ?? ""), "fi")
    )
    return { rooli, otsikko: ROOLIN_OTSIKKO[rooli], rivit }
  }).filter((r) => r.rivit.length > 0)
}

/* "2027-06-30" -> "6/2027". Muu muoto sellaisenaan. */
export function valmistumisKuukausi(arvo: string | null | undefined): string | null {
  const m = String(arvo ?? "").match(/^(\d{4})-(\d{2})/)
  if (m) return `${Number(m[2])}/${m[1]}`
  return teksti(arvo)
}
