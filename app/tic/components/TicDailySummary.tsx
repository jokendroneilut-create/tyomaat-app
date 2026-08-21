/*
 * Luku voi olla null, jos sen kysely epaonnistui. Aiemmin yksikin
 * epaonnistunut laskuri kaatoi koko /tic-sivun 500:aan - myos
 * katselmointijonon. Nyt puuttuva luku nakyy viivana ja jono toimii.
 */
type Props = {
  needsReview: number | null
  highPriority: number | null
  tenders: number | null
  zoning: number | null
  ignored: number | null
  failedSources?: number | null
}

/* Puuttuva luku viivana, jottei se nayta nollalta. */
function Luku({ value }: { value: number | null | undefined }) {
  return <strong>{value ?? "–"}</strong>
}

function Card({
  children,
  href,
}: {
  children: React.ReactNode
  href?: string
}) {
  const style = {
    display: "block",
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 16,
    color: "inherit",
    textDecoration: "none",
  } as const

  if (href) {
    return (
      <a href={href} style={{ ...style, cursor: "pointer" }}>
        {children}
      </a>
    )
  }
  return <div style={style}>{children}</div>
}

export default function TicDailySummary({
  needsReview,
  highPriority,
  tenders,
  zoning,
  ignored,
  failedSources,
}: Props) {
  return (
    <section style={{ marginTop: 24, marginBottom: 32 }}>
      <h2>Mitä sinun kannattaa tehdä tänään?</h2>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <Card href="#review">
          🔥 <Luku value={highPriority} /> korkean prioriteetin mahdollisuutta löytyi
        </Card>

        <Card href="#review">
          🟡 <Luku value={needsReview} /> signaalia vaatii päätöksesi
        </Card>

        <Card href="#review">
          📑 <Luku value={tenders} /> tarjousmahdollisuutta havaittu
        </Card>

        <Card href="#review">
          🏗️ <Luku value={zoning} /> kaavoitukseen tai varhaiseen hankkeeseen liittyvää signaalia
        </Card>

        <Card>
          ⚪ <Luku value={ignored} /> signaalia suodatettiin pois automaattisesti viimeisen 24 h aikana
        </Card>

        <Card href="/tic/operations">
          ⚠️ <Luku value={failedSources} /> lähdettä epäonnistui viime ajossa
        </Card>
      </div>
    </section>
  )
}
