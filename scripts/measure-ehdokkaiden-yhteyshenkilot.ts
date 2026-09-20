import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * EHDOKKAAN YHTEYSHENKILO JAA POIMIMATTA (mittari).
 *
 * `extractContacts` ajetaan vasta hyvaksyntareitilla, joten jonossa
 * oleva ehdokas nayttaa TIC:ssa "Ei yhteystietoa" vaikka nimi, titteli,
 * puhelin ja sahkoposti lukevat kuvauksessa.
 *
 * Mittaa montako jonossa olevaa ehdokasta on ilman contact_persons-
 * arvoa mutta joiden kuvauksesta poimija loytaisi HENKILON.
 *
 *   npx tsx scripts/measure-ehdokkaiden-yhteyshenkilot.ts
 *   npx tsx scripts/measure-ehdokkaiden-yhteyshenkilot.ts --otos 20
 *
 * Sahkopostit peitetaan tulosteessa: repo on julkinen.
 */

function peita(email: string | null | undefined): string {
  const s = String(email ?? "")
  if (!s.includes("@")) return ""
  const [local, domain] = s.split("@")
  return `${local.slice(0, 2)}***@${domain}`
}

function peitaTeksti(t: string): string {
  return t.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, (m) => peita(m))
}

async function main() {
  const otos = Number(process.argv[process.argv.indexOf("--otos") + 1]) || 0
  /*
   * Jono on tyypillisesti lahes tyhja (purkunopeus skaalautuu), joten
   * pelkka status=new aliarvioi ilmion. --kaikki lukee koko
   * ehdokasvirran: sama poiminta olisi koskenut jokaista niista
   * ehdokasvaiheessa.
   */
  const kaikkiTilat = process.argv.includes("--kaikki")
  /* --ansa media | viranomainen : otos vain siita ryhmasta. */
  const ansa = process.argv.includes("--ansa") ? String(process.argv[process.argv.indexOf("--ansa") + 1]) : ""
  const { createClient } = await import("@supabase/supabase-js")
  const { extractContacts } = await import("../lib/projects/contacts")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const rivit: any[] = []
  for (let from = 0; ; from += 1000) {
    let q = db
      .from("potential_projects")
      .select("id, title, status, created_at, metadata")
      .range(from, from + 999)
    if (!kaikkiTilat) q = q.eq("status", "new")
    const { data, error } = await q
    if (error) throw error
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  console.log(`Ehdokkaita (${kaikkiTilat ? "kaikki tilat" : "status=new"}): ${rivit.length}`)
  if (kaikkiTilat) {
    const tilat = new Map<string, number>()
    for (const r of rivit) tilat.set(String(r.status), (tilat.get(String(r.status)) ?? 0) + 1)
    console.log(`  tiloittain: ${[...tilat].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join("  ")}`)
  }

  const kentta = (r: any): any[] =>
    Array.isArray(r.metadata?.contact_persons) ? r.metadata.contact_persons : []

  const tyhja = rivit.filter((r) => kentta(r).filter((c) => c && (c.email || c.phone || c.name)).length === 0)
  console.log(`  joilla contact_persons tyhja tai puuttuu: ${tyhja.length}`)

  const osumat: { r: any; henkilot: any[]; kaikki: any[] }[] = []
  for (const r of tyhja) {
    const teksti = [r.metadata?.description, r.metadata?.operation].filter(Boolean).join("\n")
    if (!teksti) continue
    const kaikki = extractContacts(teksti)
    const henkilot = kaikki.filter((c) => c.kind === "person" && c.role !== "authority")
    if (henkilot.length) osumat.push({ r, henkilot, kaikki })
  }

  console.log(`  ja joiden kuvauksesta poimija loytaisi HENKILON: ${osumat.length}`)
  {
    const tilat = new Map<string, number>()
    for (const o of osumat) tilat.set(String(o.r.status), (tilat.get(String(o.r.status)) ?? 0) + 1)
    console.log(`    osumat tiloittain: ${[...tilat].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join("  ")}`)
  }

  /* Vain organisaatiolaatikko (kirjaamo@, info@) - ei myyntikontakti. */
  let vainOrg = 0
  for (const r of tyhja) {
    const teksti = [r.metadata?.description, r.metadata?.operation].filter(Boolean).join("\n")
    if (!teksti) continue
    const kaikki = extractContacts(teksti)
    if (kaikki.length && !kaikki.some((c) => c.kind === "person")) vainOrg++
  }
  console.log(`  vain organisaatiolaatikko (kirjaamo/info): ${vainOrg}`)

  console.log("\n=== LAHTEITTAIN (osumat) ===")
  const lahteet = new Map<string, number>()
  for (const o of osumat) {
    const k = String(o.r.metadata?.source_name ?? o.r.metadata?.lastSourceName ?? o.r.metadata?.firstSourceName ?? "(ei lahdetta)")
    lahteet.set(k, (lahteet.get(k) ?? 0) + 1)
  }
  for (const [k, n] of [...lahteet].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(36)} ${String(n).padStart(5)}`)
  }

  /*
   * ANSAT. Molemmat nakyvat vasta riveja lukemalla, joten ne lasketaan
   * erikseen eika piiloteta yhteislukuun.
   *
   * (a) VIRANOMAINEN. `extractContacts` ei aseta rolea lainkaan, joten
   *     tekstista poimittu viranomainen nayttaa hankkeen osapuolelta.
   *     Mitattu muoto on kunnan paatoksen MUUTOKSENHAKUOHJE: lopussa on
   *     markkinaoikeuden tai hallinto-oikeuden osoite, ja poimija lukee
   *     siita "nimen" (kadunnimen) ja osoitteen @oikeus.fi.
   *
   * (b) VIESTINTAHENKILO. Tiedotteen "Lisatiedot"-osiossa on seka
   *     hankkeen vastuuhenkilo etta viestinnan asiantuntija - samassa
   *     lohkossa. Osiota EI voi pudottaa, koska paras kontakti on siina.
   *     Ero nakyy TITTELISSA.
   */
  const OIKEUSASTE = /(markkinaoikeus|hallinto-oikeus|korkein hallinto|valitusosoitus|muutoksenhaku)/i
  const VIESTINTA_TITTELI = /(viestint|mediayhteyd|tiedottaja|communications|press)/i

  console.log("\n=== ANSAT ===")
  let oikeus = 0
  let media = 0
  let mediaAinoa = 0
  let jaljelle = 0
  for (const o of osumat) {
    const teksti = String(o.r.metadata?.description ?? "")
    const onOikeus = o.henkilot.some(
      (c) => /(^|\.)oikeus\.fi$/i.test(String(c.email ?? "").split("@")[1] ?? "") ||
        OIKEUSASTE.test(String(c.organization ?? ""))
    ) || (OIKEUSASTE.test(teksti) && o.henkilot.some((c) => String(c.email ?? "").endsWith("oikeus.fi")))
    if (onOikeus) oikeus++

    const mediat = o.henkilot.filter((c) => VIESTINTA_TITTELI.test(String(c.title ?? "")))
    if (mediat.length) media++
    if (mediat.length && mediat.length === o.henkilot.length) mediaAinoa++

    const puhtaat = o.henkilot.filter(
      (c) => !VIESTINTA_TITTELI.test(String(c.title ?? "")) &&
        !/(^|\.)oikeus\.fi$/i.test(String(c.email ?? "").split("@")[1] ?? "")
    )
    if (puhtaat.length) jaljelle++
  }
  console.log(`  osumia joissa oikeusasteen yhteystieto (muutoksenhakuohje): ${oikeus}`)
  console.log(`  osumia joissa viestintatitteli:                            ${media}`)
  console.log(`    ...ja viestintahenkilo on AINOA loydetty henkilo:        ${mediaAinoa}`)
  console.log(`  osumia joilla jaa vahintaan yksi "puhdas" henkilo:         ${jaljelle}`)

  if (otos) {
    const joukko =
      ansa === "media"
        ? osumat.filter((o) => o.henkilot.some((c) => VIESTINTA_TITTELI.test(String(c.title ?? ""))))
        : ansa === "vainmedia"
          ? osumat.filter((o) => {
              const m = o.henkilot.filter((c) => VIESTINTA_TITTELI.test(String(c.title ?? "")))
              return m.length > 0 && m.length === o.henkilot.length
            })
          : ansa === "oikeus"
            ? osumat.filter((o) =>
                o.henkilot.some((c) => /oikeus\.fi$/i.test(String(c.email ?? "")))
              )
            : osumat

    console.log(
      `\n=== OTOS ${otos} RIVIA${ansa ? ` (ansa=${ansa}, ${joukko.length} osumaa)` : ""} (sahkopostit peitetty) ===`
    )
    for (const o of joukko.slice(0, otos)) {
      console.log(`\n--- ${o.r.id}  ${String(o.r.title ?? "").slice(0, 80)}`)
      console.log(`    lahde: ${o.r.metadata?.source_name ?? "-"}   luotu: ${String(o.r.created_at).slice(0, 10)}`)
      for (const c of o.kaikki) {
        console.log(`    [${c.kind}] nimi=${c.name ?? "-"} | titteli=${c.title ?? "-"} | org=${c.organization ?? "-"} | puh=${c.phone ?? "-"} | email=${peita(c.email) || "-"}`)
      }
      const teksti = String(o.r.metadata?.description ?? "")
      const eka = o.kaikki.find((c) => c.email)
      const i = eka?.email ? teksti.toLowerCase().indexOf(eka.email.toLowerCase()) : -1
      const ikkuna = i >= 0 ? teksti.slice(Math.max(0, i - 260), i + 80) : teksti.slice(-300)
      console.log(`    teksti: ...${peitaTeksti(ikkuna).replace(/\s+/g, " ")}...`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
