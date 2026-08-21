import type { Contact } from "@/lib/projects/contacts"

/*
 * YHTEYSHENKILÖT HILMAN ILMOITUKSESTA.
 *
 * 160 asiakkaille näkyvää Hilma-hanketta oli ilman yhteystietoa, vaikka
 * eForms-ilmoituksen organisaatiolohkossa on nimi, sähköposti ja puhelin.
 * Mitattu 22.8.2026 neljälläkymmenellä ilmoituksella: sähköposti ja
 * puhelin löytyivät 80 %:lta, nimi 53 %:lta.
 *
 * Sama haku kuin suorituspaikalla (D-092) — ei uutta lähdettä, vain lisää
 * kenttiä samasta vastauksesta.
 *
 * ROOLI ON LUETTAVA, EI ARVATTAVA. Ilmoituksessa on tyypillisesti neljä
 * organisaatiota, ja vain kaksi niistä on hankkeen osapuolia:
 *
 *   ORG-0001  TVT Asunnot Oy      marko.heininen@tvt.fi        <- tilaaja
 *   ORG-0002  Hansel Oy (Hilma)   tekninen@hankintail…         <- eSender
 *   ORG-0003  Markkinaoikeus      markkinaoikeus@oikeus.fi     <- muutoksenhaku
 *   ORG-0004  R.V. Group Oy       artturi.silantera@rvgroup.fi <- voittaja
 *
 * Ensimmäinen mittaus otti ensimmäisen löytyneen osoitteen ja väitti
 * kattavuudeksi 100 %. Neljässä kymmenestä se oli Hilman oma tukipalvelu
 * tai markkinaoikeus — osoitteita jotka olisivat menneet asiakkaalle
 * myyntikontaktina.
 *
 * TILAAJA JA VOITTAJA EROTETAAN, koska ne tarkoittavat myyjälle eri
 * asiaa: tilaajaan otetaan yhteyttä ennen kilpailutusta, voittajaan sen
 * jälkeen aliurakoista.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const TIMEOUT_MS = 8000

export type HilmaContact = Contact & { role: "buyer" | "winner" }

const arvo = (x: any): string | null => {
  if (x == null) return null
  if (typeof x === "string") return x.trim() || null
  if (Array.isArray(x)) return arvo(x[0])
  if (typeof x === "object") return arvo(x.value)
  return String(x)
}

/*
 * Sama kentta on eForms-vastauksessa valilla taulukko ja valilla objekti:
 * `contractingParty[].party.partyIdentification` on taulukko, mutta
 * `organizations.organization[].company.partyIdentification` on objekti.
 * Mitattu 22.8.2026 - ensimmainen versio luki vain taulukkomuodon ja
 * palautti nolla yhteystietoa kaikista 25 testatusta ilmoituksesta.
 */
const first = (x: any): any => (Array.isArray(x) ? x[0] : x)

function orgId(node: any): string | null {
  return arvo(first(node)?.id) ?? null
}

export function parseHilmaContacts(eForm: any): HilmaContact[] {
  if (!eForm) return []

  const ext = eForm?.ublExtensions?.[0]?.extensionContent?.eformsExtension
  const orgs: any[] = ext?.organizations?.organization ?? []
  if (!orgs.length) return []

  const tilaaja = orgId(first(eForm?.contractingParty)?.party?.partyIdentification)

  const voittajat = new Set<string>()
  const tarjoajat = ext?.noticeResult?.tenderingParty
  for (const tp of Array.isArray(tarjoajat) ? tarjoajat : tarjoajat ? [tarjoajat] : []) {
    const tenderer = tp?.tenderer
    for (const t of Array.isArray(tenderer) ? tenderer : tenderer ? [tenderer] : []) {
      const id = orgId(t)
      if (id) voittajat.add(id)
    }
  }

  const tulos: HilmaContact[] = []

  for (const o of orgs) {
    const company = o?.company ?? {}
    const id = arvo(first(company?.partyIdentification)?.id)
    if (!id) continue

    const role: HilmaContact["role"] | null =
      id === tilaaja ? "buyer" : voittajat.has(id) ? "winner" : null

    /* eSender ja muutoksenhakuelin eivät ole hankkeen osapuolia. */
    if (!role) continue

    const contact = company?.contact ?? o?.touchPoint?.contact ?? {}
    const email = arvo(contact?.electronicMail)
    const phone = arvo(contact?.telephone)
    const name = arvo(contact?.name)
    const organization = arvo(first(company?.partyName)?.name)

    if (!email && !phone) continue

    tulos.push({
      name,
      title: null,
      organization,
      email: email ?? "",
      phone,
      kind: name ? "person" : "organization",
      role,
    })
  }

  /* Tilaaja ensin: hänelle soitetaan ennen kilpailutusta. */
  return tulos.sort((a, b) => (a.role === b.role ? 0 : a.role === "buyer" ? -1 : 1))
}

export function hilmaNoticeApiUrl(procedureId: string, noticeId: string): string {
  return `https://www.hankintailmoitukset.fi/web/api/public/procedure/${encodeURIComponent(
    procedureId
  )}/enotice/${encodeURIComponent(noticeId)}`
}

/*
 * Koko eForm-dokumentti yhdella haulla.
 *
 * Sama vastaus sisaltaa seka suorituspaikan (D-092) etta yhteyshenkilot,
 * joten resolverin ei pida hakea sita kahdesti.
 */
export async function fetchHilmaEForm(
  procedureId: unknown,
  noticeId: unknown
): Promise<any | null> {
  const procedure = String(procedureId ?? "").trim()
  const notice = String(noticeId ?? "").trim()
  if (!procedure || !notice) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(hilmaNoticeApiUrl(procedure, notice), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    })
    if (!response.ok) return null

    const json = await response.json()
    return json?.eForm ?? null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/*
 * Palauttaa tyhjän myös virhetilanteessa: yhteystieto on lisätieto, eikä
 * sen hakeminen saa kaataa ilmoituksen käsittelyä.
 */
export async function fetchHilmaContacts(
  procedureId: unknown,
  noticeId: unknown
): Promise<HilmaContact[]> {
  const procedure = String(procedureId ?? "").trim()
  const notice = String(noticeId ?? "").trim()
  if (!procedure || !notice) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(hilmaNoticeApiUrl(procedure, notice), {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: controller.signal,
    })
    if (!response.ok) return []

    const json = await response.json()
    return parseHilmaContacts(json?.eForm)
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}
