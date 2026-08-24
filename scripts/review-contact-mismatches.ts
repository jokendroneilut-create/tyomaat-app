import { readFileSync, writeFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KATSELMOINTILISTA: oikea nimi + toisen henkilon sahkoposti.
 *
 * Mitattu 25.8.2026: 5 157 tarkistettavasta osoitteesta 151 ei tasmaa
 * nimeen, ja niista 45 on tata lajia. Nama ovat vaarallisin luokka:
 * puuttuva tieto on tyhja kohta, mutta vaara osoite nayttaa oikealta ja
 * asiakas voi lahettaa tarjouksen vaaralle henkilolle.
 *
 * EI KIRJOITA MITAAN. Yhteystietokentasta ei koskaan poisteta mitaan
 * ilman omistajan paatosta, joten tama vain listaa.
 *
 * Tulostaa myos ehdotetun oikean osoitteen jos sama nimi esiintyy
 * muualla samassa lahteessa osoitteen kanssa joka TASMAA nimeen.
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

function onOikeaNimi(raaka: string): boolean {
  const sanat = String(raaka).trim().split(/\s+/)
  return (
    !/\d/.test(raaka) &&
    sanat.length >= 2 &&
    sanat.every((s) => /^[A-ZÅÄÖ]/.test(s)) &&
    !/(oy|ab|ky|SAFA|palvelu|suunnittelij|arkkitehti|sähköposti)/i.test(raaka)
  )
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
    ...(await lataa("projects", "id,name,is_public,metadata")).map((p: any) => ({ ...p, nimi: p.name, taulu: "projects" })),
    ...(await lataa("potential_projects", "id,title,metadata")).map((p: any) => ({ ...p, nimi: p.title, taulu: "potential_projects" })),
  ]

  /* nimi+lahde -> osoite joka TASMAA nimeen (ehdotus oikeaksi) */
  const oikeat = new Map<string, string>()
  for (const p of rivit) {
    const lahde = nrm(p.metadata?.source_name)
    for (const c of (p.metadata?.contact_persons ?? []) as any[]) {
      const email = String(c?.email ?? "").trim()
      if (!email.includes("@")) continue
      if (tasmaako(String(c?.name ?? ""), email) === true) {
        const avain = `${nrm(c.name)}|${lahde}`
        if (!oikeat.has(avain)) oikeat.set(avain, email.toLowerCase())
      }
    }
  }

  const lista: any[] = []
  for (const p of rivit) {
    const lahde = String(p.metadata?.source_name ?? "?")
    for (const c of (p.metadata?.contact_persons ?? []) as any[]) {
      const email = String(c?.email ?? "").trim()
      if (!email.includes("@")) continue
      if (/^etunimi\.sukunimi@/i.test(email)) continue
      if (tasmaako(String(c?.name ?? ""), email) !== false) continue
      if (!onOikeaNimi(String(c?.name ?? ""))) continue

      lista.push({
        taulu: p.taulu,
        id: p.id,
        nakyva: p.is_public !== false,
        hanke: String(p.nimi).slice(0, 46),
        lahde,
        nimi: c.name,
        nykyinen: email,
        ehdotus: oikeat.get(`${nrm(c.name)}|${nrm(lahde)}`) ?? null,
        titteli: c.title ?? null,
      })
    }
  }

  console.log(`VAARA PARI: ${lista.length} kpl  (nakyvia hankkeita: ${lista.filter((x) => x.taulu === "projects" && x.nakyva).length})\n`)

  const lahteittain = new Map<string, any[]>()
  for (const x of lista) {
    if (!lahteittain.has(x.lahde)) lahteittain.set(x.lahde, [])
    lahteittain.get(x.lahde)!.push(x)
  }

  for (const [lahde, xs] of [...lahteittain].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`=== ${lahde}  (${xs.length}) ===`)
    for (const x of xs) {
      const e = x.ehdotus ? `  -> ehdotus: ${x.ehdotus}` : "  -> ei tiedossa"
      console.log(`  ${String(x.nimi).slice(0, 22).padEnd(24)} ${x.nykyinen.padEnd(34)}${e}`)
      console.log(`      ${x.taulu === "projects" ? "NAKYVA " : "jono   "} ${x.hanke}`)
    }
    console.log()
  }

  writeFileSync("scripts/out/contact-mismatches.json", JSON.stringify(lista, null, 1), "utf8")
  console.log(`kirjoitettu: scripts/out/contact-mismatches.json (${lista.length} rivia)`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
