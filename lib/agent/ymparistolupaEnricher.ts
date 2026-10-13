import {
  asianTunnus,
  kuvausAsiakirjasta,
  valitseAsiakirja,
  type Asiakirja,
} from "./ymparistolupaAsiakirja"

/*
 * YMPÄRISTÖLUPAHANKKEEN RIKASTIN.
 *
 * Perustelu ja mittaukset: lib/agent/ymparistolupaAsiakirja.ts. Lyhyesti:
 * hakurajapinta antaa vain otsikon ja hakijan, jolloin jonorivin kuvaus
 * oli 79 merkkiä ja hyväksymisaste 47 % — YVA-lähteellä, jolla rikastin
 * on, 85 %. Tämä hakee asian asiakirjan ja poimii siitä kuvauksen.
 *
 * Kaksi rajapintakutsua ja yksi tiedosto per ehdokas, ja ehdokkaita on
 * muutama ajossa. Siksi tässä ei ole välimuistia eikä rinnakkaisuutta:
 * ne olisivat monimutkaisuutta ilman mitattua tarvetta.
 */

const API = "https://ytietopalvelu.lvv.fi/api/v1"

/*
 * Asia siirtyi 1.1.2026 aluehallintovirastolta Lupa- ja valvonta-
 * virastolle, ja asiakirjat jäivät UUDELLE diaarinumerolle. Vanha asia
 * näyttää siksi tyhjältä ("Ei toimenpiteitä") vaikka päätös on olemassa:
 * se löytyy `caseReferences`-kentän takaa. Ilman tätä haaraa puolet
 * asioista jäisi ilman kuvausta.
 */
async function haeAsiakirjat(tunnus: string): Promise<Asiakirja[]> {
  const omat = await haeToimenpiteet(tunnus)
  if (omat.length > 0) return omat

  const asia = await haeJson(`${API}/cases/${tunnus}`)
  const viitteet: any[] = Array.isArray(asia?.caseReferences) ? asia.caseReferences : []

  for (const viite of viitteet) {
    if (!viite?.id) continue
    const asiakirjat = await haeToimenpiteet(String(viite.id))
    if (asiakirjat.length > 0) return asiakirjat
  }

  return []
}

async function haeToimenpiteet(tunnus: string): Promise<Asiakirja[]> {
  const toimenpiteet = await haeJson(`${API}/cases/actions/${tunnus}`)
  if (!Array.isArray(toimenpiteet)) return []
  return toimenpiteet.flatMap((t: any) =>
    Array.isArray(t?.documents) ? (t.documents as Asiakirja[]) : []
  )
}

async function haeJson(url: string): Promise<any> {
  try {
    const vastaus = await fetch(url, {
      cache: "no-store",
      headers: { accept: "application/json" },
    })
    if (!vastaus.ok) return null
    return await vastaus.json()
  } catch {
    return null
  }
}

/*
 * Päätösasiakirja voi olla 5,7 Mt ja 69 sivua. Raja on reilusti sen
 * yli mutta estää sen, että yksi liiteniteiden kokoinen tiedosto
 * söisi koko ajobudjetin.
 */
const SUURIN_TIEDOSTO_TAVUA = 12 * 1024 * 1024

async function lueTeksti(attachmentId: number | string): Promise<string | null> {
  try {
    const vastaus = await fetch(`${API}/documents/attachment/${attachmentId}`, {
      cache: "no-store",
    })
    if (!vastaus.ok) return null

    const puskuri = Buffer.from(await vastaus.arrayBuffer())
    if (puskuri.length > SUURIN_TIEDOSTO_TAVUA) return null
    /* Vain PDF; rajapinta palauttaa virhetilanteessa HTML-sivun. */
    if (puskuri.subarray(0, 5).toString("latin1") !== "%PDF-") return null

    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as any
    const tulos = await pdfParse(puskuri)
    return String(tulos?.text ?? "") || null
  } catch {
    return null
  }
}

export function createYmparistolupaEnricher() {
  return async function enrichYmparistolupaCandidate(candidate: any) {
    const tunnus = asianTunnus(candidate?.source_url)
    if (!tunnus) return candidate

    const asiakirjat = await haeAsiakirjat(tunnus)
    const valittu = valitseAsiakirja(asiakirjat)
    if (!valittu) return candidate

    const teksti = await lueTeksti(valittu.attachmentId)
    if (!teksti) return candidate

    const kuvaus = kuvausAsiakirjasta(teksti)
    if (!kuvaus) return candidate

    /*
     * Alkuperäinen kuvaus ("Ympäristölupa-asia (diaarinro ...). Hakija:
     * ...") on pelkkä kuori, joten se korvataan. Diaarinumero säilyy
     * omassa kentässään, joten mitään ei menetetä.
     */
    return {
      ...candidate,
      description: kuvaus,
      ymparistolupa_asiakirja: valittu.name ?? null,
    }
  }
}
