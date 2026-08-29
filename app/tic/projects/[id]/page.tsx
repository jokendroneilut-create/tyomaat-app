import Link from "next/link"
import { notFound } from "next/navigation"
import { getCandidate } from "../../services/getCandidate"
import ProjectActions from "./ProjectActions"
import MergeIntoProject from "./MergeIntoProject"
import EditableCandidate from "./EditableCandidate"
import { resolveExpiry } from "@/lib/projects/tenderExpiry"
import { resolveWinnerName } from "@/lib/projects/winnerName"

export const dynamic = "force-dynamic"

type Props = {
  params: Promise<{
    id: string
  }>
}

function formatDate(value: string | null) {
  if (!value) return "Ei havaintoa"
  return new Date(value).toLocaleString("fi-FI")
}

export default async function CandidateDetailPage({ params }: Props) {
  const { id } = await params
  const detail = await getCandidate(id)

  if (!detail) {
    notFound()
  }

  const { candidate, signals, sourceHistory } = detail
  const metadata = candidate.metadata ?? {}
  const contactPersons: {
    name: string
    title: string | null
    phone: string | null
    email: string | null
    role?: string | null
  }[] =
    Array.isArray(metadata.contact_persons) ? metadata.contact_persons : []

  const consultants: { name: string; role: string | null }[] = Array.isArray(
    metadata.consultants
  )
    ? metadata.consultants.filter(
        (c: any) => c && typeof c.name === "string" && c.name.trim()
      )
    : []

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic" className="text-sm text-gray-600 hover:text-gray-900">
        ← Takaisin TICiin
      </Link>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {candidate.title}
            </h1>

            <p className="mt-2 text-gray-600">
              {candidate.city ?? "Ei kaupunkia"}
              {candidate.location ? ` · ${candidate.location}` : ""}
            </p>

            {candidate.reason && (
              <p className="mt-4 text-gray-700">{candidate.reason}</p>
            )}
          </div>

          <div className="text-right">
            <div className="text-4xl font-bold text-gray-900">
              {candidate.score ?? 0}
            </div>
            <div className="text-sm text-gray-500">prioriteetti</div>
          </div>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <ProjectActions candidateId={candidate.id} />

          {/*
            * Osa ehdokkaista on uutta tietoa jo tunnetusta hankkeesta - esim.
            * urakoitsijan valinta - eikä uusi hanke. Ilman tätä sellaisen voi
            * vain hyväksyä duplikaatiksi tai hylätä, jolloin tieto katoaa.
            */}
          <MergeIntoProject candidateId={candidate.id} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Luottamus</div>
            <div className="mt-1 text-xl font-semibold">
              {candidate.confidence ?? 0}%
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Signaaleja</div>
            <div className="mt-1 text-xl font-semibold">
              {candidate.signal_count}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Lähteitä</div>
            <div className="mt-1 text-xl font-semibold">
              {candidate.source_count}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Viimeisin havainto</div>
            <div className="mt-1 text-sm font-semibold">
              {formatDate(candidate.last_signal_at)}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Esikatselu — näin hanke näkyisi hyväksynnän jälkeen
        </h2>

        <EditableCandidate
          candidateId={candidate.id}
          initial={{
            title: metadata.operation ?? candidate.title ?? "",
            region: metadata.region ?? "",
            city: candidate.city ?? "",
            address: candidate.location ?? "",
            developer: metadata.developer ?? "",
            builder: metadata.builder ?? resolveWinnerName(metadata) ?? "",
            relatedCompanies: Array.isArray(metadata.related_companies)
              ? metadata.related_companies.join(", ")
              : "",
            buildingType: metadata.building_type ?? "",
            phaseHint: metadata.phase_hint ?? metadata.decision_status ?? "",
          }}
          initialContacts={(Array.isArray(metadata.contact_persons)
            ? metadata.contact_persons
            : []
          ).map((c: any) => ({
            name: String(c?.name ?? ""),
            title: String(c?.title ?? ""),
            email: String(c?.email ?? ""),
            phone: String(c?.phone ?? ""),
          }))}
          sources={metadata.field_sources ?? {}}
          streetHint={metadata.street_hint ?? null}
        />

        {typeof metadata.site_area_m2 === "number" && (
          <p className="mt-2 text-sm text-gray-800">
            <strong>📐 Kaava-alueen pinta-ala:</strong> {Math.round(metadata.site_area_m2).toLocaleString("fi-FI")} m²
          </p>
        )}

        {/*
          * KUULUTUKSEN LOMAKEKENTAT.
          *
          * Nama olivat lahteessa mutta eivat nakyneet missaan: kaavan
          * kayttotarkoitus ("T-6; teollisuus- ja varastorakennusten
          * korttelialue"), pinta-ala, kerrosala ja rakennusoikeus.
          * Juuri naista naki hankkeen mittaluokan.
          */}
        {(() => {
          const kentat: [string, unknown][] = [
            ["🏷️ Kaavan käyttötarkoitus", metadata.plan_use_purpose],
            ["🗺️ Kaavatilanne", metadata.plan_status],
            ["📐 Tontin pinta-ala", metadata.site_area_text],
            ["🏗️ Kerrosala", metadata.floor_area_text],
            ["📊 Rakennusoikeus", metadata.building_right_text],
            ["📦 Tilavuus", metadata.volume_text],

            /*
             * Nama olivat metatiedoissa mutta eivat nakyneet missaan.
             * Wartsilan laajennuksessa laajuus "11 000 bruttoneliometria"
             * oli poimittu, mutta katselmoija ei nahnyt sita - eli
             * hankkeen mittaluokka jai arvailun varaan.
             */
            ["📏 Laajuus", metadata.laajuus],
            ["🏠 Asuntoja", metadata.apartments],
            ["📅 Arvioitu valmistuminen", metadata.estimated_completion],
            ["🚧 Rakentamisen aloitus", metadata.construction_start],
            ["🗓️ Rakentamisen aikataulu", metadata.rakentamisen_aikataulu],
            ["💶 Arvioitu kustannus", metadata.estimated_cost],
            ["📝 Urakkamuoto", metadata.urakkamuoto],
            ["🔢 Lupanumero", metadata.permit_number],
            ["🗝️ Kiinteistötunnus", metadata.property_id],
          ]
          const naytettavat = kentat.filter(
            ([, v]) =>
              (typeof v === "string" && v.trim()) ||
              (typeof v === "number" && Number.isFinite(v))
          )
          if (!naytettavat.length) return null

          return (
            <div className="mt-3 grid gap-1 text-sm text-gray-800 md:grid-cols-2">
              {naytettavat.map(([otsikko, arvo]) => (
                <p key={otsikko}>
                  <strong>{otsikko}:</strong> {String(arvo)}
                </p>
              ))}
            </div>
          )
        })()}

        {/*
          * MUUT POIMITUT KENTAT.
          *
          * Ylla oleva lista on kuratoitu, joten uusi lahde voi tuoda
          * kentan jota kukaan ei muista lisata siihen - ja silloin tieto
          * on kannassa mutta katselmoija ei nae sita. Tama lohko nayttaa
          * loput, jotta paatos tehdaan kaikella mita on poimittu.
          *
          * Putkiston omat kentat on rajattu pois: ne kertovat mista tieto
          * tuli, eivat hankkeesta.
          */}
        {(() => {
          const putkisto = new Set([
            "source", "source_name", "source_url", "source_document_id",
            "source_history", "firstSourceName", "resolver", "operation",
            "field_sources", "llm_relevance", "enriched_at", "region",
            "city", "description", "related_companies", "contact_persons",
            "phase_hint", "building_type", "developer", "builder",
            "street_hint", "matched_existing_project_id", "documents_url",
            "construction_type", "size_class", "business_value",
            "recommended_action", "classification_confidence",
            "classification_reasons", "expire_at", "expire_reason",
            "winners", "decision_status", "cost_source", "location",
            "plan_use_purpose", "plan_status", "site_area_text",
            "site_area_m2", "floor_area_text", "building_right_text",
            "volume_text", "laajuus", "apartments", "estimated_completion",
            "construction_start", "rakentamisen_aikataulu",
            "estimated_cost", "urakkamuoto", "permit_number", "property_id",
          ])

          const muut = Object.entries(metadata as Record<string, unknown>)
            .filter(([avain]) => !putkisto.has(avain))
            .filter(
              ([, arvo]) =>
                (typeof arvo === "string" && arvo.trim()) ||
                (typeof arvo === "number" && Number.isFinite(arvo)) ||
                typeof arvo === "boolean"
            )

          if (!muut.length) return null

          return (
            <details className="mt-3 text-sm text-gray-700">
              <summary className="cursor-pointer font-semibold">
                Muut poimitut kentät ({muut.length})
              </summary>
              <div className="mt-2 grid gap-1 md:grid-cols-2">
                {muut.map(([avain, arvo]) => (
                  <p key={avain}>
                    <span className="text-gray-500">{avain}:</span> {String(arvo)}
                  </p>
                ))}
              </div>
            </details>
          )
        })()}

        {(() => {
          const exp = resolveExpiry(
            metadata,
            metadata.phase_hint,
            candidate.last_signal_at
          )
          if (!exp) return null
          return (
            <p className="mt-2 text-sm text-gray-800">
              <strong>⏳ Vanhenee:</strong>{" "}
              {exp.date.toLocaleDateString("fi-FI")}{" "}
              <span className="text-gray-500">
                (hyväksynnän jälkeen, ellei voittajaa selviä sitä ennen)
              </span>
            </p>
          )
        })()}

        {contactPersons.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="mb-2 font-semibold text-gray-900">Yhteyshenkilöt</p>
            {contactPersons.map((contact, i) => (
              <p key={i} className="text-sm text-gray-800">
                {contact.name}
                {contact.title ? `, ${contact.title}` : ""}
                {contact.phone ? ` — ${contact.phone}` : ""}
                {contact.email ? ` — ${contact.email}` : ""}
                {/* Viranomainen tuntee hankkeen muttei osta mitaan. */}
                {contact.role === "authority" ? (
                  <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                    viranomainen
                  </span>
                ) : null}
              </p>
            ))}
          </div>
        )}

        {consultants.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="mb-2 font-semibold text-gray-900">
              Selvitykset ja konsultit
            </p>
            {consultants.map((c, i) => (
              <p key={i} className="text-sm text-gray-800">
                {c.name}
                {c.role ? ` — ${c.role}` : ""}
              </p>
            ))}
          </div>
        )}

        {(metadata.description || metadata.operation) && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="mb-2 font-semibold text-gray-900">Lisätietoja</p>
            <p className="whitespace-pre-line text-sm text-gray-700">
              {metadata.description ?? metadata.operation}
            </p>
          </div>
        )}

        {(metadata.source_url || metadata.documents_url) && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-4">
            {metadata.source_url && (
              <a
                href={metadata.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 underline"
              >
                Avaa alkuperäinen ilmoitus →
              </a>
            )}
            {metadata.documents_url && (
              <a
                href={metadata.documents_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 underline"
              >
                Avaa lähdesivu / asiakirjat →
              </a>
            )}
          </div>
        )}
      </section>

      {sourceHistory.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900">
            Lähdehistoria
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Kaikki hanketta koskeneet ilmoitukset aikajärjestyksessä (uusin ensin).
          </p>

          <ol className="mt-4 space-y-3">
            {[...sourceHistory]
              .sort((a, b) => {
                const at = new Date(a.date_published ?? a.seen_at).getTime()
                const bt = new Date(b.date_published ?? b.seen_at).getTime()
                return bt - at
              })
              .map((entry, i) => (
                <li
                  key={entry.source_document_id ?? `${entry.seen_at}-${i}`}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">
                      {entry.source_name ?? "Tuntematon lähde"}
                    </span>
                    {entry.is_contract_award && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        Voittaja ratkennut
                      </span>
                    )}
                    {entry.notice_type && (
                      <span className="text-sm text-gray-500">
                        {entry.notice_type}
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm text-gray-500">
                    {entry.date_published
                      ? `Julkaistu ${formatDate(entry.date_published)}`
                      : `Havaittu ${formatDate(entry.seen_at)}`}
                  </p>

                  {entry.winners && entry.winners.length > 0 && (
                    <p className="mt-2 text-sm text-gray-800">
                      <strong>Voittaja:</strong> {entry.winners.join(", ")}
                    </p>
                  )}
                </li>
              ))}
          </ol>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900">
          Signaalit ja lähteet
        </h2>

        <div className="mt-4 space-y-3">
          {signals.map((signal) => (
            <article
              key={signal.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {signal.title}
                  </h3>

                  <p className="mt-1 text-sm text-gray-600">
                    {signal.source_name ?? "Tuntematon lähde"} ·{" "}
                    {signal.normalized_signal_type ?? "luokittelematon"} ·{" "}
                    {formatDate(signal.created_at)}
                  </p>
                </div>

                <div className="text-right text-sm">
                  <div className="font-semibold">
                    {signal.relevance_score ?? 0}
                  </div>
                  <div className="text-gray-500">pistettä</div>
                </div>
              </div>

              {signal.classification_reason && (
                <p className="mt-3 text-sm text-gray-700">
                  {signal.classification_reason}
                </p>
              )}

              {signal.source_url && (
                <a
                  href={signal.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-sm font-medium text-gray-900 underline"
                >
                  Avaa lähde →
                </a>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}