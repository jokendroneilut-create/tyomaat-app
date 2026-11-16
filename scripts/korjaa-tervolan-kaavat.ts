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
 * TERVOLAN KAAVAT TAKAUTUVASTI (D-429).
 *
 * Keräin lukee nyt ingressin ja yhteystietolaatikon. Tämä tekee saman
 * kannan hankkeille, jonoriveille ja dokumenteille:
 *
 *   - yhteyshenkilöt: laatikon henkilöt lisätään; alatunnisteesta
 *     poimitut kunnan vaihde/kirjaamo/info poistetaan
 *   - rakennuttaja: laatikon hankevastaava (tai ingressin
 *     aloitteentekijä). Jos vanha poikkeaa, se säilyy liittyvänä
 *     yrityksenä (Kuoringissa aloite oli Myrsky Energian, nyt vastaa ABO)
 *   - kuvaus: vaihdetaan vain jos vanhassa on alatunniste tai se sisältyy
 *     uuteen kokonaan
 *
 *   npx tsx scripts/korjaa-tervolan-kaavat.ts
 *   npx tsx scripts/korjaa-tervolan-kaavat.ts --apply
 */

const LAHDE = "Tervolan kaavoitus"
const ALATUNNISTE = /Jaa sivu eteenpäin|Seuraa meitä|Ota yhteyttä Vaihde/
const ROSKAOSOITTEET = new Set(["info@tervola.fi", "tervolan.kunta@tervola.fi"])

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { tervolanKaavasivu, aloitteentekija } = await import("../lib/agent/tervolaKaava")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? "=== AJO (--apply) ===\n" : "=== KUIVAHARJOITUS ===\n")

  const { data: hankkeet } = await db
    .from("projects")
    .select("id,name,developer,additional_info,metadata")
    .eq("metadata->>source_name", LAHDE)
  const { data: jono } = await db
    .from("potential_projects")
    .select("id,title,metadata")
    .eq("metadata->>source_name", LAHDE)

  const sivut = new Map<string, ReturnType<typeof tervolanKaavasivu>>()
  async function sivu(url: string) {
    if (!sivut.has(url)) {
      sivut.set(url, tervolanKaavasivu(await (await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } })).text()))
      await new Promise((s) => setTimeout(s, 400))
    }
    return sivut.get(url)!
  }

  function uudetKentat(md: any, vanhaKehittaja: string | null, vanhaKuvaus: string | null, s: ReturnType<typeof tervolanKaavasivu>) {
    const aloite = aloitteentekija(s.ingressi)
    const kehittaja = s.osapuolet.developer ?? aloite ?? vanhaKehittaja
    const yritykset = mergeCompanyNames(Array.isArray(md.related_companies) ? md.related_companies : [], [
      kehittaja,
      aloite,
      vanhaKehittaja,
      ...s.osapuolet.consultants,
    ].filter(Boolean) as string[])
    const vanhat: any[] = (Array.isArray(md.contact_persons) ? md.contact_persons : []).filter(
      (c: any) => !ROSKAOSOITTEET.has(String(c?.email ?? "").toLowerCase())
    )
    const lisattavat = s.osapuolet.contacts.filter(
      (c) =>
        !vanhat.some(
          (v: any) =>
            (c.email && String(v?.email ?? "").toLowerCase() === c.email.toLowerCase()) ||
            (c.name && String(v?.name ?? "").toLowerCase() === c.name.toLowerCase())
        )
    )
    const kuvausVaihtuu =
      !!s.kuvaus && !!vanhaKuvaus && (ALATUNNISTE.test(vanhaKuvaus) || (s.kuvaus.includes(vanhaKuvaus) && s.kuvaus !== vanhaKuvaus))
    return {
      kehittaja,
      yritykset,
      yhteys: [...vanhat, ...lisattavat],
      poistetut: (Array.isArray(md.contact_persons) ? md.contact_persons.length : 0) - vanhat.length,
      lisatyt: lisattavat.length,
      kuvaus: kuvausVaihtuu ? s.kuvaus : vanhaKuvaus,
      kuvausVaihtuu,
    }
  }

  for (const h of hankkeet ?? []) {
    const md: any = h.metadata ?? {}
    const s = await sivu(md.source_url)
    const u = uudetKentat(md, h.developer, h.additional_info, s)
    console.log(
      `hanke ${h.id.slice(0, 8)} ${h.name.slice(0, 45).padEnd(45)} | rak ${h.developer ?? "-"} -> ${u.kehittaja ?? "-"} | yht -${u.poistetut} +${u.lisatyt} | kuvaus ${u.kuvausVaihtuu ? "vaihtuu" : "ennallaan"}`
    )
    if (!apply) continue
    const { error } = await db
      .from("projects")
      .update({
        developer: u.kehittaja,
        additional_info: u.kuvaus,
        metadata: {
          ...md,
          developer: u.kehittaja,
          related_companies: u.yritykset,
          contact_persons: u.yhteys,
          ...(u.kuvausVaihtuu ? { description: u.kuvaus } : {}),
        },
      })
      .eq("id", h.id)
    if (error) console.log(`  VIRHE ${error.message}`)
  }

  for (const j of jono ?? []) {
    const md: any = j.metadata ?? {}
    if (!md.source_url) continue
    const s = await sivu(md.source_url)
    const u = uudetKentat(md, md.developer ?? null, md.description ?? null, s)
    console.log(`jono  ${j.id.slice(0, 8)} ${j.title.slice(0, 45).padEnd(45)} | rak -> ${u.kehittaja ?? "-"} | yht +${u.lisatyt}`)
    if (!apply) continue
    const { error } = await db
      .from("potential_projects")
      .update({
        metadata: {
          ...md,
          developer: u.kehittaja,
          related_companies: u.yritykset,
          contact_persons: u.yhteys,
          ...(u.kuvausVaihtuu ? { description: u.kuvaus } : {}),
        },
      })
      .eq("id", j.id)
    if (error) console.log(`  VIRHE ${error.message}`)
  }

  /* Dokumenteille sama, jotta uudelleentunnistus ei palauta vanhaa. */
  if (apply) {
    const { data: docs } = await db.from("source_documents").select("id,document_url,raw_payload").eq("source_name", LAHDE)
    for (const d of docs ?? []) {
      const s = sivut.get(d.document_url)
      if (!s) continue
      const aloite = aloitteentekija(s.ingressi)
      const kehittaja = s.osapuolet.developer ?? aloite
      await db
        .from("source_documents")
        .update({
          raw_payload: {
            ...(d.raw_payload as any),
            description: s.kuvaus,
            contacts: s.osapuolet.contacts,
            developer: kehittaja,
            related_companies: [kehittaja, aloite, ...s.osapuolet.consultants].filter(
              (x, i, k) => !!x && k.indexOf(x) === i
            ),
          },
        })
        .eq("id", d.id)
    }
  }
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
