import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

import { laskeKattavuus } from "@/lib/metrics/yhteystiedonKattavuus"

export const runtime = "nodejs"
export const maxDuration = 60

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/*
 * YHTEYSTIEDON KATTAVUUDEN PAIVITTAINEN TILANNEKUVA (D-239).
 *
 * Trendia ei voi laskea takautuvasti, koska yhteystiedot elavat
 * hankkeen metadatassa ilman versiota. Mittaus alkaa siis tasta
 * paivasta, ja jokainen paiva jolta rivi puuttuu on menetetty.
 *
 * IDEMPOTENTTI. Perusavain on (paiva, vaihe) ja kirjoitus on upsert,
 * joten ajo voidaan toistaa saman vuorokauden aikana ilman
 * kaksoisriveja — viimeisin ajo voittaa.
 *
 * PAIVA LASKETAAN HELSINGIN AJASSA. Vercel ajaa UTC:ssa, ja klo 03:30
 * ajettuna `toISOString()` antaisi kesaaikaan edellisen vuorokauden —
 * jolloin rivi menisi vaaralle paivalle ja ylikirjoittaisi eilisen.
 */
function helsinginPaiva(hetki = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Helsinki",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(hetki)
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const querySecret = url.searchParams.get("secret")
    const authHeader = req.headers.get("authorization")

    const isManualRun = !!querySecret && querySecret === process.env.CRON_SECRET
    const isCronRun = !!authHeader && authHeader === `Bearer ${process.env.CRON_SECRET}`

    if (!isManualRun && !isCronRun) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }

    /*
     * Koko kanta luetaan sivutettuna: PostgREST palauttaa enintaan 1 000
     * rivia kerralla, ja hankkeita on yli 6 600. Ilman sivutusta mittari
     * laskisi hiljaa vain ensimmaisesta tuhannesta.
     */
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

    const paiva = helsinginPaiva()
    const kattavuus = laskeKattavuus(hankkeet)

    const rivit = kattavuus.map((k) => ({
      paiva,
      vaihe: k.vaihe,
      hankkeita: k.hankkeita,
      yhteystiedolla: k.yhteystiedolla,
      hankekohtaisia: k.hankekohtaisia,
    }))

    /*
     * `hankekohtaisia` lisataan kantaan kasin ajettavalla SQL:lla
     * (D-241). Jos koodi menee tuotantoon ennen ajoa, kirjoitus kaatuisi
     * puuttuvaan sarakkeeseen ja koko paivan mittaus jaisi tekematta —
     * eika sita paivaa saa takaisin. Siksi varareitti ilman saraketta.
     */
    const { error: kirjoitusVirhe } = await supabaseAdmin
      .from("yhteystieto_kattavuus")
      .upsert(rivit, { onConflict: "paiva,vaihe" })

    if (kirjoitusVirhe) {
      const { error: varalla } = await supabaseAdmin
        .from("yhteystieto_kattavuus")
        .upsert(
          rivit.map(({ hankekohtaisia, ...muu }) => muu),
          { onConflict: "paiva,vaihe" }
        )
      if (varalla) throw varalla
    }

    return NextResponse.json({
      ok: true,
      paiva,
      luettuja: hankkeet.length,
      kattavuus: kattavuus.map((k) => ({
        vaihe: k.vaihe,
        hankkeita: k.hankkeita,
        yhteystiedolla: k.yhteystiedolla,
        hankekohtaisia: k.hankekohtaisia,
        osuus: Math.round(k.osuus * 100),
        hankekohtainenOsuus: Math.round(k.hankekohtainenOsuus * 100),
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Tuntematon virhe" },
      { status: 500 }
    )
  }
}
