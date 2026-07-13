import Link from "next/link"
import type { Candidate } from "../types/candidate"

type Props = {
  candidate: Candidate
}

function formatDate(value: string | null) {
  if (!value) return "Ei havaintoa"
  return new Date(value).toLocaleDateString("fi-FI")
}

export default function CandidateCard({ candidate }: Props) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md">
      <Link href={`/tic/candidate/${candidate.id}`} className="block">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-900">
              {candidate.title}
            </h3>

            <p className="mt-1 text-sm text-gray-600">
              {candidate.city ?? "Ei kaupunkia"}
              {candidate.location ? ` · ${candidate.location}` : ""}
            </p>
          </div>

          <div className="sm:text-right">
            <div className="text-2xl font-bold text-gray-900">
              {candidate.score ?? 0}
            </div>
            <div className="text-xs text-gray-500">prioriteetti</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div>
            <div className="text-gray-500">Luottamus</div>
            <div className="font-semibold">{candidate.confidence ?? 0}%</div>
          </div>

          <div>
            <div className="text-gray-500">Signaaleja</div>
            <div className="font-semibold">{candidate.signal_count}</div>
          </div>

          <div>
            <div className="text-gray-500">Viimeisin havainto</div>
            <div className="font-semibold">
              {formatDate(candidate.last_signal_at)}
            </div>
          </div>
        </div>

        {candidate.reason && (
          <p className="mt-4 text-sm text-gray-700">{candidate.reason}</p>
        )}
      </Link>

      <div className="mt-4 flex flex-wrap gap-2">
        <button className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white">
          Luo projekti
        </button>

        <button className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          Ei relevantti
        </button>
      </div>
    </article>
  )
}