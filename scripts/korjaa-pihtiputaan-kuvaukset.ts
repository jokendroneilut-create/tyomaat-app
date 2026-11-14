import { readFileSync } from "node:fs"
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (!m) continue
  let v = m[2].trim()
  const q = v.slice(0, 1)
  if ((q === '"' || q === "'") && v.endsWith(q)) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PIHTIPUTAAN KAAVASIVUJEN KUVAUKSET (D-418).
 *
 * Johannes 14.11.2026: *"hankkeesta puuttuu kuvaus. korjaa jonoon jos on
 * muita tasta lahteesta. tarkista kayttajille nakyvat hankkeet kannasta"*
 *
 * Uudelta sivupohjalta (ei .entry-contentia) keraaja sai tyhjan
 * kuvauksen, liitteet ja vaiheen. Vanhoilta sivuilta kuvaukseen tuli
 * koko sivu murupolkuineen ja yhteystietoineen. Tama hakee kunkin
 * kaavasivun kerran (sama haku jonka keraaja tekee joka ajolla) ja:
 *
 *   - dokumentti: kuvaus `pihtipudasKuvaus`, tyhjalle myos liitteet ja vaihe
 *   - jono ja nakyvat: Pihtiputaan osuus kuvauksesta vaihdetaan siistiin.
 *     Jos kuvauksen perassa on toisen lahteen tekstia (Uusimo: YVA),
 *     se SAILYY -- vain alussa oleva vanha sivuteksti korvataan.
 *     Kuvaus jota ei voi tunnistaa vanhaksi sivutekstiksi jatetaan.
 *
 *   npx tsx scripts/korjaa-pihtiputaan-kuvaukset.ts          kuiva
 *   npx tsx scripts/korjaa-pihtiputaan-kuvaukset.ts --apply
 */

