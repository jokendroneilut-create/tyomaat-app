import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MALLIOSOITTEET POIS TUOTANNOSTA.
 *
 * Vanha vaylaResolver kirjoitti yhteystietolohkon sellaisenaan, joten
 * kannassa on 22 hanketta joiden yhteyshenkilon sahkopostiksi on
 * tallennettu Vaylaviraston sivulla naytettava MALLI:
 *
 *   Mirko Juppi | etunimi.sukunimi@elinvoimakeskus.fi
 *
 * Asiakas nakee sen oikeana osoitteena ja lahettaa viestin tyhjaan.
 *
 * Tama EI POISTA yhteystietoja (D-101): nimi, nimike ja puhelin sailyvat
 * aina. Osoite joko korjataan nimen perusteella oikeaksi tai tyhjennetaan
 * jos sita ei voi paatella.
 *
 * Aja ensin ilman --apply-lippua.
 */

const APPLY = process.argv.includes("--apply")
const HINT = /(etunimi|sukunimi|firstname|lastname|fornamn|efternamn)/i

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { expandPlaceholderEmail } = await import("../lib/agent/vaylaContacts")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,is_public,metadata")
      .range(f, f + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  /*
   * Ei rajata Vaylavirastoon: malliosoite on yleinen tapa kirjoittaa
   * yhteystieto, ja sama vika voi olla muissakin lahteissa.
   */
  const kohteet = rivit.filter(
    (p) =>
      Array.isArray(p.metadata?.contact_persons) &&
      p.metadata.contact_persons.some((c: any) => c?.email && HINT.test(String(c.email)))
  )

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`hankkeita joilla malliosoite: ${kohteet.length}`)
  console.log(`  niista nakyvia:             ${kohteet.filter((p) => p.is_public).length}\n`)

  const lahteet = new Map<string, number>()
  for (const p of kohteet) {
    const s = String(p.metadata?.source_name ?? "?")
    lahteet.set(s, (lahteet.get(s) ?? 0) + 1)
  }
  console.log("lahteittain:")
  for (const [k, v] of [...lahteet].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)

  let korjattu = 0, tyhjennetty = 0, poistettuTyhjia = 0
  const paivitykset: { id: string; contacts: any[] }[] = []
  const naytteet: string[] = []

  for (const p of kohteet) {
    /*
     * LAAJENNUS VAIN RAKENTEISESTA LAHTEESTA.
     *
     * Vaylaviraston nimi tulee sivun omasta ".full-name"-kentasta, joten
     * se on henkilon nimi. Muissa lahteissa nimi on poimittu vapaasta
     * tekstista, ja kuivaharjoitus 22.8.2026 naytti mihin se johtaa:
     * "Lapin Kansa" -> "lapin.kansa@rovaniemi.fi". Niissa malliosoite
     * vain tyhjennetaan.
     */
    const rakenteinen = /väylävirasto/i.test(String(p.metadata?.source_name ?? ""))

    const uudet = p.metadata.contact_persons
      .map((c: any) => {
        if (!c?.email || !HINT.test(String(c.email))) return c

        const oikea = rakenteinen ? expandPlaceholderEmail(c.email, c.name) : null
        if (oikea) korjattu++
        else tyhjennetty++

        if (naytteet.length < 20) {
          naytteet.push(
            `  ${String(p.name).slice(0, 28).padEnd(30)} ${String(c.name ?? "-").slice(0, 20).padEnd(22)} ${String(c.email).slice(0, 30).padEnd(32)} -> ${oikea ?? "(tyhjä)"}`
          )
        }

        /* Nimi, nimike ja puhelin sailyvat aina. */
        return { ...c, email: oikea ?? "" }
      })
      /*
       * Kontakti jossa ei ole nimea, numeroa eika osoitetta ei ole
       * kontakti. Se ei ole tiedon poistoa vaan tyhjan rivin siivousta -
       * ilman tata se laskettaisiin yha "yhteystiedoksi" kattavuudessa.
       */
      .filter((c: any) => {
        const tyhja = !String(c?.name ?? "").trim() && !String(c?.phone ?? "").trim() && !String(c?.email ?? "").trim()
        if (tyhja) poistettuTyhjia++
        return !tyhja
      })

    paivitykset.push({ id: p.id, contacts: uudet })
  }

  console.log(`\nosoitteita korjattu nimen perusteella:      ${korjattu}`)
  console.log(`osoitteita tyhjennetty (ei paateltavissa):  ${tyhjennetty}`)
  console.log(`kokonaan tyhjia rivaja siivottu:           ${poistettuTyhjia}`)

  const ennen = kohteet.reduce((s, p) => s + p.metadata.contact_persons.length, 0)
  const jalkeen = paivitykset.reduce((s, u) => s + u.contacts.length, 0)
  console.log(`kontakteja ennen ${ennen}, jalkeen ${jalkeen}  (erotus ${ennen - jalkeen}, pitaa olla ${poistettuTyhjia})`)

  const nimellisiaEnnen = kohteet.reduce((s, p) => s + p.metadata.contact_persons.filter((c: any) => String(c?.name ?? "").trim()).length, 0)
  const nimellisiaJalkeen = paivitykset.reduce((s, u) => s + u.contacts.filter((c: any) => String(c?.name ?? "").trim()).length, 0)
  console.log(`nimellisia ennen ${nimellisiaEnnen}, jalkeen ${nimellisiaJalkeen}${nimellisiaEnnen === nimellisiaJalkeen ? "" : "   <-- VIRHE: nimi katosi"}`)

  /* Kuinka moni hanke jaa kokonaan ilman yhteystietoa? */
  const tyhjenevat = paivitykset.filter((u) => !u.contacts.length).length
  console.log(`hankkeita jotka jaavat ilman yhteystietoa:  ${tyhjenevat}`)

  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }

  if (!APPLY) return
  if (nimellisiaEnnen !== nimellisiaJalkeen) {
    console.error("\nKESKEYTETAAN: nimellinen kontakti katosi.")
    process.exit(1)
  }

  let n = 0
  for (const u of paivitykset) {
    const { data: nyt } = await supabase.from("projects").select("metadata").eq("id", u.id).maybeSingle()
    const meta: any = nyt?.metadata ?? {}
    await supabase
      .from("projects")
      .update({ metadata: { ...meta, contact_persons: u.contacts } })
      .eq("id", u.id)
    n++
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
