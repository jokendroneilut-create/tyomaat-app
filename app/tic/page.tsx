import CandidateList from "./components/CandidateList"

export const dynamic = "force-dynamic"

export default async function TicPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Työmaat Intelligence Center
        </h1>

        <p className="mt-2 text-gray-600">
          Päivittäinen työpöytä rakennusmarkkinan mahdollisuuksien seurantaan.
        </p>
      </section>

      <section className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">
          Mitä sinun kannattaa tehdä tänään?
        </h2>

        <p className="mt-2 text-gray-600">
          Alla näkyvät järjestelmän tunnistamat Candidate-hankkeet prioriteetin mukaan.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">
          Rakennushankkeet
        </h2>

        <CandidateList />
      </section>
    </main>
  )
}