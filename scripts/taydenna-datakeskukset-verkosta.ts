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
 * DATAKESKUSRIVIT ILMAN RAKENNUTTAJAA: VERKKOHAUN LÖYDÖKSET (D-436).
 *
 * Rekisteripäivityksen jälkeen 18 julkista datakeskusriviä oli ilman
 * rakennuttajaa. Jokaiselle tehtiin verkkohaku 17.11.2026. Tähän on
 * kirjattu vain lähteellä varmistettu tieto, ja jokaiselle kentälle sen
 * lähde (`field_sources`). Täytetään vain tyhjä kenttä; kuvaukseen
 * lisätään löydös omana virkkeenään lähteineen.
 *
 * Ei löytynyt varmaa tietoa (jätetty): Alajärvi Luoma-aho, Eura Panelia,
 * Liminka Erilä, Mäntsälä Ojamäentie 73, Mikkeli Portinhoikka, Oulu
 * Laakeritie 22, Valkeakoski Huhtakatu, Kerava Nybackantie 6 (todennäköisesti
 * FCDC, mutta osoitetta ei yhdistä mikään lähde), Nurmijärvi Sudentulli
 * (sama hanke kuin DayOnen rivit -> yhdistettävä, ei täydennettävä).
 *
 *   npx tsx scripts/taydenna-datakeskukset-verkosta.ts [--apply]
 */

type Taydennys = {
  id: string
  developer?: string
  builder?: string
  related?: string[]
  metadata?: Record<string, unknown>
  lisays?: string
  lahde: string
  lahdeUrl: string
}

