import { appendFileSync, existsSync, readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * RAKENTEILLA MUTTA JO VALMISTUNUT? VERKKOHAKU (D-419).
 *
 * Johannes 14.11.2026: testiasiakas soitti hankkeeseen joka oli meilla
 * "rakenteilla" mutta oli valmistunut jo jonkin aikaa sitten. Asiakas ei
 * muistanut mika hanke.
 *
 * Kvartaalitarkistus (`tarkista-rakenteilla.ts`, D-220/D-221) loysi
 * 1.10.2026 yhdeksan valmistunutta, mutta opetti etta valmistuminen
 * loytyy VAIN verkosta: uutinen kayttaa eri nimea kuin hanke, tai
 * todistetta ei ole kannassa lainkaan. Tama hakee jokaiselle
 * rakentamisvaiheen hankkeelle DuckDuckGolla ([[web-search-route]],
 * ilmainen) ja listaa tulokset joissa
 *
 *   - otsikko tai katkelma kertoo valmistumisesta MENNEESSA aikamuodossa
 *     (valmistui, otettiin käyttöön, vihittiin, avattiin, luovutettiin),
 *     ei suunnitelman tai kaavan valmistumisesta
 *   - otsikko+katkelma kattaa hankkeen nimen sisaltosanoista vahintaan
 *     kaksi ja 60 % (`otsikonOsuvuus`, D-273)
 *
 * EI MUUTA MITAAN. Kesken oleva hanke piilotettuna on pahempi kuin
 * valmistunut listalla ([[hiding-threshold]]); lista luetaan ja vaihe
 * muutetaan kasin.
 *
 * Jatkuu keskeytyksesta: jo haetut hankkeet luetaan tulostiedostosta.
 *
 *   npx tsx scripts/hae-valmistuneet-verkosta.ts --ulos=polku.jsonl [--raja=20]
 */

const VAIHEET = ["Rakenteilla", "Rakentaminen aloitettu", "Valmistumassa", "Sopimus myönnetty"]
/* 2,5 s antoi 4 rajoitusta 80 haussa (14.11.2026). */
const HAKU_VIIVE_MS = 4000

/*
 * YLEISSANA EI YKSILOI. Prisma Hyllykallion "todiste" oli Lujatalon
 * referenssisivulta toisesta kohteesta: "...valmistui toimistorakennuksen
 * laajennus" -- yhteinen sana vain "laajennus". Valmistumisvirkkeessa on
 * oltava vahintaan yksi hankkeelle OMINAINEN sana.
 */
const YLEISET = new Set(
  (
    "asunto asunnot asuntoa asuntoja kerrostalo rivitalo talo talon uusi uuden uudet uusia uutta rakentaminen " +
    "rakentamisen rakennus rakennuksen rakennusten hanke hankkeen alue alueen kortteli korttelin koulu koulun " +
    "päiväkoti päiväkodin keskus keskuksen tie tien katu kadun silta sillan laajennus laajennuksen saneeraus " +
    "saneerauksen peruskorjaus peruskorjauksen perusparannus perusparannuksen korjaus korjausurakka urakka " +
    "urakan kokonaisurakka vaihe vaiheen osa osan toteuttaa toteutus rakentaa rakennuttaa oy asunto-osakeyhtiö " +
    "kaupungin kaupunki kunnan kunta vuokrakotia vuokra-asuntoa vuokra-asuntoja kehittäminen uusiminen " +
    "rakentamaan rakennetaan toimitila toimitilat liiketila halli hallin"
  ).split(" ")
)

function ominaisetSanat(nimi: string): string[] {
  return nimi
    .toLowerCase()
    .replace(/[^\wåäö\s-]/g, " ")
    .split(/\s+/)
    .filter((s) => s.length >= 4 && !/^\d/.test(s) && !YLEISET.has(s))
}

function sisaltaaOminaisen(virke: string, sanat: string[]): boolean {
  const v = virke.toLowerCase()
  return sanat.some((s) => v.includes(s.length >= 7 ? s.slice(0, -2) : s))
}

/* Osittainen valmistuminen: "...valmistui uusi kasarmi. Kehittäminen jatkuu ..." (Ivalo). */
const JATKUU = /jatkuu|seuraava\s+(?:rakennus)?vaihe|ensimm[äa]inen\s+vaihe|toinen\s+vaihe|ensi\s+vuonna|alkaa\s+(?:kev|kes|syks|talv)/i

/*
 * VAIN PERSOONAMUODOT. "vuonna 2012 valmistuneen terveysaseman" (Myllypuro)
 * on VANHA rakennus jonka viereen laajennus tehdaan; partisiippi kelpaa
 * vain apuverbin kanssa ("on valmistunut"). Mitattu 20 hankkeen otoksella
 * 14.11.2026: kaikki kolme alkuperaisen saannon osumaa olivat vaaria.
 */
const VALMIS =
  /(?<![\wåäö])(valmistui|valmistuivat|(?:on|ovat|oli|olivat)\s+(?:nyt\s+)?valmistuneet?|otettiin\s+k[äa]ytt[öo][öo]n|on\s+otettu\s+k[äa]ytt[öo][öo]n|vihittiin|avattiin|avasi\s+ovensa|luovutettiin|(?:on|ovat)\s+valmiit?\s+k[äa]ytt[öo][öo]n|muuttivat\s+uusiin)(?![\wåäö])/i
/* Suunnitelman, kaavan tai selvityksen valmistuminen ei ole rakennuksen. */
const EI_RAKENNUS =
  /(suunnitelm\w*|kaav\w*|selvity\w*|arvioin\w*|ohjelm\w*|raport\w*|luonno\w*|ehdotu\w*|tarjousk\w*|kilpailu\w*|hankesuunnitelm\w*|tarveselvity\w*)\s+(?:on\s+|oli\s+)?(?:nyt\s+)?valmistu/i

const EI_LAHTEEKSI =
  /facebook|linkedin|twitter|x\.com|instagram|youtube|tiktok|pinterest|wikipedia|duckduckgo|fonecta|finder\.fi|asiakastieto|vainu|ytj\.fi|tyomaat\.fi|tarjouspalvelu|tenqual|hankintailmoitukset|hilma|cloudia|oikotie|etuovi|vuokraovi/i

function haeOsoite(ddgHref: string): string | null {
  const m = ddgHref.match(/[?&]uddg=([^&]+)/)
  if (!m) return ddgHref.startsWith("http") ? ddgHref : null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}

const odota = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const ulos = process.argv.find((a) => a.startsWith("--ulos="))?.slice("--ulos=".length)
  if (!ulos) throw new Error("anna --ulos=tiedosto.jsonl")
  const raja = Number(process.argv.find((a) => /^--raja=\d+$/.test(a))?.split("=")[1] ?? 0)

  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { otsikonOsuvuus } = await import("../lib/agent/sivunKuvaus")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,phase,construction_start,estimated_completion,created_at")
      .eq("status", "active")
      .eq("is_public", true)
      .in("phase", VAIHEET)
      .order("id")
      .range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }
  /* Rakenteilla ensin: asiakas puhui niista. */
  hankkeet.sort((a, b) => VAIHEET.indexOf(a.phase) - VAIHEET.indexOf(b.phase))

  const tehty = new Set<string>()
  if (existsSync(ulos)) {
    for (const r of readFileSync(ulos, "utf8").split("\n").filter(Boolean)) tehty.add(JSON.parse(r).id)
  }
  const jono = hankkeet.filter((h) => !tehty.has(h.id))
  console.log(`rakentamisvaiheissa ${hankkeet.length}, jo haettu ${tehty.size}, haetaan ${raja ? Math.min(raja, jono.length) : jono.length}`)

  let n = 0
  let ehdokkaita = 0
  let estetty = 0
  for (const h of raja ? jono.slice(0, raja) : jono) {
    const nimi = String(h.name).split(/\s+/).slice(0, 12).join(" ")
    const kysely = `${nimi} ${h.city ?? ""} valmistui`
    let html = ""
    for (let yritys = 0; yritys < 4; yritys++) {
      const vastaus = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(kysely)}`, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      }).catch(() => null)
      html = vastaus && vastaus.ok ? await vastaus.text() : ""
      /* DDG:n rajoitus: tyhja tai "anomaly"-sivu -> odota ja yrita uudelleen. */
      if (html && !/anomaly|unusual traffic/i.test(html) && /result/.test(html)) break
      estetty++
      await odota(60_000 * (yritys + 1))
    }

    const $ = cheerio.load(html)
    const osumat: any[] = []
    for (const el of $(".result").toArray()) {
      const a = $(el).find("a.result__a").first()
      const otsikko = a.text().replace(/\s+/g, " ").trim()
      const katkelma = $(el).find(".result__snippet").text().replace(/\s+/g, " ").trim()
      const osoite = haeOsoite(a.attr("href") ?? "")
      if (!osoite || EI_LAHTEEKSI.test(osoite)) continue
      const teksti = `${otsikko} ${katkelma}`
      const kunta = String(h.city ?? "").toLowerCase().slice(0, 5)
      /*
       * Kunnan nimi ei yksiloi hanketta: "Asunto Oy Espoon Novelli" osui
       * "Espooseen valmistui ennätysmäärä asuntoja" -uutiseen sanoilla
       * asunto + espoo. Nimesta poistetaan kunta ennen vertailua.
       */
      const nimiIlmanKuntaa = String(h.name)
        .split(/\s+/)
        .filter((s) => !kunta || !s.toLowerCase().startsWith(kunta))
        .join(" ")
      const o = otsikonOsuvuus(nimiIlmanKuntaa, teksti)
      if (o.osumia < 2 || o.osuus < 0.6) continue
      /*
       * Valmistumisen on oltava SAMASSA VIRKKEESSA kuin jokin nimen sana:
       * muuten katkelma voi kertoa naapurikohteen valmistumisesta
       * ("Asunto Oy Espoon Sadehelmi valmistui").
       */
      const virkkeet = teksti.split(/(?<=[.!?])\s+|\s[|–-]\s/)
      const todiste = virkkeet.find(
        (v) => VALMIS.test(v) && !EI_RAKENNUS.test(v) && sisaltaaOminaisen(v, ominaisetSanat(nimiIlmanKuntaa))
      )
      if (!todiste) continue
      const kuntaMainittu = !kunta || `${teksti} ${osoite}`.toLowerCase().includes(kunta)
      const vuodet = [...teksti.matchAll(/\b(20[0-3]\d)\b/g)].map((m) => Number(m[1]))
      osumat.push({
        otsikko,
        katkelma: katkelma.slice(0, 300),
        osoite,
        osuus: Number(o.osuus.toFixed(2)),
        osumia: o.osumia,
        kuntaMainittu,
        vuodet,
        valmisOtsikossa: VALMIS.test(otsikko),
        todiste: todiste.slice(0, 240),
        jatkuu: JATKUU.test(katkelma),
      })
    }

    if (osumat.length) ehdokkaita++
    appendFileSync(
      ulos,
      JSON.stringify({
        id: h.id,
        name: h.name,
        city: h.city,
        phase: h.phase,
        construction_start: h.construction_start,
        estimated_completion: h.estimated_completion,
        created_at: h.created_at,
        osumat,
      }) + "\n"
    )
    n++
    if (n % 25 === 0) console.log(`${n} haettu, ehdokkaita ${ehdokkaita}, rajoituksia ${estetty}`)
    await odota(HAKU_VIIVE_MS)
  }
  console.log(`valmis: ${n} haettu, ehdokkaita ${ehdokkaita}, rajoituksia ${estetty}`)
}
main()
