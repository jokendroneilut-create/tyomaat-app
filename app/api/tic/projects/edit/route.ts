import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"
import { recordPhaseChange } from "@/lib/projects/recordPhaseChange"
import { normalizeLegacyPhase } from "@/lib/projects/phases"
import { computeManualExpiry } from "@/lib/projects/tenderExpiry"
import {
  cleanContacts,
  cleanString,
  toIsoDate,
  toPositiveNumber,
} from "@/lib/projects/editFields"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * HYVÄKSYTYN HANKKEEN KÄSIN MUOKKAUS (D-076).
 *
 * Tätä reittiä ei ollut olemassa. `projects`-tauluun kirjoittivat vain
 * approve, auto-complete, expire, duplikaattien piilotus ja agentin verify —
 * yhtään kenttäeditoria ei ollut, joten hyväksytyn hankkeen tietoja ei voinut
 * korjata millään sovelluspolulla.
 *
 * Se ei ollut pelkkä puuttuva mukavuus. Mitattu 15.8.2026: 221 asiakkaalle
 * näkyvää suunnittelu- tai rakentamisvaiheen hanketta on ilman rakennuttajaa
 * JA urakoitsijaa, eikä kukaan voinut täydentää niitä. Se selitti myös miksi
 * käsin syötetyt tiedot "katosivat": niitä ei ollut mihin tallentaa.
 *
 * KOLME SÄÄNTÖÄ, JOTKA OVAT KOKO REITIN PERUSTELU:
 *
 * 1. Metadata YHDISTETÄÄN, ei korvata. Metadatan ylikirjoittaminen on juuri
 *    se mekanismi jolla tietoa katoaa huomaamatta.
 * 2. Käsin syötetty arvo on vahvin. `cost_source: "manual"` voittaa sekä
 *    sopimusarvon että tekstipoiminnan (ks. `resolveProjectCost`), jottei
 *    ihmisen korjaus kumoudu seuraavalla ajolla.
 * 3. Muokkaus jättää jäljen: `updated_at`, `edited_at`, muokatut kentät ja
 *    vaiheen muutos historiaan. Ilman jälkeä kysymykseen "miksi tämä katosi"
 *    ei voi vastata ensi kerrallakaan.
 */

/* Kentät jotka saa korjata käsin. Muu vaatisi oman harkintansa. */
const TEXT_FIELDS = [
  "name",
  "city",
  "region",
  "location",
  "developer",
  "builder",
  "property_type",
  "additional_info",
  "estimated_completion",
] as const

/*
 * PERIAATE: kaikki mitä asiakas näkee, pitää voida korjata.
 *
 * Kentät alla lisättiin 25.8.2026, koska ne näkyvät asiakkaan
 * hankekortilla mutta niitä ei voinut muokata millään sovelluspolulla —
 * sama vika kuin D-076:ssa, vain eri kentissä.
 */
const NUMBER_FIELDS = ["apartments", "floor_area"] as const
const DATE_FIELDS = ["construction_start"] as const

