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
 * TOIVON KAKSI ESPERI-KOHDETTA OMIKSI HANKKEIKSEEN (D-312).
 *
 * Johannes 25.10.2026 jonorivista `adf63f15`: *"nama toivon tiedotteet
 * ovat todella epamaaraisia eika naista meinaa selvita oikein mitaan.
 * mutta tassa on kaksi eri hanketta. puratko ne ja pidetaan tassa oleva
 * lahde."*
 *
 * Tiedote 19.12.2025: Toivo myi Cofinimmo SA:lle KAKSI rakenteilla
 * olevaa hoivakohdetta, joiden vuokralainen on Esperi Care Oy.
 * Kohteet ovat ERI KUNNISSA ja luovutetaan eri aikaan, joten ne ovat
 * eri hankkeita ([[phases-are-separate-projects]]).
 *
 * TARKISTETTU ENSIN MITA KANNASSA JO ON:
 *
 *   Joensuu, vammaispalvelu, 23 paikkaa
 *     EI OLE kannassa. Kolme Joensuun hoivariviamme ovat eri kohteita:
 *     Penttilan ikaihmisten hoivakoti (Norlandia, 9 M EUR),
 *     Penttilankadun 60-paikkainen (Vexatec) ja Rantakylan 60+60
 *     (Toivo + Norlandia). Luodaan.
 *
 *   Lappeenranta/Joutseno, kehitysvammaiset, 19 paikkaa
 *     ON JO KAHDESTI: `3c29f2a2` ("Hoivakoti kehitysvammaisille",
 *     11.3.2026) ja `49656e79` ("Lappeenrantaan uusi hoivakoti",
 *     Vexatecin tiedotteesta 20.10.2026). EI LUODA KOLMATTA.
 *     Pari viedaan katselmoitavaksi, ei yhdisteta itse
 *     ([[check-duplicate-reviews]]).
 *
 * KOKONAISARVO EI MENE KUSTANNUSKENTTAAN. Tiedote antaa vain
 * yhteissumman ("reilut 6 miljoonaa euroa" kahdesta kohteesta), eika
 * kohdekohtaista lukua ole ([[alliance-split]],
 * [[combined-figure-split-by-owner-page]]). Summa jaa kuvaukseen.
 *
 * AIKATAULUT OVAT RISTIRIIDASSA Lappeenrannan osalta: Toivo
 * (19.12.2025) sanoo luovutuksen "aivan vuoden 2027 alkuun", Vexatec
 * "syksylla 2026 valmistuvien tilojen". Kumpaakaan ei kirjoiteta
 * valmistumiskenttaan, koska vaara paiva piilottaisi hankkeen
 * ([[hiding-threshold]]).
 *
 *   npx tsx scripts/pura-toivon-esperi-kohteet.ts
 *   npx tsx scripts/pura-toivon-esperi-kohteet.ts --apply
 */

const JONORIVI = "adf63f15-f2f0-4f51-8d06-c2e593f0afd8"
const TIEDOTE =
  "https://sijoittajille.toivo.fi/fi/tiedotteet?publicationId=c29b0a03-efc6-4eb4-85fb-b87bb68b4fc0"

const JOUTSENO_VANHA = "3c29f2a2-343f-440b-8308-c754a56cf64a"
const JOUTSENO_UUSI = "49656e79-dadb-4ea3-80bc-035e2828266d"

const YHTEINEN =
  "Kohde on osa kauppaa, jolla Toivo myi belgialaiselle Cofinimmo SA:lle kaksi rakenteilla " +
  "olevaa hoivakohdetta: Joensuun 23-paikkaisen ja Lappeenrannan Joutsenon 19-paikkaisen " +
  "kodin. Kahden kohteen kokonaisarvo on yhteensä reilut 6 miljoonaa euroa. Molemmissa " +
  "Toivo on solminut pitkäaikaisen vuokrasopimuksen Esperi Care Oy:n kanssa ja vastaa " +
  "siitä, että kohteet toteutetaan sopimusten mukaisesti. Kauppa kuuluu Toivon ja " +
  "Cofinimmon kesällä 2025 solmimaan aiesopimukseen, jonka piirissä toteutettavien " +
  "hankkeiden kokonaisarvo on arviolta 20-40 miljoonaa euroa vuosina 2025-2027. " +
  "Cofinimmoa edustaa Suomessa Mirabel Partners. " +
  "Yhteyshenkilöt: Markus Myllymäki, toimitusjohtaja, Toivo Group Oyj, 040 847 6206, " +
  "markus.myllymaki@toivo.fi; kiinteistöjohtaja Tomi Rosqvist, Toivo; " +
  "liiketoimintajohtaja Perttu Aikkila, Toivon Yhteiskuntakiinteistöt."

