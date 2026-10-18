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
 * RAKENNUSTEHON OULUN KATSAUS SEITSEMAKSI HANKKEEKSI (D-313).
 *
 * Johannes 18.10.2026 jonorivista `d0855b1b` ("Tulevaisuuden Oulua
 * rakentamassa"): *"nama hankkeet pitaa myos erotella omiksi
 * hankkeiksiin ja tama lisata niihin lahteeksi."*
 *
 * Yksi katsausjuttu, seitseman hanketta kolmessa kunnassa. Yhtena
 * rivina se on Oulun koulu 40 %:n varmuudella eika mikaan sen
 * hankkeista loydy haulla.
 *
 * TARKISTETTU ENSIN MITA KANNASSA JO ON (ja korjattu oma virhe: eka
 * kysely ilman sivutusta loysi vain 1/7, koska PostgREST katkaisee
 * 1 000 riviin -- ks. muisti empty-result-may-be-an-error):
 *
 *   OSAO Kampus 2030     ON KAHDESTI: 242b2adf (STT, tilaaja OSAO) ja
 *                        21188ea2 (Rakennuslehti). Ei luoda kolmatta;
 *                        pari viedaan katselmoitavaksi, EI yhdisteta.
 *   PSOAS Quattro        on `d7660f0d`, tilaaja TYHJA -> PSOAS.
 *   Peltolan yksikko     on `4c84069f`, kustannus ja valmistuminen jo
 *                        oikein; puuttuu urakkasumma ja laajuus.
 *   Kuusiluodon Runo     on `95e67aa7`, vaihe "Suunnittelussa" vaikka
 *                        valmistuu jouluksi 2026 -> Rakenteilla.
 *   Mantytorni           on `8658246a`, RAKENTAJA TYHJA.
 *   Jaakarinkangas       EI OLE hankkeena. Jonossa kuusi riviä, kaikki
 *                        HYLATTY uutispaivityksina -- 40,2 M€:n
 *                        monitoimitalo jai siksi kokonaan pois.
 *   Muhoksen kerrostalo  ei ole. Kannassa on Muhoksen kunnan
 *                        erityisryhmien vuokrakerrostalon RAKENNUSLUPA
 *                        (`c6d7c4dd`, Asematie 16, 13.8.2026), joka on
 *                        todennakoisesti sama hanke. Lupa EI nimea
 *                        rakentajaa, joten yhdistamista ei tehda itse:
 *                        uusi rivi saa vihjeen `liittyva_hanke`.
 *
 * LUVUT OVAT LAHTEEN OMIA. Katsausjutun lisaksi luettiin Rakennustehon
 * kohdesivut (referenssit/osao, /quattro, /peltola,
 * /jaakarinkankaan-monitoimitalo), jotka antavat laajuudet,
 * urakkasummat ja suunnittelijat. Valmistumispaivaa EI lasketa
 * aikataulusta: Quattron kohdalla lahde kertoo vain "rakentaminen
 * alkaa 2028 alussa, kesto 19 kk", joten kentta jaa tyhjaksi ja
 * aikataulu menee kuvaukseen (muisti: completion-date-from-text).
 *
 * VAIN TYHJA KENTTA TAYTETAAN, paitsi kaksi nimettya korjausta:
 *   242b2adf valmistuminen 2029-12-31 -> 2030-12-31 (lahde: "vuoden
 *            2030 loppuun mennessa")
 *   95e67aa7 vaihe Suunnittelussa -> Rakenteilla
 *
 *   npx tsx scripts/pura-rakennustehon-oulun-katsaus.ts
 *   npx tsx scripts/pura-rakennustehon-oulun-katsaus.ts --apply
 */

const JONORIVI = "d0855b1b-a2a8-472c-b64b-d92980c1d5fc"
const KATSAUS = "https://rakennusteho.fi/2026/10/tulevaisuuden-oulua-rakentamassa/"

const OSAO_A = "242b2adf-8259-4b29-8702-aadad5b44b38"
const OSAO_B = "21188ea2-1afd-4f6e-822b-832a28412077"
const QUATTRO = "d7660f0d-6944-45c4-a5b6-62283caaaf56"
const PELTOLA = "4c84069f-f136-4ab6-895c-d4f92926a800"
const RUNO = "95e67aa7-a1fc-4172-ae72-dc5cd3fa8863"
const MANTYTORNI = "8658246a-399f-49eb-9c03-3d08a85e729c"
const MUHOKSEN_LUPA = "c6d7c4dd-3eda-4ce7-9828-f7b336ee3a70"

const YHTEYSHENKILO = {
  kind: "person",
  name: "Oskari Pyrrö",
  title: "Liiketoimintajohtaja, julkinen rakentaminen",
  organization: "Rakennusteho",
  phone: "040 848 2302",
  email: "oskari.pyrro@rakennusteho.fi",
}

/* --- Taydennykset olemassa oleviin hankkeisiin --- */

type Taydennys = {
  id: string
  nimi: string
  /* Kentat, jotka taytetaan VAIN jos ne ovat tyhjia. */
  tyhjille?: Record<string, unknown>
  /* Nimetyt korjaukset: vanha arvo kirjataan tulosteeseen. */
  korjaukset?: Record<string, unknown>
  metadata?: Record<string, unknown>
  alsoKnownAs?: string[]
  yritykset?: string[]
  lisaKuvaus: string
  lahde: string
}

const TAYDENNYKSET: Taydennys[] = [
  {
    id: OSAO_A,
    nimi: "OSAO Kampus 2030",
    tyhjille: { estimated_cost: 120_000_000 },
    korjaukset: { estimated_completion: "2030-12-31" },
    metadata: {
      laajuus_brm2: 45_000,
      urakkamuoto: "Yhteistoiminnallinen KVR-urakka",
      alue: "Kaukovainio",
      cost_source: "text",
      cost_source_url: "https://rakennusteho.fi/rakentaminen-palveluna/referenssit/osao/",
    },
    alsoKnownAs: ["OSAO Kampus 2030"],
    yritykset: [
      "Rakennusteho Oy",
      "A-Insinöörit Rakennuttaminen Oy",
      "Uuleo Arkkitehdit Oy",
      "AOR Arkkitehdit Oy",
      "WSP Finland Oy",
      "Granlund Oy",
    ],
    lisaKuvaus:
      "Rakennustehon katsaus 15.10.2026: Kampus 2030 on Rakennustehon kehitysvaiheen hankkeista " +
      "kooltaan merkittävin. Kaukovainiolle rakentuva keskittymä tarjoaa valmistuttuaan tilat " +
      "4 700 opiskelijalle ja noin 540 työntekijälle, ja kampuksen ensimmäinen työvaihe alkaa " +
      "vuonna 2027. Kohdesivun mukaan kokonaislaajuus on noin 45 000 brm² ja arvioitu arvo noin " +
      "120 miljoonaa euroa; kampus rakentuu kolmessa vaiheessa ja valmistuu vuoden 2030 loppuun " +
      "mennessä. Hanke toteutetaan yhteistoiminnallisena KVR-urakkana. Rakennuttamistehtävät " +
      "A-Insinöörit Rakennuttaminen Oy, pää- ja arkkitehtisuunnittelu Uuleo Arkkitehdit Oy ja " +
      "AOR Arkkitehdit Oy, rakennesuunnittelu WSP Finland Oy, talotekniikkasuunnittelu Granlund Oy.",
    lahde: "https://rakennusteho.fi/rakentaminen-palveluna/referenssit/osao/",
  },
  {
    id: QUATTRO,
    nimi: "PSOAS:in Quattro, Välkkylä",
    tyhjille: {
      developer: "Pohjois-Suomen opiskelija-asuntosäätiö sr (PSOAS)",
      estimated_cost: 22_500_000,
    },
    metadata: {
      laajuus_asuntoneliot: 8_000,
      asuntoja: 230,
      urakkamuoto: "Yhteistoiminnallinen KVR-urakka",
      alue: "Välkkylä",
      cost_source: "text",
      cost_source_url: "https://rakennusteho.fi/rakentaminen-palveluna/referenssit/quattro/",
    },
    alsoKnownAs: ["Quattro", "PSOAS:in Quattro"],
    yritykset: ["Rakennusteho Oy", "Inaro Oy"],
    lisaKuvaus:
      "Rakennustehon kohdesivu ja katsaus 15.10.2026: työnimellä Quattro kulkeva kortteli on noin " +
      "8 000 asuntoneliön kokonaisuus, joka on tarkoitus rakentaa kerralla. Neljää rakennusta " +
      "yhdistää korkea atriumtila ja piazza, ja asuntoja tulee reilut 230 (yksiöitä ja kaksioita). " +
      "Yhteiseen käyttöön on suunniteltu atrium, kaksi saunaa, kattoterassi, takkahuone ja pesula. " +
      "Urakkahinta on 22,5 miljoonaa euroa. Hanke käynnistyy kehitys- ja kaavoitusvaiheella ja " +
      "tavoitteena on päästä rakentamaan vuoden 2028 alussa; varsinainen rakentaminen kestää noin " +
      "19 kuukautta. Arkkitehtisuunnittelusta vastaa Inaro, pääarkkitehtina Vesa Humalisto. " +
      "Rakennusteho voitti tarjouskilpailun hinta-laatusuhteeltaan parhaalla tarjouksella.",
    lahde: "https://rakennusteho.fi/rakentaminen-palveluna/referenssit/quattro/",
  },
  {
    id: PELTOLA,
    nimi: "Peltolan vaativan asumisen yksikkö",
    metadata: {
      urakkasumma: 6_700_000,
      laajuus_brm2: 2_950,
      urakkamuoto: "Yhteistoiminnallinen KVR-urakka",
      alue: "Peltola",
    },
    alsoKnownAs: ["Peltolan vaativan asumisen yksikkö"],
    yritykset: ["Rakennusteho Oy", "Arco Architecture Company Oy"],
    lisaKuvaus:
      "Rakennustehon kohdesivu: laajuus 2 950 brm², toteutusvaiheen urakkasumma 6,7 miljoonaa euroa " +
      "(aluehallituksen kesäkuussa 2025 vahvistama arvioitu kokonaiskustannus 11 miljoonaa euroa), " +
      "rakentamisaika 17 kuukautta ja valmistumisvuosi 2027. Arkkitehtisuunnittelusta vastaa " +
      "Arco Architecture Company Oy. Rakennustehon katsauksessa 15.10.2026 yksikkö on rakenteilla.",
    lahde: "https://rakennusteho.fi/rakentaminen-palveluna/referenssit/peltola/",
  },
  {
    id: RUNO,
    nimi: "Asunto Oy Kuusiluodonrannan Runo",
    korjaukset: { phase: "Rakenteilla" },
    tyhjille: {},
    metadata: { alue: "Kuusiluodonranta" },
    lisaKuvaus:
      "Rakennustehon katsaus 15.10.2026: Kuusiluodonrannan korttelin ensimmäinen vaihe, Runo, " +
      "valmistuu jouluksi 2026. Kohde on Rakennustehon omaa asuntotuotantoa ja premium-tasoinen " +
      "kerrostalokohde.",
    lahde: KATSAUS,
  },
  {
    id: MANTYTORNI,
    nimi: "Asunto Oy Helsingin Mäntytorni",
    tyhjille: { builder: "Rakennusteho Group Oy" },
    metadata: { ohjelma: "Helsingin Kehittyvä kerrostalo -ohjelma", alue: "Oulunkylä" },
    yritykset: ["Rakennusteho Group Oy", "Kontio"],
    lisaKuvaus:
      "Rakennustehon katsaus 15.10.2026: Helsingin ensimmäinen hirsikerrostalo on käynnissä ja on " +
      "yksi Rakennustehon kahdesta omasta asuntokohteesta. Hybridirakenteinen hirsikerrostalo " +
      "toteutetaan yhdessä hirsikerrostalotoimijan Kontion kanssa osana Helsingin Kehittyvä " +
      "kerrostalo -ohjelmaa. Arkkitehti Vesa Humalisto.",
    lahde: KATSAUS,
  },
]

/* --- Uudet jonorivit --- */

const JAAKARINKANGAS_KUVAUS =
  "Oulun Jääkärinkankaalle Haapalehdontien ja Raitotien risteykseen rakennettu monitoimitalo, johon " +
  "sijoittuvat päiväkoti, 840 oppilaan yhtenäiskoulu, nuorisotiloja, monitoimisali, kirjasto sekä " +
  "Oulu-opiston ja yhteisöpalveluiden toimintoja. Laajuus noin 16 300 brm², urakkasumma 40,2 " +
  "miljoonaa euroa ja rakentamisaika 26 kuukautta. Urakka toteutettiin yhteistoiminnallisena " +
  "suunnittele ja rakenna -urakkana. Tilaajana Oulun kaupunki, Oulun Tilapalvelut -liikelaitos. " +
  "Arkkitehtisuunnittelusta vastasi Sweco Finland Oy.\n\n" +
  "Rakennustehon katsaus 15.10.2026: monitoimitalo luovutettiin Oulun kaupungille viikkoa aiemmin. " +
  "Luovutus tapahtui etuajassa ja hanke toteutui alkuperäisessä budjetissa.\n\n" +
  "HUOM KATSELMOIJALLE: tämä hanke ei ole kannassa, vaikka siitä on tullut jonoon kuusi uutisriviä " +
  "(mm. \"Jääkärinkankaan monitoimitalo rakennetaan energiatehokkaaksi\", \"Oulun Jääkärinkankaan " +
  "monitoimitalo etenee!\"), jotka kaikki on hylätty uutispäivityksinä. Varsinainen hanke jäi " +
  "siksi kokonaan pois. Kohde on valmis, mutta 40,2 miljoonan euron monitoimitalo on referenssinä " +
  "merkittävä."

const MUHOS_KUVAUS =
  "Rakennusteho kertoo katsauksessaan 15.10.2026: \"Rakenteilla on myös vaativan asumisen yksikköä " +
  "Pohteelle Peltolaan ja kerrostalo Muhoksen kunnalle.\" Kerrostalosta ei kerrota muuta.\n\n" +
  "HUOM KATSELMOIJALLE: kannassa on hanke c6d7c4dd, Muhoksen kunnan erityisryhmien " +
  "vuokra-asuinkerrostalon rakennuslupa (Asematie 16, lupa 13.8.2026, LP-494-2026-00068): " +
  "nelikerroksinen kerrostalo, 28 asuntoa, kerrosala 1 319 m², keskipinta-ala 30 m². Tilaaja " +
  "(Muhoksen kunta), kunta, rakennustyyppi ja ajoitus täsmäävät, joten kyse on todennäköisesti " +
  "samasta hankkeesta. Lupapäätös ei kuitenkaan nimeä rakentajaa, joten yhdistämistä ja rakentajan " +
  "kirjaamista ei tehty koneella. Jos sama hanke, lisää lupariville rakentajaksi Rakennusteho ja " +
  "hylkää tämä rivi."

async function main() {
  const apply = process.argv.includes("--apply")
  const { createClient } = await import("@supabase/supabase-js")
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

  console.log(apply ? "=== AJO (--apply) ===" : "=== KUIVAHARJOITUS ===")

  /* --- 1. Taydennykset --- */
  const { data: rivit, error } = await db
    .from("projects")
    .select("*")
    .in("id", [OSAO_A, OSAO_B, QUATTRO, PELTOLA, RUNO, MANTYTORNI, MUHOKSEN_LUPA])
  if (error || (rivit ?? []).length !== 7) {
    console.error(`VIRHE: odotettiin 7 riviä, saatiin ${(rivit ?? []).length} (${error?.message ?? ""})`)
    process.exit(1)
  }
  const hae = (id: string) => (rivit ?? []).find((r: any) => r.id === id) as any

  console.log(`\n1) TAYDENNYKSET (${TAYDENNYKSET.length})`)
  for (const t of TAYDENNYKSET) {
    const p = hae(t.id)
    const md: Record<string, any> = { ...(p.metadata ?? {}) }
    console.log(`\n   ${t.id.slice(0, 8)} ${String(p.name).slice(0, 56)}`)
    console.log(`      -> ${t.nimi}`)

    const paivitys: Record<string, unknown> = {}

    for (const [k, v] of Object.entries(t.tyhjille ?? {})) {
      const nyt = (p as any)[k]
      const tyhja = nyt == null || String(nyt).trim() === "" || String(nyt).trim() === "-"
      console.log(`      ${k.padEnd(22)} ${tyhja ? `tyhjä -> ${v}` : `ON JO "${nyt}" -- ei korvata`}`)
      if (tyhja) paivitys[k] = v
    }
    for (const [k, v] of Object.entries(t.korjaukset ?? {})) {
      console.log(`      ${k.padEnd(22)} KORJAUS ${(p as any)[k] ?? "-"} -> ${v}`)
      paivitys[k] = v
    }

    /* Metadata: vain puuttuvat avaimet. */
    const lisatyt: string[] = []
    for (const [k, v] of Object.entries(t.metadata ?? {})) {
      if (md[k] == null) {
        md[k] = v
        lisatyt.push(`${k}=${v}`)
      }
    }
    if (lisatyt.length) console.log(`      metadata              ${lisatyt.join(", ")}`)

    const aka = new Set<string>([...(Array.isArray(md.also_known_as) ? md.also_known_as : []), ...(t.alsoKnownAs ?? [])])
    aka.delete(String(p.name))
    if (t.alsoKnownAs?.length) {
      md.also_known_as = [...aka]
      console.log(`      also_known_as         ${JSON.stringify([...aka])}`)
    }
    if (t.yritykset?.length) {
      const yr = new Set<string>([...(Array.isArray(md.related_companies) ? md.related_companies : []), ...t.yritykset])
      md.related_companies = [...yr]
      console.log(`      related_companies     ${JSON.stringify([...yr])}`)
    }

    /*
     * LAHDE. Hankesivu nayttaa vain yhden linkin
     * (`metadata.source_url`), joten jos se on jo olemassa, uutta
     * linkkia ei kirjoiteta sen paalle vaan `source_history`-listaan,
     * jota TIC-sivu lukee varasijana. Katsauksen tiedot menevat
     * kuvaukseen, jonka asiakas lukee ilman linkin avaamista.
     */
    const historia: any[] = Array.isArray(md.source_history) ? md.source_history : []
    for (const url of new Set([KATSAUS, t.lahde])) {
      if (historia.some((h) => h?.source_url === url || h?.document_url === url)) continue
      historia.push({
        seen_at: new Date().toISOString(),
        source_name: "rakennusteho",
        source_url: url,
        document_url: url,
        eroteltu_rivista: JONORIVI,
      })
    }
    md.source_history = historia
    if (!md.source_url) {
      md.source_url = t.lahde
      md.source_name = md.source_name ?? "rakennusteho"
      console.log(`      source_url            tyhjä -> ${t.lahde}`)
    } else {
      console.log(`      source_url            ON JO ${String(md.source_url).slice(0, 58)}`)
      console.log(`      source_history        +${historia.length} kpl (katsaus + kohdesivu)`)
    }

    /* Kuvaus: katsauksen tiedot peraan, ei vanhan paalle. */
    const vanhaKuvaus = String(p.additional_info ?? "").trim()
    const onJo = vanhaKuvaus.includes(t.lisaKuvaus.slice(0, 60))
    const kuvaus = onJo ? vanhaKuvaus : [vanhaKuvaus, t.lisaKuvaus].filter(Boolean).join("\n\n")
    console.log(`      kuvaus                ${vanhaKuvaus.length} -> ${kuvaus.length} merkkiä${onJo ? " (on jo)" : ""}`)
    console.log(`      lisätään: ${t.lisaKuvaus.slice(0, 150)}...`)

    if (!apply) continue
    const { error: e1 } = await db
      .from("projects")
      .update({ ...paivitys, additional_info: kuvaus, metadata: md })
      .eq("id", t.id)
    if (e1) console.error(`      VIRHE: ${e1.message}`)
    else console.log(`      kirjoitettu`)
  }

  /* --- 2. OSAO-pari katselmoitavaksi, EI yhdisteta --- */
  console.log(`\n2) OSAO on kannassa kahdesti -- pari katselmoitavaksi`)
  console.log(`   A ${OSAO_A.slice(0, 8)} ${hae(OSAO_A).name}`)
  console.log(`   B ${OSAO_B.slice(0, 8)} ${hae(OSAO_B).name}`)
  const { data: pari } = await db
    .from("project_duplicate_candidates")
    .select("id, status")
    .or(
      `and(project_id_a.eq.${OSAO_A},project_id_b.eq.${OSAO_B}),and(project_id_a.eq.${OSAO_B},project_id_b.eq.${OSAO_A})`
    )
  if ((pari ?? []).length) {
    console.log(`   pari on jo kannassa: ${JSON.stringify(pari)}`)
  } else if (apply) {
    const { error: e2 } = await db.from("project_duplicate_candidates").insert({
      project_id_a: OSAO_A,
      project_id_b: OSAO_B,
      confidence: 92,
      reasons: [
        "sama hanke: OSAOn Kampus 2030 -hankkeen kehitysvaihe",
        "molemmilla rakentajana Rakennusteho ja kuntana Oulu",
        "toinen STT:n tiedotteesta, toinen Rakennuslehdestä",
        "molemmat nimetty uutisotsikolla, ei hankkeen nimellä",
        "havaittu 18.10.2026 Rakennustehon katsauksen erottelussa",
      ],
    })
    if (e2) console.error(`   VIRHE parin lisayksessa: ${e2.message}`)
    else console.log(`   pari lisatty katselmoitavaksi`)
  } else {
    console.log(`   lisataan katselmoitavaksi (EI yhdisteta itse)`)
  }

  /* --- 3. Uudet jonorivit --- */
  const UUDET = [
    {
      title: "Jääkärinkankaan monitoimitalo",
      municipality: "Oulu",
      confidence: 90,
      metadata: {
        city: "Oulu",
        region: "Pohjois-Pohjanmaa",
        address: "Haapalehdontie / Raitotie",
        source: "rakennusteho",
        source_name: "rakennusteho",
        source_url: "https://rakennusteho.fi/rakentaminen-palveluna/referenssit/jaakarinkankaan-monitoimitalo/",
        paatos_url: KATSAUS,
        operation: "Jääkärinkankaan monitoimitalo",
        description: JAAKARINKANGAS_KUVAUS,
        developer: "Oulun kaupunki, Oulun Tilapalvelut -liikelaitos",
        builder: "Rakennusteho Oy",
        phase_hint: "Valmistunut",
        building_type: "Koulu",
        estimated_cost: 40_200_000,
        cost_source: "text",
        estimated_completion: "2026-10-31",
        laajuus_brm2: 16_300,
        urakkamuoto: "Yhteistoiminnallinen suunnittele ja rakenna -urakka",
        related_companies: ["Rakennusteho Oy", "Sweco Finland Oy"],
        contact_persons: [YHTEYSHENKILO],
        eroteltu_rivista: JONORIVI,
        eroteltu_lahteen_sanamuoto: "Viime viikolla luovutettiin Jääkärinkankaan monitoimitalon Oulun kaupungille",
      },
    },
    {
      title: "Kerrostalo Muhoksen kunnalle",
      municipality: "Muhos",
      confidence: 70,
      metadata: {
        city: "Muhos",
        region: "Pohjois-Pohjanmaa",
        source: "rakennusteho",
        source_name: "rakennusteho",
        source_url: KATSAUS,
        operation: "Kerrostalo Muhoksen kunnalle",
        description: MUHOS_KUVAUS,
        developer: "Muhoksen kunta",
        builder: "Rakennusteho Oy",
        phase_hint: "Rakenteilla",
        building_type: "Kerrostalo",
        contact_persons: [YHTEYSHENKILO],
        eroteltu_rivista: JONORIVI,
        eroteltu_lahteen_sanamuoto: "Rakenteilla on myös ... kerrostalo Muhoksen kunnalle",
        /* Vihje katselmoijalle, ei yhdistamista koneella. */
        liittyva_hanke: MUHOKSEN_LUPA,
      },
    },
  ]

  console.log(`\n3) UUDET JONORIVIT (${UUDET.length})`)
  for (const u of UUDET) {
    const { data: onko } = await db.from("potential_projects").select("id, status").eq("title", u.title)
    console.log(`\n   ${u.title}  [${u.municipality}, varmuus ${u.confidence}]`)
    console.log(`   ${String(u.metadata.description).slice(0, 180).replace(/\n/g, " ")}...`)
    if ((onko ?? []).length) {
      console.log(`   ON JO JONOSSA: ${JSON.stringify(onko)} -- ei lisata`)
      continue
    }
    if (!apply) {
      console.log(`   lisataan jonoon`)
      continue
    }
    const { error: e3 } = await db.from("potential_projects").insert({
      title: u.title,
      municipality: u.municipality,
      status: "new",
      confidence: u.confidence,
      source_count: 1,
      metadata: u.metadata,
    })
    if (e3) console.error(`   VIRHE: ${e3.message}`)
    else console.log(`   lisatty jonoon`)
  }

  if (!apply) console.log("\nEi kirjoitettu. Aja --apply kun rivit on luettu.")
}

main().catch((e) => {
  console.error("KAATUI:", e?.message ?? e)
  process.exit(1)
})
