/*
 * MIKSI TOIVON PAIVAKOTIKAUPPA EI TULLUT MEILLE? (tyojono 24.10.2026)
 *
 * Johannes: *"tutki tama lahde
 * https://www.inderes.fi/releases/toivo-group-oyj-on-allekirjoittanut-
 * kauppakirjan-espooseen-rakenteilla-olevasta-paivakodista-kinland-asn-
 * kanssa -- tasta olisimme saaneet tiedon etta paivakoti on jo
 * valmistunut tai olisi pitanyt valmistua."*
 *
 * Toivo on JO lahteena (`fetchToivoSource.ts`), joten tama ei ole uusi
 * lahde vaan kysymys suodattimesta: keraaja ottaa vain
 * `PRESS_RELEASE`-tunnisteen, ja kauppakirja on todennakoisesti
 * `STOCK_EXCHANGE_RELEASE`. Tama tulostaa tunnisteiden jakauman ja
 * etsii kyseisen tiedotteen.
 *
 *   npx tsx scripts/mittaa-porssitiedotteet.ts
 */

const WIDGET_ID = "toivo-4e1f3143-512d-4ee9-86a2-e9c74fee7484"
const LISTA_API =
  "https://europe-west1-inderes-widgets-prod.cloudfunctions.net/widgetProps/PublicationArchive"
const IR_SIVU = "https://sijoittajille.toivo.fi/fi/tiedotteet"

const OTSAKKEET = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  accept: "application/json",
  referer: IR_SIVU,
  origin: "https://sijoittajille.toivo.fi",
}

async function main() {
  const url = `${LISTA_API}?widgetId=${encodeURIComponent(WIDGET_ID)}&locale=fi`
  const res = await fetch(url, { headers: OTSAKKEET, cache: "no-store" })
  if (!res.ok) {
    console.error(`HTTP ${res.status}`)
    process.exit(1)
  }
  const json: any = await res.json()
  const rivit: any[] = json?.props?.publications ?? []
  console.log(`Julkaisuja yhteensä: ${rivit.length}\n`)

  const vuosi = Date.now() - 365 * 86_400_000
  const jakauma = new Map<string, { kaikki: number; tuoreet: number }>()
  for (const p of rivit) {
    const tuore = new Date(String(p?.publishedAt ?? "")).getTime() >= vuosi
    for (const t of Array.isArray(p?.tags) ? p.tags : ["(ei tunnistetta)"]) {
      const o = jakauma.get(t) ?? { kaikki: 0, tuoreet: 0 }
      o.kaikki += 1
      if (tuore) o.tuoreet += 1
      jakauma.set(t, o)
    }
  }
  console.log("Tunniste                     kaikki   12 kk")
  for (const [t, o] of [...jakauma.entries()].sort((a, b) => b[1].kaikki - a[1].kaikki)) {
    console.log(`${t.padEnd(28)} ${String(o.kaikki).padStart(6)} ${String(o.tuoreet).padStart(7)}`)
  }

  console.log("\n=== Johanneksen tiedote ===")
  const osuma = rivit.filter((p) => /kauppakirjan|kinland|päiväkodi/i.test(String(p?.title ?? "")))
  for (const p of osuma) {
    console.log(`${String(p.publishedAt).slice(0, 10)}  [${(p.tags ?? []).join(", ")}]`)
    console.log(`   ${String(p.title).replace(/\s+/g, " ")}`)
  }
  if (!osuma.length) console.log("ei löytynyt arkistosta")

  console.log("\n=== 12 kk pörssitiedotteiden otsikot ===")
  const porssi = rivit
    .filter(
      (p) =>
        Array.isArray(p?.tags) &&
        p.tags.includes("STOCK_EXCHANGE_RELEASE") &&
        new Date(String(p?.publishedAt ?? "")).getTime() >= vuosi
    )
    .sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)))
  for (const p of porssi) {
    console.log(`${String(p.publishedAt).slice(0, 10)}  ${String(p.title).replace(/\s+/g, " ").slice(0, 110)}`)
  }
  console.log(`\nPörssitiedotteita 12 kk: ${porssi.length}`)
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
