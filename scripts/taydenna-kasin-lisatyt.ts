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
 * KASIN LISATTYJEN HANKKEIDEN KUVAUS NIIDEN OMASTA OSOITTEESTA.
 *
 * Johannes lisasi 333 hanketta kasin helmi-huhtikuussa 2026, ennen kuin
 * keraimia oli nykymuodossaan. Niilla ei ole lahdetta eika kuvausta,
 * mutta 166:lla on `metadata.source_url`.
 *
 * MIKSI JUURI NAMA: mitattu 11.10.2026 etta asiakkaan ohuista osumista
 * puolet (245 / 490) kohdistuu naihin riveihin — enemman kuin mihinkaan
 * muuhun lahteeseen. Otos 12 tasavalein: 12/12 osoitetta vastasi ja
 * kaikilla oli 1 455-6 876 merkkia tekstia.
 *
 * Poiminta on sama kuin yritystiedotteilla (`extractReleaseBody`):
 * pisin siivottu lohko, hanta ja sivupohja pois. Se on tarpeen, koska
 * naiden sivujen PISIN KAPPALE on usein yrityksen vakioesittely
 * ("Skanska on yksi maailman johtavista...").
 *
 *   npx tsx scripts/taydenna-kasin-lisatyt.ts
 *   npx tsx scripts/taydenna-kasin-lisatyt.ts --apply
 */

const VIIVE_MS = 400

async function main() {
  const apply = process.argv.includes("--apply")
  const raja = Number(process.argv.find((a) => /^--raja=\d+$/.test(a))?.split("=")[1] ?? 0)

  const { createClient } = await import("@supabase/supabase-js")
  const { kuvausSivusta, osuukoHankkeeseen, normalisoi, KIELLETYT, MIN_KUVAUS } = await import(
    "../lib/agent/sivunKuvaus"
  )

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
      if (String(r.additional_info ?? "").trim().length >= MIN_KUVAUS) continue
      const url = String(md.source_url ?? md.last_source_url ?? "").trim()
      if (!/^https?:\/\//.test(url)) continue
      if (KIELLETYT.test(url)) continue
      rivit.push({ ...r, url })
    }
    if (data.length < SIVU) break
  }

  const kohteet = raja ? rivit.slice(0, raja) : rivit
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`kasin lisattyja ohuita joilla osoite: ${rivit.length}, kasitellaan ${kohteet.length}\n`)

  /*
   * SAMA TEKSTI KOLMELLE ERI HANKKEELLE = SIVU EI KERRO HANKKEESTA.
   *
   * Pohjola Rakennuksen "Ihanat kodit" -brandisivu ("Kohtaa luonnonvalo
   * jo ulko-ovella, Horisontti-filosofiamme mukaan...") olisi mennyt
   * viiden eri hankkeen kuvaukseksi. Kahden hankkeen jakama teksti on
   * yha kelvollinen: Caverionin tiedote kattaa aidosti kaksi
   * sahkoasemaa.
   */
  const SAMA_RAJA = 3
  const tekstiLaskuri = new Map<string, number>()
  const ehdotukset: {
    r: any
    nykyinen: string
    teksti: string
    uusi: string
    sisaltyy: boolean
    avain: string
  }[] = []

  let parani = 0
  let sailytetty = 0
  const syyt = new Map<string, number>()
  const syy = (s: string) => syyt.set(s, (syyt.get(s) ?? 0) + 1)

  for (const r of kohteet) {
    const nykyinen = String(r.additional_info ?? "").trim()

    let html = ""
    try {
      const ohjain = new AbortController()
      const kello = setTimeout(() => ohjain.abort(), 20000)
      const vastaus = await fetch(r.url, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: ohjain.signal,
      })
      clearTimeout(kello)
      if (!vastaus.ok) {
        syy(`HTTP ${vastaus.status}`)
        continue
      }
      html = await vastaus.text()
    } catch {
      syy("haku epaonnistui")
      continue
    } finally {
      await new Promise((r) => setTimeout(r, VIIVE_MS))
    }

    const teksti = kuvausSivusta(html)
    if (!teksti) {
      syy("sivulta ei saatu kelvollista tekstia")
      continue
    }
    if (teksti.length <= nykyinen.length) {
      syy("teksti liian lyhyt")
      continue
    }
    if (!osuukoHankkeeseen(teksti, String(r.name ?? ""), String(r.city ?? ""))) {
      syy("teksti ei liity tahan hankkeeseen")
      continue
    }

    /*
     * Vanhaa ei poisteta. Jos se ei sisally uuteen eika ole pelkka
     * hankkeen nimi, se sailyy merkittyna perassa (sama saanto kuin
     * scripts/synkronoi-kuvaus-nakyviin.ts).
     */
    const pelkkaNimi = normalisoi(nykyinen) === normalisoi(String(r.name ?? ""))
    const sisaltyy =
      !nykyinen || pelkkaNimi || normalisoi(teksti).includes(normalisoi(nykyinen))
    const uusi = sisaltyy ? teksti : `${teksti}\n\nAiempi merkintä: ${nykyinen}`

    const avain = normalisoi(teksti).slice(0, 300)
    tekstiLaskuri.set(avain, (tekstiLaskuri.get(avain) ?? 0) + 1)
    ehdotukset.push({ r, nykyinen, teksti, uusi, sisaltyy, avain })
  }

  for (const e of ehdotukset) {
    const { r, nykyinen, teksti, uusi, sisaltyy } = e
    if ((tekstiLaskuri.get(e.avain) ?? 0) >= SAMA_RAJA) {
      syy(`sama teksti ${tekstiLaskuri.get(e.avain)} hankkeelle — ei hankekohtainen sivu`)
      continue
    }
    if (!sisaltyy) sailytetty += 1

    parani += 1
    console.log("=".repeat(98))
    console.log(`${String(r.name).slice(0, 70)}`)
    console.log(`  ${nykyinen.length} -> ${uusi.length} merkkia  ${String(r.url).slice(0, 72)}`)
    console.log(`  ${teksti.slice(0, 260)}${teksti.length > 260 ? "…" : ""}`)
    if (!sisaltyy) console.log(`  (aiempi merkintä säilytetty: ${nykyinen.slice(0, 80)})`)

    if (!apply) continue

    const { error } = await db
      .from("projects")
      .update({
        additional_info: uusi,
        metadata: {
          ...(r.metadata ?? {}),
          description: uusi,
          description_from_url_at: new Date().toISOString(),
        },
      })
      .eq("id", r.id)
    if (error) console.log(`  VIRHE: ${error.message}`)
  }

  console.log("=".repeat(98))
  console.log(`parani ${parani} / ${kohteet.length}, aiempi merkinta sailytetty ${sailytetty}`)
  console.log("syyt joilla ei parantunut:")
  for (const [s, n] of [...syyt.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${s}`)
  }
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
