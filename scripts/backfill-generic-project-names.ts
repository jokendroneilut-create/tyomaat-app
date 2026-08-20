import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * YHDEN SANAN HANKENIMET TAYDENNETAAN KAUPUNGILLA.
 *
 * Kasin luoduissa hankkeissa on nimia kuten "Datakeskus", "Toimitila" ja
 * "Kerrostalo". Ne eivat kerro asiakkaalle mitaan - listassa on seitseman
 * rivia nimelta "Datakeskus" - eivatka ne erota hankkeita toisistaan
 * tasmaytyksessa: mitattu 21.8.2026, geneerinen nimi + kaupunki + lomake-
 * kuvaus tuotti 75 pistetta kahteen eri taloon.
 *
 * RAJATTU KASIN TEHTYIHIN. Lahteesta tulleisiin ei kosketa: kaavalahteiden
 * lyhyet nimet ("Puijonsarvi", "Kytola") ovat kaavan virallisia nimia ja
 * siksi oikein. Mitattu: 202 yhden sanan nimesta 168 on kaavalahteista.
 *
 * ALUENIMI ENSIN, KAUPUNKI VARALLA. Pelkka kaupunki ei riita: mitattu
 * kuivaharjoituksessa, kolme "Kerrostalo"-rivia Helsingissa olisi saanut
 * kaikki saman nimen "Kerrostalo, Helsinki" - eli tasan sama ongelma kuin
 * ennen. Ne ovat Verkkosaaressa, Oulunkylassa ja Nihdissa, joten aluenimi
 * erottaa ne.
 *
 * Katuosoitetta ei kayteta nimessa: "Liikuntasali, Lukiokatu 10" on
 * huonompi kuin "Liikuntasali, Porvoo". Numero erottaa katuosoitteen
 * aluenimesta luotettavasti.
 *
 * VANHA NIMI SAILYY also_known_as-kentassa, jotta duplikaattitasmaytys
 * loytaa hankkeen edelleen vanhalla nimella.
 *
 * Aja ensin ilman --apply-lippua ja lue tuotos riveittain.
 */

const APPLY = process.argv.includes("--apply")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const projects: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("projects")
      .select("id,name,city,location,is_public,metadata")
      .range(from, from + 999)
    if (error) throw error
    projects.push(...(data ?? []))
    if (!data || data.length < 1000) break
  }

  const targets = projects.filter((p) => {
    if (!p.is_public) return false
    if (p.metadata?.source_name) return false

    const name = String(p.name ?? "").trim()
    if (!name || name.split(/\s+/).length !== 1) return false

    const city = String(p.city ?? "").trim()
    if (!city) return false

    /* Nimi on jo kaupunki - lisays toistaisi sen. */
    if (name.toLowerCase() === city.toLowerCase()) return false

    return true
  })

  /*
   * Tarkenne: sijainnin ensimmainen osa jos se on aluenimi (ei numeroa
   * eika sama kuin kaupunki), muuten kaupunki.
   */
  const tarkenne = (p: any): string => {
    const city = String(p.city ?? "").trim()
    const first = String(p.location ?? "").split(",")[0].trim()

    if (first && !/\d/.test(first) && first.toLowerCase() !== city.toLowerCase()) {
      return first
    }
    return city
  }

  const nimet = new Map<string, string[]>()
  for (const p of targets) {
    const uusi = `${String(p.name).trim()}, ${tarkenne(p)}`
    nimet.set(uusi, [...(nimet.get(uusi) ?? []), String(p.id)])
  }

  /* Olemassa olevat nimet mukaan, jottei uusi nimi tormaa vanhaan. */
  const kaytossa = new Set(projects.map((p) => String(p.name ?? "").trim().toLowerCase()))

  console.log(APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS (ei kirjoiteta) ===")
  console.log(`hankkeita:               ${projects.length}`)
  console.log(`nimettavia:              ${targets.length}\n`)

  const tormaykset = [...nimet.entries()].filter(([, ids]) => ids.length > 1)
  if (tormaykset.length) {
    console.log("HUOM - uusi nimi tulisi usealle riville:")
    for (const [n, ids] of tormaykset) console.log(`  ${n}  (${ids.length} rivia)`)
    console.log("")
  }

  for (const p of targets) {
    const uusi = `${String(p.name).trim()}, ${tarkenne(p)}`
    const varoitus = kaytossa.has(uusi.toLowerCase()) ? "  <- nimi jo kaytossa" : ""
    console.log(`  ${String(p.name).slice(0, 22).padEnd(24)} -> ${uusi.padEnd(44)} ${String(p.location ?? "-").slice(0, 30)}${varoitus}`)

    if (!APPLY) continue

    const alsoKnownAs = new Set<string>(p.metadata?.also_known_as ?? [])
    alsoKnownAs.add(String(p.name).trim())


    await supabase
      .from("projects")
      .update({
        name: uusi,
        metadata: {
          ...(p.metadata ?? {}),
          also_known_as: Array.from(alsoKnownAs),
          name_completed_from_city_at: new Date().toISOString(),
        },
      })
      .eq("id", p.id)
  }

  console.log(`\nyhteensa: ${targets.length}`)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
