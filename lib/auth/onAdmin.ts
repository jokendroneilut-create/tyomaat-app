import { createClient } from "@supabase/supabase-js"

import { createServerSupabaseClient } from "@/lib/supabase/server"

import { isAdmin, parseAdminEmails, resolveRole } from "./roles"

/*
 * ONKO SIVUN AVAAJA ADMIN — PALVELINKOMPONENTEILLE (D-253).
 *
 * Middleware ohjaa jo ei-adminin pois /dashboard-poluilta, mutta
 * henkilotietoja nayttava sivu ei saa nojata pelkkaan siihen: matcher-
 * listan muutos tai uusi polku avaisi sen hiljaa. Sivu tarkistaa siis
 * itse ennen kuin lukee mitaan service-rolella.
 *
 * Sama saanto kuin middlewaressa ja `getRequestRole`ssa: ADMIN_EMAILS
 * voittaa, muuten `user_roles`. Rooli luetaan service-rolella vasta kun
 * istunto on todennettu, jottei RLS-asetus voi pudottaa adminia ulos.
 */
export type SivunOikeus = { ok: true; email: string } | { ok: false; syy: "ei-istuntoa" | "ei-admin" }

export async function tarkistaAdminSivu(): Promise<SivunOikeus> {
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  const user = error ? null : data.user
  if (!user) return { ok: false, syy: "ei-istuntoa" }

  const email = (user.email ?? "").toLowerCase()
  const admins = parseAdminEmails(process.env.ADMIN_EMAILS)

  let dbRole: string | null = null
  if (!admins.includes(email)) {
    const { data: rooli, error: rooliVirhe } = await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()
    if (rooliVirhe) console.error("tarkistaAdminSivu:", rooliVirhe.message)
    dbRole = rooli?.role ?? null
  }

  const role = resolveRole({ email, dbRole, adminEmails: admins })
  return isAdmin(role) ? { ok: true, email } : { ok: false, syy: "ei-admin" }
}
