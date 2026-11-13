import { readFileSync } from "node:fs"

for (const line of readFileSync("C:/Users/johan/tyomaat-app/.env.local", "utf8").replace(/\r/g, "").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (!m) continue
  let v = m[2].trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!(m[1] in process.env)) process.env[m[1]] = v
}

/*
 * PINTA-ALA KERROSNELIOINA TAKAUTUVASTI (D-411).
 *
 * D-411 lisasi yksikot kem2 / k-m2 / kerrosneliometria poimijaan ja
 * esti viisi vaaraa kuviota. Tama ajo tayttaa jo tallennetut rivit.
 *
 * RAJAUS: vain rivit joilla POIMITTU LUKU on kerrosneliometreissa.
 * Pelkka "kuvauksessa esiintyy kem2" ei riita: samassa tekstissa on
 * usein myos brm2, ja silloin poimija otti luvun ankkurista joka oli
 * olemassa jo ennen D-411:ta. Ne rivit ovat eri kysymys. `--kaikki`
 * ottaa nekin mukaan.
 *
 * KYSELY ON RAJATTU PALVELIMELLA (14.11.2026).
 *
 * Ensimmainen versio luki koko taulun metadatoineen: 18 900 riviä
 * jsonb-kenttineen, noin 28,5 Mt per ajo ([[metadata-column-is-the-cost]]).
 * Kanta on NANO-kokoinen ja kaatui 13.11.2026 illalla, kun samaa
 * kuviota oli ajettu toistakymmenta kertaa paivan aikana. Syy-yhteytta
 * ei voi todistaa, mutta kuvio oli joka tapauksessa vaara.
 *
 * Nyt suodatus tehdaan PostgREStissa ja metadata haetaan vain niille
 * riveille joita oikeasti kirjoitetaan -- kymmenia rivejä, ei
 * kymmeniatuhansia.
 *
 * Aja ensin ilman --apply-lippua ja lue tuotos riveittain.
 */

const APPLY = process.argv.includes("--apply")
const KAIKKI = process.argv.includes("--kaikki")
const MERKKI = "kerrosnelio_ala_2026_11"

/* Yksikon kirjoitusasut sellaisina kuin ne aineistossa esiintyvat. */
const YKSIKOT = ["kem2", "kem²", "k-m2", "k-m²", "kerrosneliö"]

/*
 * LUETTU LAPI JA HYLATTY (14.11.2026).
 *
 * `--kaikki` ottaa mukaan myos rivit joiden luku tulee ankkurista joka
 * oli olemassa jo ennen D-411:ta. Johannes pyysi lukemaan ne lapi; 18
 * rivista 14 oli oikein ja nama nelja vaarin. Ne EIVAT ole erotettavissa
 * saannolla -- ero on merkityksessa, ei muodossa -- joten ne on
 * lueteltava. Tunnus on kuvauksen katkelma, ei id, jotta sama teksti
 * pysyy hylattyna vaikka rivi tulisi uudelleen.
 *
 * Oikea lopputulos naille on TYHJA kentta: emme tieda hankkeen alaa.
 */
const POISSULJETUT: Array<{ tunnus: string; syy: string }> = [
  {
    tunnus: "Rakennuksenkerrosala on 257 m2",
    syy: "kaavamuutos; 257 m2 on tontilla jo oleva pienteollisuushalli",
  },
  {
    tunnus: "Laulu-Miesten talon laajuus",
    syy: "rakennus suojellaan kaavassa eika tontille synny lisarakennusoikeutta",
  },
  {
    tunnus: "Kankun koulu on 3964",
    syy: "rivi kattaa kaksi erillista urakkaa; 3964 on vain toinen niista",
  },
  {
    tunnus: "1042659292",
    syy: "taulukkodumppi, luvalla kaksi rakennusta (1609 + 537); poiminta on sattumaa",
  },
]

