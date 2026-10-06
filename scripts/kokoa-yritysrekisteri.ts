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
 * YRITYSREKISTERIN EHDOTUS OLEMASSA OLEVASTA AINEISTOSTA (D-242).
 *
 * Yrityksen omasta lahteesta tulleen hankkeen yhteyshenkilo ON sen
 * yrityksen ihminen — lahde kertoo yrityksen, ei arvaus. Jos sama
 * henkilo esiintyy usealla saman yrityksen hankkeella, han on yrityksen
 * vakiokontakti ja kelpaa yrityskohtaiseksi yhteyshenkiloksi niille
 * hankkeille joilla omaa ei ole.
 *
 * EI KIRJOITA MITAAN ilman --apply.
 */
async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { kelpaaYhteyshenkiloksi } = await import("../lib/metrics/yhteystiedonKattavuus")
  const { yritysavain, hankkeenYritysavaimet } = await import("../lib/metrics/yritysavain")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const kaikki: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("projects").select("id, name, developer, builder, metadata").range(from, from + 999)
    if (error) throw error
    kaikki.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  /*
   * ORGANISAATION OMAT LAHTEET.
   *
   * Ei vain `company_project`: myos Vaylavirasto, Senaatti-kiinteistot
   * ja Kreate pitavat omaa hankeluetteloa muussa kategoriassa, ja juuri
   * niilla on eniten nimettyja ihmisia (Vaylavirasto 267). Lahteen nimi
   * kertoo organisaation, ja `source_name` hankkeella on sama nimi tai
   * parserin tunnus riippuen kerajasta — molemmat otetaan vastaan.
   */
  const { data: lahteet } = await db
    .from("discovery_sources")
    .select("name, parser, category")
    .in("category", ["company_project", "infrastructure_project", "state_property_project"])

  const parseriYritys = new Map<string, string>()
  for (const l of lahteet ?? []) {
    const yritys = String(l.name).replace(/\s+(tiedotteet|projektit|uutiset|hankkeet|kohdesivut|taloyhtiot|referenssit).*$/i, "").trim()
    parseriYritys.set(String(l.parser), yritys)
    parseriYritys.set(String(l.name), yritys)
  }

  /* Henkilot yrityksittain, laskettuna yrityksen OMASTA lahteesta. */
  type Hlo = { nimi: string; nimike: string | null; email: string | null; puhelin: string | null; kpl: number }
  const rekisteri = new Map<string, { yritys: string; hlot: Map<string, Hlo> }>()

  for (const p of kaikki) {
    const lahdeNimi = String((p.metadata ?? {}).source_name ?? "")
    const yritys = parseriYritys.get(lahdeNimi)
    if (!yritys) continue

    const avain = yritysavain(yritys)
    if (!avain) continue

    const lista = (p.metadata ?? {}).contact_persons
    if (!Array.isArray(lista)) continue

    for (const c of lista) {
      if (!kelpaaYhteyshenkiloksi(c)) continue
      /*
       * VIESTINTA EI OLE OSTAJA. Rooli on merkitty vain osalle, joten
       * nimike tarkistetaan erikseen: kuivaharjoitus 6.10.2026 nosti
       * SRV:n ja NCC:n listan karkeen viestintapaallikot, jotka
       * vastaavat haastattelupyyntoihin eivat hankinnoista.
       */
      if (String(c.role ?? "") === "media") continue
      if (/viestint|tiedott|media|markkinoin/i.test(String(c.title ?? ""))) continue

      /*
       * RIKKINAINEN NIMIKE PALJASTAA RIKKINAISEN POIMINNAN. Yksi rivi oli
       * ". YhteyshenkilotManu Lainioh..." — nimike jossa on toisen
       * henkilon nimi kiinni. Sellaista ei viedä rekisteriin.
       */
      if (String(c.title ?? "").length > 60) continue
      if (/yhteyshenkil/i.test(String(c.title ?? ""))) continue

      const tunniste = String(c.email ?? c.name).toLowerCase()
      const rek = rekisteri.get(avain) ?? { yritys, hlot: new Map<string, Hlo>() }
      const vanha = rek.hlot.get(tunniste)
      if (vanha) vanha.kpl++
      else rek.hlot.set(tunniste, { nimi: String(c.name), nimike: c.title ?? null, email: c.email ?? null, puhelin: c.phone ?? null, kpl: 1 })
      rekisteri.set(avain, rek)
    }
  }

  /*
   * SAMA SUODATUS NAYTOLLE JA KIRJOITUKSELLE. Kuivaharjoitus naytti
   * ensin myos rivit joita --apply ei kirjoita (yhden hankkeen
   * henkilot), eli tuotos ei vastannut ajoa. Se on juuri se ero joka
   * tekee kuivaharjoituksesta hyodyttoman.
   */
  const VAHIMMAISTOISTO = 2
  for (const r of rekisteri.values()) {
    for (const [avain, h] of r.hlot) {
      if (h.kpl < VAHIMMAISTOISTO) r.hlot.delete(avain)
    }
  }
  for (const [avain, r] of rekisteri) {
    if (r.hlot.size === 0) rekisteri.delete(avain)
  }

  /* Montako hanketta hyotyisi? */
  const ilmanOmaa = kaikki.filter((p) => {
    const lista = (p.metadata ?? {}).contact_persons
    return !(Array.isArray(lista) && lista.some(kelpaaYhteyshenkiloksi))
  })

  console.log(apply ? "=== AJO ===" : "=== KUIVAHARJOITUS ===")
  console.log("yrityksia rekisterissa " + rekisteri.size)
  console.log("")

  let hyotyvia = 0
  const kattaa = new Map<string, number>()
  for (const p of ilmanOmaa) {
    for (const a of hankkeenYritysavaimet(p)) {
      if (rekisteri.has(a)) {
        hyotyvia++
        kattaa.set(a, (kattaa.get(a) ?? 0) + 1)
        break
      }
    }
  }
  console.log("hankkeita ilman omaa yhteyshenkiloa: " + ilmanOmaa.length)
  console.log("naista rekisteri kattaisi:           " + hyotyvia)
  console.log("")

  if (apply) {
    /*
     * JOHDETUT RIVIT KIRJOITETAAN UUSIKSI, KASIN LISATYT EIVAT.
     *
     * Ensimmainen ajo kirjoitti myos yhden hankkeen henkilot; kun saanto
     * kiristyi, ne jaisivat kantaan ilman etta mikaan poistaisi niita.
     * Poisto kohdistuu vain `lahde`-kentan perusteella johdettuihin, eli
     * myohemmin kasin lisatty tieto sailyy.
     */
    const { error: poistoVirhe } = await db
      .from("yritys_yhteyshenkilot")
      .delete()
      .like("lahde", "johdettu%")
    if (poistoVirhe) console.log("poisto epaonnistui: " + poistoVirhe.message)

    const rivit: any[] = []
    for (const [avain, r] of rekisteri) {
      for (const h of r.hlot.values()) {

        rivit.push({
          avain,
          yritys: r.yritys,
          nimi: h.nimi,
          nimike: h.nimike,
          email: h.email,
          puhelin: h.puhelin,
          lahde: "johdettu yrityksen omasta lahteesta, " + h.kpl + " hanketta",
          paivitetty: new Date().toISOString(),
        })
      }
    }

    /*
     * Upsert yksilollisella (avain, email|nimi) -indeksilla: ajo voidaan
     * toistaa ilman kaksoisrivia, ja uudempi nimike voittaa.
     */
    const { error } = await db
      .from("yritys_yhteyshenkilot")
      .upsert(rivit, { onConflict: "avain,email" , ignoreDuplicates: false })

    if (error) {
      /* Jos osittainen indeksi ei kelpaa onConflictiin, kirjoitetaan rivi kerrallaan. */
      let ok = 0
      for (const rivi of rivit) {
        const { error: e2 } = await db.from("yritys_yhteyshenkilot").insert(rivi)
        if (!e2) ok++
      }
      console.log("kirjoitettu rivi kerrallaan: " + ok + " / " + rivit.length)
    } else {
      console.log("kirjoitettu " + rivit.length + " rivia")
    }
    console.log("")
  }

  console.log("rekisteri (yritys, henkiloita, kattaa hanketta):")
  const jarj = [...rekisteri].sort((a, b) => (kattaa.get(b[0]) ?? 0) - (kattaa.get(a[0]) ?? 0))
  for (const [avain, r] of jarj.slice(0, 18)) {
    console.log("  " + r.yritys.slice(0, 22).padEnd(24) + String(r.hlot.size).padStart(3) + " hlo   kattaa " + String(kattaa.get(avain) ?? 0).padStart(3))
    for (const h of [...r.hlot.values()].sort((a, b) => b.kpl - a.kpl).slice(0, 2)) {
      console.log("      " + String(h.kpl).padStart(2) + "x  " + h.nimi.padEnd(24) + (h.nimike ?? "-").slice(0, 28))
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
