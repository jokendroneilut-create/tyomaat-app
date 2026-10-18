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
 * LANSIRATIKAT KAHDEKSI ALLIANSSIKSI (D-309).
 *
 * Johannes 18.10.2026: *"lansiratikat hanke pitaisi tutkia kannassa.
 * siina on kasittaakseni kaksi eri allianssia \u2026 tee ehdotuksen
 * mukaisesti ja kayta 340M\u20ac."*
 *
 * KAKSI RIIPPUMATONTA LAHDETTA VAHVISTAA KAKSI ALLIANSSIA:
 *
 *   Destia: "Lansiratikoiden toteutus on jaettu kahteen allianssiin,
 *   joista toisen muodostavat Destia ja WSP. Projektin kokonaisarvio
 *   on noin 340 miljoonaa euroa, josta Destian johtaman allianssin
 *   osuus on arviolta noin 187 miljoonaa euroa."
 *
 *   NRC: "Pikaraitiotiehanke toteutetaan kahden allianssin voimin ja
 *   tilataan kolmessa osassa."
 *
 * Kannassa oli NELJA julkista rivia samasta asiasta. Tama tekee niista
 * kaksi: yksi per allianssi, ja kaksi STT:n ohjelmatason uutista
 * yhdistetaan Destian riviin.
 *
 * KUSTANNUS. Johannes valitsi kokonaisarvoksi 340 M\u20ac (kannassa luki
 * 600 M\u20ac, mika ei ole lahdetekstissa). Kokonaisarvo kirjataan
 * molempien KUVAUKSEEN ja metadataan; kustannuskenttaan tulee vain
 * allianssin OMA osuus, jotta kahta riviä ei lasketa yhteen 680
 * miljoonaksi. Destialle 187 M\u20ac koska lahde sanoo sen; toiselle
 * tyhja, koska lahde ei kerro sita eika sita lasketa erotuksena.
 *
 * VOITTAJA VALITAAN KASIN, ei `chooseDuplicateSurvivor`-funktiolla:
 * Destian rivi on se jonka teemme allianssiriviksi, eika valinta saa
 * riippua siita kumpi sattuu olemaan taydempi.
 *
 *   npx tsx scripts/jarjesta-lansiratikat.ts
 *   npx tsx scripts/jarjesta-lansiratikat.ts --apply
 */

const DESTIA = "53f2da7a-21b3-486b-90b7-75f6fa33b787"
const NRC = "c4631a99-3e26-48da-945b-59145f331dd6"
const STT = [
  "0fe994ae-7022-42c7-acf5-bd8b825579f4",
  "0a1f7086-879f-4317-a54f-336213f1a1ae",
]

const KOKONAISARVO = 340_000_000
const TILAAJA = "Helsingin kaupunki, Pääkaupunkiseudun Kaupunkiliikenne Oy ja HSY"
const KAIKKI_OSAPUOLET = [
  "Destia Oy",
  "Destia Rail Oy",
  "Proxion Plan Oy",
  "WSP Finland Oy",
  "YIT Infra Oy",
  "NRC Group Finland Oy",
  "Sitowise Oy",
  "Sweco Finland Oy",
]

const YHTEINEN =
  "Länsiratikat on noin 10 kilometrin pikaraitiotieyhteys Kannelmäestä keskustaan (linja 14), " +
  "ja se kulkee Mannerheimintietä pitkin Munkkiniemen, Meilahden, Haagan ja Lassilan kautta. " +
  "Liikennöinti alkaa 2030-luvun alussa. Hanke sisältää myös katualueiden perusparannuksia ja " +
  "pyörätieverkon investointeja. Toteutus on jaettu KAHTEEN ALLIANSSIIN ja tilataan kolmessa osassa; " +
  "koko hankkeen arvo on noin 340 miljoonaa euroa. Rakentaminen alkoi toukokuussa 2026. " +
  "Tilaajina ovat Infraohjelma Helsingin osapuolet: Helsingin kaupunki, Pääkaupunkiseudun Kaupunkiliikenne Oy ja HSY."

const DESTIAN_KUVAUS =
  "DESTIAN JOHTAMA ALLIANSSI. Osapuolet: Destia Oy, Destia Rail Oy, Proxion Plan Oy ja WSP Finland Oy. " +
  "Allianssin osuus on arviolta noin 187 miljoonaa euroa. " +
  "Destia toimii pääurakoitsijana Niemenmäellä ja Turunväylän liittymän alueilla, joissa rakennustyöt " +
  "alkoivat toukokuun loppupuolella. Linnankoskenkadun ja Töölön pysäköintiratkaisujen rakentaminen " +
  "alkaa kesä–heinäkuun taitteessa. Ensimmäisen osan arvo on noin 30 miljoonaa euroa. " +
  YHTEINEN

