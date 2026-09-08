import { readFileSync } from "node:fs"

/*
 * RAKENTAJIEN KOHDEKATALOGIT LAHTEIKSI (D-173, D-174).
 *
 * PELKKA KERAAJAN COMMITTAAMINEN EI RIITA. Lahde tarvitsee rivin
 * discovery_sources-tauluun (D-001), muuten sita ei koskaan ajeta.
 *
 * Mitattu 8.9.2026: `lujakoti` oli rekisteroity ja tuotti kuusi
 * ehdokasta (mm. "Asunto Oy Tampereen Pioni"), kun taas
 * `lapti_kohteet`, `bonava_kohteet` ja `t2h_kohteet` olivat koodissa
 * valmiina ja testattuina mutta tuottivat NOLLA ehdokasta - niilta
 * puuttui lahderivi.
 *
 * `parser` taosmaa `lib/agent/sources.ts`:n name-kenttaan
 * (legacyFetchCollector etsii lahteen sen perusteella).
 *
 * Odotettu tuotto ensimmaisella ajolla, mitattu keraajia
 * rakennettaessa: Lapti 9 kohdetta, Bonava 11, T2H 3-4 per kierros
 * (Crawl-delay 15 s rajoittaa, koko luettelo noin kahdessa viikossa).
 *
 *   npx tsx scripts/register-kohdekatalogit.ts
 *   npx tsx scripts/register-kohdekatalogit.ts --apply
 */

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

const APPLY = process.argv.includes("--apply")

/*
 * id annetaan itse: sarakkeella ei ole oletusarvoa. Nimeamistapa on sama
 * kuin `legacy-lujakoti`-rivilla, jotta koodilahteet erottuvat.
 */
const RIVIT = [
  {
    id: "legacy-lapti-kohteet",
    name: "Lapti - taloyhtiot",
    url: "https://lapti.fi/pdx_housingcompany-sitemap.xml",
    parser: "lapti_kohteet",
  },
  {
    id: "legacy-bonava-kohteet",
    name: "Bonava - kohdesivut",
    url: "https://www.bonava.fi/sitemap.xml",
    parser: "bonava_kohteet",
  },
  {
    id: "legacy-t2h-kohteet",
    name: "T2H - kohdesivut",
    url: "https://www.t2h.fi/sitemap.xml",
    parser: "t2h_kohteet",
  },
].map((r) => ({
  ...r,
  type: "html",
  category: "company_project",
  collector: "legacyFetchCollector",
  /* Sama taso kuin Lujakodilla: ei kiireellinen mutta ei turhakaan. */
  priority: 10,
  refresh_minutes: 1440,
  enabled: true,
}))

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { sources } = await import("../lib/agent/sources")

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  console.log(APPLY ? "=== AJETAAN ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===\n")

  for (const rivi of RIVIT) {
    /* Vaara parser-nimi ei kaada mitaan vaan jattaa lahteen hiljaa ajamatta. */
    const koodissa = sources.find((s: any) => s.name === rivi.parser)
    if (!koodissa) {
      console.log(`  OHITETAAN ${rivi.parser}: ei loydy lib/agent/sources.ts:sta`)
      continue
    }

    const { data: onJo, error: hErr } = await supabase
      .from("discovery_sources")
      .select("id,name,enabled")
      .or(`id.eq.${rivi.id},parser.eq.${rivi.parser}`)
      .maybeSingle()
    if (hErr && hErr.code !== "PGRST116") throw hErr

    if (onJo) {
      console.log(`  ON JO    ${rivi.parser.padEnd(16)} ${onJo.id} (enabled=${onJo.enabled})`)
      continue
    }

    console.log(`  LISATAAN ${rivi.parser.padEnd(16)} ${rivi.name}`)
    console.log(`           ${rivi.url}`)

    if (!APPLY) continue

    const { error } = await supabase.from("discovery_sources").insert(rivi)
    if (error) console.log(`           VIRHE: ${error.message}`)
    else console.log(`           lisatty: ${rivi.id}`)
  }

  if (!APPLY) console.log("\nKuivaharjoitus: mitaan ei kirjoitettu.")
}

main().catch((e) => {
  console.error("VIRHE:", e?.message ?? e)
  process.exit(1)
})
export {}
