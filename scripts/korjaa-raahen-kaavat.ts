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
 * RAAHEN KAAVAT TAKAUTUVASTI (D-434).
 *
 * Keräin lukee nyt kuvauksen myös otsikottomasta rungosta, vaiheen
 * kaaviosta ja kaikki Lisätietoja-laatikon henkilöt. Tämä tekee saman
 * kannan hankkeille, jonoriveille ja dokumenteille:
 *
 *   - kuvaus: täytetään vain jos tyhjä tai uusi sisältää vanhan
 *     (käsin kirjoitettu kuvaus voittaa)
 *   - yhteyshenkilöt: puuttuvat lisätään nimen perusteella, vanhat jäävät
 *   - kaavatunnus: täytetään jos tyhjä
 *   - vaihe: hankkeilla ei muuteta (kaikki Kaavoitus); jonolle ja
 *     dokumentille kirjataan sivun vaihe decision_statusiksi
 *
 *   npx tsx scripts/korjaa-raahen-kaavat.ts
 *   npx tsx scripts/korjaa-raahen-kaavat.ts --apply
 */

const LAHDE = "Raahen vireillä olevat asemakaavat"

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { raahenKaavasivu, raahenKaavatunnus } = await import("../lib/agent/raaheKaava")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? "=== AJO (--apply) ===\n" : "=== KUIVAHARJOITUS ===\n")

  const { data: hankkeet } = await db
    .from("projects")
    .select("id,name,is_public,additional_info,metadata")
    .eq("metadata->>source_name", LAHDE)
  const { data: jono } = await db
    .from("potential_projects")
    .select("id,title,status,metadata")
    .eq("metadata->>source_name", LAHDE)
  console.log(`hankkeita ${hankkeet?.length ?? 0} (julkisia ${hankkeet?.filter((h) => h.is_public).length ?? 0}), jonorivejä ${jono?.length ?? 0}\n`)

  const sivut = new Map<string, ReturnType<typeof raahenKaavasivu> | null>()
  async function sivu(url: string | undefined) {
    if (!url) return null
    if (!sivut.has(url)) {
      const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } })
      sivut.set(url, res.ok ? raahenKaavasivu(await res.text()) : null)
      await new Promise((s) => setTimeout(s, 1000))
    }
    return sivut.get(url)!
  }

  function uudet(md: any, vanhaKuvaus: string | null, s: NonNullable<ReturnType<typeof raahenKaavasivu>>, nimi: string) {
    const vanhat: any[] = Array.isArray(md.contact_persons) ? md.contact_persons : []
    const lisattavat = s.contacts.filter(
      (c) => !vanhat.some((v: any) => String(v?.name ?? "").toLowerCase() === c.name.toLowerCase())
    )
    const vanha = (vanhaKuvaus ?? "").trim()
    /* Kuvaukseksi tallentunut pelkkä nimi on tyhjä kuvaus (Pattijärvi, Vanha kaupunki). */
    const vainNimi = !!vanha && (vanha === nimi.trim() || vanha === (s.title ?? "").trim())
    const kuvausVaihtuu =
      !!s.description && (!vanha || vainNimi || (s.description.includes(vanha) && s.description !== vanha))
    const tunnus = md.kaava_tunnus ?? raahenKaavatunnus(s.title ?? nimi)
    return {
      yhteys: [...vanhat, ...lisattavat],
      lisatyt: lisattavat,
      kuvaus: kuvausVaihtuu ? s.description : vanhaKuvaus,
      kuvausVaihtuu,
      tunnus,
      tunnusUusi: !md.kaava_tunnus && !!tunnus,
    }
  }

  const rivi = (tyyppi: string, id: string, nimi: string, u: ReturnType<typeof uudet>, lisa = "") =>
    console.log(
      `${tyyppi} ${id.slice(0, 8)} ${nimi.slice(0, 55).padEnd(55)} | kuvaus ${u.kuvausVaihtuu ? "TÄYTETÄÄN" : "ennallaan"} | yht +${u.lisatyt.length}${u.lisatyt.length ? ` (${u.lisatyt.map((c) => c.name).join(", ")})` : ""}${u.tunnusUusi ? ` | tunnus ${u.tunnus}` : ""}${lisa}`
    )

  let muutettu = 0
  for (const h of hankkeet ?? []) {
    const md: any = h.metadata ?? {}
    const s = await sivu(md.source_url)
    if (!s) {
      console.log(`hanke ${h.id.slice(0, 8)} ${h.name} | SIVU EI AUKEA ${md.source_url}`)
      continue
    }
    const u = uudet(md, h.additional_info ?? md.description ?? null, s, h.name)
    rivi(`hanke${h.is_public ? "" : "(piilo)"}`, h.id, h.name, u)
    if (!u.kuvausVaihtuu && !u.lisatyt.length && !u.tunnusUusi) continue
    if (!apply) continue
    const { error } = await db
      .from("projects")
      .update({
        additional_info: u.kuvaus,
        metadata: {
          ...md,
          contact_persons: u.yhteys,
          kaava_tunnus: u.tunnus,
          ...(u.kuvausVaihtuu ? { description: u.kuvaus } : {}),
        },
      })
      .eq("id", h.id)
    if (error) console.log(`  VIRHE ${error.message}`)
    else muutettu++
  }

  for (const j of jono ?? []) {
    const md: any = j.metadata ?? {}
    const s = await sivu(md.source_url)
    if (!s) {
      console.log(`jono  ${j.id.slice(0, 8)} ${j.title} | SIVU EI AUKEA ${md.source_url}`)
      continue
    }
    const u = uudet(md, md.description ?? null, s, j.title)
    const vaiheVaihtuu = !!s.phase && s.phase !== md.decision_status
    rivi(`jono(${j.status})`, j.id, j.title, u, vaiheVaihtuu ? ` | vaihe ${md.decision_status} -> ${s.phase}` : "")
    if (!u.kuvausVaihtuu && !u.lisatyt.length && !u.tunnusUusi && !vaiheVaihtuu) continue
    if (!apply) continue
    const { error } = await db
      .from("potential_projects")
      .update({
        metadata: {
          ...md,
          contact_persons: u.yhteys,
          kaava_tunnus: u.tunnus,
          ...(s.phase ? { decision_status: s.phase } : {}),
          ...(u.kuvausVaihtuu ? { description: u.kuvaus } : {}),
        },
      })
      .eq("id", j.id)
    if (error) console.log(`  VIRHE ${error.message}`)
    else muutettu++
  }

  /* Dokumenteille sama, jotta uudelleentunnistus ei palauta vanhaa. */
  if (apply) {
    const { data: docs } = await db.from("source_documents").select("id,document_url,raw_payload").eq("source_name", LAHDE)
    let d2 = 0
    for (const d of docs ?? []) {
      const s = sivut.get(d.document_url)
      if (!s) continue
      const p: any = d.raw_payload ?? {}
      await db
        .from("source_documents")
        .update({
          raw_payload: {
            ...p,
            description: s.description ?? p.description ?? null,
            contacts: s.contacts,
            phase: s.phase ?? p.phase,
            kaava_tunnus: p.kaava_tunnus ?? raahenKaavatunnus(s.title ?? p.title ?? ""),
          },
        })
        .eq("id", d.id)
      d2++
    }
    console.log(`\nmuutettu ${muutettu} riviä, dokumentteja päivitetty ${d2}`)
  } else console.log("\nEi muutettu mitään. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
