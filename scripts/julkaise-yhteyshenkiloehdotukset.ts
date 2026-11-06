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
 * YHTEYSHENKILOEHDOTUSTEN JULKAISU (D-376, vaihe 3).
 *
 * `metadata.yhteyshenkiloehdotus` on 116 julkisella hankkeella: nimi,
 * nimike, sahkoposti, puhelin, organisaatio ja lahde-URL. Tuottanut
 * claude-opus-5 6.10.2026, eika sita lue mikaan ([[own-data-unread]]).
 *
 * VAIHE 2 TARKISTI VAIN NIMEN. 100/116 lapaisi, eli nimi loytyi silta
 * sivulta johon ehdotus vetoaa. Mutta **puhelin ja sahkoposti tulivat
 * mallilta**, ja juuri ne asiakas kayttaa: vaara numero on pahempi kuin
 * puuttuva, koska kayttaja luulee tavoittaneensa oikean ihmisen.
 *
 * Siksi tama ajo tarkistaa myos YHTEYSTIEDOT samalta sivulta:
 *
 *   - sahkoposti sellaisenaan, ja Cloudflare-suojattuna (Vayla ja moni
 *     muu kayttaa `data-cfemail`-obfuskaatiota, D-379)
 *   - puhelin numeroiksi riisuttuna, koska sivulla se voi olla
 *     "029 534 3342" ja ehdotuksessa "+358 29 534 3342"
 *
 * JULKAISTAAN VAIN SE MIKA LOYTYY. Jos nimi ja sahkoposti vahvistuvat
 * muttei puhelin, puhelin jatetaan pois -- ei koko ihmista.
 *
 * TASO ON `project`, koska lahde on hankkeen oma sivu (D-373).
 *
 * MYYNTIVAKI JATETAAN POIS. Rekisteriin ja hankkeelle tulee ihminen
 * jonka saa kiinni TYOMAASTA ([[register-is-worksite-contacts]]):
 * "myyntipaallikko, LKV" myy asuntoja ja "Sales Manager" asiakkaille,
 * kumpikaan ei vastaa tyomaasta.
 *
 *   npx tsx scripts/julkaise-yhteyshenkiloehdotukset.ts
 *   npx tsx scripts/julkaise-yhteyshenkiloehdotukset.ts --apply
 */
const APPLY = process.argv.includes("--apply")
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const RINNAKKAIN = 2
const TAUKO_MS = 300
const TUNNISTE = "yhteyshenkiloehdotus_julkaistu_2026_11"
const RAPORTTI = "C:/Users/johan/tyomaat-app/.tmp-ehdotusjulkaisu.txt"

/* Myyntirooli ei ole tyomaayhteys. */
const MYYNTIROOLI = /\b(myynti|sales|kaupallinen johtaja|asiakasp[aä][aä]llikk)/i

/*
 * UNICODE JAI PURKAMATTA YHDESSA EHDOTUKSESSA:
 * `Ty"omaap\u00e4\u00e4llikk\u00f6, Insin\u00f6\u00f6ri`. Puretaan, ja
 * karanneet lainausmerkit pois -- rikkinainen nimike nakyy asiakkaalle.
 */
