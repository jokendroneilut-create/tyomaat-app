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
 * LINKITTÖMIEN VANTAAN KAAVOJEN SIVU TAKAUTUVASTI (D-423).
 *
 * Keräin etsii jatkossa linkittömälle kaavalle sivun RSS:stä ja
 * kaavalistauksesta (`lib/agent/vantaaKaavaSivu.ts`). Jo käsitellyt
 * dokumentit eivät kulje uudelleen tunnistuksen läpi, joten tämä tekee
 * saman niille kerran:
 *
 *   - dokumentti: osoite WFS#tunnus -> kaavan sivu, tietueeseen
 *     `kaavalinkki`, sivun hakija, yhteyshenkilöt ja kuvaus
 *   - jonorivi ja hanke: lähde ja asiakirjat sivulle, kuvaus sivulta jos
 *     nykyinen on D-366:n peruskuvaus, hakija jos tyhjä, yhteyshenkilöt
 *     jos tyhjät
 *
 *   npx tsx scripts/taydenna-vantaan-kaavasivut.ts
 *   npx tsx scripts/taydenna-vantaan-kaavasivut.ts --apply
 */

const WFS =
  "https://gis.vantaa.fi/geoserver/wfs?service=WFS&version=2.0.0&request=GetFeature&typeNames=kaava:asemakaavat_vireilla&outputFormat=application/json"

/* D-366:n peruskuvaus alkaa "Kaava 002657, Vantaa." — vain sen saa korvata. */
const PERUSKUVAUS = /^Kaava \S+, Vantaa\./

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { etsiKaavasivut } = await import("../lib/agent/vantaaKaavaSivu")
  const { fetchVantaaPlanDetails } = await import("../lib/agent/discovery/collectors/apiCollector")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? "=== AJO (--apply) ===\n" : "=== KUIVAHARJOITUS ===\n")

  const features = ((await (await fetch(WFS)).json()).features ?? []) as any[]
  const puuttuvat = features
    .filter((f) => !f.properties?.kaavalinkki)
    .map((f) => ({ tunnus: String(f.properties.kaavatunnus), nimi: String(f.properties.kaavanimi1) }))
  console.log(`kaavoja ${features.length}, ilman linkkiä ${puuttuvat.length}`)

  const loydetyt = await etsiKaavasivut({
    puuttuvat,
    tunnetutSivut: new Set(features.map((f) => f.properties?.kaavalinkki).filter(Boolean)),
    hae: async (u) => {
      const r = await fetch(u)
      return r.ok ? r.text() : null
    },
    budjetti: 20,
  })

  for (const k of puuttuvat) {
    const linkki = loydetyt.get(k.tunnus)
    console.log(`\n${k.nimi}: ${linkki ?? "EI SIVUA"}`)
    if (!linkki) continue
    const d = await fetchVantaaPlanDetails(linkki)
    console.log(`  hakija ${d.hakija ?? "-"} | yhteyshenkilöitä ${d.contacts.length} | kuvaus ${d.description?.length ?? 0} merkkiä`)
    console.log(`  ${String(d.description ?? "").replace(/\s+/g, " ").slice(0, 200)}`)

    const { data: docs } = await db
      .from("source_documents")
      .select("id,document_url,raw_text,raw_payload")
      /* Vain nykyisen rajapinnan dokumentti; vanhan kaavat_vireilla-osoitteen rivit jäävät. */
      .eq("document_url", `${WFS}#${k.tunnus}`)
    const { data: jono } = await db
      .from("potential_projects")
      .select("id,title,status,metadata")
      .eq("metadata->>kaava_tunnus", k.tunnus)
    const { data: hankkeet } = await db
      .from("projects")
      .select("id,name,is_public,developer,additional_info,metadata")
      .eq("metadata->>kaava_tunnus", k.tunnus)
    console.log(`  dokumentteja ${docs?.length ?? 0}, jonorivejä ${jono?.length ?? 0} (${(jono ?? []).map((j) => j.status).join(",")}), hankkeita ${hankkeet?.length ?? 0}`)
    if (!apply) continue

    for (const doc of docs ?? []) {
      const feature = JSON.parse(doc.raw_text)
      feature.properties = { ...feature.properties, kaavalinkki: linkki }
      const { error } = await db
        .from("source_documents")
        .update({
          document_url: linkki,
          raw_text: JSON.stringify(feature),
          raw_payload: {
            ...(doc.raw_payload ?? {}),
            original: feature,
            hakija: d.hakija,
            contacts: d.contacts,
            description: d.description,
            kaavatunnus: k.tunnus,
            kaavalinkki_lahde: "vantaa.fi",
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", doc.id)
      if (error) console.log(`  VIRHE dokumentti: ${error.message}`)
    }

    const tayta = (md: any) => ({
      ...md,
      documents_url: linkki,
      source_url: linkki,
      ...(d.description && (!md.description || PERUSKUVAUS.test(md.description)) ? { description: d.description } : {}),
      ...(d.hakija && !md.developer ? { developer: d.hakija } : {}),
      ...(d.contacts.length && !(md.contact_persons ?? []).length ? { contact_persons: d.contacts } : {}),
    })

    for (const j of jono ?? []) {
      const { error } = await db.from("potential_projects").update({ metadata: tayta(j.metadata ?? {}) }).eq("id", j.id)
      console.log(`  jonorivi ${j.id.slice(0, 8)} ${error ? "VIRHE " + error.message : "päivitetty"}`)
    }
    for (const h of hankkeet ?? []) {
      const korvaaKuvaus = d.description && (!h.additional_info || PERUSKUVAUS.test(h.additional_info))
      const { error } = await db
        .from("projects")
        .update({
          metadata: tayta(h.metadata ?? {}),
          ...(korvaaKuvaus ? { additional_info: d.description } : {}),
          ...(d.hakija && !h.developer ? { developer: d.hakija } : {}),
        })
        .eq("id", h.id)
      console.log(`  hanke ${h.id.slice(0, 8)} ${h.name} ${error ? "VIRHE " + error.message : "päivitetty"}`)
    }
  }
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
