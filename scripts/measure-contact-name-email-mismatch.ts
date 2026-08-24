import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: onko yhteyshenkilon nimeen liitetty VAARA sahkoposti?
 *
 * Havainto: Johanna Backas esiintyy yhdeksassa Raaseporin hankkeessa,
 * ja niissa on viisi eri osoitetta - mukana niclas.skog@raasepori.fi
 * (toinen henkilo) ja pasi.lappainen@nostoconsulting.fi (eri yritys).
 * Poimija ottaa ilmeisesti lahimman osoitteen sivulta, ja monen
 * henkilon listalla se osuu vaaraan.
 *
 * TAMA ON VAKAVAMPI KUIN PUUTTUVA TIETO. Asiakas voi lahettaa
 * tarjouksen vaaralle henkilolle, ja virhe nakyy ulospain meista.
 *
 * MITTAUSTAPA. Vain osoitteet muotoa etunimi.sukunimi@ voidaan
 * tarkistaa - muut (kirjaamo@, j.virtanen@) ohitetaan, koska niista ei
 * voi paatella mitaan. Vertailu on siis ALARAJA, ei kokonaisluku.
 *
 * Ei kirjoita mitaan.
 */

const poista = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
const nrm = (s: unknown) => poista(String(s ?? "").trim().toLowerCase()).replace(/[^a-z ]/g, "").replace(/\s+/g, " ")

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const lataa = async (t: string, s: string) => {
    const r: any[] = []
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from(t).select(s).range(f, f + 999)
      if (error) throw error
      r.push(...(data ?? [])); if (!data || data.length < 1000) break
    }
    return r
  }

  const rivit = [
    ...(await lataa("projects", "id,name,metadata")).map((p: any) => ({ ...p, nimi: p.name, taulu: "projects" })),
    ...(await lataa("potential_projects", "id,title,metadata")).map((p: any) => ({ ...p, nimi: p.title, taulu: "potential_projects" })),
  ]

  let tarkistettavia = 0, tasmaa = 0, eiTasmaa = 0
  const luokat: Record<string, number> = { "VAARA PARI": 0, roskanimi: 0, malliosoite: 0 }
  const lahteittain = new Map<string, number>()
  const naytteet: string[] = []

  for (const p of rivit) {
    for (const c of (p.metadata?.contact_persons ?? []) as any[]) {
      const nimi = nrm(c?.name)
      const email = String(c?.email ?? "").trim().toLowerCase()
      if (!nimi || !email.includes("@")) continue

      const local = poista(email.split("@")[0])
      /* Vain etunimi.sukunimi-muoto on tarkistettavissa. */
      /* Valiviivat pois molemmilta puolilta: "Niilo-Rama" vs "niilo-rama". */
      const osat = local.split(".").map((o) => o.replace(/[^a-z]/g, ""))
      if (osat.length !== 2 || osat[0].length < 3 || osat[1].length < 3) continue

      tarkistettavia++
      const nimenOsat = nimi.split(" ")
      const osuu = osat.some((o) => nimenOsat.some((n) => n.length > 2 && (n.startsWith(o) || o.startsWith(n))))

      if (osuu) { tasmaa++; continue }
      eiTasmaa++
      /*
       * Kolme eri vikaa, ja vain yksi niista on vaarallinen:
       *   ROSKANIMI  - "322 8927", "Kaavasuunnittelija", "Sitowise Oy"
       *   MALLIOSOITE - etunimi.sukunimi@ jai laajentamatta
       *   VAARA PARI - oikea nimi + toisen henkilon osoite  <- vaarallinen
       */
      const raaka = String(c.name ?? "")
      const sanat = raaka.trim().split(/\s+/)
      const onNimi =
        !/\d/.test(raaka) &&
        sanat.length >= 2 &&
        sanat.every((s) => /^[A-ZÅÄÖ]/.test(s)) &&
        !/(oy|ab|ky|SAFA|palvelu|suunnittelij|arkkitehti|sähköposti)/i.test(raaka)
      const malli = /^etunimi\.sukunimi@/i.test(email)
      luokat[malli ? "malliosoite" : onNimi ? "VAARA PARI" : "roskanimi"]++
      const lahde = String(p.metadata?.source_name ?? "?")
      lahteittain.set(lahde, (lahteittain.get(lahde) ?? 0) + 1)
      if (naytteet.length < 16) naytteet.push(`  ${String(c.name).slice(0,22).padEnd(24)} ${email.padEnd(36)} ${lahde.slice(0,30)}`)
    }
  }

  console.log(`hankkeita: ${rivit.length}`)
  console.log(`tarkistettavia (etunimi.sukunimi@): ${tarkistettavia}`)
  console.log(`  nimi ja osoite tasmaavat:         ${tasmaa}`)
  console.log(`  EIVAT TASMAA:                     ${eiTasmaa}  (${Math.round(eiTasmaa / Math.max(1,tarkistettavia) * 100)} %)\n`)
  console.log("vian laji:")
  for (const [k, v] of Object.entries(luokat).sort((a,b)=>b[1]-a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`)
  console.log("\nlahteittain:")
  for (const [k, v] of [...lahteittain].sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${String(v).padStart(4)}  ${k}`)
  console.log("\nnaytteita:")
  for (const n of naytteet) console.log(n)
}

main().catch((e) => { console.error("VIRHE:", e?.message ?? e); process.exit(1) })
