import { NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import {
  haeProfiiliRivi,
  supabaseProfiiliAdmin,
  tallennaProfiiliRivi,
} from "@/lib/users/profiiliRivi"

/*
 * OMAT TIEDOT: LUKU JA TALLENNUS (D-238).
 *
 * KAYTTAJA TUNNISTETAAN ISTUNNOSTA, EI PYYNNON KENTASTA. Osa vanhemmista
 * reiteista ottaa `userId`:n rungosta ja luottaa siihen; silloin kuka
 * tahansa kirjautunut voisi lukea ja kirjoittaa toisen tiedot. Nimi ja
 * puhelinnumero ovat henkilotietoa, joten tassa id tulee aina
 * istunnosta.
 *
 * YRITYS ON ADMININ ASETTAMA JA VAIN LUETTAVA. Johannes 6.10.2026:
 * *"Ei anneta asiakkaan muokata yrityksen nimea, mutta naytetaan se."*
 * Nimi on laskutuksen avain (`customer_billing.tunniste`), ja jos asiakas
 * kirjoittaisi "Koneunion" kun kannassa on "Koneunion Oy", laskutusrivi
 * irtoaisi tunnuksesta. `user_company` on lisaksi suojattu
 * service-rolelle, joten se luetaan tassa eika selaimessa.
 */

async function tunnistaKayttaja() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await tunnistaKayttaja()
  if (!user) {
    return NextResponse.json({ ok: false, error: "Ei istuntoa" }, { status: 401 })
  }

  const [profiili, { data: yritys }] = await Promise.all([
    haeProfiiliRivi(user.id),
    supabaseProfiiliAdmin
      .from("user_company")
      .select("yritys")
      .eq("user_id", user.id)
      .maybeSingle(),
  ])

  return NextResponse.json({
    ok: true,
    profiili: {
      etunimi: profiili?.first_name ?? "",
      sukunimi: profiili?.last_name ?? "",
      puhelin: profiili?.phone ?? "",
      sahkoposti: profiili?.email ?? user.email ?? "",
      yritys: yritys?.yritys ?? null,
    },
  })
}

const siisti = (arvo: unknown, maksimi: number) =>
  String(arvo ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maksimi)

export async function POST(request: Request) {
  const user = await tunnistaKayttaja()
  if (!user) {
    return NextResponse.json({ ok: false, error: "Ei istuntoa" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))

  const etunimi = siisti(body?.etunimi, 60)
  const sukunimi = siisti(body?.sukunimi, 60)
  const puhelin = siisti(body?.puhelin, 40)

  if (!etunimi) {
    return NextResponse.json({ ok: false, error: "Etunimi puuttuu" }, { status: 400 })
  }

  /*
   * `full_name` paivitetaan samalla, koska tiimisivu ja sahkopostit
   * lukevat sita. Ilman tata kaksi nimea eriaisi heti ensimmaisesta
   * tallennuksesta.
   */
  const kokonimi = [etunimi, sukunimi].filter(Boolean).join(" ")

  const virhe = await tallennaProfiiliRivi(user.id, {
    first_name: etunimi,
    last_name: sukunimi || null,
    phone: puhelin || null,
    full_name: kokonimi,
  })

  if (virhe) {
    return NextResponse.json({ ok: false, error: virhe }, { status: 500 })
  }

  return NextResponse.json({ ok: true, etunimi })
}
