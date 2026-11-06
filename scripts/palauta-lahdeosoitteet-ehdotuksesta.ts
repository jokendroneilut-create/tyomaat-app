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
 * LAHDEOSOITE YHTEYSHENKILOEHDOTUKSESTA (D-376, vaihe 1).
 *
 * Johannes 6.11.2026 Kirjalansalmen sillasta: *"en loyda lahdetta eli en
 * voi tarkistaa onko tuo oikein."*
 *
 * Mitattu: **285 julkista hanketta (4,0 %) on ilman mitaan lahdelinkkia**
 * -- ei `source_url`, ei `documents_url`, ei `source_history`. Lahes
 * kaikki luotu helmi-heinakuussa 2026 ennen kuin putki tallensi
 * osoitteen.
 *
 * MUTTA 39:LLA OSOITE ON JO KANNASSA, LUKEMATTA.
 * `metadata.yhteyshenkiloehdotus.lahteet` sisaltaa sen sivun jolta
 * yhteyshenkiloehdotus aikanaan haettiin ([[own-data-unread]]).
 * Kirjalansalmella se on vayla.fi:n hankesivu, ja sama osoite loytyi
 * myos verkkohaulla -- eli kentta pitaa paikkansa.
 *
 * TAMA EI KOSKE YHTEYSHENKILOITA. Kirjoitetaan vain `source_url`, jotta
 * "Avaa alkuperainen ilmoitus" -nappi ilmestyy ja rivin voi tarkistaa.
 * Ehdotetun ihmisen julkaisu on eri asia ja vaatii lahdetarkistuksen
 * (vaihe 2, `tarkista-yhteyshenkiloehdotukset.ts`).
 *
 * VAIN TYHJALLE. Jos `source_url` on jo olemassa, sita ei kosketa.
 *
 *   npx tsx scripts/palauta-lahdeosoitteet-ehdotuksesta.ts
 *   npx tsx scripts/palauta-lahdeosoitteet-ehdotuksesta.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const TUNNISTE = "lahde_ehdotuksesta_2026_11"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const hankkeet: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,is_public,status,metadata")
      .range(a, a + 999)
    if (error) throw error
    hankkeet.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  const onLahde = (h: any) =>
    Boolean(
      h.metadata?.source_url ||
        h.metadata?.documents_url ||
        (Array.isArray(h.metadata?.source_history) ? h.metadata.source_history.length : 0)
    )

  /*
   * KAIKKI EHDOTUKSEN LAHTEET EIVAT OLE HANKKEEN LAHTEITA.
   *
   * Kuivaharjoitus luettiin riveittain, ja kuusi osoitetta 39:sta oli
   * sivu jolta YHTEYSHENKILO loytyi -- ei sivu joka kertoo hankkeesta:
   * kaksi `/yhteystiedot/`-sivua, yksi `/contact`, Peabin tiedotelistaus
   * (`ListItems`), Kaarinan "kaupunki rakentaa" -hankelistaus, ja yksi
   * osoitti **meidan omaan sivuumme** tyomaat.fi:hin.
   *
   * Vaara linkki on pahempi kuin puuttuva, koska nappi lupaa
   * "Avaa alkuperainen ilmoitus" ([[listing-page-is-not-project-page]]).
   */
  const OMA_SIVU = /(^|\.)tyomaat\.fi$/i
  const EI_HANKESIVU = /\/(yhteystiedot|contact|contacts|ListItems|kaupunki-rakentaa)\/?$/i

  const ehdotuksenUrl = (h: any): string | null => {
    const lahteet = h.metadata?.yhteyshenkiloehdotus?.lahteet
    if (!Array.isArray(lahteet)) return null
    const url = lahteet.find((u: unknown) => /^https?:\/\//.test(String(u)))
    if (!url) return null
    try {
      const osoite = new URL(String(url))
      if (OMA_SIVU.test(osoite.hostname)) return null
      if (EI_HANKESIVU.test(osoite.pathname)) return null
    } catch {
      return null
    }
    return String(url)
  }

  /* Hylatyt nayteltaan erikseen, jottei suodatin piilota omaa jalkeaan. */
  const hylattyUrl = (h: any): string | null => {
    const lahteet = h.metadata?.yhteyshenkiloehdotus?.lahteet
    if (!Array.isArray(lahteet)) return null
    const url = lahteet.find((u: unknown) => /^https?:\/\//.test(String(u)))
    return url && !ehdotuksenUrl(h) ? String(url) : null
  }

  const julkiset = hankkeet.filter((h) => h.is_public && h.status === "active")
  const ilman = julkiset.filter((h) => !onLahde(h))
  const korjattavat = ilman.filter((h) => ehdotuksenUrl(h))

  console.log(`julkisia aktiivisia ${julkiset.length}`)
  console.log(`  ilman mitaan lahdelinkkia: ${ilman.length}`)
  console.log(`  joilla osoite ehdotuksessa: ${korjattavat.length}\n`)

  let kirjoitettu = 0
  for (const h of korjattavat) {
    const url = ehdotuksenUrl(h)!
    console.log(`${APPLY ? "KIRJOITETAAN" : "(kuiva)     "} ${String(h.name).slice(0, 44).padEnd(44)}`)
    console.log(`               ${url.slice(0, 104)}`)
    if (!APPLY) continue

    const md = {
      ...(h.metadata ?? {}),
      source_url: url,
      field_sources: {
        ...(h.metadata?.field_sources ?? {}),
        source_url: "palautettu metadata.yhteyshenkiloehdotus.lahteet-kentasta",
      },
      takautuvat_ajot: [
        ...new Set([
          ...(Array.isArray(h.metadata?.takautuvat_ajot) ? h.metadata.takautuvat_ajot : []),
          TUNNISTE,
        ]),
      ],
    }
    const { error } = await db.from("projects").update({ metadata: md }).eq("id", h.id)
    if (error) console.log(`   VIRHE: ${error.message}`)
    else kirjoitettu++
  }

  const hylatyt = ilman.filter((h) => hylattyUrl(h))
  console.log(`\nHYLATTY, ei hankesivu (${hylatyt.length}):`)
  for (const h of hylatyt) {
    console.log(`  ${String(h.name).slice(0, 38).padEnd(38)} ${hylattyUrl(h)!.slice(0, 74)}`)
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  if (APPLY) console.log(`  kirjoitettu ${kirjoitettu}/${korjattavat.length}`)
  console.log(`  ilman lahdetta jaa edelleen ${ilman.length - korjattavat.length} (vaatii verkkohaun)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
