import { extractFacts } from "@/lib/agent/facts/extractFacts"
import { extractHilmaFacts } from "@/lib/agent/facts/extractHilmaFacts"
import { extractLupapisteFacts } from "@/lib/agent/facts/extractLupapisteFacts"
import { extractVantaaKaavaFacts } from "@/lib/agent/facts/extractVantaaKaavaFacts"
import { extractHelsinkiKaavaFacts } from "@/lib/agent/facts/extractHelsinkiKaavaFacts"
import { extractTampereKaavaFacts } from "@/lib/agent/facts/extractTampereKaavaFacts"
import { extractTurkuKaavaFacts } from "@/lib/agent/facts/extractTurkuKaavaFacts"
import { extractKreateFacts } from "@/lib/agent/facts/extractKreateFacts"
import { extractVaylaFacts } from "@/lib/agent/facts/extractVaylaFacts"
import { extractSenaattiFacts } from "@/lib/agent/facts/extractSenaattiFacts"
import { extractKuopioKaavaFacts } from "@/lib/agent/facts/extractKuopioKaavaFacts"
import { extractHyvinkaaKaavaFacts } from "@/lib/agent/facts/extractHyvinkaaKaavaFacts"
import { extractSeinajokiKaavaFacts } from "@/lib/agent/facts/extractSeinajokiKaavaFacts"
import { extractRovaniemiKaavaFacts } from "@/lib/agent/facts/extractRovaniemiKaavaFacts"
import { extractMikkeliKaavaFacts } from "@/lib/agent/facts/extractMikkeliKaavaFacts"
import { extractLahtiKaavaFacts } from "@/lib/agent/facts/extractLahtiKaavaFacts"
import { extractPoriKaavaFacts } from "@/lib/agent/facts/extractPoriKaavaFacts"
import { extractOuluKaavaFacts } from "@/lib/agent/facts/extractOuluKaavaFacts"
import { extractJyvaskylaKaavaFacts } from "@/lib/agent/facts/extractJyvaskylaKaavaFacts"
import { extractHameenlinnaKaavaFacts } from "@/lib/agent/facts/extractHameenlinnaKaavaFacts"
import { extractJoensuuKaavaFacts } from "@/lib/agent/facts/extractJoensuuKaavaFacts"
import { extractVaasaKaavaFacts } from "@/lib/agent/facts/extractVaasaKaavaFacts"
import { extractKouvolaKaavaFacts } from "@/lib/agent/facts/extractKouvolaKaavaFacts"
import { extractLappeenrantaKaavaFacts } from "@/lib/agent/facts/extractLappeenrantaKaavaFacts"
import { splitEspooPermitNoticeText } from "@/lib/agent/building-permits/decisionSplitter"

