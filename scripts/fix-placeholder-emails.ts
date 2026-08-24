import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MALLIOSOITTEET POIS - KAIKISTA LAHTEISTA JA MOLEMMISTA TAULUISTA.
 *
 * Yleistetty versio scripts/fix-vayla-placeholder-emails.ts:sta, joka
 * kasitteli vain Vaylaviraston ja vain projects-taulun. Mitattu
 * 25.8.2026: malliosoitteita on yha 42 viidessa lahteessa.
 *
 *   Vaylavirasto 24 | Senaatti 8 | Hyvinkaa 7 | Rovaniemi 2 | Kuopio 1
 *
 * "etunimi.sukunimi@senaatti.fi" nayttaa asiakkaalle oikealta
 * osoitteelta, ja viesti lahtee tyhjaan.
 *
 * LAAJENNUS VAIN RAKENTEISISTA LAHTEISTA. Tama on aiemmin mitattu
 * rajaus (D-103): kun laajennus tehtiin kaikille, syntyi roskaa kuten
 * "Venna Oy" ja katkennut "Airi Maatt". Vaylaviraston ja Senaatin
 * yhteystietolohkot ovat rakenteisia - nimi on siina omana kenttanaan.
 * Kaavalahteissa nimi on vapaassa tekstissa titteleineen
 * ("kaavasuunnittelija Sara Ka...", "Tekninen lautakunta"), eika siita
 * voi johtaa osoitetta.
 *
 * EI POISTA YHTEYSTIETOA (D-101): nimi, nimike ja puhelin sailyvat aina.
 * Vain osoite joko korjataan tai tyhjennetaan.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const MALLI = /^(etunimi|firstname|fornamn)/i

/* Vain naissa nimi on rakenteisena kenttana, ei vapaassa tekstissa. */
const RAKENTEINEN = /(väylävirasto|senaatti)/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { expandPlaceholderEmail } = await import("../lib/agent/vaylaContacts")

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

  const paivitykset: any[] = []
  let korjattu = 0, tyhjennetty = 0
  const naytteet: string[] = []

  for (const p of rivit) {
    const kontaktit = (p.metadata?.contact_persons ?? []) as any[]
    if (!kontaktit.length) continue
    const lahde = String(p.metadata?.source_name ?? "")
    const rakenteinen = RAKENTEINEN.test(lahde)

    let muuttui = false
    const uudet = kontaktit.map((c) => {
      const email = String(c?.email ?? "").trim()
      if (!email || !MALLI.test(email.split("@")[0])) return c

      const oikea = rakenteinen ? expandPlaceholderEmail(email, c?.name ?? null) : null
      muuttui = true
      if (oikea) korjattu++; else tyhjennetty++

      if (naytteet.length < 24) {
        naytteet.push(
          `  ${(rakenteinen ? "rak" : "vapaa").padEnd(6)} ${String(c?.name ?? "-").slice(0, 26).padEnd(28)} ${email.padEnd(36)} -> ${oikea ?? "(tyhjennetaan)"}`
        )
      }
      return { ...c, email: oikea }
    })

    if (muuttui) paivitykset.push({ taulu: p.taulu, id: p.id, uudet })
  }

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`muutettavia hankkeita: ${paivitykset.length}`)
  console.log(`  laajennetaan nimesta: ${korjattu}`)
  console.log(`  tyhjennetaan:         ${tyhjennetty}\n`)
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
