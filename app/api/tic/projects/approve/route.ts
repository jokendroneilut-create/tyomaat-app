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
    const isPuolustuskiinteistot = normalize(metadata.resolver) === "puolustuskiinteistotresolver"
    const isEspooKaava = normalize(metadata.resolver) === "espookaavaresolver"
    const isLohjaKaava = normalize(metadata.resolver) === "lohjakaavaresolver"
    const isRaumaKaava = normalize(metadata.resolver) === "raumakaavaresolver"
    const isKaarinaKaava = normalize(metadata.resolver) === "kaarinakaavaresolver"
    const isNokiaKaava = normalize(metadata.resolver) === "nokiakaavaresolver"
    const isKajaaniKaava = normalize(metadata.resolver) === "kajaanikaavaresolver"
    const isKangasalaKaava = normalize(metadata.resolver) === "kangasalakaavaresolver"
    const isYlojarviKaava = normalize(metadata.resolver) === "ylojarvikaavaresolver"
    const isVihtiKaava = normalize(metadata.resolver) === "vihtikaavaresolver"
    const isRiihimakiKaava = normalize(metadata.resolver) === "riihimakikaavaresolver"
    const isRaaseporiKaava = normalize(metadata.resolver) === "raaseporikaavaresolver"
    const isRaisioKaava = normalize(metadata.resolver) === "raisiokaavaresolver"
    const isLempaalaKaava = normalize(metadata.resolver) === "lempaalakaavaresolver"
    const isImatraKaava = normalize(metadata.resolver) === "imatrakaavaresolver"
    const isRaaheKaava = normalize(metadata.resolver) === "raahekaavaresolver"
    const isSastamalaKaava = normalize(metadata.resolver) === "sastamalakaavaresolver"
    const isHollolaKaava = normalize(metadata.resolver) === "hollolakaavaresolver"
    const isPirkkalaKaava = normalize(metadata.resolver) === "pirkkalakaavaresolver"
    const isSiilinjarviKaava = normalize(metadata.resolver) === "siilinjarvikaavaresolver"
    const isMantsalaKaava = normalize(metadata.resolver) === "mantsalakaavaresolver"
    const isTornioKaava = normalize(metadata.resolver) === "torniokaavaresolver"
    const isLietoKaava = normalize(metadata.resolver) === "lietokaavaresolver"
    const isNaantaliKaava = normalize(metadata.resolver) === "naantalikaavaresolver"
    const isIisalmiKaava = normalize(metadata.resolver) === "iisalmikaavaresolver"
    const isMustasaariKaava = normalize(metadata.resolver) === "mustasaarikaavaresolver"
    const isKempeleKaava = normalize(metadata.resolver) === "kempelekaavaresolver"
    const isValkeakoskiKaava = normalize(metadata.resolver) === "valkeakoskikaavaresolver"
    const isPietarsaariKaava = normalize(metadata.resolver) === "pietarsaarikaavaresolver"
    const isKurikkaKaava = normalize(metadata.resolver) === "kurikkakaavaresolver"
    const isVarkausKaava = normalize(metadata.resolver) === "varkauskaavaresolver"
    const isKemiKaava = normalize(metadata.resolver) === "kemikaavaresolver"
    const isHaminaKaava = normalize(metadata.resolver) === "haminakaavaresolver"
    const isJamsaKaava = normalize(metadata.resolver) === "jamsakaavaresolver"
    const isLaukaaKaava = normalize(metadata.resolver) === "laukaakaavaresolver"
    const isHeinolaKaava = normalize(metadata.resolver) === "heinolakaavaresolver"
    const isAanekoskiKaava = normalize(metadata.resolver) === "aanekoskikaavaresolver"
    const isPieksamakiKaava = normalize(metadata.resolver) === "pieksamakikaavaresolver"
    const isAkaaKaava = normalize(metadata.resolver) === "akaakaavaresolver"
    const isForssaKaava = normalize(metadata.resolver) === "forssakaavaresolver"
    const isJanakkalaKaava = normalize(metadata.resolver) === "janakkalakaavaresolver"
    const isOrimattilaKaava = normalize(metadata.resolver) === "orimattilakaavaresolver"
    const isYlivieskaKaava = normalize(metadata.resolver) === "ylivieskakaavaresolver"
    const isLoimaaKaava = normalize(metadata.resolver) === "loimaakaavaresolver"
    const isKontiolahtiKaava = normalize(metadata.resolver) === "kontiolahtikaavaresolver"
    const isKauhavaKaava = normalize(metadata.resolver) === "kauhavakaavaresolver"
    const isLapuaKaava = normalize(metadata.resolver) === "lapuakaavaresolver"
    const isKauhajokiKaava = normalize(metadata.resolver) === "kauhajokikaavaresolver"
    const isIlmajokiKaava = normalize(metadata.resolver) === "ilmajokikaavaresolver"
    const isUusikaupunkiKaava = normalize(metadata.resolver) === "uusikaupunkikaavaresolver"
    const isPaimioKaava = normalize(metadata.resolver) === "paimiokaavaresolver"
    const isUlvilaKaava = normalize(metadata.resolver) === "ulvilakaavaresolver"
    const isKankaanpaaKaava = normalize(metadata.resolver) === "kankaanpaakaavaresolver"
    const isLiperiKaava = normalize(metadata.resolver) === "liperikaavaresolver"
    const isLieksaKaava = normalize(metadata.resolver) === "lieksakaavaresolver"
    const isKiteeKaava = normalize(metadata.resolver) === "kiteekaavaresolver"
    const isKalajokiKaava = normalize(metadata.resolver) === "kalajokikaavaresolver"
    const isNivalaKaava = normalize(metadata.resolver) === "nivalakaavaresolver"
    const isLimingaKaava = normalize(metadata.resolver) === "limingakaavaresolver"
    const isMuurameKaava = normalize(metadata.resolver) === "muuramekaavaresolver"
    const isSaarijarviKaava = normalize(metadata.resolver) === "saarijarvikaavaresolver"
    const isKeuruuKaava = normalize(metadata.resolver) === "keuruukaavaresolver"
    const isLoviisaKaava = normalize(metadata.resolver) === "loviisakaavaresolver"
    const isKuusamoKaava = normalize(metadata.resolver) === "kuusamokaavaresolver"
    const isKauniainenKaava = normalize(metadata.resolver) === "kauniainenkaavaresolver"
    const isParainenKaava = normalize(metadata.resolver) === "parainenkaavaresolver"
    const isSomeroKaava = normalize(metadata.resolver) === "somerokaavaresolver"
    const isHuittinenKaava = normalize(metadata.resolver) === "huittinenkaavaresolver"
    const isKokemakiKaava = normalize(metadata.resolver) === "kokemakikaavaresolver"
    const isUrjalaKaava = normalize(metadata.resolver) === "urjalakaavaresolver"
    const isPunkalaidunKaava = normalize(metadata.resolver) === "punkalaidunkaavaresolver"
    const isLoppiKaava = normalize(metadata.resolver) === "loppikaavaresolver"
    const isHattulaKaava = normalize(metadata.resolver) === "hattulakaavaresolver"
    const isSavitaipaleKaava = normalize(metadata.resolver) === "savitaipalekaavaresolver"
    const isJuvaKaava = normalize(metadata.resolver) === "juvakaavaresolver"
    const isLapinlahtiKaava = normalize(metadata.resolver) === "lapinlahtikaavaresolver"
    const isKannusKaava = normalize(metadata.resolver) === "kannuskaavaresolver"
    const isToholampiKaava = normalize(metadata.resolver) === "toholampikaavaresolver"
    const isKuhmoKaava = normalize(metadata.resolver) === "kuhmokaavaresolver"
    const isSuomussalmiKaava = normalize(metadata.resolver) === "suomussalmikaavaresolver"
    const isKittilaKaava = normalize(metadata.resolver) === "kittilakaavaresolver"
    const isKemijarviKaava = normalize(metadata.resolver) === "kemijarvikaavaresolver"
    const isRautjarviKaava = normalize(metadata.resolver) === "rautjarvikaavaresolver"
    const isSavonlinnaKaava = normalize(metadata.resolver) === "savonlinnakaavaresolver"
    const isKuopioKaava = normalize(metadata.resolver) === "kuopiokaavaresolver"
    const isHyvinkaaKaava = normalize(metadata.resolver) === "hyvinkaakaavaresolver"
    const isSeinajokiKaava = normalize(metadata.resolver) === "seinajokikaavaresolver"
    const isRovaniemiKaava = normalize(metadata.resolver) === "rovaniemikaavaresolver"
    const isMikkeliKaava = normalize(metadata.resolver) === "mikkelikaavaresolver"
    const isKotkaKaava = normalize(metadata.resolver) === "kotkakaavaresolver"
    const isSaloKaava = normalize(metadata.resolver) === "salokaavaresolver"
    const isPorvooKaava = normalize(metadata.resolver) === "porvookaavaresolver"
    const isKokkolaKaava = normalize(metadata.resolver) === "kokkolakaavaresolver"
    const isKirkkonummiKaava = normalize(metadata.resolver) === "kirkkonummikaavaresolver"
    const isKeravaKaava = normalize(metadata.resolver) === "keravakaavaresolver"
    const isTuusulaKaava = normalize(metadata.resolver) === "tuusulakaavaresolver"
    const isNurmijarviKaava = normalize(metadata.resolver) === "nurmijarvikaavaresolver"
    const isSipooKaava = normalize(metadata.resolver) === "sipookaavaresolver"
    const isJarvenpaaKaava = normalize(metadata.resolver) === "jarvenpaakaavaresolver"
    const isLahtiKaava = normalize(metadata.resolver) === "lahtikaavaresolver"
    const isPoriKaava = normalize(metadata.resolver) === "porikaavaresolver"
    const isOuluKaava = normalize(metadata.resolver) === "oulukaavaresolver"
    const isJyvaskylaKaava = normalize(metadata.resolver) === "jyvaskylakaavaresolver"
    const isHameenlinnaKaava = normalize(metadata.resolver) === "hameenlinnakaavaresolver"
    const isJoensuuKaava = normalize(metadata.resolver) === "joensuukaavaresolver"
    const isVaasaKaava = normalize(metadata.resolver) === "vaasakaavaresolver"
    const isKouvolaKaava = normalize(metadata.resolver) === "kouvolakaavaresolver"
    const isLappeenrantaKaava = normalize(metadata.resolver) === "lappeenrantakaavaresolver"
    const isAlajarviKaava = normalize(metadata.resolver) === "alajarvikaavaresolver"
    const isAlavusKaava = normalize(metadata.resolver) === "alavuskaavaresolver"
    const isIsokyroKaava = normalize(metadata.resolver) === "isokyrokaavaresolver"
    const isKuortaneKaava = normalize(metadata.resolver) === "kuortanekaavaresolver"
    const isLaihiaKaava = normalize(metadata.resolver) === "laihiakaavaresolver"
    const isAhtariKaava = normalize(metadata.resolver) === "ahtarikaavaresolver"
    const isEnonkoskiKaava = normalize(metadata.resolver) === "enonkoskikaavaresolver"
    const isHeinavesiKaava = normalize(metadata.resolver) === "heinavesikaavaresolver"
    const isHirvensalmiKaava = normalize(metadata.resolver) === "hirvensalmikaavaresolver"
    const isPuumalaKaava = normalize(metadata.resolver) === "puumalakaavaresolver"
    const isSulkavaKaava = normalize(metadata.resolver) === "sulkavakaavaresolver"
    const isHyrynsalmiKaava = normalize(metadata.resolver) === "hyrynsalmikaavaresolver"
    const isPaltamoKaava = normalize(metadata.resolver) === "paltamokaavaresolver"
    const isPuolankaKaava = normalize(metadata.resolver) === "puolankakaavaresolver"
    const isHausjarviKaava = normalize(metadata.resolver) === "hausjarvikaavaresolver"
    const isJokioinenKaava = normalize(metadata.resolver) === "jokioinenkaavaresolver"

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

    if (isHyvinkaaKaava) {
      candidateIdentifiers.push({
        type: "hyvinkaa_kaava_tunnus",
        value: metadata.kaava_tunnus ?? metadata.record_number,
      })
    }

    if (isSeinajokiKaava) {
      candidateIdentifiers.push({
        type: "seinajoki_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isRovaniemiKaava) {
      candidateIdentifiers.push({
        type: "rovaniemi_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isMikkeliKaava) {
      candidateIdentifiers.push({
        type: "mikkeli_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isKotkaKaava) {
      candidateIdentifiers.push({
        type: "kotka_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isSaloKaava) {
      candidateIdentifiers.push({
        type: "salo_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isPorvooKaava) {
      candidateIdentifiers.push({
        type: "porvoo_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isKokkolaKaava) {
      candidateIdentifiers.push({
        type: "kokkola_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isKirkkonummiKaava) {
      candidateIdentifiers.push({
        type: "kirkkonummi_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isKeravaKaava) {
      candidateIdentifiers.push({
        type: "kerava_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isTuusulaKaava) {
      candidateIdentifiers.push({
        type: "tuusula_kaava_tunnus",
        value: metadata.kaava_tunnus ?? metadata.record_number,
      })
    }

    if (isNurmijarviKaava) {
      candidateIdentifiers.push({
        type: "nurmijarvi_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isSipooKaava) {
      candidateIdentifiers.push({
        type: "sipoo_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isJarvenpaaKaava) {
      candidateIdentifiers.push({
        type: "jarvenpaa_kaava_tunnus",
        value: metadata.kaava_tunnus,
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

    if (isKouvolaKaava) {
      candidateIdentifiers.push({
        type: "kouvola_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isLappeenrantaKaava) {
      candidateIdentifiers.push({
        type: "lappeenranta_kaava_id",
        value: metadata.documents_url,
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

    if (isPuolustuskiinteistot) {
      candidateIdentifiers.push({
        type: "puolustuskiinteistot_article_url",
        value: metadata.documents_url,
      })
    }

    if (isEspooKaava) {
      candidateIdentifiers.push({
        type: "espoo_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isLohjaKaava) {
      candidateIdentifiers.push({
        type: "lohja_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isRaumaKaava) {
      candidateIdentifiers.push({
        type: "rauma_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isKaarinaKaava) {
      candidateIdentifiers.push({
        type: "kaarina_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isNokiaKaava) {
      candidateIdentifiers.push({
        type: "nokia_kaava_tunnus",
        value: typeof metadata.kaava_tunnus === "string" ? metadata.kaava_tunnus.replace(/:/g, "-") : metadata.kaava_tunnus,
      })
    }

    if (isKajaaniKaava) {
      candidateIdentifiers.push({
        type: "kajaani_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isKangasalaKaava) {
      candidateIdentifiers.push({
        type: "kangasala_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isYlojarviKaava) {
      candidateIdentifiers.push({
        type: "ylojarvi_kaava_slug",
        value: metadata.kaava_tunnus,
      })
    }

    if (isVihtiKaava) {
      candidateIdentifiers.push({
        type: "vihti_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isRiihimakiKaava) {
      candidateIdentifiers.push({
        type: "riihimaki_kaava_slug",
        value: metadata.kaava_tunnus,
      })
    }

    if (isRaaseporiKaava) {
      candidateIdentifiers.push({
        type: "raasepori_kaava_id",
        value: metadata.kaava_tunnus,
      })
    }

    if (isRaisioKaava) {
      candidateIdentifiers.push({
        type: "raisio_kaava_slug",
        value: metadata.kaava_tunnus,
      })
    }

    if (isLempaalaKaava) {
      candidateIdentifiers.push({
        type: "lempaala_kaava_slug",
        value: metadata.kaava_tunnus,
      })
    }

    if (isImatraKaava) {
      candidateIdentifiers.push({
        type: "imatra_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isRaaheKaava) {
      candidateIdentifiers.push({
        type: "raahe_kaava_id",
        value: metadata.kaava_tunnus,
      })
    }

    if (isSastamalaKaava) {
      candidateIdentifiers.push({
        type: "sastamala_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isHollolaKaava) {
      candidateIdentifiers.push({
        type: "hollola_kaava_id",
        value: metadata.kaava_tunnus,
      })
    }

    if (isPirkkalaKaava) {
      candidateIdentifiers.push({
        type: "pirkkala_kaava_id",
        value: metadata.kaava_tunnus,
      })
    }

    if (isSiilinjarviKaava) {
      candidateIdentifiers.push({
        type: "siilinjarvi_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isMantsalaKaava) {
      candidateIdentifiers.push({
        type: "mantsala_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isTornioKaava) {
      candidateIdentifiers.push({
        type: "tornio_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isLietoKaava) {
      candidateIdentifiers.push({
        type: "lieto_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isNaantaliKaava) {
      candidateIdentifiers.push({
        type: "naantali_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isIisalmiKaava) {
      candidateIdentifiers.push({
        type: "iisalmi_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isMustasaariKaava) {
      candidateIdentifiers.push({
        type: "mustasaari_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKempeleKaava) {
      candidateIdentifiers.push({
        type: "kempele_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isValkeakoskiKaava) {
      candidateIdentifiers.push({
        type: "valkeakoski_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isPietarsaariKaava) {
      candidateIdentifiers.push({
        type: "pietarsaari_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKurikkaKaava) {
      candidateIdentifiers.push({
        type: "kurikka_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isVarkausKaava) {
      candidateIdentifiers.push({
        type: "varkaus_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKemiKaava) {
      candidateIdentifiers.push({
        type: "kemi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isHaminaKaava) {
      candidateIdentifiers.push({
        type: "hamina_kaava_tunnus",
        value: metadata.kaava_tunnus ?? metadata.slug,
      })
    }

    if (isJamsaKaava) {
      candidateIdentifiers.push({
        type: "jamsa_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLaukaaKaava) {
      candidateIdentifiers.push({
        type: "laukaa_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isHeinolaKaava && metadata.kaava_tunnus) {
      candidateIdentifiers.push({
        type: "heinola_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isAanekoskiKaava && metadata.kaava_tunnus) {
      candidateIdentifiers.push({
        type: "aanekoski_kaava_tunnus",
        value: metadata.kaava_tunnus,
      })
    }

    if (isPieksamakiKaava) {
      candidateIdentifiers.push({
        type: "pieksamaki_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isAkaaKaava) {
      candidateIdentifiers.push({
        type: "akaa_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isForssaKaava) {
      candidateIdentifiers.push({
        type: "forssa_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isJanakkalaKaava) {
      candidateIdentifiers.push({
        type: "janakkala_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isOrimattilaKaava) {
      candidateIdentifiers.push({
        type: "orimattila_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isYlivieskaKaava) {
      candidateIdentifiers.push({
        type: "ylivieska_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLoimaaKaava) {
      candidateIdentifiers.push({
        type: "loimaa_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKontiolahtiKaava) {
      candidateIdentifiers.push({
        type: "kontiolahti_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKauhavaKaava) {
      candidateIdentifiers.push({
        type: "kauhava_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLapuaKaava) {
      candidateIdentifiers.push({
        type: "lapua_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKauhajokiKaava) {
      candidateIdentifiers.push({
        type: "kauhajoki_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isIlmajokiKaava) {
      candidateIdentifiers.push({
        type: "ilmajoki_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isUusikaupunkiKaava) {
      candidateIdentifiers.push({
        type: "uusikaupunki_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isPaimioKaava) {
      candidateIdentifiers.push({
        type: "paimio_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isUlvilaKaava) {
      candidateIdentifiers.push({
        type: "ulvila_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKankaanpaaKaava) {
      candidateIdentifiers.push({
        type: "kankaanpaa_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLiperiKaava) {
      candidateIdentifiers.push({
        type: "liperi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLieksaKaava) {
      candidateIdentifiers.push({
        type: "lieksa_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKiteeKaava) {
      candidateIdentifiers.push({
        type: "kitee_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKalajokiKaava) {
      candidateIdentifiers.push({
        type: "kalajoki_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isNivalaKaava) {
      candidateIdentifiers.push({
        type: "nivala_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLimingaKaava) {
      candidateIdentifiers.push({
        type: "liminka_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isMuurameKaava) {
      candidateIdentifiers.push({
        type: "muurame_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isSaarijarviKaava) {
      candidateIdentifiers.push({
        type: "saarijarvi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKeuruuKaava) {
      candidateIdentifiers.push({
        type: "keuruu_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLoviisaKaava) {
      candidateIdentifiers.push({
        type: "loviisa_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKuusamoKaava) {
      candidateIdentifiers.push({
        type: "kuusamo_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKauniainenKaava) {
      candidateIdentifiers.push({
        type: "kauniainen_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isParainenKaava) {
      candidateIdentifiers.push({
        type: "parainen_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isSomeroKaava) {
      candidateIdentifiers.push({
        type: "somero_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isHuittinenKaava) {
      candidateIdentifiers.push({
        type: "huittinen_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKokemakiKaava) {
      candidateIdentifiers.push({
        type: "kokemaki_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isUrjalaKaava) {
      candidateIdentifiers.push({
        type: "urjala_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isPunkalaidunKaava) {
      candidateIdentifiers.push({
        type: "punkalaidun_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLoppiKaava) {
      candidateIdentifiers.push({
        type: "loppi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isHattulaKaava) {
      candidateIdentifiers.push({
        type: "hattula_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isSavitaipaleKaava) {
      candidateIdentifiers.push({
        type: "savitaipale_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isJuvaKaava) {
      candidateIdentifiers.push({
        type: "juva_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLapinlahtiKaava) {
      candidateIdentifiers.push({
        type: "lapinlahti_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKannusKaava) {
      candidateIdentifiers.push({
        type: "kannus_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isToholampiKaava) {
      candidateIdentifiers.push({
        type: "toholampi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKuhmoKaava) {
      candidateIdentifiers.push({
        type: "kuhmo_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isSuomussalmiKaava) {
      candidateIdentifiers.push({
        type: "suomussalmi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKittilaKaava) {
      candidateIdentifiers.push({
        type: "kittila_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKemijarviKaava) {
      candidateIdentifiers.push({
        type: "kemijarvi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isRautjarviKaava) {
      candidateIdentifiers.push({
        type: "rautjarvi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isAlajarviKaava) {
      candidateIdentifiers.push({
        type: "alajarvi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isAlavusKaava) {
      candidateIdentifiers.push({
        type: "alavus_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isIsokyroKaava) {
      candidateIdentifiers.push({
        type: "isokyro_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isKuortaneKaava) {
      candidateIdentifiers.push({
        type: "kuortane_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isLaihiaKaava) {
      candidateIdentifiers.push({
        type: "laihia_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isAhtariKaava) {
      candidateIdentifiers.push({
        type: "ahtari_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isEnonkoskiKaava) {
      candidateIdentifiers.push({
        type: "enonkoski_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isHeinavesiKaava) {
      candidateIdentifiers.push({
        type: "heinavesi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isHirvensalmiKaava) {
      candidateIdentifiers.push({
        type: "hirvensalmi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isPuumalaKaava) {
      candidateIdentifiers.push({
        type: "puumala_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isSulkavaKaava) {
      candidateIdentifiers.push({
        type: "sulkava_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isHyrynsalmiKaava) {
      candidateIdentifiers.push({
        type: "hyrynsalmi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isPaltamoKaava) {
      candidateIdentifiers.push({
        type: "paltamo_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isPuolankaKaava) {
      candidateIdentifiers.push({
        type: "puolanka_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isHausjarviKaava) {
      candidateIdentifiers.push({
        type: "hausjarvi_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isJokioinenKaava) {
      candidateIdentifiers.push({
        type: "jokioinen_kaava_slug",
        value: metadata.slug,
      })
    }

    if (isSavonlinnaKaava) {
      candidateIdentifiers.push({
        type: "savonlinna_kaava_title",
        value: metadata.operation,
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

    const estimatedCompletion =
      metadata.estimated_completion ??
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
          estimated_completion:
            existingProject.estimated_completion ?? estimatedCompletion,
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
        estimated_completion: estimatedCompletion,
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

  /*
   * Osa lähteistä ei tarjoa erillistä osoitetta, joten address on
   * asetettu samaksi kuin operation (kaavan nimi) — silloin liite
   * toistaisi saman tekstin kahdesti ("Kartano I, Kartano I").
   */
  if (operation && projectAddress && projectAddress !== operation) {
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

