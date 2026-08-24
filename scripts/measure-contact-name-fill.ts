import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: voiko nimetta jaanyt yhteystieto taydentaa saman henkilon
 * toisesta hankkeesta?
 *
 * Havainto joka johti tahan: sama projektinjohtaja vetaa yleensa
 * useampaa hanketta. Mika Seppala on Taulumaen vesitornissa pelkka nimi,
 * mutta Kimolan kanavassa han on mukana sahkoposteineen.
 *
 * SAMA NIMI EI YKSIN RIITA. Kaksi eri "Mika Seppalaa" eri yrityksissa on
 * taysin mahdollista. Siksi mitataan erikseen:
 *   A) sama nimi + SAMA LAHDE   (yritysläheessa = sama tyonantaja)
 *   B) sama nimi + eri lahde    (riskialtis, vain vertailuluku)
 *
 * Ei kirjoita mitaan.
 */

const nrm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const lataa = async (taulu: string, sarakkeet: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(taulu).select(sarakkeet).range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  const rivit = [
    ...(await lataa("projects", "id,name,metadata")).map((p: any) => ({ ...p, taulu: "projects", nimi: p.name })),
    ...(await lataa("potential_projects", "id,title,metadata")).map((p: any) => ({ ...p, taulu: "potential_projects", nimi: p.title })),
  ]

  /* nimi -> lahde -> {email, phone} */
  const tunnetut = new Map<string, Map<string, { email: string | null; phone: string | null; mista: string }>>()
  let kontakteja = 0, nimettomia = 0, vajaita = 0

  for (const p of rivit) {
    const lahde = nrm(p.metadata?.source_name)
    for (const c of (p.metadata?.contact_persons ?? []) as any[]) {
      kontakteja++
      const nimi = nrm(c?.name)
      if (!nimi) { nimettomia++; continue }
      if (!c?.email && !c?.phone) { vajaita++; continue }
      if (!tunnetut.has(nimi)) tunnetut.set(nimi, new Map())
      if (!tunnetut.get(nimi)!.has(lahde)) {
        tunnetut.get(nimi)!.set(lahde, { email: c.email ?? null, phone: c.phone ?? null, mista: String(p.nimi).slice(0, 40) })
      }
    }
  }

  let samaLahde = 0, eriLahde = 0, eiLoydy = 0
  const naytteetA: string[] = []
  const naytteetB: string[] = []

  for (const p of rivit) {
    const lahde = nrm(p.metadata?.source_name)
    for (const c of (p.metadata?.contact_persons ?? []) as any[]) {
      const nimi = nrm(c?.name)
      if (!nimi || c?.email || c?.phone) continue
      const perLahde = tunnetut.get(nimi)
      if (!perLahde) { eiLoydy++; continue }
      if (perLahde.has(lahde)) {
        samaLahde++
        const t = perLahde.get(lahde)!
        if (naytteetA.length < 12) naytteetA.push(`  ${String(c.name).slice(0,20).padEnd(22)} ${String(t.email ?? t.phone).padEnd(30)} <- "${t.mista}"`)
      } else {
        eriLahde++
        const [muuLahde, t] = [...perLahde.entries()][0]
        if (naytteetB.length < 8) naytteetB.push(`  ${String(c.name).slice(0,20).padEnd(22)} ${String(t.email ?? t.phone).padEnd(30)} <- eri lahde: ${muuLahde.slice(0,26)}`)
      }
    }
  }

  console.log(`hankkeita (nakyvat + jono): ${rivit.length}`)
  console.log(`yhteyshenkilorivja:         ${kontakteja}`)
  console.log(`  nimettomia:               ${nimettomia}`)
  console.log(`  nimi mutta EI osoitetta:  ${vajaita}\n`)
  console.log(`taydennettavissa:`)
  console.log(`  A) sama nimi + SAMA lahde: ${samaLahde}   <- turvallinen`)
  console.log(`  B) sama nimi + eri lahde:  ${eriLahde}   <- riskialtis`)
  console.log(`  ei loydy mistaan:          ${eiLoydy}`)

  if (naytteetA.length) { console.log("\nA-naytteita (sama lahde):"); for (const n of naytteetA) console.log(n) }
  if (naytteetB.length) { console.log("\nB-naytteita (eri lahde - ALA toteuta ilman katselmusta):"); for (const n of naytteetB) console.log(n) }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
