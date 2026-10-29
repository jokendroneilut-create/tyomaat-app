import Link from "next/link"
import DuplicateCandidatesReviewList from "../../components/DuplicateCandidatesReviewList"
import {
  getDuplicateCandidates,
  getPendingDuplicateCount,
} from "../../services/getDuplicateCandidates"

export const dynamic = "force-dynamic"

export default async function DuplicatesPage() {
  /*
   * Lukumäärä haetaan erikseen kannasta, jotta lista voi TODISTAA
   * näyttävänsä koko jonon. Jos luvut eroavat, jotain on pudonnut matkalla
   * eikä sitä saa jäädä huomaamatta (D-358).
   */
  const [candidates, pendingCount] = await Promise.all([
    getDuplicateCandidates(),
    getPendingDuplicateCount(),
  ])
  const puuttuu = pendingCount - candidates.length

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

      <p className="mt-3 text-sm font-medium text-gray-500">
        Odottaa tarkistusta: {pendingCount} paria — näytetään kaikki.
      </p>

      {puuttuu !== 0 && (
        <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Listalla on {candidates.length} paria, mutta jonossa odottaa{" "}
          {pendingCount}. {puuttuu > 0 ? `${puuttuu} paria puuttuu` : "Listalla on ylimääräisiä rivejä"} —
          älä pura jonoa ennen kuin syy on selvitetty.
        </div>
      )}

      <section className="mt-8">
        <DuplicateCandidatesReviewList candidates={candidates} />
      </section>
    </main>
  )
}
