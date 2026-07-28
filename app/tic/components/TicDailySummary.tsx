type Props = {
  needsReview: number
  highPriority: number
  tenders: number
  zoning: number
  ignored: number
  failedSources?: number
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
  failedSources = 0,
}: Props) {
  return (
    <section style={{ marginTop: 24, marginBottom: 32 }}>
      <h2>Mitä sinun kannattaa tehdä tänään?</h2>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <Card href="#review">
          🔥 <strong>{highPriority}</strong> korkean prioriteetin mahdollisuutta löytyi
        </Card>

        <Card href="#review">
          🟡 <strong>{needsReview}</strong> signaalia vaatii päätöksesi
        </Card>

        <Card href="#review">
          📑 <strong>{tenders}</strong> tarjousmahdollisuutta havaittu
        </Card>

        <Card href="#review">
          🏗️ <strong>{zoning}</strong> kaavoitukseen tai varhaiseen hankkeeseen liittyvää signaalia
        </Card>

        <Card>
          ⚪ <strong>{ignored}</strong> signaalia suodatettiin pois automaattisesti
        </Card>

        <Card href="/tic/operations">
          ⚠️ <strong>{failedSources}</strong> lähdettä epäonnistui viime ajossa
        </Card>
      </div>
    </section>
  )
}
