import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUKA URAKOITSIJA JULKAISEE TYOMAAN HENKILOSTON?
 *
 * Kreate julkaisee jokaisesta kohteestaan taulukon:
 *
 *   Projektipaallikko | Jussi Kiuru | +358 400 467 365 | jussi.kiuru@kreate.fi
 *
 * Poiminta on ollut olemassa ja toimii: 30/31 Kreate-hanketta on saanut
 * NIMETYN henkilon suorine matkapuhelimineen. Se on taysin eri luokan
 * yhteystieto kuin kunnan kirjaamo (D-104).
 *
 * Kysymys: kuka muu tekee samoin? Meilla on 14 rakennusliiketta
 * lahteena. Tama mittaa lahteittain kuinka moni hanke on saanut
 * yhteystiedon ja kuinka monella on NIMETTY henkilo.
 *
 * Ei kirjoita mitaan.
 */

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("projects").select("name,is_public,metadata").range(f, f + 999)
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  type Rivi = { hankkeita: number; kontaktilla: number; nimella: number; puhelimella: number; esim: string }
  const lahteet = new Map<string, Rivi>()

  for (const p of rivit) {
    if (!p.is_public) continue

    const lahde = String(p.metadata?.source_name ?? "").trim()
    if (!lahde) continue

    if (!lahteet.has(lahde)) {
      lahteet.set(lahde, { hankkeita: 0, kontaktilla: 0, nimella: 0, puhelimella: 0, esim: "" })
    }
    const r = lahteet.get(lahde)!
    r.hankkeita++

    const kontaktit = Array.isArray(p.metadata?.contact_persons) ? p.metadata.contact_persons : []
    if (!kontaktit.length) continue
    r.kontaktilla++

    const henkilo = kontaktit.find((c: any) => String(c?.name ?? "").trim())
    if (henkilo) {
      r.nimella++
      if (String(henkilo.phone ?? "").trim()) r.puhelimella++
      if (!r.esim) {
        r.esim = `${henkilo.name} / ${henkilo.title ?? "-"} / ${henkilo.phone ?? "-"}`
      }
    }
  }

  /*
   * Yrityslahteet erikseen: niissa on se rakenne jota etsitaan.
   * Kunta- ja viranomaislahteet on jo katettu muualla.
   */
  const EI_YRITYS = /(kaav|paatokset|päätökset|lupapiste|kuulutu|asemakaav|hilma|yva|stt_|rakennuslehti|vayla|väylä|senaatti|helsinki_|espoo_|tampere_|turku_|joensuu_|kouvola_|porvoo_|tornio_|tuusula_|kirkkonummi_)/i

  const yritykset = [...lahteet].filter(([nimi]) => !EI_YRITYS.test(nimi))

  console.log("=== YRITYSLAHTEET ===")
  console.log("hankkeita  kontakti  nimetty  puhelin  lahde")
  for (const [nimi, r] of yritykset.sort((a, b) => b[1].nimella - a[1].nimella || b[1].hankkeita - a[1].hankkeita)) {
    const osuus = r.hankkeita ? Math.round(r.nimella / r.hankkeita * 100) : 0
    console.log(
      `${String(r.hankkeita).padStart(9)}  ${String(r.kontaktilla).padStart(8)}  ${String(r.nimella).padStart(7)}  ${String(r.puhelimella).padStart(7)}  ${nimi.slice(0, 34).padEnd(36)} ${osuus}%`
    )
    if (r.esim) console.log(`${" ".repeat(38)}${r.esim.slice(0, 70)}`)
  }

  const yht = yritykset.reduce((a, [, r]) => a + r.hankkeita, 0)
  const nim = yritykset.reduce((a, [, r]) => a + r.nimella, 0)
  console.log(`\nyrityslahteita ${yritykset.length}, hankkeita ${yht}, nimetty henkilo ${nim}   ${Math.round(nim / Math.max(1, yht) * 100)} %`)

  console.log("\n=== LAHTEET JOISSA NIMETTYJA EI LAINKAAN (tarkistettava sivu) ===")
  for (const [nimi, r] of yritykset.filter(([, r]) => r.nimella === 0).sort((a, b) => b[1].hankkeita - a[1].hankkeita)) {
    console.log(`  ${String(r.hankkeita).padStart(4)}  ${nimi.slice(0, 44)}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
