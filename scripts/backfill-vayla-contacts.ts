import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VAYLAVIRASTON YHTEYSHENKILOT TAKAUTUVASTI.
 *
 * 157 nakyvaa hanketta on ilman yhteystietoa, vaikka poiminta on ollut
 * olemassa alusta asti. Syy on VAYLA_MAX_DETAIL_FETCHES_PER_RUN = 5:
 * vain 36/188 dokumenttia oli koskaan saanut detaljihaun.
 *
 * EI YLIKIRJOITA. contact_persons on vain-lisaava (D-101).
 *
 * Aja ensin ilman --apply-lippua ja lue rivit lapi.
 */

const APPLY = process.argv.includes("--apply")
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.slice(8) ?? 0)
const CONCURRENCY = 4

function decodeCloudflareEmail(encoded: string): string | null {
  try {
    const key = parseInt(encoded.substring(0, 2), 16)
    let email = ""
    for (let i = 2; i < encoded.length; i += 2) {
      email += String.fromCharCode(parseInt(encoded.substring(i, i + 2), 16) ^ key)
    }
    return email || null
  } catch {
    return null
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++
        if (i >= items.length) return
        results[i] = await fn(items[i])
      }
    })
  )
  return results
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { normalizeVaylaContact } = await import("../lib/agent/vaylaContacts")
  const { mergeContacts } = await import("../lib/projects/contacts")

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

  const kohteet = rivit.filter(
    (p) =>
      /väylävirasto/i.test(String(p.metadata?.source_name ?? "")) &&
      p.metadata?.source_url &&
      !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length)
  )

  const targets = LIMIT > 0 ? kohteet.slice(0, LIMIT) : kohteet

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`Vaylavirasto-hankkeita ilman yhteystietoa: ${kohteet.length}`)
  console.log(`  niista nakyvia:                         ${kohteet.filter((p) => p.is_public).length}`)
  console.log(`haetaan nyt:                              ${targets.length}\n`)

  let haettu = 0
  const tulokset = await mapWithConcurrency(targets, CONCURRENCY, async (p) => {
    try {
      const r = await fetch(String(p.metadata.source_url), { cache: "no-store" })
      if (++haettu % 40 === 0) console.log(`  ...haettu ${haettu}/${targets.length}`)
      if (!r.ok) return { p, contacts: [], syy: `HTTP ${r.status}` }

      const $ = cheerio.load(await r.text())
      const box = $(".contact-information .contact").first()
      if (!box.length) return { p, contacts: [], syy: "ei lohkoa" }

      const cf = box.find(".__cf_email__").first().attr("data-cfemail")
      const raw = {
        organization: box.find(".organization").first().text().trim() || null,
        title: box.find(".title").first().text().trim() || null,
        name: box.find(".full-name").first().text().trim() || null,
        phone: box.find(".phones li").first().text().trim() || null,
        email: cf ? decodeCloudflareEmail(cf) : null,
      }

      const contacts = normalizeVaylaContact(raw)
      return { p, contacts, syy: contacts.length ? "" : `hylatty: ${raw.name ?? "-"}`, raw }
    } catch (e: any) {
      return { p, contacts: [], syy: `virhe: ${e?.message ?? e}` }
    }
  })

  let muuttuu = 0, sahkopostilla = 0, puhelimella = 0, laajennettu = 0
  const syyt = new Map<string, number>()
  const naytteet: string[] = []
  const hylatyt: string[] = []

  for (const t of tulokset as any[]) {
    if (!t.contacts.length) {
      const avain = t.syy.startsWith("hylatty") ? "hylatty (ei henkilo)" : t.syy
      syyt.set(avain, (syyt.get(avain) ?? 0) + 1)
      if (t.syy.startsWith("hylatty") && hylatyt.length < 10) hylatyt.push(`  ${t.syy}`)
      continue
    }

    muuttuu++
    const c = t.contacts[0]
    if (c.email) sahkopostilla++
    if (c.phone) puhelimella++
    if (c.email && t.raw?.email && c.email !== t.raw.email) laajennettu++

    if (naytteet.length < 15) {
      naytteet.push(
        `  ${String(t.p.name).slice(0, 30).padEnd(32)} ${[c.name, c.title, c.phone, c.email || "-"]
          .map((x: any) => x ?? "-")
          .join(" | ")
          .slice(0, 96)}`
      )
    }
  }

  console.log(`\npaivitettavia hankkeita: ${muuttuu} / ${targets.length}   ${Math.round(muuttuu / Math.max(1, targets.length) * 100)} %`)
  console.log(`  sahkopostilla:         ${sahkopostilla}   (paikanpitajasta laajennettu ${laajennettu})`)
  console.log(`  puhelimella:           ${puhelimella}`)

  /*
   * VARMISTUS: yhtaan malliosoitetta ei saa paasta lapi. Ensimmainen ajo
   * paasti muodon "etunimi.sukuni@vayla.fi" - kirjoitusvirheen takia se
   * ei osunut tarkkaan tunnistukseen ja palautui sellaisenaan.
   */
  const mallit = (tulokset as any[])
    .flatMap((t) => t.contacts)
    .map((c: any) => c.email)
    .filter((e: string) => e && /(etunimi|sukunimi|firstname|lastname|fornamn|efternamn)/i.test(e))
  console.log(`  malliosoitteita lapi:  ${mallit.length}${mallit.length ? "  <-- VIRHE: " + mallit.slice(0, 5).join(", ") : ""}`)

  if (syyt.size) {
    console.log("\nsyyt joilla ei saatu:")
    for (const [k, v] of [...syyt].sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`)
  }
  if (hylatyt.length) { console.log("\nhylatyt nimikentat:"); for (const h of hylatyt) console.log(h) }
  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }

  if (!APPLY) return

  let n = 0
  for (const t of tulokset as any[]) {
    if (!t.contacts.length) continue

    const { data: nyt } = await supabase.from("projects").select("metadata").eq("id", t.p.id).maybeSingle()
    const meta: any = nyt?.metadata ?? {}

    await supabase
      .from("projects")
      .update({
        metadata: { ...meta, contact_persons: mergeContacts(meta.contact_persons ?? [], t.contacts) },
      })
      .eq("id", t.p.id)

    if (++n % 40 === 0) console.log(`  ...kirjoitettu ${n}/${muuttuu}`)
  }
  console.log(`\nkirjoitettu: ${n}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