const NRC_KUVAUS =
  "YIT:N JA NRC:N ALLIANSSI. Osapuolet: YIT Infra Oy, NRC Group Finland Oy, Sitowise Oy ja Sweco Finland Oy. " +
  "Allianssi on mukana Länsiratikat-projektin ensimmäisen osan rakentamistöissä. " +
  "Allianssin oman osuuden arvoa ei ole kerrottu lähteissä. " +
  YHTEINEN

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { siirrettavatArvot } = await import("../lib/projects/duplicateFieldCarry")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  const { data: rivit, error } = await db
    .from("projects")
    .select("*")
    .in("id", [DESTIA, NRC, ...STT])
  if (error || (rivit ?? []).length !== 4) {
    console.error(`VIRHE: odotettiin 4 riviä, saatiin ${(rivit ?? []).length} (${error?.message ?? ""})`)
    process.exit(1)
  }
  const haeRivi = (id: string) => (rivit ?? []).find((r: any) => r.id === id) as any

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Destian allianssi --- */
  const destia = haeRivi(DESTIA)
  console.log(`\n1) ${destia.name}`)
  console.log(`   nimi      -> Länsiratikat, Destian allianssi`)
  console.log(`   rakentaja "${String(destia.builder ?? "").slice(0, 60)}..."`)
  console.log(`             -> Destia Oy, Destia Rail Oy, Proxion Plan Oy, WSP Finland Oy`)
  console.log(`   kustannus ${destia.estimated_cost} -> 187000000  (allianssin oma osuus)`)
  console.log(`   tilaaja   ${destia.developer} -> ${TILAAJA}`)

  /* --- 2. YIT/NRC:n allianssi --- */
  const nrc = haeRivi(NRC)
  console.log(`\n2) ${nrc.name}`)
  console.log(`   nimi      -> Länsiratikat, YIT:n ja NRC:n allianssi`)
  console.log(`   rakentaja ${nrc.builder} -> YIT Infra Oy, NRC Group Finland Oy, Sitowise Oy, Sweco Finland Oy`)
  console.log(`   kustannus ${nrc.estimated_cost ?? "-"} -> tyhja (lahde ei kerro)`)

  /* --- 3. STT-rivit Destian riviin --- */
  console.log(`\n3) Yhdistetaan Destian riviin:`)
  for (const id of STT) {
    const r = haeRivi(id)
    const siirto = siirrettavatArvot(destia, r)
    console.log(`   ${String(r.name).slice(0, 56)}`)
    console.log(`      julkinen ${r.is_public} -> false; siirtyy: ${Object.keys(siirto).join(", ") || "ei mitaan"}`)
  }

  if (!apply) {
    console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
    return
  }

  /* Siirrettavat kentat STT-riveilta ennen piilotusta. */
  let lisat: Record<string, unknown> = {}
  for (const id of STT) {
    lisat = { ...siirrettavatArvot({ ...destia, ...lisat }, haeRivi(id)), ...lisat }
  }

  const dm: any = { ...(destia.metadata ?? {}) }
  dm.related_companies = KAIKKI_OSAPUOLET
  dm.hankkeen_kokonaisarvo = KOKONAISARVO
  dm.allianssi = "Destia"
  dm.kokonaisarvo_lahde = "Destian tiedote: koko hankkeen arvo noin 340 milj. euroa"

  const { error: e1 } = await db
    .from("projects")
    .update({
      ...lisat,
      name: "Länsiratikat, Destian allianssi",
      builder: "Destia Oy, Destia Rail Oy, Proxion Plan Oy, WSP Finland Oy",
      developer: TILAAJA,
      estimated_cost: 187_000_000,
      additional_info: DESTIAN_KUVAUS,
      metadata: dm,
    })
    .eq("id", DESTIA)
  if (e1) {
    console.error(`VIRHE Destia: ${e1.message}`)
    process.exit(1)
  }
  console.log(`\n   Destian allianssi kirjoitettu`)

  const nm: any = { ...(nrc.metadata ?? {}) }
  nm.related_companies = KAIKKI_OSAPUOLET
  nm.hankkeen_kokonaisarvo = KOKONAISARVO
  nm.allianssi = "YIT / NRC"
  nm.rinnakkainen_allianssi = DESTIA

  const { error: e2 } = await db
    .from("projects")
    .update({
      name: "Länsiratikat, YIT:n ja NRC:n allianssi",
      builder: "YIT Infra Oy, NRC Group Finland Oy, Sitowise Oy, Sweco Finland Oy",
      developer: TILAAJA,
      additional_info: NRC_KUVAUS,
      metadata: nm,
    })
    .eq("id", NRC)
  if (e2) {
    console.error(`VIRHE NRC: ${e2.message}`)
    process.exit(1)
  }
  console.log(`   YIT/NRC:n allianssi kirjoitettu`)

  /* Destian riville viite toiseen allianssiin. */
  await db
    .from("projects")
    .update({ metadata: { ...dm, rinnakkainen_allianssi: NRC } })
    .eq("id", DESTIA)

  /* STT-rivit piiloon ja parit kirjaan. */
  for (const id of STT) {
    const { error: e3 } = await db.from("projects").update({ is_public: false }).eq("id", id)
    if (e3) {
      console.error(`VIRHE piilotus ${id}: ${e3.message}`)
      continue
    }
    const { error: e4 } = await db.from("project_duplicate_candidates").insert({
      project_id_a: DESTIA,
      project_id_b: id,
      confidence: 95,
      reasons: [
        "sama hanke: Länsiratikat",
        "ohjelmatason uutinen, ei oma hanke",
        "yhdistetty käsin 18.10.2026",
      ],
      status: "confirmed_duplicate",
      reviewed_at: new Date().toISOString(),
    })
    if (e4) console.error(`VIRHE pari ${id}: ${e4.message}`)
  }
  console.log(`   ${STT.length} STT-riviä piilotettu ja kirjattu pariksi`)
}
main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
