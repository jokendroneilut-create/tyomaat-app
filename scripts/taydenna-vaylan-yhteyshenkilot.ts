import { readFileSync, writeFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * VAYLAN KAIKKI YHTEYSHENKILOT TAKAUTUVASTI (D-384).
 *
 * `vaylaContactBox` otti sivun yhteystietolaatikoista vain
 * ensimmaisen. Johannes vertasi Kirjalansalmen korttia lahteeseen:
 * sivulla on kolme laatikkoa ja saimme yhden -- ja se joka jai
 * saamatta oli **urakoitsijan projektipaallikko**, eli juuri se ihminen
 * jonka saa kiinni tyomaasta ([[register-is-worksite-contacts]]).
 *
 * Jasennin on korjattu (`vaylanYhteyshenkilot`), mutta korjaus ei
 * kosketa jo haettuja sivuja: fact-tyolainen kasittelee dokumentin vain
 * kerran. Siksi tama ajo.
 *
 * YHDISTAA, EI KORVAA. Sama nimi paivitetaan vain tyhjien kenttien
 * osalta, tuntematon lisataan, kasin lisatty jaa
 * ([[manual-parties-linkedin]], [[matched-overwrites-contacts]]).
 *
 * TIEDOTTAJA OTETAAN MUKAAN. Han ei ole tyomaayhteys, mutta tama on
 * HANKKEEN OMA yhteyshenkilo lahteesta, ei meidan valitsemamme rivi
 * yritysrekisterista -- ja hankkeen omaan ei kosketa roolin takia
 * (D-381). Johannes: *"voihan asiakas tuoltakin kaivaa sita oikeaa
 * henkiloa jota me emme tieda."*
 *
 * HAKU HITAASTI. Viisi rinnakkaista epaonnistui 107 kertaa 272:sta
 * 7.11.2026; kaksi ja tauko antoi nollan ([[failed-fetch-burns-budget]]).
 *
 *   npx tsx scripts/taydenna-vaylan-yhteyshenkilot.ts
 *   npx tsx scripts/taydenna-vaylan-yhteyshenkilot.ts --apply
 */
import * as cheerio from "cheerio"

import { normalizeVaylaContact, vaylanYhteyshenkilot } from "../lib/agent/vaylaContacts"

const APPLY = process.argv.includes("--apply")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const RINNAKKAIN = 2
const TAUKO_MS = 350
const TUNNISTE = "vaylan_yhteyshenkilot_2026_11"
const RAPORTTI = "C:/Users/johan/tyomaat-app/.tmp-vayla-yhteyshenkilot.txt"

function puraCloudflare(koodattu: string): string | null {
  try {
    const avain = parseInt(koodattu.substring(0, 2), 16)
    let ulos = ""
    for (let i = 2; i < koodattu.length; i += 2) {
      ulos += String.fromCharCode(parseInt(koodattu.substring(i, i + 2), 16) ^ avain)
    }
    return ulos || null
  } catch {
    return null
  }
}

async function hae(url: string): Promise<string | null> {
  for (let i = 0; i < 3; i++) {
    try {
      const ohjain = new AbortController()
      const kello = setTimeout(() => ohjain.abort(), 25_000)
      const r = await fetch(url, { cache: "no-store", headers: { "user-agent": UA }, signal: ohjain.signal })
      clearTimeout(kello)
      if (r.ok) return await r.text()
    } catch {
      /* yritetaan uudelleen */
    }
    await new Promise((r) => setTimeout(r, 1200 * (i + 1)))
  }
  return null
}

const avain = (n: unknown) => String(n ?? "").toLowerCase().replace(/\s+/g, " ").trim()
const tyhja = (v: unknown) => v === null || v === undefined || String(v).trim() === ""

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* Yksi luku; instanssi on NANO ([[backfill-run-limits]]). */
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

  const jono = hankkeet.filter(
    (h) =>
      h.is_public &&
      h.status === "active" &&
      /(^|\/\/)(www\.)?vayla\.fi/.test(String(h.metadata?.source_url ?? ""))
  )
  console.log(`vayla.fi-hankkeita ${jono.length}\n`)

  const rivit: string[] = []
  let laatikoita = 0
  let lisattyja = 0
  let taydennettyja = 0
  let kosketut = 0
  let haku = 0
  const tyojono = [...jono]

  await Promise.all(
    Array.from({ length: RINNAKKAIN }, async () => {
      while (tyojono.length) {
        const h = tyojono.shift()
        if (!h) break
        await new Promise((r) => setTimeout(r, TAUKO_MS))
        const html = await hae(String(h.metadata.source_url))
        if (html === null) {
          haku++
          continue
        }

        const $ = cheerio.load(html)
        const laatikot = vaylanYhteyshenkilot($, puraCloudflare)
        if (!laatikot.length) continue
        laatikoita += laatikot.length

        const poimitut = laatikot.flatMap((l) => normalizeVaylaContact(l))
        if (!poimitut.length) continue

        const omat: any[] = Array.isArray(h.metadata?.contact_persons)
          ? h.metadata.contact_persons.map((k: any) => ({ ...k }))
          : []

        let lisatty = 0
        let taydennetty = 0
        for (const p of poimitut) {
          const osuma = omat.find((k) => avain(k?.name) === avain(p.name))
          if (!osuma) {
            omat.push(p)
            lisatty++
            continue
          }
          let muuttui = false
          for (const kentta of ["title", "email", "phone", "organization"] as const) {
            if (tyhja(osuma[kentta]) && !tyhja((p as any)[kentta])) {
              osuma[kentta] = (p as any)[kentta]
              muuttui = true
            }
          }
          if (muuttui) taydennetty++
        }

        if (!lisatty && !taydennetty) continue
        kosketut++
        lisattyja += lisatty
        taydennettyja += taydennetty

        console.log(
          `${APPLY ? "KIRJOITA" : "(kuiva) "} ${String(h.name).slice(0, 40).padEnd(40)} ` +
            `laatikoita ${laatikot.length} | ${(h.metadata?.contact_persons ?? []).length} -> ${omat.length} (uusia ${lisatty}, taydennetty ${taydennetty})`
        )
        for (const k of omat.slice(omat.length - lisatty)) {
          console.log(`           + ${String(k.name).padEnd(20)} ${String(k.title ?? "-").slice(0, 24).padEnd(24)} ${k.organization ?? "-"} | ${k.email || "-"} | ${k.phone ?? "-"}`)
          rivit.push(`${h.id}\t${h.name}\t${k.name}\t${k.title ?? ""}\t${k.organization ?? ""}\t${k.email ?? ""}\t${k.phone ?? ""}`)
        }

        if (!APPLY) continue
        const md = {
          ...(h.metadata ?? {}),
          contact_persons: omat,
          field_sources: {
            ...(h.metadata?.field_sources ?? {}),
            contact_persons: "Vaylaviraston hankesivun yhteystietolohko (kaikki laatikot)",
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
      }
    })
  )

  writeFileSync(RAPORTTI, rivit.join("\n"), "utf8")
  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  console.log(`  haettu ${jono.length}, haku epaonnistui ${haku}`)
  console.log(`  yhteystietolaatikoita yhteensa ${laatikoita}`)
  console.log(`  hankkeita kosketettu ${kosketut}: uusia henkiloita ${lisattyja}, taydennettyja ${taydennettyja}`)
  console.log(`  tuotos ${RAPORTTI}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
