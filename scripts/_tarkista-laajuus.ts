import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * Tasavalinen otos jokaisesta laajuusluokasta luettavaksi.
 * Ei kirjoita mitaan.
 */

const PER_LUOKKA = Number(process.argv[2] ?? 12)

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; f < 60000; f += 500) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, status, is_public, metadata")
      .range(f, f + 499)
    if (error) throw error
    if (!data?.length) break
    rivit.push(...data)
    if (data.length < 500) break
  }

  const nakyvat = rivit.filter((r) => r.status === "active" && r.is_public !== false)
  const luokat = new Map<string, any[]>()
  for (const r of nakyvat) {
    const l = String((r.metadata ?? {}).laajuus ?? "")
    if (!l) continue
    const lista = luokat.get(l) ?? []
    lista.push(r)
    luokat.set(l, lista)
  }

  for (const [luokka, lista] of [...luokat.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const vali = Math.max(1, Math.floor(lista.length / PER_LUOKKA))
    const otos = lista.filter((_, i) => i % vali === 0).slice(0, PER_LUOKKA)
    console.log(`\n=== ${luokka.toUpperCase()}  (${lista.length} kpl, otos ${otos.length} tasavalein)`)
    for (const r of otos) console.log(`   ${String(r.name).slice(0, 92)}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
