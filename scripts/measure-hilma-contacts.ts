import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: onko Hilman ilmoituksessa yhteyshenkilo?
 *
 * 351 nakyvaa hanketta on Hilmasta ilman yhteystietoa. eForms-ilmoituksessa
 * on organisaatiolohko, jossa on nimi, sahkoposti ja puhelin - samassa
 * rakenteessa josta jo luetaan suorituspaikka (D-092). Tama mittaa kuinka
 * usein kentat ovat oikeasti taytettyja.
 *
 * Ei kirjoita mitaan.
 */

const SAMPLE = Number(process.argv.find((a) => a.startsWith("--n="))?.slice(4) ?? 40)
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

const noticeIdFrom = (url: string): string | null =>
  url.match(/enotice\/(\d+)/)?.[1] ?? url.match(/procurement\/(\d+)/)?.[1] ?? null

/* Kaikki avaimet jotka nayttavat yhteystiedolta, mista tahansa syvyydelta. */
function kerayYhteystiedot(node: any, out: any[], polku = ""): void {
  if (!node || typeof node !== "object") return

  if (Array.isArray(node)) {
    for (const x of node) kerayYhteystiedot(x, out, polku)
    return
  }

  const avaimet = Object.keys(node)
  const onYhteys = avaimet.some((k) =>
    /contact|touchPoint|email|telephone|phone/i.test(k)
  )
  if (onYhteys) out.push({ polku, node })

  for (const k of avaimet) kerayYhteystiedot(node[k], out, polku ? `${polku}.${k}` : k)
}

const arvo = (x: any): string | null => {
  if (x == null) return null
  if (typeof x === "string") return x.trim() || null
  if (typeof x === "object") return arvo(x.value ?? x[0])
  return String(x)
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const rivit: any[] = []
  for (let f = 0; ; f += 1000) {
    const { data } = await s.from("projects").select("id,name,is_public,metadata").range(f, f + 999)
    rivit.push(...(data ?? [])); if (!data || data.length < 1000) break
  }

  const kohteet = rivit.filter(
    (p) =>
      p.is_public &&
      !(Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length) &&
      String(p.metadata?.source_name ?? "").toLowerCase() === "hilma" &&
      p.metadata?.procedure_id
  )

  console.log(`Hilma-hankkeita ilman yhteystietoa: ${kohteet.length}`)
  const otos = kohteet.slice(0, SAMPLE)
  console.log(`otos: ${otos.length}\n`)

  let haettu = 0, epaonnistui = 0
  let onEmail = 0, onPuhelin = 0, onNimi = 0, onJokin = 0
  const polut = new Map<string, number>()
  const naytteet: string[] = []

  for (const p of otos) {
    const proc = String(p.metadata?.procedure_id ?? "")
    const notice = noticeIdFrom(String(p.metadata?.source_url ?? ""))
    if (!proc || !notice) { epaonnistui++; continue }

    try {
      const res = await fetch(
        `https://www.hankintailmoitukset.fi/web/api/public/procedure/${proc}/enotice/${notice}`,
        { headers: { "User-Agent": UA, Accept: "application/json" } }
      )
      if (!res.ok) { epaonnistui++; continue }
      const json: any = await res.json()
      haettu++

      const loydot: any[] = []
      kerayYhteystiedot(json?.eForm, loydot)

      /*
       * EI KAIKKI ORGANISAATIOT. eForms-ilmoituksessa on ostajan lisaksi
       * eSender (Hilman oma tukipalvelu) ja muutoksenhakuelin
       * (markkinaoikeus). Mitattu 22.8.2026: naiden osoitteet tulivat
       * mukaan ja nostivat kattavuuden nayennaisesti sataan prosenttiin.
       */
      const EI_OSTAJA = /hankintailmoitukset\.fi|oikeus\.fi|@vero\.fi|kilpailujakuluttajavirasto/i

      let email: string | null = null, puh: string | null = null, nimi: string | null = null
      for (const l of loydot) {
        polut.set(l.polku, (polut.get(l.polku) ?? 0) + 1)
        const n = l.node
        const e = arvo(n.electronicMail ?? n.email ?? n.contactEmail)
        if (e && EI_OSTAJA.test(e)) continue
        email = email ?? e
        puh = puh ?? arvo(n.telephone ?? n.telephoneNumber ?? n.phone)
        nimi = nimi ?? arvo(n.contactName ?? n.name ?? n.personName)
      }

      if (email) onEmail++
      if (puh) onPuhelin++
      if (nimi) onNimi++
      if (email || puh) onJokin++

      if (naytteet.length < 10 && (email || puh)) {
        naytteet.push(`  ${String(p.name).slice(0, 38).padEnd(40)} ${String(nimi ?? "-").slice(0,22).padEnd(24)} ${String(puh ?? "-").padEnd(16)} ${email ?? "-"}`)
      }
    } catch {
      epaonnistui++
    }
  }

  console.log(`haettu:            ${haettu}`)
  console.log(`epaonnistui:       ${epaonnistui}`)
  console.log(`\nnaista:`)
  console.log(`  sahkoposti:      ${onEmail}   ${Math.round(onEmail / Math.max(1,haettu) * 100)} %`)
  console.log(`  puhelin:         ${onPuhelin}   ${Math.round(onPuhelin / Math.max(1,haettu) * 100)} %`)
  console.log(`  nimi:            ${onNimi}   ${Math.round(onNimi / Math.max(1,haettu) * 100)} %`)
  console.log(`  JOKIN naista:    ${onJokin}   ${Math.round(onJokin / Math.max(1,haettu) * 100)} %`)

  console.log("\nyleisimmat polut joista yhteystieto loytyi:")
  for (const [k, v] of [...polut].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    console.log(`  ${String(v).padStart(4)}  ${k.slice(0, 90)}`)
  }
  if (naytteet.length) { console.log("\nnaytteita:"); for (const n of naytteet) console.log(n) }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
