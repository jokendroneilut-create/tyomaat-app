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
 * VIALLISET YHTEYSHENKILOMERKINNAT (D-329).
 *
 * Loytyi sivutuotteena kun Fingridin yhteystietoja tarkistettiin:
 * kannassa oli ENEMMAN merkintoja kuin sivulla on henkiloita, mutta ne
 * yli jaavat eivat olleet rikkaampaa tietoa vaan roskaa --
 * "Sweco Finland" henkilona, nimike "Oy: Eero KarjalainenProjekti..."
 * ja merkinta jonka `name` on null.
 *
 * Tama ajo EI KIRJOITA MITAAN. Se laskee neljan tyypin esiintymat
 * KAIKISSA lahteissa, jotta nakee onko vika Fingridin vai yleinen.
 *
 *   npx tsx scripts/mittaa-rikki-yhteyshenkilot.ts
 *   npx tsx scripts/mittaa-rikki-yhteyshenkilot.ts --nayta 30
 */

/* Yritys ei ole henkilo. Sama lista kuin Fingridin jasentimessa. */
const YRITYS = /\b(?:Oy|Oyj|Ab|Abp|Ky|Ltd|Group|GmbH|AS|A\/S|S\.?A\.?)\b/i

/* Nimike johon on liimautunut toinen nimi tai HTML-rakenne. */
const LIIMAUTUNUT = /[a-zåäö][A-ZÅÄÖ]|:\s*[A-ZÅÄÖ][a-zåäö]+\s*[A-ZÅÄÖ]/

async function main() {
  const naytaArg = process.argv.indexOf("--nayta")
  const nayta = naytaArg > -1 ? Number(process.argv[naytaArg + 1]) : 12

  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  for (const taulu of ["projects", "potential_projects"] as const) {
    const rivit: any[] = []
    for (let a = 0; ; a += 1000) {
      const { data, error } = await db
        .from(taulu)
        .select(taulu === "projects" ? "id, name, metadata" : "id, title, metadata")
        .range(a, a + 999)
      if (error) {
        console.error(`VIRHE ${taulu}: ${error.message}`)
        process.exit(1)
      }
      rivit.push(...(data ?? []))
      if ((data ?? []).length < 1000) break
    }

    const yhteystiedoilla = rivit.filter(
      (p) => Array.isArray(p.metadata?.contact_persons) && p.metadata.contact_persons.length > 0
    )
    let merkintoja = 0
    const viat = { nimeton: 0, yritys: 0, liimautunut: 0, duplikaatti: 0 }
    const otokset: string[] = []
    const lahteittain = new Map<string, number>()

    for (const p of yhteystiedoilla) {
      const lista = p.metadata.contact_persons as any[]
      merkintoja += lista.length
      const nahdyt = new Set<string>()
      for (const c of lista) {
        const nimi = String(c?.name ?? "").trim()
        const nimike = String(c?.title ?? "").trim()
        const viallinen: string[] = []
        if (!nimi) viat.nimeton += 1, viallinen.push("nimeton")
        else if (YRITYS.test(nimi) && String(c?.kind ?? "") !== "organization")
          viat.yritys += 1, viallinen.push("yritys")
        else if (nahdyt.has(nimi.toLowerCase())) viat.duplikaatti += 1, viallinen.push("duplikaatti")
        if (nimi) nahdyt.add(nimi.toLowerCase())
        if (nimike && LIIMAUTUNUT.test(nimike)) viat.liimautunut += 1, viallinen.push("liimautunut nimike")

        if (viallinen.length) {
          const l = String(p.metadata?.source_name ?? "-")
          lahteittain.set(l, (lahteittain.get(l) ?? 0) + 1)
          if (otokset.length < nayta)
            otokset.push(
              `   [${viallinen.join("+")}] ${String(p.name ?? p.title).slice(0, 34).padEnd(36)} name=${JSON.stringify(c?.name)} title=${JSON.stringify(String(nimike).slice(0, 44))}`
            )
        }
      }
    }

    console.log(`\n=== ${taulu} ===`)
    console.log(`   rivit joilla yhteystietoja: ${yhteystiedoilla.length}, merkintoja ${merkintoja}`)
    console.log(
      `   nimeton ${viat.nimeton}, yritys henkilona ${viat.yritys}, duplikaatti ${viat.duplikaatti}, liimautunut nimike ${viat.liimautunut}`
    )
    console.log(`   lahteittain: ${[...lahteittain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${v}`).join(", ") || "-"}`)

    /*
     * NIMETON MERKINTA EI OLE AUTOMAATTISESTI ROSKAA. Puhelin tai
     * sahkoposti ilman nimea voi olla aito organisaatiokontakti
     * (kirjaamo, vaihde). Siksi lasketaan mita merkinnoissa MUUTA on.
     */
    const muoto = { tyhja: 0, vainPuhelin: 0, vainEposti: 0, molemmat: 0, lajeja: new Map<string, number>() }
    for (const p of yhteystiedoilla) {
      for (const c of p.metadata.contact_persons as any[]) {
        if (String(c?.name ?? "").trim()) continue
        const puh = Boolean(String(c?.phone ?? "").trim())
        const epo = Boolean(String(c?.email ?? "").trim())
        if (puh && epo) muoto.molemmat += 1
        else if (puh) muoto.vainPuhelin += 1
        else if (epo) muoto.vainEposti += 1
        else muoto.tyhja += 1
        const laji = String(c?.kind ?? "(ei kindia)")
        muoto.lajeja.set(laji, (muoto.lajeja.get(laji) ?? 0) + 1)
      }
    }
    console.log(
      `   NIMETTOMIEN sisalto: tyhja ${muoto.tyhja}, vain puhelin ${muoto.vainPuhelin}, vain eposti ${muoto.vainEposti}, molemmat ${muoto.molemmat}`
    )
    console.log(`   nimettomien kind: ${[...muoto.lajeja.entries()].map(([k, v]) => `${k} ${v}`).join(", ")}`)
    for (const o of otokset) console.log(o)
  }

  console.log("\nEi kirjoitettu mitaan.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
