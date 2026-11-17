import { readFileSync, appendFileSync, existsSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * DATAKESKUSHANKKEIDEN KARTOITUS (D-436).
 *
 * Johannes 17.11.2026: *"tee myös verkkohaku kaikille hankkeille joiden
 * tyyppi on 'datakeskus' jos saadaan niistä lisää tietoa ja täydennä"*.
 *
 * Kaksi lähdettä jokaiselle julkiselle datakeskusriville. Tämä skripti
 * vain KERÄÄ, ei kirjoita kantaan: tulos luetaan ennen täydennystä.
 *
 *   1. Datakeskusrekisterin nykyinen JSON (`/hankkeet/<id>/json`), jos
 *      rivillä on rekisterilinkki. Keräin hakee täydet kentät vain kun se
 *      näkee hankkeen ensimmäisen kerran, ja rekisteri täydentyy sen
 *      jälkeen: Riihimäki Portti VI oli rekisterissä 29.9. pelkkä nimi.
 *   2. Verkkohaku (DuckDuckGo HTML, 4 s väli, sama kuin D-420):
 *      "<nimi> <kunta> datakeskus". Talteen otsikko, osoite ja katkelma.
 *
 *   npx tsx scripts/kartoita-datakeskukset.ts --ulos=<tiedosto.jsonl> [--raja=N]
 */

const HAKU_VIIVE_MS = 4000
const EI_HAKUA = process.argv.includes("--ei-hakua")
const EI_LAHTEEKSI =
  /facebook|linkedin|twitter|x\.com|instagram|youtube|tiktok|pinterest|duckduckgo|fonecta|finder\.fi|asiakastieto|vainu|ytj\.fi|tyomaat\.fi|tarjouspalvelu|kauppalehti\.fi\/yritykset|proff\.fi|inforegister/i

const odota = (ms: number) => new Promise((r) => setTimeout(r, ms))

function haeOsoite(ddgHref: string): string | null {
  const m = ddgHref.match(/[?&]uddg=([^&]+)/)
  if (!m) return ddgHref.startsWith("http") ? ddgHref : null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return null
  }
}

function rekisteriId(md: any): string | null {
  const urlit = [md?.source_url, md?.documents_url, md?.last_source_url, ...(md?.source_history ?? []).map((h: any) => h?.document_url)]
  for (const u of urlit) {
    const m = String(u ?? "").match(/datakeskusrekisteri\.fi\/hankkeet\/([0-9a-f-]{36})/)
    if (m) return m[1]
  }
  return null
}

