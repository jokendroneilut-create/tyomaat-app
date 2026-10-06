import PotentialProjectsReviewList from "./components/PotentialProjectsReviewList"
import TicDailySummary from "./components/TicDailySummary"
import KattavuusMittari from "./components/KattavuusMittari"
import KattavuusTrendi from "./components/KattavuusTrendi"
import { getPotentialProjectsForReview } from "./services/getPotentialProjectsForReview"
import { getPendingReviewCount } from "./services/getPendingReviewCount"
import { getTicDailySummary } from "./services/getTicDailySummary"
import { getYhteystietoMittarit } from "./services/getYhteystietoMittarit"

export const dynamic = "force-dynamic"

export default async function TicPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number(pageParam) || 1)

  const [potentialProjects, pendingReviewCount, summary, mittarit] = await Promise.all([
    getPotentialProjectsForReview(page),
    getPendingReviewCount(),
    getTicDailySummary(),
    getYhteystietoMittarit(),
  ])

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Työmaat Intelligence Center
        </h1>
      </section>

      {/*
        * YHTEYSTIEDON KATTAVUUS KARKEEN (D-239). Tama on se luku jonka
        * varassa koko palvelun hyoty on: hanke ilman yhteyshenkiloa on
        * asiakkaalle liidi jolle ei ole ketaan soitettavaa. Mittari
        * nayttaa nykytilan, graafi suunnan.
        */}
      {mittarit.kattavuus.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Yhteyshenkilön kattavuus
          </h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mittarit.kattavuus.map((k) => (
              <KattavuusMittari key={k.vaihe} kattavuus={k} />
            ))}
            {mittarit.kattavuus.map((k) => (
              <KattavuusTrendi
                key={`trendi-${k.vaihe}`}
                vaihe={k.vaihe}
                pisteet={mittarit.historia[k.vaihe] ?? []}
              />
            ))}
          </div>

          <p className="mt-2 text-xs text-gray-500">
            Lasketaan asiakkaalle näkyvistä aktiivisista hankkeista. Mukaan
            lasketaan vain nimetty henkilö, jolla on sähköposti tai puhelin —
            ei nimettömiä postilaatikoita eikä päätöksen tehnyttä
            viranomaista.
          </p>
        </section>
      )}

      <TicDailySummary
        needsReview={summary.needsReview}
        failedSources={summary.failedSources}
      />

      <section id="review" className="mb-8">
        <PotentialProjectsReviewList
          projects={potentialProjects}
          totalCount={pendingReviewCount}
          page={page}
        />
      </section>
    </main>
  )
}
