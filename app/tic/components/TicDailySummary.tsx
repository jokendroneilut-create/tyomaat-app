/*
 * KAKSI RIVIA JOISSA ON TYOTA (D-239).
 *
 * Tassa oli ennen kuuden kortin lista "Mita sinun kannattaa tehda
 * tanaan?". Mittarit ottivat sen paikan, ja Johannes 6.10.2026 valitsi
 * naista kaksi jaamaan: *"tuo 90 signaalia vaatii paatoksesi ja 4
 * lahdetta epaonnistui voi jaada."*
 *
 * Nelja muuta korttia olivat saman jonon alaerittelya (korkea
 * prioriteetti, tarjoukset, kaavoitus) tai pelkka tilasto
 * (automaattisesti suodatetut) — ne eivat kertoneet mita tehda, vaan
 * toistivat eri sanoin saman jonon joka on sivulla alempana.
 */
type Props = {
  needsReview: number | null
  failedSources?: number | null
}

/* Puuttuva luku viivana, jottei se nayta nollalta. */
function Luku({ value }: { value: number | null | undefined }) {
  return <strong>{value ?? "–"}</strong>
}

export default function TicDailySummary({ needsReview, failedSources }: Props) {
  return (
    <section className="mb-8 grid gap-2 sm:grid-cols-2">
      <a
        href="#review"
        className="rounded-xl border border-gray-200 px-4 py-3 text-gray-900 no-underline hover:bg-gray-50"
      >
        🟡 <Luku value={needsReview} /> signaalia vaatii päätöksesi
      </a>

      <a
        href="/tic/operations"
        className="rounded-xl border border-gray-200 px-4 py-3 text-gray-900 no-underline hover:bg-gray-50"
      >
        ⚠️ <Luku value={failedSources} /> lähdettä epäonnistui viime ajossa
      </a>
    </section>
  )
}
