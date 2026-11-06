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
 * YHTEYSHENKILOEHDOTUSTEN TARKISTUS LAHDETTA VASTEN (D-376, vaihe 2).
 *
 * Kannassa on 116 julkisella hankkeella `metadata.yhteyshenkiloehdotus`:
 * nimi, nimike, sahkoposti, puhelin, organisaatio, lahde-URL, varmuus ja
 * perustelu. Ne on tuottanut claude-opus-5 6.10.2026 eika niita lue
 * mikaan ([[own-data-unread]]). 85:lla hankkeista ei ole omia
 * yhteyshenkiloita lainkaan.
 *
 * VARMUUSLUKU EI OLE PORTTI. 100/116 on "high", ja varmuusluku ei
 * erottele oikeaa vaarasta ([[llm-two-vote-gate]]). Lahde erottelee:
 * **esiintyyko ehdotettu nimi silla sivulla johon ehdotus vetoaa.**
 *
 * TAMA AJO EI KIRJOITA KANTAAN MITAAN. Se hakee sivut ja raportoi, ja
 * tuotos on luettava riveittain ennen kuin mitaan julkaistaan
 * ([[dry-run-before-backfill]]).
 *
 * EPAONNISTUNUT HAKU EI OLE HYLKAYS. 404, aikakatkaisu ja
 * JS-renderoity sivu merkitaan omaksi luokakseen, jottei kuollut sivu
 * nayta vaaralta ehdotukselta ([[failed-fetch-burns-budget]]).
 *
 *   npx tsx scripts/tarkista-yhteyshenkiloehdotukset.ts
 */
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const RINNAKKAIN = 6
const RAPORTTI = "C:/Users/johan/tyomaat-app/.tmp-ehdotustarkistus.txt"

type Tulos = {
  id: string
  hanke: string
  nimi: string
  nimike: string | null
  varmuus: string
  url: string
  omia: number
  luokka: "OSUU" | "SUKUNIMI" | "EI_OSU" | "HAKU_EPAONNISTUI"
  huom: string
}

/* Sukunimi riittaa vihjeeksi muttei paatokseksi ([[finding-signal-not-deciding-signal]]). */
function luokittele(sivu: string, nimi: string): "OSUU" | "SUKUNIMI" | "EI_OSU" {
  const teksti = sivu.replace(/\s+/g, " ")
  if (teksti.includes(nimi)) return "OSUU"
  const osat = nimi.split(/\s+/).filter((o) => o.length > 3)
  const sukunimi = osat[osat.length - 1]
  if (sukunimi && teksti.includes(sukunimi)) return "SUKUNIMI"
  return "EI_OSU"
}

async function hae(url: string): Promise<{ teksti: string | null; syy: string }> {
  try {
    const ohjain = new AbortController()
    const kello = setTimeout(() => ohjain.abort(), 25_000)
    const vastaus = await fetch(url, {
      cache: "no-store",
      headers: { "user-agent": UA },
      signal: ohjain.signal,
    })
    clearTimeout(kello)
    if (!vastaus.ok) return { teksti: null, syy: `HTTP ${vastaus.status}` }
    const tyyppi = String(vastaus.headers.get("content-type") ?? "")
    if (/pdf/i.test(tyyppi)) return { teksti: null, syy: "PDF" }
    return { teksti: await vastaus.text(), syy: "" }
  } catch (e: any) {
    return { teksti: null, syy: String(e?.name === "AbortError" ? "aikakatkaisu" : e).slice(0, 40) }
  }
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

  const jono = hankkeet
    .filter((h) => h.is_public && h.status === "active" && h.metadata?.yhteyshenkiloehdotus)
    .map((h) => {
      const e = h.metadata.yhteyshenkiloehdotus
      const url = (Array.isArray(e.lahteet) ? e.lahteet : []).find((u: unknown) =>
        /^https?:\/\//.test(String(u))
      )
      return {
        id: String(h.id),
        hanke: String(h.name),
        nimi: String(e.nimi ?? ""),
        nimike: e.nimike ?? null,
        varmuus: String(e.varmuus ?? "-"),
        url: url ? String(url) : "",
        omia: Array.isArray(h.metadata?.contact_persons) ? h.metadata.contact_persons.length : 0,
      }
    })

  console.log(`tarkistettavia ehdotuksia ${jono.length}\n`)

  const tulokset: Tulos[] = []
  const tyojono = [...jono]
  await Promise.all(
    Array.from({ length: RINNAKKAIN }, async () => {
      while (tyojono.length) {
        const r = tyojono.shift()
        if (!r) break
        if (!r.url || !r.nimi) {
          tulokset.push({ ...r, luokka: "HAKU_EPAONNISTUI", huom: "ei URLia tai nimea" })
          continue
        }
        const { teksti, syy } = await hae(r.url)
        if (teksti === null) {
          tulokset.push({ ...r, luokka: "HAKU_EPAONNISTUI", huom: syy })
          continue
        }
        tulokset.push({ ...r, luokka: luokittele(teksti, r.nimi), huom: "" })
      }
    })
  )

  const luokat: Record<string, Tulos[]> = {}
  for (const t of tulokset) (luokat[t.luokka] ??= []).push(t)

  for (const luokka of ["OSUU", "SUKUNIMI", "EI_OSU", "HAKU_EPAONNISTUI"] as const) {
    const lista = luokat[luokka] ?? []
    console.log(`\n=== ${luokka} (${lista.length}) ===`)
    for (const t of lista.sort((a, b) => a.hanke.localeCompare(b.hanke, "fi"))) {
      console.log(
        `  ${t.hanke.slice(0, 36).padEnd(36)} | ${t.nimi.padEnd(20)} | ${String(t.nimike ?? "-").slice(0, 24).padEnd(24)} | ${t.varmuus.padEnd(6)} | omia ${t.omia} ${t.huom ? "| " + t.huom : ""}`
      )
    }
  }

  const n = tulokset.length
  const osuu = (luokat.OSUU ?? []).length
  const haettu = n - (luokat.HAKU_EPAONNISTUI ?? []).length
  console.log(`\n=== YHTEENVETO ===`)
  console.log(`  tarkistettu ${n}, sivu saatiin ${haettu}`)
  console.log(`  nimi sivulla:        ${osuu} (${haettu ? ((osuu / haettu) * 100).toFixed(0) : 0} % haetuista)`)
  console.log(`  vain sukunimi:       ${(luokat.SUKUNIMI ?? []).length}`)
  console.log(`  ei lainkaan:         ${(luokat.EI_OSU ?? []).length}`)
  console.log(`  haku epaonnistui:    ${(luokat.HAKU_EPAONNISTUI ?? []).length}`)

  /* Varmuusluku vs. lahde: osuuko "high" paremmin kuin "low"? */
  for (const v of ["high", "medium", "low"]) {
    const ryhma = tulokset.filter((t) => t.varmuus === v && t.luokka !== "HAKU_EPAONNISTUI")
    if (!ryhma.length) continue
    const o = ryhma.filter((t) => t.luokka === "OSUU").length
    console.log(`  varmuus ${v.padEnd(7)} ${o}/${ryhma.length} osuu (${((o / ryhma.length) * 100).toFixed(0)} %)`)
  }

  writeFileSync(
    RAPORTTI,
    tulokset
      .map((t) => `${t.luokka}\t${t.hanke}\t${t.nimi}\t${t.nimike ?? ""}\t${t.varmuus}\t${t.omia}\t${t.url}\t${t.huom}`)
      .join("\n"),
    "utf8"
  )
  console.log(`\n  koko tuotos: ${RAPORTTI}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
