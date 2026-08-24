import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * NIMETTA JAANEEN YHTEYSTIEDON TAYDENNYS SAMAN HENKILON TOISESTA HANKKEESTA.
 *
 * Lahtokohta oli omistajan huomio: "sama projektinjohtaja vetaa yleensa
 * useampaa hanketta". Mitattu 25.8.2026: 571 yhteystiedolla on nimi mutta
 * ei osoitetta, ja 37 niista loytyy samasta lahteesta osoitteen kanssa.
 *
 * TAMA TEHDAAN VIIMEISENA JA EHDOLLA. Ensimmainen yritys olisi kopioinut
 * Johanna Backasille osoitteen niclas.skog@raasepori.fi, koska lahde
 * itse oli vaarin. Siksi:
 *
 *   1. Vain SAMA LAHDE. Kaksi eri "Mika Seppalaa" eri yrityksissa on
 *      taysin mahdollista; saman lahteen sisalla se on epatodennakoista.
 *   2. Vain sellaisesta tietueesta jonka OMA nimi ja osoite tasmaavat
 *      (etunimi.sukunimi@). Tarkistamaton lahde levittaisi virhetta.
 *   3. Puhelin kopioidaan vain jos samassa tietueessa on myos tarkistettu
 *      sahkoposti - pelkkaa numeroa ei voi varmentaa mitenkaan.
 *
 * VAIN LISAYS: olemassa olevaa ei koskaan korvata.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

const poista = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const nrm = (s: unknown) => poista(String(s ?? "").trim().toLowerCase()).replace(/[^a-z ]/g, "").replace(/\s+/g, " ")

function tasmaako(nimi: string, email: string): boolean {
  const local = poista(String(email).toLowerCase().split("@")[0])
  const osat = local.split(".").map((o) => o.replace(/[^a-z]/g, ""))
  if (osat.length !== 2 || osat[0].length < 3 || osat[1].length < 3) return false
  const nimenOsat = nrm(nimi).split(" ")
  return osat.some((o) => nimenOsat.some((n) => n.length > 2 && (n.startsWith(o) || o.startsWith(n))))
}

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

  /* nimi|lahde -> TARKISTETTU tietue */
  const lahteet = new Map<string, { email: string; phone: string | null; mista: string }>()
  for (const p of rivit) {
    const lahde = nrm(p.metadata?.source_name)
    for (const c of (p.metadata?.contact_persons ?? []) as any[]) {
      const email = String(c?.email ?? "").trim()
      const nimi = String(c?.name ?? "").trim()
      if (!nimi || !email.includes("@")) continue
      if (!tasmaako(nimi, email)) continue
      const avain = `${nrm(nimi)}|${lahde}`
      if (!lahteet.has(avain)) {
        lahteet.set(avain, { email: email.toLowerCase(), phone: String(c?.phone ?? "").trim() || null, mista: String(p.nimi).slice(0, 40) })
      }
    }
  }

  const paivitykset: any[] = []
  let sposti = 0, puhelin = 0
  const naytteet: string[] = []

  for (const p of rivit) {
    const lahde = nrm(p.metadata?.source_name)
    const kontaktit = (p.metadata?.contact_persons ?? []) as any[]
    if (!kontaktit.length) continue

    let muuttui = false
    const uudet = kontaktit.map((c) => {
      const nimi = String(c?.name ?? "").trim()
      if (!nimi) return c
      if (String(c?.email ?? "").trim() && String(c?.phone ?? "").trim()) return c

      const l = lahteet.get(`${nrm(nimi)}|${lahde}`)
      if (!l) return c

      const uusi: any = { ...c }
      let muutos = false
      if (!String(c?.email ?? "").trim()) { uusi.email = l.email; sposti++; muutos = true }
      if (!String(c?.phone ?? "").trim() && l.phone) { uusi.phone = l.phone; puhelin++; muutos = true }
      if (!muutos) return c

      muuttui = true
      if (naytteet.length < 16) {
        naytteet.push(`  ${nimi.slice(0, 22).padEnd(24)} ${String(uusi.email ?? "-").padEnd(34)} ${String(uusi.phone ?? "-").padEnd(18)} <- "${l.mista}"`)
      }
      return uusi
    })

    if (muuttui) paivitykset.push({ taulu: p.taulu, id: p.id, uudet })
  }

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`tarkistettuja lahdetietueita: ${lahteet.size}`)
  console.log(`muutettavia hankkeita:        ${paivitykset.length}`)
  console.log(`  sahkoposteja lisataan:      ${sposti}`)
  console.log(`  puhelimia lisataan:         ${puhelin}\n`)
  for (const n of naytteet) console.log(n)

  if (!APPLY) { console.log("\n(kuivaharjoitus — aja --apply)"); return }

  let n = 0
  for (const u of paivitykset) {
    const { data: nyt } = await supabase.from(u.taulu).select("metadata").eq("id", u.id).maybeSingle()
    const meta: any = nyt?.metadata ?? {}
    await supabase.from(u.taulu).update({ metadata: { ...meta, contact_persons: u.uudet } }).eq("id", u.id)
    n++
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
