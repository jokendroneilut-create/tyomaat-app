import Link from "next/link"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type Props = { searchParams: Promise<{ q?: string; puutteelliset?: string }> }

/*
 * Hankehaku korjausta varten (D-076).
 *
 * Nimihaun lisäksi suodatin "osapuolet puuttuvat", koska se on se joukko
 * jonka vuoksi muokkausreitti ylipäätään tehtiin: mitattu 15.8.2026, 135
 * asiakkaalle näkyvää suunnittelu- tai rakentamisvaiheen hanketta on ilman
 * rakennuttajaa ja urakoitsijaa. Ilman valmista listaa ne pitäisi etsiä
 * käsin yksitellen.
 */
export default async function TicProjectSearchPage({ searchParams }: Props) {
  const { q, puutteelliset } = await searchParams
  const onlyIncomplete = puutteelliset === "1"

  let query = supabaseAdmin
    .from("projects")
    .select("id, name, city, region, phase, developer, builder, estimated_cost")
    .eq("status", "active")
    .limit(60)

  if (q?.trim()) {
    query = query.ilike("name", `%${q.trim()}%`)
  }

  if (onlyIncomplete) {
    query = query
      .or("developer.is.null,developer.eq.")
      .or("builder.is.null,builder.eq.")
      .in("phase", [
        "Suunnittelussa",
        "Suunnittelu",
        "Rakenteilla",
        "Rakentaminen aloitettu",
      ])
  }

  const { data: projects, error } = await query.order("name")

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/tic" className="text-sm text-gray-600 hover:text-gray-900">
        ← Takaisin TICiin
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Hankehaku</h1>
      <p className="mt-2 text-gray-600">
        Hyväksyttyjen hankkeiden tietojen korjaus.
      </p>

      <form className="mt-5 flex flex-wrap items-center gap-3" action="/tic/hanke">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Hankkeen nimi…"
          className="w-72 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            name="puutteelliset"
            value="1"
            defaultChecked={onlyIncomplete}
          />
          Vain osapuolettomat (suunnittelu / rakenteilla)
        </label>

        <button
          type="submit"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Hae
        </button>
      </form>

      {error && <p className="mt-6 text-sm text-red-600">{error.message}</p>}

      <p className="mt-6 text-sm text-gray-500">
        {projects?.length ?? 0} hanketta {q?.trim() ? `haulla "${q.trim()}"` : ""}
      </p>

      <ul className="mt-3 divide-y divide-gray-200 rounded-2xl border border-gray-200 bg-white">
        {(projects ?? []).map((p: any) => (
          <li key={p.id} className="px-5 py-3">
            <Link href={`/tic/hanke/${p.id}`} className="block hover:bg-gray-50">
              <span className="font-medium text-gray-900">{p.name}</span>

              <span className="ml-2 text-sm text-gray-500">
                {[p.city, p.phase].filter(Boolean).join(" · ")}
              </span>

              <span className="mt-1 block text-sm text-gray-600">
                {p.developer || p.builder ? (
                  [p.developer, p.builder].filter(Boolean).join(" / ")
                ) : (
                  <span className="text-red-600">osapuolet puuttuvat</span>
                )}
                {p.estimated_cost
                  ? ` · ${Number(p.estimated_cost).toLocaleString("fi-FI")} €`
                  : ""}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
