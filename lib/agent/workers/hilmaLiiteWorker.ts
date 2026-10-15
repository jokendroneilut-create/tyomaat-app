import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
import { haeKaavaselostuksenTeksti } from "@/lib/agent/kaavanKuvaus"
import {
  jasennaLiitteet,
  liiteUrl,
  liiteluettelonOsoite,
  urakanLaajuus,
  valitseLiite,
} from "@/lib/agent/hilmaLiitteet"

/*
 * HILMAN TARJOUSASIAKIRJA OMANA VAIHEENA (D-291).
 *
 * MIKSI OMA VAIHE. Tämä on verkkotyötä — rajapintakutsu ja PDF:n purku,
 * mitattuna noin 4 sekuntia ilmoitusta kohden — eikä se kuulu
 * faktapoimintaan, joka on muuten puhdasta. Sama kuvio kuin putken
 * artikkeli- ja pdf-vaiheilla: oma katto per ajo, jotta hidas haku ei
 * syö lähdevaiheen budjettia.
 *
 * Vaihe ajetaan ENNEN faktoja, koska `extractHilmaFacts` liittää
 * `raw_payload.liiteteksti`-kentän kuvauksen perään.
 *
 * PORTTI: VAIN OHUET. Mitattu 15.10.2026: liite löytyy vain joka 25.
 * ohuelta rivillä, koska Hilmassa on asiakirjat vain jos ilmoitus on
 * tehty Hilmassa. Haku tehdään siksi vain kun ilmoituksen oma kuvaus on
 * ohut — muuten 24 turhaa hakua 25:stä koskisi rivejä joilla on jo
 * kuvaus.
 *
 * `liite_haettu` merkitään aina, myös kun liitettä ei ollut. Ilman sitä
 * sama 164 liitteetöntä riviä haettaisiin joka ajossa uudelleen.
 */

const OHUT_RAJA = 400
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const AIKAKATKAISU_MS = 20_000

export type HilmaLiiteTulos = {
  ok: boolean
  message: string
  documentId?: string
}

async function haeLiiteluettelo(pid: unknown, nid: unknown) {
  if (pid == null || nid == null) return null
  const ohjain = new AbortController()
  const kello = setTimeout(() => ohjain.abort(), AIKAKATKAISU_MS)
  try {
    const vastaus = await fetch(liiteluettelonOsoite(String(pid), String(nid)), {
      cache: "no-store",
      headers: { "user-agent": UA, accept: "application/json" },
      signal: ohjain.signal,
    })
    if (!vastaus.ok) return null
    return jasennaLiitteet(await vastaus.json())
  } catch {
    return null
  } finally {
    clearTimeout(kello)
  }
}

/*
 * Yksi dokumentti. Palauttaa aina `ok: true` jos merkintä onnistui —
 * puuttuva liite ei ole virhe vaan mitattu normaalitapaus.
 */
export async function processHilmaAttachment(documentId: string): Promise<HilmaLiiteTulos> {
  const { data: doc, error } = await supabaseAdmin
    .from("source_documents")
    .select("id, raw_payload")
    .eq("id", documentId)
    .maybeSingle()

  if (error) return { ok: false, message: `luku epäonnistui: ${error.message}`, documentId }
  if (!doc) return { ok: false, message: "dokumenttia ei löytynyt", documentId }

  const rp: any = doc.raw_payload ?? {}
  const notice = rp.original ?? {}

  /*
   * PORTTI ON TASSA, EI VALITSIMESSA. Jos paksu rivi vain ohitettaisiin
   * valitsimessa, se jaisi merkitsematta ja jono jumittaisi siihen joka
   * ajossa. Siksi ohitus merkitaan - ilman verkkohakua.
   */
  const omaKuvaus = String(notice.descriptionFi ?? notice.descriptionSv ?? "")
  if (omaKuvaus.length >= OHUT_RAJA || notice.procedureId == null) {
    const syy = notice.procedureId == null ? "ei procedureId" : "kuvaus riittava"
    const { error: ov } = await supabaseAdmin
      .from("source_documents")
      .update({
        raw_payload: { ...rp, liite_haettu: new Date().toISOString(), liite_ohitettu: syy },
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId)
    if (ov) return { ok: false, message: `kirjoitus epäonnistui: ${ov.message}`, documentId }
    return { ok: true, documentId, message: `ohitettu: ${syy}` }
  }

  const liitteet = await haeLiiteluettelo(notice.procedureId, rp.noticeId ?? notice.noticeId)
  const valittu = liitteet?.length ? valitseLiite(liitteet) : null

  let liiteteksti: string | null = null
  let liitenimi: string | null = null

  if (valittu) {
    const pdf = await haeKaavaselostuksenTeksti(liiteUrl(valittu.id))
    const laajuus = urakanLaajuus(pdf)
    if (laajuus) {
      liiteteksti = laajuus
      liitenimi = valittu.name
    }
  }

  const { error: kirjoitus } = await supabaseAdmin
    .from("source_documents")
    .update({
      raw_payload: {
        ...rp,
        /* Merkitään aina, ettei liitteetöntä riviä haeta joka ajossa. */
        liite_haettu: new Date().toISOString(),
        liitteita: liitteet?.length ?? 0,
        ...(liiteteksti ? { liiteteksti, liite_nimi: liitenimi } : {}),
      },
      /* Faktat uudelleen, jotta uusi kuvaus päätyy ehdokkaalle. */
      ...(liiteteksti ? { facts_extracted_at: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId)

  if (kirjoitus) return { ok: false, message: `kirjoitus epäonnistui: ${kirjoitus.message}`, documentId }

  return {
    ok: true,
    documentId,
    message: liiteteksti
      ? `liitteestä ${liiteteksti.length} merkkiä (${liitenimi})`
      : `ei liitetekstiä (${liitteet?.length ?? 0} liitettä)`,
  }
}

/*
 * Seuraava käsittelemätön Hilma-dokumentti. Järjestys on uusin ensin:
 * tuore kilpailutus on asiakkaalle arvokkaampi kuin vanha. Portti on
 * `processHilmaAttachment`issa, joka merkitsee myös ohitetun.
 */
export async function nextHilmaAttachmentDocument(): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("source_documents")
    .select("id")
    .eq("source_id", "hilma")
    .is("raw_payload->>liite_haettu", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  /* Tyhja tulos voi olla ohitettu virhe, joten virhe luetaan erikseen. */
  if (error) {
    console.error(`hilmaLiiteWorker: valinta epäonnistui: ${error.message}`)
    return null
  }
  return data?.id ?? null
}
