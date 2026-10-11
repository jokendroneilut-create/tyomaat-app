import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * LAHTEEN ETSIMINEN VERKOSTA KASIN LISATYILLE HANKKEILLE (D-273).
 *
 * Johannes lisasi 333 hanketta kasin ennen keraimia. 166:lla oli
 * `source_url` (D-272), mutta 167:lla ei ole mitaan — vain nimi, kunta
 * ja joskus kustannusarvio. Nimi on usein Johanneksen oma lyhyt otsikko
 * ("Uimahalli Lappeenrantaan"), mutta yhta usein se on suoraan
 * tiedotteen otsikko ("NCC rakentaa 83 asumisoikeusasuntoa Vasolle").
 *
 * HAKU ON ILMAINEN. DuckDuckGon html-paatepiste vastaa ilman avainta ja
 * ilman veloitusta. Claude Coden oma WebSearch ei kelvannut: se on
 * US-painotteinen eika loytanyt kumpaakaan kokeiltua suomalaista
 * hanketta, kun DuckDuckGo loysi molemmat ensimmaisella osumalla.
 *
 * TIUKEMPI RELEVANSSI KUIN D-272:SSA. Siella osoite oli Johanneksen
 * antama; tassa se on ARVATTU, joten vaaditaan etta teksti mainitsee
 * seka hankkeen kunnan etta nimen tunnistavan sanan. Vaara lahde on
 * pahempi kuin tyhja kentta.
 *
 *   npx tsx scripts/etsi-lahde-verkosta.ts
 *   npx tsx scripts/etsi-lahde-verkosta.ts --apply
 *   npx tsx scripts/etsi-lahde-verkosta.ts --raja=10
 */

const HAKU_VIIVE_MS = 2000
const SIVU_VIIVE_MS = 500
const OSUMIA_PER_HANKE = 3

/* Nama eivat ole hankelahteita. */
const EI_LAHTEEKSI =
  /facebook|linkedin|twitter|x\.com|instagram|youtube|tiktok|pinterest|wikipedia|duckduckgo|google\.|bing\.|yelp|tripadvisor|huts\.fi|fonecta|finder\.fi|asiakastieto|vainu|kauppalehti\.fi\/yritykset|ytj\.fi/i

function haeOsoite(ddgHref: string): string | null {
  const m = ddgHref.match(/[?&]uddg=([^&]+)/)
  if (!m) return ddgHref.startsWith("http") ? ddgHref : null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const raja = Number(process.argv.find((a) => /^--raja=\d+$/.test(a))?.split("=")[1] ?? 0)

  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { kuvausSivusta, osuukoHankkeeseen, puhuukoRakentamisesta, KIELLETYT } =
    await import("../lib/agent/sivunKuvaus")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const rivit: any[] = []
  const SIVU = 500
  for (let f = 0; f < 60000; f += SIVU) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, additional_info, metadata")
      .range(f, f + SIVU - 1)
    if (error) throw error
    if (!data?.length) break
    for (const r of data as any[]) {
      const md = r.metadata ?? {}
      if (md.source_name || md.source) continue
      if (String(r.additional_info ?? "").trim().length >= 200) continue
      const url = String(md.source_url ?? md.last_source_url ?? "")
      if (/^https?:\/\//.test(url)) continue
      rivit.push(r)
    }
    if (data.length < SIVU) break
  }

  const kohteet = raja ? rivit.slice(0, raja) : rivit
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`kasin lisattyja ilman osoitetta: ${rivit.length}, kasitellaan ${kohteet.length}\n`)

  let loytyi = 0
  const syyt = new Map<string, number>()
  const syy = (s: string) => syyt.set(s, (syyt.get(s) ?? 0) + 1)

  for (const r of kohteet) {
    const nimi = String(r.name ?? "").trim()
    const kunta = String(r.city ?? "").trim()
    const kysely = kunta && !nimi.toLowerCase().includes(kunta.toLowerCase().slice(0, 5))
      ? `${nimi} ${kunta}`
      : nimi

    let linkit: string[] = []
    try {
      const vastaus = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(kysely)}`,
        { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } }
      )
      if (!vastaus.ok) {
        syy(`haku HTTP ${vastaus.status}`)
        continue
      }
      const $ = cheerio.load(await vastaus.text())
      for (const el of $("a.result__a").toArray()) {
        const osoite = haeOsoite($(el).attr("href") ?? "")
        if (!osoite) continue
        if (EI_LAHTEEKSI.test(osoite) || KIELLETYT.test(osoite)) continue
        if (/\.pdf(\?|$)/i.test(osoite)) continue
        if (!linkit.includes(osoite)) linkit.push(osoite)
      }
    } catch {
      syy("haku epaonnistui")
      continue
    } finally {
      await new Promise((res) => setTimeout(res, HAKU_VIIVE_MS))
    }

    if (!linkit.length) {
      syy("ei hakutuloksia")
      continue
    }

    let osui: { url: string; teksti: string } | null = null
    for (const osoite of linkit.slice(0, OSUMIA_PER_HANKE)) {
      try {
        const ohjain = new AbortController()
        const kello = setTimeout(() => ohjain.abort(), 20000)
        const vastaus = await fetch(osoite, {
          headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
          signal: ohjain.signal,
        })
        clearTimeout(kello)
        if (!vastaus.ok) continue
        const teksti = kuvausSivusta(await vastaus.text())
        if (!teksti) continue
        /*
         * KAKSI EHTOA, EI YKSI: kunta JA nimen tunnistava sana. Haku
         * palauttaa helposti saman alan uutisen toisesta kaupungista.
         */
        const kuntaOsuu =
          !!kunta &&
          teksti.toLowerCase().includes(kunta.toLowerCase().slice(0, Math.max(4, kunta.length - 2)))
        if (!kuntaOsuu) continue
        if (!osuukoHankkeeseen(teksti, nimi, "")) continue
        /* Kolmas ehto arvatulle osoitteelle: sivun on puhuttava rakentamisesta. */
        if (!puhuukoRakentamisesta(teksti)) continue
        osui = { url: osoite, teksti }
        break
      } catch {
        /* seuraava osuma */
      } finally {
        await new Promise((res) => setTimeout(res, SIVU_VIIVE_MS))
      }
    }

    if (!osui) {
      syy("osumista ei yksikaan vastannut hanketta")
      continue
    }

    loytyi += 1
    const nykyinen = String(r.additional_info ?? "").trim()
    console.log("=".repeat(98))
    console.log(`${nimi.slice(0, 60)}  [${kunta}]`)
    console.log(`  ${nykyinen.length} -> ${osui.teksti.length} merkkia`)
    console.log(`  ${osui.url.slice(0, 96)}`)
    console.log(`  ${osui.teksti.slice(0, 240)}${osui.teksti.length > 240 ? "…" : ""}`)

    if (!apply) continue

    const { error } = await db
      .from("projects")
      .update({
        additional_info: osui.teksti,
        metadata: {
          ...(r.metadata ?? {}),
          description: osui.teksti,
          source_url: osui.url,
          source_found_by: "duckduckgo",
          description_from_url_at: new Date().toISOString(),
        },
      })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE: ${error.message}`)
  }

  console.log("=".repeat(98))
  console.log(`lahde loytyi ${loytyi} / ${kohteet.length}`)
  console.log("syyt joilla ei loytynyt:")
  for (const [s, n] of [...syyt.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${s}`)
  }
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
