import { createClient } from "@supabase/supabase-js"

import { hankkeenYritysavaimet } from "@/lib/metrics/yritysavain"
import {
  hankkeenOsapuolet,
  osapuolenNimi,
  type YritysLahde,
} from "@/lib/metrics/hankkeenYritykset"

/*
 * YRITYSREKISTERIN LUKU (D-242).
 *
 * Rekisteri on pieni (kymmenia yrityksia, satoja henkiloita), joten se
 * luetaan kerran muistiin ja liitetaan hankkeisiin siella. Liitos per
 * hanke olisi tuhansia kyselyja.
 *
 * TASO ON AINA "company". Nama eivat ole hankkeen omia yhteyshenkiloita
 * vaan yrityksen yleisia (D-241): asiakkaalle merkintana ja mittarin
 * harmaana neulana, ei tummana.
 *
 * TAYDENTAA, EI KORVAA. Jos hankkeella on oma yhteyshenkilo, yrityksen
 * yleista ei lisata lainkaan — muuten kortille kertyisi rinnakkain
 * tyomaan vastaava ja yrityksen aluejohtaja ilman etta kumpi on kumpi
 * selviaisi muuten kuin merkinnasta.
 */

/*
 * Asiakas luodaan vasta kutsuttaessa, ei moduulin latauksessa: puhtaat
 * funktiot (`yrityksenYhteyshenkilot`) ovat testattavissa ilman
 * ymparistomuuttujia, ja moduulin tason `createClient` kaatoi testin
 * virheeseen "supabaseUrl is required".
 */
function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export type YritysYhteyshenkilo = {
  name: string
  title: string | null
  email: string | null
  phone: string | null
  organization: string
  level: "company"
}

export type Yritysrekisteri = Map<string, YritysYhteyshenkilo[]>

/*
 * YRITYKSELTA NAYTETAAN ENINTAAN KOLME (D-374).
 *
 * Johannes 6.11.2026 nahtyaan Mahkonsillan kortin: *"korjataan ettei
 * asiakkaalle nayteta 51 vayylaviraston nimea koska sekaan ei ole
 * oikein."*
 *
 * Mitattu 6.11.2026: yritystason lista nakyi 176 hankkeella, keskimaarin
 * 18,2 henkiloa, ja 69 hankkeella kymmenen tai enemman. Vaylavirastolla
 * 51, Senaatti-kiinteistoilla 13, Kreatella 17. Lista ei ollut
 * jarjestetty mitenkaan, joten kolme ensimmaista oli mielivaltaiset.
 *
 * KATTO ON PER YRITYS, EI PER HANKE. Johannes: *"hankkeella voi olla
 * vaikka 10 olennaista yhteyshenkiloa mutta ne ovat eri yrityksista."*
 * Nelja osapuoliyritysta antaa siis edelleen 12 ihmista.
 *
 * EI KOSKE `nimetytTaydennykset`ia (D-373): se haetaan nimiavaimella,
 * ja katto voisi pudottaa juuri sen ihmisen jonka hanke nimeaa.
 */
export const NAYTA_YRITYKSELTA_ENINTAAN = 3

const TYHJA: Yritysrekisteri = new Map()

export async function haeYritysrekisteri(): Promise<Yritysrekisteri> {
  const { data, error } = await admin()
    .from("yritys_yhteyshenkilot")
    .select("avain, yritys, nimi, nimike, email, puhelin, lahde")
    .limit(2000)

  /*
   * Virhe ei saa kaataa mitaan: rekisteri on taydennys, ja ilman sita
   * hanke nayttaa samalta kuin ennen rekisterin olemassaoloa.
   */
  if (error) {
    console.error("haeYritysrekisteri:", error.message)
    return TYHJA
  }

  /*
   * JARJESTYS RATKAISTAAN LUKUHETKELLA, koska `lahde` ei saa paatya
   * selaimeen: se kertoo miten rivi on syntynyt, mika on sisainen asia.
   * Lajiteltu lista riittaa, ja kutsuja ottaa vain karjen.
   */
  const painot = new Map<unknown, number>()
  const rekisteri: Yritysrekisteri = new Map()
  for (const rivi of data ?? []) {
    const avain = String(rivi.avain)
    const lista = rekisteri.get(avain) ?? []
    lista.push({
      name: String(rivi.nimi),
      title: rivi.nimike ?? null,
      email: rivi.email ?? null,
      phone: rivi.puhelin ?? null,
      organization: String(rivi.yritys),
      level: "company",
    })
    painot.set(lista[lista.length - 1], jarjestysPaino(rivi.lahde))
    rekisteri.set(avain, lista)
  }

  for (const lista of rekisteri.values()) {
    lista.sort(
      (a, b) =>
        (painot.get(b) ?? 0) - (painot.get(a) ?? 0) || a.name.localeCompare(b.name, "fi")
    )
  }

  return rekisteri
}

