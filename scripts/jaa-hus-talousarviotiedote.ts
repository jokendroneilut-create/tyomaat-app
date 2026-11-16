import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RKP:N HUS-TALOUSARVIOTIEDOTE KAHDEKSI EHDOKKAAKSI (D-432).
 *
 * Tiedote 16.11.2026 "Porvoon uuden sairaalan suunnittelu käynnistyy –
 * investointimäärärahoja Raaseporin ja Lohjan sairaaloille" on poliittisen
 * ryhmän katsaus HUSin vuoden 2027 talousarvioon. Sen sisällä on kaksi
 * merkittävää rakennushanketta, joita kannassa ei ollut:
 *
 *   - Porvoon uusi sairaala (HUSin osuus 90 M€, investointi 2027–2032)
 *   - Lohjan sairaalan peruskorjaus (käynnistyy 2027)
 *
 * Raaseporin dialyysin vedenpuhdistusjärjestelmä on laitehankinta, ei
 * rakennushanke, joten siitä ei tehdä riviä.
 *
 * Alkuperäinen rivi jätetään jonoon: Johannes hylkää sen itse. Jokainen
 * uusi rivi saa oman fragmentin lähdeosoitteeseen, koska sama osoite
 * hylättäisiin duplikaattina (multi-project-rows, ansa 1).
 *
 * Tiedotteen yhteyshenkilöt ovat RKP:n edustajat HUSin hallituksessa eli
 * luottamushenkilöitä, eivät hankkeen yhteyshenkilöitä. Siksi rooli on
 * authority, kuten D-255:ssä.
 *
 *   npx tsx scripts/jaa-hus-talousarviotiedote.ts
 *   npx tsx scripts/jaa-hus-talousarviotiedote.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const LAHDE = "9dbc19fb-16a3-40a6-9247-b8b2173ada10"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const { data } = await db.from("potential_projects").select("*").eq("id", LAHDE).maybeSingle()
  const alku: any = data
  if (!alku) { console.log("lahderivia ei loydy"); return }
  const md = alku.metadata ?? {}
  const url = String(md.source_url)

  const yhteys = (md.contact_persons ?? []).map((c: any) => ({ ...c, role: "authority", organization: "HUS-yhtymän hallitus (RKP)" }))

  const pohja = (kunta: string, fragmentti: string) => ({
    status: "new",
    municipality: kunta,
    source_count: 1,
    metadata: {
      region: "Uusimaa",
      city: kunta,
      source: md.source,
      source_name: md.source_name,
      firstSourceName: md.firstSourceName ?? md.source_name,
      source_url: `${url}#${fragmentti}`,
      source_history: md.source_history ?? null,
      resolver: "manual-split",
      phase_hint: "Suunnittelussa",
      building_type: "Sairaala",
      property_type: "Sairaala",
      developer: "HUS-yhtymä",
      contact_persons: yhteys,
      jaettu_lahteesta: LAHDE,
      eroteltu_rivista: LAHDE,
    },
  })

  const porvoo = pohja("Porvoo", "porvoon-uusi-sairaala")
  const lohja = pohja("Lohja", "lohjan-sairaalan-peruskorjaus")
  const uudet = [
    {
      ...porvoo,
      title: "Porvoon uusi sairaala",
      address: "Porvoo",
      confidence: 75,
      metadata: {
        ...porvoo.metadata,
        location: "Porvoo",
        estimated_cost: 90000000,
        cost_source: "Tiedote: HUSin osuus kokonaisinvestoinnista 90 M€",
        related_companies: ["Itä-Uudenmaan hyvinvointialue"],
        description: [
          "HUS-yhtymän hallitus hyväksyi 16.11.2026 talousarvioesityksensä vuodelle 2027, ja siihen sisältyvät Porvoon uuden sairaalan ensimmäiset suunnittelumäärärahat.",
          "HUSin osuus kokonaisinvestoinnista on 90 miljoonaa euroa, ja investointi on ajoitettu vuosille 2027–2032. Luku on HUSin osuus, ei koko hankkeen kustannus.",
          "Hanke tehdään yhdessä Itä-Uudenmaan hyvinvointialueen kanssa. Ylen mukaan kokonaisuuteen kuuluu myös sote-keskus, valmistuminen on aikaisintaan 2032, ja sijainniksi on keskusteltu Kuninkaanportin aluetta.",
          "Talousarvio etenee vielä HUSin yhtymäkokouksen hyväksyttäväksi.",
        ].join(" "),
      },
    },
    {
      ...lohja,
      title: "Lohjan sairaalan peruskorjaus",
      address: "Sairaalatie 8, Lohja",
      confidence: 70,
      metadata: {
        ...lohja.metadata,
        location: "Lohjan sairaala, Sairaalatie 8, Lohja",
        operation: "Peruskorjaus",
        description: [
          "HUS-yhtymän hallitus hyväksyi 16.11.2026 vuoden 2027 talousarvioesityksen ja investointisuunnitelman, jonka mukaan Lohjan sairaalan peruskorjaus käynnistyy vuonna 2027.",
          "Tiedote ei kerro peruskorjauksen laajuutta eikä kustannusarviota.",
          "Talousarvio etenee vielä HUSin yhtymäkokouksen hyväksyttäväksi.",
          "Erillinen hanke kannassa: HUS Lohjan sairaalan lämmitysjärjestelmän muutos (Kilpailutus, 3,4 M€).",
        ].join(" "),
      },
    },
  ]

  console.log("LAHDE:", alku.title, "| tila", alku.status)
  for (const u of uudet) {
    console.log("\n=== " + u.title)
    console.log("   kunta/sijainti", u.municipality, "|", u.metadata.location)
    console.log("   rakennuttaja ", u.metadata.developer, "| liittyvat", JSON.stringify((u.metadata as any).related_companies ?? []))
    console.log("   vaihe        ", u.metadata.phase_hint, "| varmuus", u.confidence, "| kustannus", (u.metadata as any).estimated_cost ?? "-")
    console.log("   lahde        ", u.metadata.source_url)
    console.log("   yhteyshlo    ", u.metadata.contact_persons.map((c: any) => `${c.name} [${c.role}]`).join(", "))
    console.log("   kuvaus       ", u.metadata.description.slice(0, 160) + "...")
  }
  if (!APPLY) { console.log("\n=== KUIVAHARJOITUS ==="); return }

  const idt: string[] = []
  for (const u of uudet) {
    const { data: luotu, error } = await db.from("potential_projects").insert(u).select("id,status").single()
    if (error) throw error
    idt.push(luotu.id)
  }
  await db.from("potential_projects").update({ metadata: { ...md, jaettu_ehdokkaiksi: idt } }).eq("id", LAHDE)

  const { data: tarkistus } = await db.from("potential_projects").select("id,status,title").in("id", idt)
  console.log("\n=== LUOTU ===")
  for (const r of tarkistus ?? []) console.log(`   ${r.status}  https://app.tyomaat.fi/tic/projects/${r.id}  ${r.title}`)
}
main().catch(e => { console.error(e); process.exit(1) })
