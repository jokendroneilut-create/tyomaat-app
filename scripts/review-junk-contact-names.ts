import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KATSELMOINTI: yhteyshenkilon "nimi" joka ei ole nimi.
 *
 * Mitattu 25.8.2026: 64 tapausta, joissa sahkoposti ei tasmaa nimeen
 * KOSKA nimi on roskaa - puhelinnumeron pala, nimike tai yrityksen nimi.
 * Nama eivat ole yhta vaarallisia kuin vaara osoite (osoite voi olla
 * oikea), mutta nimi nayttaa asiakkaalle sekavalta.
 *
 * Ei kirjoita mitaan.
 */

const poista = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const nrm = (s: unknown) => poista(String(s ?? "").trim().toLowerCase()).replace(/[^a-z ]/g, "").replace(/\s+/g, " ")

function tasmaako(nimi: string, email: string): boolean | null {
  const local = poista(String(email).toLowerCase().split("@")[0])
  const osat = local.split(".").map((o) => o.replace(/[^a-z]/g, ""))
  if (osat.length !== 2 || osat[0].length < 3 || osat[1].length < 3) return null
  const nimenOsat = nrm(nimi).split(" ")
  return osat.some((o) => nimenOsat.some((n) => n.length > 2 && (n.startsWith(o) || o.startsWith(n))))
}

const YRITYS = /(\boy\b|\bab\b|\bky\b|sitowise|fcg|ramboll|afry|plandea|arkkitehdit)/i
const NIMIKE = /(suunnittelij|arkkitehti|paallikk|insinoori|johtaja|safa|lautakunta|palvelu|sihteeri|kaavoitus|tekninen)/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const lataa = async (t: string, s: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select(s).range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  const rivit = [
    ...(await lataa("projects", "id,name,metadata")).map((p: any) => ({ ...p, nimi: p.name, taulu: "projects" })),
    ...(await lataa("potential_projects", "id,title,metadata")).map((p: any) => ({ ...p, nimi: p.title, taulu: "potential_projects" })),
  ]

  const lajit = new Map<string, number>()
  const naytteet = new Map<string, string[]>()

  for (const p of rivit) {
    for (const c of (p.metadata?.contact_persons ?? []) as any[]) {
      const email = String(c?.email ?? "").trim()
      const nimi = String(c?.name ?? "")
      if (!email.includes("@")) continue
      /*
       * NIMETON YHTEYSTIETO EI OLE ROSKANIMI. Niita on 790 ja ne ovat
       * yleensa kirjaamo-osoitteita ilman henkiloa - taysin kelvollisia.
       * Ensimmainen versio laski ne mukaan ja sai 857 kappaletta 64:n
       * sijaan.
       */
      if (!nimi.trim()) continue
      if (/^etunimi\.sukunimi@/i.test(email)) continue
      if (tasmaako(nimi, email) !== false) continue

      const sanat = nimi.trim().split(/\s+/)
      const onNimi =
        !/\d/.test(nimi) && sanat.length >= 2 && sanat.every((s) => /^[A-ZÅÄÖ]/.test(s)) &&
        !YRITYS.test(nimi) && !NIMIKE.test(poista(nimi))
      if (onNimi) continue

      const laji =
        /\d/.test(nimi) ? "numero nimessa"
        : YRITYS.test(nimi) ? "yritys nimena"
        : NIMIKE.test(poista(nimi)) ? "nimike nimena"
        : sanat.length < 2 ? "yksi sana"
        : "muu"

      lajit.set(laji, (lajit.get(laji) ?? 0) + 1)
      if (!naytteet.has(laji)) naytteet.set(laji, [])
      const lista = naytteet.get(laji)!
      if (lista.length < 7) lista.push(`    ${nimi.slice(0, 34).padEnd(36)} ${email.slice(0, 36)}`)
    }
  }

  const yht = [...lajit.values()].reduce((a, b) => a + b, 0)
  console.log(`roskanimia: ${yht}\n`)
  for (const [k, v] of [...lajit].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)
  for (const [k, vs] of naytteet) {
    console.log(`\n  ${k}:`)
    for (const v of vs) console.log(v)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
