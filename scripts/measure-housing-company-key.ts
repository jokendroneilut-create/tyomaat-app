import { readFileSync, mkdirSync, writeFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: kelpaisiko taloyhtiön nimi täsmäytysavaimeksi?
 *
 * Tietoa käytetään jo, mutta vain EROTTAMISEEN (D-045): eri "Asunto Oy"
 * -nimet painavat varmuuden kynnyksen alle. Yhdistämiseen sitä ei
 * käytetä, ja siksi Laptin Hiukkavaara jäi 38 pisteeseen vaikka
 * molemmissa kuvauksissa lukee "Asunto Oy Oulun Valoisa".
 *
 * Katuavain hylättiin automaatista (D-090), koska samalla osoitteella on
 * eri hankkeita. Taloyhtiön nimi on päinvastainen tapaus: se on
 * rekisteröity ja yksikäsitteinen. Tämä ajo tarkistaa pitääkö se
 * paikkansa myös meidän aineistossamme.
 *
 * Ei kirjoita mitään.
 */

/*
 * "Asunto Oy Oulun Valoisa", "As Oy Helsingin Pyy", "Kiinteistö Oy ...".
 * Yhtiömuoto ensin, sitten 1-4 isolla alkavaa sanaa.
 */
const YHTIO_RE =
  /\b((?:Asunto|As\.?|Kiinteistö|Kiinteistö\s+Osakeyhtiö|Koy|KOy)\s*\.?\s*Oy\.?\s+[A-ZÄÖÅ][\wÄÖÅäöå-]+(?:\s+[A-ZÄÖÅ][\wÄÖÅäöå-]+){0,3})/g

/* Sijapäätteet: "Valoisaan", "Valoisan" ja "Valoisa" ovat sama yhtiö. */
const PAATTEET = ["seen", "aan", "ään", "lle", "lla", "llä", "ssa", "ssä", "sta", "stä", "ksi", "ien", "in", "en", "an", "än", "n"]

function normalizeCompany(nimi: string): string {
  const sanat = String(nimi ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\b(asunto|as|kiinteistö|koy|oy|osakeyhtiö)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)

  /* Viimeinen sana taivutetaan, muut ovat yleensä paikannimiä. */
  return sanat
    .map((s, i) => {
      if (i < sanat.length - 1) return s
      for (const p of PAATTEET) {
        if (s.length > p.length + 2 && s.endsWith(p)) return s.slice(0, -p.length)
      }
      return s
    })
    .join(" ")
}

/*
 * VAIN ENSIMMAINEN MAINITA.
 *
 * Mitattu 29.8.2026: kaikkien mainintojen poiminta yhdisti Oulun, Turun,
 * Porin ja Joensuun hankkeet samaan avaimeen, koska tiedotteet
 * luettelevat lopussa yrityksen MUITA kohteita. Kuvauksessa mainittu
 * taloyhtio ei siis ole valttamatta hankkeen oma.
 *
 * Tiedote johtaa omalla kohteellaan, joten ensimmainen maininta on
 * paras arvaus - ja jos se on vaara, virhe on yksi eika kymmenen.
 */
export function extractCompanies(text: string): string[] {
  /*
   * TIUKIN MUOTO: vain otsikko ja ensimmainen virke.
   *
   * Ensimmainen maininta koko tekstista ei riittanyt: "Palvelukeskus
   * Oulun Kynsilehtoon" sai avaimekseen "kempeleen loiste", koska
   * tiedote johtaa yrityksen muulla kohteella.
   */
  const alku = String(text ?? "").split(/(?<=\.)\s/).slice(0, 2).join(" ")
  const m = YHTIO_RE.exec(alku)
  YHTIO_RE.lastIndex = 0
  if (!m?.[1]) return []

  const avain = normalizeCompany(m[1].replace(/\s+/g, " ").trim())
  if (avain.length < 4) return []
  return [avain]
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const lataa = async (taulu: string, kentat: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await admin.from(taulu).select(kentat).range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    return r
  }

  const hankkeet = await lataa("projects", "id,name,city,is_public,metadata")
  const ehdokkaat = await lataa("potential_projects", "id,title,municipality,status,metadata")

  console.log(`hankkeita ${hankkeet.length} · ehdokkaita ${ehdokkaat.length}\n`)

  type Rivi = { id: string; nimi: string; kaupunki: string | null; tyyppi: string; avaimet: string[] }
  const rivit: Rivi[] = []

  for (const h of hankkeet) {
    const meta: any = h.metadata ?? {}
    const teksti = `${h.name ?? ""} ${meta.description ?? ""} ${meta.operation ?? ""}`
    rivit.push({ id: h.id, nimi: h.name, kaupunki: h.city, tyyppi: "hanke", avaimet: extractCompanies(teksti) })
  }
  for (const e of ehdokkaat) {
    const meta: any = e.metadata ?? {}
    const teksti = `${e.title ?? ""} ${meta.description ?? ""} ${meta.operation ?? ""}`
    rivit.push({ id: e.id, nimi: e.title, kaupunki: e.municipality, tyyppi: "ehdokas", avaimet: extractCompanies(teksti) })
  }

  const kattavuus = rivit.filter((r) => r.avaimet.length > 0)
  console.log("KATTAVUUS")
  console.log(`  rivejä joilla taloyhtiö tunnistuu: ${kattavuus.length} / ${rivit.length} (${Math.round((kattavuus.length / rivit.length) * 100)} %)`)
  console.log(`    hankkeita: ${kattavuus.filter((r) => r.tyyppi === "hanke").length}`)
  console.log(`    ehdokkaita: ${kattavuus.filter((r) => r.tyyppi === "ehdokas").length}`)

  /* Ryhmittely avaimen mukaan. */
  const ryhmat = new Map<string, Rivi[]>()
  for (const r of rivit) {
    for (const a of r.avaimet) {
      const l = ryhmat.get(a) ?? []
      l.push(r)
      ryhmat.set(a, l)
    }
  }

  const jaetut = [...ryhmat.entries()].filter(([, l]) => new Set(l.map((x) => x.id)).size > 1)
  console.log(`\nJAETTUJA AVAIMIA: ${jaetut.length}`)

  let pareja = 0
  let eriKaupunki = 0
  const naytteet: string[] = []

  for (const [avain, lista] of jaetut) {
    const uniikit = [...new Map(lista.map((x) => [x.id, x])).values()]
    for (let i = 0; i < uniikit.length; i++) {
      for (let j = i + 1; j < uniikit.length; j++) {
        pareja++
        const a = uniikit[i], b = uniikit[j]
        const sama =
          String(a.kaupunki ?? "").trim().toLowerCase() ===
          String(b.kaupunki ?? "").trim().toLowerCase()
        if (!sama) eriKaupunki++
        if (naytteet.length < 25) {
          naytteet.push(
            `  ${sama ? "  " : "!!"} [${avain}]\n      ${a.tyyppi} ${String(a.nimi).slice(0, 56)} (${a.kaupunki ?? "-"})\n      ${b.tyyppi} ${String(b.nimi).slice(0, 56)} (${b.kaupunki ?? "-"})`
          )
        }
      }
    }
  }

  console.log(`  pareja yhteensä: ${pareja}`)
  console.log(`  niistä ERI kaupungissa: ${eriKaupunki}  <- nämä olisivat vääriä`)

  console.log("\nNÄYTTEET (!! = eri kaupunki):")
  for (const n of naytteet.slice(0, 12)) console.log(n)

  /*
   * RATKAISEVA LUKU: montako parista jaisi tanaan huomaamatta?
   *
   * Avaimella on arvoa vain jos se loytaa pareja jotka nykyinen
   * pisteytys hukkaa. Lasketaan vain hanke<->ehdokas-parit, koska
   * ehdokkaiden keskinaiset kaksoiskappaleet ovat eri ongelma.
   */
  const { calculateMatch } = await import("../lib/agent/projectMatcher")
  const hankeKartta = new Map(hankkeet.map((h: any) => [h.id, h]))
  const ehdokasKartta = new Map(ehdokkaat.map((e: any) => [e.id, e]))

  let ristiin = 0
  let allaKynnyksen = 0
  let nolla = 0
  const hukkuvat: string[] = []

  for (const [, lista] of jaetut) {
    const uniikit = [...new Map(lista.map((x) => [x.id, x])).values()]
    for (let i = 0; i < uniikit.length; i++) {
      for (let j = i + 1; j < uniikit.length; j++) {
        const a = uniikit[i], b = uniikit[j]
        if (a.tyyppi === b.tyyppi) continue

        const h: any = hankeKartta.get(a.tyyppi === "hanke" ? a.id : b.id)
        const e: any = ehdokasKartta.get(a.tyyppi === "ehdokas" ? a.id : b.id)
        if (!h || !e) continue

        ristiin++
        const meta: any = e.metadata ?? {}
        const r: any = calculateMatch(h as any, {
          name: e.title, sourceTitle: e.title, city: e.municipality,
          region: meta.region ?? null, location: e.address ?? null,
          propertyId: meta.property_id ?? null, developer: meta.developer ?? null,
          buildingType: meta.building_type ?? null, description: meta.description ?? null,
        } as any)

        const pisteet = r?.confidence ?? null
        if (pisteet == null) nolla++
        if (pisteet == null || pisteet < 70) {
          allaKynnyksen++
          if (hukkuvat.length < 14) {
            hukkuvat.push("  " + String(pisteet ?? "null").padStart(4) + "  " + String(h.name).slice(0, 44).padEnd(46) + " <- " + String(e.title).slice(0, 44))
          }
        }
      }
    }
  }

  console.log("")
  console.log("HANKE <-> EHDOKAS -PAREJA: " + ristiin)
  console.log("  nykyinen pisteytys alle 70:  " + allaKynnyksen + "  <- nama jaavat nyt huomaamatta")
  console.log("  niista ei osumaa lainkaan:   " + nolla)
  console.log("")
  console.log("ESIMERKKEJA HUKKUVISTA:")
  for (const x of hukkuvat) console.log(x)


  mkdirSync("C:/Users/johan/tyomaat-app/scripts/out", { recursive: true })
  writeFileSync(
    "C:/Users/johan/tyomaat-app/scripts/out/housing-company-key.json",
    JSON.stringify({ kattavuus: kattavuus.length, rivit: rivit.length, jaetut: jaetut.length, pareja, eriKaupunki }, null, 2),
    "utf8"
  )
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
