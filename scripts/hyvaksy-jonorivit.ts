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
 * JONORIVIEN JOUKKOHYVAKSYNTA.
 *
 * Kutsuu SAMAA reittia jota kayttoliittyman nappi kayttaa
 * (`/api/tic/projects/approve`), ei omaa kopiota hyvaksyntalogiikasta.
 * Reitti on 2 600 rivia ja sisaltaa geokoodauksen, tasmayksen,
 * kenttien yhdistamisen ja tapahtumakirjauksen -- toinen toteutus
 * ajautuisi erilleen ensimmaisesta korjauksesta lahtien
 * ([[same-term-two-definitions]]).
 *
 * Tunnistautuminen `CRON_SECRET`illa, jonka `verifyAdminRequest`
 * hyvaksyy.
 *
 * RIVIT JOILLA ON DUPLIKAATTIVIHJE JATETAAN POIS. Vihje tarkoittaa
 * etta samassa paikassa on jo samanlajinen hanke, eika tasmaytin ole
 * sita loytanyt -- juuri se tapaus jossa automaattinen hyvaksynta
 * tekee kaksoiskappaleen (D-365).
 *
 *   npx tsx scripts/hyvaksy-jonorivit.ts --lahde=datakeskusrekisteri
 *   npx tsx scripts/hyvaksy-jonorivit.ts --lahde=datakeskusrekisteri --apply
 */
const APPLY = process.argv.includes("--apply")
const lahdeArg = process.argv.find((a) => a.startsWith("--lahde="))
const LAHDE = lahdeArg ? lahdeArg.slice("--lahde=".length) : null
const osoiteArg = process.argv.find((a) => a.startsWith("--osoite="))
const OSOITE = osoiteArg ? osoiteArg.slice("--osoite=".length) : "http://localhost:3000"

/* Hyvaksynta tekee geokoodauksen ja tasmayksen; ei rynnata. */
const TAUKO_MS = 400

async function main() {
  if (!LAHDE) throw new Error("anna --lahde=<source_name>")
  const salaisuus = process.env.CRON_SECRET
  if (!salaisuus) throw new Error("CRON_SECRET puuttuu .env.localista")

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  /* Sivutettu luku; WHERE JSON-kenttaan on taysi taulunluku. */
  const tunnisteet: string[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,lahde:metadata->>source_name")
      .range(a, a + 999)
    if (error) throw error
    for (const r of (data ?? []) as any[]) if (r.lahde === LAHDE) tunnisteet.push(r.id)
    if ((data ?? []).length < 1000) break
  }

  const rivit: any[] = []
  for (let i = 0; i < tunnisteet.length; i += 50) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id,title,status,municipality,metadata")
      .in("id", tunnisteet.slice(i, i + 50))
    if (error) throw error
    rivit.push(...(data ?? []))
  }

  const avoimet = rivit.filter((r) => r.status === "new")
  const vihjeelliset = avoimet.filter(
    (r) => (r.metadata?.duplikaattiehdotus?.osumat ?? []).length > 0
  )
  const hyvaksyttavat = avoimet.filter(
    (r) => (r.metadata?.duplikaattiehdotus?.osumat ?? []).length === 0
  )

  console.log(`Lahteen "${LAHDE}" rivejä ${rivit.length}, avoimia ${avoimet.length}`)
  console.log(`  duplikaattivihje, jätetään käsin: ${vihjeelliset.length}`)
  for (const r of vihjeelliset) {
    const o = r.metadata.duplikaattiehdotus.osumat[0]
    console.log(`     ${r.title.slice(0, 44)}  ->  ${o.etaisyys_km} km: ${String(o.nimi).slice(0, 40)}`)
  }
  console.log(`  hyväksytään: ${hyvaksyttavat.length}\n`)

  let ok = 0
  let virheita = 0
  for (const [i, r] of hyvaksyttavat.entries()) {
    const merkki = `${String(i + 1).padStart(3)}/${hyvaksyttavat.length}`
    if (!APPLY) {
      console.log(`${merkki} (kuiva) ${r.municipality ?? "-"} · ${r.title.slice(0, 54)}`)
      continue
    }

    try {
      const vastaus = await fetch(`${OSOITE}/api/tic/projects/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${salaisuus}`,
        },
        body: JSON.stringify({ potentialProjectId: r.id }),
      })
      const tulos: any = await vastaus.json().catch(() => ({}))
      if (!vastaus.ok || !tulos?.ok) {
        virheita++
        console.log(`${merkki} VIRHE ${vastaus.status} ${tulos?.error ?? ""} · ${r.title.slice(0, 44)}`)
      } else {
        ok++
        console.log(`${merkki} ${tulos.action ?? "ok"} · ${r.title.slice(0, 50)}`)
      }
    } catch (e: any) {
      virheita++
      console.log(`${merkki} POIKKEUS ${String(e).slice(0, 50)} · ${r.title.slice(0, 40)}`)
    }

    await new Promise((r2) => setTimeout(r2, TAUKO_MS))
  }

  console.log(`\n=== ${APPLY ? "AJETTU" : "KUIVAHARJOITUS"} ===`)
  if (APPLY) console.log(`  hyväksytty ${ok}, virheitä ${virheita}`)
  console.log(`  käsin jäi ${vihjeelliset.length} duplikaattivihjeellistä`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
