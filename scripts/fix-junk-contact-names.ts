import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * ROSKANIMET OIKEISIIN KENTTIIN.
 *
 * Mitattu 25.8.2026: 67 yhteystiedossa nimikentassa on jotain muuta kuin
 * henkilon nimi. Sahkoposti on niissa yleensa OIKEIN - vain nimi on
 * vaarassa kentassa:
 *
 *   26  puhelinnumero    "322 8927"                elias.ritola@rovaniemi.fi
 *   23  nimike           "Kaavasuunnittelija"      elina.stuber-asikainen@akaa.fi
 *   11  organisaatio     "Helsingin kaupunki, ..."  kymp.tilahankinnat@hel.fi
 *    7  yritys           "Sitowise Oy"             maarit.virkkunen@sitowise.com
 *
 * TAMA EI OLE POISTO VAAN SIIRTO. Contact-tyypissa on omat kentat
 * nimikkeelle (title) ja organisaatiolle (organization), joten tieto
 * siirretaan sinne eika havita. Vain tunnistamaton roska
 * ("sahkoposti: etu.sukunimi@rovaniemi") tyhjennetaan.
 *
 * Puhelinnumero siirretaan phone-kenttaan VAIN jos se on tyhja - muuten
 * kirjoittaisimme olemassa olevan numeron paalle arvaamalla.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

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
const NIMIKE = /(suunnittelij|arkkitehti|paallikk|insinoori|johtaja|safa|sihteeri|geodeetti)/i
const ORGANISAATIO = /(kaupunki|kunta|seurakunta|lautakunta|osasto|palvelut|kaavoitus|tekninen|virasto)/i
/* Selvaa roskaa, ei siirrettavissa mihinkaan. */
const ROSKA = /^(sähköposti|s-posti|email|puh\b|puhelin)/i
const PUHELIN = /^[\d\s\-+(),]+$/

type Muutos = { laji: string; ennen: string; jalkeen: string }

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
    ...(await lataa("projects", "id,name,metadata")).map((p: any) => ({ ...p, taulu: "projects" })),
    ...(await lataa("potential_projects", "id,title,metadata")).map((p: any) => ({ ...p, taulu: "potential_projects" })),
  ]

  const paivitykset: any[] = []
  const laskuri = new Map<string, number>()
  const naytteet: Muutos[] = []

  for (const p of rivit) {
    const kontaktit = (p.metadata?.contact_persons ?? []) as any[]
    if (!kontaktit.length) continue

    let muuttui = false
    const uudet = kontaktit.map((c) => {
      const nimi = String(c?.name ?? "").trim()
      const email = String(c?.email ?? "").trim()
      if (!nimi || !email.includes("@")) return c
      if (tasmaako(nimi, email) !== false) return c

      /* Aito henkilonnimi ei kuulu tanne - se on kasitelty D-122:ssa. */
      const sanat = nimi.split(/\s+/)
      const onNimi =
        !/\d/.test(nimi) && sanat.length >= 2 && sanat.every((s) => /^[A-ZÅÄÖ]/.test(s)) &&
        !YRITYS.test(nimi) && !NIMIKE.test(poista(nimi)) && !ORGANISAATIO.test(poista(nimi))
      if (onNimi) return c

      let laji: string
      const uusi: any = { ...c }

      if (ROSKA.test(nimi)) {
        laji = "roska -> tyhjennetaan"
        uusi.name = null
      } else if (PUHELIN.test(nimi)) {
        if (!String(c?.phone ?? "").trim()) { laji = "numero -> phone"; uusi.phone = nimi }
        else laji = "numero -> tyhjennetaan (phone jo taynna)"
        uusi.name = null
      } else if (YRITYS.test(nimi) || ORGANISAATIO.test(poista(nimi))) {
        laji = "organisaatio -> organization"
        if (!String(c?.organization ?? "").trim()) uusi.organization = nimi
        uusi.name = null
      } else if (NIMIKE.test(poista(nimi))) {
        laji = "nimike -> title"
        if (!String(c?.title ?? "").trim()) uusi.title = nimi
        uusi.name = null
      } else {
        laji = "tunnistamaton -> tyhjennetaan"
        uusi.name = null
      }

      muuttui = true
      laskuri.set(laji, (laskuri.get(laji) ?? 0) + 1)
      if (naytteet.length < 22) {
        naytteet.push({
          laji,
          ennen: `"${nimi.slice(0, 30)}" ${email.slice(0, 30)}`,
          jalkeen: `title=${uusi.title ?? "-"} org=${String(uusi.organization ?? "-").slice(0, 22)} phone=${uusi.phone ?? "-"}`,
        })
      }
      return uusi
    })

    if (muuttui) paivitykset.push({ taulu: p.taulu, id: p.id, uudet })
  }

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`muutettavia hankkeita: ${paivitykset.length}\n`)
  for (const [k, v] of [...laskuri].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)
  console.log("\nnaytteita:")
  for (const n of naytteet) console.log(`  ${n.laji.padEnd(38)} ${n.ennen.padEnd(64)} ${n.jalkeen}`)

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
