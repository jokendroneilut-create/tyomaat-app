/*
 * Kertaluontoinen testi: varmistaa että Hilma-API tukee `skip`-sivutusta ja
 * että rakentamisen haku (cpvCodes:(45*)) palauttaa myös jälki-ilmoitukset
 * (ContractAwardNotices = tarjouskilpailun voittaja). Vahvistaa että
 * apiCollector.ts:n uusi sivutettu keräys toimii ennen kuin luotamme siihen
 * tuotannon cronissa.
 *
 * Aja projektin juuresta oikealla ympäristöllä (lukee saman URLin ja avaimen
 * kuin sovellus):
 *
 *   node --env-file=.env.local scripts/test-hilma-skip.mjs
 *
 * Ei kirjoita mitään kantaan — pelkkiä GET/POST-lukuja Hilmaan.
 */
import { createClient } from "@supabase/supabase-js"

const PAGE_SIZE = 100

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    console.error(`Puuttuu ympäristömuuttuja: ${name}`)
    process.exit(1)
  }
  return value
}

async function fetchHilmaPage(url, apiKey, skip) {
  const body = {
    search: "cpvCodes:(45*)",
    top: PAGE_SIZE,
    skip,
    count: true,
    searchMode: "any",
    orderby: "datePublished desc",
  }

  const started = Date.now()
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const ms = Date.now() - started

  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // jätetään json = null, tulostetaan raakateksti alla
  }

  return { ok: response.ok, status: response.status, ms, json, text }
}

function isAwardNotice(notice) {
  const mainType = String(notice.mainType ?? "").toLowerCase()
  return (
    mainType.includes("contractaward") ||
    Boolean(notice.winnerOrganisations)
  )
}

async function main() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const apiKey = requireEnv("HILMA_API_KEY")

  const supabase = createClient(supabaseUrl, serviceKey)

  // Käytä täsmälleen samaa URLia kuin tuotannon keräys.
  const { data: source, error } = await supabase
    .from("discovery_sources")
    .select("id, name, url, parser")
    .eq("parser", "hilmaParser")
    .maybeSingle()

  if (error) throw error
  if (!source) {
    console.error("discovery_sources-taulusta ei löytynyt hilmaParser-lähdettä")
    process.exit(1)
  }

  const url = source.url
  console.log(`Lähde: ${source.name} (${source.id})`)
  console.log(`URL:   ${url}`)
  console.log("")

  // Sivu 1: skip=0
  const page0 = await fetchHilmaPage(url, apiKey, 0)
  console.log(`[skip=0]   status ${page0.status}  ${page0.ms} ms`)
  if (!page0.ok) {
    console.error("Ensimmäinen haku epäonnistui. Vastaus:")
    console.error(page0.text.slice(0, 1000))
    process.exit(1)
  }

  const notices0 = Array.isArray(page0.json?.value) ? page0.json.value : []
  const total = page0.json?.["@odata.count"] ?? null
  console.log(`           @odata.count = ${total}`)
  console.log(`           palautti ${notices0.length} ilmoitusta`)

  // Sivu 2: skip=100 — jos skip tukeutuu, tämän pitää palauttaa ERI ilmoitukset
  const page1 = await fetchHilmaPage(url, apiKey, PAGE_SIZE)
  console.log(`[skip=${PAGE_SIZE}] status ${page1.status}  ${page1.ms} ms`)
  const notices1 = Array.isArray(page1.json?.value) ? page1.json.value : []
  console.log(`           palautti ${notices1.length} ilmoitusta`)
  console.log("")

  // --- Tulkinta ---
  const firstId0 = notices0[0]?.noticeId ?? notices0[0]?.id ?? null
  const firstId1 = notices1[0]?.noticeId ?? notices1[0]?.id ?? null

  const ids0 = new Set(notices0.map((n) => n.noticeId ?? n.id))
  const overlap = notices1.filter((n) => ids0.has(n.noticeId ?? n.id)).length

  console.log("== skip-tuki ==")
  console.log(`  sivun 0 ensimmäinen noticeId: ${firstId0}`)
  console.log(`  sivun 1 ensimmäinen noticeId: ${firstId1}`)
  console.log(`  päällekkäisiä ilmoituksia sivujen välillä: ${overlap}`)
  if (notices1.length > 0 && overlap === 0 && firstId0 !== firstId1) {
    console.log("  => OK: skip palauttaa eri ilmoitukset, sivutus toimii.")
  } else if (total != null && total <= PAGE_SIZE) {
    console.log(`  => Vain ${total} ilmoitusta yhteensä, joten sivu 1 on tyhjä odotetusti. skip hyväksyttiin (status ${page1.status}).`)
  } else {
    console.log("  => VAROITUS: sivu 1 ei näytä eroavan sivusta 0 — tarkista tukeeko API skip-parametria.")
  }
  console.log("")

  // Jälki-ilmoitukset (voittajat)
  const awards0 = notices0.filter(isAwardNotice)
  console.log("== jälki-ilmoitukset (voittajat) ==")
  console.log(`  sivulla 0: ${awards0.length}/${notices0.length} on jälki-ilmoituksia`)
  for (const a of awards0.slice(0, 3)) {
    console.log(
      `   - ${a.noticeNumber ?? a.noticeId}  mainType=${a.mainType}  voittaja=${a.winnerOrganisations ?? "-"}`
    )
  }
  if (awards0.length === 0) {
    console.log("  (Tällä hetkellä top-sivulla ei sattunut olemaan jälki-ilmoituksia — normaalia; koko päivän sivutus poimii ne kun niitä julkaistaan.)")
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