const TAYDENNYKSET: Taydennys[] = [
  {
    id: "956e26e4",
    developer: "FCDC Corp Oy",
    metadata: { teho_mw: 250 },
    lisays:
      "Lupa- ja valvontaviraston YVA-tarveharkintapäätös 12.6.2026 koskee FCDC Corp Oy:n suunnittelemaa 250 MW:n datakeskusta Keravalla; pyyntö tehtiin Eteläisen Jokilaakson asemakaavan ollessa vireillä. Lähin asutus on noin 70 metrin päässä alueen rajasta.",
    lahde: "LVV:n YVA-päätös 12.6.2026",
    lahdeUrl: "https://www.ymparisto.fi/sites/default/files/documents/YVA-p%C3%A4%C3%A4t%C3%B6s%20LVV%20Kerava%20Datakeskus.pdf",
  },
  {
    id: "b157a8cc",
    developer: "Helios 2 Dewberry Oy",
    related: ["Helios Nordic Energy", "Fingrid Oyj"],
    metadata: { pinta_ala_ha: 87 },
    lisays:
      "Helios 2 Dewberry Oy jätti 12.8.2026 asemakaava-aloitteen noin 87 hehtaarin datakeskusalueesta. Fingridin Alapitkän sähköasema on suunnittelualueen länsipuolella, ja datakeskus liitetään siihen. Maanomistajien kanssa on tehty sopimukset alueista.",
    lahde: "Lapinlahden kunnan pöytäkirjan liite (Helios 2 Dewberry Oy:n kaava-aloite 12.8.2026)",
    lahdeUrl: "https://dynasty.lapinlahti.fi/Internet/kokous/1F6AEDCEX5BFDX4ACAXADE3X06AAE1C8945C-8-44425.PDF",
  },
  {
    id: "0f5528ae",
    developer: "Fortum Power and Heat Oy",
    related: ["Fortum Oyj"],
    lisays:
      "Kaupungin sopimuksen osapuoli on Fortum Power and Heat Oy, jonka tavoitteena on kehittää Länsi-Pennalan aluetta datakeskustoimintaa tai vastaavaa kaupallista toimintaa varten.",
    lahde: "Orimattilan kaupungin kokousasiakirja",
    lahdeUrl: "https://orimattilad10.oncloudos.com/kokous/2026581-11-25469.PDF",
  },
  {
    id: "7e116ff2",
    developer: "ShelCo 294 Oy",
    lisays: "Kaavan osallistumis- ja arviointisuunnitelman mukaan hankeyhtiö on ShelCo 294 Oy.",
    lahde: "Seinäjoen kaupungin OAS (kaava 16003)",
    lahdeUrl: "https://seinajoki.fi/wp-content/uploads/2025/01/16003-oas.pdf",
  },
  {
    id: "107d757d",
    developer: "Nebius",
    lisays:
      "Caverion rakentaa sähköaseman Nebiuksen toiselle Mäntsälän datakeskukselle Kapulin alueelle; valmistuminen syksyllä 2027.",
    lahde: "rivin oma lähde (Rakennuslehti) ja Caverionin tiedote",
    lahdeUrl: "https://thenextweb.com/news/caverion-nebius-substation-mantsala-finland",
  },
  {
    id: "b60f32f3",
    developer: "XTX Markets",
    builder: "YIT",
    lahde: "rivin oma kuvaus (Rakennuslehti): urakkasopimus YIT:n ja XTX Marketsin välillä",
    lahdeUrl: "",
  },
  {
    id: "6a3310b0",
    developer: "Verne",
    lisays:
      "Mittalinja 1 on Vernen (ent. Verne Global / Ficolo) The Air -datakeskuskampus; datakeskusluetteloiden mukaan kampukselle on suunnitteilla uusi vaihe (FL-HEL-DC04, 2028).",
    lahde: "datakeskusluettelot (Baxtel, Inflect), ei viranomaislähde",
    lahdeUrl: "https://baxtel.com/data-center/verne-helsinki-the-air",
  },
  {
    id: "fd4a9f5c",
    builder: "Skanska",
    lisays:
      "Skanskan tiedotteen 26.8.2026 mukaan urakka sisältää datakeskuksen runko- ja kuorirakentamisen; työt alkavat loppusyksyllä 2026 ja valmistuvat alkusyksyllä 2027. Tilaaja on teknologiayhtiö, jota ei nimetty.",
    lahde: "Skanskan tiedote 26.8.2026",
    lahdeUrl: "https://www.skanska.com/group/en/media/press-releases/2026/skanska-to-build-data-center-in-finland-for-eur-77m-about-sek-830m",
  },
  {
    id: "b3118a96",
    lisays:
      "Viereiselle kiinteistölle (Emalikatu 13) suunnitellaan Järvenpään datakeskusta, jonka YVA-menettelyssä hankkeesta vastaa Data Prop Link Oy; lähde ei kerro, palveleeko tämä sähköasema juuri sitä.",
    lahde: "Järvenpään datakeskuksen YVA-ohjelma",
    lahdeUrl: "https://www.jarvenpaa.fi/files/3808ca35cda513dd6247e09f444b7a76e2125406/kuulutus-jarvenpaan-palvelinkeskuksen-yva-ohjelmasta.pdf",
  },
]

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data: kaikki } = await db
    .from("projects")
    .select("id,name,developer,builder,additional_info,metadata")
    .eq("is_public", true)
    .ilike("property_type", "datakeskus")
  for (const t of TAYDENNYKSET) {
    const h = (kaikki ?? []).find((r) => r.id.startsWith(t.id))
    if (!h) {
      console.log(`EI LÖYDY ${t.id}`)
      continue
    }
    const md: any = h.metadata ?? {}
    const fs: any = { ...(md.field_sources ?? {}) }
    const sarakkeet: Record<string, unknown> = {}
    const uusiMd: any = { ...md }
    const muutos: string[] = []
    if (t.developer && !h.developer) {
      sarakkeet.developer = t.developer
      uusiMd.developer = t.developer
      fs.developer = t.lahde
      muutos.push(`rakennuttaja ${t.developer}`)
    }
    if (t.builder && !h.builder) {
      sarakkeet.builder = t.builder
      fs.builder = t.lahde
      muutos.push(`urakoitsija ${t.builder}`)
    }
    if (t.related?.length) {
      uusiMd.related_companies = mergeCompanyNames(Array.isArray(md.related_companies) ? md.related_companies : [], t.related)
      muutos.push(`liittyvät ${t.related.join(", ")}`)
    }
    for (const [k, v] of Object.entries(t.metadata ?? {})) {
      if (md[k] == null) {
        uusiMd[k] = v
        fs[k] = t.lahde
        muutos.push(`${k} ${v}`)
      }
    }
    if (t.lisays && !String(h.additional_info ?? "").includes(t.lisays.slice(0, 40))) {
      const kuvaus = `${String(h.additional_info ?? "").trim()} ${t.lisays} (Lähde: ${t.lahde}.)`.trim()
      sarakkeet.additional_info = kuvaus
      uusiMd.description = kuvaus
      muutos.push(`kuvaus +${t.lisays.length} merkkiä`)
    }
    if (t.lahdeUrl) {
      uusiMd.lisalahteet = Array.from(new Set([...(Array.isArray(md.lisalahteet) ? md.lisalahteet : []), t.lahdeUrl]))
    }
    uusiMd.field_sources = fs
    uusiMd.verkkohaku_taydennetty = "2026-11-17"
    console.log(`${h.id.slice(0, 8)} ${String(h.name).slice(0, 50).padEnd(50)} | ${muutos.join(" | ") || "ei muutosta"}`)
    if (!apply || !muutos.length) continue
    const { error } = await db.from("projects").update({ ...sarakkeet, metadata: uusiMd }).eq("id", h.id)
    if (error) console.log(`  VIRHE ${error.message}`)
  }
  if (!apply) console.log("\nKuivaharjoitus. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
