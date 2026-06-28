type Props = {
  needsReview: number
  highPriority: number
  tenders: number
  zoning: number
  ignored: number
  failedSources?: number
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
        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          🔥 <strong>{highPriority}</strong> korkean prioriteetin mahdollisuutta löytyi
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          🟡 <strong>{needsReview}</strong> signaalia vaatii päätöksesi
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          📑 <strong>{tenders}</strong> tarjousmahdollisuutta havaittu
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          🏗️ <strong>{zoning}</strong> kaavoitukseen tai varhaiseen hankkeeseen liittyvää signaalia
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          ⚪ <strong>{ignored}</strong> signaalia suodatettiin pois automaattisesti
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 10, padding: 16 }}>
          ⚠️ <strong>{failedSources}</strong> lähdettä epäonnistui viime ajossa
        </div>
      </div>
    </section>
  )
}