import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * TUNNETTU YRITYS KUVAUKSESTA LIITTYVAKSI YRITYKSEKSI (D-343).
 *
 * Johannes 24.10.2026: *"Eikö VAV Yhtymä Oy voi lisätä yrityslistaamme
 * ja sen avulla poimia sen aina ainakin hankkeeseen liittyvaksi
 * yritykseksi? Nyt sita ei oltu poimittu mihinkaan."*
 *
 * Tama ohittaa molemmat esteet jotka kaatoivat paattelevan
 * tilaajapoiminnan: tunnettu yritysnimi EI ole paikannimi, eika
 * "liittyva yritys" vaita roolia -- se ei siis voi kirjata rakentajaa
 * tilaajaksi.
 *
 * Lista rakennetaan omasta datasta: nimet jotka esiintyvat jo
 * `developer`-, `builder`- tai `related_companies`-kentissa.
 *
 *   npx tsx scripts/mittaa-tunnetut-yritykset.ts
 *   npx tsx scripts/mittaa-tunnetut-yritykset.ts --rivit
 */

const YHTIOMUOTO = /\b(?:Oy|Oyj|Ab|Abp|Ky|Ltd|plc|GmbH)\b/i

/* Erotin: "A // B" tai "A, B" kun B alkaa isolla. */
function nimet(kentta: unknown): string[] {
  return String(kentta ?? "")
    .split(/\s*\/\/\s*|,(?=\s*[A-ZÅÄÖ])/)
    .map((n) => n.replace(/\s*\(\d[\d-]*\)\s*$/, "").trim())
    .filter(Boolean)
}

