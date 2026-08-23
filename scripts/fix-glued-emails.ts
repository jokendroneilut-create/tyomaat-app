import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YMPARISTOONSA TARTTUNEET SAHKOPOSTIT TAKAUTUVASTI.
 *
 * Poimittu osoite otti mukaansa edeltavan numeron ja seuraavan sanan,
 * koska rivinvaihdot katoavat tekstiksi muunnettaessa:
 *
 *   8368reima.liikamaa@jatke.fiKuvatLataaLataaJatke
 *   kirjaamo@vaala.fiOsallistumis
 *
 * Asiakas lahettaa viestin osoitteeseen jota ei ole olemassa. Korjaus on
 * lib/projects/contacts.ts:n sanitizeEmail.
 *
 * EI POISTA KONTAKTEJA (D-101): nimi, nimike ja puhelin sailyvat aina.
 * Jos osoitetta ei saada korjattua, se tyhjennetaan - tyhja on parempi
 * kuin vaara.
 *
 * Kasittelee myos organisaatiokentan, johon oli vuotanut sama roska
 * ("fiKuvatLataaLataaJatke").
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { sanitizeEmail } = await import("../lib/projects/contacts")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const taulut = ["projects", "potential_projects"] as const
  let muuttuvia = 0, korjattu = 0, tyhjennetty = 0, orgSiivottu = 0
  const naytteet: string[] = []
  const paivitykset: { taulu: string; id: string; contacts: any[] }[] = []

  for (const taulu of taulut) {
    const nimiSarake = taulu === "projects" ? "name" : "title"

    const rivit: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(taulu).select(`id,${nimiSarake},metadata`).range(f, f + 999)
      if (error) throw error
      rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
    }

    for (const p of rivit) {
      const cs = Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []
      if (!cs.length) continue

      let muuttui = false

      const uudet = cs.map((c: any) => {
        const vanha = String(c?.email ?? "")
        if (!vanha) return c

        const siisti = sanitizeEmail(vanha)
        const uusiEmail = siisti ?? ""

        /*
         * Organisaatiokenttaan oli vuotanut sama roska, koska se
         * paateltiin osoitteen verkkotunnuksesta.
         */
        const org = String(c?.organization ?? "")
        const orgRikki = org && /^(fi|com|net|org)[A-Z]/.test(org)
        const uusiOrg = orgRikki ? null : c?.organization ?? null

        if (uusiEmail === vanha && !orgRikki) return c

        muuttui = true
        if (siisti && siisti !== vanha.toLowerCase()) korjattu++
        else if (!siisti) tyhjennetty++
        if (orgRikki) orgSiivottu++

        if (naytteet.length < 15) {
          naytteet.push(`  ${String(p[nimiSarake]).slice(0, 28).padEnd(30)} ${vanha.slice(0, 44).padEnd(46)} -> ${uusiEmail || "(tyhjä)"}`)
        }

        return { ...c, email: uusiEmail, organization: uusiOrg }
      })

      if (!muuttui) continue
      muuttuvia++
      paivitykset.push({ taulu, id: p.id, contacts: uudet })
    }
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`hankkeita joissa korjattavaa: ${muuttuvia}`)
  console.log(`  osoitteita korjattu:        ${korjattu}`)
  console.log(`  osoitteita tyhjennetty:     ${tyhjennetty}`)
  console.log(`  organisaatiokenttia siivottu: ${orgSiivottu}`)

  /* Yksikaan kontakti ei saa kadota eika nimi muuttua. */
  const ennen = paivitykset.length
  console.log(`\npaivitettavia rivja: ${ennen}`)
  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }

  if (!APPLY) return

  let n = 0
  for (const u of paivitykset) {
    const { data: nyt } = await supabase.from(u.taulu).select("metadata").eq("id", u.id).maybeSingle()
    const meta: any = nyt?.metadata ?? {}
    await supabase.from(u.taulu).update({ metadata: { ...meta, contact_persons: u.contacts } }).eq("id", u.id)
    n++
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
