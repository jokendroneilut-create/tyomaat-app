import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: tuottaako NYKYINEN poimija vaaria nimi-osoite-pareja?
 *
 * Kannassa oli 29 vaaraa paria, ja oletin vian olevan poimijassa. Kaksi
 * naytetta viittasi siihen etta pariutus on jo korjattu (D-101,
 * 22.8.2026: sahkoposti voittaa tekstista luetun nimen). Tama ajaa
 * nykyisen poimijan KAIKKIEN tallennettujen kuvaustekstien yli ja laskee
 * montako ristiriitaa se tuottaisi.
 *
 * Jos tulos on 0, poimijaa ei tarvitse korjata - kannassa oli vain vanhaa
 * dataa, ja se on jo korjattu takautuvasti.
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

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractContacts } = await import("../lib/projects/contacts")

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
    ...(await lataa("projects", "id,name,metadata")).map((p: any) => ({ ...p, nimi: p.name })),
    ...(await lataa("potential_projects", "id,title,metadata")).map((p: any) => ({ ...p, nimi: p.title })),
  ]

  let tekstja = 0, kontakteja = 0, tarkistettavia = 0, ristiriitoja = 0, nimettomia = 0, malliosoitteita = 0
  const naytteet: string[] = []
  const lahteittain = new Map<string, number>()

  for (const p of rivit) {
    const teksti = String(p.metadata?.description ?? "")
    if (teksti.length < 60) continue
    tekstja++

    for (const c of extractContacts(teksti)) {
      kontakteja++
      const nimi = String(c.name ?? "").trim()
      const email = String(c.email ?? "").trim()
      if (!nimi) { nimettomia++; continue }
      if (!email.includes("@")) continue
      const t = tasmaako(nimi, email)
      if (t === null) continue
      tarkistettavia++
      if (t) continue
      ristiriitoja++
      if (/^(etunimi|firstname|fornamn)/i.test(email.split("@")[0])) malliosoitteita++
      const lahde = String(p.metadata?.source_name ?? "?")
      lahteittain.set(lahde, (lahteittain.get(lahde) ?? 0) + 1)
      if (naytteet.length < 14) naytteet.push(`  ${nimi.slice(0, 22).padEnd(24)} ${email.padEnd(34)} ${lahde.slice(0, 28)}`)
    }
  }

  console.log(`kuvaustekstja ajettu:   ${tekstja}`)
  console.log(`poimittuja kontakteja:  ${kontakteja}   (nimettomia ${nimettomia})`)
  console.log(`tarkistettavia pareja:  ${tarkistettavia}`)
  console.log(`RISTIRIITOJA:           ${ristiriitoja}  (${Math.round(ristiriitoja / Math.max(1, tarkistettavia) * 100)} %)`)
  console.log(`  niista malliosoitteita: ${malliosoitteita}`)
  console.log(`  muita:                  ${ristiriitoja - malliosoitteita}`)

  if (lahteittain.size) {
    console.log("\nlahteittain:")
    for (const [k, v] of [...lahteittain].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(v).padStart(4)}  ${k}`)
    console.log("\nnaytteita:")
    for (const n of naytteet) console.log(n)
  } else {
    console.log("\nNykyinen poimija ei tuota yhtaan ristiriitaa naista teksteista.")
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
