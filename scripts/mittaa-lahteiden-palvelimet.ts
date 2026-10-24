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
 * MONTAKO LAHDETTA ON SAMALLA PALVELIMELLA?
 *
 * Johannes 24.10.2026: *"nayttaa 13 viallista."* Niista 11 kaatui
 * samaan aikakatkaisuun, ja osoitteet osoittautuivat kymmenessa
 * tapauksessa samaan /24-verkkoon. Yksi jaettu palvelin ei ole yksitoista
 * vikaa vaan yksi ([[shared-platform-fix-transfers]]).
 *
 * Tama ratkaisee nimipalvelusta, montako lahdetta kullakin osoitteella
 * on -- eli kuinka monta pyyntoa sama isanta saa yhdessa ajossa ja
 * kuinka monta rivia yksi throttle varjaa punaiseksi.
 *
 *   npx tsx scripts/mittaa-lahteiden-palvelimet.ts
 *   npx tsx scripts/mittaa-lahteiden-palvelimet.ts --vahintaan 5
 */

import { promises as dns } from "node:dns"

async function main() {
  const i = process.argv.indexOf("--vahintaan")
  const raja = i > 0 ? Number(process.argv[i + 1]) : 3

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const rivit: any[] = []
  for (let a = 0; ; a += 500) {
    const { data } = await db
      .from("discovery_sources")
      .select("name, url, enabled, last_error_at, last_success_at")
      .range(a, a + 499)
    rivit.push(...(data ?? []))
    if ((data ?? []).length < 500) break
  }

  const isannat = new Map<string, { nimi: string; url: string }[]>()
  for (const r of rivit) {
    if (!r.enabled) continue
    try {
      const host = new URL(String(r.url)).hostname
      isannat.set(host, [...(isannat.get(host) ?? []), { nimi: r.name, url: r.url }])
    } catch {
      /* osoitteeton lahde ohitetaan */
    }
  }

  console.log(`${rivit.length} lähdettä, ${isannat.size} eri verkkonimeä. Ratkaistaan...`)

  /* Nimipalvelukyselyt rinnakkain, pienissa erissa. */
  const osoitteet = new Map<string, string[]>()
  const nimet = [...isannat.keys()]
  for (let a = 0; a < nimet.length; a += 25) {
    await Promise.all(
      nimet.slice(a, a + 25).map(async (h) => {
        try {
          osoitteet.set(h, await dns.resolve4(h))
        } catch {
          osoitteet.set(h, [])
        }
      })
    )
  }

  const palvelimet = new Map<string, string[]>()
  for (const [host, ips] of osoitteet) {
    for (const ip of ips.slice(0, 1)) {
      palvelimet.set(ip, [...(palvelimet.get(ip) ?? []), host])
    }
  }

  /* Sama /24 on kaytannossa sama isanta. */
  const verkot = new Map<string, string[]>()
  for (const [ip, hostit] of palvelimet) {
    const verkko = ip.split(".").slice(0, 3).join(".") + ".0/24"
    verkot.set(verkko, [...(verkot.get(verkko) ?? []), ...hostit])
  }

  console.log(`\n=== VERKOT JOISSA VÄHINTÄÄN ${raja} LÄHDETTÄ ===`)
  for (const [verkko, hostit] of [...verkot.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (hostit.length < raja) continue
    console.log(`\n${String(hostit.length).padStart(4)} lähdettä  ${verkko}`)
    console.log(`      ${hostit.slice(0, 14).join(", ")}${hostit.length > 14 ? ` ... (+${hostit.length - 14})` : ""}`)
  }
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
