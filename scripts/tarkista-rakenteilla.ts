import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const lainaus = v.slice(0, 1)
  if ((lainaus === '"' || lainaus === "'") && v.endsWith(lainaus)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * NELJANNESVUOSITARKISTUS: ONKO RAKENTEILLA OLEVA JO VALMISTUNUT?
 *
 * Herate: asiakaspalaute "on jo pitkastia rakenteilla" Hyvinkaan areenasta
 * (D-219). Tieto oli kannassa, mutta se ei liikkunut hankkeelle. Sama voi
 * tapahtua valmistumiseen: hanke seisoo listalla rakenteilla vuosia sen
 * jalkeen kun se on avattu.
 *
 * KOLME SIGNAALIA MITATTIIN 1.10.2026, VAIN KAKSI TOIMII:
 *
 *   1. ARVIOITU VALMISTUMISPAIVA MENNYT - toimii, mutta kattaa vahan.
 *      1 140 rakenteilla-hankkeesta vain 39:lla paiva on mennyt ja 709:lta
 *      paiva puuttuu kokonaan. `evaluateAutoComplete` hoitaa naista 26,
 *      loput 13 se ohittaa PORTISSA 1: paiva on vanhempi kuin loytohetki,
 *      eli paiva ei ole todiste. Ne 13 tarvitsevat ihmissilmat - ja
 *      tarkistus 1.10.2026 osoitti miksi: 12 kaydysta 9 oli todella
 *      valmistunut, 2 oli aidosti kesken vaaralla paivalla ja 1 jai
 *      ratkeamatta. Jos portti siirtaisi nama itse, se piilottaisi kaksi
 *      kesken olevaa hanketta kahdentoista erassa.
 *
 *   2. OMA DOKUMENTTI KERTOO VALMISTUMISESTA - tuottaa oikeat osumat.
 *      Kynnys on kolme hanketta yksiloivaa yhteista sanaa: kahdella
 *      sanalla 45 parista oli aito 3, kolmella sanalla lista on luettava.
 *
 *   3. RAKENTAMINEN KESTANYT LIIAN KAUAN - EI TOIMI VIELA. Mitattu:
 *      753 hankkeelta puuttuu aloituspaiva ja vain 10:lla se on yli
 *      vuoden takana, koska keruu alkoi kevaalla 2026. Signaali voidaan
 *      ottaa kayttoon kun kantaan on kertynyt kaksi vuotta historiaa.
 *
 * EI MUUTA MITAAN. Tulostaa listan, jonka Johannes lukee riveittain.
 * Vaiheen muutos on hyvaksyntapaatos, ei skriptin tehtava.
 *
 *   npx tsx scripts/tarkista-rakenteilla.ts
 */

const RAKENTEILLA = /rakenteilla|rakentaminen aloitettu|sopimus myonnetty|sopimus myönnetty|valmistumassa/i

const VALMIS_SANAT =
  /valmistui|valmistunut|valmistuneet|otettiin kayttoon|otettiin käyttöön|vihittiin|avattiin|avasi ovensa|luovutettiin|luovutus/i

/*
 * Valmistumissana ei aina koske koko hanketta: "sosiaalirakennus
 * valmistui - seuraava rakennusvaihe jo kaynnissa" (Salla 30.9.2026).
 * Tallainen rivi jaa listalle mutta merkitaan, jottei sita suljeta.
 */
const JATKUU = /seuraava\s+(?:rakennus)?vaihe|jo\s+k(?:ä|a)ynniss(?:ä|a)|ensimm(?:ä|a)inen\s+vaihe|toinen\s+vaihe|alkaa|alkoi/i

/* Kolme yhteista sanaa riittaa vain jos sanat yksiloivat hankkeen. */
const KYNNYS = 3

const TYHJAT = new Set([
  "asemakaavan", "asemakaava", "muutos", "kaupungin", "kaupunki", "uusi", "uuden", "uutta", "uudet", "uusia",
  "rakentaminen", "rakennuksen", "rakennus", "rakentaa", "rakennuttaa", "hanke", "hankkeen", "alue", "alueen",
  "kortteli", "korttelin", "talo", "talon", "talot", "koulu", "koulun", "paivakoti", "päiväkoti", "keskus",
  "keskuksen", "tie", "tien", "katu", "kadun", "asunto", "asunnot", "asuntoa", "asuntoja", "vuokra", "tilat",
  "ensimmäisen", "ensimmäiset", "toinen", "toisen", "vaihe", "vaiheen", "mukana", "valmistui", "valmistunut",
  "valmistuu", "peruskorjaus", "peruskorjauksen", "laajennus", "sekä", "seka", "osa", "osan",
  /*
   * Rahasanat tuottivat ainoan vaaran osuman kolmen sanan kynnyksella
   * 1.10.2026: "Lahes 60 miljoonan euron hankkeet Helsingissa" tasmasi
   * Karjalan lennoston kasarmiin sanoilla miljoonan/euron/investointi.
   */
  "miljoonan", "miljoonaa", "euron", "euroa", "investointi", "investoinnin", "hankkeet", "hankkeita",
])

function sanat(teksti: string): Set<string> {
  return new Set(
    String(teksti ?? "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .split(" ")
      .filter((s) => s.length >= 4 && !TYHJAT.has(s))
  )
}

/* Yhdistaminen sailyttaa vanhan nimen, joten kaikki otsikot kelpaavat. */
function otsikot(p: any): string[] {
  const lista = [p.name, p.metadata?.source_title, ...(p.metadata?.also_known_as ?? [])]
  return lista.filter((o): o is string => typeof o === "string" && o.trim().length > 0)
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { evaluateAutoComplete } = await import("../lib/projects/autoCompleteGate")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hankkeet: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, phase, status, is_public, created_at, construction_start, estimated_completion, metadata")
      .eq("status", "active")
      .order("id")
      .range(from, from + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const kohteet = hankkeet.filter((p) => p.is_public && RAKENTEILLA.test(String(p.phase)))
  const nyt = new Date()
  const tanaan = nyt.toISOString().slice(0, 10)

  console.log(`NELJANNESVUOSITARKISTUS ${tanaan}`)
  console.log(
    `julkisia aktiivisia ${hankkeet.filter((p) => p.is_public).length}, rakenteilla-vaiheissa ${kohteet.length}\n`
  )

  /* --- SIGNAALI 1: valmistumispaiva mennyt --- */
  const mennyt = kohteet
    .filter((p) => p.estimated_completion && String(p.estimated_completion).slice(0, 10) < tanaan)
    .map((p) => ({
      p,
      verdikti: evaluateAutoComplete({
        estimatedCompletion: p.estimated_completion,
        createdAt: p.created_at,
        lastSeenAt: p.metadata?.last_seen_at ?? null,
        phase: p.phase,
        now: nyt,
      }),
      vrk: Math.floor(
        (nyt.getTime() - new Date(String(p.estimated_completion).slice(0, 10)).getTime()) / 86_400_000
      ),
    }))
    .sort((a, b) => b.vrk - a.vrk)

  const ohitetut = mennyt.filter((m) => m.verdikti !== "wait")

  console.log(`=== 1. ARVIOITU VALMISTUMISPAIVA MENNYT: ${mennyt.length} ===`)
  console.log(`automatiikka siirtaa aikanaan ${mennyt.length - ohitetut.length}, ohittaa ${ohitetut.length}`)
  console.log(`(ohitus = portti lukee lahteen listaavan hanketta yha - nama vaativat ihmissilmat)\n`)
  for (const { p, verdikti, vrk } of ohitetut) {
    console.log(
      `  ${String(vrk).padStart(4)} vrk  ${verdikti.padEnd(5)} ${String(p.city ?? "-").padEnd(12)} ${String(p.name)
        .replace(/​/g, "")
        .slice(0, 58)}`
    )
    console.log(`            https://app.tyomaat.fi/tic/projects/${p.id}`)
  }

  /* --- SIGNAALI 2: oma dokumentti kertoo valmistumisesta --- */
  const docs: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("source_documents")
      .select("id, title, document_url, published_at, created_at, raw_text")
      .order("id")
      .range(from, from + 999)
    if (error) throw error
    docs.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const valmistumisdokit = docs
    .filter((d) => VALMIS_SANAT.test(String(d.title)))
    .map((d) => ({ d, s: sanat(d.title) }))

  const osumat: { p: any; d: any; yhteiset: string[] }[] = []
  for (const p of kohteet) {
    let paras: { d: any; yhteiset: string[] } | null = null
    for (const otsikko of otsikot(p)) {
      const ps = sanat(otsikko)
      for (const { d, s } of valmistumisdokit) {
        const yhteiset = [...ps].filter((w) => s.has(w))
        if (yhteiset.length < KYNNYS) continue
        if (!paras || yhteiset.length > paras.yhteiset.length) paras = { d, yhteiset }
      }
    }
    if (paras) osumat.push({ p, ...paras })
  }

  console.log(`\n=== 2. OMA DOKUMENTTI KERTOO VALMISTUMISESTA: ${osumat.length} ===`)
  console.log(`(${valmistumisdokit.length} valmistumisotsikkoa kannassa, kynnys ${KYNNYS} yksiloivaa yhteista sanaa)\n`)
  for (const { p, d, yhteiset } of osumat.sort((a, b) => b.yhteiset.length - a.yhteiset.length)) {
    const jatkuu = JATKUU.test(`${d.title} ${String(d.raw_text ?? "").slice(0, 1500)}`)
    console.log(
      `HANKE  ${String(p.city ?? "-")} | ${p.phase} | arvioitu valmistuminen ${String(
        p.estimated_completion ?? "-"
      ).slice(0, 10)}`
    )
    console.log(`       ${String(p.name).replace(/​/g, "").slice(0, 88)}`)
    console.log(`       https://app.tyomaat.fi/tic/projects/${p.id}`)
    console.log(`DOKU   ${String(d.published_at ?? d.created_at).slice(0, 10)}  ${String(d.title).slice(0, 88)}`)
    console.log(`       ${d.document_url ?? "-"}`)
    console.log(
      `       yhteiset: ${yhteiset.join(", ")}${
        jatkuu ? "   [HUOM: dokumentti puhuu jatkuvasta vaiheesta - ei valttamatta koko hanke]" : ""
      }`
    )
    console.log()
  }

  /* --- SIGNAALI 3: kesto. Mitattu kelvottomaksi, raportoidaan silti. --- */
  const ilmanAloitusta = kohteet.filter((p) => !p.construction_start).length
  const yliVuoden = kohteet.filter(
    (p) =>
      p.construction_start &&
      nyt.getTime() - new Date(String(p.construction_start).slice(0, 10)).getTime() > 365 * 86_400_000
  ).length

  console.log(`=== 3. KESTO (ei viela kaytossa) ===`)
  console.log(`aloituspaiva puuttuu ${ilmanAloitusta}/${kohteet.length}, yli vuoden rakenteilla ${yliVuoden}`)
  console.log(`signaali kelpaa kun kantaan on kertynyt kaksi vuotta aloituspaivahistoriaa.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