/*
 * KAHDELLA HANKKEELLA TOISTUVA ON TARKEAMPI KUIN YHDELLA.
 *
 * `lahde` kertoo sen valmiiksi: johdetun rivin teksti on "johdettu
 * yrityksen omasta lahteesta, N hanketta", ja D-242 perustelee rekisterin
 * juuri tasta — *"28 hankkeella toistuva rakennuttaja on organisaation
 * vakiokontakti"*.
 *
 * KASIN LISATTY VOITTAA AINA. Johannes on valinnut sen itse, eika
 * Louhintahiekan tyopaallikolla ole viela yhtaan hanketta johon hanen
 * toistuvuutensa voisi perustua -- toistuvuusluku syrjayttaisi juuri sen
 * tiedon joka on tarkoituksella kerätty.
 */
export function jarjestysPaino(lahde: unknown): number {
  const teksti = String(lahde ?? "")
  if (/^kasin/i.test(teksti)) return 1_000_000
  const n = teksti.match(/,\s*(\d+)\s+hanketta/)
  return n ? Number(n[1]) : 0
}

/* Yrityksen yhteyshenkilot hankkeelle, tai tyhja jos yritysta ei tunneta. */
export function yrityksenYhteyshenkilot(
  hanke: { developer?: string | null; builder?: string | null },
  rekisteri: Yritysrekisteri
): YritysYhteyshenkilo[] {
  for (const avain of hankkeenYritysavaimet(hanke)) {
    const osuma = rekisteri.get(avain)
    if (osuma?.length) return osuma.slice(0, NAYTA_YRITYKSELTA_ENINTAAN)
  }
  return []
}

/*
 * OSAPUOLTEN YHTEYSHENKILOT (D-253).
 *
 * Aliurakoitsija, suunnittelija tai toimittaja `related_companies`- ja
 * `aliurakoitsijat`-kentista. Nama ovat ERI RYHMA kuin ylla: ne eivat
 * ole ostajapuolta, joten "taydentaa, ei korvaa" ei koske niita — ne
 * naytetaan omana ryhmanaan myos silloin kun hankkeella on oma
 * yhteyshenkilo.
 *
 * Organisaatio kirjoitetaan roolin kanssa ("Esimerkki Oy (osapuoli)"),
 * jottei asiakas luule aliurakoitsijaa ostajaksi.
 *
 * EI MITTARIIN. Mittari (D-239) kysyy onko ostajapuolella ihminen;
 * `laskeKattavuus` lukee vain `hankkeenYritysavaimet`ia eika tata.
 */
export type OsapuolenYhteyshenkilo = YritysYhteyshenkilo & { group: "osapuoli" }

export function osapuoltenYhteyshenkilot(
  hanke: YritysLahde,
  rekisteri: Yritysrekisteri
): OsapuolenYhteyshenkilo[] {
  const tulos: OsapuolenYhteyshenkilo[] = []
  for (const osapuoli of hankkeenOsapuolet(hanke)) {
    /* Katto per yritys: nelja osapuolta antaa edelleen 12 ihmista. */
    for (const henkilo of (rekisteri.get(osapuoli.avain) ?? []).slice(0, NAYTA_YRITYKSELTA_ENINTAAN)) {
      tulos.push({ ...henkilo, organization: osapuolenNimi(osapuoli), group: "osapuoli" })
    }
  }
  return tulos
}