async function main() {
  const naytaRivit = process.argv.includes("--rivit")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* 1. LISTA omasta datasta. */
  const esiintymat = new Map<string, number>()
  for (const taulu of ["projects", "potential_projects"] as const) {
    for (let a = 0; ; a += 1000) {
      const { data } = await db
        .from(taulu)
        .select(taulu === "projects" ? "developer,builder,metadata" : "metadata")
        .range(a, a + 999)
      for (const p of (data ?? []) as any[]) {
        const kentat = [
          ...(taulu === "projects" ? [p.developer, p.builder] : []),
          p.metadata?.developer,
          p.metadata?.builder,
          ...(Array.isArray(p.metadata?.related_companies) ? p.metadata.related_companies : []),
        ]
        for (const k of kentat) {
          for (const n of nimet(k)) esiintymat.set(n, (esiintymat.get(n) ?? 0) + 1)
        }
      }
      if ((data ?? []).length < 1000) break
    }
  }

  /*
   * YHTIOMUOTO VAADITAAN. Se rajaa pois kuntanimet ("Helsingin
   * kaupunki", 563 kertaa) ja yksisanaiset arkisanat, joita ei voi
   * erottaa tekstista luotettavasti.
   */
  /*
   * KATKENNUT NIMI ON LISTALLA MUTTA EI SAA OSUA. Omissa kentissamme on
   * aiemmin katkenneita nimia ("Kiinteisto Oy", "Vesi Oy"), ja listalle
   * paastyaan ne osuisivat joka toiseen tekstiin.
   */
  const KATKENNUT =
    /^(?:kiinteist[oö]|kiint\.?|as\.?|asunto|asunto-osakeyhti[oö]|bostads|fastighets|vesi|energia|suomi|finland|yhti[oö]|rakennus|palvelut|group)\s*-?\s*(?:oy|oyj|ab|abp|ky|ltd)\.?$/i

  const lista = [...esiintymat.entries()]
    .filter(([n]) => YHTIOMUOTO.test(n) && n.length >= 6 && !KATKENNUT.test(n.trim()))
    .map(([n, kpl]) => ({ nimi: n, kpl }))
    .sort((a, b) => b.nimi.length - a.nimi.length)

  console.log(`Eri nimiä kentissä: ${esiintymat.size}`)
  console.log(`Niistä yhtiömuodollisia (lista): ${lista.length}`)
  console.log(`VAV listalla: ${lista.filter((l) => /vav/i.test(l.nimi)).map((l) => l.nimi).join(" | ") || "-"}\n`)

  /* 2. OSUMAT kuvauksista. */
  const kuviot = lista.map((l) => ({
    nimi: l.nimi,
    re: new RegExp(`(?<![\\wÅÄÖåäö])${l.nimi.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\wÅÄÖåäö])`, "i"),
  }))

  let rivit = 0
  let osui = 0
  let uusia = 0
  const naytteet: { nimi: string; taulu: string; loydetyt: string[]; oli: string[] }[] = []

  for (const taulu of ["potential_projects", "projects"] as const) {
    for (let a = 0; ; a += 500) {
      const { data } = await db
        .from(taulu)
        .select(
          taulu === "projects"
            ? "name,developer,builder,additional_info,metadata"
            : "title,status,metadata"
        )
        .range(a, a + 499)
      for (const p of (data ?? []) as any[]) {
        if (taulu === "potential_projects" && p.status === "ignored") continue
        rivit += 1
        const kuvaus = (
          taulu === "projects"
            ? String(p.additional_info ?? p.metadata?.description ?? "")
            : String(p.metadata?.description ?? "")
        ).replace(/\s+/g, " ")
        if (kuvaus.length < 40) continue

        const oli = [
          ...nimet(taulu === "projects" ? p.developer : p.metadata?.developer),
          ...nimet(taulu === "projects" ? p.builder : p.metadata?.builder),
          ...(Array.isArray(p.metadata?.related_companies) ? p.metadata.related_companies : []),
        ].map((n) => n.toLowerCase())

        const loydetyt: string[] = []
        for (const k of kuviot) {
          if (loydetyt.length >= 5) break
          if (!k.re.test(kuvaus)) continue
          /*
           * SAMA YRITYS ERI KIRJOITUSASUSSA EI OLE UUSI OSAPUOLI.
           * Rivilla on rakentajana "SRV" ja tiedotteen otsikkorivilla
           * lukee "SRV YHTIOT OYJ LEHDISTOTIEDOTE" -- vertailu vain
           * yhteen suuntaan paastaa sen lapi 126 kertaa. Verrataan
           * molempiin suuntiin, yhtiomuoto pois.
           */
          const runko = (x: string) =>
            x
              .toLowerCase()
              .replace(/\b(?:oy|oyj|ab|abp|ky|ltd|plc|gmbh)\b\.?/g, "")
              .replace(/[^\wåäö]+/g, " ")
              .trim()
          const loydetynRunko = runko(k.nimi)
          if (
            oli.some((o) => {
              const or = runko(o)
              return or.length >= 3 && (or.includes(loydetynRunko) || loydetynRunko.includes(or))
            })
          )
            continue
          if (loydetyt.some((l) => l.toLowerCase().includes(k.nimi.toLowerCase()))) continue
          loydetyt.push(k.nimi)
        }
        if (!loydetyt.length) continue
        osui += 1
        uusia += loydetyt.length
        if (naytteet.length < 400) {
          naytteet.push({
            nimi: String(p.name ?? p.title ?? "").slice(0, 44),
            taulu,
            loydetyt,
            oli,
          })
        }
      }
      if ((data ?? []).length < 500) break
    }
  }

  console.log(`Rivejä ${rivit}`)
  console.log(`Rivejä joilla kuvaus nimeää tunnetun yrityksen jota kentissä ei ole: ${osui}`)
  console.log(`Uusia liittyviä yrityksiä yhteensä: ${uusia}`)

  if (naytteet.length) {
    console.log(`\n=== OTOS (${Math.min(40, naytteet.length)} / ${naytteet.length}) ===`)
    for (const n of naytteet.slice(0, 40)) {
      console.log(`${n.taulu === "projects" ? "HANKE" : "JONO "} ${n.nimi.padEnd(46)} + ${n.loydetyt.join(" | ")}`)
    }
  }
  if (naytaRivit) {
    console.log(`\n=== KAIKKI (${naytteet.length}) ===`)
    for (const n of naytteet) {
      console.log(`${n.taulu === "projects" ? "HANKE" : "JONO "} ${n.nimi.padEnd(46)} + ${n.loydetyt.join(" | ")}`)
    }
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
