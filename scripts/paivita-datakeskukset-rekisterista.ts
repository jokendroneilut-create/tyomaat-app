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
 * DATAKESKUSRIVIT REKISTERIN NYKYTIEDOILLA (D-436).
 *
 * Keräin hakee rekisterin täydet kentät vain kun se näkee hankkeen
 * ensimmäistä kertaa (`enrichDatakeskusCandidate`). Rekisteri täydentyy sen
 * jälkeen, mutta meidän rivimme eivät. Mitattu 17.11.2026: 145 rivillä
 * rekisterilinkki; rekisteri toisi 15 uutta toimijaa, 25 tehoa, 114
 * pinta-alaa ja 119 koordinaattia.
 *
 * Säännöt (rekisteri on koostaja, D-365):
 *   - rakennuttaja täytetään vain tyhjään; poikkeava toimija liittyväksi
 *   - teho / IT-teho / pinta-ala metadataan vain tyhjään
 *   - konsultit ja liittyvät yhdistetään, vanhat säilyvät
 *   - kuvaus uusitaan vain jos nykyinen on rekisterin oma pohjateksti
 *     (sama funktio kuin keräimellä, joten vahvistamaton teho merkitään)
 *   - koordinaatti siirretään vain jos meidän piste on kunnan
 *     keskipiste (`--siirrot=<json>` laskettu erikseen geokoodaamalla)
 *
 *   npx tsx scripts/paivita-datakeskukset-rekisterista.ts --siirrot=<json>
 *   npx tsx scripts/paivita-datakeskukset-rekisterista.ts --siirrot=<json> --apply
 */

function rekisteriId(md: any): string | null {
  const urlit = [md?.source_url, md?.documents_url, md?.last_source_url, ...(md?.source_history ?? []).map((h: any) => h?.document_url)]
  for (const u of urlit) {
    const m = String(u ?? "").match(/datakeskusrekisteri\.fi\/hankkeet\/([0-9a-f-]{36})/)
    if (m) return m[1]
  }
  return null
}

const onRekisterinPohja = (teksti: string | null) =>
  !!teksti && /Tiedot ovat datakeskushankkeiden kansallisesta rekisteristä/.test(teksti) && /^[^.]+\. Datakeskushanke/.test(teksti)

