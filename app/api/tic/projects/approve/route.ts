import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { geocodeProjectLocation } from "@/lib/geo/geocode"
import {
  PHASE_LABELS,
  PHASE_KEYS_IN_ORDER,
  CANONICAL_PHASES,
  normalizeLegacyPhase,
} from "@/lib/projects/phases"
import { recordPhaseChange } from "@/lib/projects/recordPhaseChange"
import { getMunicipalityByName } from "@/lib/geo/municipalities"
import { inferMunicipalityFromText } from "@/lib/geo/inferMunicipalityFromText"
import {
  findByIdentifiers,
  linkIdentifier,
  type IdentifierType,
} from "@/lib/projects/identity"
import { findProjectMatchDetailed } from "@/lib/agent/projectMatcher"
import { verifyAdminRequest } from "@/lib/auth/verifyAdminRequest"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const auth = await verifyAdminRequest(request)
    if (!auth.ok) {
      return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const potentialProjectId = body.potentialProjectId

    if (!potentialProjectId) {
      return NextResponse.json(
        { ok: false, error: "Missing potentialProjectId" },
        { status: 400 }
      )
    }

    const { data: potentialProject, error: potentialError } =
      await supabaseAdmin
        .from("potential_projects")
        .select("*")
        .eq("id", potentialProjectId)
        .single()

    if (potentialError || !potentialProject) {
      return NextResponse.json(
        { ok: false, error: "Potential project not found" },
        { status: 404 }
      )
    }

    const metadata = potentialProject.metadata ?? {}

    const { data: sourceDocument, error: sourceDocumentError } =
      metadata.source_document_id
        ? await supabaseAdmin
            .from("source_documents")
            .select("document_url, source_name")
            .eq("id", metadata.source_document_id)
            .maybeSingle()
        : { data: null, error: null }

    if (sourceDocumentError) {
      throw sourceDocumentError
    }

    const sourceName =
      sourceDocument?.source_name ??
      metadata.source_name ??
      metadata.firstSourceName ??
      metadata.lastSourceName ??
      metadata.source ??
      null

    const isHilma =
      normalize(sourceName) === "hilma" ||
      normalize(metadata.resolver) === "hilmaresolver"

    const isLupapiste = normalize(metadata.resolver) === "lupapisteresolver"
    const isVantaaKaava = normalize(metadata.resolver) === "vantaakaavaresolver"
    const isHelsinkiKaava = normalize(metadata.resolver) === "helsinkikaavaresolver"
    const isTampereKaava = normalize(metadata.resolver) === "tamperekaavaresolver"
    const isTurkuKaava = normalize(metadata.resolver) === "turkukaavaresolver"
    const isKreate = normalize(metadata.resolver) === "kreateresolver"
    const isVayla = normalize(metadata.resolver) === "vaylaresolver"
    const isSenaatti = normalize(metadata.resolver) === "senaattiresolver"
    const isKuopioKaava = normalize(metadata.resolver) === "kuopiokaavaresolver"
    const isLahtiKaava = normalize(metadata.resolver) === "lahtikaavaresolver"
    const isPoriKaava = normalize(metadata.resolver) === "porikaavaresolver"
    const isOuluKaava = normalize(metadata.resolver) === "oulukaavaresolver"
    const isJyvaskylaKaava = normalize(metadata.resolver) === "jyvaskylakaavaresolver"
    const isHameenlinnaKaava = normalize(metadata.resolver) === "hameenlinnakaavaresolver"
    const isJoensuuKaava = normalize(metadata.resolver) === "joensuukaavaresolver"
    const isVaasaKaava = normalize(metadata.resolver) === "vaasakaavaresolver"

    const permitIdentifierType: IdentifierType = isHilma
      ? "hilma_notice_number"
      : isLupapiste
        ? "lupapiste_permit_number"
        : "espoo_permit_number"

    const candidateIdentifiers: {
      type: IdentifierType
      value: string | null | undefined
    }[] = [
      { type: permitIdentifierType, value: potentialProject.permit_number },
      { type: "property_id", value: potentialProject.property_id },
    ]

    if (isHilma) {
      candidateIdentifiers.push(
        { type: "hilma_notice_number", value: metadata.parent_notice_id },
        { type: "hilma_notice_number", value: metadata.linked_notices }
      )
    }

    if (isVantaaKaava) {
      candidateIdentifiers.push({
        type: "vantaa_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isHelsinkiKaava) {
      candidateIdentifiers.push({
        type: "helsinki_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isTampereKaava) {
      candidateIdentifiers.push({
        type: "tampere_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isTurkuKaava) {
      candidateIdentifiers.push({
        type: "turku_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isKuopioKaava) {
      candidateIdentifiers.push({
        type: "kuopio_kaava_tunnus",
        value: metadata.kaava_tunnus ?? metadata.record_number,
      })
    }

    if (isLahtiKaava) {
      candidateIdentifiers.push({
        type: "lahti_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isPoriKaava) {
      candidateIdentifiers.push({
        type: "pori_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isOuluKaava) {
      candidateIdentifiers.push({
        type: "oulu_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isJyvaskylaKaava) {
      candidateIdentifiers.push({
        type: "jyvaskyla_kaava_id",
        value: metadata.documents_url,
      })
    }

    if (isHameenlinnaKaava) {
      candidateIdentifiers.push({
        type: "hameenlinna_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isJoensuuKaava) {
      candidateIdentifiers.push({
        type: "joensuu_kaava_id",
        value: metadata.documents_url,
      })
    }

    if (isVaasaKaava) {
      candidateIdentifiers.push({
        type: "vaasa_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isKreate) {
      candidateIdentifiers.push({
        type: "kreate_project_id",
        value: metadata.kreate_post_id,
      })
    }

    if (isVayla) {
      candidateIdentifiers.push({
        type: "vayla_project_id",
        value: metadata.documents_url,
      })
    }

    if (isSenaatti) {
      candidateIdentifiers.push({
        type: "senaatti_project_id",
        value: metadata.senaatti_post_id,
      })
    }

    /*
     * Hilman potentialProject.address on tällä hetkellä yleensä
     * hankintayksikön toimisto-osoite, ei rakennuskohteen osoite.
     *
     * Sitä ei siksi saa käyttää karttasijaintina.
     */
    const buyerAddress = isHilma
      ? potentialProject.address ?? null
      : metadata.buyer_address ?? null

    const projectAddress = isHilma
      ? metadata.project_address ??
        metadata.site_address ??
        metadata.worksite_address ??
        null
      : potentialProject.address ?? null

    /*
     * Osa Hilma-ilmoituksista ei sisällä rakenteista kuntatietoa
     * lainkaan — kunta saattaa silti esiintyä otsikossa, kuvaus­
     * tekstissä tai rakennuttajan nimessä vapaana tekstinä (esim.
     * "Juva, tehtaan laajennus...", "Helsingin kaupungin ... Stara
     * pyytää..." tai rakennuttaja "Kotkan Julkiset Kiinteistöt Oy"),
     * joten se yritetään päätellä tekstistä ennen kuin sijainti jää
     * tyhjäksi.
     */
    const inferredMunicipality = isHilma
      ? inferMunicipalityFromText(
          [
            metadata.operation,
            potentialProject.title,
            metadata.description,
            metadata.developer,
          ]
            .filter(Boolean)
            .join(" ")
        )
      : null

    const city = isHilma
      ? metadata.project_municipality ??
        metadata.site_municipality ??
        potentialProject.municipality ??
        inferredMunicipality?.name ??
        null
      : potentialProject.municipality ?? null

    const region =
      metadata.region ??
      getMunicipalityByName(city)?.region ??
      inferredMunicipality?.region ??
      null

    const location = buildProjectLocation({
      address: projectAddress,
      city,
    })

    /*
     * Lupapiste antaa tarkat koordinaatit valmiiksi (ETRS-TM35FIN, muunnettu
     * WGS84:ksi jo tunnistusvaiheessa) — käytetään niitä suoraan sen sijaan
     * että osoite geokoodattaisiin uudelleen Nominatimin kautta.
     */
    const lupapisteCoords = metadata.lupapiste_coordinates_wgs84

    const coords =
      lupapisteCoords?.lat != null && lupapisteCoords?.lon != null
        ? { lat: lupapisteCoords.lat, lon: lupapisteCoords.lon }
        : location || city || region
          ? await geocodeProjectLocation({
              location,
              city,
              region,
            })
          : {
              lat: null,
              lon: null,
            }

    const sourceUrl =
      sourceDocument?.document_url ??
      metadata.source_url ??
      null

    const documentsUrl =
      metadata.documents_url ??
      metadata.document_url ??
      null

    const deadline =
      metadata.deadline ??
      null

    const developer =
      metadata.developer ??
      null

    const phase =
  metadata.phase_hint ??
  (isHilma
    ? PHASE_LABELS.tender
    : PHASE_LABELS.planning)

    const projectName = buildCustomerProjectName({
      potentialProject,
      isHilma,
      projectAddress,
    })

    function phaseOrder(rawPhase: string | null | undefined) {
      const key = normalizeLegacyPhase(rawPhase)
      if (!key) return null
      return CANONICAL_PHASES.find((p) => p.key === key)?.order ?? null
    }

    /*
     * Duplikaattitarkistus ennen uuden hankkeen luomista.
     * 1) Tarkka taso: tyypitetyt tunnisteet (project_identifiers), tai
     *    resolvePotentialProject.ts:n jo aiemmin löytämä osuma.
     * 2) Sumea varataso vain jos tarkka taso ei löydä mitään: sama
     *    pisteytetty matcheri jota /api/agent/import käyttää.
     */
    const exactMatch = await findByIdentifiers(candidateIdentifiers, supabaseAdmin)
    const exactMatchedProjectId =
      exactMatch?.projectId ?? metadata.matched_existing_project_id ?? null

    let fuzzyDetailed: ReturnType<typeof findProjectMatchDetailed> = null

    if (!exactMatchedProjectId) {
      const { data: existingProjects, error: existingProjectsError } =
        await supabaseAdmin
          .from("projects")
          .select(
            "id,name,city,region,location,phase,completed_at,status,developer,property_type,metadata"
          )

      if (existingProjectsError) throw existingProjectsError

      fuzzyDetailed = findProjectMatchDetailed(existingProjects ?? [], {
        name: projectName,
        city,
        region,
        location,
        permitNumber: potentialProject.permit_number,
        propertyId: potentialProject.property_id,
        developer,
        buildingType: metadata.building_type ?? null,
      })
    }

    const fuzzyMatchedProjectId =
      fuzzyDetailed && fuzzyDetailed.confidence >= 70 ? fuzzyDetailed.project.id : null

    const possibleDuplicateOf =
      !exactMatchedProjectId &&
      !fuzzyMatchedProjectId &&
      fuzzyDetailed &&
      fuzzyDetailed.confidence >= 40
        ? fuzzyDetailed.project.id
        : null

    const matchedProjectId = exactMatchedProjectId ?? fuzzyMatchedProjectId

    if (matchedProjectId) {
      const { data: existingProject, error: existingProjectFetchError } =
        await supabaseAdmin
          .from("projects")
          .select("*")
          .eq("id", matchedProjectId)
          .single()

      if (existingProjectFetchError) throw existingProjectFetchError

      const existingOrder = phaseOrder(existingProject.phase)
      const newOrder = phaseOrder(phase)
      const phaseAdvances =
        newOrder != null && (existingOrder == null || newOrder > existingOrder)

      const mergedPhase = phaseAdvances ? phase : existingProject.phase

      const alsoKnownAs = new Set<string>(
        existingProject.metadata?.also_known_as ?? []
      )
      if (existingProject.name !== projectName) alsoKnownAs.add(projectName)

      const mergedMetadata = {
        ...metadata,
        ...(existingProject.metadata ?? {}),
        also_known_as: Array.from(alsoKnownAs),
        source_count: Number(existingProject.metadata?.source_count ?? 1) + 1,
        last_seen_at: new Date().toISOString(),
        last_source_name:
          sourceName ?? existingProject.metadata?.last_source_name ?? null,
      }

      const { data: updatedProject, error: updateError } = await supabaseAdmin
        .from("projects")
        .update({
          city: existingProject.city ?? city,
          region: existingProject.region ?? region,
          location: existingProject.location ?? location,
          developer: existingProject.developer ?? developer,
          property_type:
            existingProject.property_type ?? metadata.building_type ?? null,
          latitude: existingProject.latitude ?? coords.lat,
          longitude: existingProject.longitude ?? coords.lon,
          lat: existingProject.lat ?? coords.lat,
          lng: existingProject.lng ?? coords.lon,
          phase: mergedPhase,
          last_verified_at: new Date().toISOString(),
          metadata: mergedMetadata,
        })
        .eq("id", matchedProjectId)
        .select()
        .single()

      if (updateError) throw updateError

      if (phaseAdvances) {
        await recordPhaseChange({
          supabase: supabaseAdmin,
          projectId: matchedProjectId,
          newPhase: mergedPhase,
          previousPhase: existingProject.phase,
          source: "tic_approve",
          sourceName: sourceName ?? "tic",
        })
      }

      for (const identifier of candidateIdentifiers) {
        await linkIdentifier({
          type: identifier.type,
          value: identifier.value,
          projectId: matchedProjectId,
          sourceName,
          supabase: supabaseAdmin,
        })
      }

      await supabaseAdmin.from("project_imports").insert({
        potential_project_id: potentialProject.id,
        project_id: matchedProjectId,
        action: "matched_existing_project",
        source_document_id: metadata.source_document_id ?? null,
        source_name: sourceName,
        changes: {
          matched_existing_project: {
            matchedVia: exactMatchedProjectId ? "identifier" : "fuzzy_match",
            confidence: fuzzyDetailed?.confidence ?? null,
            phaseAdvanced: phaseAdvances,
          },
        },
        metadata: {
          approved_from: "tic",
          source_url: sourceUrl,
          documents_url: documentsUrl,
        },
      })

      await supabaseAdmin
        .from("potential_projects")
        .update({
          status: "approved",
          updated_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            approved_at: new Date().toISOString(),
            approved_project_id: matchedProjectId,
          },
        })
        .eq("id", potentialProject.id)

      return NextResponse.json({
        ok: true,
        action: "matched_existing_project",
        projectId: matchedProjectId,
        potentialProjectId: potentialProject.id,
        matchedVia: exactMatchedProjectId ? "identifier" : "fuzzy_match",
        confidence: fuzzyDetailed?.confidence ?? null,
        geocoded: Boolean(coords.lat && coords.lon),
      })
    }

    const { data: project, error: projectError } = await supabaseAdmin
      .from("projects")
      .insert({
        name: projectName,

        city,
        region,
        location,

        lat: coords.lat,
        lng: coords.lon,
        latitude: coords.lat,
        longitude: coords.lon,

        developer,

        property_type: metadata.building_type ?? null,
        phase,
        source_confidence: potentialProject.confidence,
        is_public: true,
        needs_review: Boolean(possibleDuplicateOf),
        status: "active",

        additional_info:
          metadata.description ??
          metadata.operation ??
          null,

        metadata: {
  /*
   * Säilytetään kaikki potentiaalisen hankkeen metadata.
   * Näin uusien agenttikenttien lisääminen ei vaadi aina
   * approve-reitin muuttamista.
   */
  ...metadata,

  /*
   * Alla olevat kentät kirjoitetaan tarkoituksella spreadin jälkeen,
   * jotta hyväksyntävaiheessa muodostetut canonical-arvot voittavat.
   */
  source: sourceName ?? metadata.source ?? "discovery_agent",
  source_name: sourceName,
  source_url: sourceUrl,
  documents_url: documentsUrl,

  potential_project_id: potentialProject.id,
  source_document_id: metadata.source_document_id ?? null,

  permit_number: potentialProject.permit_number,
  notice_number:
    metadata.notice_number ??
    potentialProject.permit_number ??
    null,
  notice_id: metadata.notice_id ?? null,

  deadline,
  date_published: metadata.date_published ?? null,
  procurement_type_code:
    metadata.procurement_type_code ?? null,

  developer,
  buyer_address: buyerAddress,
  project_address: projectAddress,

  operation: metadata.operation ?? null,
  description: metadata.description ?? null,
  district: metadata.district ?? null,

  property_id: potentialProject.property_id,

  construction_type:
    metadata.construction_type ?? null,
  building_type:
    metadata.building_type ?? null,
  business_value:
    metadata.business_value ?? null,
  recommended_action:
    metadata.recommended_action ?? null,
  classification_confidence:
    metadata.classification_confidence ?? null,
  classification_reasons:
    metadata.classification_reasons ?? [],

  resolver: metadata.resolver ?? null,
  possible_duplicate_of: possibleDuplicateOf,

  approved_at: new Date().toISOString(),
  approved_from: "tic",
},
      })
      .select()
      .single()

    if (projectError) {
      return NextResponse.json(
        { ok: false, error: projectError.message },
        { status: 500 }
      )
    }

    for (const identifier of candidateIdentifiers) {
      await linkIdentifier({
        type: identifier.type,
        value: identifier.value,
        projectId: project.id,
        sourceName,
        supabase: supabaseAdmin,
      })
    }

    await recordPhaseChange({
      supabase: supabaseAdmin,
      projectId: project.id,
      newPhase: project.phase,
      previousPhase: null,
      source: "tic_approve",
      sourceName: sourceName ?? "tic",
    })

    await supabaseAdmin.from("project_imports").insert({
      potential_project_id: potentialProject.id,
      project_id: project.id,
      action: "create_project",
      source_document_id:
        metadata.source_document_id ?? null,
      source_name: sourceName,

      changes: {
        created_project: {
          name: project.name,
          city: project.city,
          region: project.region,
          location: project.location,
          property_type: project.property_type,
          phase: project.phase,
        },
      },

      metadata: {
        approved_from: "tic",
        source_url: sourceUrl,
        documents_url: documentsUrl,
        deadline,
        permit_number: potentialProject.permit_number,
        property_id: potentialProject.property_id,
        construction_type:
          metadata.construction_type ?? null,
        building_type:
          metadata.building_type ?? null,
        region,
      },
    })

    await supabaseAdmin
      .from("potential_projects")
      .update({
        status: "approved",
        updated_at: new Date().toISOString(),
        metadata: {
          ...metadata,
          approved_at: new Date().toISOString(),
          approved_project_id: project.id,
          approved_region: region,
          approved_source_url: sourceUrl,
          approved_documents_url: documentsUrl,
        },
      })
      .eq("id", potentialProject.id)

    return NextResponse.json({
      ok: true,
      action: "created_project",
      projectId: project.id,
      potentialProjectId: potentialProject.id,
      geocoded: Boolean(coords.lat && coords.lon),
      sourceUrl,
      documentsUrl,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message ?? "Unknown error",
      },
      { status: 500 }
    )
  }
}

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase()
}

function buildCustomerProjectName({
  potentialProject,
  isHilma,
  projectAddress,
}: {
  potentialProject: any
  isHilma: boolean
  projectAddress: string | null
}) {
  const metadata = potentialProject.metadata ?? {}
  const operation = metadata.operation

  /*
   * Hilma-hankkeen nimeen ei lisätä hankintayksikön
   * toimisto-osoitetta.
   */
  if (isHilma) {
    return (
      operation ??
      potentialProject.title ??
      "Hankintailmoitus"
    )
  }

  if (operation && projectAddress) {
    return `${operation}, ${projectAddress}`
  }

  if (operation) return operation

  if (projectAddress) {
    return `Rakennushanke, ${projectAddress}`
  }

  return potentialProject.title ?? "Rakennushanke"
}

function buildProjectLocation({
  address,
  city,
}: {
  address: string | null
  city: string | null
}) {
  if (
    address &&
    city &&
    !normalize(address).includes(normalize(city))
  ) {
    return `${address}, ${city}`
  }

  return address ?? null
}