async function main() {
  const { createClient } = await import("@supabase/supabase-js")
  const { extractFloorAreaFromText } = await import("../lib/projects/extractFloorAreaFromText")

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  let yhteensa = 0

  for (const [taulu, nimiKentta] of [
    ["potential_projects", "title"],
    ["projects", "name"],
  ] as const) {
    /*
     * Vain neljä saraketta, ei koko metadataa. `->>` palauttaa NULLin
     * myos silloin kun avainta ei ole, joten `is null` kattaa molemmat.
     */
    const { data, error } = await db
      .from(taulu)
      .select(`id,${nimiKentta},kuvaus:metadata->>description,lahde:metadata->>source_name`)
      .is("metadata->>floor_area", null)
      .or(YKSIKOT.map((y) => `metadata->>description.ilike.%${y}%`).join(","))
      .limit(500)
    if (error) throw error

    const muutokset: any[] = []
    const ohitetut: any[] = []
    for (const r of data ?? []) {
      const teksti = String((r as any).kuvaus ?? "")
      const ala = extractFloorAreaFromText(teksti)
      if (!ala) continue

      /* Se kohta jonka poimija OIKEASTI otti, ei ensimmainen kem2. */
      const muodot = [String(ala), String(ala).replace(/\B(?=(\d{3})+(?!\d))/g, " ")]
      let kohta = -1
      for (const muoto of muodot) { kohta = teksti.indexOf(muoto); if (kohta >= 0) break }

      /* Oliko juuri TAMAN luvun yksikko kerrosnelio? */
      const perassa = kohta >= 0 ? teksti.slice(kohta, kohta + 40) : ""
      const kerrosneliosta = /^[\d\s.,]+\s*(kem2|kem²|k-m2|k-m²|kerrosneliö\w*)/i.test(perassa)
      if (!kerrosneliosta && !KAIKKI) continue

      const hylkays = POISSULJETUT.find((x) => teksti.includes(x.tunnus))
      if (hylkays) {
        ohitetut.push({ r, ala, syy: hylkays.syy })
        continue
      }

      const ikkuna = kohta >= 0 ? teksti.slice(Math.max(0, kohta - 150), kohta + 90) : teksti.slice(0, 240)
      muutokset.push({ r, ala, ikkuna: ikkuna.replace(/\s+/g, " ") })
    }

    console.log(`\n=== ${taulu.toUpperCase()}: taytettavia ${muutokset.length} / ${(data ?? []).length} ehdokasta`)
    for (const m of muutokset) {
      console.log(`\n  ${String(m.ala).padStart(7)} m²  [${String(m.r.lahde ?? "?").slice(0, 24)}]`)
      console.log(`           ${String(m.r[nimiKentta]).slice(0, 70)}`)
      console.log(`           ...${m.ikkuna}...`)
    }

    if (ohitetut.length) {
      console.log(`
  ohitettu ${ohitetut.length} (luettu lapi, ei hankkeen ala):`)
      for (const o of ohitetut) {
        console.log(`    ${String(o.ala).padStart(7)} m²  ${String(o.r[nimiKentta]).slice(0, 44).padEnd(46)}${o.syy}`)
      }
    }

    if (APPLY) {
      /* Metadata haetaan vain kirjoitettaville riveille, yksi kerrallaan. */
      for (const m of muutokset) {
        const { data: rivi, error: lukuVirhe } = await db
          .from(taulu).select("metadata").eq("id", m.r.id).single()
        if (lukuVirhe) throw lukuVirhe

        const meta = { ...(rivi?.metadata ?? {}), floor_area: m.ala }
        meta.takautuvat_ajot = [...new Set([...(meta.takautuvat_ajot ?? []), MERKKI])]

        const { error } = await db.from(taulu).update({ metadata: meta }).eq("id", m.r.id)
        if (error) throw error
      }
      console.log(`\n  kirjoitettu ${muutokset.length}`)
    }
    yhteensa += muutokset.length
  }

  console.log(`\n${APPLY ? "=== AJETTU ===" : "=== KUIVAHARJOITUS ==="}  rivejä ${yhteensa}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
