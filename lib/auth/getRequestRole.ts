import { createClient } from "@supabase/supabase-js"

import { parseAdminEmails, resolveRole, type Role } from "./roles"

/*
 * Ratkaisee pyynnon esittajan jarjestelmaroolin bearer-tokenista.
 *
 * Sama tunnistautumistapa kuin /api/admin/* -reiteilla ennestaan
 * (selain lahettaa istunnon access tokenin). Cookie-pohjaisille
 * TIC-reiteille on oma verifyAdminRequest, jota tama ei korvaa.
 */

export type RequestRole =
  | { ok: true; role: Role; userId: string; email: string }
  | { ok: false; status: number; error: string }

export async function getRequestRole(req: Request): Promise<RequestRole> {
  const authHeader = req.headers.get("authorization")

  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "unauthorized" }
  }

  const token = authHeader.replace("Bearer ", "").trim()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return { ok: false, status: 401, error: "unauthorized" }
  }

  /*
   * Roolin haku ei saa kaataa adminia. Jos taulua ei viela ole tai
   * kysely epaonnistuu, rooli jaa tyhjaksi - jolloin ADMIN_EMAILS yha
   * kantaa eika kukaan saa oikeuksia joita ei ansaitse.
   */
  let dbRole: string | null = null

  const { data, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle()

  if (roleError) {
    console.error("Roolin haku epaonnistui:", roleError.message)
  } else {
    dbRole = data?.role ?? null
  }

  return {
    ok: true,
    role: resolveRole({
      email: user.email,
      dbRole,
      adminEmails: parseAdminEmails(process.env.ADMIN_EMAILS),
    }),
    userId: user.id,
    email: user.email ?? "",
  }
}