const APPLY = process.argv.includes("--apply")
const LAHDE = "Pihtiputaan vireillä olevat asemakaavat"
const OTSAKKEET = { "User-Agent": "Mozilla/5.0 (compatible; TyomaatBot/1.0; +https://www.tyomaat.fi)" }

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const cheerio = await import("cheerio")
  const { pihtipudasKuvaus } = await import("../lib/agent/pihtipudasKuvaus")
  const { pihtipudasPhaseFromText } = await import("../lib/agent/discovery/collectors/apiCollector")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: dokut, error } = await db
    .from("source_documents")
    .select("id,title,document_url,raw_payload")
    .eq("source_name", LAHDE)
  if (error) throw error

  /* dokumentti-id -> { vanha sivuteksti, uusi kuvaus, vaihe } */
  const korvaukset = new Map<string, { vanha: string; uusi: string; vaihe: string | null }>()

  for (const d of (dokut ?? []) as any[]) {
    const vastaus = await fetch(d.document_url, { headers: OTSAKKEET })
    if (!vastaus.ok) {
      console.log(`DOKU  ${d.title.slice(0, 60)}: sivu ${vastaus.status}, ohitetaan`)
      continue
    }
    const html = await vastaus.text()
    const uusi = pihtipudasKuvaus(html)
    if (!uusi) {
      console.log(`DOKU  ${d.title.slice(0, 60)}: ei kuvausta sivulla, ohitetaan`)
      continue
    }
    const raw = d.raw_payload ?? {}
    const vanha = String(raw.description ?? "")
    const muutos: Record<string, unknown> = {}
    let vaihe: string | null = null

    if (vanha !== uusi) muutos.description = uusi
    if (!vanha) {
      /* Tyhja dokumentti: liitteet ja vaihe samasta sisallosta kuin keraaja. */
      const $ = cheerio.load(html)
      const juuri = $(".entry-content").first().length
        ? $(".entry-content").first()
        : $('[data-elementor-type="wp-page"]').first()
      const sivunTeksti = juuri.text().replace(/\s+/g, " ").trim()
      vaihe = pihtipudasPhaseFromText(`${d.title} ${sivunTeksti}`)
      const liitteet = juuri
        .find("a")
        .toArray()
        .map((a) => ({
          label: $(a).text().replace(/\s+/g, " ").trim(),
          url: new URL($(a).attr("href") ?? "", d.document_url).toString(),
        }))
        .filter((a) => a.url.startsWith("http") && !a.url.includes("mailto:"))
      muutos.attachments = liitteet
      if (vaihe !== raw.phase) muutos.phase = vaihe
      console.log(`DOKU  ${d.title.slice(0, 60)}: TYHJÄ -> kuvaus ${uusi.length} merkkiä, liitteitä ${liitteet.length}, vaihe ${raw.phase} -> ${vaihe}`)
    } else if (muutos.description) {
      console.log(`DOKU  ${d.title.slice(0, 60)}: kuvaus ${vanha.length} -> ${uusi.length} merkkiä`)
    }

    korvaukset.set(d.id, { vanha, uusi, vaihe })
    if (APPLY && Object.keys(muutos).length) {
      const { error: e } = await db
        .from("source_documents")
        .update({ raw_payload: { ...raw, ...muutos }, updated_at: new Date().toISOString() })
        .eq("id", d.id)
      if (e) throw e
    }
  }

  /* Korvaa vanha sivuteksti alusta; muu teksti perassa sailyy. */
  const korvaa = (nykyinen: string | null | undefined, k: { vanha: string; uusi: string }): string | null => {
    const t = String(nykyinen ?? "")
    if (!t) return k.uusi
    if (t === k.uusi || t.startsWith(k.uusi)) return null
    if (k.vanha && t.startsWith(k.vanha)) return (k.uusi + " " + t.slice(k.vanha.length)).trim()
    return null
  }

  let rivit = 0
  const { data: jono } = await db.from("potential_projects").select("id,title,status,metadata").eq("metadata->>source_name", LAHDE)
  for (const r of (jono ?? []) as any[]) {
    const md = r.metadata ?? {}
    const k = korvaukset.get(md.source_document_id)
    if (!k) continue
    const uusi = korvaa(md.description, k)
    const muutos: Record<string, unknown> = {}
    if (uusi) muutos.description = uusi
    if (k.vaihe && r.status === "new" && md.decision_status !== k.vaihe) muutos.decision_status = k.vaihe
    if (!Object.keys(muutos).length) continue
    rivit++
    console.log(`JONO  [${r.status}] ${String(r.title).slice(0, 60)}: kuvaus ${String(md.description ?? "").length} -> ${uusi?.length ?? "sama"}${muutos.decision_status ? `, vaihe ${md.decision_status} -> ${muutos.decision_status}` : ""}`)
    if (APPLY) {
      const ajot = [...new Set([...(md.takautuvat_ajot ?? []), "pihtiputaan_kuvaukset_2026_11"])]
      const { error: e } = await db
        .from("potential_projects")
        .update({ metadata: { ...md, ...muutos, takautuvat_ajot: ajot }, updated_at: new Date().toISOString() })
        .eq("id", r.id)
      if (e) throw e
    }
  }

  const { data: hankkeet } = await db.from("projects").select("id,name,status,additional_info,metadata").eq("metadata->>source_name", LAHDE)
  for (const r of (hankkeet ?? []) as any[]) {
    const md = r.metadata ?? {}
    const k = korvaukset.get(md.source_document_id)
    if (!k) {
      console.log(`HANKE [${r.status}] ${String(r.name).slice(0, 60)}: ei uutta kuvausta, ennallaan`)
      continue
    }
    const ai = korvaa(r.additional_info, k)
    const mdKuvaus = korvaa(md.description, k)
    if (!ai && !mdKuvaus) {
      if (!String(r.additional_info ?? "").startsWith(k.uusi))
        console.log(`HANKE [${r.status}] ${String(r.name).slice(0, 60)}: kuvaus ei ala vanhalla sivutekstillä, ennallaan`)
      continue
    }
    rivit++
    console.log(`HANKE [${r.status}] ${String(r.name).slice(0, 60)}: kuvaus ${String(r.additional_info ?? "").length} -> ${ai?.length ?? "sama"}`)
    if (APPLY) {
      const ajot = [...new Set([...(md.takautuvat_ajot ?? []), "pihtiputaan_kuvaukset_2026_11"])]
      const { error: e } = await db
        .from("projects")
        .update({
          ...(ai ? { additional_info: ai } : {}),
          metadata: { ...md, ...(mdKuvaus ? { description: mdKuvaus } : {}), takautuvat_ajot: ajot },
        })
        .eq("id", r.id)
      if (e) throw e
    }
  }

  console.log(`\n${APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS ==="}  rivejä ${rivit}`)
}
main()
