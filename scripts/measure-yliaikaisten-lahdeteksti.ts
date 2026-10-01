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
 * YLIAIKAISTEN LAHDETEKSTI (D-220, signaali 1).
 *
 * Kaikki 12 yliaikaista kaatuvat PORTTIIN 1: arvioitu valmistumispaiva
 * on vanhempi kuin loytohetki. Portti on oikeassa siina etta paiva ei
 * ole todiste - mutta se ei kerro kummasta on kyse:
 *
 *   a) paiva on luettu vaarin (viite vanhaan vaiheeseen tai liitteeseen)
 *   b) artikkeli on vanha ja hanke on todella valmistunut
 *
 * Erottelu vaatii lahdetekstin lukemisen. Tama tulostaa sen, jotta
 * paatos ei synny otsikosta.
 *
 *   npx tsx scripts/measure-yliaikaisten-lahdeteksti.ts
 */

const IDT: { id: string; url: string }[] = [
  { id: "50b5119a-6668-40da-bef0-3fd21a586de2", url: "" },
  {
    id: "0a6a7b0c-ca49-41b8-a2b8-6b0567ee8402",
    url: "https://www.pohjolarakennus.fi/artikkeli/pohjola-rakennukselta-42-uutta-kotia-haagaan-asunto-oy-helsingin-atsalean-rakentaminen-on-alkanut/",
  },
  {
    id: "6d07d8b6-9973-40d2-9081-bf00380dd87c",
    url: "https://www.pohjolarakennus.fi/artikkeli/pohjola-rakennus-konserni-rakentaa-kuusi-asuinkerrostaloa-helsinkiin-espooseen-naantaliin-ja-tampereelle/",
  },
  {
    id: "b958fc0d-66d5-4577-af45-c683087020e2",
    url: "https://www.senaatti.fi/ajankohtaista/uutiset/puolustuskiinteistot-rakennuttaa-rissalan-tukikohtaan-uuden-kasarmin/",
  },
  {
    id: "af682d07-fa01-4671-bec7-ab8e17389f4e",
    url: "https://www.sttinfo.fi/release/70561084/skanska-toteuttaa-vuorikatu-3n-kiinteiston-peruskorjausurakan-helsingissa?publisherId=69819623&lang=fi",
  },
  { id: "6df32dcd-f860-4d26-bd30-5dfbbe0e3c22", url: "https://jyvaskyla.cloudnc.fi/fi-FI/content/2628/23" },
  {
    id: "d53b1aa1-4f30-419e-b49c-8acc218ba052",
    url: "https://www.sttinfo.fi/release/70974958/hartela-rakentaa-vahittaiskauppaketju-julalle-ensimmaisen-myymalarakennuksen-paakaupunkiseudulle?publisherId=1812&lang=fi",
  },
  { id: "e753b699-17fe-4dcc-b425-92238bf88f91", url: "https://jyvaskyla.cloudnc.fi/fi-FI/content/2410/23" },
  {
    id: "ea695ab7-cdf7-43a5-b8ad-d19073f28830",
    url: "https://www.sttinfo.fi/tiedote/71988252/helsingin-liikuntakenttien-tarjonta-paranee-uusia-tekonurmikenttia-rakennetaan-kesan-aikana?publisherId=60577852&lang=fi",
  },
  { id: "e9e28d77-946b-4480-98e6-599acbafb81b", url: "https://www.senaatti.fi/hankkeet/vantaan-uusi-oikeustalo/" },
  { id: "8bc29c89-09b4-4eb8-8e45-39fee096122d", url: "https://www.senaatti.fi/hankkeet/jyvaskylan-oikeustalon-peruskorjaus/" },
  { id: "975c3fc4-97ed-4a1e-b10c-8320ce2d1176", url: "https://vayla.fi/siltatyot-ita-suomessa" },
]

/* Paivamaarat tekstista: niista selviaa onko artikkeli vanha. */
const VUOSILUKU = /\b(20[0-2]\d)\b/g
const AIKAVIHJE =
  /valmistu\w*|k(?:ä|a)ytt(?:ö|o)(?:ö|o)nott\w*|urakka\w*|aikatalu\w*|alkoi|alkanut|alkavat|k(?:ä|a)ynniss(?:ä|a)|luovut\w*/gi

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  for (const { id, url } of IDT) {
    const { data: p } = await db
      .from("projects")
      .select("name, city, phase, estimated_completion, created_at")
      .eq("id", id)
      .maybeSingle()

    console.log("=".repeat(100))
    console.log(`${String(p?.name ?? id).replace(/​/g, "").slice(0, 92)}`)
    console.log(
      `  ${p?.city ?? "-"} | ${p?.phase} | arvio ${String(p?.estimated_completion ?? "-").slice(0, 10)} | loyto ${String(
        p?.created_at ?? "-"
      ).slice(0, 10)}`
    )

    if (!url) {
      console.log("  EI LAHDEOSOITETTA - ei dokumenttia luettavaksi\n")
      continue
    }

    const { data: dokit } = await db
      .from("source_documents")
      .select("title, published_at, created_at, raw_text")
      .eq("document_url", url)
      .limit(3)

    if (!dokit?.length) {
      console.log(`  EI DOKUMENTTIA KANNASSA: ${url}\n`)
      continue
    }

    for (const d of dokit) {
      const teksti = String(d.raw_text ?? "").replace(/\s+/g, " ")
      const vuodet = [...new Set(teksti.match(VUOSILUKU) ?? [])].sort()
      console.log(`  julkaistu ${String(d.published_at ?? "-").slice(0, 10)} | tuotu ${String(d.created_at).slice(0, 10)}`)
      console.log(`  vuosiluvut tekstissa: ${vuodet.join(", ") || "-"}`)

      /* Virkkeet joissa on aikavihje: naista paatos syntyy. */
      const virkkeet = teksti
        .split(/(?<=[.!?])\s+/)
        .filter((v) => AIKAVIHJE.test(v))
        .slice(0, 6)
      for (const v of virkkeet) console.log(`    "${v.slice(0, 190)}"`)
      if (!virkkeet.length) console.log(`    (ei aikavihjeita) ${teksti.slice(0, 190)}`)
    }
    console.log()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
