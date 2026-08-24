import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VAARIEN SAHKOPOSTIEN KORJAUS.
 *
 * Mitattu 25.8.2026: 5 156 tarkistettavasta osoitteesta 42 ei tasmaa
 * nimeen, ja 29 niista on toisen henkilon osoite. Vika on poimijassa:
 * kun sivulla on useita henkiloita, lahin osoite liitetaan vaaraan
 * nimeen. Raaseporissa sama konsultin osoite (sten.ohman@netsten.fi)
 * paatyi monelle eri kaavoittajalle.
 *
 * KAKSI KORJAUSTA:
 *   1. Jos sama nimi esiintyy SAMASSA LAHTEESSA osoitteella joka TASMAA
 *      nimeen, vaara korvataan silla. Tieto tarkentuu, ei katoa.
 *   2. Muuten osoite tyhjennetaan ja nimi jaa.
 *
 * TAMA ON POIKKEUS SAANTOON "yhteystiedoista ei koskaan poisteta mitaan,
 * ainoastaan lisataan". Omistajan paatos 25.8.2026: "tyhja on parempi
 * kuin vaara osoite". Perustelu: vaara osoite nayttaa oikealta ja johtaa
 * asiakkaan lahettamaan tarjouksen vaaralle henkilolle, kun taas tyhja
 * kentta kertoo rehellisesti ettei tietoa ole.
 *
 * EI KOSKE: yleislaatikoita (kirjaamo@, kunta@ - ne tavoittavat
 * organisaation), yritysnimia eika puhelinnumeroita. Puhelimia ei ole
 * mitattu, joten niita ei kosketa arvaamalla.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

const poista = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const nrm = (s: unknown) => poista(String(s ?? "").trim().toLowerCase()).replace(/[^a-z ]/g, "").replace(/\s+/g, " ")

const YLEISLAATIKKO = /^(kirjaamo|info|kunta|kaupunki|[a-z]+\.kunta|asiakaspalvelu|kaavoitus|tekninen)/i
const YRITYSNIMI = /(FCG|Sitowise|Ramboll|AFRY|Plandea|Oy|Ab)\b/i

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
    !YRITYSNIMI.test(raaka) &&
    !/(SAFA|palvelu|suunnittelij|arkkitehti|sähköposti)/i.test(raaka)
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
    ...(await lataa("projects", "id,name,metadata")).map((p: any) => ({ ...p, nimi: p.name, taulu: "projects" })),
    ...(await lataa("potential_projects", "id,title,metadata")).map((p: any) => ({ ...p, nimi: p.title, taulu: "potential_projects" })),
  ]

  /* nimi|lahde -> osoite joka tasmaa nimeen */
  const oikeat = new Map<string, string>()
  for (const p of rivit) {
    const lahde = nrm(p.metadata?.source_name)
    for (const c of (p.metadata?.contact_persons ?? []) as any[]) {
      const email = String(c?.email ?? "").trim()
      if (email.includes("@") && tasmaako(String(c?.name ?? ""), email) === true) {
        const avain = `${nrm(c.name)}|${lahde}`
        if (!oikeat.has(avain)) oikeat.set(avain, email.toLowerCase())
      }
    }
  }

  const paivitykset: any[] = []
  let korvattu = 0, tyhjennetty = 0

  for (const p of rivit) {
    const lahde = nrm(p.metadata?.source_name)
    const kontaktit = (p.metadata?.contact_persons ?? []) as any[]
    if (!kontaktit.length) continue

    let muuttui = false
    const uudet = kontaktit.map((c) => {
      const email = String(c?.email ?? "").trim()
      if (!email.includes("@")) return c
      if (/^etunimi\.sukunimi@/i.test(email)) return c
      if (YLEISLAATIKKO.test(email.split("@")[0])) return c
      if (!onOikeaNimi(String(c?.name ?? ""))) return c
      if (tasmaako(String(c.name), email) !== false) return c

      const oikea = oikeat.get(`${nrm(c.name)}|${lahde}`) ?? null
      muuttui = true
      if (oikea) { korvattu++; return { ...c, email: oikea } }
      tyhjennetty++
      return { ...c, email: null }
    })

    if (!muuttui) continue
    paivitykset.push({ taulu: p.taulu, id: p.id, hanke: p.nimi, lahde: p.metadata?.source_name, vanhat: kontaktit, uudet })
  }

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`muutettavia hankkeita: ${paivitykset.length}`)
  console.log(`  korvataan oikealla:  ${korvattu}`)
  console.log(`  tyhjennetaan:        ${tyhjennetty}\n`)

  for (const u of paivitykset) {
    for (let i = 0; i < u.uudet.length; i++) {
      const a = u.vanhat[i], b = u.uudet[i]
      if (String(a?.email ?? "") === String(b?.email ?? "")) continue
      const tila = b.email ? `-> ${b.email}` : "-> (tyhjennetaan)"
      console.log(`  ${String(b.name).slice(0, 22).padEnd(24)} ${String(a.email).padEnd(34)} ${tila}`)
      console.log(`      ${u.taulu === "projects" ? "NAKYVA" : "jono  "}  ${String(u.hanke).slice(0, 52)}`)
    }
  }

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
