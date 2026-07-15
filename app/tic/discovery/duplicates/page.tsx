import Link from "next/link"
import DuplicateCandidatesReviewList from "../../components/DuplicateCandidatesReviewList"
import { getDuplicateCandidates } from "../../services/getDuplicateCandidates"

export const dynamic = "force-dynamic"

export default async function DuplicatesPage() {
  const candidates = await getDuplicateCandidates(100)

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/tic/discovery" className="text-sm text-gray-600">
        ← Takaisin Discoveryyn
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">
        Mahdolliset kaksoiskappaleet
      </h1>

      <p className="mt-2 text-gray-600">
        Hankkeita, jotka muistuttavat toisiaan riittävästi ollakseen sama
        hanke kahteen kertaan. Tarkista pari ja joko vahvista
        kaksoiskappaleeksi (voit piilottaa toisen suoraan täältä) tai
        merkitse ettei kyse ole samasta hankkeesta.
      </p>

      <section className="mt-8">
        <DuplicateCandidatesReviewList candidates={candidates} />
      </section>
    </main>
  )
}
