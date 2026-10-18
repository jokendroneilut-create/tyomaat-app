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
 * KUINKA MONI JONORIVI SISALTAA USEAMMAN HANKKEEN?
 *
 * Johannes 18.10.2026: *"naita on tullut aiemminkin vastaan ja tulee
 * varmasti jatkossakin etta ehdotetussa hankkeessa on monta hanketta
 * sisalla jotka pitaisi poimia ja erotella omiksi hankkeikseen."*
 *
 * Mitataan ennen kuin rakennetaan: jos naita on kolme, kasin
 * erottelu riittaa; jos niita on satoja, tarvitaan tyokalu.
 *
 * EI KIRJOITA MITAAN.
 *
 *   npx tsx scripts/measure-monihankkeiset-rivit.ts
 *   npx tsx scripts/measure-monihankkeiset-rivit.ts --nayta 40
 */

/*
 * Luettelon aloittava ilmaus. Nama on luettu Joensuun rivista ja
 * tarkistettu etteivat ne osu tavalliseen tekstiin: "seuraavat
 * kohteet", "seuraavat hankkeet", "purettavaksi seuraavat".
 */
const LUETTELON_ALKU =
  /seuraav\w{0,4}\s+(?:kohte|hankke|rakennu|tila|kiinteist|urak|osa-?alue)/i

/*
 * Luettelomerkit: viiva tai numerointi rivin alussa. Dynasty-teksti
 * tulee yhtena jonona, joten merkki voi olla keskella lausetta.
 */
const LUETTELOMERKKI = /(?:^|\s)[-–•]\s+\S/g
const NUMEROITU = /(?:^|\s)\d\.\s+[A-ZÅÄÖ]/g

/* Rakennustyyppi: kertoo etta alkio on kohde eika yleinen asia. */
const KOHDESANA =
  /koulu|p[äa]iv[äa]koti|terveysasema|nuorisot|kirjasto|liikuntah|uimahal|sairaal|hoivakoti|palvelutalo|kerrostalo|rivitalo|toimitila|varikko|halli|silta|katu|tie\b|p[äa][äa]sky|asemakaava/i

async function main() {
  const nayta = Number(
    process.argv.find((a) => a.startsWith("--nayta"))?.split(/[= ]/)[1] ?? 15
  )
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("potential_projects")
      .select("id, title, status, municipality, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE: ${error.message}`)
      process.exit(1)
    }
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }
  console.log(`jonorivejä ${rivit.length}`)

  type Osuma = {
    id: string
    title: string
    status: string
    lahde: string
    merkkeja: number
    alkiot: string[]
  }
  const osumat: Osuma[] = []

  for (const r of rivit) {
    const m: any = r.metadata ?? {}
    const teksti = String(m.description ?? "")
    if (teksti.length < 150) continue

    const viivat = (teksti.match(LUETTELOMERKKI) ?? []).length
    const numerot = (teksti.match(NUMEROITU) ?? []).length
    const merkkeja = Math.max(viivat, numerot)

    const onLuettelo = LUETTELON_ALKU.test(teksti)
    /* Vaaditaan MOLEMMAT: luettelosignaali ja vahintaan kolme merkkia. */
    if (!onLuettelo || merkkeja < 3) continue

    /* Poimi alkiot nakyviin, jotta osuma voidaan tarkistaa. */
    const alkiot = [...teksti.matchAll(/[-–•]\s+([^-–•]{4,70}?)(?=\s[-–•]|\.\s|$)/g)]
      .map((x) => x[1].replace(/\s+/g, " ").trim())
      .filter((x) => KOHDESANA.test(x))
      .slice(0, 8)

    osumat.push({
      id: String(r.id),
      title: String(r.title ?? ""),
      status: String(r.status),
      lahde: String(m.source_name ?? m.source ?? "-"),
      merkkeja,
      alkiot,
    })
  }

  console.log(`\nluettelomaisia rivejä: ${osumat.length}`)
  const tiloittain = new Map<string, number>()
  const lahteittain = new Map<string, number>()
  for (const o of osumat) {
    tiloittain.set(o.status, (tiloittain.get(o.status) ?? 0) + 1)
    lahteittain.set(o.lahde, (lahteittain.get(o.lahde) ?? 0) + 1)
  }
  console.log(`  tiloittain: ${[...tiloittain].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}`)
  console.log(`  lahteittain: ${[...lahteittain].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(", ")}`)

  const kohdealkioita = osumat.filter((o) => o.alkiot.length >= 2)
  console.log(`\n  joilla vahintaan 2 tunnistettua kohdetta: ${kohdealkioita.length}`)

  console.log(`\n--- otos (${Math.min(nayta, kohdealkioita.length)}) ---`)
  for (const o of kohdealkioita.slice(0, nayta)) {
    console.log(`\n${o.status.padEnd(9)} ${o.lahde.padEnd(20)} ${o.title.slice(0, 54)}`)
    for (const a of o.alkiot) console.log(`     - ${a.slice(0, 72)}`)
  }
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
