import { createClient } from "@supabase/supabase-js"

import {
  MITATTAVAT_VAIHEET,
  laskeKattavuus,
  type Kattavuus,
  type MitattavaVaihe,
} from "@/lib/metrics/yhteystiedonKattavuus"
import type { Piste } from "../components/KattavuusTrendi"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * MITTARIT LUKEVAT ELAVAA TILAA, GRAAFIT TILANNEKUVIA (D-239).
 *
 * Neula nayttaa sen mika tilanne on nyt, ei sita mika se oli viime yona
 * — muuten korjaus ei nakyisi mittarissa ennen seuraavaa cronia. Graafi
 * taas voi nayttaa vain mitattuja paivia.
 *
 * EI KAADA /tic-SIVUA. Sivun varsinainen tyo on katselmointijono sen
 * alla; mittarit ovat ylareunassa. Virheessa palautetaan tyhja, jolloin
 * mittarit jaavat pois mutta jono toimii (sama peruste kuin
 * getTicDailySummary).
 */

export type YhteystietoMittarit = {
  kattavuus: Kattavuus[]
  historia: Record<MitattavaVaihe, Piste[]>
}

const TYHJA: YhteystietoMittarit = {
  kattavuus: [],
  historia: { construction: [], planning: [] },
}

/* Kuinka monta viimeisinta mittauspaivaa graafiin. */
const PAIVIA = 30

export async function getYhteystietoMittarit(): Promise<YhteystietoMittarit> {
  try {
    const hankkeet: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabaseAdmin
        .from("projects")
        .select("phase, status, is_public, metadata")
        .range(from, from + 999)
      if (error) throw error
      hankkeet.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }

    const kattavuus = laskeKattavuus(hankkeet)

    const { data: rivit } = await supabaseAdmin
      .from("yhteystieto_kattavuus")
      .select("paiva, vaihe, hankkeita, yhteystiedolla")
      .order("paiva", { ascending: true })
      .limit(PAIVIA * MITATTAVAT_VAIHEET.length)

    const historia: Record<MitattavaVaihe, Piste[]> = { construction: [], planning: [] }
    for (const rivi of rivit ?? []) {
      const vaihe = String(rivi.vaihe) as MitattavaVaihe
      if (!historia[vaihe]) continue
      historia[vaihe].push({
        paiva: String(rivi.paiva),
        osuus: rivi.hankkeita ? rivi.yhteystiedolla / rivi.hankkeita : 0,
      })
    }

    return { kattavuus, historia }
  } catch (error) {
    console.error("getYhteystietoMittarit:", error)
    return TYHJA
  }
}
