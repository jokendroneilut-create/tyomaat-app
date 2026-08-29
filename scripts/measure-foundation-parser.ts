/*
 * KUIVAHARJOITUS: mitä poimija tekisi AYY:n koko tiedotevirralle?
 *
 * Ei kirjoita mitään. Tulostaa jokaisen tiedotteen ja sen kohtalon,
 * jotta hylkäykset ja hyväksynnät voi lukea rivi riviltä.
 */

/* Paatepiste argumenttina, jotta sama kuivaharjoitus kay kaikille. */
const API = process.argv[2] ?? "https://ayyasunnot.fi/wp-json/wp/v2/posts"
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

async function main() {
  const { parseFoundationRelease, htmlToText } = await import("../lib/agent/foundationRelease")

  const posts: any[] = []
  for (let sivu = 1; sivu <= 10; sivu++) {
    const r = await fetch(`${API}?per_page=20&page=${sivu}&orderby=date&order=desc`, {
      headers: { "User-Agent": UA },
    })
    if (!r.ok) break
    const era = await r.json()
    if (!Array.isArray(era) || !era.length) break
    posts.push(...era)
    if (era.length < 20) break
  }

  console.log(`tiedotteita: ${posts.length}\n`)

  const hyvaksytyt: any[] = []
  const syyt = new Map<string, number>()

  for (const p of posts) {
    const r = parseFoundationRelease(p?.title?.rendered, p?.content?.rendered, p?.date)
    if (r.isProject) {
      hyvaksytyt.push({ ...r, pvm: String(p.date).slice(0, 10), otsikko: htmlToText(p?.title?.rendered), url: p.link })
    } else {
      syyt.set(r.reason, (syyt.get(r.reason) ?? 0) + 1)
    }
  }

  console.log(`HYVAKSYTYT: ${hyvaksytyt.length} / ${posts.length}\n`)
  for (const h of hyvaksytyt) {
    console.log(`  ${h.pvm}  ${String(h.projectName).padEnd(22)} ${String(h.phaseHint ?? "-").padEnd(13)} ` +
      `as ${String(h.apartments ?? "-").padStart(4)}  ala ${String(h.floorArea ?? "-").padStart(6)}  ` +
      `valm ${String(h.estimatedCompletion ?? "-").padEnd(11)} urak ${h.builder ?? "-"}`)
    console.log(`      ${h.otsikko.slice(0, 92)}`)
  }

  console.log("\nHYLKAYSSYYT:")
  for (const [syy, n] of [...syyt.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${syy}`)
  }

  /* Montako eri hanketta, eli kuinka moni tiedote koskee samaa kohdetta? */
  const hankkeet = new Map<string, number>()
  for (const h of hyvaksytyt) hankkeet.set(h.projectName, (hankkeet.get(h.projectName) ?? 0) + 1)
  console.log(`\nERI HANKKEITA: ${hankkeet.size}`)
  for (const [nimi, n] of [...hankkeet.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n)} tiedotetta  ${nimi}`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