async function main() {
  const apply = process.argv.includes("--apply")
  const siirrotPolku = process.argv.find((a) => a.startsWith("--siirrot="))?.slice("--siirrot=".length)
  const siirrot = new Map<string, { lat: number; lon: number }>(
    siirrotPolku ? JSON.parse(readFileSync(siirrotPolku, "utf8")).map((s: any) => [s.id, { lat: s.lat, lon: s.lon }]) : []
  )
  const { createClient } = await import("@supabase/supabase-js")
  const { haeHankkeenTiedot, datakeskusKuvaus, datakeskusKonsultit, datakeskusLiittyvat } = await import(
    "../lib/agent/fetchDatakeskusrekisteriSource"
  )
  const { mergeCompanyNames } = await import("../lib/projects/projectCompanies")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  console.log(apply ? "=== AJO (--apply) ===\n" : "=== KUIVAHARJOITUS ===\n")

  const { data: hankkeet, error } = await db
    .from("projects")
    .select("id,name,city,developer,additional_info,lat,lng,metadata")
    .eq("is_public", true)
    .ilike("property_type", "datakeskus")
    .order("name")
  if (error) throw error

  const laskuri = { rivit: 0, kehittaja: 0, teho: 0, ala: 0, kuvaus: 0, koord: 0, konsultit: 0, liittyvat: 0 }
  for (const h of hankkeet ?? []) {
    const md: any = h.metadata ?? {}
    const rid = rekisteriId(md)
    if (!rid) continue
    const t = await haeHankkeenTiedot(rid)
    await new Promise((s) => setTimeout(s, 700))
    if (!t) {
      console.log(`${h.id.slice(0, 8)} ${h.name} | rekisteri ei vastannut`)
      continue
    }
    const toimija = t.toimija?.nimi?.trim() || null
    const muutokset: string[] = []
    const sarakkeet: Record<string, unknown> = {}
    const uusiMd: any = { ...md }
    const fs: any = { ...(md.field_sources ?? {}) }

    if (toimija && !h.developer) {
      sarakkeet.developer = toimija
      uusiMd.developer = toimija
      fs.developer = "datakeskusrekisteri (koostaja), täydennetty 17.11.2026"
      muutokset.push(`rakennuttaja ${toimija}`)
      laskuri.kehittaja++
    }
    const vanhatYritykset: string[] = Array.isArray(md.related_companies) ? md.related_companies : []
    const yritykset = mergeCompanyNames(vanhatYritykset, [
      ...(toimija && h.developer && toimija !== h.developer ? [toimija] : []),
      ...datakeskusLiittyvat(t),
    ])
    if (yritykset.length > vanhatYritykset.length) {
      uusiMd.related_companies = yritykset
      muutokset.push(`liittyvät +${yritykset.length - vanhatYritykset.length}`)
      laskuri.liittyvat++
    }
    const vanhatKonsultit: any[] = Array.isArray(md.consultants) ? md.consultants : []
    const lisaKonsultit = datakeskusKonsultit(t).filter(
      (k) => !vanhatKonsultit.some((v: any) => String(v?.name ?? "").toLowerCase() === k.name.toLowerCase())
    )
    if (lisaKonsultit.length) {
      uusiMd.consultants = [...vanhatKonsultit, ...lisaKonsultit]
      muutokset.push(`konsultit +${lisaKonsultit.map((k) => `${k.name} (${k.role})`).join(", ")}`)
      laskuri.konsultit++
    }
    for (const [kentta, arvo] of [
      ["teho_mw", t.teho_mw],
      ["it_teho_mw", t.it_teho_mw],
      ["pinta_ala_ha", t.pinta_ala_ha],
    ] as const) {
      if (arvo != null && md[kentta] == null) {
        uusiMd[kentta] = arvo
        muutokset.push(`${kentta} ${arvo}`)
        if (kentta === "pinta_ala_ha") laskuri.ala++
        else laskuri.teho++
      }
    }
    if (onRekisterinPohja(h.additional_info)) {
      const kuvaus = datakeskusKuvaus({ id: rid, nimi: h.name, kunta: h.city, vaihe: md.rekisterin_vaihe ?? null }, t)
      /*
       * Lyhenevä kuvaus jätetään: rekisteristä on silloin poistunut jotain
       * (kuivaharjoitus 17.11.: Polarnode Nokia 585 -> 544, Regant Salo
       * 764 -> 721), eikä tieto saa huonontua.
       */
      if (kuvaus !== h.additional_info && kuvaus.length >= (h.additional_info?.length ?? 0)) {
        sarakkeet.additional_info = kuvaus
        uusiMd.description = kuvaus
        muutokset.push(`kuvaus ${h.additional_info?.length ?? 0} -> ${kuvaus.length} merkkiä`)
        laskuri.kuvaus++
      }
    }
    const siirto = siirrot.get(h.id)
    if (siirto) {
      sarakkeet.lat = siirto.lat
      sarakkeet.lng = siirto.lon
      sarakkeet.latitude = siirto.lat
      sarakkeet.longitude = siirto.lon
      uusiMd.lahteen_koordinaatit = { lat: siirto.lat, lon: siirto.lon, lahde: "datakeskusrekisteri" }
      uusiMd.koordinaattikorjaus = { vanha: [h.lat, h.lng], syy: "kunnan keskipiste -> rekisterin vahvistettu sijainti (D-436)" }
      fs.coordinates = "datakeskusrekisteri (ihmisen vahvistama sijainti)"
      muutokset.push(`koordinaatti siirretään`)
      laskuri.koord++
    }

    if (!muutokset.length) continue
    laskuri.rivit++
    uusiMd.field_sources = fs
    uusiMd.rekisteri_paivitetty = new Date().toISOString().slice(0, 10)
    console.log(`${h.id.slice(0, 8)} ${String(h.name).slice(0, 42).padEnd(42)} | ${muutokset.join(" | ")}`)
    if (!apply) continue
    const { error: e2 } = await db.from("projects").update({ ...sarakkeet, metadata: uusiMd }).eq("id", h.id)
    if (e2) console.log(`  VIRHE ${e2.message}`)
  }
  console.log(`\n${JSON.stringify(laskuri)}`)
  if (!apply) console.log("Ei muutettu mitään. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
