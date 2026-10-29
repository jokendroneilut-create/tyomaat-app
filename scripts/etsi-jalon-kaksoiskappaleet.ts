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
 * JALONIN RIVIEN KAKSOISKAPPALEET: KARTOITUS (ei kirjoita mitaan).
 *
 * Jalonin luettelo nimeaa kohteen OSOITTEELLA ("Kuninkaantammi,
 * Paletinkierto 11 00430 Helsinki"), kun sama hanke on kannassa
 * tilaajan omalla nimella ("Heka Kuninkaantammi, Paletinkierto 11").
 * Nimen runko ei siis osu -- katuosoite osuu.
 *
 *   npx tsx scripts/etsi-jalon-kaksoiskappaleet.ts
 */

type Rivi = {
  id: string
  name: string
  city: string | null
  phase: string | null
  developer: string | null
  builder: string | null
  location: string | null
  estimated_completion: string | null
  metadata: any
}

/*
 * Katuosoite = katunimi + numero. Postinumero (5 numeroa) ja vuosiluku
 * eivat ole talonumeroita, ja numero ilman katunimea ei yksiloi mitaan.
 */
const EI_KATUA = new Set([
  "helsinki", "espoo", "vantaa", "tampere", "turku", "oulu", "kerrosta",
  "vaihe", "osa", "as", "oy", "ab", "kpl", "nro", "tontti", "kortteli",
])

function osoiteavaimet(teksti: string | null | undefined): string[] {
  if (!teksti) return []
  const t = String(teksti).replace(/\u00a0/g, " ")
  const avaimet = new Set<string>()
  const re = /([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö-]{3,})\s+(\d{1,3})(?![\d])(?:\s*[-–]\s*\d{1,3})?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const katu = m[1].toLowerCase()
    if (EI_KATUA.has(katu)) continue
    avaimet.add(`${katu} ${Number(m[2])}`)
  }
  return [...avaimet]
}

/* Loysa nimirunko vertailuun. */
function runko(teksti: string | null | undefined): string {
  return String(teksti ?? "").toLowerCase().replace(/[^0-9a-zåäö]+/g, " ").trim()
}

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const kaikki: Rivi[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id,name,city,phase,developer,builder,location,estimated_completion,metadata")
      .range(a, a + 999)
    if (error) { console.error("VIRHE:", error.message); process.exit(1) }
    kaikki.push(...((data ?? []) as Rivi[]))
    if ((data ?? []).length < 1000) break
  }

  const jalon = kaikki.filter((h) => h.metadata?.source_name === "jalon_tyomaat")
  console.log(`Kannassa ${kaikki.length} hanketta, niista Jalonin lahteesta ${jalon.length}\n`)

  const jalonIdt = new Set(jalon.map((h) => h.id))

  /* Indeksi: osoiteavain -> rivit, jotka EIVAT ole Jalonin. */
  const indeksi = new Map<string, Rivi[]>()
  for (const h of kaikki) {
    if (jalonIdt.has(h.id)) continue
    for (const a of osoiteavaimet(`${h.name} ${h.location ?? ""}`)) {
      if (!indeksi.has(a)) indeksi.set(a, [])
      indeksi.get(a)!.push(h)
    }
  }

  let osumia = 0
  for (const j of jalon) {
    const avaimet = osoiteavaimet(`${j.name} ${j.location ?? ""}`)
    const ehdokkaat = new Map<string, { h: Rivi; avain: string }>()
    for (const a of avaimet) {
      for (const h of indeksi.get(a) ?? []) {
        if (j.city && h.city && j.city !== h.city) continue
        if (!ehdokkaat.has(h.id)) ehdokkaat.set(h.id, { h, avain: a })
      }
    }

    console.log(`— ${j.name}`)
    console.log(`   ${j.id}  ${j.city ?? "?"} | ${j.phase ?? "-"} | valmistuu ${j.estimated_completion ?? "-"}`)
    console.log(`   osoite: ${j.location ?? "-"}   tilaaja: ${j.developer ?? "-"}`)
    console.log(`   avaimet: ${avaimet.join(" | ") || "(ei osoiteavainta)"}`)
    if (!ehdokkaat.size) {
      console.log(`   ei osoiteosumia`)
    } else {
      osumia += 1
      for (const { h, avain } of ehdokkaat.values()) {
        console.log(`   MAHDOLLINEN PARI [${avain}]`)
        console.log(`      ${h.id}  ${h.name}`)
        console.log(`      ${h.city ?? "?"} | ${h.phase ?? "-"} | valmistuu ${h.estimated_completion ?? "-"} | rakentaja ${h.builder ?? "-"} | tilaaja ${h.developer ?? "-"}`)
        console.log(`      osoite: ${h.location ?? "-"}  lahde: ${h.metadata?.source_name ?? "-"}`)
      }
    }
    console.log()
  }

  console.log(`Jalonin riveista ${osumia}/${jalon.length} sai ainakin yhden osoiteosuman.`)
}

main().catch((e) => { console.error("KAATUI:", e?.message ?? e); process.exit(1) })
