import * as cheerio from "cheerio"

import { expandPlaceholderEmail, isPersonName } from "@/lib/agent/vaylaContacts"
import type { Contact } from "@/lib/projects/contacts"

/*
 * SENAATIN KILPAILUTUSKALENTERI.
 *
 * MIKSI TÄMÄ ON ERI ASIA KUIN MUUT LÄHTEET. Kaikki 307 nykyistä lähdettä
 * kertovat jostain mikä on jo tapahtunut: kaava on vireillä, lupa on
 * myönnetty, kilpailutus on julkaistu. Tämä kertoo kilpailutuksesta joka
 * on vasta tulossa — sarake on "Ennakoitu julkaisuajankohta", ja mitattu
 * 22.8.2026 se ulottui neljänneksestä kahteen vuoteen eteenpäin:
 *
 *   2026/Q2  4     2027/Q1  8
 *   2026/Q3 26     2027/Q2  4
 *   2026/Q4 12     2027/Q3  3     2027/Q4 1     2028/Q2 2
 *
 * Se osuu suoraan toiseen kolmesta konversioesteestä ("liian myöhään",
 * ks. docs/00_PRODUCT_BLUEPRINT.md 1.1). Hilma kertoo kilpailutuksesta
 * kun se julkaistaan; tämä 1–8 neljännestä aiemmin.
 *
 * VOLYYMI ON PIENI JA SE ON OK. 60 riviä, joista 15 rakentamista. Arvo
 * on ajoituksessa, ei määrässä.
 *
 * ENNUSTE, EI LUPAUS. Rivi voi siirtyä tai peruuntua. Siksi vaihe on aina
 * "Suunnitteilla" eikä kilpailutusta väitetä varmaksi, ja ajankohta
 * kirjataan sellaisena kuin Senaatti sen ilmoittaa ("2027/Q1") eikä
 * muunneta päivämääräksi jota ei ole olemassa.
 */

const CALENDAR_URL = "https://www.senaatti.fi/tietoa-meista/hankinnat/kilpailutuskalenteri/"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const TIMEOUT_MS = 15000

export type TenderRow = {
  /* Kilpailutuksen nimi sellaisena kuin Senaatti sen kirjoittaa. */
  title: string
  category: string | null
  /* "2027/Q1" — neljännes, ei päivämäärä. */
  expectedPublication: string | null
  /* "EU" tai "Kansallinen". */
  scope: string | null
  contacts: Contact[]
  moreInfo: string | null
}

/*
 * Vain rakentaminen. Kalenterissa on myös tietohallintoa, ylläpitoa ja
 * sisäisiä palveluita, jotka eivät ole työmaita.
 */
const RAKENTAMINEN = /(rakennuttaminen|rakentaminen|suunnittelu)/i

/*
 * Otsikko kertoo urakkalajin silloinkin kun kategoria on yleinen.
 * Mitattu 22.8.2026: "Purku-urakka, Vanhan Hiukkavaaran useita
 * rakennuksia" oli kategoriassa Rakennuttaminen, mutta myös
 * ylläpitokategoriassa on urakoita.
 */
const URAKKA_OTSIKOSSA =
  /(rakennusurakka|purku-?urakka|peruskorja|uudisrak|saneeraus|urakka|julkisivu|vesikatto|putkiremont)/i

export function isConstructionTender(row: {
  title: string
  category: string | null
}): boolean {
  return RAKENTAMINEN.test(String(row.category ?? "")) || URAKKA_OTSIKOSSA.test(row.title)
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/

/*
 * Yhteystietosolussa on joko henkilön nimi ("Hanna Hagelberg",
 * "Yhteyshenkilö: Mikael Nieminen") tai laatikko ("kilpailutus@senaatti.fi").
 *
 * Nimestä johdetaan osoite Senaatin omalla mallilla — sama sääntö kuin
 * Väylävirastolla (D-103) ja Senaatin hankesivuilla: organisaation itse
 * ilmoittama muoto, ei arvaus.
 */
export function parseTenderContact(cellText: string): Contact[] {
  const teksti = String(cellText ?? "").replace(/\s+/g, " ").trim()
  if (!teksti) return []

  const suora = teksti.match(EMAIL_RE)?.[0] ?? null
  if (suora) {
    return [
      {
        name: null,
        title: null,
        organization: "Senaatti-kiinteistöt",
        email: suora.toLowerCase(),
        phone: null,
        kind: "organization",
      },
    ]
  }

  const nimi = teksti.replace(/^\s*Yhteyshenkilöt?\s*:\s*/i, "").trim()
  if (!isPersonName(nimi)) return []

  const email = expandPlaceholderEmail("etunimi.sukunimi@senaatti.fi", nimi)
  if (!email) return []

  return [
    {
      name: nimi,
      title: null,
      organization: "Senaatti-kiinteistöt",
      email,
      phone: null,
      kind: "person",
    },
  ]
}

export function parseTenderCalendar(html: string): TenderRow[] {
  const $ = cheerio.load(html)
  const rows: TenderRow[] = []

  $("table.tender-calendar tbody tr").each((_, el) => {
    const solut = $(el)
      .find("td")
      .map((__, td) => $(td).text().replace(/\s+/g, " ").trim())
      .get()

    if (solut.length < 5) return

    const title = solut[0]
    if (!title) return

    rows.push({
      title,
      category: solut[1] || null,
      expectedPublication: solut[2] || null,
      scope: solut[3] || null,
      contacts: parseTenderContact(solut[4]),
      moreInfo: solut[5] || null,
    })
  })

  return rows
}

/*
 * Palauttaa tyhjän myös virhetilanteessa: yhden lähteen kaatuminen ei saa
 * kaataa koko keräysajoa.
 */
export async function fetchTenderCalendar(): Promise<TenderRow[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(CALENDAR_URL, {
      headers: { "User-Agent": UA },
      signal: controller.signal,
      cache: "no-store",
    })
    if (!response.ok) return []

    return parseTenderCalendar(await response.text())
  } catch {
    return []
  } finally {
    clearTimeout(timer)
  }
}

export const SENAATTI_TENDER_CALENDAR_URL = CALENDAR_URL