export function resolveFacts(document: any) {
  if (document.source_name === "Hilma") {
    const notice = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")

    return {
      decisions: [],
      facts: extractHilmaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        notice,
      }),
    }
  }

  if (document.source_name === "Lupapiste kuulutukset") {
    const notice = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")

    return {
      decisions: [],
      facts: extractLupapisteFacts({
        documentId: document.id,
        sourceName: document.source_name,
        notice,
      }),
    }
  }

  if (document.source_name === "Vantaan vireillä olevat kaavat") {
    const feature = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const center = document.raw_payload?.center ?? null
    const hakija = document.raw_payload?.hakija ?? null
    const contacts = document.raw_payload?.contacts ?? []
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractVantaaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
        hakija,
        contacts,
        description,
      }),
    }
  }

  if (document.source_name === "Helsingin vireillä olevat kaavat") {
    const feature = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const center = document.raw_payload?.center ?? null
    const districtName = document.raw_payload?.district_name ?? null
    const description = document.raw_payload?.description ?? null
    const selostusUrl = document.raw_payload?.selostus_url ?? null

    return {
      decisions: [],
      facts: extractHelsinkiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
        districtName,
        description,
        selostusUrl,
      }),
    }
  }

  if (document.source_name === "Tampereen vireillä olevat kaavat") {
    const feature = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const center = document.raw_payload?.center ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const diaarinumero = document.raw_payload?.diaarinumero ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const decisionMaker = document.raw_payload?.decision_maker ?? null
    const planTitle = document.raw_payload?.plan_title ?? null

    return {
      decisions: [],
      facts: extractTampereKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
        kaavaTunnus,
        diaarinumero,
        phase,
        description,
        decisionMaker,
        planTitle,
      }),
    }
  }

  if (document.source_name === "Kuopion vireillä olevat kaavat") {
    const feature = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const planName = document.raw_payload?.plan_name ?? null
    const planNumber = document.raw_payload?.plan_number ?? null
    const recordNumber = document.raw_payload?.record_number ?? null
    const phase = document.raw_payload?.phase ?? null
    const planType = document.raw_payload?.plan_type ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []
    const center = document.raw_payload?.center ?? null

    return {
      decisions: [],
      facts: extractKuopioKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        planName,
        planNumber,
        recordNumber,
        phase,
        planType,
        description,
        contacts,
        center,
      }),
    }
  }

  if (document.source_name === "Hyvinkään vireillä olevat kaavat") {
    const planName = document.raw_payload?.plan_name ?? null
    const planNumber = document.raw_payload?.plan_number ?? null
    const recordNumber = document.raw_payload?.record_number ?? null
    const phase = document.raw_payload?.phase ?? null
    const planType = document.raw_payload?.plan_type ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []
    const center = document.raw_payload?.center ?? null

    return {
      decisions: [],
      facts: extractHyvinkaaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        planName,
        planNumber,
        recordNumber,
        phase,
        planType,
        description,
        contacts,
        center,
      }),
    }
  }

  if (document.source_name === "Seinäjoen ajankohtaiset asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractSeinajokiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
      }),
    }
  }

  if (document.source_name === "Rovaniemen Kaavatori") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const cityPlanId = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const address = document.raw_payload?.address ?? null
    const decisionNumber = document.raw_payload?.decision_number ?? null
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractRovaniemiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        cityPlanId,
        phase,
        address,
        decisionNumber,
        description,
      }),
    }
  }

  if (document.source_name === "Mikkelin vireillä olevat kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const decisionNumber = document.raw_payload?.decision_number ?? null
    const description = document.raw_payload?.description ?? null
    const contact = document.raw_payload?.contact ?? null

    return {
      decisions: [],
      facts: extractMikkeliKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        decisionNumber,
        description,
        contact,
      }),
    }
  }

  if (document.source_name === "Lahden kaavatyökohteet") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const planType = document.raw_payload?.plan_type ?? null
    const vireilletulo = document.raw_payload?.vireilletulo ?? null
    const applicant = document.raw_payload?.applicant ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []
    const center = document.raw_payload?.center ?? null

    return {
      decisions: [],
      facts: extractLahtiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        planType,
        vireilletulo,
        applicant,
        phase,
        description,
        contacts,
        center,
      }),
    }
  }

  if (document.source_name === "Porin vireillä olevat kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const decisionMaker = document.raw_payload?.decision_maker ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractPoriKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
        decisionMaker,
        contacts,
      }),
    }
  }

  if (document.source_name === "Oulun vireillä olevat kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const region = document.raw_payload?.region ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractOuluKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        region,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Jyväskylän vireillä olevat kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const district = document.raw_payload?.district ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractJyvaskylaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        documentUrl: document.document_url,
        district,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Hämeenlinnan vireillä olevat kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contactName = document.raw_payload?.contact_name ?? null

    return {
      decisions: [],
      facts: extractHameenlinnaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
        contactName,
      }),
    }
  }

  if (document.source_name === "Joensuun laadinnassa olevat kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const status = document.raw_payload?.status ?? null
    const district = document.raw_payload?.district ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractJoensuuKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        documentUrl: document.document_url,
        district,
        status,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Vaasan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractVaasaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Kouvolan ajankohtaiset asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractKouvolaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Lappeenrannan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []
    const center = document.raw_payload?.center ?? null

    return {
      decisions: [],
      facts: extractLappeenrantaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        documentUrl: document.document_url,
        phase,
        description,
        contacts,
        center,
      }),
    }
  }

  if (document.source_name === "Turun vireillä olevat kaavat") {
    const feature = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const center = document.raw_payload?.center ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const kaavanNimi = document.raw_payload?.kaavan_nimi ?? null
    const kaavalaji = document.raw_payload?.kaavalaji ?? null
    const kaavatilanne = document.raw_payload?.kaavatilanne ?? null
    const description = document.raw_payload?.description ?? null
    const identifyingInfo = document.raw_payload?.identifying_info ?? {}

    return {
      decisions: [],
      facts: extractTurkuKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
        kaavaTunnus,
        kaavanNimi,
        kaavalaji,
        kaavatilanne,
        documentsUrl: document.document_url,
        description,
        identifyingInfo,
      }),
    }
  }

  if (document.source_name === "Kreate hankkeet") {
    const post = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const title = document.raw_payload?.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const category = document.raw_payload?.category ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractKreateFacts({
        documentId: document.id,
        sourceName: document.source_name,
        post,
        title,
        phase,
        category,
        contacts,
      }),
    }
  }

  if (document.source_name === "Väylävirasto hankkeet") {
    const item = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const title = document.raw_payload?.title ?? null
    const description = document.raw_payload?.description ?? null
    const hankeType = document.raw_payload?.hanke_type ?? null
    const region = document.raw_payload?.region ?? null
    const phase = document.raw_payload?.phase ?? null
    const contact = document.raw_payload?.contact ?? null
    const progress = document.raw_payload?.progress ?? null

    return {
      decisions: [],
      facts: extractVaylaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        item,
        title,
        description,
        hankeType,
        region,
        phase,
        contact,
        progress,
      }),
    }
  }

  if (document.source_name === "Senaatti-kiinteistöt hankkeet") {
    const post = document.raw_payload?.original ?? JSON.parse(document.raw_text ?? "{}")
    const title = document.raw_payload?.title ?? null
    const description = document.raw_payload?.description ?? null
    const phase = document.raw_payload?.phase ?? null
    const location = document.raw_payload?.location ?? null
    const buildingType = document.raw_payload?.building_type ?? null
    const contact = document.raw_payload?.contact ?? null

    return {
      decisions: [],
      facts: extractSenaattiFacts({
        documentId: document.id,
        sourceName: document.source_name,
        post,
        title,
        description,
        phase,
        location,
        buildingType,
        contact,
      }),
    }
  }

  const fullText = document.extracted_text ?? ""
  const decisions = splitEspooPermitNoticeText(fullText)

  if (decisions.length === 0) {
    return {
      decisions,
      facts: extractFacts({
        documentId: document.id,
        sourceName: document.source_name,
        text: fullText,
      }),
    }
  }

  const facts = decisions.flatMap((decision) => {
    const decisionFacts = extractFacts({
      documentId: document.id,
      sourceName: document.source_name,
      text: decision.rawText,
    })

    return decisionFacts.map((fact) => ({
      ...fact,
      metadata: {
        ...(fact.metadata ?? {}),
        decision_index: decision.index,
        section_number: decision.sectionNumber,
        permit_number: decision.permitNumber,
        address: decision.address,
        property_ids: decision.propertyIds,
        district: decision.district,
        operation: decision.operation,
        decision_maker: decision.decisionMaker,
      },
    }))
  })

  return {
    decisions,
    facts,
  }
}