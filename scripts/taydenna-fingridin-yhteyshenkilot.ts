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
 * FINGRIDIN YHTEYSHENKILOT KANTAAN (D-329).
 *
 * Jasennin osasi vain yhden kolmesta lohkomuodosta, joten osa sivuista
 * jai kokonaan ilman yhteystietoja. Muodot B ja C on nyt lisatty, ja
 * tama ajo kirjoittaa loydot olemassa oleville riveille.
 *
 * VAIN LISATAAN, EI POISTETA. Kannassa on merkintoja joita sivulla ei
 * enaa ole: sivu on voinut muuttua, tai Johannes on lisannyt
 * yhteyshenkilon kasin ([[manual-parties-linkedin]]). Taydennys
 * vertailee nimella eika koske mihinkaan olemassa olevaan.
 *
 * Kannassa on myos virheellisia merkintoja (yritys henkilona,
 * liimautunut nimike). Niita EI siivota tassa: siivous on poistoa, ja
 * se on oma paatos omalla ajollaan.
 *
 *   npx tsx scripts/taydenna-fingridin-yhteyshenkilot.ts
 *   npx tsx scripts/taydenna-fingridin-yhteyshenkilot.ts --apply
 */

import { jasennaYhteyshenkilot } from "../lib/agent/fetchFingridProjectsSource"

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
const LAHDE = "fingrid_hankkeet"

async function hae(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: "no-store", headers: { "user-agent": UA } })
    if (!r.ok) return null
    return await r.text()
  } catch {
    return null
  }
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* Sama sivu voi palvella monta rivia: haetaan kerran per osoite. */
  const sivut = new Map<string, Awaited<ReturnType<typeof jasennaYhteyshenkilot>> | null>()
  let lisattyYht = 0
  let rivejaMuutettu = 0

  for (const taulu of ["projects", "potential_projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db
        .from(taulu)
        .select(taulu === "projects" ? "id, name, metadata" : "id, title, status, metadata")
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }

    const kohteet = rivit.filter(
      (p) => String(p.metadata?.source_name ?? "") === LAHDE && String(p.metadata?.source_url ?? "")
    )
    console.log(`\n=== ${taulu}: ${kohteet.length} Fingrid-rivia ===\n`)

    for (const p of kohteet) {
      const url = String(p.metadata.source_url)
      if (!sivut.has(url)) {
        const html = await hae(url)
        sivut.set(url, html ? jasennaYhteyshenkilot(html) : null)
      }
      const sivulta = sivut.get(url)
      if (!sivulta) {
        console.log(`   HAKU EI VASTANNUT  ${String(p.name ?? p.title).slice(0, 44)}`)
        continue
      }

      const vanhat = Array.isArray(p.metadata?.contact_persons) ? (p.metadata.contact_persons as any[]) : []
      const onJo = new Set(vanhat.map((c) => String(c?.name ?? "").trim().toLowerCase()).filter(Boolean))

      const uudet = sivulta
        .filter((h) => !onJo.has(h.nimi.toLowerCase()))
        .map((h) => ({
          kind: "person" as const,
          name: h.nimi,
          title: h.nimike,
          /* Ks. jasennaYhteyshenkilot: osoitetta ei paatella. */
          email: null,
          phone: h.puhelin,
          organization: h.organisaatio,
        }))

      if (!uudet.length) continue

      console.log(
        `   +${String(uudet.length).padStart(2)} (oli ${String(vanhat.length).padStart(2)})  ${String(p.name ?? p.title).slice(0, 42).padEnd(44)} ${uudet.map((u) => u.name).join(", ").slice(0, 70)}`
      )
      lisattyYht += uudet.length
      rivejaMuutettu += 1

      if (!apply) continue

      const md: Record<string, any> = { ...(p.metadata ?? {}) }
      md.contact_persons = [...vanhat, ...uudet]
      md.yhteyshenkilot_taydennetty = {
        lisatty: uudet.map((u) => u.name),
        jasennin: "jasennaYhteyshenkilot",
        milloin: new Date().toISOString().slice(0, 10),
      }
      const { error } = await db.from(taulu).update({ metadata: md }).eq("id", p.id)
      if (error) console.error(`      VIRHE: ${error.message}`)
    }
  }

  console.log(`\nLisattavia yhteyshenkiloita ${lisattyYht} yhteensa ${rivejaMuutettu} rivilla`)
  if (!apply) console.log("Ei kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
