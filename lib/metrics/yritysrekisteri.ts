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

const TYHJA: Yritysrekisteri = new Map()

export async function haeYritysrekisteri(): Promise<Yritysrekisteri> {
  const { data, error } = await admin()
    .from("yritys_yhteyshenkilot")
    .select("avain, yritys, nimi, nimike, email, puhelin")
    .limit(2000)

  /*
   * Virhe ei saa kaataa mitaan: rekisteri on taydennys, ja ilman sita
   * hanke nayttaa samalta kuin ennen rekisterin olemassaoloa.
   */
  if (error) {
    console.error("haeYritysrekisteri:", error.message)
    return TYHJA
  }

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
    rekisteri.set(avain, lista)
  }

  return rekisteri
}

/* Yrityksen yhteyshenkilot hankkeelle, tai tyhja jos yritysta ei tunneta. */
export function yrityksenYhteyshenkilot(
  hanke: { developer?: string | null; builder?: string | null },
  rekisteri: Yritysrekisteri
): YritysYhteyshenkilo[] {
  for (const avain of hankkeenYritysavaimet(hanke)) {
    const osuma = rekisteri.get(avain)
    if (osuma?.length) return osuma
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
    for (const henkilo of rekisteri.get(osapuoli.avain) ?? []) {
      tulos.push({ ...henkilo, organization: osapuolenNimi(osapuoli), group: "osapuoli" })
    }
  }
  return tulos
}
