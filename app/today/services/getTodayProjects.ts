import { unstable_cache } from "next/cache"
import { lueUudelleen } from "@/lib/supabase/lueUudelleen"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * SYOTTEEN RIVIT HAETAAN KEVYINA JA SIVUTETTUNA.
 *
 * MIKSI. Haku noutaa 1 000 UUSINTA hanketta ja vasta sen jalkeen
 * suodatetaan kayttajan valitsemalla vaiheella. Kun maakunnassa on
 * enemman kuin 1 000 hanketta, vanhemmat putoavat pois ENNEN suodatusta
 * - eika kayttaja voi nahda niita millaan asetuksella.
 *
 * Mitattu 2.9.2026: Uudellamaalla on 2 008 nakyvaa hanketta, joista
 * "Rakenteilla" on 305. Tuhannen uusimman ikkunaan niista mahtui **63**.
 * Neljä viidesta katosi hakurajaan, ei suodattimeen.
 *
 * KORJAUS ON KAKSIOSAINEN. Rivi kevennettiin (`metadata` luetaan
 * nimettyina kenttina, ei kokonaisena jsonb:na) ja haku sivutetaan.
 * Mitattu ero: 790 tavua/rivi vastaan 11 kt/rivi, eli 14-kertainen.
 * Kolme tuhatta kevytta rivia on yha murto-osa siita mita tuhat
 * raskasta oli.
 *
 * TEKSTIT VAIN KUN NIITA TARVITAAN. `additional_info` ja
 * `metadata.description` ovat rivin painavin osa (ne ovat kaytannossa
 * sama teksti kahteen kertaan), ja niita tarvitaan vain kun kayttajalla
 * on avainsanoja pisteytysta varten.
 */
const HAKURAJA = 3000
const SIVU = 1000

/* Kentat jotka `todayFilters` ja `todayRanking` lukevat metadatasta. */
const METADATA_KENTAT = [
  "md_source_name:metadata->>source_name",
  "md_source:metadata->>source",
  "md_first_source:metadata->>firstSourceName",
  "md_last_source:metadata->>lastSourceName",
  "md_resolver:metadata->>resolver",
  "md_phase:metadata->>phase",
  "md_operation:metadata->>operation",
  "md_construction_type:metadata->>construction_type",
  "md_building_type:metadata->>building_type",
  "md_business_value:metadata->>business_value",
  "md_size_class:metadata->>size_class",
  "md_procurement_type_code:metadata->>procurement_type_code",
  "md_region:metadata->>region",
  "md_maakunta:metadata->>maakunta",
].join(",")

/* Litteat aliakset takaisin metadata-olioksi, jotta lukijat eivat muutu. */
function kokoaMetadata(rivi: any) {
  const md: Record<string, unknown> = {}
  for (const [avain, arvo] of Object.entries(rivi)) {
    if (!avain.startsWith("md_")) continue
    md[avain.slice(3)] = arvo
    delete rivi[avain]
  }
  /* Aliakset menettavat isot kirjaimet, joten ne palautetaan kasin. */
  md.firstSourceName = md.first_source ?? null
  md.lastSourceName = md.last_source ?? null
  delete md.first_source
  delete md.last_source
  if (rivi.description != null) md.description = rivi.description
  return { ...rivi, metadata: md }
}

async function haeTodayProjects(
  regions?: string[],
  opts?: { tarvitseeTekstit?: boolean }
) {
  const tekstit = opts?.tarvitseeTekstit === true

  /*
   * Valintalista rakennetaan merkkijonona: tyypitetty literaali paisuttaa
   * Supabasen tyyppipaattelyn (TS2590), kun kenttia on kolmisenkymmenta
   * ja osa niista on ehdollisia.
   */
  const valinta: string = [
    "id",
    "created_at",
    "name",
    "developer",
    "builder",
    "city",
    "region",
    "location",
    "property_type",
    "phase",
    ...(tekstit ? ["additional_info", "description:metadata->>description"] : []),
    METADATA_KENTAT,
  ].join(",")

  let query = supabaseAdmin
    .from("projects")
    .select(valinta)
    .eq("status", "active")
    .eq("is_public", true)
    .neq("phase", "Valmistunut")

  /*
   * Rajataan alueen mukaan jo tietokantatasolla, jos kayttaja on valinnut
   * tietyt maakunnat.
   *
   * "Koko Suomi" on velhon sentinel-arvo koko maalle - sita EI saa antaa
   * .in("region", ...):lle, koska mikaan hanke ei ole maakunnassa "Koko
   * Suomi" (johtaisi tyhjaan syotteeseen). Suodatetaan sentinel pois; jos
   * jaljelle jaa oikeita maakuntia, rajataan niihin.
   */
  const effectiveRegions = (regions ?? []).filter(
    (r) => r && r.toLowerCase() !== "koko suomi"
  )

  if (effectiveRegions.length > 0) {
    query = query.in("region", effectiveRegions)
  }


  /*
   * Sivutus: PostgREST palauttaa enintaan 1 000 riviä kerralla, joten
   * yksi kysely EI riita isoon maakuntaan. Lopetetaan heti kun sivu jaa
   * vajaaksi tai raja tulee vastaan.
   */
  const rivit: any[] = []
  for (let alku = 0; alku < HAKURAJA; alku += SIVU) {
    const { data, error } = await lueUudelleen<any[]>(
      () =>
        query
          .order("created_at", { ascending: false })
          .range(alku, Math.min(alku + SIVU, HAKURAJA) - 1),
      `getTodayProjects sivu ${alku}`
    )

    if (error) {
      throw error
    }

    rivit.push(...(data ?? []))
    if (!data || data.length < SIVU) break
  }

  return rivit.map(kokoaMetadata)
}