export async function POST(request: Request) {
  const auth = await verifyAdminRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await request.json().catch(() => ({}))
  const projectId = body?.projectId

  if (!projectId) {
    return NextResponse.json(
      { ok: false, error: "Missing projectId" },
      { status: 400 }
    )
  }

  const { data: project, error: loadError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle()

  if (loadError) {
    return NextResponse.json({ ok: false, error: loadError.message }, { status: 500 })
  }

  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  const changed: string[] = []

  /*
   * NÄKYVYYS: piilota hanke asiakkailta tai palauta se näkyviin.
   *
   * Aiemmin tämä onnistui vain dashboardin kytkimestä, joka kirjoittaa
   * `is_public`in suoraan ilman perustelua ja ilman jälkeä. Piilotus on
   * kuitenkin päätös — "tämä ei ole hanke" — ja päätös ilman perustelua on
   * seuraavalle katsojalle arvoitus, aivan kuten D-076:n muokkausjälki.
   *
   * Perustelu on siksi PAKOLLINEN piilotettaessa. Näkyviin palauttaminen ei
   * vaadi sitä: virheen korjaamisen pitää olla helpompaa kuin sen tekemisen.
   */
  let hiddenReason: string | null = null

  if ("is_public" in (body?.fields ?? {})) {
    const next = body.fields.is_public === true

    if (!next && !cleanString(body?.reason)) {
      return NextResponse.json(
        { ok: false, error: "Piilottaminen vaatii perustelun (reason)" },
        { status: 400 }
      )
    }

    if (next !== (project as any).is_public) {
      updates.is_public = next
      changed.push("is_public")
      hiddenReason = next ? null : cleanString(body.reason)
    }
  }

  for (const field of TEXT_FIELDS) {
    if (!(field in (body?.fields ?? {}))) continue

    const raw = body.fields[field]
    /*
     * Tyhjä merkkijono on tarkoituksellinen tyhjennys, ei "ei muutosta" —
     * ilman tätä väärin poimittua arvoa ei saisi pois.
     */
    const next = raw === null || raw === "" ? null : cleanString(raw)

    if (next !== (project as any)[field]) {
      updates[field] = next
      changed.push(field)
    }
  }

  /* Kustannus: käsin syötetty voittaa aina, ja alkuperä merkitään. */
  let costSource: string | null = null
  if ("estimated_cost" in (body?.fields ?? {})) {
    const next = toPositiveNumber(body.fields.estimated_cost)
    if (Number(next ?? 0) !== Number((project as any).estimated_cost ?? 0)) {
      updates.estimated_cost = next
      changed.push("estimated_cost")
      costSource = next === null ? null : "manual"
    }
  }

  /*
   * Vaiheen käsimuutos SAA peruuttaa taaksepäin. Tuonnissa se on kielletty
   * (`phaseAdvances`), koska vanhentunut ilmoitus ei saa siirtää hanketta
   * väärään suuntaan — mutta ihmisen korjaus on nimenomaan sitä varten että
   * kone luki väärin.
   */
  let phaseChangedFrom: string | null = null
  if ("phase" in (body?.fields ?? {})) {
    const nextPhase = cleanString(body.fields.phase)

    if (nextPhase && !normalizeLegacyPhase(nextPhase)) {
      return NextResponse.json(
        { ok: false, error: `Tuntematon vaihe: ${nextPhase}` },
        { status: 400 }
      )
    }

    if (nextPhase !== (project as any).phase) {
      updates.phase = nextPhase
      changed.push("phase")
      phaseChangedFrom = (project as any).phase ?? null
    }
  }

  /* Luvut: asuntojen määrä ja kerrosala. */
  for (const field of NUMBER_FIELDS) {
    if (!(field in (body?.fields ?? {}))) continue
    const next = toPositiveNumber(body.fields[field])
    if (Number(next ?? 0) !== Number((project as any)[field] ?? 0)) {
      updates[field] = next
      changed.push(field)
    }
  }

  /* Päivämäärät: rakentamisen aloitus. */
  for (const field of DATE_FIELDS) {
    if (!(field in (body?.fields ?? {}))) continue
    const raw = body.fields[field]
    const next = raw === null || raw === "" ? null : toIsoDate(raw)

    if (raw !== null && raw !== "" && next === null) {
      return NextResponse.json(
        { ok: false, error: `Kelvoton päivämäärä (odotettiin YYYY-MM-DD): ${String(raw)}` },
        { status: 400 }
      )
    }

    const nykyinen = String((project as any)[field] ?? "").slice(0, 10) || null
    if (next !== nykyinen) {
      updates[field] = next
      changed.push(field)
    }
  }

  /*
   * Metadataan menevät kentät. Nämä eivät ole sarakkeita, joten ne
   * kerätään erikseen ja liitetään metadatan yhdistämiseen alempana.
   */
  const metaUpdates: Record<string, any> = {}
  const nykyinenMeta = ((project as any).metadata ?? {}) as Record<string, any>

  /*
   * VANHENEMISPÄIVÄ. Hyväksynnässä on ruksi "aseta vanhenemaan", mutta
   * jos se unohtuu, päivää ei voinut asettaa jälkikäteen millään.
   *
   * "auto" laskee saman säännön mukaan kuin hyväksyntä
   * (`computeManualExpiry`), jottei synny kahta erilaista laskentaa.
   */
  if ("expire_at" in (body?.fields ?? {})) {
    const raw = body.fields.expire_at
    let next: string | null

    if (raw === null || raw === "") next = null
    else if (raw === "auto") next = computeManualExpiry(nykyinenMeta, (project as any).created_at ?? null)
    else {
      const paiva = toIsoDate(raw)
      if (!paiva) {
        return NextResponse.json(
          { ok: false, error: `Kelvoton vanhenemispäivä: ${String(raw)}` },
          { status: 400 }
        )
      }
      next = new Date(`${paiva}T00:00:00Z`).toISOString()
    }

    if ((next ?? null) !== (nykyinenMeta.expire_at ?? null)) {
      metaUpdates.expire_at = next
      changed.push("expire_at")
    }
  }

  /* Yhteystiedot: ainoa paikka jossa väärin poimitun voi korjata käsin. */
  if ("contact_persons" in (body?.fields ?? {})) {
    const next = cleanContacts(body.fields.contact_persons)
    if (next === null) {
      return NextResponse.json(
        { ok: false, error: "contact_persons pitää olla lista" },
        { status: 400 }
      )
    }
    if (JSON.stringify(next) !== JSON.stringify(nykyinenMeta.contact_persons ?? [])) {
      metaUpdates.contact_persons = next
      changed.push("contact_persons")
    }
  }

  if (!changed.length) {
    return NextResponse.json({ ok: true, changed: [], message: "Ei muutoksia" })
  }

  const nowIso = new Date().toISOString()

  const { error: updateError } = await supabaseAdmin
    .from("projects")
    .update({
      ...updates,
      /*
       * `projects`-taulussa EI OLE `updated_at`-saraketta (todettu
       * 15.8.2026 kun tämä reitti kaatui siihen). Muokkausaika kirjataan
       * siksi metadataan. Sama havainto kumosi päätelmän "riviä ei ole
       * koskaan päivitetty" — tyhjä `updated_at` ei todistanut mitään,
       * koska kenttää ei ollut olemassa.
       */
      /*
       * Metadata yhdistetään olemassa olevan päälle, ei korvata (sääntö 1).
       */
      metadata: {
        ...((project as any).metadata ?? {}),
        ...(costSource ? { cost_source: costSource } : {}),
        /* Metadataan menevat kasin muokatut kentat (expire_at, yhteystiedot). */
        ...metaUpdates,
        ...("additional_info" in updates
          ? { description: updates.additional_info }
          : {}),
        ...("property_type" in updates
          ? { building_type: updates.property_type }
          : {}),
        ...("is_public" in updates
          ? updates.is_public
            ? { hidden_at: null, hidden_reason: null, unhidden_at: nowIso }
            : { hidden_at: nowIso, hidden_reason: hiddenReason }
          : {}),
        edited_at: nowIso,
        edited_fields: changed,
      },
    })
    .eq("id", projectId)

  if (updateError) {
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 })
  }

  /*
   * Vaihehistoria kirjataan samalla tavalla kuin koneen tekemistä
   * muutoksista, jotta hankkeen aikajana pysyy yhtenäisenä.
   */
  if ("phase" in updates) {
    try {
      await recordPhaseChange({
        supabase: supabaseAdmin,
        projectId,
        newPhase: updates.phase as string | null,
        previousPhase: phaseChangedFrom,
        source: "dashboard_admin",
        reason: "Käsin korjattu (TIC)",
      })
    } catch (error: any) {
      console.error("edit: vaihehistorian kirjaus epäonnistui:", error?.message ?? error)
    }
  }

  return NextResponse.json({ ok: true, projectId, changed })
}
