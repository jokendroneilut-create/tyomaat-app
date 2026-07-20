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
import { extractPuolustuskiinteistotFacts } from "@/lib/agent/facts/extractPuolustuskiinteistotFacts"
import { extractEspooKaavaFacts } from "@/lib/agent/facts/extractEspooKaavaFacts"
import { extractLohjaKaavaFacts } from "@/lib/agent/facts/extractLohjaKaavaFacts"
import { extractRaumaKaavaFacts } from "@/lib/agent/facts/extractRaumaKaavaFacts"
import { extractKaarinaKaavaFacts } from "@/lib/agent/facts/extractKaarinaKaavaFacts"
import { extractNokiaKaavaFacts } from "@/lib/agent/facts/extractNokiaKaavaFacts"
import { extractKajaaniKaavaFacts } from "@/lib/agent/facts/extractKajaaniKaavaFacts"
import { extractKangasalaKaavaFacts } from "@/lib/agent/facts/extractKangasalaKaavaFacts"
import { extractYlojarviKaavaFacts } from "@/lib/agent/facts/extractYlojarviKaavaFacts"
import { extractVihtiKaavaFacts } from "@/lib/agent/facts/extractVihtiKaavaFacts"
import { extractImatraKaavaFacts } from "@/lib/agent/facts/extractImatraKaavaFacts"
import { extractRaaheKaavaFacts } from "@/lib/agent/facts/extractRaaheKaavaFacts"
import { extractSastamalaKaavaFacts } from "@/lib/agent/facts/extractSastamalaKaavaFacts"
import { extractHollolaKaavaFacts } from "@/lib/agent/facts/extractHollolaKaavaFacts"
import { extractPirkkalaKaavaFacts } from "@/lib/agent/facts/extractPirkkalaKaavaFacts"
import { extractSiilinjarviKaavaFacts } from "@/lib/agent/facts/extractSiilinjarviKaavaFacts"
import { extractMantsalaKaavaFacts } from "@/lib/agent/facts/extractMantsalaKaavaFacts"
import { extractTornioKaavaFacts } from "@/lib/agent/facts/extractTornioKaavaFacts"
import { extractLietoKaavaFacts } from "@/lib/agent/facts/extractLietoKaavaFacts"
import { extractNaantaliKaavaFacts } from "@/lib/agent/facts/extractNaantaliKaavaFacts"
import { extractIisalmiKaavaFacts } from "@/lib/agent/facts/extractIisalmiKaavaFacts"
import { extractMustasaariKaavaFacts } from "@/lib/agent/facts/extractMustasaariKaavaFacts"
import { extractKempeleKaavaFacts } from "@/lib/agent/facts/extractKempeleKaavaFacts"
import { extractValkeakoskiKaavaFacts } from "@/lib/agent/facts/extractValkeakoskiKaavaFacts"
import { extractPietarsaariKaavaFacts } from "@/lib/agent/facts/extractPietarsaariKaavaFacts"
import { extractKurikkaKaavaFacts } from "@/lib/agent/facts/extractKurikkaKaavaFacts"
import { extractVarkausKaavaFacts } from "@/lib/agent/facts/extractVarkausKaavaFacts"
import { extractKemiKaavaFacts } from "@/lib/agent/facts/extractKemiKaavaFacts"
import { extractHaminaKaavaFacts } from "@/lib/agent/facts/extractHaminaKaavaFacts"
import { extractJamsaKaavaFacts } from "@/lib/agent/facts/extractJamsaKaavaFacts"
import { extractLaukaaKaavaFacts } from "@/lib/agent/facts/extractLaukaaKaavaFacts"
import { extractPieksamakiKaavaFacts } from "@/lib/agent/facts/extractPieksamakiKaavaFacts"
import { extractAkaaKaavaFacts } from "@/lib/agent/facts/extractAkaaKaavaFacts"
import { extractForssaKaavaFacts } from "@/lib/agent/facts/extractForssaKaavaFacts"
import { extractJanakkalaKaavaFacts } from "@/lib/agent/facts/extractJanakkalaKaavaFacts"
import { extractHeinolaKaavaFacts } from "@/lib/agent/facts/extractHeinolaKaavaFacts"
import { extractAanekoskiKaavaFacts } from "@/lib/agent/facts/extractAanekoskiKaavaFacts"
import { extractRiihimakiKaavaFacts } from "@/lib/agent/facts/extractRiihimakiKaavaFacts"
import { extractRaaseporiKaavaFacts } from "@/lib/agent/facts/extractRaaseporiKaavaFacts"
import { extractRaisioKaavaFacts } from "@/lib/agent/facts/extractRaisioKaavaFacts"
import { extractLempaalaKaavaFacts } from "@/lib/agent/facts/extractLempaalaKaavaFacts"
import { extractSavonlinnaKaavaFacts } from "@/lib/agent/facts/extractSavonlinnaKaavaFacts"
import { extractKuopioKaavaFacts } from "@/lib/agent/facts/extractKuopioKaavaFacts"
import { extractHyvinkaaKaavaFacts } from "@/lib/agent/facts/extractHyvinkaaKaavaFacts"
import { extractSeinajokiKaavaFacts } from "@/lib/agent/facts/extractSeinajokiKaavaFacts"
import { extractRovaniemiKaavaFacts } from "@/lib/agent/facts/extractRovaniemiKaavaFacts"
import { extractMikkeliKaavaFacts } from "@/lib/agent/facts/extractMikkeliKaavaFacts"
import { extractKotkaKaavaFacts } from "@/lib/agent/facts/extractKotkaKaavaFacts"
import { extractSaloKaavaFacts } from "@/lib/agent/facts/extractSaloKaavaFacts"
import { extractPorvooKaavaFacts } from "@/lib/agent/facts/extractPorvooKaavaFacts"
import { extractKokkolaKaavaFacts } from "@/lib/agent/facts/extractKokkolaKaavaFacts"
import { extractKirkkonummiKaavaFacts } from "@/lib/agent/facts/extractKirkkonummiKaavaFacts"
import { extractKeravaKaavaFacts } from "@/lib/agent/facts/extractKeravaKaavaFacts"
import { extractTuusulaKaavaFacts } from "@/lib/agent/facts/extractTuusulaKaavaFacts"
import { extractNurmijarviKaavaFacts } from "@/lib/agent/facts/extractNurmijarviKaavaFacts"
import { extractSipooKaavaFacts } from "@/lib/agent/facts/extractSipooKaavaFacts"
import { extractJarvenpaaKaavaFacts } from "@/lib/agent/facts/extractJarvenpaaKaavaFacts"
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
    const planName = document.raw_payload?.plan_name ?? null
    const address = document.raw_payload?.address ?? null

    return {
      decisions: [],
      facts: extractHelsinkiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        feature,
        center,
        districtName,
        description,
        planName,
        address,
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
    const processingSteps = document.raw_payload?.processing_steps ?? null
    const contact = document.raw_payload?.contact ?? null

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
        processingSteps,
        contact,
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

  if (document.source_name === "Kotkan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractKotkaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
      }),
    }
  }

  if (document.source_name === "Salon ajankohtaiset asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractSaloKaavaFacts({
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

  if (document.source_name === "Porvoon asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractPorvooKaavaFacts({
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

  if (document.source_name === "Kokkolan asemakaavatyöt") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contactName = document.raw_payload?.contact_name ?? null

    return {
      decisions: [],
      facts: extractKokkolaKaavaFacts({
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

  if (document.source_name === "Kirkkonummen kaavoitus") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractKirkkonummiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
      }),
    }
  }

  if (document.source_name === "Keravan kaavahankkeet") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractKeravaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
      }),
    }
  }

  if (document.source_name === "Tuusulan vireillä olevat kaavat") {
    const planName = document.raw_payload?.plan_name ?? null
    const recordNumber = document.raw_payload?.record_number ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contact = document.raw_payload?.contact ?? null
    const center = document.raw_payload?.center ?? null

    return {
      decisions: [],
      facts: extractTuusulaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        planName,
        recordNumber,
        phase,
        description,
        contact,
        center,
      }),
    }
  }

  if (document.source_name === "Nurmijärven ajankohtaiset asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractNurmijarviKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
      }),
    }
  }

  if (document.source_name === "Sipoon vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractSipooKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
      }),
    }
  }

  if (document.source_name === "Järvenpään vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const decisionNumber = document.raw_payload?.decision_number ?? null
    const phase = document.raw_payload?.phase ?? null
    const address = document.raw_payload?.address ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractJarvenpaaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        decisionNumber,
        phase,
        address,
        description,
        contacts,
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

  if (document.source_name === "Espoon ajankohtaiset asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const planType = document.raw_payload?.plan_type ?? null
    const description = document.raw_payload?.description ?? null
    const area = document.raw_payload?.area ?? null
    const changeApplicant = document.raw_payload?.change_applicant ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractEspooKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        planType,
        description,
        area,
        changeApplicant,
        contacts,
      }),
    }
  }

  if (document.source_name === "Lohjan ajankohtaiset kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractLohjaKaavaFacts({
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

  if (document.source_name === "Rauman vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractRaumaKaavaFacts({
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

  if (document.source_name === "Kaarinan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractKaarinaKaavaFacts({
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

  if (document.source_name === "Nokian vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const address = document.raw_payload?.address ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const diaarinumero = document.raw_payload?.diaarinumero ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractNokiaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        address,
        phase,
        description,
        diaarinumero,
        contacts,
      }),
    }
  }

  if (document.source_name === "Kangasalan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractKangasalaKaavaFacts({
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

  if (document.source_name === "Vihdin vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractVihtiKaavaFacts({
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

  if (document.source_name === "Riihimäen vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const slug = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractRiihimakiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        slug,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Raaseporin vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaId = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractRaaseporiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaId,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Raision vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const slug = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractRaisioKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        slug,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Lempäälän vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractLempaalaKaavaFacts({
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

  if (document.source_name === "Raahen vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractRaaheKaavaFacts({
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

  if (document.source_name === "Sastamalan vireillä ja nähtävillä olevat kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractSastamalaKaavaFacts({
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

  if (document.source_name === "Hollolan aktiiviset kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractHollolaKaavaFacts({
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

  if (document.source_name === "Pirkkalan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractPirkkalaKaavaFacts({
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

  if (document.source_name === "Siilinjärven vireillä olevat kaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractSiilinjarviKaavaFacts({
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

  if (document.source_name === "Mäntsälän vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractMantsalaKaavaFacts({
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

  if (document.source_name === "Tornion kaavatori") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractTornioKaavaFacts({
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

  if (document.source_name === "Liedon vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractLietoKaavaFacts({
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

  if (document.source_name === "Naantalin vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractNaantaliKaavaFacts({
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

  if (document.source_name === "Iisalmen vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractIisalmiKaavaFacts({
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

  if (document.source_name === "Mustasaaren vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractMustasaariKaavaFacts({
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

  if (document.source_name === "Kempeleen vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractKempeleKaavaFacts({
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

  if (document.source_name === "Valkeakosken vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractValkeakoskiKaavaFacts({
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

  if (document.source_name === "Pietarsaaren vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractPietarsaariKaavaFacts({
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

  if (document.source_name === "Kurikan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractKurikkaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Varkauden vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractVarkausKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Kemin vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractKemiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Haminan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractHaminaKaavaFacts({
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

  if (document.source_name === "Jämsän vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractJamsaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Laukaan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractLaukaaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Heinolan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractHeinolaKaavaFacts({
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

  if (document.source_name === "Äänekosken vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null

    return {
      decisions: [],
      facts: extractAanekoskiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        kaavaTunnus,
        phase,
        description,
      }),
    }
  }

  if (document.source_name === "Pieksämäen vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractPieksamakiKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Akaan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractAkaaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Forssan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractForssaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Janakkalan vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractJanakkalaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Imatran vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractImatraKaavaFacts({
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

  if (document.source_name === "Ylöjärven vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const slug = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractYlojarviKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        slug,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Savonlinnan asemakaavakuulutukset") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractSavonlinnaKaavaFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        phase,
        description,
        contacts,
      }),
    }
  }

  if (document.source_name === "Kajaanin vireillä olevat asemakaavat") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const kaavaTunnus = document.raw_payload?.kaava_tunnus ?? null
    const phase = document.raw_payload?.phase ?? null
    const description = document.raw_payload?.description ?? null
    const contacts = document.raw_payload?.contacts ?? []

    return {
      decisions: [],
      facts: extractKajaaniKaavaFacts({
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

  if (document.source_name === "Puolustuskiinteistöt uutiset") {
    const title = document.raw_payload?.title ?? document.title ?? null
    const description = document.raw_payload?.description ?? null
    const publishedAt = document.raw_payload?.published_at ?? null
    const completed = document.raw_payload?.completed ?? false

    return {
      decisions: [],
      facts: extractPuolustuskiinteistotFacts({
        documentId: document.id,
        sourceName: document.source_name,
        title,
        description,
        publishedAt,
        completed,
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