const JOENSUU_KUVAUS =
  "Toivo toteuttaa Joensuuhun vammaispalvelun asukkaille kodin, jossa on 23 asukaspaikkaa. " +
  "Suunnittelussa on huomioitu arjen sujuvuus ja energiatehokkuus: kohde toteutetaan " +
  "A-energialuokkaan. Kohde luovutetaan Esperi Care Oy:n käyttöön vuoden 2026 loppupuolella. " +
  "Kohde oli rakenteilla tiedotteen julkaisuhetkellä 19.12.2025. " +
  YHTEINEN

/* Vain tama kauppa tuo nama osapuolet; roolia ei vaiteta ([[party-role-fields]]). */
const LIITTYVAT = ["Esperi Care Oy", "Cofinimmo SA"]

function yhdista(vanhat: unknown, uudet: string[]): string[] {
  const lista = Array.isArray(vanhat) ? vanhat.map((n) => String(n)) : []
  for (const u of uudet) {
    if (!lista.some((v) => v.toLowerCase() === u.toLowerCase())) lista.push(u)
  }
  return lista
}

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const { importCandidate } = await import("../lib/agent/importCandidate")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Joensuun kohde uutena hankkeena --- */
  console.log(`\n1) UUSI HANKE: Vammaispalvelun koti Joensuuhun (23 asukaspaikkaa)`)
  console.log(`   vaihe Rakenteilla | valmistuu 2026-12-31 | rakentaja Toivo Group Oyj`)
  console.log(`   liittyvät: ${LIITTYVAT.join(" | ")}`)
  console.log(`   kuvaus (${JOENSUU_KUVAUS.length} merkkiä):`)
  console.log(`   ${JOENSUU_KUVAUS.slice(0, 300)}...`)

  const projektit: any[] = []
  for (let a = 0; ; a += 1000) {
    const { data, error } = await db
      .from("projects")
      .select("id, name, city, region, location, status, developer, builder, phase, metadata")
      .range(a, a + 999)
    if (error) {
      console.error(`VIRHE projects: ${error.message}`)
      process.exit(1)
    }
    projektit.push(...(data ?? []))
    if ((data ?? []).length < 1000) break
  }

  /*
   * TASMAYS TARKISTETAAN ENNEN KIRJOITUSTA. Yli 70:n osuma EI luo uutta
   * riviä vaan kirjoittaa kentät vanhan hankkeen päälle, ja Joensuussa on
   * kolme samannimista hoivariviä ([[matched-overwrites-fields]]).
   */
  {
    const { findProjectMatchDetailed } = await import("../lib/agent/projectMatcher")
    const osuma = findProjectMatchDetailed(projektit as any, {
      name: "Vammaispalvelun asumisyksikkö Joensuuhun",
      city: "Joensuu",
      region: "Pohjois-Karjala",
      location: null,
      developer: null,
      builder: "Toivo Group Oyj",
      buildingType: "Hoivakoti",
      description: JOENSUU_KUVAUS,
      winners: null,
      permitNumber: null,
      propertyId: null,
    } as any)
    console.log(
      `   TÄSMÄYS: ${
        osuma
          ? `${osuma.confidence} -> ${String(osuma.project?.name).slice(0, 44)} [${(osuma.reasons ?? []).join(", ")}]`
          : "ei osumaa"
      }`
    )
    if (osuma && osuma.confidence >= 70) {
      console.error(
        `   PYSÄYTETTY: osuma kirjoittaisi kentät rivin ${osuma.project?.id} päälle. Lue rivi ensin.`
      )
      process.exit(1)
    }
  }

  if (apply) {

    const tulos = await importCandidate(
      {
        name: "Vammaispalvelun asumisyksikkö Joensuuhun",
        city: "Joensuu",
        region: "Pohjois-Karjala",
        location: null,
        phase: "Rakenteilla",
        description: JOENSUU_KUVAUS,
        developer: null,
        builder: "Toivo Group Oyj",
        property_type: "Hoivakoti",
        source_url: `${TIEDOTE}#joensuu`,
        confidence: 0.9,
        completed: false,
        source_name: "toivo_tiedotteet",
        estimatedCompletion: "2026-12-31",
        metadata: {
          paatos_url: TIEDOTE,
          eroteltu_rivista: JONORIVI,
          eroteltu_lahteen_sanamuoto: "Joensuuhun 23 asukaspaikkaa sisältävän kodin",
          estimated_completion: "2026-12-31",
          related_companies: LIITTYVAT,
          contact_persons: [
            {
              kind: "person",
              name: "Markus Myllymäki",
              title: "toimitusjohtaja",
              organization: "Toivo Group Oyj",
              email: "markus.myllymaki@toivo.fi",
              phone: "040 847 6206",
            },
          ],
        },
      },
      { projects: projektit }
    )
    console.log(`   -> ${JSON.stringify(tulos).slice(0, 200)}`)
  }

  /* --- 2. Joutseno on jo kannassa kahdesti: taydennetaan, ei luoda --- */
  console.log(`\n2) Joutsenon kohde on jo kannassa kahdesti, ei luoda kolmatta`)
  const { data: rivit, error: e2 } = await db
    .from("projects")
    .select("id, name, builder, developer, metadata")
    .in("id", [JOUTSENO_VANHA, JOUTSENO_UUSI])
  if (e2) {
    console.error(`VIRHE: ${e2.message}`)
    process.exit(1)
  }

  for (const p of rivit ?? []) {
    const m: any = p.metadata ?? {}
    const uudet = yhdista(m.related_companies, LIITTYVAT)
    const lisataan = uudet.filter((n) => !(m.related_companies ?? []).includes(n))
    /* Kirjoitusvirhe omassa kentassa: "Vexatex" -> "Vexatec". */
    const builder = p.builder === "Vexatex Oy" ? "Vexatec Oy" : p.builder

    console.log(`\n   ${p.id}  ${String(p.name).slice(0, 44)}`)
    console.log(`      liittyviin lisätään: ${lisataan.length ? lisataan.join(" | ") : "-"}`)
    if (builder !== p.builder) console.log(`      rakentaja: "${p.builder}" -> "${builder}"`)
    console.log(`      lähde lisätään: ${m.toivo_tiedote ? "on jo" : TIEDOTE.slice(0, 80)}`)

    if (!apply) continue
    const paivitys: Record<string, any> = {
      metadata: {
        ...m,
        related_companies: uudet,
        toivo_tiedote: TIEDOTE,
        eroteltu_rivista: JONORIVI,
      },
    }
    if (builder !== p.builder) paivitys.builder = builder
    const { error } = await db.from("projects").update(paivitys).eq("id", p.id)
    if (error) console.error(`      VIRHE: ${error.message}`)
    else console.log(`      kirjoitettu`)
  }

  /* --- 3. Kaksoispari katselmoitavaksi --- */
  const { data: pari } = await db
    .from("project_duplicate_candidates")
    .select("id, status")
    .or(
      `and(project_id_a.eq.${JOUTSENO_VANHA},project_id_b.eq.${JOUTSENO_UUSI}),and(project_id_a.eq.${JOUTSENO_UUSI},project_id_b.eq.${JOUTSENO_VANHA})`
    )
  console.log(`\n3) Kaksoispari`)
  if ((pari ?? []).length) {
    console.log(`   on jo kannassa: ${JSON.stringify(pari)}`)
  } else {
    console.log(`   viedään katselmoitavaksi (EI yhdistetä itse)`)
    if (apply) {
      const { error } = await db.from("project_duplicate_candidates").insert({
        project_id_a: JOUTSENO_VANHA,
        project_id_b: JOUTSENO_UUSI,
        confidence: 92,
        reasons: [
          "sama kohde: Lappeenrannan Joutsenon kehitysvammaisten palvelukoti, 19 paikkaa",
          "molemmissa Toivo tilaajana ja Vexatec rakentajana",
          "toinen työmaakyltistä 11.3.2026, toinen Vexatecin tiedotteesta 20.10.2026",
          "havaittu 25.10.2026 Toivon tiedotteen erottelussa",
        ],
      })
      if (error) console.error(`      VIRHE parin lisäyksessä: ${error.message}`)
      else console.log(`      pari lisätty`)
    }
  }

  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
