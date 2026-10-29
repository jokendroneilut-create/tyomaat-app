import { readFileSync } from "node:fs"
for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); const q = v.slice(0,1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1,-1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * MITTAUS: kuinka moni julkinen hanke jakaa KATUOSOITTEEN (katu + talonumero)
 * jonkin toisen hankkeen kanssa, vaikka osoitekentat eivat ole merkkijonoina
 * samat. projectMatcherin same_location vaatii tasmalleen saman merkkijonon,
 * joten "Paletinkierto 11 00430 Helsinki" ja "Paletinkierto 11, Helsinki"
 * eivat osu. Ei kirjoita mitaan.
 */
/*
 * Katusana vaaditaan: ilman sita "asemakaavan muutos 609 1695" tuotti
 * avaimen "muutos 609", ja Porin kaikki kaavat nayttivat samalta
 * osoitteelta. Otos paljasti sen, luku ei.
 */
const KATUPAATE = /(tie|katu|kuja|polku|vayla|vaylae|kierto|ranta|puisto|raitti|bulevardi|aukio|kaari|rinne|laita|maki|maeki|tori|silta|portti|penger|kaarre|linja|reitti|solmu|kallio|niitty|harju|laakso|saari|lahti|nummi|kenttae|kentta)$/
const EI_KATUA = new Set(["kerrosta","vaihe","osa","tontti","kortteli","asuntoa","vuonna","numero"])

function avain(teksti: string | null | undefined): string[] {
  if (!teksti) return []
  const t = String(teksti).replace(/\u00a0/g, " ")
  const ulos = new Set<string>()
  const re = /([A-Za-zÅÄÖåäö][A-Za-zÅÄÖåäö-]{3,})\s+(\d{1,3})(?![\d])/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t))) {
    const katu = m[1].toLowerCase()
    if (EI_KATUA.has(katu)) continue
    if (!KATUPAATE.test(katu.replace(/ä/g, "ae").replace(/ö/g, "oe"))) continue
    ulos.add(`${katu} ${Number(m[2])}`)
  }
  return [...ulos]
}
const norm = (s: any) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim()

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const rivit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db.from("projects")
      .select("id,name,city,phase,location,is_public,metadata").eq("is_public", true).range(a, a + 999)
    if (error) throw error
    rivit.push(...(data ?? [])); if ((data ?? []).length < 1000) break
  }
  console.log(`Julkisia hankkeita ${rivit.length}`)

  /* Avain vain OSOITEKENTASTA, ei nimesta: nimessa oleva numero ei ole osoite. */
  const ryhmat = new Map<string, any[]>()
  for (const r of rivit) {
    if (!r.city) continue
    for (const a of avain(r.location)) {
      const k = `${norm(r.city)}|${a}`
      if (!ryhmat.has(k)) ryhmat.set(k, [])
      ryhmat.get(k)!.push(r)
    }
  }

  const { data: katselmoidut } = await db.from("project_duplicate_candidates").select("project_id_a,project_id_b,status")
  const tunnettu = new Set((katselmoidut ?? []).map((p: any) => [p.project_id_a, p.project_id_b].sort().join("|")))
  const tila = new Map((katselmoidut ?? []).map((p: any) => [[p.project_id_a, p.project_id_b].sort().join("|"), p.status]))

  let paria = 0, uusia = 0, samaMerkkijono = 0
  const naytteet: string[] = []
  const nahty = new Set<string>()
  for (const [k, ryhma] of ryhmat) {
    if (ryhma.length < 2) continue
    for (let i = 0; i < ryhma.length; i++) for (let j = i + 1; j < ryhma.length; j++) {
      const avainPari = [ryhma[i].id, ryhma[j].id].sort().join("|")
      if (nahty.has(avainPari)) continue
      nahty.add(avainPari)
      paria++
      if (norm(ryhma[i].location) === norm(ryhma[j].location)) { samaMerkkijono++; continue }
      if (tunnettu.has(avainPari)) continue
      uusia++
      if (naytteet.length < 30) {
        naytteet.push(
          `[${k}]\n   ${ryhma[i].phase.padEnd(18)} ${String(ryhma[i].name).slice(0,56)}\n      ${ryhma[i].location} | ${ryhma[i].metadata?.source_name ?? "-"}\n   ${ryhma[j].phase.padEnd(18)} ${String(ryhma[j].name).slice(0,56)}\n      ${ryhma[j].location} | ${ryhma[j].metadata?.source_name ?? "-"}`
        )
      }
    }
  }
  console.log(`Saman katuosoitteen pareja: ${paria}`)
  console.log(`  joista osoitekentta on jo merkkijonona sama (matcher loytaa): ${samaMerkkijono}`)
  console.log(`  jo katselmointijonossa: ${paria - samaMerkkijono - uusia}`)
  console.log(`  UUSIA, joita matcher ei nae: ${uusia}\n`)
  console.log(naytteet.join("\n\n"))
}
main().catch((e) => { console.error(e); process.exit(1) })
