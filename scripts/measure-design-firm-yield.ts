import { writeFileSync } from "node:fs"

/*
 * KARTOITUKSEN VIIMEINEN KIERROS: MONTAKO KESKEN OLEVAA?
 *
 * Tämä on ainoa luku joka ratkaisee. Granlundilla oli 211 hanketta
 * mutta vain 6 kesken olevaa (D-131) — loput olivat valmistuneita, eikä
 * valmis hanke ole liidi.
 *
 * Ei kerää mitään; laskee vain.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) tyomaat.fi-lahdekartoitus"
const TANA_VUONNA = 2026

const g = async (u: string) => {
  const r = await fetch(u, { headers: { "User-Agent": UA } })
  return r.json()
}

function html2text(html: string) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-").replace(/\s+/g, " ").trim()
}

async function kaikki(domain: string, base: string, max = 300) {
  const ulos: any[] = []
  for (let s = 1; s <= Math.ceil(max / 100); s++) {
    try {
      const sivu = await g(`https://${domain}/wp-json/wp/v2/${base}?per_page=100&page=${s}`)
      if (!Array.isArray(sivu) || !sivu.length) break
      ulos.push(...sivu)
      if (sivu.length < 100) break
    } catch { break }
  }
  return ulos
}

async function main() {
  const yhteenveto: any[] = []

  /* --- JKMM: aikataulu on taksonomiatermi --- */
  {
    const termit: any[] = []
    for (let s = 1; s <= 3; s++) {
      const t = await g(`https://jkmm.fi/wp-json/wp/v2/work-status?per_page=100&page=${s}`)
      if (!Array.isArray(t) || !t.length) break
      termit.push(...t)
    }
    /* Avoin muoto "2025 -" tarkoittaa kesken olevaa. */
    const avoimet = termit.filter((t) => /^\s*(20\d\d)\s*[-–]\s*$/.test(String(t.name)))
    const kesken = avoimet.reduce((a, t) => a + Number(t.count ?? 0), 0)
    console.log(`JKMM         avoimia aikataulutermeja ${avoimet.length}, niissa ${kesken} hanketta`)
    console.log(`             ${avoimet.map((t) => `${t.name}(${t.count})`).join(" ")}`)
    yhteenveto.push({ nimi: "JKMM", kesken, kaikki: 236 })
  }

  /* --- Ideastructura: "Ajankohta : 2026" tekstissa --- */
  {
    const items = await kaikki("www.ideastructura.com", "reference", 200)
    let kesken = 0
    const naytteet: string[] = []
    for (const it of items) {
      const t = html2text(it?.content?.rendered ?? "")
      const m = t.match(/Ajankohta\s*:?\s*([0-9]{4})\s*(?:[-–]\s*([0-9]{4})?)?/i)
      if (!m) continue
      const alku = Number(m[1])
      const loppu = m[2] ? Number(m[2]) : (/[-–]\s*$/.test(m[0]) ? 9999 : alku)
      if (loppu >= TANA_VUONNA) {
        kesken++
        if (naytteet.length < 5) naytteet.push(`${String(it?.title?.rendered ?? "").slice(0, 46)} [${m[0].trim()}]`)
      }
    }
    console.log(`\nIdeastructura ${kesken} / ${items.length} ajankohta ${TANA_VUONNA} tai myohemmin`)
    for (const n of naytteet) console.log(`             ${n}`)
    yhteenveto.push({ nimi: "Ideastructura", kesken, kaikki: items.length })
  }

  /* --- SARC Sigge: aikataulu proosassa --- */
  {
    const items = await kaikki("sarcsigge.fi", "projects", 300)
    let kesken = 0
    const naytteet: string[] = []
    for (const it of items) {
      const t = html2text(it?.content?.rendered ?? "")
      /* Kesken oleva tunnistuu joko avoimesta vuosivalista tai sanasta. */
      const avoin = /\b20(2[5-9]|3\d)\s*[-–]\s*(?!\d)/.test(t)
      const sanoin = /(under construction|ongoing|is undergoing|rakenteilla|käynnissä|valmistuu\s+20(2[6-9]|3\d))/i.test(t)
      const tuleva = /\b20(2[6-9]|3\d)\b/.test(t) && /(valmistu|completion|completed in)/i.test(t)
      if (avoin || sanoin || tuleva) {
        kesken++
        if (naytteet.length < 5) naytteet.push(String(it?.title?.rendered ?? "").slice(0, 50))
      }
    }
    console.log(`\nSARC Sigge   ${kesken} / ${items.length} viittaa kesken olevaan`)
    for (const n of naytteet) console.log(`             ${n}`)
    yhteenveto.push({ nimi: "SARC Sigge", kesken, kaikki: items.length })
  }

  /* --- Maaskola --- */
  {
    const items = await kaikki("www.maaskola.fi", "referenssi", 100)
    let kesken = 0
    for (const it of items) {
      const t = html2text(it?.content?.rendered ?? "")
      if (/\b20(2[6-9]|3\d)\b/.test(t) || /(rakenteilla|käynnissä|valmistuu)/i.test(t)) kesken++
    }
    console.log(`\nMaaskola     ${kesken} / ${items.length} viittaa kesken olevaan`)
    yhteenveto.push({ nimi: "Maaskola", kesken, kaikki: items.length })
  }

  writeFileSync("C:/Users/johan/tyomaat-app/scripts/out/design-firms-5.json", JSON.stringify(yhteenveto, null, 2), "utf8")
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