/*
 * SYOTE VALIMUISTIIN KAHDEKSI TUNNIKSI.
 *
 * MIKSI. Mitattu 15.10.2026: tama haku oli kaytannossa koko /today-sivun
 * odotus — 6,5-7,2 s avainsanojen kanssa, kun kaikki muu yhteensa jai
 * alle sekuntiin. Samalla mitattiin etta **91 % /today- ja
 * /projects-latauksista tapahtuu alle 30 min edellisesta** (ilman
 * koneellista kayttoa laskettuna), eli sama tyo tehdaan uudelleen ja
 * uudelleen samalle datalle.
 *
 * MIKSI VAIN TAMA OSA. Summassa on myos peukut, suosikit ja tiimitiedot.
 * Jos ne olisivat valimuistissa, kayttajan OMA peukku ei vaikuttaisi
 * nakymaan kahteen tuntiin. Ne ovat alle 0,5 s, joten ne haetaan
 * jokaisella latauksella. Tassa valimuistissa ei ole kayttajakohtaista
 * tietoa lainkaan — avaimena on vain alueet ja tarvitaanko tekstit.
 *
 * VANHENEMINEN ON KELLOAIKA, EI ISTUNTO. Johannes 15.10.2026: *"ison
 * pelkoni on ennemmin etta valimuisti jaa paivittamatta kokonaan kun
 * kayttaja ei koskaan kirjaudu pois ja siksi emme huomaa sita."* Siksi
 * `revalidate` on absoluuttinen: merkinta vanhenee kahdessa tunnissa
 * kirjoitushetkesta riippumatta siita mita kayttaja tekee. Mikaan ei
 * sido sita istuntoon eika uloskirjautumiseen.
 *
 * VERSIOAVAIN. Jos rivin muoto muuttuu, vanha merkinta ei saa kelvata —
 * muuten vanhentunut muoto rikkoisi sivun hiljaa. Nosta versiota kun
 * valintalista tai kokoaMetadata muuttuu.
 */
const SYOTTEEN_VERSIO = "v1"
const VALIMUISTI_SEKUNTIA = 2 * 60 * 60

export async function getTodayProjectsMeta(
  regions?: string[],
  opts?: { tarvitseeTekstit?: boolean }
) {
  const tekstit = opts?.tarvitseeTekstit === true
  const alueet = [...(regions ?? [])].map((r) => String(r).trim()).filter(Boolean).sort()
  const avain = [SYOTTEEN_VERSIO, tekstit ? "tekstit" : "kevyt", ...alueet]

  const haeValimuistista = unstable_cache(
    async () => ({ rivit: await haeTodayProjects(regions, opts), haettu: Date.now() }),
    avain,
    { revalidate: VALIMUISTI_SEKUNTIA, tags: ["today-projects"] }
  )

  return haeValimuistista()
}

/*
 * Rivit sellaisenaan: vanhat kutsujat eivat muutu.
 */
export async function getTodayProjects(
  regions?: string[],
  opts?: { tarvitseeTekstit?: boolean }
) {
  const { rivit } = await getTodayProjectsMeta(regions, opts)
  return rivit
}

/*
 * Todellinen määrä aktiivisia hankkeita käyttäjän alueella — EI rajattu
 * 1000:een (getTodayProjects hakee vain 1000 pisteytystä varten, mutta
 * "Kaikki hankkeet alueellasi" -mittarin pitää näyttää oikea kokonaisluku).
 */
export async function getRegionProjectCount(regions?: string[]): Promise<number> {
  let query = supabaseAdmin
    .from("projects")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    /* Sama piilotussuodatin kuin yllä, jottei luku lupaa piilotettuja. */
    .eq("is_public", true)
    // Valmistunut työmaa ei ole enää mahdollisuus — suodatetaan pois, jotta
    // luku vastaa karttasivua (joka jättää valmistuneet/vanhentuneet pois).
    .neq("phase", "Valmistunut")

  const effectiveRegions = (regions ?? []).filter(
    (r) => r && r.toLowerCase() !== "koko suomi"
  )

  if (effectiveRegions.length > 0) {
    query = query.in("region", effectiveRegions)
  }

  /*
   * Laskuri palauttaa `count`in eika `data`a, joten uusinta kaaritaan
   * samaan muotoon kuin muut luvut.
   */
  const { data: count, error } = await lueUudelleen<number>(
    () => query.then(({ count, error }) => ({ data: count ?? 0, error })),
    "getRegionProjectCount"
  )
  if (error) throw error
  return count ?? 0
}