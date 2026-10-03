import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LIEKSAN KAAVOJEN TIIVISTELMA JA VALMISTELIJA TAKAUTUVASTI (D-230).
 *
 * Kerain hakee ne nyt selostuksesta, mutta jo tuodut rivit jaavat ilman
 * — 4 viidesta oli ilman kuvausta ja 5 viidesta ilman yhteyshenkiloa.
 * Tama taydentaa ne seka dokumenttiin etta ehdokkaalle/hankkeelle.
 *
 * EI YLIKIRJOITA. Olemassa oleva kuvaus ja yhteyshenkilo jaavat
 * paikalleen: kasin lisatty tai sivulta luettu tieto on vahintaan yhta
 * hyva kuin selostuksesta poimittu.
 *
 *   npx tsx scripts/fix-lieksan-kaavakuvaukset.ts
 *   npx tsx scripts/fix-lieksan-kaavakuvaukset.ts --apply
 */

const LAHDE = "Lieksan vireillä olevat asemakaavat"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { haeKaavaselostuksenTeksti, kaavanKuvausTekstista } = await import("../lib/agent/kaavanKuvaus")
  const { kaavanYhteyshenkilot } = await import("../lib/agent/kaavanYhteyshenkilo")

  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: dokit, error } = await db
    .from("source_documents")
    .select("id, title, document_url, raw_payload, raw_text")
    .eq("source_name", LAHDE)
  if (error) throw error

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`dokumentteja ${dokit?.length ?? 0}\n`)

  for (const d of dokit ?? []) {
    const hyoty = (d.raw_payload ?? {}) as any
    const onKuvaus = Boolean(hyoty.description)
    const onYhteys = Array.isArray(hyoty.contacts) && hyoty.contacts.length > 0

    console.log("=".repeat(96))
    console.log(`${String(d.title).slice(0, 86)}`)
    console.log(`  nyt: kuvaus ${onKuvaus ? `${String(hyoty.description).length} merkkia` : "PUUTTUU"}, yhteyshenkiloita ${onYhteys ? hyoty.contacts.length : 0}`)

    if (onKuvaus && onYhteys) {
      console.log("  molemmat on jo — ohitetaan\n")
      continue
    }

    /* Selostuslinkki sivulta. */
    let selostus: string | null = null
    try {
      const html = await (await fetch(String(d.document_url), { headers: { "User-Agent": "Mozilla/5.0" } })).text()
      const $ = cheerio.load(html)
      for (const el of $("a[href]").toArray()) {
        const href = $(el).attr("href") ?? ""
        if (!/\.pdf(\?|$)/i.test(href)) continue
        const nimi = decodeURIComponent(href.split("/").pop() ?? "")
        if (/selostus/i.test(`${nimi} ${$(el).text()}`)) {
          selostus = href
          break
        }
      }
    } catch {
      console.log("  sivun haku epaonnistui\n")
      continue
    }

    if (!selostus) {
      console.log("  ei selostus-pdf:aa sivulla — ei voi taydentaa\n")
      continue
    }

    const teksti = await haeKaavaselostuksenTeksti(selostus)
    if (!teksti) {
      console.log(`  selostuksen luku epaonnistui: ${selostus}\n`)
      continue
    }

    const uusiKuvaus = onKuvaus ? null : kaavanKuvausTekstista(teksti)
    const uudetYhteys = onYhteys
      ? []
      : kaavanYhteyshenkilot(teksti).map((y) => ({
          kind: "person",
          name: y.nimi,
          email: null,
          phone: null,
          title: y.rooli,
          organization: "Lieksan kaupunki",
        }))

    console.log(`  selostus: ${selostus.split("/").pop()}`)
    if (uusiKuvaus) console.log(`  -> kuvaus ${uusiKuvaus.length} merkkia: ${uusiKuvaus.slice(0, 160)}…`)
    if (uudetYhteys.length) console.log(`  -> yhteyshenkilot: ${uudetYhteys.map((y) => `${y.name} (${y.title})`).join(", ")}`)
    if (!uusiKuvaus && !uudetYhteys.length) {
      console.log("  selostuksesta ei saatu kumpaakaan\n")
      continue
    }

    if (!apply) {
      console.log()
      continue
    }

    const paivitetytContacts = onYhteys ? hyoty.contacts : uudetYhteys
    const paivitettyKuvaus = onKuvaus ? hyoty.description : uusiKuvaus

    const uusiPayload = { ...hyoty, description: paivitettyKuvaus, contacts: paivitetytContacts }
    const { error: dokVirhe } = await db
      .from("source_documents")
      .update({
        raw_payload: uusiPayload,
        raw_text: JSON.stringify({
          title: d.title,
          phase: hyoty.phase ?? null,
          description: paivitettyKuvaus,
          contacts: paivitetytContacts,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", d.id)
    if (dokVirhe) {
      console.log(`  VIRHE dokumentissa: ${dokVirhe.message}\n`)
      continue
    }

    /* Ehdokkaat ja hankkeet samasta osoitteesta. */
    for (const taulu of ["potential_projects", "projects"] as const) {
      const { data: rivit } = await db
        .from(taulu)
        .select("id, metadata")
        .eq("metadata->>source_url", String(d.document_url))
      for (const r of rivit ?? []) {
        const md = ((r as any).metadata ?? {}) as any
        const onJoKuvaus = Boolean(md.description)
        const onJoYhteys = Array.isArray(md.contact_persons) && md.contact_persons.length > 0
        if (onJoKuvaus && onJoYhteys) continue

        const { error: virhe } = await db
          .from(taulu)
          .update({
            metadata: {
              ...md,
              description: onJoKuvaus ? md.description : paivitettyKuvaus,
              contact_persons: onJoYhteys ? md.contact_persons : paivitetytContacts,
            },
          })
          .eq("id", (r as any).id)
        console.log(virhe ? `  VIRHE ${taulu}: ${virhe.message}` : `  TEHTY ${taulu} ${(r as any).id}`)
      }
    }
    console.log()
  }

  if (!apply) console.log("Ei muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
