/*
 * MONTAKO ERI HANKETTA, EI MONTAKO TIEDOTETTA.
 *
 * Aiempi mittaus laski tiedotteita ja antoi AYY:lle 6,9 vuodessa.
 * Tiukka poimija luki AYY:n koko 16 kuukauden arkiston ja löysi
 * YHDEN hankkeen viidessä tiedotteessa. Kaikki 47 otsikkoa luettiin
 * läpi: vääriä hylkäyksiä ei ollut, arkistossa ei vain ole muita
 * hankkeita.
 *
 * Tiedotemäärä on siis väärä mittari. Sama hanke tuottaa monta
 * tiedotetta (ensihaku, harjannostajaiset, valmistuminen), ja
 * asukasviestintä hallitsee virtaa.
 *
 * Tämä ajo laskee ERI HANKKEET jokaisesta lähteestä samalla tiukalla
 * logiikalla kuin AYY:n poimija. Luku ratkaisee kannattaako lähteitä
 * lisätä.
 */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) tyomaat.fi-lahdekartoitus"

const LAHTEET = [
  { nimi: "HOAS", domain: "www.hoas.fi", base: "posts" },
  { nimi: "TYS", domain: "www.tys.fi", base: "posts" },
  { nimi: "PSOAS", domain: "www.psoas.fi", base: "posts" },
  { nimi: "KOAS", domain: "www.koas.fi", base: "news" },
  { nimi: "POAS", domain: "poas.fi", base: "posts" },
  { nimi: "Kuopas", domain: "www.kuopas.fi", base: "posts" },
  { nimi: "VOAS", domain: "www.voas.fi", base: "posts" },
  { nimi: "AYY Asunnot", domain: "ayyasunnot.fi", base: "posts" },
  { nimi: "Sevas", domain: "sevas.fi", base: "posts" },
  { nimi: "Lahden Talot", domain: "www.lahdentalot.fi", base: "posts" },
  { nimi: "Kajaanin Pietari", domain: "www.kajaaninpietari.fi", base: "posts" },
  { nimi: "Savonlinnan Asuntopalvelu", domain: "savonlinnanasuntopalvelu.fi", base: "posts" },
  { nimi: "Soihtu (JYY)", domain: "soihtu.fi", base: "posts" },
  { nimi: "Joensuun Elli", domain: "www.joensuunelli.fi", base: "posts" },
]

async function main() {
  const { parseFoundationRelease } = await import("../lib/agent/foundationRelease")

  for (const l of LAHTEET) {
    const posts: any[] = []
    /* TYS palauttaa vajaan JSONin isolla sivukoolla, siksi 20. */
    for (let sivu = 1; sivu <= 10; sivu++) {
      try {
        const r = await fetch(
          `https://${l.domain}/wp-json/wp/v2/${l.base}?per_page=20&page=${sivu}&orderby=date&order=desc`,
          { headers: { "User-Agent": UA } }
        )
        if (!r.ok) break
        const era = await r.json()
        if (!Array.isArray(era) || !era.length) break
        posts.push(...era)
        if (era.length < 20) break
      } catch { break }
    }

    if (!posts.length) { console.log(`${l.nimi.padEnd(26)} otosta ei saatu`); continue }

    const hankkeet = new Map<string, { n: number; urakoitsija: string | null; vaihe: string | null }>()
    let hyvaksytyt = 0

    for (const p of posts) {
      const r = parseFoundationRelease(p?.title?.rendered, p?.content?.rendered)
      if (!r.isProject || !r.projectName) continue
      hyvaksytyt++
      const nykyinen = hankkeet.get(r.projectName) ?? { n: 0, urakoitsija: null, vaihe: null }
      hankkeet.set(r.projectName, {
        n: nykyinen.n + 1,
        urakoitsija: nykyinen.urakoitsija ?? r.builder,
        vaihe: nykyinen.vaihe ?? r.phaseHint,
      })
    }

    const pvmt = posts.map((p) => String(p.date).slice(0, 10)).sort()
    const kuukausia =
      (new Date(pvmt[pvmt.length - 1]).getTime() - new Date(pvmt[0]).getTime()) / (30.44 * 86400000)

    console.log(
      `${l.nimi.padEnd(26)} ${String(posts.length).padStart(4)} tiedotetta  ` +
      `${String(hyvaksytyt).padStart(3)} osumaa  ${String(hankkeet.size).padStart(3)} ERI HANKETTA  ` +
      `${kuukausia > 1 ? (hankkeet.size / (kuukausia / 12)).toFixed(1) : "-"} /vuosi  ` +
      `(${pvmt[0]} .. ${pvmt[pvmt.length - 1]})`
    )

    for (const [nimi, tiedot] of [...hankkeet.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 6)) {
      console.log(`      ${nimi.padEnd(30)} ${tiedot.n} tiedotetta  ${tiedot.vaihe ?? "-"}  ${tiedot.urakoitsija ?? ""}`)
    }
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
