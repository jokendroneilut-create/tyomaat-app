/*
 * Täydentää jonossa olevat peab-ehdokkaat tiedotteen leipätekstillä ja
 * korjaa niiden otsikon ja vaiheen.
 *
 * Lähde poimi aiemmin vain listaussivun linkin otsikon eikä hakenut
 * tiedotesivua lainkaan, joten kuvaus, rakennuttaja ja urakoitsija jäivät
 * tyhjiksi ja vaiheeksi tuli aina "Suunnittelussa". Uudet ajot hakevat sivun
 * itse (enrich-koukku), mutta vanhat rivit eivät täydenny: niiden osoitteet
 * ovat jo "nähtyjen" joukossa, joten kerääjä ohittaa ne.
 *
 * Otsikko johdetaan uudelleen tiedotesivun <title>-elementistä, koska kantaan
 * on tallennettu vain katkaistu muoto - ja juuri katkaisu oli osin rikki
 * ("Ja uudistaa Iisalmen kulttuurikeskuksen").
 *
 * Kertaluontoinen. Sama kuvio kuin backfill-stt-details.ts.
 *
 *   npx tsx scripts/backfill-peab.ts
 *   npx tsx scripts/backfill-peab.ts --apply
 */
import { readFileSync } from "node:fs"

const APPLY = process.argv.includes("--apply")

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1)
  }
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/* Peabin <title> on muotoa "<otsikko> - Peab". */
async function fetchHeadline(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" })
    if (!res.ok) return null
    const raw = (await res.text()).match(/<title>([^<]*)<\/title>/i)?.[1]
    if (!raw) return null
    return raw
      .replace(/&amp;/g, "&")
      .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
      .replace(/\s*-\s*Peab\s*$/i, "")
      .trim()
  } catch {
    return null
  }
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { enrichPeabCandidate } = await import("../lib/agent/fetchPeabSource")
  const { stripCompanyPrefixFromHeadline } = await import("../lib/agent/stripCompanyPrefix")
  const { detectCityFromText } = await import("../lib/agent/detectCityFromText")
  const { getMunicipalityByName } = await import("../lib/geo/municipalities")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const { data, error } = await supabase
    .from("potential_projects")
    .select("id, title, municipality, address, status, metadata")
    .eq("metadata->>source", "peab")

  if (error) throw error

  const targets = (data ?? []).filter((r: any) => r.metadata?.source_url)
  console.log(
    `${APPLY ? "KIRJOITETAAN" : "KUIVAHARJOITTELU (--apply kirjoittaa)"} — ${targets.length} riviä\n`
  )

  for (const row of targets as any[]) {
    const md = row.metadata ?? {}

    const headline = await fetchHeadline(md.source_url)
    if (!headline) {
      console.log(`- ${row.title}: otsikkoa ei saatu, ohitetaan\n`)
      continue
    }

    const enriched = await enrichPeabCandidate({
      name: headline,
      city: detectCityFromText(headline),
      location: null,
      builder: "Peab",
      source_url: md.source_url,
      source_name: "peab",
    })

    const title = stripCompanyPrefixFromHeadline(headline)
    const city = row.municipality ?? enriched.city ?? null
    const region = md.region ?? getMunicipalityByName(city)?.region ?? null

    console.log(`### ${row.title}`)
    console.log(`  otsikko:      ${title}`)
    console.log(`  maakunta:     ${md.region ?? "-"} -> ${region ?? "-"}`)
    console.log(`  kohdetyyppi:  ${md.building_type ?? "-"} -> ${enriched.property_type ?? "-"}`)
    console.log(`  vaihe:        ${md.phase_hint ?? "-"} -> ${enriched.phase}`)
    console.log(`  rakennuttaja: ${md.developer ?? "-"} -> ${enriched.developer ?? "-"}`)
    console.log(`  urakoitsija:  ${md.builder ?? "-"} -> ${enriched.builder ?? "-"}`)
    console.log(
      `  kuvaus:       ${md.description ? `${String(md.description).length} merkkiä` : "-"}` +
        ` -> ${enriched.description?.length ?? 0} merkkiä`
    )
    console.log(`  valmistuu:    ${md.estimated_completion ?? "-"} -> ${enriched.estimated_completion ?? "-"}`)

    if (!APPLY) {
      console.log("")
      continue
    }

    const { error: updateError } = await supabase
      .from("potential_projects")
      .update({
        title,
        municipality: city,
        address: row.address ?? enriched.location ?? null,
        metadata: {
          ...md,
          operation: title,
          region,
          /*
           * Uudelleen laskettu arvo voittaa vanhan. Toisin päin kirjoitettuna
           * ajo ei korjaa aiemman version virheitä - mitattu: Iisalmen
           * kulttuurikeskukselle jäi "Kirjasto", vaikka tuloste näytti jo
           * oikean arvon.
           */
          building_type: enriched.property_type ?? md.building_type ?? null,
          description: enriched.description ?? md.description ?? null,
          developer: enriched.developer ?? md.developer ?? null,
          builder: enriched.builder ?? md.builder ?? null,
          phase_hint: enriched.phase,
          estimated_completion: enriched.estimated_completion ?? md.estimated_completion ?? null,
          enriched_at: new Date().toISOString(),
        },
      })
      .eq("id", row.id)

    console.log(updateError ? `  VIRHE: ${updateError.message}\n` : "  päivitetty\n")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
