export default function TodayMetrics({
  metrics,
}: {
  metrics: {
    newProjects: number
    approvedToday: number
    highValue: number
    tenders: number
  }
}) {
  return (
    <div className="mt-8 grid gap-6 md:grid-cols-4">
      <MetricCard title="Uudet hankkeet alueellasi, 7 pv" value={metrics.newProjects} />
<MetricCard title="Suositellut hankkeet, 7 pv" value={metrics.highValue} />
<MetricCard title="Päivittyneet hankkeet, 7 pv" value={0} />
<MetricCard title="Tarjouspyynnöt, 7 pv" value={metrics.tenders} />
    </div>
  )
}

function MetricCard({
  title,
  value,
}: {
  title: string
  value: number
}) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  )
}