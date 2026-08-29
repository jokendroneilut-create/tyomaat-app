import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * KUIVAHARJOITUS: mitka hankkeet vanhenisivat koska niita ei enaa ole
 * lahteen listalla.
 *
 * Ajaa saman koodin kuin cron mutta ei kirjoita koskaan. Tama on se ajo
 * joka luetaan riveittain ennen kuin UNLISTED_EXPIRY_ENABLED kytketaan
 * paalle.
 *
 *   npx tsx scripts/dry-run-unlisted-expiry.ts
 */
async function main() {
  const { GET } = await import("../app/api/admin/expire-unlisted-projects/route")
  const salaisuus = encodeURIComponent(process.env.CRON_SECRET ?? "")
  const res: any = await GET(
    new Request(`http://localhost/api/admin/expire-unlisted-projects?dry=1&secret=${salaisuus}`)
  )
  const tulos: any = await res.json()

  if (!tulos.ok) { console.error("VIRHE:", JSON.stringify(tulos)); process.exit(1) }

  console.log(`kytkin                 ${tulos.kytkin}`)
  console.log(`kynnys                 ${tulos.kynnysVrk} vrk`)
  console.log(`vanhoja dokumentteja   ${tulos.vanhojaDokumentteja}`)
  console.log(`vanhennettavia         ${tulos.vanhennettavia}`)
  console.log(`palautettavia          ${tulos.palautettavia}\n`)

  if (!tulos.otos?.length) { console.log("Ei yhtaan paatosta."); return }

  for (const r of tulos.otos) {
    console.log(`${String(r.paatos).padEnd(8)} ${String(r.vaihe).padEnd(14)} nahty ${String(r.nahtyViimeksi).slice(0, 10)}  ${String(r.nimi).slice(0, 52)}`)
  }
  if (tulos.vanhennettavia + tulos.palautettavia > tulos.otos.length) {
    console.log(`\n(naytetaan ${tulos.otos.length} ensimmaista)`)
  }
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
export {}
