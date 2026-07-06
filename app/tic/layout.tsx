import Link from "next/link"

export default function TicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nav = [
    { href: "/tic", label: "🏠 Etusivu" },
    { href: "/tic/projects", label: "📋 Potentiaaliset hankkeet" },
    { href: "/tic/operations", label: "🧭 Operations" },
    { href: "/tic/discovery", label: "🔍 Discovery" },
    { href: "/tic/discovery/documents", label: "📄 Dokumentit" },
    { href: "/tic/discovery/analytics", label: "📈 Analytics" },
    { href: "/tic/discovery/health", label: "🩺 Health" },
  ]

  return (
    <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8">
      <aside className="w-64 shrink-0">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-4 text-lg font-bold">
            Tyomaat Intelligence Center
          </h2>

          <nav className="space-y-2">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        {children}
      </main>
    </div>
  )
}