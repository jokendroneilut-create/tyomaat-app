import Link from "next/link"
import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import EditProject from "./EditProject"
import AiSuggestion from "./AiSuggestion"

export const dynamic = "force-dynamic"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ puutteelliset?: string; q?: string }>
}

const text = (value: unknown) =>
  value === null || value === undefined ? "" : String(value)

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  return new Date(value).toLocaleString("fi-FI")
}

/*
 * Hyväksytyn hankkeen näkymä ja korjauslomake (D-076).
 *
 * TIC:ssä oli tähän asti vain ehdokasnäkymä (`/tic/projects/[id]`), joka
 * lukee `potential_projects`-taulua. Hyväksytylle hankkeelle ei ollut sivua
 * lainkaan, joten sen tietoja ei voinut katsoa eikä korjata TIC:stä.
 */
export default async function TicProjectPage({ params, searchParams }: Props) {
  const { id } = await params
  const view = await searchParams

  /*
   * Paluu palaa SIIHEN näkymään josta tultiin. Aiemmin linkki vei aina
   * suodattamattomaan listaan, joten jonoa purkaessa palasi eteen kaikki
   * hankkeet — mikä näytti siltä ettei jono tyhjentynyt lainkaan.
   */
  const backHref = view.puutteelliset
    ? "/tic/hanke?puutteelliset=1"
    : view.q
      ? `/tic/hanke?q=${encodeURIComponent(view.q)}`
      : "/tic/hanke"

  const backLabel = view.puutteelliset ? "Osapuolettomat" : "Hankehaku"

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (!project) notFound()

  const metadata = (project as any).metadata ?? {}

  const sourceUrl =
    metadata.source_url ??
    (Array.isArray(metadata.source_history)
      ? metadata.source_history.find((h: any) => h?.source_url)?.source_url
      : null)

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href={backHref} className="text-sm text-gray-600 hover:text-gray-900">
        ← {backLabel}
      </Link>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">{(project as any).name}</h1>

        <p className="mt-2 text-gray-600">
          {(project as any).city ?? "Ei kaupunkia"}
          {(project as any).region ? ` · ${(project as any).region}` : ""}
          {(project as any).phase ? ` · ${(project as any).phase}` : ""}
        </p>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Rakennuttaja</dt>
            <dd className="font-medium">{(project as any).developer || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Pääurakoitsija</dt>
            <dd className="font-medium">{(project as any).builder || "—"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Arvioitu kustannus</dt>
            <dd className="font-medium">
              {(project as any).estimated_cost
                ? `${Number((project as any).estimated_cost).toLocaleString("fi-FI")} €`
                : "—"}
              {metadata.cost_source ? (
                <span className="ml-2 text-xs text-gray-500">
                  ({metadata.cost_source})
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Lähde</dt>
            <dd className="font-medium">
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-700 underline"
                >
                  {metadata.source_name ?? "Avaa lähde"}
                </a>
              ) : (
                <span className="text-red-600">puuttuu</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Luotu</dt>
            <dd>{formatDate((project as any).created_at)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Muokattu käsin</dt>
            <dd>
              {metadata.edited_at ? (
                <>
                  {formatDate(metadata.edited_at)}
                  {Array.isArray(metadata.edited_fields) && metadata.edited_fields.length ? (
                    <span className="ml-2 text-xs text-gray-500">
                      ({metadata.edited_fields.join(", ")})
                    </span>
                  ) : null}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
        </dl>
      </section>

      {metadata.ai_suggestion ? (
        <AiSuggestion
          projectId={id}
          suggestion={metadata.ai_suggestion}
          current={{
            developer: text((project as any).developer),
            builder: text((project as any).builder),
            estimatedCost: (project as any).estimated_cost
              ? String((project as any).estimated_cost)
              : "",
          }}
        />
      ) : null}

      <EditProject
        projectId={id}
        initial={{
          name: text((project as any).name),
          region: text((project as any).region),
          city: text((project as any).city),
          location: text((project as any).location),
          developer: text((project as any).developer),
          builder: text((project as any).builder),
          propertyType: text((project as any).property_type),
          phase: text((project as any).phase),
          estimatedCost: (project as any).estimated_cost
            ? String((project as any).estimated_cost)
            : "",
          estimatedCompletion: text((project as any).estimated_completion),
          additionalInfo: text((project as any).additional_info),
        }}
      />
    </main>
  )
}