function siistiNimike(arvo: unknown): string | null {
  let teksti = String(arvo ?? "")
  if (!teksti.trim()) return null
  teksti = teksti.replace(/\\u([0-9a-fA-F]{4})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
  teksti = teksti.replace(/["']/g, "").replace(/\s+/g, " ").trim()
  return teksti || null
}

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

const numerot = (arvo: unknown) => String(arvo ?? "").replace(/\D/g, "")

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

  const tavoitettava = (k: unknown) => {
    const r = k as { email?: unknown; phone?: unknown } | null
    return Boolean(String(r?.email ?? "").trim() || String(r?.phone ?? "").trim())
  }

  const jono = hankkeet.filter((h) => {
    if (!h.is_public || h.status !== "active") return false
    const e = h.metadata?.yhteyshenkiloehdotus
    if (!e?.nimi) return false
    const omat = Array.isArray(h.metadata?.contact_persons) ? h.metadata.contact_persons : []
    /* Vain hankkeille joilla EI ole ketaan tavoitettavaa. */
    return !omat.some(tavoitettava)
  })

  console.log(`ehdokkaita ${jono.length}\n`)

  const rivit: string[] = []
  let julkaistu = 0
  const luokat: Record<string, number> = {}
  const tyojono = [...jono]

  await Promise.all(
    Array.from({ length: RINNAKKAIN }, async () => {
      while (tyojono.length) {
        const h = tyojono.shift()
        if (!h) break
        const e = h.metadata.yhteyshenkiloehdotus
        const nimike = siistiNimike(e.nimike)

        if (nimike && MYYNTIROOLI.test(nimike)) {
          luokat.myyntirooli = (luokat.myyntirooli ?? 0) + 1
          console.log(`  OHITA (myynti)  ${String(h.name).slice(0, 36).padEnd(36)} ${e.nimi} — ${nimike}`)
          continue
        }

        const url = (Array.isArray(e.lahteet) ? e.lahteet : []).find((u: unknown) =>
          /^https?:\/\//.test(String(u))
        )
        if (!url) {
          luokat.ei_lahdetta = (luokat.ei_lahdetta ?? 0) + 1
          continue
        }

        await new Promise((r) => setTimeout(r, TAUKO_MS))
        const html = await hae(String(url))
        if (html === null) {
          luokat.haku_epaonnistui = (luokat.haku_epaonnistui ?? 0) + 1
          console.log(`  OHITA (haku)    ${String(h.name).slice(0, 36).padEnd(36)} ${e.nimi}`)
          continue
        }

        /* Cloudflare-suojatut osoitteet mukaan tarkistettavaan tekstiin. */
        const puretut = [...html.matchAll(/data-cfemail="([0-9a-f]+)"/g)]
          .map((m) => puraCloudflare(m[1]))
          .filter(Boolean)
          .join(" ")
        const sivu = `${html} ${puretut}`
        const sivunNumerot = numerot(sivu)

        const nimiOk = sivu.includes(String(e.nimi))
        const postiOk = e.email ? sivu.toLowerCase().includes(String(e.email).toLowerCase()) : false
        const puhelinOk = e.puhelin
          ? numerot(e.puhelin).length >= 7 && sivunNumerot.includes(numerot(e.puhelin))
          : false

        if (!nimiOk) {
          luokat.nimi_ei_sivulla = (luokat.nimi_ei_sivulla ?? 0) + 1
          console.log(`  OHITA (nimi)    ${String(h.name).slice(0, 36).padEnd(36)} ${e.nimi}`)
          continue
        }
        if (!postiOk && !puhelinOk) {
          luokat.ei_yhteystietoa = (luokat.ei_yhteystietoa ?? 0) + 1
          console.log(`  OHITA (tiedot)  ${String(h.name).slice(0, 36).padEnd(36)} ${e.nimi} — ei sahkopostia eika puhelinta sivulla`)
          continue
        }

        const kontakti = {
          kind: "person" as const,
          name: String(e.nimi),
          title: nimike,
          email: postiOk ? String(e.email) : null,
          phone: puhelinOk ? String(e.puhelin) : null,
          organization: e.organisaatio ? String(e.organisaatio) : null,
          level: "project" as const,
        }

        julkaistu++
        luokat.julkaistu = (luokat.julkaistu ?? 0) + 1
        console.log(
          `${APPLY ? "JULKAISE" : "(kuiva) "} ${String(h.name).slice(0, 36).padEnd(36)} ` +
            `${kontakti.name.padEnd(20)} | ${String(kontakti.title ?? "-").slice(0, 26).padEnd(26)} | ` +
            `${kontakti.email ?? "-"} | ${kontakti.phone ?? "(ei vahvistettu)"}`
        )
        rivit.push(
          `${h.id}\t${h.name}\t${kontakti.name}\t${kontakti.title ?? ""}\t${kontakti.email ?? ""}\t${kontakti.phone ?? ""}\t${url}`
        )

        if (!APPLY) continue
        const omat = Array.isArray(h.metadata?.contact_persons) ? h.metadata.contact_persons : []
        const md = {
          ...(h.metadata ?? {}),
          contact_persons: [...omat.filter((k: any) => String(k?.name ?? "") !== kontakti.name), kontakti],
          field_sources: {
            ...(h.metadata?.field_sources ?? {}),
            contact_persons: `Hankkeen oma lahde, nimi ja yhteystieto tarkistettu sivulta: ${url}`,
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
  console.log(`  ehdokkaita ${jono.length}, julkaistaisiin ${julkaistu}`)
  for (const [k, v] of Object.entries(luokat).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(v).padStart(3)}  ${k}`)
  }
  console.log(`  tuotos ${RAPORTTI}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
