import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YHTEYSHENKILOT KUVAUSTEKSTISTA TAKAUTUVASTI.
 *
 * Testiasiakkaiden kolmesta syysta olla jattamatta tilausta yksi oli
 * "liian vahan yhteystietoja". Mitattu 22.8.2026: 840 hankkeella on
 * kuvaustekstissa sahkoposti, ja 593:lla nimetty henkilo - mutta proosana
 * keskella tiedotetta, ei kayttokelpoisena kenttana.
 *
 * Kirjoittaa `metadata.contact_persons`-kenttaan, jota kayttoliittyma jo
 * renderoi kolmessa paikassa ja jota 1 986 kaavalahteista tullutta
 * hanketta kayttaa. Olemassa olevat sailyvat: union sahkopostin mukaan.
 *
 * EI YLIKIRJOITA. Kaavalahteen kontakti voittaa, koska se tulee
 * rakenteisesta rajapinnasta eika tekstista.
 *
 * Aja ensin ilman --apply-lippua ja lue tuotos riveittain.
 */

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0)

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractContacts, mergeContacts, hasPersonContact } = await import(
    "../lib/projects/contacts"
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,is_public,additional_info,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`hankkeita: ${rivit.length}\n`)

  let muuttuu = 0, uusiaKontakteja = 0, sailyneita = 0
  let ennenKontaktilla = 0, jalkeenKontaktilla = 0, jalkeenHenkilolla = 0
  const naytteet: string[] = []
  const kohteet: any[] = []

  for (const p of rivit) {
    const meta: any = p.metadata ?? {}
    const vanhat = Array.isArray(meta.contact_persons) ? meta.contact_persons : []
    if (vanhat.length) ennenKontaktilla++

    /*
     * MOLEMMAT TEKSTIT. Kuvaus tulee lahteesta, mutta lisatietokentassa
     * voi olla KASIN lisattyja yhteyshenkiloita joita ei ole missaan
     * muualla - kayttaja lisasi Kouvolan yhtenaiskoulun kolme kontaktia
     * juuri sinne. Lisatietoteksti korvataan jatkossa uudemmalla
     * (chooseAdditionalInfo), joten ne on saatava talteen nyt.
     */
    const poimitut = mergeContacts(
      extractContacts(String(meta.description ?? "")),
      extractContacts(String(p.additional_info ?? ""))
    )
    const uudet = mergeContacts(vanhat, poimitut)

    if (uudet.length) jalkeenKontaktilla++
    if (hasPersonContact(uudet as any)) jalkeenHenkilolla++

    if (uudet.length === vanhat.length) continue

    muuttuu++
    uusiaKontakteja += uudet.length - vanhat.length
    sailyneita += vanhat.length
    kohteet.push({ id: p.id, uudet })

    if (naytteet.length < 12) {
      const lisatyt = uudet.filter(
        (u: any) => !vanhat.some((v: any) => String(v.email ?? "").toLowerCase() === String(u.email ?? "").toLowerCase())
      )
      naytteet.push(
        `  ${String(p.name).slice(0, 40).padEnd(42)} ${vanhat.length} -> ${uudet.length}   ${lisatyt
          .slice(0, 2)
          .map((x: any) => `${x.name ?? "-"} (${x.phone ?? "ei puh"})`)
          .join(" | ")}`
      )
    }
  }

  console.log(`hankkeita joilla kontakti ENNEN:  ${ennenKontaktilla}`)
  console.log(`hankkeita joilla kontakti JALKEEN: ${jalkeenKontaktilla}`)
  console.log(`  joilla nimetty HENKILO:          ${jalkeenHenkilolla}`)
  console.log(`\npaivitettavia hankkeita:          ${muuttuu}`)
  console.log(`uusia kontakteja:                  ${uusiaKontakteja}`)
  console.log(`vanhoja sailyy:                    ${sailyneita}`)
  if (naytteet.length) { console.log("\nesimerkkeja:"); for (const n of naytteet) console.log(n) }

  if (!APPLY) return

  const tehtavat = LIMIT > 0 ? kohteet.slice(0, LIMIT) : kohteet
  let n = 0
  for (const k of tehtavat) {
    const { data: nyt } = await supabase.from("projects").select("metadata").eq("id", k.id).maybeSingle()
    await supabase
      .from("projects")
      .update({ metadata: { ...((nyt?.metadata as any) ?? {}), contact_persons: k.uudet } })
      .eq("id", k.id)
    if (++n % 100 === 0) console.log(`  ...kirjoitettu ${n}/${tehtavat.length}`)
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