/*
 * NIMETYN HENKILON YHTEYSTIEDOT REKISTERISTA (D-373).
 *
 * Johannes 6.11.2026: *"jos meilla tulee esimerkiksi hanke jossa on
 * vain mainittu 'Louhintahiekan tyopaallikko Jani Pullikka' niin
 * saamme hankkeelle hanen sahkopostin ja puhelinnumeron myos, koska ne
 * ovat meilla tallessa omassa rekisterissa."*
 *
 * Tama on ERI ASIA kuin `yrityksenYhteyshenkilot`. Se tarjoaa yrityksen
 * yleisia ihmisia kun hankkeella ei ole ketaan; tama taydentaa ihmisen
 * jonka HANKE ITSE nimeaa. Siksi taso on `project`, ei `company`:
 * henkilo on hankkeen oma, vain yhteystiedot tulevat rekisterista.
 *
 * YRITYKSEN ON OLTAVA HANKKEEN OSAPUOLI. Pelkka nimiosuma ei riita --
 * kaksi ihmista voi olla samannimisia, ja vaara numero on pahempi kuin
 * puuttuva (sama peruste kuin D-242:n avaimessa).
 *
 * TEKSTISTA LOYTYNYT VAIN KUN MUUTA EI OLE. Jos hankkeella on jo
 * tavoitettava ihminen, tekstissa mainittua ei lisata: kortille
 * kertyisi rinnakkain tyomaan vastaava ja yrityksen aluejohtaja, mika
 * on juuri se mita `yrityksenYhteyshenkilot`in "taydentaa, ei korvaa"
 * -saanto estaa. Kontaktissa jo olevan taydennys ei ole lisays, joten
 * sita tama rajaus ei koske.
 *
 * MITATTU 6.11.2026, 7 051 julkista hanketta: kontaktissa nimi ilman
 * tietoja 0, tekstista loytyvia ilman tavoitettavaa 3. Luku on pieni
 * koska rekisterin 163 henkilosta valtaosa on JOHDETTU hankkeiden
 * omista yhteyshenkiloista, eli he ovat niilla jo tietoineen. Arvo on
 * kasin lisatyissa (esim. Louhintahiekan 8 tyopaallikkoa): heita ei ole
 * yhdellakaan hankkeella, ja ensimmainen maininta liittaa numeron.
 */
export type NimettyTaydennys = Omit<YritysYhteyshenkilo, "level"> & {
  level: "project"
  /* Mista nimi loytyi — nakyy perusteluna, ei pelkkana arvona. */
  loytyi: "kontakti" | "teksti"
}

type TaydennysLahde = YritysLahde & {
  additional_info?: string | null
  metadata?: (YritysLahde["metadata"] & { description?: unknown; contact_persons?: unknown }) | null
}

const nimiavain = (nimi: unknown) => String(nimi ?? "").toLowerCase().replace(/\s+/g, " ").trim()

const tavoitettavissa = (k: unknown) => {
  const r = k as { email?: unknown; phone?: unknown } | null
  return Boolean(String(r?.email ?? "").trim() || String(r?.phone ?? "").trim())
}

export function nimetytTaydennykset(
  hanke: TaydennysLahde,
  rekisteri: Yritysrekisteri
): NimettyTaydennys[] {
  const omat = Array.isArray(hanke.metadata?.contact_persons)
    ? (hanke.metadata!.contact_persons as unknown[])
    : []
  const onTavoitettava = omat.some(tavoitettavissa)
  const omatNimet = new Map<string, unknown>()
  for (const k of omat) omatNimet.set(nimiavain((k as { name?: unknown })?.name), k)

  const teksti = `${hanke.additional_info ?? ""} ${String(hanke.metadata?.description ?? "")}`

  const tulos: NimettyTaydennys[] = []
  const nahdyt = new Set<string>()

  for (const avain of hankkeenYritysavaimet(hanke)) {
    for (const henkilo of rekisteri.get(avain) ?? []) {
      /* Ilman sahkopostia ja puhelinta ei ole mitaan taydennettavaa. */
      if (!henkilo.email && !henkilo.phone) continue
      const nimi = nimiavain(henkilo.name)
      if (!nimi || nahdyt.has(nimi)) continue

      const kontakti = omatNimet.get(nimi)
      if (kontakti !== undefined) {
        /* Jo tavoitettavissa: rekisterilla ei ole lisattavaa. */
        if (tavoitettavissa(kontakti)) continue
        nahdyt.add(nimi)
        tulos.push({ ...henkilo, level: "project", loytyi: "kontakti" })
        continue
      }

      if (onTavoitettava) continue
      /*
       * Nimi tekstista sellaisenaan. Ei osittaista osumaa: pelkka
       * sukunimi osuisi myos toiseen ihmiseen, ja hankkeen teksti on
       * pitka.
       */
      if (!teksti.includes(henkilo.name)) continue
      nahdyt.add(nimi)
      tulos.push({ ...henkilo, level: "project", loytyi: "teksti" })
    }
  }

  return tulos
}
