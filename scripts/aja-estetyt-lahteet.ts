import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * ESTETYT LÄHTEET SUOMALAISESTA IP:STÄ (D-399).
 *
 * Kolme lähdettä epäonnistuu tuotannossa mutta vastaa normaalisti
 * Suomesta (mitattu 8.11.2026):
 *
 *   Väylävirasto hankkeet      403 Forbidden    vs. HTTP 200, 2,7 s
 *   Tuusniemen kaavoitus       connect timeout  vs. HTTP 200, 0,4 s
 *   Kuopion vireillä olevat    connect timeout  vs. HTTP 200, 0,6 s
 *
 * Kaikki kolme ovat IPv4-only suomalaisilla palvelimilla, ja saman
 * kaupungin pilvi-isännöity lähde toimii tuotannosta. Palvelin siis
 * pudottaa pyynnöt ulkomaiselta pilvi-IP:ltä
 * ([[finnish-host-blocks-cloud]]).
 *
 * ESTOA EI KIERRETÄ TUNNISTETTA VAIHTAMALLA. Tämä ajo tekee saman
 * pyynnön samalla koodilla, vain eri paikasta — omalta koneelta, jonka
 * IP on suomalainen.
 *
 * SAMA KOODIPOLKU KUIN TUOTANNOSSA: `runSourceWorker(sourceId)` on se
 * sama funktio jota cron kutsuu, joten sääntö ei pääse eriytymään
 * kahdeksi kopioksi. Ajo kirjoittaa `discovery_runs`-rivin ja päivittää
 * lähteen tilan kuten tuotannossakin, eli `last_success_at` kertoo
 * jälkikäteen milloin tämä viimeksi ajettiin.
 *
 * TAHTI: nämä lähteet muuttuvat hitaasti (kaavalistat, hankesivut),
 * joten kerran viikossa riittää. Jos ajo unohtuu, se näkyy lähteen
 * omasta tilasta eikä mitään vanhene väärin — vanhenemissääntö vaatii
 * terveen lähteen ja toipumisajan (D-397).
 *
 *   npx tsx scripts/aja-estetyt-lahteet.ts --lista
 *   npx tsx scripts/aja-estetyt-lahteet.ts
 *   npx tsx scripts/aja-estetyt-lahteet.ts Väylä
 */
const ESTETYT = [
  "Väylävirasto hankkeet",
  "Kuopion vireillä olevat kaavat",
  "Tuusniemen kaavoitus",
]

const argv = process.argv.slice(2)
const VAIN_LISTA = argv.includes("--lista")
const RAJAUS = argv.filter((a) => !a.startsWith("--"))

const vrk = (t: string | null | undefined) =>
  t ? ((Date.now() - new Date(t).getTime()) / 86400000).toFixed(1) : "-"

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { runSourceWorker } = await import("../lib/agent/workers/sourceWorker")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })

  const nimet = RAJAUS.length
    ? ESTETYT.filter((n) => RAJAUS.some((r) => n.toLowerCase().includes(r.toLowerCase())))
    : ESTETYT

  const { data, error } = await db
    .from("discovery_sources")
    .select("id,name,url,enabled,last_success_at,last_error_at,last_error_message")
    .in("name", nimet)
  if (error) throw error

  console.log(`Estetyt lähteet (${(data ?? []).length}/${nimet.length} löytyi):\n`)
  for (const s of (data ?? []) as any[]) {
    console.log(`  ${String(s.name).padEnd(32)} ${s.enabled ? "käytössä" : "POIS"}  onnistui ${vrk(s.last_success_at).padStart(5)} vrk sitten`)
    console.log(`     ${String(s.url).slice(0, 110)}`)
    if (s.last_error_message) console.log(`     viim. virhe: ${String(s.last_error_message).slice(0, 100)}`)
  }

  if (VAIN_LISTA) {
    console.log("\n=== VAIN LISTA, EI AJETTU ===")
    return
  }

  console.log("\nAjetaan...\n")
  for (const s of (data ?? []) as any[]) {
    if (!s.enabled) {
      console.log(`  OHITETAAN ${s.name}: lähde ei ole käytössä`)
      continue
    }
    const alku = Date.now()
    try {
      const tulos: any = await runSourceWorker(String(s.id))
      const kesto = ((Date.now() - alku) / 1000).toFixed(1)
      if (tulos?.ok) {
        const r = tulos.result ?? {}
        console.log(`  OK     ${String(s.name).padEnd(32)} ${kesto.padStart(6)} s  löytyi ${r.documentsFound ?? "?"}, tallennettu ${r.documentsSaved ?? "?"}`)
      } else {
        console.log(`  VIRHE  ${String(s.name).padEnd(32)} ${kesto.padStart(6)} s  ${String(tulos?.error ?? "tuntematon").slice(0, 90)}`)
      }
    } catch (e: any) {
      console.log(`  KAATUI ${String(s.name).padEnd(32)} ${((Date.now() - alku) / 1000).toFixed(1)} s  ${String(e?.message).slice(0, 90)}`)
    }
  }

  /* Tila ajon jälkeen: onnistuiko oikeasti. */
  const { data: jalkeen } = await db
    .from("discovery_sources")
    .select("name,last_success_at,last_error_at,last_error_message")
    .in("name", nimet)
  console.log("\nTila ajon jälkeen:")
  for (const s of (jalkeen ?? []) as any[]) {
    console.log(`  ${String(s.name).padEnd(32)} onnistui ${vrk(s.last_success_at).padStart(5)} vrk sitten, virhe ${vrk(s.last_error_at).padStart(5)} vrk sitten`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
