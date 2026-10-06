import { createClient } from "@supabase/supabase-js"

/*
 * PROFIILIRIVI, VAIKKA PUHELINSARAKETTA EI VIELA OLISI (D-238).
 *
 * `phone` lisataan kantaan kasin ajettavalla SQL:lla. Jos koodi menee
 * tuotantoon ennen ajoa, `select("... phone ...")` palauttaa virheen —
 * eika se ole vain puuttuva kentta: koko kysely epaonnistuu, jolloin
 * tervehdys katoaa ja pakollinen lomake aukeaa kaikille.
 *
 * Siksi kysely yrittaa ensin puhelimen kanssa ja putoaa ilman sita.
 * Sama koskee tallennusta. Kun sarake on ajettu, varareitti ei aktivoidu
 * enaa koskaan — ja jos joku poistaa sarakkeen, mikaan ei hajoa.
 */

export const supabaseProfiiliAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type ProfiiliRivi = {
  first_name: string | null
  last_name: string | null
  phone: string | null
  full_name: string | null
  email: string | null
}

export async function haeProfiiliRivi(userId: string): Promise<ProfiiliRivi | null> {
  const taysi = await supabaseProfiiliAdmin
    .from("profiles")
    .select("first_name, last_name, phone, full_name, email")
    .eq("id", userId)
    .maybeSingle()

  if (!taysi.error) return (taysi.data as ProfiiliRivi) ?? null

  const ilmanPuhelinta = await supabaseProfiiliAdmin
    .from("profiles")
    .select("first_name, last_name, full_name, email")
    .eq("id", userId)
    .maybeSingle()

  if (ilmanPuhelinta.error || !ilmanPuhelinta.data) return null
  return { ...(ilmanPuhelinta.data as any), phone: null }
}

export async function tallennaProfiiliRivi(
  userId: string,
  arvot: { first_name: string; last_name: string | null; phone: string | null; full_name: string }
): Promise<string | null> {
  const taysi = await supabaseProfiiliAdmin.from("profiles").update(arvot).eq("id", userId)
  if (!taysi.error) return null

  const { phone, ...ilmanPuhelinta } = arvot
  const varalla = await supabaseProfiiliAdmin
    .from("profiles")
    .update(ilmanPuhelinta)
    .eq("id", userId)

  /*
   * Puhelin katoaa hiljaa vain siina tapauksessa etta saraketta ei ole.
   * Se on parempi kuin koko tallennuksen epaonnistuminen, mutta virhe
   * palautetaan jos myos varareitti kaatuu.
   */
  return varalla.error ? varalla.error.message : null
}
