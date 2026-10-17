import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * FINGRIDIN YHTEYSHENKILOT VANHOILLE RIVEILLE (D-302).
 *
 * Johannes 18.10.2026 Anttila-Lansisalmi-hankkeesta: *"ei ole poimittu
 * yhteyshenkiloita vaikka ne ovat saatavilla."* Poimija lisattiin
 * samana paivana, mutta se vaikuttaa vain uusiin riveihin.
 *
 * KASIN LISATTYA EI YLIKIRJOITETA. Jos rivilla on jo yhteyshenkiloita,
 * se ohitetaan: lahteesta puuttuva ei tarkoita etta kasin lisatty olisi
 * vaarin.
 *
 * Henkilot haetaan rivin OMALTA lahdesivulta (`metadata.source_url`),
 * ei nimen perusteella arvaamalla.
 *
 *   npx tsx scripts/taydenna-fingrid-yhteyshenkilot.ts
 *   npx tsx scripts/taydenna-fingrid-yhteyshenkilot.ts --apply
 */

const UA = "Mozilla/5.0 (compatible; tyomaat.fi/1.0)"

/*
 * NIMETON KUORI EI OLE YHTEYSTIETO.
 *
 * Harviala-Hangasmaen rivi ohitettiin ensimmaisessa ajossa, koska
 * `contact_persons` ei ollut tyhja vaan sisalsi taman:
 *
 *     [{ kind: "organization", name: null, email: "", phone: "030 395 5356",
 *        title: null, organization: "fingrid" }]
 *
 * Nimeton ja sahkopostiton rivi ei kerro kenelle soitetaan, joten se ei
 * saa estaa oikeiden henkiloiden kirjaamista. Kasin lisatty NIMETTY
 * yhteystieto suojaa rivin yha.
 */
function onJoYhteyshenkiloita(arvo: unknown): boolean {
  if (!Array.isArray(arvo)) return false
  return arvo.some((x: any) => String(x?.name ?? "").trim() || String(x?.email ?? "").trim())
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { jasennaYhteyshenkilot } = await import("../lib/agent/fetchFingridProjectsSource")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kaikki = async (t: string, cols: string) => {
    const out: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db.from(t).select(cols).range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${t}: ${error.message}`)
        process.exit(1)
      }
      out.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }
    return out
  }

  const jono = await kaikki("potential_projects", "id, title, status, metadata")
  const hankkeet = await kaikki("projects", "id, name, status, metadata")

  type Rivi = { taulu: "jono" | "hanke"; id: string; otsikko: string; url: string; metadata: any }
  const rivit: Rivi[] = []

  const onFingrid = (m: any) =>
    String(m?.source_name ?? m?.source ?? "") === "fingrid_hankkeet"

  for (const r of jono) {
    const m: any = r.metadata ?? {}
    if (!onFingrid(m)) continue
    const url = String(m.source_url ?? "")
    if (!/^https?:\/\/www\.fingrid\.fi\//.test(url)) continue
    if (onJoYhteyshenkiloita(m.contact_persons)) continue
    rivit.push({ taulu: "jono", id: String(r.id), otsikko: String(r.title ?? ""), url, metadata: m })
  }
  for (const p of hankkeet) {
    const m: any = p.metadata ?? {}
    if (!onFingrid(m)) continue
    const url = String(m.source_url ?? "")
    if (!/^https?:\/\/www\.fingrid\.fi\//.test(url)) continue
    if (onJoYhteyshenkiloita(m.contact_persons)) continue
    rivit.push({ taulu: "hanke", id: String(p.id), otsikko: String(p.name ?? ""), url, metadata: m })
  }

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")
  console.log(`Fingrid-rivejä ilman yhteyshenkilöitä: ${rivit.length}`)
  console.log(`  jono ${rivit.filter((r) => r.taulu === "jono").length}, hankkeet ${rivit.filter((r) => r.taulu === "hanke").length}\n`)

  /* Sivu haetaan kertaalleen per osoite, ei kertaalleen per rivi. */
  const sivut = new Map<string, any[]>()
  for (const url of new Set(rivit.map((r) => r.url))) {
    try {
      const vastaus = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
      if (!vastaus.ok) {
        console.log(`  HTTP ${vastaus.status}  ${url}`)
        sivut.set(url, [])
        continue
      }
      sivut.set(url, jasennaYhteyshenkilot(await vastaus.text()))
    } catch (e: any) {
      console.log(`  VIRHE ${e?.message ?? e}  ${url}`)
      sivut.set(url, [])
    }
  }

  const tyhjat = rivit.filter((r) => !(sivut.get(r.url) ?? []).length)
  const taytettavat = rivit.filter((r) => (sivut.get(r.url) ?? []).length)
  console.log(`\nsivulta ei löytynyt henkilöitä: ${tyhjat.length}`)
  for (const r of tyhjat) console.log(`   ${r.otsikko.slice(0, 60)}`)

  console.log(`\nTÄYDENNETÄÄN: ${taytettavat.length} riviä\n`)
  for (const r of taytettavat) {
    const h = sivut.get(r.url) ?? []
    console.log("".padEnd(74, "-"))
    console.log(`${r.taulu}  ${r.id}  ${r.otsikko.slice(0, 50)}`)
    for (const x of h) {
      console.log(`   ${x.nimi.padEnd(22)} | ${String(x.nimike ?? "-").slice(0, 42).padEnd(44)} | ${x.puhelin ?? "-"}`)
    }
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  let tehty = 0
  for (const r of taytettavat) {
    const h = sivut.get(r.url) ?? []
    const contact_persons = h.map((x) => ({
      kind: "person" as const,
      name: x.nimi,
      title: x.nimike,
      /* Sahkopostia ei paatella, ks. jasennaYhteyshenkilot. */
      email: null,
      phone: x.puhelin,
      organization: x.organisaatio,
    }))
    const taulu = r.taulu === "hanke" ? "projects" : "potential_projects"
    const { error } = await db
      .from(taulu)
      .update({ metadata: { ...(r.metadata ?? {}), contact_persons } })
      .eq("id", r.id)
    if (error) {
      console.error(`VIRHE ${taulu} ${r.id}: ${error.message}`)
      continue
    }
    tehty++
  }
  console.log(`\nTÄYDENNETTY ${tehty} riviä.`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