async function main() {
  const ulos = process.argv.find((a) => a.startsWith("--ulos="))?.slice("--ulos=".length)
  if (!ulos) throw new Error("anna --ulos=tiedosto.jsonl")
  const raja = Number(process.argv.find((a) => /^--raja=\d+$/.test(a))?.split("=")[1] ?? 0)

  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: hankkeet, error } = await db
    .from("projects")
    .select("id,name,city,phase,developer,builder,estimated_cost,floor_area,lat,lng,location,additional_info,metadata")
    .eq("is_public", true)
    .ilike("property_type", "datakeskus")
    .order("id")
  if (error) throw error

  const tehty = new Set<string>()
  if (existsSync(ulos)) for (const r of readFileSync(ulos, "utf8").split("\n").filter(Boolean)) tehty.add(JSON.parse(r).id)
  const jono = (hankkeet ?? []).filter((h) => !tehty.has(h.id))
  console.log(`datakeskuksia ${hankkeet?.length}, jo haettu ${tehty.size}, haetaan ${raja ? Math.min(raja, jono.length) : jono.length}`)

  let n = 0
  let estetty = 0
  for (const h of raja ? jono.slice(0, raja) : jono) {
    const md: any = h.metadata ?? {}

    /* 1. Rekisteri */
    let rekisteri: any = null
    const rid = rekisteriId(md)
    if (rid) {
      try {
        const v = await fetch(`https://www.datakeskusrekisteri.fi/hankkeet/${rid}/json`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; tyomaat.fi/1.0)" },
        })
        if (v.ok) {
          const j: any = await v.json()
          const hk = j.hanke ?? {}
          rekisteri = {
            id: rid,
            nimi: hk.nimi,
            vaihe: hk.vaihe,
            toimija: hk.toimija?.nimi ?? null,
            teho_mw: hk.teho_mw,
            it_teho_mw: hk.it_teho_mw,
            teho_erittelematon_mw: hk.teho_erittelematon_mw,
            pinta_ala_ha: hk.pinta_ala_ha,
            kaava_ala_ha: hk.kaava_ala_ha,
            sahkonkaytto_twh_a: hk.sahkonkaytto_twh_a,
            lat: hk.sijainti_lat,
            lon: hk.sijainti_lon,
            kaavatunnus: hk.kaavatunnus,
            yva: hk.yva_diaarinumero,
            hukkalampo: hk.hukkalampo_tila,
            huomautus: hk.huomautus,
            vahvistettu: j.kentat_ihmisen_vahvistama,
            viranomainen: j.kentat_viranomaislahde,
            organisaatiot: (j.organisaatiot ?? []).map((o: any) => ({
              nimi: o.organisaatio?.nimi,
              rooli: o.rooli_meta?.nimi ?? o.rooli,
            })),
            paatokset: (j.paatokset ?? []).map((p: any) => ({ pvm: p.pvm, kuvaus: p.kuvaus })),
            lahteet: Array.from(
              new Set((j.lahteet?.hankkeet ?? []).map((l: any) => l.lahde_url).filter(Boolean))
            ),
            lainaukset: (j.lahteet?.hankkeet ?? [])
              .filter((l: any) => l.lainaus)
              .map((l: any) => ({ kentta: l.kentta, lainaus: String(l.lainaus).slice(0, 300), url: l.lahde_url })),
          }
        }
      } catch {
        /* rekisteri on lisätieto */
      }
      await odota(800)
    }

    /*
     * 2. Verkkohaku. DuckDuckGo alkoi 17.11.2026 palauttaa bottitarkistuksen
     * ("anomaly") ensimmäisestä hausta lähtien, eikä sitä kierretä.
     * `--ei-hakua` ajaa pelkän rekisteriosan; verkkohaku tehdään silloin
     * erikseen vain niille, jotka jäävät ohuiksi.
     */
    const nimi = String(h.name).split(/\s+/).slice(0, 10).join(" ")
    const kysely = `${nimi} ${h.city ?? ""} datakeskus`
    let html = ""
    for (let yritys = 0; yritys < (EI_HAKUA ? 0 : 4); yritys++) {
      const vastaus = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(kysely)}`, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      }).catch(() => null)
      html = vastaus && vastaus.ok ? await vastaus.text() : ""
      if (html && !/anomaly|unusual traffic/i.test(html) && /result/.test(html)) break
      estetty++
      await odota(60_000 * (yritys + 1))
    }
    const $ = cheerio.load(html)
    const osumat: any[] = []
    for (const el of $(".result").toArray()) {
      const a = $(el).find("a.result__a").first()
      const osoite = haeOsoite(a.attr("href") ?? "")
      if (!osoite || EI_LAHTEEKSI.test(osoite)) continue
      osumat.push({
        otsikko: a.text().replace(/\s+/g, " ").trim(),
        osoite,
        katkelma: $(el).find(".result__snippet").text().replace(/\s+/g, " ").trim().slice(0, 400),
      })
      if (osumat.length >= 8) break
    }

    appendFileSync(
      ulos,
      JSON.stringify({
        id: h.id,
        name: h.name,
        city: h.city,
        phase: h.phase,
        developer: h.developer,
        builder: h.builder,
        estimated_cost: h.estimated_cost,
        floor_area: h.floor_area,
        lat: h.lat,
        lng: h.lng,
        kuvaus: String(h.additional_info ?? "").slice(0, 600),
        source_name: md.source_name ?? null,
        teho_mw: md.teho_mw ?? null,
        rekisteri,
        kysely,
        osumat,
      }) + "\n"
    )
    n++
    if (n % 20 === 0) console.log(`${n} haettu, rajoituksia ${estetty}`)
    if (!EI_HAKUA) await odota(HAKU_VIIVE_MS)
  }
  console.log(`valmis: ${n} haettu, rajoituksia ${estetty}`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
