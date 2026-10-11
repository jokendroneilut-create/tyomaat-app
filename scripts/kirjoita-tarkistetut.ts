import { readFileSync } from "node:fs"

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .replace(/\r/g, "")
  .split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * JOHANNEKSEN TARKISTAMAT OSUMAT KANTAAN (D-273).
 *
 * `etsi-lahde-verkosta.ts` kirjoitti vain varmat (otsikko toistaa
 * hankkeen nimen). Loput 53 menivat tarkistuslistalle, ja Johannes
 * merkitsi niista vaarat. Tama kirjoittaa hyvaksytyt.
 *
 * Teksti haetaan uudelleen samasta osoitteesta eika listalta, koska
 * listalla se on katkaistu 240 merkkiin.
 *
 * EI POISTA MITAAN: vanha merkinta sailyy uuden perassa, kuten
 * D-272:ssa. Yhdellatoista aiemmalla rivilla siina oli tyonjohtajan
 * nimi ja puhelinnumero.
 *
 *   npx tsx scripts/kirjoita-tarkistetut.ts <lista.md>
 *   npx tsx scripts/kirjoita-tarkistetut.ts <lista.md> --apply
 */

/* Johannes 12.10.2026: vaarat ja epavarmat pois. */
const HYLATYT = new Set([2, 3, 4, 5, 6, 9, 17, 18, 19, 23, 38])

async function main() {
  const lista = process.argv[2]
  const apply = process.argv.includes("--apply")
  if (!lista || lista.startsWith("--")) {
    console.log("Anna listatiedosto: npx tsx scripts/kirjoita-tarkistetut.ts <lista.md>")
    process.exit(1)
  }

  const { createClient } = await import("@supabase/supabase-js")
  const { kuvausSivusta, normalisoi } = await import("../lib/agent/sivunKuvaus")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  /* Lista: "## N. Nimi  [Kunta]" ja sita seuraava <url>. */
  const rivit = readFileSync(lista, "utf8").replace(/\r/g, "").split("\n")
  type Kohta = { numero: number; nimi: string; kunta: string; url: string }
  const kohdat: Kohta[] = []
  for (let i = 0; i < rivit.length; i++) {
    const otsikko = rivit[i].match(/^## (\d+)\.\s+(.*?)\s*\[([^\]]+)\]\s*$/)
    if (!otsikko) continue
    const url = (rivit.slice(i + 1, i + 8).find((x) => /^<https?:\/\//.test(x)) ?? "")
      .replace(/^<|>$/g, "")
      .trim()
    if (!url) continue
    kohdat.push({
      numero: Number(otsikko[1]),
      nimi: otsikko[2].trim(),
      kunta: otsikko[3].trim(),
      url,
    })
  }

  const hyvaksytyt = kohdat.filter((k) => !HYLATYT.has(k.numero))
  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(
    `listalla ${kohdat.length}, hylattyja ${kohdat.length - hyvaksytyt.length}, kirjoitetaan ${hyvaksytyt.length}\n`
  )

  /* Hankkeet kerran muistiin. */
  const hankkeet: any[] = []
  for (let f = 0; f < 60000; f += 500) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, additional_info, metadata")
      .range(f, f + 499)
    if (error) throw error
    if (!data?.length) break
    hankkeet.push(...data)
    if (data.length < 500) break
  }

  let tehty = 0
  const ongelmat: string[] = []

  for (const k of hyvaksytyt) {
    /* Nimi on listalla katkaistu 56 merkkiin, joten alkuosa + kunta. */
    const osumat = hankkeet.filter(
      (h) =>
        String(h.city ?? "") === k.kunta &&
        String(h.name ?? "").startsWith(k.nimi.slice(0, Math.min(k.nimi.length, 40)))
    )
    if (osumat.length !== 1) {
      ongelmat.push(`  ${k.numero}. ${k.nimi} [${k.kunta}]: ${osumat.length} hankeosumaa`)
      continue
    }
    const r = osumat[0]

    let teksti: string | null = null
    try {
      const ohjain = new AbortController()
      const kello = setTimeout(() => ohjain.abort(), 20000)
      const vastaus = await fetch(k.url, {
        headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
        signal: ohjain.signal,
      })
      clearTimeout(kello)
      if (vastaus.ok) teksti = kuvausSivusta(await vastaus.text())
    } catch {
      /* alla */
    }
    await new Promise((res) => setTimeout(res, 400))

    if (!teksti) {
      ongelmat.push(`  ${k.numero}. ${k.nimi}: sivulta ei saatu tekstia`)
      continue
    }

    const nykyinen = String(r.additional_info ?? "").trim()
    const pelkkaNimi = normalisoi(nykyinen) === normalisoi(String(r.name ?? ""))
    const sisaltyy =
      !nykyinen || pelkkaNimi || normalisoi(teksti).includes(normalisoi(nykyinen))
    const uusi = sisaltyy ? teksti : `${teksti}\n\nAiempi merkintä: ${nykyinen}`

    tehty += 1
    console.log(
      `  ${String(k.numero).padStart(2)}. ${k.nimi.slice(0, 44).padEnd(46)} ${nykyinen.length} -> ${uusi.length}${sisaltyy ? "" : "  (aiempi säilytetty)"}`
    )

    if (!apply) continue

    const { error } = await db
      .from("projects")
      .update({
        additional_info: uusi,
        metadata: {
          ...(r.metadata ?? {}),
          description: uusi,
          source_url: k.url,
          source_found_by: "duckduckgo",
          source_checked_by: "johannes",
          description_from_url_at: new Date().toISOString(),
        },
      })
      .eq("id", r.id)
    if (error) console.log(`      VIRHE: ${error.message}`)
  }

  console.log(`\nkirjoitettavia ${tehty} / ${hyvaksytyt.length}`)
  if (ongelmat.length) {
    console.log("ongelmat:")
    ongelmat.forEach((o) => console.log(o))
  }
  if (!apply) console.log("\nEi muutettu mitaan. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
