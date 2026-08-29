import { writeFileSync } from "node:fs"

/*
 * KUINKA MONTA HANKETIEDOTETTA VUODESSA?
 *
 * Ensimmäinen kierros laski liian löysällä hakusanalla: JYY:n "osumat"
 * olivat poliittisia kannanottoja joissa esiintyi sana "rakenta".
 * Määrä ei siis kerro mitään ennen kuin osumat ovat oikeita.
 *
 * Tässä tiukempi tunnistus ja tuotto vuositasolla — se on luku jolla
 * lähteitä voi verrata keskenään ja päättää kannattaako niitä lisätä.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) tyomaat.fi-lahdekartoitus"

const LAHTEET = [
  { nimi: "HOAS", domain: "www.hoas.fi", base: "posts", seutu: "Helsinki" },
  { nimi: "TYS", domain: "www.tys.fi", base: "posts", seutu: "Turku" },
  { nimi: "PSOAS", domain: "www.psoas.fi", base: "posts", seutu: "Oulu" },
  { nimi: "KOAS", domain: "www.koas.fi", base: "news", seutu: "Jyväskylä" },
  { nimi: "POAS", domain: "poas.fi", base: "posts", seutu: "Kuopio" },
  { nimi: "Kuopas", domain: "www.kuopas.fi", base: "posts", seutu: "Kuopio" },
  { nimi: "VOAS", domain: "www.voas.fi", base: "posts", seutu: "Vaasa" },
  { nimi: "AYY Asunnot", domain: "ayyasunnot.fi", base: "posts", seutu: "Espoo" },
  { nimi: "Sevas", domain: "sevas.fi", base: "posts", seutu: "Seinäjoki" },
  { nimi: "Lahden Talot", domain: "www.lahdentalot.fi", base: "posts", seutu: "Lahti" },
  { nimi: "Kajaanin Pietari", domain: "www.kajaaninpietari.fi", base: "posts", seutu: "Kajaani" },
  { nimi: "Savonlinnan Asuntopalvelu", domain: "savonlinnanasuntopalvelu.fi", base: "posts", seutu: "Savonlinna" },
  { nimi: "SAO", domain: "www.sao.fi", base: "posts", seutu: "?" },
  { nimi: "Soihtu (JYY)", domain: "soihtu.fi", base: "posts", seutu: "Jyväskylä" },
  { nimi: "JYY", domain: "jyy.fi", base: "posts", seutu: "Jyväskylä" },
  { nimi: "Joensuun Elli", domain: "www.joensuunelli.fi", base: "posts", seutu: "Joensuu" },
]

/*
 * TIUKKA TUNNISTUS. Vaatii teon, ei pelkkää sanaa: hanke alkaa, etenee,
 * valmistuu tai siitä on päätetty. "Rakennusalan kokemusta" ei kelpaa.
 */
const HANKE =
  /(rakenta[a-z]* (?:helsinkiin|espooseen|tamperee|turkuun|ouluun|[A-ZÄÖ][a-zäö]+[a-z]*n)|rakennusty[oö]t|uudisrakenn|peruskorjaus|perusparannus|valmistui|valmistuu|harjannostaj|aiesopimu|tontinvaraus|rakennuslupa|urakoits|purkuty|investoi|rakennuttaa|kilpailutta)/i

/* Pelkka poliittinen kannanotto ei ole hanke. */
const EI_HANKE = /(kannanotto|lausunto|vaalit|hallitusohjelma|leikkau|edunvalvon)/i

function html2text(html: string) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&#8211;/g, "-").replace(/\s+/g, " ").trim()
}

async function kaikkiPostit(domain: string, base: string, max = 200) {
  const ulos: any[] = []
  for (let s = 1; s <= Math.ceil(max / 100); s++) {
    try {
      const r = await fetch(`https://${domain}/wp-json/wp/v2/${base}?per_page=100&page=${s}&orderby=date&order=desc`, {
        headers: { "User-Agent": UA },
      })
      if (!r.ok) break
      const sivu = await r.json()
      if (!Array.isArray(sivu) || !sivu.length) break
      ulos.push(...sivu)
      if (sivu.length < 100) break
    } catch { break }
  }
  return ulos
}

async function main() {
  const yhteenveto: any[] = []
  const tunnisteet = new Map<string, string[]>()

  for (const l of LAHTEET) {
    const postit = await kaikkiPostit(l.domain, l.base)
    if (!postit.length) { console.log(`${l.nimi.padEnd(26)} otosta ei saatu`); continue }

    /* Sama sivusto kahdella verkkotunnuksella paljastuu tunnisteista. */
    const sormenjalki = postit.slice(0, 3).map((p: any) => `${p.id}:${String(p?.date ?? "").slice(0, 10)}`).join("|")
    const lista = tunnisteet.get(sormenjalki) ?? []
    lista.push(l.nimi)
    tunnisteet.set(sormenjalki, lista)

    const osumat = postit.filter((p: any) => {
      const t = html2text(`${p?.title?.rendered ?? ""} ${p?.excerpt?.rendered ?? ""} ${p?.content?.rendered ?? ""}`)
      return HANKE.test(t) && !EI_HANKE.test(t)
    })

    /* Tuotto vuodessa: osumat jaettuna aineiston kattamalla ajalla. */
    const paivat = postit
      .map((p: any) => new Date(String(p?.date ?? "")).getTime())
      .filter((n) => Number.isFinite(n))
    const vuosia = paivat.length > 1 ? (Math.max(...paivat) - Math.min(...paivat)) / (365.25 * 86400000) : 0
    const perVuosi = vuosia > 0.2 ? osumat.length / vuosia : null

    console.log(
      `${l.nimi.padEnd(26)} ${l.seutu.padEnd(13)} ${String(postit.length).padStart(4)} tiedotetta  ` +
      `${String(osumat.length).padStart(3)} hanketta  ${perVuosi ? perVuosi.toFixed(1).padStart(5) : "    -"} /vuosi  ` +
      `tuorein ${String(postit[0]?.date ?? "").slice(0, 10)}`
    )

    yhteenveto.push({
      ...l, tiedotteita: postit.length, hankkeita: osumat.length,
      perVuosi: perVuosi ? Number(perVuosi.toFixed(1)) : null,
      tuorein: String(postit[0]?.date ?? "").slice(0, 10),
      sormenjalki,
      naytteet: osumat.slice(0, 3).map((p: any) => ({
        otsikko: html2text(p?.title?.rendered ?? "").slice(0, 80),
        pvm: String(p?.date ?? "").slice(0, 10),
      })),
    })
  }

  console.log("\n=== SAMA SIVUSTO KAHDELLA TUNNUKSELLA ===")
  let loytyi = false
  for (const [, nimet] of tunnisteet) {
    if (nimet.length > 1) { console.log(`  ${nimet.join(" = ")}`); loytyi = true }
  }
  if (!loytyi) console.log("  ei paallekkaisyyksia")

  console.log("\n=== PARHAAT ===")
  for (const y of yhteenveto.filter((x) => (x.perVuosi ?? 0) >= 2).sort((a, b) => b.perVuosi - a.perVuosi)) {
    console.log(`\n  ${y.nimi} (${y.seutu}) — ${y.perVuosi} hanketiedotetta/vuosi`)
    for (const n of y.naytteet) console.log(`      ${n.pvm}  ${n.otsikko}`)
  }

  writeFileSync("C:/Users/johan/tyomaat-app/scripts/out/foundation-yield.json", JSON.stringify(yhteenveto, null, 2), "utf8")
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
